import type {
  AIAnalysisContent,
  CompetitionLevel,
  Opportunity,
  PageType,
  SerpResult,
  Trend,
} from "@/lib/domain/types";

/**
 * Provider contracts.
 *
 * Every external capability the factory needs sits behind one of these
 * interfaces. Nothing in the application imports a vendor SDK directly, so
 * swapping DataForSEO for Semrush, or Anthropic for another model host, is a
 * change to one adapter file plus a registry entry.
 *
 * Every provider reports its own configuration state instead of throwing at
 * import time, which is what lets the UI render an honest
 * "no provider configured" state rather than a crash or a fake result.
 */
export interface ProviderStatus {
  id: string;
  label: string;
  /** True when the provider has everything it needs to make real calls. */
  configured: boolean;
  /** Why it is not configured, and what would fix it. */
  detail: string;
  /** Env vars this provider reads. Values are never surfaced to the client. */
  requiredEnv: string[];
  /** True for the built-in manual/no-op implementations. */
  isManual: boolean;
}

export interface ProviderBase {
  readonly id: string;
  readonly label: string;
  status(): ProviderStatus;
}

// ---------------------------------------------------------------------------

export interface KeywordMetrics {
  keyword: string;
  country: string;
  language: string;
  /** All nullable: a provider that cannot answer must return null, not zero. */
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  /** Advertiser competition, kept distinct from organic difficulty. */
  competitionIndex: number | null;
  competitionLevel: CompetitionLevel | null;
  trend: Trend;
}

export interface KeywordLookupRequest {
  keywords: string[];
  country: string;
  language: string;
}

/** Seed expansion: "calculator" in, hundreds of related keywords out. */
export interface KeywordExpansionRequest {
  seeds: string[];
  country: string;
  language: string;
  /** Upper bound on returned candidates. Providers may return fewer. */
  limit?: number;
}

export interface KeywordProvider extends ProviderBase {
  /**
   * True when this provider can turn seed keywords into new candidates. Not
   * every keyword API offers discovery, so callers check before offering it.
   */
  readonly supportsExpansion: boolean;

  /**
   * Returns metrics for the requested keywords. Implementations must omit or
   * null-fill anything the upstream API did not actually return.
   */
  lookup(request: KeywordLookupRequest): Promise<KeywordMetrics[]>;

  /**
   * Returns candidate keywords related to the seeds. Throws
   * `ProviderNotConfiguredError` when `supportsExpansion` is false.
   */
  expand(request: KeywordExpansionRequest): Promise<KeywordMetrics[]>;
}

// ---------------------------------------------------------------------------

export interface SerpFetchRequest {
  keyword: string;
  country: string;
  language: string;
  limit?: number;
}

export interface SerpFetchResult {
  position: number;
  domain: string;
  url: string | null;
  title: string | null;
  domainAuthority: number | null;
  /** Only set when the upstream source actually classifies the page. */
  pageType: PageType | null;
  isLowAuthority: boolean | null;
  isNewSite: boolean | null;
}

export interface SerpProvider extends ProviderBase {
  fetchSerp(request: SerpFetchRequest): Promise<SerpFetchResult[]>;
}

// ---------------------------------------------------------------------------

/**
 * The objective payload handed to an AI provider. This is deliberately the only
 * thing the model sees: it contains measured values (or explicit nulls) so the
 * model cannot be primed with a number that was never observed.
 */
export interface AIAnalysisRequest {
  opportunity: Pick<
    Opportunity,
    | "keyword"
    | "country"
    | "language"
    | "searchVolume"
    | "keywordDifficulty"
    | "cpc"
    | "trend"
    | "utilityType"
    | "notes"
  >;
  serpResults: Array<
    Pick<
      SerpResult,
      | "position"
      | "domain"
      | "pageType"
      | "domainAuthority"
      | "isLowAuthority"
      | "isNewSite"
      | "assessment"
      | "title"
      | "notes"
    >
  >;
  serpSummary: {
    resultCount: number;
    lowAuthorityCount: number;
    newSiteCount: number;
    utilityCount: number;
    articleCount: number;
    unknownAuthorityCount: number;
  };
  scoreSummary: {
    total: number;
    decision: string;
    completeness: number;
    missingFactors: string[];
  };
}

export interface AIAnalysisResult {
  content: AIAnalysisContent;
  model: string | null;
}

export interface AIProvider extends ProviderBase {
  analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult>;
}

// ---------------------------------------------------------------------------

export interface SearchAnalyticsRequest {
  url: string;
  startDate: string;
  endDate: string;
}

export interface SearchAnalyticsRow {
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  averagePosition: number | null;
  periodStart: string;
  periodEnd: string;
}

export interface SearchAnalyticsProvider extends ProviderBase {
  fetchPerformance(
    request: SearchAnalyticsRequest,
  ): Promise<SearchAnalyticsRow | null>;
}

/**
 * Thrown when an action needs a real provider and only the manual placeholder is
 * configured. Callers render this as a configuration state, never as an error
 * toast, and never by substituting invented data.
 */
export class ProviderNotConfiguredError extends Error {
  constructor(
    public readonly providerKind: string,
    public readonly status: ProviderStatus,
  ) {
    super(
      `No ${providerKind} provider is configured. ${status.detail}`,
    );
    this.name = "ProviderNotConfiguredError";
  }
}
