import {
  DEFAULT_DEMAND_CALIBRATION,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_THRESHOLDS,
  type Decision,
  type DecisionThresholds,
  type DemandCalibration,
  type Opportunity,
  type ScoringWeights,
} from "@/lib/domain/types";
import { normalizeSearchVolume } from "@/lib/scoring/demand";

export type ScoreFactorKey = keyof ScoringWeights;

export interface ScoreFactor {
  key: ScoreFactorKey;
  label: string;
  /** Maximum points this factor can contribute. */
  weight: number;
  /** Operator/derived 0-100 value, or null when there is no data. */
  raw: number | null;
  /** Points actually contributed to the total. */
  weighted: number;
  hasData: boolean;
  /** Why this factor scored what it scored. */
  reason: string;
  /** The underlying evidence, when the factor is derived from a metric. */
  evidence: string | null;
  /** True when the operator manually overrode the derived value. */
  overridden?: boolean;
}

export interface ScoreBreakdown {
  /** 0-100, rounded. */
  total: number;
  factors: ScoreFactor[];
  decision: Decision;
  /**
   * Share of total weight (0-100) backed by actual data. A high score built on
   * low completeness is a weak signal, and the UI says so.
   */
  completeness: number;
  missingFactors: string[];
  weights: ScoringWeights;
  thresholds: DecisionThresholds;
}

export interface ScoreOptions {
  weights?: ScoringWeights;
  thresholds?: DecisionThresholds;
  demandCalibration?: DemandCalibration;
}

const FACTOR_LABELS: Record<ScoreFactorKey, string> = {
  demand: "Demand",
  serpWeakness: "SERP Weakness",
  utilityFit: "Utility Fit",
  monetization: "Monetization",
  evergreen: "Evergreen",
  buildSimplicity: "Build Simplicity",
  clusterPotential: "Cluster Potential",
};

const MANUAL_FACTOR_HINTS: Record<
  Exclude<ScoreFactorKey, "demand">,
  { field: keyof Opportunity; prompt: string }
> = {
  serpWeakness: {
    field: "serpWeaknessScore",
    prompt:
      "Not assessed. Review the SERP tab and record a weakness score based on the results you captured.",
  },
  utilityFit: {
    field: "utilityFitScore",
    prompt:
      "Not assessed. Score how completely a simple web utility can satisfy this query.",
  },
  monetization: {
    field: "monetizationScore",
    prompt:
      "Not assessed. Score the commercial value of the traffic (CPC is a useful reference point).",
  },
  evergreen: {
    field: "evergreenScore",
    prompt:
      "Not assessed. Score how durable the demand is likely to be over years.",
  },
  buildSimplicity: {
    field: "buildSimplicityScore",
    prompt:
      "Not assessed. Score how quickly the utility could realistically be shipped.",
  },
  clusterPotential: {
    field: "clusterPotentialScore",
    prompt:
      "Not assessed. Score how many adjacent utilities this keyword could unlock.",
  },
};

/** Inputs the scoring engine needs. Kept structural so tests can build fixtures. */
export type ScorableOpportunity = Pick<
  Opportunity,
  | "searchVolume"
  | "keywordDifficulty"
  | "cpc"
  | "serpWeaknessScore"
  | "utilityFitScore"
  | "monetizationScore"
  | "evergreenScore"
  | "buildSimplicityScore"
  | "clusterPotentialScore"
  | "demandScoreOverride"
  | "demandScoreOverrideReason"
>;

/**
 * Produces a fully explainable opportunity score.
 *
 * Design decision: a factor with no data contributes **zero** points and is not
 * renormalised away. Renormalising would let an opportunity with a single known
 * factor score 95/100, which would be a fabricated signal. Instead the score is
 * a lower bound given known evidence, and `completeness` tells the operator how
 * much of the model was actually informed.
 */
