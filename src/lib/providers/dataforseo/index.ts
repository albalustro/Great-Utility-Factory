import "server-only";

import {
  DATAFORSEO_ENV,
  callDataForSeo,
  readCredentials,
  type DataForSeoCredentials,
} from "@/lib/providers/dataforseo/client";
import { resolveLocationCode } from "@/lib/providers/dataforseo/locations";
import {
  mergeDifficulty,
  toKeywordMetrics,
  toSerpResults,
  type BulkDifficultyItem,
  type GoogleAdsKeywordItem,
  type SerpLiveResult,
} from "@/lib/providers/dataforseo/mapping";
import type {
  KeywordExpansionRequest,
  KeywordLookupRequest,
  KeywordMetrics,
  KeywordProvider,
  ProviderStatus,
  SerpFetchRequest,
  SerpFetchResult,
  SerpProvider,
} from "@/lib/providers/types";
import { ProviderNotConfiguredError } from "@/lib/providers/types";

/**
 * DataForSEO adapter.
 *
 * Endpoints used, and why each one:
 *
 *  - `keywords_data/google_ads/search_volume/live`
 *      Volume, CPC and advertiser competition for keywords we already have.
 *  - `keywords_data/google_ads/keywords_for_keywords/live`
 *      Seed expansion. Same Keyword Planner data, plus discovery.
 *  - `dataforseo_labs/google/bulk_keyword_difficulty/live`
 *      The only organic-difficulty number in the set. Optional: if the account
 *      lacks a Labs subscription, difficulty stays null and everything else
 *      still works.
 *  - `serp/google/organic/live/advanced`
 *      Live Google top 10.
 *  - `keywords_data/google_ads/locations` and `serp/google/locations`
 *      Country ISO → location code.
 */

/** Keyword Planner caps a seed expansion request at 20 seeds. */
const MAX_SEEDS = 20;
/** The Labs bulk difficulty endpoint accepts up to 1000 keywords per call. */
const MAX_DIFFICULTY_KEYWORDS = 1000;
/** Search volume accepts up to 1000 keywords per call. */
const MAX_VOLUME_KEYWORDS = 1000;
const DEFAULT_EXPANSION_LIMIT = 200;
const DEFAULT_SERP_DEPTH = 10;

function configuredStatus(id: string, label: string): ProviderStatus {
  const credentials = readCredentials();
  return {
    id,
    label,
    configured: credentials !== null,
    detail: credentials
      ? "Connected. Live calls consume DataForSEO credits."
      : `Set ${DATAFORSEO_ENV.join(" and ")} to enable live calls. Credentials come from the DataForSEO dashboard, not your account password.`,
    requiredEnv: [...DATAFORSEO_ENV],
    isManual: false,
  };
}

function requireCredentials(
  kind: string,
  status: ProviderStatus,
): DataForSeoCredentials {
  const credentials = readCredentials();
  if (!credentials) throw new ProviderNotConfiguredError(kind, status);
  return credentials;
}

/**
 * Difficulty is a best-effort enrichment. A Labs subscription is billed
 * separately from Keyword Planner data, so an account without one would
 * otherwise get an error instead of the volume and CPC it can actually see.
 * Failing here leaves `keywordDifficulty` null, which the scoring engine
 * already treats as an honest unknown.
 */
async function tryAttachDifficulty(
  metrics: KeywordMetrics[],
  credentials: DataForSeoCredentials,
  locationCode: number,
  language: string,
): Promise<KeywordMetrics[]> {
  if (metrics.length === 0) return metrics;

  const keywords = metrics.slice(0, MAX_DIFFICULTY_KEYWORDS).map((m) => m.keyword);

  try {
    const { results } = await callDataForSeo<{ items?: BulkDifficultyItem[] | null }>(
      "/v3/dataforseo_labs/google/bulk_keyword_difficulty/live",
      {
        credentials,
        body: [{ keywords, location_code: locationCode, language_code: language }],
      },
    );

    const items = results.flatMap((result) =>
      Array.isArray(result.items) ? result.items : [],
    );
    return mergeDifficulty(metrics, items);
  } catch {
    return metrics;
  }
}

