/**
 * Utility Factory domain model.
 *
 * Two hard rules run through every type in this file:
 *
 * 1. External metrics (search volume, difficulty, CPC, impressions, positions,
 *    domain authority, ...) are ALWAYS nullable. `null` means "we do not know",
 *    and the UI must render it as unknown rather than as zero.
 * 2. Anything produced by an AI model is stored separately from factual data and
 *    is never allowed to overwrite a measured metric.
 */

export const OPPORTUNITY_STATUSES = [
  "INBOX",
  "RESEARCH",
  "QUALIFIED",
  "READY_TO_BUILD",
  "BUILDING",
  "PUBLISHED",
  "MEASURING",
  "WINNER",
  "KILLED",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  INBOX: "Inbox",
  RESEARCH: "Research",
  QUALIFIED: "Qualified",
  READY_TO_BUILD: "Ready to Build",
  BUILDING: "Building",
  PUBLISHED: "Published",
  MEASURING: "Measuring",
  WINNER: "Winner",
  KILLED: "Killed",
};

/** Decision derived from the opportunity score via configurable thresholds. */
export const DECISIONS = ["BUILD", "INVESTIGATE", "WATCH", "REJECT"] as const;
export type Decision = (typeof DECISIONS)[number];

/** Decision attached to a live asset after measurement. */
export const ASSET_DECISIONS = ["WAIT", "OPTIMIZE", "SCALE", "KILL"] as const;
export type AssetDecision = (typeof ASSET_DECISIONS)[number];

export const UTILITY_TYPES = [
  "CALCULATOR",
  "GENERATOR",
  "CONVERTER",
  "CHECKER",
  "LOOKUP",
  "FORMATTER",
  "ANALYZER",
  "TEMPLATE",
  "OTHER",
] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

export const TRENDS = [
  "RISING",
  "STABLE",
  "DECLINING",
  "SEASONAL",
  "UNKNOWN",
] as const;
export type Trend = (typeof TRENDS)[number];

export const OPPORTUNITY_SOURCES = [
  "MANUAL",
  "CSV_IMPORT",
  "KEYWORD_PROVIDER",
  "SEED",
] as const;
export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number];

/**
 * Google Ads advertiser competition bucket. Deliberately NOT merged into
 * `keywordDifficulty`: one measures how contested a keyword is for advertisers,
 * the other how hard it is to rank organically. Collapsing them would relabel a
 * measurement as something it is not.
 */
export const COMPETITION_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];

