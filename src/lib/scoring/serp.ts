import type { PageType, SerpResult } from "@/lib/domain/types";

export interface SerpSignal {
  label: string;
  points: number;
  detail: string;
}

export interface SerpSummary {
  resultCount: number;
  /** Counts only rows explicitly marked low-authority. Unknown is not weak. */
  lowAuthorityCount: number;
  newSiteCount: number;
  utilityCount: number;
  articleCount: number;
  directoryCount: number;
  forumCount: number;
  ecommerceCount: number;
  otherCount: number;
  poorIntentMatchCount: number;
  weakCompetitorCount: number;
  strongCompetitorCount: number;
  unclassifiedCount: number;
  /** Rows where authority is genuinely unknown — reported, never assumed. */
  unknownAuthorityCount: number;
  /** null when there is not enough captured SERP data to justify a number. */
  suggestedWeaknessScore: number | null;
  signals: SerpSignal[];
  explanation: string;
}

/** Minimum captured results before a weakness suggestion is offered. */
export const MIN_RESULTS_FOR_SUGGESTION = 3;

const countBy = (results: SerpResult[], type: PageType) =>
  results.filter((r) => r.pageType === type).length;

/**
 * Summarises captured SERP results and, when there is enough evidence, suggests
 * a weakness score.
 *
 * The suggestion is evidence-additive: every point comes from something the
 * operator or a provider explicitly recorded. Unknown values contribute
 * nothing — a SERP we have not classified is not a weak SERP.
 */
export function summarizeSerp(results: SerpResult[]): SerpSummary {
  const top = [...results].sort((a, b) => a.position - b.position).slice(0, 10);

  const lowAuthorityCount = top.filter((r) => r.isLowAuthority === true).length;
  const newSiteCount = top.filter((r) => r.isNewSite === true).length;
  const unknownAuthorityCount = top.filter(
    (r) => r.isLowAuthority === null && r.domainAuthority === null,
  ).length;

  const utilityCount = countBy(top, "UTILITY");
  const articleCount = countBy(top, "ARTICLE");
  const directoryCount = countBy(top, "DIRECTORY");
  const forumCount = countBy(top, "FORUM");
  const ecommerceCount = countBy(top, "ECOMMERCE");
  const otherCount = countBy(top, "OTHER");

  const poorIntentMatchCount = top.filter(
    (r) => r.assessment === "POOR_INTENT_MATCH",
  ).length;
  const weakCompetitorCount = top.filter(
    (r) => r.assessment === "WEAK_COMPETITOR",
  ).length;
  const strongCompetitorCount = top.filter(
    (r) => r.assessment === "STRONG_COMPETITOR",
  ).length;
  const unclassifiedCount = top.filter(
    (r) => r.assessment === "UNCLASSIFIED",
  ).length;

  const signals: SerpSignal[] = [];
  const add = (label: string, points: number, detail: string) => {
    if (points !== 0) signals.push({ label, points, detail });
  };

  const lowAuthorityPoints = Math.min(40, lowAuthorityCount * 8);
  add(
    "Low-authority domains ranking",
    lowAuthorityPoints,
    `${lowAuthorityCount} of the top ${top.length} results are marked low authority.`,
  );

  const newSitePoints = Math.min(18, newSiteCount * 6);
  add(
    "Apparently new domains",
    newSitePoints,
    `${newSiteCount} result(s) marked as new sites, which suggests the SERP is not settled.`,
  );

  const nonUtilityCount = articleCount + forumCount + directoryCount;
  const nonUtilityPoints = Math.min(24, nonUtilityCount * 4);
  add(
    "Non-utility pages occupying the SERP",
    nonUtilityPoints,
    `${nonUtilityCount} result(s) are articles, forums or directories rather than a tool that solves the query directly.`,
  );

  const poorIntentPoints = Math.min(20, poorIntentMatchCount * 4);
  add(
    "Poor intent match",
    poorIntentPoints,
    `${poorIntentMatchCount} result(s) flagged by the operator as not matching intent.`,
  );

  const weakCompetitorPoints = Math.min(25, weakCompetitorCount * 5);
  add(
    "Weak competitors",
    weakCompetitorPoints,
    `${weakCompetitorCount} result(s) flagged as weak competitors.`,
  );

  const strongCompetitorPoints = -Math.min(48, strongCompetitorCount * 8);
  add(
    "Strong competitors",
    strongCompetitorPoints,
    `${strongCompetitorCount} result(s) flagged as strong competitors, which reduces weakness.`,
  );

  const existingUtilityPoints = -Math.min(30, utilityCount * 3);
  add(
    "Existing utilities already ranking",
    existingUtilityPoints,
    `${utilityCount} result(s) are already utilities serving this query.`,
  );

  const rawTotal = signals.reduce((sum, s) => sum + s.points, 0);
  const suggested =
    top.length < MIN_RESULTS_FOR_SUGGESTION
      ? null
      : Math.max(0, Math.min(100, rawTotal));

  const explanation =
    top.length === 0
      ? "No SERP results captured yet. Add the top 10 results to assess weakness."
      : top.length < MIN_RESULTS_FOR_SUGGESTION
        ? `Only ${top.length} result(s) captured. At least ${MIN_RESULTS_FOR_SUGGESTION} are needed before a weakness score can be suggested.`
        : rawTotal <= 0
          ? "No weakness signals outweigh the competition recorded on this SERP. On the captured evidence this SERP does not look vulnerable."
          : `Suggested weakness of ${suggested}/100 is the sum of the recorded signals below. It is a suggestion only — the stored score is whatever you decide.`;

  return {
    resultCount: top.length,
    lowAuthorityCount,
    newSiteCount,
    utilityCount,
    articleCount,
    directoryCount,
    forumCount,
    ecommerceCount,
    otherCount,
    poorIntentMatchCount,
    weakCompetitorCount,
    strongCompetitorCount,
    unclassifiedCount,
    unknownAuthorityCount,
    suggestedWeaknessScore: suggested,
    signals,
    explanation,
  };
}
