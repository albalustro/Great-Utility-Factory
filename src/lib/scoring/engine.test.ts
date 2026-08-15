import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEMAND_CALIBRATION,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_THRESHOLDS,
} from "@/lib/domain/types";
import {
  decisionForScore,
  scoreOpportunity,
  weightsTotal,
  type ScorableOpportunity,
} from "@/lib/scoring/engine";
import { normalizeSearchVolume } from "@/lib/scoring/demand";

const base: ScorableOpportunity = {
  searchVolume: null,
  keywordDifficulty: null,
  cpc: null,
  serpWeaknessScore: null,
  utilityFitScore: null,
  monetizationScore: null,
  evergreenScore: null,
  buildSimplicityScore: null,
  clusterPotentialScore: null,
  demandScoreOverride: null,
  demandScoreOverrideReason: null,
};

describe("normalizeSearchVolume", () => {
  it("returns null — not zero — when volume is unknown", () => {
    const result = normalizeSearchVolume(null, DEFAULT_DEMAND_CALIBRATION);
    expect(result.score).toBeNull();
    expect(result.input).toBeNull();
    expect(result.explanation).toMatch(/no search volume/i);
  });

  it("scores 0 at or below the floor and 100 at or above the ceiling", () => {
    expect(normalizeSearchVolume(100, DEFAULT_DEMAND_CALIBRATION).score).toBe(0);
    expect(normalizeSearchVolume(50, DEFAULT_DEMAND_CALIBRATION).score).toBe(0);
    expect(normalizeSearchVolume(50_000, DEFAULT_DEMAND_CALIBRATION).score).toBe(100);
    expect(normalizeSearchVolume(500_000, DEFAULT_DEMAND_CALIBRATION).score).toBe(100);
  });

  it("is monotonic and log-shaped between the calibration points", () => {
    const low = normalizeSearchVolume(500, DEFAULT_DEMAND_CALIBRATION).score!;
    const mid = normalizeSearchVolume(5_000, DEFAULT_DEMAND_CALIBRATION).score!;
    const high = normalizeSearchVolume(20_000, DEFAULT_DEMAND_CALIBRATION).score!;

    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);

    // A log curve gives the first 10x more lift than the second.
    expect(mid - low).toBeGreaterThan(high - mid);
  });

  it("respects a recalibrated curve", () => {
    const narrow = { floor: 1_000, ceiling: 2_000 };
    expect(normalizeSearchVolume(1_000, narrow).score).toBe(0);
    expect(normalizeSearchVolume(2_000, narrow).score).toBe(100);
    expect(normalizeSearchVolume(1_500, narrow).score).toBeGreaterThan(50);
  });
});