export const PAGE_TYPES = [
  "UTILITY",
  "ARTICLE",
  "DIRECTORY",
  "FORUM",
  "ECOMMERCE",
  "OTHER",
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/**
 * Operator classification of a SERP competitor. `UNCLASSIFIED` is the default
 * and is deliberately distinct from "weak" — an unreviewed result is not
 * evidence of weakness.
 */
export const SERP_ASSESSMENTS = [
  "UNCLASSIFIED",
  "POOR_INTENT_MATCH",
  "WEAK_COMPETITOR",
  "STRONG_COMPETITOR",
] as const;
export type SerpAssessment = (typeof SERP_ASSESSMENTS)[number];

export const SERP_ASSESSMENT_LABELS: Record<SerpAssessment, string> = {
  UNCLASSIFIED: "Unclassified",
  POOR_INTENT_MATCH: "Poor intent match",
  WEAK_COMPETITOR: "Weak competitor",
  STRONG_COMPETITOR: "Strong competitor",
};

export const ACTIVITY_TYPES = [
  "OPPORTUNITY_CREATED",
  "OPPORTUNITY_UPDATED",
  "METRICS_CHANGED",
  "SCORE_RECALCULATED",
  "STATUS_CHANGED",
  "SERP_UPDATED",
  "AI_ANALYSIS_GENERATED",
  "BUILD_PACK_GENERATED",
  "ASSET_PUBLISHED",
  "ASSET_METRICS_UPDATED",
  "DECISION_CHANGED",
  "CLUSTER_UPDATED",
  "OPPORTUNITY_DELETED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ENTITY_TYPES = [
  "OPPORTUNITY",
  "ASSET",
  "CLUSTER",
  "SETTINGS",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// ---------------------------------------------------------------------------
// Opportunity
// ---------------------------------------------------------------------------

/**
 * Operator-supplied qualitative sub-scores, each on a 0-100 raw scale. These are
 * judgements, not measurements, so they are never null-by-unknown — an
 * un-assessed factor is simply `null` and contributes nothing to the score.
 */
export interface OpportunitySubScores {
  serpWeaknessScore: number | null;
  utilityFitScore: number | null;
  monetizationScore: number | null;
  evergreenScore: number | null;
  buildSimplicityScore: number | null;
  clusterPotentialScore: number | null;
}

export interface Opportunity extends OpportunitySubScores {
  id: string;
  userId: string;
  keyword: string;
  country: string;
  language: string;

  /** External metrics — null when not supplied. Never invent these. */
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  trend: Trend;

  /** Google Ads advertiser competition, 0-100. Not an SEO difficulty score. */
  competitionIndex: number | null;
  competitionLevel: CompetitionLevel | null;

  /** Provenance for the metrics above. Null means they were entered by hand. */
  metricsProvider: string | null;
  metricsFetchedAt: string | null;

  utilityType: UtilityType | null;

  /** Manual override of the derived demand score, with a mandatory reason. */
  demandScoreOverride: number | null;
  demandScoreOverrideReason: string | null;

  /** Denormalised total (0-100) so the explorer can sort/filter cheaply. */
  opportunityScore: number;

  status: OpportunityStatus;
  source: OpportunitySource;
  notes: string | null;

  /** Marks records created by the demo seed so they are never mistaken for real data. */
  isDemo: boolean;

  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// SERP
// ---------------------------------------------------------------------------

export interface SerpResult {
  id: string;
  opportunityId: string;
  position: number;
  domain: string;
  url: string | null;
  title: string | null;
  /** Only set when a provider supplied it or the operator entered it. */
  domainAuthority: number | null;
  pageType: PageType;
  /**
   * Tri-state: `null` means "unknown". The UI must never render unknown as
   * "not low authority" — absence of data is not evidence.
   */
  isLowAuthority: boolean | null;
  isNewSite: boolean | null;
  assessment: SerpAssessment;
  notes: string | null;
  /**
   * PROVIDER rows arrived from a SERP API; MANUAL rows were typed in. A provider
   * row still leaves `isLowAuthority` / `isNewSite` null — no provider we trust
   * supplies those yet, so they remain the operator's judgement.
   */
  source: "MANUAL" | "PROVIDER";
  provider: string | null;
  fetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// AI analysis
// ---------------------------------------------------------------------------

export interface AIAnalysisContent {
  searchIntent: string;
  jobsToBeDone: string[];
  problemDefinition: string;
  currentSolutionLandscape: string;
  productGap: string;
  recommendedUtility: string;
  coreInputs: string[];
  expectedOutputs: string[];
  possibleDifferentiation: string[];
  clusterOpportunities: string[];
  reasonsToBuild: string[];
  /** Mandatory. An analysis without stated risks is not an analysis. */
  reasonsNotToBuild: string[];
  risks: string[];
  recommendation: Decision;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  /** Anything the model assumed because the data did not contain it. */
  assumptions: string[];
}

export interface AIAnalysis {
  id: string;
  opportunityId: string;
  provider: string;
  model: string | null;
  content: AIAnalysisContent;
  /** The objective data the model was given, kept for auditability. */
  inputSnapshot: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Build pack
// ---------------------------------------------------------------------------

export interface BuildPackContent {
  productName: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  problemDefinition: string;
  productDescription: string;
  inputs: string[];
  outputs: string[];
  businessLogic: string[];
  coreFeatures: string[];
  optionalFeatures: string[];
  uxRequirements: string[];
  competitorObservations: string[];
  seoRequirements: string[];
  suggestedSlug: string;
  suggestedTitle: string;
  metaDescription: string;
  h1: string;
  supportingContentOutline: string[];
  faqIdeas: string[];
  structuredData: string[];
  analyticsEvents: string[];
  monetizationConsiderations: string[];
  relatedUtilityIdeas: string[];
  futureClusterOpportunities: string[];
  /** Explicitly separated so the operator can see what is inference, not fact. */
  assumptions: string[];
}

export interface BuildPack {
  id: string;
  opportunityId: string;
  version: number;
  content: BuildPackContent;
  /** Ready-to-paste prompt for building the individual utility. */
  claudeCodePrompt: string;
  /** Whether an AI analysis existed when this pack was generated. */
  usedAiAnalysis: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Clusters
// ---------------------------------------------------------------------------

export interface Cluster {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  domainCandidate: string | null;
  theme: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClusterOpportunity {
  clusterId: string;
  opportunityId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Assets & metrics
// ---------------------------------------------------------------------------

export interface Asset {
  id: string;
  userId: string;
  opportunityId: string | null;
  name: string;
  domain: string | null;
  url: string | null;
  publishedAt: string | null;
  indexedAt: string | null;

  /** Latest known window. All nullable — unknown stays unknown. */
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  averagePosition: number | null;
  pageviews: number | null;
  revenue: number | null;
  measurementPeriod: string | null;

  assetDecision: AssetDecision;
  /** Set when the operator overrides the recommended decision. */
  decisionNote: string | null;
  isDemo: boolean;
  lastUpdatedAt: string;
  createdAt: string;
}

/** A dated snapshot so charts can show change over time. */
export interface AssetMetric {
  id: string;
  assetId: string;
  periodStart: string;
  periodEnd: string;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  averagePosition: number | null;
  pageviews: number | null;
  revenue: number | null;
  source: "MANUAL" | "PROVIDER" | "SEED";
  notes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface StatusHistoryEntry {
  id: string;
  opportunityId: string;
  fromStatus: OpportunityStatus | null;
  toStatus: OpportunityStatus;
  note: string | null;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  type: ActivityType;
  summary: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ScoringWeights {
  demand: number;
  serpWeakness: number;
  utilityFit: number;
  monetization: number;
  evergreen: number;
  buildSimplicity: number;
  clusterPotential: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  demand: 20,
  serpWeakness: 25,
  utilityFit: 20,
  monetization: 10,
  evergreen: 10,
  buildSimplicity: 10,
  clusterPotential: 5,
};

export interface DecisionThresholds {
  /** Score at or above which the decision is BUILD. */
  build: number;
  investigate: number;
  watch: number;
}

export const DEFAULT_THRESHOLDS: DecisionThresholds = {
  build: 85,
  investigate: 70,
  watch: 50,
};

/**
 * Calibration points for the search-volume normalisation curve. Deliberately
 * exposed in settings: there is no universal formula, so the operator must be
 * able to recalibrate it against their own market.
 */
export interface DemandCalibration {
  /** Monthly volume treated as the floor of usefulness (scores 0). */
  floor: number;
  /** Monthly volume treated as "excellent" (scores 100). */
  ceiling: number;
}

export const DEFAULT_DEMAND_CALIBRATION: DemandCalibration = {
  floor: 100,
  ceiling: 50_000,
};

export interface ProviderSettings {
  keyword: string;
  serp: string;
  ai: string;
  searchAnalytics: string;
}

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  keyword: "manual",
  serp: "manual",
  ai: "manual",
  searchAnalytics: "manual",
};

export interface Settings {
  userId: string;
  weights: ScoringWeights;
  thresholds: DecisionThresholds;
  demandCalibration: DemandCalibration;
  providers: ProviderSettings;
  defaultCountry: string;
  defaultLanguage: string;
  currency: string;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: Omit<Settings, "userId" | "updatedAt"> = {
  weights: DEFAULT_SCORING_WEIGHTS,
  thresholds: DEFAULT_THRESHOLDS,
  demandCalibration: DEFAULT_DEMAND_CALIBRATION,
  providers: DEFAULT_PROVIDER_SETTINGS,
  defaultCountry: "US",
  defaultLanguage: "en",
  currency: "USD",
};

// ---------------------------------------------------------------------------
// Composites used by the UI
// ---------------------------------------------------------------------------

export interface OpportunityFilters {
  keyword?: string;
  country?: string;
  language?: string;
  minSearchVolume?: number;
  maxKeywordDifficulty?: number;
  minCpc?: number;
  minSerpWeakness?: number;
  minOpportunityScore?: number;
  status?: OpportunityStatus[];
  utilityType?: UtilityType[];
  decision?: Decision[];
  clusterId?: string;
  includeDemo?: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  /** True when running against the in-memory demo store rather than Supabase. */
  isDemoSession: boolean;
}
