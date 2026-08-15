import { describe, expect, it } from "vitest";

import {
  deriveTrend,
  mergeDifficulty,
  numberOrNull,
  toCompetitionLevel,
  toKeywordMetrics,
  toSerpResults,
} from "@/lib/providers/dataforseo/mapping";
import type { KeywordMetrics } from "@/lib/providers/types";

const context = { country: "US", language: "en" };

/** Twelve months of identical volume — enough history, no movement. */
const flatYear = (volume: number) =>
  Array.from({ length: 12 }, (_, i) => ({
    year: 2025,
    month: i + 1,
    search_volume: volume,
  }));

describe("numberOrNull", () => {
  it("keeps a measured zero", () => {
    expect(numberOrNull(0)).toBe(0);
  });

  it("rejects anything that is not a finite number", () => {
    expect(numberOrNull(null)).toBeNull();
    expect(numberOrNull(undefined)).toBeNull();
    expect(numberOrNull("1200")).toBeNull();
    expect(numberOrNull(Number.NaN)).toBeNull();
    expect(numberOrNull(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("toCompetitionLevel", () => {
  it("maps the three real buckets", () => {
    expect(toCompetitionLevel("LOW")).toBe("LOW");
    expect(toCompetitionLevel("medium")).toBe("MEDIUM");
    expect(toCompetitionLevel("HIGH")).toBe("HIGH");
  });

  it("treats UNSPECIFIED as unknown rather than as LOW", () => {
    expect(toCompetitionLevel("UNSPECIFIED")).toBeNull();
    expect(toCompetitionLevel(null)).toBeNull();
    expect(toCompetitionLevel(undefined)).toBeNull();
  });
});

describe("toKeywordMetrics", () => {
  it("preserves nulls instead of substituting zeros", () => {
    const mapped = toKeywordMetrics(
      {
        keyword: "mortgage calculator",
        search_volume: null,
        cpc: null,
        competition: null,
        competition_index: null,
      },
      context,
    );

    expect(mapped).toEqual({
      keyword: "mortgage calculator",
      country: "US",
      language: "en",
      searchVolume: null,
      keywordDifficulty: null,
      cpc: null,
      competitionIndex: null,
      competitionLevel: null,
      trend: "UNKNOWN",
    });
  });

  it("carries measured values through", () => {
    const mapped = toKeywordMetrics(
      {
        keyword: "  vat calculator  ",
        search_volume: 8100,
        cpc: 1.42,
        competition: "MEDIUM",
        competition_index: 47,
        monthly_searches: flatYear(8100),
      },
      context,
    );

    expect(mapped).toMatchObject({
      keyword: "vat calculator",
      searchVolume: 8100,
      cpc: 1.42,
      competitionIndex: 47,
      competitionLevel: "MEDIUM",
      trend: "STABLE",
    });
  });

  it("never fills keywordDifficulty from advertiser competition", () => {
    const mapped = toKeywordMetrics(
      { keyword: "loan calculator", competition_index: 91, competition: "HIGH" },
      context,
    );
    expect(mapped?.keywordDifficulty).toBeNull();
  });

  it("drops an out-of-range competition index rather than clamping it", () => {
    const mapped = toKeywordMetrics(
      { keyword: "x", competition_index: 140 },
      context,
    );
    expect(mapped?.competitionIndex).toBeNull();
  });

  it("skips items with no keyword", () => {
    expect(toKeywordMetrics({ keyword: null }, context)).toBeNull();
    expect(toKeywordMetrics({ keyword: "   " }, context)).toBeNull();
  });
});

describe("deriveTrend", () => {
  it("is UNKNOWN without a full year of history", () => {
    expect(deriveTrend(null)).toBe("UNKNOWN");
    expect(deriveTrend(flatYear(500).slice(0, 11))).toBe("UNKNOWN");
  });

  it("is UNKNOWN when months are present but volumes are not", () => {
    const monthsWithoutVolumes = Array.from({ length: 12 }, (_, i) => ({
      year: 2025,
      month: i + 1,
      search_volume: null,
    }));
    expect(deriveTrend(monthsWithoutVolumes)).toBe("UNKNOWN");
  });

  it("reads a flat year as STABLE", () => {
    expect(deriveTrend(flatYear(1000))).toBe("STABLE");
  });

  it("reads a lifted recent quarter as RISING", () => {
    const months = flatYear(1000);
    for (const month of months.slice(-3)) month.search_volume = 2000;
    expect(deriveTrend(months)).toBe("RISING");
  });

  it("reads a collapsed recent quarter as DECLINING", () => {
    const months = flatYear(1000);
    for (const month of months.slice(-3)) month.search_volume = 300;
    expect(deriveTrend(months)).toBe("DECLINING");
  });

  it("does not claim SEASONAL from a single year's spike", () => {
    const months = flatYear(100);
    months[11].search_volume = 5000;
    months[10].search_volume = 3000;
    months[9].search_volume = 2000;
    // One December spike is indistinguishable from a keyword taking off.
    expect(deriveTrend(months)).toBe("RISING");
  });

  it("calls SEASONAL once the same peak repeats a year later", () => {
    const december = (year: number) => {
      const months = flatYear(100).map((m) => ({ ...m, year }));
      months[11].search_volume = 5000;
      return months;
    };
    expect(deriveTrend([...december(2024), ...december(2025)])).toBe("SEASONAL");
  });

  it("does not call two differently-timed spikes SEASONAL", () => {
    const spike = (year: number, monthIndex: number) => {
      const months = flatYear(100).map((m) => ({ ...m, year }));
      months[monthIndex].search_volume = 5000;
      return months;
    };
    // A March peak followed by a December peak is not an annual cycle.
    expect(deriveTrend([...spike(2024, 2), ...spike(2025, 11)])).not.toBe("SEASONAL");
  });

  it("orders months before comparing, regardless of payload order", () => {
    const months = flatYear(1000);
    for (const month of months.slice(-3)) month.search_volume = 2000;
    expect(deriveTrend([...months].reverse())).toBe("RISING");
  });
});

describe("mergeDifficulty", () => {
  const base: KeywordMetrics[] = [
    {
      keyword: "VAT Calculator",
      country: "US",
      language: "en",
      searchVolume: 100,
      keywordDifficulty: null,
      cpc: null,
      competitionIndex: null,
      competitionLevel: null,
      trend: "UNKNOWN",
    },
    {
      keyword: "roi calculator",
      country: "US",
      language: "en",
      searchVolume: 200,
      keywordDifficulty: null,
      cpc: null,
      competitionIndex: null,
      competitionLevel: null,
      trend: "UNKNOWN",
    },
  ];

  it("matches case-insensitively and leaves uncovered keywords null", () => {
    const merged = mergeDifficulty(base, [
      { keyword: "vat calculator", keyword_difficulty: 31 },
    ]);
    expect(merged[0].keywordDifficulty).toBe(31);
    expect(merged[1].keywordDifficulty).toBeNull();
  });

  it("ignores difficulty values the API did not really supply", () => {
    const merged = mergeDifficulty(base, [
      { keyword: "vat calculator", keyword_difficulty: null },
      { keyword: "roi calculator", keyword_difficulty: 250 },
    ]);
    expect(merged[0].keywordDifficulty).toBeNull();
    expect(merged[1].keywordDifficulty).toBeNull();
  });
});

describe("toSerpResults", () => {
  const payload = {
    items: [
      { type: "paid", rank_group: 1, domain: "ads.example", title: "Ad" },
      { type: "featured_snippet", rank_group: 1, domain: "snippet.example" },
      { type: "organic", rank_group: 2, domain: "b.example", url: "https://b.example/x", title: "B" },
      { type: "organic", rank_group: 1, domain: "a.example", url: "https://a.example/x", title: "A" },
      { type: "people_also_ask", rank_group: 3, domain: "paa.example" },
      { type: "organic", rank_group: 3, domain: "c.example", url: null, title: null },
    ],
  };

  it("keeps only organic results, ordered and renumbered from 1", () => {
    const results = toSerpResults(payload, 10);
    expect(results.map((r) => [r.position, r.domain])).toEqual([
      [1, "a.example"],
      [2, "b.example"],
      [3, "c.example"],
    ]);
  });

  it("leaves every judgement field null", () => {
    for (const result of toSerpResults(payload, 10)) {
      expect(result.domainAuthority).toBeNull();
      expect(result.pageType).toBeNull();
      expect(result.isLowAuthority).toBeNull();
      expect(result.isNewSite).toBeNull();
    }
  });

  it("respects the limit", () => {
    expect(toSerpResults(payload, 2)).toHaveLength(2);
  });

  it("drops rows with no domain or no rank", () => {
    const results = toSerpResults(
      {
        items: [
          { type: "organic", rank_group: 1, domain: null },
          { type: "organic", rank_group: null, domain: "d.example" },
          { type: "organic", rank_group: 2, domain: "  " },
          { type: "organic", rank_group: 3, domain: "e.example" },
        ],
      },
      10,
    );
    expect(results.map((r) => r.domain)).toEqual(["e.example"]);
  });

  it("falls back to rank_absolute when rank_group is absent", () => {
    const results = toSerpResults(
      { items: [{ type: "organic", rank_absolute: 4, domain: "f.example" }] },
      10,
    );
    expect(results).toEqual([
      {
        position: 1,
        domain: "f.example",
        url: null,
        title: null,
        domainAuthority: null,
        pageType: null,
        isLowAuthority: null,
        isNewSite: null,
      },
    ]);
  });

  it("handles a missing or empty payload", () => {
    expect(toSerpResults(undefined, 10)).toEqual([]);
    expect(toSerpResults({ items: null }, 10)).toEqual([]);
  });
});
