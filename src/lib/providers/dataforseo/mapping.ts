import type { CompetitionLevel, Trend } from "@/lib/domain/types";
import type { KeywordMetrics, SerpFetchResult } from "@/lib/providers/types";

/**
 * Wire shapes → domain types.
 *
 * Kept pure and free of `server-only` so it can be unit-tested against captured
 * payloads. This file is where the project's central rule is enforced in
 * practice: a field DataForSEO did not answer becomes `null`, never `0` and
 * never a guess.
 */

// --- raw shapes we actually read -------------------------------------------

/**
 * Shared item shape of `keywords_data/google_ads/search_volume/live` and
 * `keywords_data/google_ads/keywords_for_keywords/live`. Both endpoints return
 * Google Ads Keyword Planner data, so the fields are identical.
 */
export interface GoogleAdsKeywordItem {
  keyword?: string | null;
  location_code?: number | null;
  language_code?: string | null;
  search_volume?: number | null;
  cpc?: number | null;
  competition?: string | null;
  competition_index?: number | null;
  monthly_searches?: Array<{
    year?: number | null;
    month?: number | null;
    search_volume?: number | null;
  }> | null;
}

/** Item shape of `dataforseo_labs/google/bulk_keyword_difficulty/live`. */
export interface BulkDifficultyItem {
  keyword?: string | null;
  keyword_difficulty?: number | null;
}

/** Result shape of `serp/google/organic/live/advanced`. */
export interface SerpLiveResult {
  items?: SerpLiveItem[] | null;
}

export interface SerpLiveItem {
  type?: string | null;
  rank_group?: number | null;
  rank_absolute?: number | null;
  domain?: string | null;
  url?: string | null;
  title?: string | null;
}

// --- primitives -------------------------------------------------------------

/**
 * Accepts a number the provider actually reported and rejects everything else.
 * Note that `0` survives: Google Ads reporting zero searches is a measurement,
 * and turning it into "unknown" would discard real evidence just as surely as
 * turning unknown into zero would invent it.
 */
export function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function boundedOrNull(value: unknown, min: number, max: number): number | null {
  const parsed = numberOrNull(value);
  if (parsed === null) return null;
  return parsed < min || parsed > max ? null : parsed;
}

/**
 * Google Ads reports competition as LOW/MEDIUM/HIGH, but also emits
 * `UNSPECIFIED` (and occasionally null) when it has nothing to say. Those must
 * not collapse into "LOW" — absence of a bucket is not the lowest bucket.
 */
export function toCompetitionLevel(value: unknown): CompetitionLevel | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return upper === "LOW" || upper === "MEDIUM" || upper === "HIGH" ? upper : null;
}

// --- trend ------------------------------------------------------------------

/** A full year of history, so a comparison is not distorted by a partial season. */
const MONTHS_REQUIRED = 12;
/** Seasonality can only be *seen* once a pattern has had a chance to repeat. */
const MONTHS_FOR_SEASONALITY = 24;
/** A peak this far above its own year's mean counts as a real swing. */
const SEASONAL_PEAK_RATIO = 1.5;
/** Recent quarter this far from the preceding months reads as a direction of travel. */
const RISING_RATIO = 1.2;
const DECLINING_RATIO = 0.8;

const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * True when both twelve-month windows peak sharply in roughly the same month.
 * One spike is not a season — it is just as likely to be a keyword taking off —
 * so this only ever runs with two years of history to compare.
 */
function repeatsAnnually(previous: number[], recent: number[]): boolean {
  const peakIndex = (values: number[]) =>
    values.reduce((best, v, i) => (v > values[best] ? i : best), 0);

  for (const window of [previous, recent]) {
    const windowMean = mean(window);
    if (windowMean <= 0) return false;
    if (Math.max(...window) / windowMean < SEASONAL_PEAK_RATIO) return false;
  }

  // Months are cyclic: a December peak and a January peak are one month apart.
  const distance = Math.abs(peakIndex(previous) - peakIndex(recent));
  return Math.min(distance, 12 - distance) <= 1;
}

/**
 * Derives a trend from the monthly search history Google Ads actually reported.
 *
 * This is a computation over measured values, not an estimate. Two limits are
 * deliberate:
 *
 * - Fewer than twelve complete months yields UNKNOWN. A partial year cannot be
 *   compared against anything.
 * - SEASONAL requires two years. With a single year, a December spike and a
 *   keyword genuinely taking off produce the same twelve numbers, and calling
 *   one of them "seasonal" would be a claim the data cannot support. Such a
 *   year is reported as RISING, which is what the window actually shows.
 *
 * The thresholds are arbitrary in the way every classification boundary is, so
 * they are named constants above and documented in the README.
 */