describe("scoreOpportunity", () => {
  it("scores an empty opportunity as zero with zero completeness", () => {
    const result = scoreOpportunity(base);
    expect(result.total).toBe(0);
    expect(result.completeness).toBe(0);
    expect(result.decision).toBe("REJECT");
    expect(result.missingFactors).toHaveLength(7);
  });

  it("never renormalises away missing factors", () => {
    // Only utility fit is known, and it is perfect. If missing factors were
    // renormalised away this would score 100, which would be a fabricated signal.
    const result = scoreOpportunity({ ...base, utilityFitScore: 100 });
    expect(result.total).toBe(DEFAULT_SCORING_WEIGHTS.utilityFit);
    expect(result.completeness).toBe(DEFAULT_SCORING_WEIGHTS.utilityFit);
  });

  it("awards every point when all factors are maxed", () => {
    const result = scoreOpportunity({
      ...base,
      searchVolume: 100_000,
      serpWeaknessScore: 100,
      utilityFitScore: 100,
      monetizationScore: 100,
      evergreenScore: 100,
      buildSimplicityScore: 100,
      clusterPotentialScore: 100,
    });

    expect(result.total).toBe(100);
    expect(result.completeness).toBe(100);
    expect(result.decision).toBe("BUILD");
    expect(result.missingFactors).toHaveLength(0);
  });

  it("weights each factor by its configured maximum", () => {
    const result = scoreOpportunity({ ...base, serpWeaknessScore: 50 });
    const serp = result.factors.find((f) => f.key === "serpWeakness")!;

    expect(serp.raw).toBe(50);
    expect(serp.weighted).toBeCloseTo(DEFAULT_SCORING_WEIGHTS.serpWeakness / 2, 5);
    expect(serp.hasData).toBe(true);
  });

  it("honours custom weights", () => {
    const weights = {
      demand: 0,
      serpWeakness: 100,
      utilityFit: 0,
      monetization: 0,
      evergreen: 0,
      buildSimplicity: 0,
      clusterPotential: 0,
    };
    const result = scoreOpportunity({ ...base, serpWeaknessScore: 40 }, { weights });
    expect(result.total).toBe(40);
    expect(weightsTotal(weights)).toBe(100);
  });

  it("applies a demand override and records the reason", () => {
    const result = scoreOpportunity({
      ...base,
      searchVolume: 100,
      demandScoreOverride: 90,
      demandScoreOverrideReason: "Volume tool under-reports this seasonal query",
    });

    const demand = result.factors.find((f) => f.key === "demand")!;
    expect(demand.raw).toBe(90);
    expect(demand.overridden).toBe(true);
    expect(demand.reason).toContain("under-reports");
    expect(demand.weighted).toBeCloseTo(DEFAULT_SCORING_WEIGHTS.demand * 0.9, 5);
  });

  it("flags an override with no reason instead of hiding it", () => {
    const result = scoreOpportunity({
      ...base,
      demandScoreOverride: 80,
      demandScoreOverrideReason: null,
    });
    const demand = result.factors.find((f) => f.key === "demand")!;
    expect(demand.reason).toMatch(/no reason recorded/i);
  });

  it("clamps out-of-range values rather than letting them distort the total", () => {
    const result = scoreOpportunity({ ...base, utilityFitScore: 500 });
    const fit = result.factors.find((f) => f.key === "utilityFit")!;
    expect(fit.weighted).toBe(DEFAULT_SCORING_WEIGHTS.utilityFit);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("surfaces CPC and difficulty as supporting evidence", () => {
    const result = scoreOpportunity({
      ...base,
      cpc: 4.25,
      keywordDifficulty: 31,
      monetizationScore: 70,
      serpWeaknessScore: 60,
    });

    expect(result.factors.find((f) => f.key === "monetization")!.evidence).toContain(
      "4.25",
    );
    expect(result.factors.find((f) => f.key === "serpWeakness")!.evidence).toContain(
      "31",
    );
  });
});

describe("decisionForScore", () => {
  it("maps the default bands", () => {
    expect(decisionForScore(100)).toBe("BUILD");
    expect(decisionForScore(85)).toBe("BUILD");
    expect(decisionForScore(84)).toBe("INVESTIGATE");
    expect(decisionForScore(70)).toBe("INVESTIGATE");
    expect(decisionForScore(69)).toBe("WATCH");
    expect(decisionForScore(50)).toBe("WATCH");
    expect(decisionForScore(49)).toBe("REJECT");
    expect(decisionForScore(0)).toBe("REJECT");
  });

  it("respects custom thresholds", () => {
    const thresholds = { build: 60, investigate: 40, watch: 20 };
    expect(decisionForScore(60, thresholds)).toBe("BUILD");
    expect(decisionForScore(45, thresholds)).toBe("INVESTIGATE");
    expect(decisionForScore(25, thresholds)).toBe("WATCH");
    expect(decisionForScore(10, thresholds)).toBe("REJECT");
  });

  it("uses the same defaults the domain layer exports", () => {
    expect(DEFAULT_THRESHOLDS.build).toBeGreaterThan(DEFAULT_THRESHOLDS.investigate);
    expect(DEFAULT_THRESHOLDS.investigate).toBeGreaterThan(DEFAULT_THRESHOLDS.watch);
    expect(weightsTotal(DEFAULT_SCORING_WEIGHTS)).toBe(100);
  });
});
