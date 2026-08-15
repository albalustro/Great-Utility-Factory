import type { ProviderSettings } from "@/lib/domain/types";
import { ClaudeAIProvider } from "@/lib/providers/claude";
import {
  ManualAIProvider,
  ManualKeywordProvider,
  ManualSearchAnalyticsProvider,
  ManualSerpProvider,
} from "@/lib/providers/manual";
import type {
  AIProvider,
  KeywordProvider,
  ProviderStatus,
  SearchAnalyticsProvider,
  SerpProvider,
} from "@/lib/providers/types";

/**
 * Provider registry.
 *
 * Adding a real vendor means writing one adapter that implements the relevant
 * interface and registering its factory here. Nothing else in the application
 * changes — the settings page reads its options from these maps, and every
 * caller resolves providers through `getProviders()`.
 */

type Factory<T> = () => T;

const keywordProviders: Record<string, Factory<KeywordProvider>> = {
  manual: () => new ManualKeywordProvider(),
};

const serpProviders: Record<string, Factory<SerpProvider>> = {
  manual: () => new ManualSerpProvider(),
};

const aiProviders: Record<string, Factory<AIProvider>> = {
  manual: () => new ManualAIProvider(),
  claude: () => new ClaudeAIProvider(),
};

const searchAnalyticsProviders: Record<string, Factory<SearchAnalyticsProvider>> = {
  manual: () => new ManualSearchAnalyticsProvider(),
};

export interface ResolvedProviders {
  keyword: KeywordProvider;
  serp: SerpProvider;
  ai: AIProvider;
  searchAnalytics: SearchAnalyticsProvider;
}

function resolve<T>(
  registry: Record<string, Factory<T>>,
  id: string,
  fallback: keyof typeof registry,
): T {
  const factory = registry[id] ?? registry[fallback as string];
  return factory();
}

export function getProviders(settings: ProviderSettings): ResolvedProviders {
  return {
    keyword: resolve(keywordProviders, settings.keyword, "manual"),
    serp: resolve(serpProviders, settings.serp, "manual"),
    ai: resolve(aiProviders, settings.ai, "manual"),
    searchAnalytics: resolve(
      searchAnalyticsProviders,
      settings.searchAnalytics,
      "manual",
    ),
  };
}

export interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
  requiredEnv: string[];
}

function optionsFor<T extends { status(): ProviderStatus }>(
  registry: Record<string, Factory<T>>,
): ProviderOption[] {
  return Object.values(registry).map((factory) => {
    const status = factory().status();
    return {
      id: status.id,
      label: status.label,
      configured: status.configured,
      detail: status.detail,
      requiredEnv: status.requiredEnv,
    };
  });
}

/** Everything the Settings screen needs to render provider configuration. */
export function getProviderCatalog() {
  return {
    keyword: optionsFor(keywordProviders),
    serp: optionsFor(serpProviders),
    ai: optionsFor(aiProviders),
    searchAnalytics: optionsFor(searchAnalyticsProviders),
  };
}

export function getProviderStatuses(settings: ProviderSettings) {
  const providers = getProviders(settings);
  return {
    keyword: providers.keyword.status(),
    serp: providers.serp.status(),
    ai: providers.ai.status(),
    searchAnalytics: providers.searchAnalytics.status(),
  };
}
