import type {
  AIAnalysisRequest,
  AIAnalysisResult,
  AIProvider,
  KeywordLookupRequest,
  KeywordMetrics,
  KeywordProvider,
  ProviderStatus,
  SearchAnalyticsProvider,
  SearchAnalyticsRequest,
  SearchAnalyticsRow,
  SerpFetchRequest,
  SerpFetchResult,
  SerpProvider,
} from "@/lib/providers/types";
import { ProviderNotConfiguredError } from "@/lib/providers/types";

/**
 * Manual providers.
 *
 * These are the default implementations and they deliberately do nothing: the
 * operator supplies the data by hand or via CSV import. They exist so the rest
 * of the application can depend on a provider interface unconditionally, and so
 * a missing API key produces a clear configuration state instead of a crash —
 * or, far worse, a plausible-looking invented number.
 */

const manualStatus = (id: string, label: string, what: string): ProviderStatus => ({
  id,
  label,
  configured: false,
  detail: `${what} is entered manually. Configure a provider in Settings to automate it.`,
  requiredEnv: [],
  isManual: true,
});

export class ManualKeywordProvider implements KeywordProvider {
  readonly id = "manual";
  readonly label = "Manual / CSV import";

  status(): ProviderStatus {
    return manualStatus(this.id, this.label, "Keyword data");
  }

  async lookup(_request: KeywordLookupRequest): Promise<KeywordMetrics[]> {
    void _request;
    throw new ProviderNotConfiguredError("keyword", this.status());
  }
}

export class ManualSerpProvider implements SerpProvider {
  readonly id = "manual";
  readonly label = "Manual entry";

  status(): ProviderStatus {
    return manualStatus(this.id, this.label, "SERP data");
  }

  async fetchSerp(_request: SerpFetchRequest): Promise<SerpFetchResult[]> {
    void _request;
    throw new ProviderNotConfiguredError("SERP", this.status());
  }
}

export class ManualAIProvider implements AIProvider {
  readonly id = "manual";
  readonly label = "Not configured";

  status(): ProviderStatus {
    return {
      id: this.id,
      label: this.label,
      configured: false,
      detail:
        "No AI provider is configured. Set ANTHROPIC_API_KEY and select the Claude provider in Settings to enable AI analysis.",
      requiredEnv: ["ANTHROPIC_API_KEY"],
      isManual: true,
    };
  }

  async analyze(_request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    void _request;
    throw new ProviderNotConfiguredError("AI", this.status());
  }
}

export class ManualSearchAnalyticsProvider implements SearchAnalyticsProvider {
  readonly id = "manual";
  readonly label = "Manual entry";

  status(): ProviderStatus {
    return manualStatus(this.id, this.label, "Search performance data");
  }

  async fetchPerformance(
    _request: SearchAnalyticsRequest,
  ): Promise<SearchAnalyticsRow | null> {
    void _request;
    throw new ProviderNotConfiguredError("search analytics", this.status());
  }
}
