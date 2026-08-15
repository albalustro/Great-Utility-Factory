import "server-only";

import { getDataContext } from "@/lib/data";
import type { Asset, AssetMetric, Opportunity } from "@/lib/domain/types";
import { reviewAsset, type CheckpointReview } from "@/lib/engine/checkpoints";
import {
  computeNextBestActions,
  type NextBestAction,
} from "@/lib/engine/next-best-action";
import { decisionForScore } from "@/lib/scoring/engine";

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  hint: string;
}

export interface AssetWithReview {
  asset: Asset;
  metrics: AssetMetric[];
  review: CheckpointReview;
  /** Change in clicks between the first and latest recorded windows. */
  clickDelta: number | null;
}

export interface Kpis {
  discovered: number;
  qualified: number;
  readyToBuild: number;
  live: number;
  /** Sums of the latest recorded window across assets; null when nothing is recorded. */
  clicksLatestWindow: number | null;
  revenueLatestWindow: number | null;
  assetsWithClickData: number;
  assetsWithRevenueData: number;
}

export interface DashboardData {
  actions: NextBestAction[];
  kpis: Kpis;
  funnel: FunnelStage[];
  topOpportunities: Opportunity[];
  recentlyPublished: AssetWithReview[];
  gainingTraction: AssetWithReview[];
  needsAttention: AssetWithReview[];
  currency: string;
  isDemoData: boolean;
}

const AFTER_INBOX = new Set([
  "RESEARCH",
  "QUALIFIED",
  "READY_TO_BUILD",
  "BUILDING",
  "PUBLISHED",
  "MEASURING",
  "WINNER",
  "KILLED",
]);
const QUALIFIED_OR_BEYOND = new Set([
  "QUALIFIED",
  "READY_TO_BUILD",
  "BUILDING",
  "PUBLISHED",
  "MEASURING",
  "WINNER",
]);
const BUILT = new Set(["PUBLISHED", "MEASURING", "WINNER"]);

/**
 * Assembles everything the dashboard shows in one pass.
 *
 * Sums are only reported over assets that actually have the metric recorded,
 * and the count of contributing assets travels with the number so the UI can say
 * "across 2 of 3 assets" instead of implying full coverage.
 */
export async function loadDashboard(now = new Date()): Promise<DashboardData> {
  const { store, settings } = await getDataContext();

  const [opportunities, assets, metricsByAsset, indexes] = await Promise.all([
    store.listOpportunities(),
    store.listAssets(),
    store.listAllAssetMetrics(),
    store.getOpportunityIndexes(),
  ]);

  const enriched: AssetWithReview[] = assets.map((asset) => {
    const metrics = metricsByAsset[asset.id] ?? [];
    const first = metrics.find((m) => m.clicks !== null);
    const last = [...metrics].reverse().find((m) => m.clicks !== null);
    const clickDelta =
      first && last && first.id !== last.id
        ? (last.clicks ?? 0) - (first.clicks ?? 0)
        : null;

    return {
      asset,
      metrics,
      review: reviewAsset(asset, metrics, now),
      clickDelta,
    };
  });

  const actions = computeNextBestActions({
    opportunities,
    assets,
    metricsByAsset,
    opportunitiesWithBuildPack: indexes.withBuildPack,
    opportunitiesWithAnalysis: indexes.withAnalysis,
    opportunitiesWithSerp: indexes.withSerp,
    opportunitiesInCluster: indexes.inCluster,
    now,
  });

  const clicksKnown = assets.filter((a) => a.clicks !== null);
  const revenueKnown = assets.filter((a) => a.revenue !== null);

  const kpis: Kpis = {
    discovered: opportunities.length,
    qualified: opportunities.filter((o) => QUALIFIED_OR_BEYOND.has(o.status)).length,
    readyToBuild: opportunities.filter((o) => o.status === "READY_TO_BUILD").length,
    live: assets.filter((a) => a.publishedAt !== null).length,
    clicksLatestWindow: clicksKnown.length
      ? clicksKnown.reduce((sum, a) => sum + (a.clicks ?? 0), 0)
      : null,
    revenueLatestWindow: revenueKnown.length
      ? revenueKnown.reduce((sum, a) => sum + (a.revenue ?? 0), 0)
      : null,
    assetsWithClickData: clicksKnown.length,
    assetsWithRevenueData: revenueKnown.length,
  };

  const gettingTraffic = enriched.filter(
    (item) => (item.asset.clicks ?? 0) > 0 || (item.asset.impressions ?? 0) > 0,
  );
  const winners = enriched.filter(
    (item) => item.asset.assetDecision === "SCALE" || item.review.recommendedDecision === "SCALE",
  );

  const funnel: FunnelStage[] = [
    {
      key: "discovered",
      label: "Discovered",
      count: opportunities.length,
      hint: "Every opportunity in the system, whatever its state.",
    },
    {
      key: "researched",
      label: "Researched",
      count: opportunities.filter((o) => AFTER_INBOX.has(o.status)).length,
      hint: "Opportunities that have moved out of the inbox.",
    },
    {
      key: "qualified",
      label: "Qualified",
      count: opportunities.filter((o) => QUALIFIED_OR_BEYOND.has(o.status)).length,
      hint: "Passed research and judged worth building or better.",
    },
    {
      key: "built",
      label: "Built",
      count: opportunities.filter((o) => BUILT.has(o.status)).length,
      hint: "Shipped as a live utility.",
    },
    {
      key: "traffic",
      label: "Getting Traffic",
      count: gettingTraffic.length,
      hint: "Assets with impressions or clicks recorded.",
    },
    {
      key: "winners",
      label: "Winners",
      count: winners.length,
      hint: "Assets marked SCALE, or recommended for it by the checkpoint rules.",
    },
  ];

  const topOpportunities = [...opportunities]
    .filter((o) => o.status !== "KILLED")
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 6);

  const recentlyPublished = [...enriched]
    .filter((item) => item.asset.publishedAt)
    .sort((a, b) =>
      (b.asset.publishedAt ?? "").localeCompare(a.asset.publishedAt ?? ""),
    )
    .slice(0, 4);

  const gainingTraction = enriched
    .filter((item) => (item.clickDelta ?? 0) > 0)
    .sort((a, b) => (b.clickDelta ?? 0) - (a.clickDelta ?? 0))
    .slice(0, 4);

  const needsAttention = enriched
    .filter(
      (item) =>
        item.review.recommendedDecision === "OPTIMIZE" ||
        item.review.recommendedDecision === "KILL" ||
        item.review.checkpoints.some((c) => c.status === "NOT_MET"),
    )
    .slice(0, 4);

  return {
    actions,
    kpis,
    funnel,
    topOpportunities,
    recentlyPublished,
    gainingTraction,
    needsAttention,
    currency: settings.currency,
    isDemoData: opportunities.some((o) => o.isDemo) || assets.some((a) => a.isDemo),
  };
}

export function decisionFor(opportunity: Opportunity, thresholds?: Parameters<typeof decisionForScore>[1]) {
  return decisionForScore(opportunity.opportunityScore, thresholds);
}
