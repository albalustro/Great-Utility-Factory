import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEMAND_CALIBRATION,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_THRESHOLDS,
  type AIAnalysis,
  type Opportunity,
  type SerpResult,
} from "@/lib/domain/types";
import { generateBuildPack, slugify } from "@/lib/engine/build-pack";

const settings = {
  weights: DEFAULT_SCORING_WEIGHTS,
  thresholds: DEFAULT_THRESHOLDS,
  demandCalibration: DEFAULT_DEMAND_CALIBRATION,
  currency: "USD",
};

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp-1",
    userId: "user-1",
    keyword: "freelance hourly rate calculator",
    country: "US",
    language: "en",
    searchVolume: 8100,
    keywordDifficulty: 24,
    cpc: 3.4,
    competitionIndex: null,
    competitionLevel: null,
    metricsProvider: null,
    metricsFetchedAt: null,
    trend: "RISING",
    utilityType: "CALCULATOR",
    serpWeaknessScore: 82,
    utilityFitScore: 95,
    monetizationScore: 78,
    evergreenScore: 90,
    buildSimplicityScore: 88,
    clusterPotentialScore: 95,
    demandScoreOverride: null,
    demandScoreOverrideReason: null,
    opportunityScore: 84,
    status: "QUALIFIED",
    source: "MANUAL",
    notes: null,
    isDemo: false,
    statusChangedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function serp(overrides: Partial<SerpResult> = {}): SerpResult {
  return {
    id: "serp-1",
    opportunityId: "opp-1",
    position: 1,
    domain: "example.com",
    url: null,
    title: null,
    domainAuthority: null,
    pageType: "ARTICLE",
    isLowAuthority: null,
    isNewSite: null,
    assessment: "UNCLASSIFIED",
    notes: null,
    source: "MANUAL",
    provider: null,
    fetchedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function analysis(): AIAnalysis {
  return {
    id: "an-1",
    opportunityId: "opp-1",
    provider: "claude",
    model: "claude-opus-5",
    createdAt: "2026-01-01T00:00:00.000Z",
    inputSnapshot: {},
    content: {
      searchIntent: "Tool intent — they want the number.",
      jobsToBeDone: ["Quote a client without underpricing"],
      problemDefinition: "Freelancers guess their rate.",
      currentSolutionLandscape: "Long blog posts.",
      productGap: "No fast calculator that shows its working.",
      recommendedUtility: "Freelance Hourly Rate Calculator",
      coreInputs: ["Target annual income", "Billable weeks"],
      expectedOutputs: ["Recommended hourly rate"],
      possibleDifferentiation: ["Show the maths"],
      clusterOpportunities: ["freelance tax calculator"],
      reasonsToBuild: ["Weak SERP"],
      reasonsNotToBuild: ["Rate advice varies by market"],
      risks: ["Competitor could ship a better tool"],
      recommendation: "BUILD",
      confidence: "MEDIUM",
      assumptions: [],
    },
  };
}

const baseInput = {
  opportunity: opportunity(),
  serpResults: [] as SerpResult[],
  analysis: null,
  clusters: [],
  clusterSiblings: [] as Opportunity[],
  settings,
};

describe("slugify", () => {
  it("produces a clean URL slug", () => {
    expect(slugify("Freelance Hourly Rate Calculator")).toBe(
      "freelance-hourly-rate-calculator",
    );
    expect(slugify("VAT calculator (Italy) — 2026!")).toBe("vat-calculator-italy-2026");
    expect(slugify("Cálculo de IVA")).toBe("calculo-de-iva");
  });
});

describe("generateBuildPack", () => {
  it("records the absence of an AI analysis as an assumption", () => {
    const pack = generateBuildPack(baseInput);
    expect(pack.usedAiAnalysis).toBe(false);
    expect(pack.content.assumptions.join(" ")).toMatch(/no ai analysis/i);
  });

  it("flags unknown search volume so the pack cannot imply traffic", () => {
    const pack = generateBuildPack({
      ...baseInput,
      opportunity: opportunity({ searchVolume: null }),
    });

    expect(pack.content.assumptions.join(" ")).toMatch(/search volume is unknown/i);
    expect(pack.claudeCodePrompt).toContain("unknown (not recorded)");
  });

  it("never invents metrics in the prompt", () => {
    const pack = generateBuildPack({
      ...baseInput,
      opportunity: opportunity({
        searchVolume: null,
        keywordDifficulty: null,
        cpc: null,
      }),
    });

    const line = (label: string) =>
      pack.claudeCodePrompt
        .split("\n")
        .find((row) => row.startsWith(`| ${label} |`)) ?? "";

    // The three unknown metrics must say so, and must never be rendered as 0.
    for (const label of ["Search volume", "Keyword difficulty", "CPC"]) {
      expect(line(label)).toContain("unknown (not recorded)");
      expect(line(label)).not.toMatch(/\|\s*0\s*(\/mo)?\s*\|/);
    }
  });

  it("leaves competitor observations empty rather than inventing them", () => {
    const pack = generateBuildPack(baseInput);
    expect(pack.content.competitorObservations).toHaveLength(0);
    expect(pack.content.assumptions.join(" ")).toMatch(/no serp results/i);
  });

  it("summarises captured SERP evidence when it exists", () => {
    const pack = generateBuildPack({
      ...baseInput,
      serpResults: [
        serp({ position: 1, domain: "a.com", pageType: "ARTICLE" }),
        serp({
          id: "serp-2",
          position: 2,
          domain: "b.com",
          pageType: "UTILITY",
          assessment: "STRONG_COMPETITOR",
        }),
        serp({
          id: "serp-3",
          position: 3,
          domain: "c.com",
          domainAuthority: null,
          pageType: "FORUM",
        }),
      ],
    });

    const joined = pack.content.competitorObservations.join(" ");
    expect(joined).toContain("a.com");
    expect(joined).toMatch(/authority data/i);
    expect(joined).toMatch(/strong competitor/i);
  });

  it("uses the AI analysis when one is supplied and marks it as interpretation", () => {
    const pack = generateBuildPack({ ...baseInput, analysis: analysis() });

    expect(pack.usedAiAnalysis).toBe(true);
    expect(pack.content.productName).toBe("Freelance Hourly Rate Calculator");
    expect(pack.content.inputs).toContain("Target annual income");
    expect(pack.claudeCodePrompt).toContain("NOT measured data");
    expect(pack.claudeCodePrompt).toContain("Reasons NOT to build");
  });

  it("carries cluster siblings into secondary keywords", () => {
    const pack = generateBuildPack({
      ...baseInput,
      clusterSiblings: [
        opportunity({ id: "opp-2", keyword: "freelance tax calculator", opportunityScore: 71 }),
      ],
    });

    expect(pack.content.secondaryKeywords).toContain("freelance tax calculator");
    expect(pack.content.futureClusterOpportunities.join(" ")).toContain("71/100");
  });

  it("keeps the title and meta description within sane SEO lengths", () => {
    const pack = generateBuildPack(baseInput);
    expect(pack.content.suggestedTitle.length).toBeLessThanOrEqual(60);
    expect(pack.content.metaDescription.length).toBeLessThanOrEqual(155);
  });

  it("always includes the non-negotiable build rules", () => {
    const prompt = generateBuildPack(baseInput).claudeCodePrompt;
    expect(prompt).toContain("Do not invent statistics");
    expect(prompt).toContain("No email gate");
    expect(prompt).toContain("Definition of done");
  });

  it("reports score completeness so a partial score cannot be over-read", () => {
    const pack = generateBuildPack({
      ...baseInput,
      opportunity: opportunity({
        serpWeaknessScore: null,
        buildSimplicityScore: null,
      }),
    });

    expect(pack.claudeCodePrompt).toMatch(/Unscored factors:/);
    expect(pack.claudeCodePrompt).toMatch(/lower bound/);
  });
});