export function deriveTrend(monthly: GoogleAdsKeywordItem["monthly_searches"]): Trend {
  if (!Array.isArray(monthly)) return "UNKNOWN";

  const volumes = monthly
    .filter((entry) => numberOrNull(entry?.search_volume) !== null)
    .map((entry) => ({
      year: numberOrNull(entry.year) ?? 0,
      month: numberOrNull(entry.month) ?? 0,
      volume: numberOrNull(entry.search_volume) as number,
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((entry) => entry.volume);

  if (volumes.length < MONTHS_REQUIRED) return "UNKNOWN";

  const recentYear = volumes.slice(-MONTHS_REQUIRED);
  if (mean(recentYear) <= 0) return "UNKNOWN";

  if (volumes.length >= MONTHS_FOR_SEASONALITY) {
    const previousYear = volumes.slice(-MONTHS_FOR_SEASONALITY, -MONTHS_REQUIRED);
    if (repeatsAnnually(previousYear, recentYear)) return "SEASONAL";
  }

  // The last quarter against the nine months before it. Comparing against the
  // whole year would include the quarter in its own baseline and mute the signal.
  const baseline = mean(recentYear.slice(0, 9));
  if (baseline <= 0) return "UNKNOWN";
  const ratio = mean(recentYear.slice(-3)) / baseline;

  if (ratio >= RISING_RATIO) return "RISING";
  if (ratio <= DECLINING_RATIO) return "DECLINING";
  return "STABLE";
}

// --- keywords ---------------------------------------------------------------

/**
 * Maps one Google Ads item. `keywordDifficulty` is always null here: this
 * endpoint does not measure organic difficulty, and `competition_index` is an
 * advertiser metric that would be a different number wearing the same name.
 * Difficulty is filled in separately from the Labs endpoint, when available.
 */
export function toKeywordMetrics(
  item: GoogleAdsKeywordItem,
  context: { country: string; language: string },
): KeywordMetrics | null {
  const keyword = typeof item.keyword === "string" ? item.keyword.trim() : "";
  if (!keyword) return null;

  return {
    keyword,
    country: context.country,
    language: context.language,
    searchVolume: numberOrNull(item.search_volume),
    keywordDifficulty: null,
    cpc: numberOrNull(item.cpc),
    competitionIndex: boundedOrNull(item.competition_index, 0, 100),
    competitionLevel: toCompetitionLevel(item.competition),
    trend: deriveTrend(item.monthly_searches),
  };
}

/**
 * Folds Labs difficulty scores into already-mapped metrics. Keywords the Labs
 * endpoint did not cover keep `keywordDifficulty: null`.
 */
export function mergeDifficulty(
  metrics: KeywordMetrics[],
  difficulties: BulkDifficultyItem[],
): KeywordMetrics[] {
  const byKeyword = new Map<string, number>();
  for (const item of difficulties) {
    const keyword = typeof item.keyword === "string" ? item.keyword.trim() : "";
    const difficulty = boundedOrNull(item.keyword_difficulty, 0, 100);
    if (keyword && difficulty !== null) byKeyword.set(keyword.toLowerCase(), difficulty);
  }

  return metrics.map((entry) => {
    const difficulty = byKeyword.get(entry.keyword.toLowerCase());
    return difficulty === undefined ? entry : { ...entry, keywordDifficulty: difficulty };
  });
}

// --- SERP -------------------------------------------------------------------

/**
 * Extracts the organic top N from a live SERP result.
 *
 * Non-organic blocks (ads, People Also Ask, featured snippets, local packs) are
 * dropped, and positions are renumbered 1..N over the organic results so that
 * "position 3" means the third organic listing rather than the third thing on
 * the page.
 *
 * Everything this application treats as a judgement stays null: authority,
 * whether a site is new, and what kind of page it is. DataForSEO does not
 * measure any of those on this endpoint, and guessing them would manufacture
 * exactly the "the SERP is weak" conclusion the scoring engine is supposed to
 * earn from evidence.
 */
export function toSerpResults(
  result: SerpLiveResult | undefined,
  limit: number,
): SerpFetchResult[] {
  const items = Array.isArray(result?.items) ? result.items : [];

  return items
    .filter((item) => item?.type === "organic")
    .map((item) => ({
      item,
      rank: numberOrNull(item.rank_group) ?? numberOrNull(item.rank_absolute),
    }))
    .filter(
      (entry): entry is { item: SerpLiveItem; rank: number } => entry.rank !== null,
    )
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.item)
    .filter((item) => typeof item.domain === "string" && item.domain.trim() !== "")
    .slice(0, limit)
    .map((item, index) => ({
      position: index + 1,
      domain: (item.domain as string).trim(),
      url: typeof item.url === "string" && item.url ? item.url : null,
      title: typeof item.title === "string" && item.title ? item.title : null,
      domainAuthority: null,
      pageType: null,
      isLowAuthority: null,
      isNewSite: null,
    }));
}
