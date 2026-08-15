import type { Asset, AssetDecision, AssetMetric } from "@/lib/domain/types";

/**
 * Experiment checkpoint thresholds.
 *
 * These are explicit constants rather than magic numbers so the operator can see
 * exactly what "meaningful" means, and so they can be tuned in one place.
 */
export const CHECKPOINT_THRESHOLDS = {
  /** Impressions in the latest window that count as "receiving impressions". */
  minImpressions: 1,
  /** Average-position improvement (in positions) that counts as "improving". */
  minPositionImprovement: 0.5,
  /** Clicks in the latest window that count as meaningful at day 60. */
  minMeaningfulClicks: 30,
  /** Clicks in the latest window that count as meaningful traffic at day 90. */
  minSustainedClicks: 100,
  /** CTR (0-1) below which a page with impressions looks like a snippet problem. */
  weakCtr: 0.02,
  /** Average position at or better than which a page is close enough to optimise. */
  optimizablePosition: 20,
} as const;

export type CheckpointStatus = "PENDING" | "MET" | "NOT_MET" | "NO_DATA";

export interface Checkpoint {
  day: 7 | 14 | 30 | 60 | 90;
  question: string;
  dueAt: string | null;
  status: CheckpointStatus;
  detail: string;
}

export interface CheckpointReview {
  ageDays: number | null;
  checkpoints: Checkpoint[];
  /** What the rules suggest. Never applied automatically. */
  recommendedDecision: AssetDecision;
  reasoning: string[];
  /** True when the stored decision differs from the recommendation. */
  isOverridden: boolean;
}

export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Evaluates the day 7/14/30/60/90 checkpoints for an asset.
 *
 * A failed checkpoint never kills an asset by itself — this function only ever
 * produces a *recommendation* plus the reasoning behind it. The operator decides.
 */
