import type {
  Asset,
  AssetMetric,
  Decision,
  Opportunity,
} from "@/lib/domain/types";
import { reviewAsset, daysSince } from "@/lib/engine/checkpoints";

export const ACTION_TYPES = [
  "SCALE",
  "OPTIMIZE",
  "BUILD",
  "GENERATE_BUILD_PACK",
  "RESEARCH",
  "ANALYZE_SERP",
  "REVIEW",
  "IMPORT",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface NextBestAction {
  actionType: ActionType;
  entity: {
    type: "OPPORTUNITY" | "ASSET" | "NONE";
    id: string | null;
    label: string;
  };
  /** Why this is the next best use of the operator's time. */
  reason: string;
  /** Lower is more urgent. Stable across runs for the same inputs. */
  priority: number;
  href: string;
  /** Supporting evidence lines, all drawn from stored data. */
  evidence: string[];
}

export interface NextBestActionInput {
  opportunities: Opportunity[];
  assets: Asset[];
  metricsByAsset: Record<string, AssetMetric[]>;
  /** Opportunity ids that already have at least one build pack. */
  opportunitiesWithBuildPack: Set<string>;
  /** Opportunity ids that already have at least one AI analysis. */
  opportunitiesWithAnalysis: Set<string>;
  /** Opportunity ids that have at least one captured SERP result. */
  opportunitiesWithSerp: Set<string>;
  /** Opportunity ids that belong to at least one cluster. */
  opportunitiesInCluster: Set<string>;
  now?: Date;
}

/**
 * Deterministic Next Best Action engine (v1).
 *
 * The ordering encodes a simple thesis: money already earned is worth more than
 * money hoped for. Compounding an asset that works beats starting a new one,
 * fixing a page that is already being served beats building from zero, and
 * anything that has been sitting untouched for a long time is a decision debt
 * that must be cleared.
 *
 * Every action carries its own evidence so the operator can disagree with it.
 * This is intentionally rule-based and side-effect free so it can later be
 * swapped for, or ensembled with, an AI ranker behind the same signature.
 */
export function computeNextBestActions(
  input: NextBestActionInput,
): NextBestAction[] {
  const now = input.now ?? new Date();
  const actions: NextBestAction[] = [];

  const opportunityById = new Map(input.opportunities.map((o) => [o.id, o]));

  // --- 1. Winners with momentum that have not been expanded -> SCALE -------
  for (const asset of input.assets) {
    const review = reviewAsset(asset, input.metricsByAsset[asset.id] ?? [], now);
    if (review.recommendedDecision !== "SCALE") continue;

    const linkedOpportunity = asset.opportunityId
      ? opportunityById.get(asset.opportunityId)
      : undefined;
    const alreadyClustered = linkedOpportunity
      ? input.opportunitiesInCluster.has(linkedOpportunity.id)
      : false;

    actions.push({
      actionType: "SCALE",
      entity: { type: "ASSET", id: asset.id, label: asset.name },
      reason: alreadyClustered
        ? `${asset.name} is performing and already sits in a cluster — add the next utility in that cluster.`
        : `${asset.name} is performing but has no cluster around it. Expanding it is the cheapest growth available.`,
      priority: alreadyClustered ? 12 : 10,
      href: `/portfolio/${asset.id}`,
      evidence: review.reasoning,
    });
  }

  // --- 2. Measuring assets with impressions but weak CTR -> OPTIMIZE -------
  for (const asset of input.assets) {
    const review = reviewAsset(asset, input.metricsByAsset[asset.id] ?? [], now);
    if (review.recommendedDecision !== "OPTIMIZE") continue;

    actions.push({
      actionType: "OPTIMIZE",
      entity: { type: "ASSET", id: asset.id, label: asset.name },
      reason: `${asset.name} is already being served in search but is under-converting the impressions it gets.`,
      priority: 20,
      href: `/portfolio/${asset.id}`,
      evidence: review.reasoning,
    });
  }

  // --- 3. READY_TO_BUILD opportunities, best score first -> BUILD ----------
  const readyToBuild = input.opportunities
    .filter((o) => o.status === "READY_TO_BUILD")
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  readyToBuild.forEach((opportunity, index) => {
    const hasPack = input.opportunitiesWithBuildPack.has(opportunity.id);
    actions.push({
      actionType: "BUILD",
      entity: {
        type: "OPPORTUNITY",
        id: opportunity.id,
        label: opportunity.keyword,
      },
      reason: hasPack
        ? `${opportunity.keyword} is queued to build and the build pack is ready to hand to Claude Code.`
        : `${opportunity.keyword} is queued to build but has no build pack yet.`,
      priority: 30 + index,
      href: `/opportunities/${opportunity.id}${hasPack ? "?tab=build-pack" : ""}`,
      evidence: [
        `Opportunity score ${opportunity.opportunityScore}/100.`,
        opportunity.searchVolume === null
          ? "Search volume unknown."
          : `Search volume ${formatInt(opportunity.searchVolume)}/mo.`,
        opportunity.serpWeaknessScore === null
          ? "SERP weakness not assessed."
          : `SERP weakness ${opportunity.serpWeaknessScore}/100.`,
        `Waiting in Ready to Build for ${daysSince(opportunity.statusChangedAt, now) ?? 0} day(s).`,
      ],
    });
  });

  // --- 4. QUALIFIED without a build pack -> GENERATE BUILD PACK -----------
  const qualified = input.opportunities
    .filter(
      (o) =>
        o.status === "QUALIFIED" && !input.opportunitiesWithBuildPack.has(o.id),
    )
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  qualified.forEach((opportunity, index) => {
    actions.push({
      actionType: "GENERATE_BUILD_PACK",
      entity: {
        type: "OPPORTUNITY",
        id: opportunity.id,
        label: opportunity.keyword,
      },
      reason: `${opportunity.keyword} is qualified but cannot move to build without a build pack.`,
      priority: 40 + index,
      href: `/opportunities/${opportunity.id}?tab=build-pack`,
      evidence: [
        `Opportunity score ${opportunity.opportunityScore}/100.`,
        input.opportunitiesWithAnalysis.has(opportunity.id)
          ? "An AI analysis already exists to draw from."
          : "No AI analysis yet — the pack will be built from recorded data only.",
      ],
    });
  });

  // --- 5. RESEARCH opportunities with promising scores -> RESEARCH --------
  const research = input.opportunities
    .filter((o) => o.status === "RESEARCH" || o.status === "INBOX")
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  research.forEach((opportunity, index) => {
    const missingSerp = !input.opportunitiesWithSerp.has(opportunity.id);
    const promising =
      opportunity.opportunityScore >= 50 ||
      (opportunity.searchVolume !== null && opportunity.searchVolume >= 1000);

    if (!promising && !missingSerp) return;

    actions.push({
      actionType: missingSerp ? "ANALYZE_SERP" : "RESEARCH",
      entity: {
        type: "OPPORTUNITY",
        id: opportunity.id,
        label: opportunity.keyword,
      },
      reason: missingSerp
        ? `${opportunity.keyword} has demand recorded but no SERP captured, so its biggest scoring factor is still unknown.`
        : `${opportunity.keyword} looks promising and is still sitting in research.`,
      priority: 50 + index,
      href: `/opportunities/${opportunity.id}${missingSerp ? "?tab=serp" : ""}`,
      evidence: [
        opportunity.searchVolume === null
          ? "Search volume unknown."
          : `Search volume ${formatInt(opportunity.searchVolume)}/mo.`,
        opportunity.keywordDifficulty === null
          ? "Keyword difficulty unknown."
          : `Keyword difficulty ${opportunity.keywordDifficulty}.`,
        `Current score ${opportunity.opportunityScore}/100.`,
      ],
    });
  });

  // --- 6. Old assets with no signal -> REVIEW / POSSIBLE KILL -------------
  for (const asset of input.assets) {
    const review = reviewAsset(asset, input.metricsByAsset[asset.id] ?? [], now);
    if (review.recommendedDecision !== "KILL") continue;
    if (asset.assetDecision === "KILL") continue;

    actions.push({
      actionType: "REVIEW",
      entity: { type: "ASSET", id: asset.id, label: asset.name },
      reason: `${asset.name} has produced no measurable organic signal and needs a keep-or-kill decision.`,
      priority: 60,
      href: `/portfolio/${asset.id}`,
      evidence: review.reasoning,
    });
  }

  // --- 7. Nothing in the funnel at all -> IMPORT --------------------------
  if (input.opportunities.length === 0) {
    actions.push({
      actionType: "IMPORT",
      entity: { type: "NONE", id: null, label: "Opportunity pipeline" },
      reason:
        "There are no opportunities in the system yet. Import a keyword export or add one manually to start the funnel.",
      priority: 90,
      href: "/opportunities/import",
      evidence: [],
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

export function nextBestAction(
  input: NextBestActionInput,
): NextBestAction | null {
  return computeNextBestActions(input)[0] ?? null;
}

/** Decision badge tone used consistently across the UI. */
export function decisionTone(
  decision: Decision,
): "positive" | "info" | "warning" | "danger" {
  switch (decision) {
    case "BUILD":
      return "positive";
    case "INVESTIGATE":
      return "info";
    case "WATCH":
      return "warning";
    case "REJECT":
      return "danger";
  }
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
