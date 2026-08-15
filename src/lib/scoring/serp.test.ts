import { describe, expect, it } from "vitest";

import type { SerpResult } from "@/lib/domain/types";
import { MIN_RESULTS_FOR_SUGGESTION, summarizeSerp } from "@/lib/scoring/serp";

let counter = 0;

function result(overrides: Partial<SerpResult> = {}): SerpResult {
  counter += 1;
  return {
    id: `serp-${counter}`,
    opportunityId: "opp-1",
    position: counter,
    domain: `example-${counter}.com`,
    url: null,
    title: null,
    domainAuthority: null,
    pageType: "OTHER",
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

describe("summarizeSerp", () => {
  it("suggests nothing when no results are captured", () => {
    const summary = summarizeSerp([]);
    expect(summary.resultCount).toBe(0);
    expect(summary.suggestedWeaknessScore).toBeNull();
    expect(summary.explanation).toMatch(/no serp results/i);
  });

  it("refuses to suggest a score below the evidence threshold", () => {
    const summary = summarizeSerp([
      result({ isLowAuthority: true }),
      result({ isLowAuthority: true }),
    ]);
    expect(summary.resultCount).toBeLessThan(MIN_RESULTS_FOR_SUGGESTION);
    expect(summary.suggestedWeaknessScore).toBeNull();
  });

  it("does not treat unclassified results as weak", () => {
    const summary = summarizeSerp([result(), result(), result(), result()]);
    expect(summary.lowAuthorityCount).toBe(0);
    expect(summary.newSiteCount).toBe(0);
    expect(summary.unknownAuthorityCount).toBe(4);
    expect(summary.suggestedWeaknessScore).toBe(0);
    expect(summary.explanation).toMatch(/does not look vulnerable/i);
  });

  it("counts only explicitly marked low-authority and new domains", () => {
    const summary = summarizeSerp([
      result({ isLowAuthority: true, isNewSite: true }),
      result({ isLowAuthority: false, isNewSite: false }),
      result({ isLowAuthority: null, isNewSite: null }),
    ]);

    expect(summary.lowAuthorityCount).toBe(1);
    expect(summary.newSiteCount).toBe(1);
    expect(summary.unknownAuthorityCount).toBe(1);
  });

  it("raises weakness for article-dominated SERPs with weak competitors", () => {
    const summary = summarizeSerp([
      result({ pageType: "ARTICLE", assessment: "POOR_INTENT_MATCH" }),
      result({ pageType: "ARTICLE", isLowAuthority: true, assessment: "WEAK_COMPETITOR" }),
      result({ pageType: "FORUM", assessment: "POOR_INTENT_MATCH" }),
      result({ pageType: "DIRECTORY", isLowAuthority: true, isNewSite: true }),
    ]);

    expect(summary.articleCount).toBe(2);
    expect(summary.suggestedWeaknessScore).toBeGreaterThan(40);
    expect(summary.signals.some((s) => s.points > 0)).toBe(true);
  });

  it("reduces weakness when strong competitors and utilities already rank", () => {
    const weak = summarizeSerp([
      result({ pageType: "ARTICLE", isLowAuthority: true }),
      result({ pageType: "ARTICLE", isLowAuthority: true }),
      result({ pageType: "ARTICLE", isLowAuthority: true }),
    ]);

    const contested = summarizeSerp([
      result({ pageType: "ARTICLE", isLowAuthority: true }),
      result({ pageType: "ARTICLE", isLowAuthority: true }),
      result({ pageType: "ARTICLE", isLowAuthority: true }),
      result({ pageType: "UTILITY", assessment: "STRONG_COMPETITOR" }),
      result({ pageType: "UTILITY", assessment: "STRONG_COMPETITOR" }),
    ]);

    expect(contested.suggestedWeaknessScore!).toBeLessThan(
      weak.suggestedWeaknessScore!,
    );
  });

  it("never returns a score outside 0-100", () => {
    const overwhelming = summarizeSerp(
      Array.from({ length: 10 }, () =>
        result({
          pageType: "ARTICLE",
          isLowAuthority: true,
          isNewSite: true,
          assessment: "WEAK_COMPETITOR",
        }),
      ),
    );
    expect(overwhelming.suggestedWeaknessScore).toBeLessThanOrEqual(100);

    const hostile = summarizeSerp(
      Array.from({ length: 10 }, () =>
        result({ pageType: "UTILITY", assessment: "STRONG_COMPETITOR" }),
      ),
    );
    expect(hostile.suggestedWeaknessScore).toBeGreaterThanOrEqual(0);
  });

  it("only considers the top 10 positions", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      result({ position: index + 1, isLowAuthority: true }),
    );
    expect(summarizeSerp(many).resultCount).toBe(10);
  });
});
