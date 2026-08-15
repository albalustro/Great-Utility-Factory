import { z } from "zod";

import {
  ASSET_DECISIONS,
  DECISIONS,
  OPPORTUNITY_SOURCES,
  OPPORTUNITY_STATUSES,
  PAGE_TYPES,
  SERP_ASSESSMENTS,
  TRENDS,
  UTILITY_TYPES,
} from "@/lib/domain/types";

/**
 * Form values arrive as strings. An empty string means "not provided", which
 * must become `null` (unknown) and never `0` — a fabricated zero is worse than
 * a missing value everywhere in this product.
 */
const emptyToNull = (value: unknown) =>
  value === "" || value === undefined || value === null ? null : value;

const nullableNumber = (min?: number, max?: number) => {
  let schema = z.number();
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  return z.preprocess(
    (value) => {
      const normalized = emptyToNull(value);
      if (normalized === null) return null;
      const parsed = typeof normalized === "string" ? Number(normalized) : normalized;
      return Number.isNaN(parsed) ? normalized : parsed;
    },
    schema.nullable(),
  );
};

const nullableString = (max = 5000) =>
  z.preprocess(
    (value) => {
      const normalized = emptyToNull(value);
      return typeof normalized === "string" ? normalized.trim() || null : normalized;
    },
    z.string().max(max).nullable(),
  );

const nullableBoolean = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null || value === "unknown")
    return null;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean().nullable());

const score = () => nullableNumber(0, 100);

// ---------------------------------------------------------------------------
// Opportunity
// ---------------------------------------------------------------------------

export const opportunityInputSchema = z.object({
  keyword: z.string().trim().min(1, "Keyword is required").max(300),
  country: z.string().trim().min(2, "Country is required").max(8),
  language: z.string().trim().min(2, "Language is required").max(8),
  searchVolume: nullableNumber(0),
  keywordDifficulty: nullableNumber(0, 100),
  cpc: nullableNumber(0),
  trend: z.enum(TRENDS).default("UNKNOWN"),
  utilityType: z.preprocess(emptyToNull, z.enum(UTILITY_TYPES).nullable()),
  serpWeaknessScore: score(),
  utilityFitScore: score(),
  monetizationScore: score(),
  evergreenScore: score(),
  buildSimplicityScore: score(),
  clusterPotentialScore: score(),
  demandScoreOverride: score(),
  demandScoreOverrideReason: nullableString(500),
  status: z.enum(OPPORTUNITY_STATUSES).default("INBOX"),
  source: z.enum(OPPORTUNITY_SOURCES).default("MANUAL"),
  notes: nullableString(),
});

export type OpportunityInput = z.infer<typeof opportunityInputSchema>;

/** A demand override without a reason is not an override, it is a fudge. */
export const opportunityFormSchema = opportunityInputSchema.refine(
  (value) =>
    value.demandScoreOverride === null ||
    (value.demandScoreOverrideReason?.trim().length ?? 0) > 0,
  {
    message: "A demand score override requires a reason",
    path: ["demandScoreOverrideReason"],
  },
);

export const statusChangeSchema = z.object({
  opportunityId: z.string().min(1),
  status: z.enum(OPPORTUNITY_STATUSES),
  note: nullableString(500),
});

// ---------------------------------------------------------------------------
// SERP
// ---------------------------------------------------------------------------

export const serpResultInputSchema = z.object({
  position: z.coerce.number().int().min(1).max(100),
  domain: z.string().trim().min(1, "Domain is required").max(255),
  url: nullableString(2000),
  title: nullableString(500),
  domainAuthority: nullableNumber(0, 100),
  pageType: z.enum(PAGE_TYPES).default("OTHER"),
  isLowAuthority: nullableBoolean,
  isNewSite: nullableBoolean,
  assessment: z.enum(SERP_ASSESSMENTS).default("UNCLASSIFIED"),
  notes: nullableString(1000),
});