export function reviewAsset(
  asset: Asset,
  metrics: AssetMetric[],
  now: Date = new Date(),
): CheckpointReview {
  const ageDays = daysSince(asset.publishedAt, now);
  const ordered = [...metrics].sort(
    (a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime(),
  );
  const latest = ordered[ordered.length - 1] ?? null;
  const earliest = ordered[0] ?? null;

  const impressions = latest?.impressions ?? asset.impressions;
  const clicks = latest?.clicks ?? asset.clicks;
  const ctr = latest?.ctr ?? asset.ctr;
  const position = latest?.averagePosition ?? asset.averagePosition;
  const revenue = latest?.revenue ?? asset.revenue;

  const due = (day: number): boolean =>
    ageDays !== null && ageDays >= day;

  const checkpoints: Checkpoint[] = [];

  // Day 7 — indexed?
  checkpoints.push({
    day: 7,
    question: "Indexed?",
    dueAt: asset.publishedAt ? addDays(asset.publishedAt, 7) : null,
    status: asset.indexedAt
      ? "MET"
      : !due(7)
        ? "PENDING"
        : "NOT_MET",
    detail: asset.indexedAt
      ? `Indexation recorded on ${asset.indexedAt.slice(0, 10)}.`
      : due(7)
        ? "No indexation date recorded. Confirm indexation in Search Console and record the date."
        : "Not due yet.",
  });

  // Day 14 — receiving impressions?
  checkpoints.push({
    day: 14,
    question: "Receiving impressions?",
    dueAt: asset.publishedAt ? addDays(asset.publishedAt, 14) : null,
    status:
      impressions === null
        ? due(14)
          ? "NO_DATA"
          : "PENDING"
        : impressions >= CHECKPOINT_THRESHOLDS.minImpressions
          ? "MET"
          : due(14)
            ? "NOT_MET"
            : "PENDING",
    detail:
      impressions === null
        ? "No impression data recorded. Add a metric entry or connect a Search Analytics provider."
        : `${formatInt(impressions)} impressions in the latest recorded window.`,
  });

  // Day 30 — are rankings improving?
  const positionSeries = ordered.filter((m) => m.averagePosition !== null);
  const first = positionSeries[0]?.averagePosition ?? null;
  const last = positionSeries[positionSeries.length - 1]?.averagePosition ?? null;
  const improvement =
    first !== null && last !== null && positionSeries.length >= 2
      ? first - last
      : null;

  checkpoints.push({
    day: 30,
    question: "Are rankings improving?",
    dueAt: asset.publishedAt ? addDays(asset.publishedAt, 30) : null,
    status:
      improvement === null
        ? due(30)
          ? "NO_DATA"
          : "PENDING"
        : improvement >= CHECKPOINT_THRESHOLDS.minPositionImprovement
          ? "MET"
          : due(30)
            ? "NOT_MET"
            : "PENDING",
    detail:
      improvement === null
        ? "At least two metric entries with an average position are needed to judge a trend."
        : improvement >= 0
          ? `Average position improved by ${improvement.toFixed(1)} (from ${first?.toFixed(1)} to ${last?.toFixed(1)}).`
          : `Average position worsened by ${Math.abs(improvement).toFixed(1)} (from ${first?.toFixed(1)} to ${last?.toFixed(1)}).`,
  });

  // Day 60 — receiving meaningful clicks?
  checkpoints.push({
    day: 60,
    question: "Receiving meaningful clicks?",
    dueAt: asset.publishedAt ? addDays(asset.publishedAt, 60) : null,
    status:
      clicks === null
        ? due(60)
          ? "NO_DATA"
          : "PENDING"
        : clicks >= CHECKPOINT_THRESHOLDS.minMeaningfulClicks
          ? "MET"
          : due(60)
            ? "NOT_MET"
            : "PENDING",
    detail:
      clicks === null
        ? "No click data recorded."
        : `${formatInt(clicks)} clicks in the latest window (threshold ${CHECKPOINT_THRESHOLDS.minMeaningfulClicks}).`,
  });

  // Day 90 — meaningful traffic or revenue?
  const hasRevenue = revenue !== null && revenue > 0;
  const hasSustainedClicks =
    clicks !== null && clicks >= CHECKPOINT_THRESHOLDS.minSustainedClicks;

  checkpoints.push({
    day: 90,
    question: "Producing meaningful traffic or revenue?",
    dueAt: asset.publishedAt ? addDays(asset.publishedAt, 90) : null,
    status:
      clicks === null && revenue === null
        ? due(90)
          ? "NO_DATA"
          : "PENDING"
        : hasRevenue || hasSustainedClicks
          ? "MET"
          : due(90)
            ? "NOT_MET"
            : "PENDING",
    detail:
      clicks === null && revenue === null
        ? "No traffic or revenue data recorded."
        : `${clicks === null ? "Clicks unknown" : `${formatInt(clicks)} clicks`}, ${
            revenue === null ? "revenue unknown" : `revenue ${revenue.toFixed(2)}`
          } (thresholds: ${CHECKPOINT_THRESHOLDS.minSustainedClicks} clicks or any revenue).`,
  });

  const { decision, reasoning } = recommendDecision({
    ageDays,
    impressions,
    clicks,
    ctr,
    position,
    revenue,
    improvement,
    earliest,
    latest,
    published: Boolean(asset.publishedAt),
  });

  return {
    ageDays,
    checkpoints,
    recommendedDecision: decision,
    reasoning,
    isOverridden: asset.assetDecision !== decision,
  };
}

interface RecommendationInput {
  ageDays: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  position: number | null;
  revenue: number | null;
  improvement: number | null;
  earliest: AssetMetric | null;
  latest: AssetMetric | null;
  published: boolean;
}

function recommendDecision(input: RecommendationInput): {
  decision: AssetDecision;
  reasoning: string[];
} {
  const reasoning: string[] = [];

  if (!input.published) {
    return {
      decision: "WAIT",
      reasoning: ["No publication date recorded, so the experiment clock has not started."],
    };
  }

  const age = input.ageDays ?? 0;

  // Growth signal — compare first and latest recorded clicks.
  const clickGrowth =
    input.earliest?.clicks != null && input.latest?.clicks != null && input.earliest !== input.latest
      ? input.latest.clicks - input.earliest.clicks
      : null;

  const { impressions, clicks, ctr, position, revenue } = input;

  const clearsDay90Bar =
    (revenue !== null && revenue > 0) ||
    (clicks !== null && clicks >= CHECKPOINT_THRESHOLDS.minSustainedClicks);

  const isBeingServed = impressions !== null && impressions > 0;

  const hasWeakCtr =
    isBeingServed && ctr !== null && ctr < CHECKPOINT_THRESHOLDS.weakCtr;

  const isNearMiss =
    position !== null &&
    position > 3 &&
    position <= CHECKPOINT_THRESHOLDS.optimizablePosition;

  // Clearing the bar with a leaking snippet is not a scaling situation: fixing
  // the CTR on traffic already being served is cheaper than building the next
  // asset, so optimisation takes precedence over expansion.
  if (clearsDay90Bar && !hasWeakCtr) {
    if (clickGrowth !== null && clickGrowth > 0) {
      reasoning.push(
        `Clicks grew by ${formatInt(clickGrowth)} between the first and latest recorded windows.`,
      );
    }
    if (revenue !== null && revenue > 0) {
      reasoning.push(`Recorded revenue of ${revenue.toFixed(2)} in the latest window.`);
    }
    reasoning.push(
      "The asset clears the day-90 bar, so the leverage is in expanding the cluster around it.",
    );
    return { decision: "SCALE", reasoning };
  }

  if (isBeingServed && (hasWeakCtr || isNearMiss)) {
    reasoning.push(
      `${formatInt(impressions)} impressions recorded, so the page is being served.`,
    );
    if (hasWeakCtr && ctr !== null) {
      reasoning.push(
        `CTR of ${(ctr * 100).toFixed(2)}% is below the ${(CHECKPOINT_THRESHOLDS.weakCtr * 100).toFixed(0)}% bar — a title/meta or intent-match problem rather than a demand problem.`,
      );
    }
    if (position !== null && position > 3) {
      reasoning.push(
        `Average position ${position.toFixed(1)} is close enough that on-page improvements can move it.`,
      );
    }
    return { decision: "OPTIMIZE", reasoning };
  }

  // A kill needs *measured* zeros. An asset whose metrics were simply never
  // entered has no evidence against it, and absence of data must never be read
  // as evidence of failure.
  const hasMeasuredZero =
    (impressions !== null || clicks !== null) &&
    (impressions ?? 0) === 0 &&
    (clicks ?? 0) === 0;

  if (age >= 90 && hasMeasuredZero) {
    reasoning.push(
      `${age} days since publication with measured zeros for impressions and clicks.`,
    );
    reasoning.push(
      "Either the measurement is wrong or the asset genuinely has no organic signal — confirm the data before killing it.",
    );
    return { decision: "KILL", reasoning };
  }

  if (age < 30) {
    reasoning.push(
      `Only ${age} days since publication. It is too early to draw conclusions.`,
    );
  } else if (impressions === null && clicks === null) {
    reasoning.push(
      "No measurement data recorded yet, so no decision can be justified. Add metrics first.",
    );
  } else {
    reasoning.push(
      "Signals are present but below the thresholds for scaling or optimising. Keep measuring.",
    );
  }

  if (input.improvement !== null && input.improvement > 0) {
    reasoning.push(
      `Average position is trending in the right direction (${input.improvement.toFixed(1)} positions gained).`,
    );
  }

  return { decision: "WAIT", reasoning };
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