export function scoreOpportunity(
  opportunity: ScorableOpportunity,
  options: ScoreOptions = {},
): ScoreBreakdown {
  const weights = options.weights ?? DEFAULT_SCORING_WEIGHTS;
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const calibration = options.demandCalibration ?? DEFAULT_DEMAND_CALIBRATION;

  const factors: ScoreFactor[] = [];

  // --- Demand: derived from search volume, overridable with a reason. -------
  const normalized = normalizeSearchVolume(opportunity.searchVolume, calibration);
  const hasOverride =
    opportunity.demandScoreOverride !== null &&
    opportunity.demandScoreOverride !== undefined;
  const demandRaw = hasOverride
    ? clamp(opportunity.demandScoreOverride as number)
    : normalized.score;

  factors.push({
    key: "demand",
    label: FACTOR_LABELS.demand,
    weight: weights.demand,
    raw: demandRaw,
    weighted: contribution(demandRaw, weights.demand),
    hasData: demandRaw !== null,
    overridden: hasOverride,
    reason: hasOverride
      ? `Manually overridden to ${demandRaw}/100. Reason: ${
          opportunity.demandScoreOverrideReason?.trim() || "no reason recorded"
        }. Derived value was ${
          normalized.score === null ? "unavailable" : `${normalized.score}/100`
        }.`
      : normalized.explanation,
    evidence:
      opportunity.searchVolume === null
        ? null
        : `Search volume: ${new Intl.NumberFormat("en-US").format(opportunity.searchVolume)}/mo`,
  });

  // --- Manual judgement factors -------------------------------------------
  const manualKeys = Object.keys(MANUAL_FACTOR_HINTS) as Array<
    Exclude<ScoreFactorKey, "demand">
  >;

  for (const key of manualKeys) {
    const hint = MANUAL_FACTOR_HINTS[key];
    const value = opportunity[hint.field as keyof ScorableOpportunity] as
      | number
      | null;
    const raw = value === null || value === undefined ? null : clamp(value);
    const weight = weights[key];

    factors.push({
      key,
      label: FACTOR_LABELS[key],
      weight,
      raw,
      weighted: contribution(raw, weight),
      hasData: raw !== null,
      reason:
        raw === null
          ? hint.prompt
          : `Assessed at ${raw}/100, contributing ${formatPoints(
              contribution(raw, weight),
            )} of a possible ${weight} points.`,
      evidence: evidenceFor(key, opportunity),
    });
  }

  const total = round1(factors.reduce((sum, f) => sum + f.weighted, 0));
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const knownWeight = factors
    .filter((f) => f.hasData)
    .reduce((sum, f) => sum + f.weight, 0);

  return {
    total: Math.round(total),
    factors,
    decision: decisionForScore(Math.round(total), thresholds),
    completeness:
      totalWeight === 0 ? 0 : Math.round((knownWeight / totalWeight) * 100),
    missingFactors: factors.filter((f) => !f.hasData).map((f) => f.label),
    weights,
    thresholds,
  };
}

export function decisionForScore(
  score: number,
  thresholds: DecisionThresholds = DEFAULT_THRESHOLDS,
): Decision {
  if (score >= thresholds.build) return "BUILD";
  if (score >= thresholds.investigate) return "INVESTIGATE";
  if (score >= thresholds.watch) return "WATCH";
  return "REJECT";
}

export function weightsTotal(weights: ScoringWeights): number {
  return Object.values(weights).reduce((sum, value) => sum + value, 0);
}

function evidenceFor(
  key: Exclude<ScoreFactorKey, "demand">,
  opportunity: ScorableOpportunity,
): string | null {
  if (key === "monetization" && opportunity.cpc !== null) {
    return `CPC: ${opportunity.cpc.toFixed(2)}`;
  }
  if (key === "serpWeakness" && opportunity.keywordDifficulty !== null) {
    return `Keyword difficulty: ${opportunity.keywordDifficulty}`;
  }
  return null;
}

function contribution(raw: number | null, weight: number): number {
  if (raw === null) return 0;
  return round1((clamp(raw) / 100) * weight);
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPoints(points: number): string {
  return `${round1(points)} pts`;
}