export class DataForSeoKeywordProvider implements KeywordProvider {
  readonly id = "dataforseo";
  readonly label = "DataForSEO (Google Ads + Labs)";
  readonly supportsExpansion = true;

  status(): ProviderStatus {
    return configuredStatus(this.id, this.label);
  }

  async lookup(request: KeywordLookupRequest): Promise<KeywordMetrics[]> {
    const credentials = requireCredentials("keyword", this.status());
    const keywords = [
      ...new Set(request.keywords.map((k) => k.trim()).filter(Boolean)),
    ].slice(0, MAX_VOLUME_KEYWORDS);
    if (keywords.length === 0) return [];

    const locationCode = await resolveLocationCode(
      "keywords_data",
      request.country,
      credentials,
    );

    const { results } = await callDataForSeo<GoogleAdsKeywordItem>(
      "/v3/keywords_data/google_ads/search_volume/live",
      {
        credentials,
        body: [
          {
            keywords,
            location_code: locationCode,
            language_code: request.language,
            // Google.com search only. Including partner networks would inflate
            // volume with traffic no amount of SEO can reach.
            search_partners: false,
          },
        ],
      },
    );

    const metrics = results
      .map((item) =>
        toKeywordMetrics(item, {
          country: request.country,
          language: request.language,
        }),
      )
      .filter((entry): entry is KeywordMetrics => entry !== null);

    return tryAttachDifficulty(metrics, credentials, locationCode, request.language);
  }

  async expand(request: KeywordExpansionRequest): Promise<KeywordMetrics[]> {
    const credentials = requireCredentials("keyword", this.status());
    const seeds = [
      ...new Set(request.seeds.map((s) => s.trim()).filter(Boolean)),
    ].slice(0, MAX_SEEDS);
    if (seeds.length === 0) return [];

    const limit = Math.max(1, request.limit ?? DEFAULT_EXPANSION_LIMIT);
    const locationCode = await resolveLocationCode(
      "keywords_data",
      request.country,
      credentials,
    );

    const { results } = await callDataForSeo<GoogleAdsKeywordItem>(
      "/v3/keywords_data/google_ads/keywords_for_keywords/live",
      {
        credentials,
        body: [
          {
            keywords: seeds,
            location_code: locationCode,
            language_code: request.language,
            search_partners: false,
            // Google Ads hides adult suggestions by default; keeping that
            // default avoids surprising results in an SEO tool.
            include_adult_keywords: false,
            sort_by: "search_volume",
          },
        ],
      },
    );

    const seen = new Set<string>();
    const metrics: KeywordMetrics[] = [];
    for (const item of results) {
      const mapped = toKeywordMetrics(item, {
        country: request.country,
        language: request.language,
      });
      if (!mapped) continue;
      const key = mapped.keyword.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      metrics.push(mapped);
      if (metrics.length >= limit) break;
    }

    return tryAttachDifficulty(metrics, credentials, locationCode, request.language);
  }
}

export class DataForSeoSerpProvider implements SerpProvider {
  readonly id = "dataforseo";
  readonly label = "DataForSEO (Google organic SERP)";

  status(): ProviderStatus {
    return configuredStatus(this.id, this.label);
  }

  async fetchSerp(request: SerpFetchRequest): Promise<SerpFetchResult[]> {
    const credentials = requireCredentials("SERP", this.status());
    const keyword = request.keyword.trim();
    if (!keyword) return [];

    const limit = Math.max(1, request.limit ?? DEFAULT_SERP_DEPTH);
    const locationCode = await resolveLocationCode("serp", request.country, credentials);

    const { results } = await callDataForSeo<SerpLiveResult>(
      "/v3/serp/google/organic/live/advanced",
      {
        credentials,
        body: [
          {
            keyword,
            location_code: locationCode,
            language_code: request.language,
            device: "desktop",
            os: "windows",
            // `depth` counts every SERP element, not just organic ones, so ask
            // for more than we need and trim to the organic top N after mapping.
            depth: Math.max(20, limit * 2),
          },
        ],
      },
    );

    return toSerpResults(results[0], limit);
  }
}