export type SerpResultInput = z.infer<typeof serpResultInputSchema>;

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const assetInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  opportunityId: nullableString(64),
  domain: nullableString(255),
  url: nullableString(2000),
  publishedAt: nullableString(40),
  indexedAt: nullableString(40),
  measurementPeriod: nullableString(100),
  assetDecision: z.enum(ASSET_DECISIONS).default("WAIT"),
  decisionNote: nullableString(1000),
});

export type AssetInput = z.infer<typeof assetInputSchema>;

export const assetMetricInputSchema = z.object({
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  impressions: nullableNumber(0),
  clicks: nullableNumber(0),
  /** Stored 0-1; the form accepts a percentage and converts before validation. */
  ctr: nullableNumber(0, 1),
  averagePosition: nullableNumber(0, 200),
  pageviews: nullableNumber(0),
  revenue: nullableNumber(0),
  notes: nullableString(1000),
});

export type AssetMetricInput = z.infer<typeof assetMetricInputSchema>;

export const assetDecisionSchema = z.object({
  assetId: z.string().min(1),
  assetDecision: z.enum(ASSET_DECISIONS),
  decisionNote: nullableString(1000),
});

// ---------------------------------------------------------------------------
// Clusters
// ---------------------------------------------------------------------------

export const clusterInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: nullableString(2000),
  domainCandidate: nullableString(255),
  theme: nullableString(200),
});

export type ClusterInput = z.infer<typeof clusterInputSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const scoringWeightsSchema = z
  .object({
    demand: z.coerce.number().min(0).max(100),
    serpWeakness: z.coerce.number().min(0).max(100),
    utilityFit: z.coerce.number().min(0).max(100),
    monetization: z.coerce.number().min(0).max(100),
    evergreen: z.coerce.number().min(0).max(100),
    buildSimplicity: z.coerce.number().min(0).max(100),
    clusterPotential: z.coerce.number().min(0).max(100),
  })
  .refine(
    (weights) =>
      Math.round(Object.values(weights).reduce((sum, w) => sum + w, 0)) === 100,
    { message: "Scoring weights must total exactly 100" },
  );

export const thresholdsSchema = z
  .object({
    build: z.coerce.number().min(1).max(100),
    investigate: z.coerce.number().min(1).max(100),
    watch: z.coerce.number().min(0).max(100),
  })
  .refine((t) => t.build > t.investigate && t.investigate > t.watch, {
    message: "Thresholds must decrease: BUILD > INVESTIGATE > WATCH",
  });

export const demandCalibrationSchema = z
  .object({
    floor: z.coerce.number().min(1),
    ceiling: z.coerce.number().min(2),
  })
  .refine((c) => c.ceiling > c.floor, {
    message: "Ceiling must be greater than floor",
    path: ["ceiling"],
  });

export const settingsInputSchema = z.object({
  weights: scoringWeightsSchema,
  thresholds: thresholdsSchema,
  demandCalibration: demandCalibrationSchema,
  providers: z.object({
    keyword: z.string().min(1),
    serp: z.string().min(1),
    ai: z.string().min(1),
    searchAnalytics: z.string().min(1),
  }),
  defaultCountry: z.string().trim().min(2).max(8),
  defaultLanguage: z.string().trim().min(2).max(8),
  currency: z.string().trim().min(3).max(3),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;

// ---------------------------------------------------------------------------
// Filters (URL search params -> typed filter object)
// ---------------------------------------------------------------------------

const csvList = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.length
        ? value.split(",").filter(Boolean)
        : undefined,
    z.array(z.enum(values)).optional(),
  );

export const opportunityFilterSchema = z.object({
  keyword: z.string().trim().optional(),
  country: z.string().trim().optional(),
  language: z.string().trim().optional(),
  minSearchVolume: z.coerce.number().optional(),
  maxKeywordDifficulty: z.coerce.number().optional(),
  minCpc: z.coerce.number().optional(),
  minSerpWeakness: z.coerce.number().optional(),
  minOpportunityScore: z.coerce.number().optional(),
  status: csvList(OPPORTUNITY_STATUSES),
  utilityType: csvList(UTILITY_TYPES),
  decision: csvList(DECISIONS),
  clusterId: z.string().optional(),
  sort: z.string().optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

/** Collapses Zod issues into a `field -> message` map for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
