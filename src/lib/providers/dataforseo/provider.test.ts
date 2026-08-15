import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DataForSeoKeywordProvider,
  DataForSeoSerpProvider,
} from "@/lib/providers/dataforseo";
import { clearLocationCache } from "@/lib/providers/dataforseo/locations";
import { ProviderNotConfiguredError } from "@/lib/providers/types";

/**
 * Exercises the wiring between provider methods and the HTTP layer with a
 * stubbed `fetch`: which endpoints are hit, what is sent, and how the responses
 * are folded together. The live API is never called.
 */

const ok = (result: unknown[]) => ({
  status_code: 20000,
  status_message: "Ok.",
  cost: 0.01,
  tasks: [{ status_code: 20000, result }],
});

const LOCATIONS = [
  { location_code: 2840, location_name: "United States", location_type: "Country", country_iso_code: "US" },
  { location_code: 21137, location_name: "Alabama", location_type: "Region", country_iso_code: "US" },
  { location_code: 2826, location_name: "United Kingdom", location_type: "Country", country_iso_code: "GB" },
];

/** Routes stubbed responses by path so tests read as a request/response table. */
function stubApi(routes: Record<string, unknown>) {
  const calls: Array<{ path: string; body: unknown }> = [];

  const fetchMock = vi.fn(async (url: string, init: { body?: string }) => {
    const path = new URL(url).pathname;
    const match = Object.keys(routes).find((key) => path.startsWith(key));
    if (!match) throw new Error(`Unexpected request to ${path}`);
    calls.push({ path, body: init.body ? JSON.parse(init.body) : undefined });
    return { status: 200, json: async () => routes[match] } as unknown as Response;
  });

  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

beforeEach(() => {
  clearLocationCache();
  vi.stubEnv("DATAFORSEO_LOGIN", "user");
  vi.stubEnv("DATAFORSEO_PASSWORD", "pass");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("DataForSeoKeywordProvider", () => {
  it("reports itself unconfigured without credentials, and refuses to call", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    const provider = new DataForSeoKeywordProvider();

    expect(provider.status().configured).toBe(false);
    expect(provider.status().requiredEnv).toEqual([
      "DATAFORSEO_LOGIN",
      "DATAFORSEO_PASSWORD",
    ]);
    await expect(
      provider.lookup({ keywords: ["x"], country: "US", language: "en" }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("expands seeds, resolving the country to a country-level location code", async () => {
    const calls = stubApi({
      "/v3/keywords_data/google_ads/locations": ok(LOCATIONS),
      "/v3/keywords_data/google_ads/keywords_for_keywords/live": ok([
        { keyword: "vat calculator", search_volume: 8100, cpc: 1.2 },
        { keyword: "roi calculator", search_volume: null, cpc: null },
      ]),
      "/v3/dataforseo_labs/google/bulk_keyword_difficulty/live": ok([
        { items: [{ keyword: "vat calculator", keyword_difficulty: 24 }] },
      ]),
    });

    const results = await new DataForSeoKeywordProvider().expand({
      seeds: ["calculator"],
      country: "US",
      language: "en",
    });

    const expansion = calls.find((c) => c.path.includes("keywords_for_keywords"));
    // 2840 is the country, not 21137 (Alabama), which shares the ISO code.
    expect(expansion?.body).toEqual([
      {
        keywords: ["calculator"],
        location_code: 2840,
        language_code: "en",
        search_partners: false,
        include_adult_keywords: false,
        sort_by: "search_volume",
      },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      keyword: "vat calculator",
      searchVolume: 8100,
      keywordDifficulty: 24,
      country: "US",
    });
    // Unknown stays unknown, and the Labs call did not cover this keyword.
    expect(results[1]).toMatchObject({
      keyword: "roi calculator",
      searchVolume: null,
      cpc: null,
      keywordDifficulty: null,
    });
  });

  it("still returns volume and CPC when the Labs difficulty call fails", async () => {
    stubApi({
      "/v3/keywords_data/google_ads/locations": ok(LOCATIONS),
      "/v3/keywords_data/google_ads/search_volume/live": ok([
        { keyword: "vat calculator", search_volume: 8100, cpc: 1.2 },
      ]),
      // Accounts without a Labs subscription get this instead of results.
      "/v3/dataforseo_labs/google/bulk_keyword_difficulty/live": {
        status_code: 40200,
        status_message: "Payment Required.",
      },
    });

    const results = await new DataForSeoKeywordProvider().lookup({
      keywords: ["vat calculator"],
      country: "US",
      language: "en",
    });

    expect(results[0]).toMatchObject({ searchVolume: 8100, keywordDifficulty: null });
  });

  it("deduplicates seeds and honours the result limit", async () => {
    const calls = stubApi({
      "/v3/keywords_data/google_ads/locations": ok(LOCATIONS),
      "/v3/keywords_data/google_ads/keywords_for_keywords/live": ok([
        { keyword: "a", search_volume: 3 },
        { keyword: "A", search_volume: 2 },
        { keyword: "b", search_volume: 1 },
      ]),
      "/v3/dataforseo_labs/google/bulk_keyword_difficulty/live": ok([{ items: [] }]),
    });

    const results = await new DataForSeoKeywordProvider().expand({
      seeds: [" calculator ", "calculator", "generator"],
      country: "US",
      language: "en",
      limit: 2,
    });

    const expansion = calls.find((c) => c.path.includes("keywords_for_keywords"));
    expect((expansion?.body as Array<{ keywords: string[] }>)[0].keywords).toEqual([
      "calculator",
      "generator",
    ]);
    // "a" and "A" are the same keyword, so the second result is "b".
    expect(results.map((r) => r.keyword)).toEqual(["a", "b"]);
  });

  it("rejects a country DataForSEO does not list", async () => {
    stubApi({ "/v3/keywords_data/google_ads/locations": ok(LOCATIONS) });

    await expect(
      new DataForSeoKeywordProvider().lookup({
        keywords: ["x"],
        country: "ZZ",
        language: "en",
      }),
    ).rejects.toThrow(/no country-level location/);
  });
});

describe("DataForSeoSerpProvider", () => {
  it("requests more depth than it needs and returns the organic top N", async () => {
    const calls = stubApi({
      "/v3/serp/google/locations": ok(LOCATIONS),
      "/v3/serp/google/organic/live/advanced": ok([
        {
          items: [
            { type: "paid", rank_group: 1, domain: "ad.example" },
            { type: "organic", rank_group: 1, domain: "a.example", url: "https://a.example" },
            { type: "organic", rank_group: 2, domain: "b.example" },
            { type: "organic", rank_group: 3, domain: "c.example" },
          ],
        },
      ]),
    });

    const results = await new DataForSeoSerpProvider().fetchSerp({
      keyword: "vat calculator",
      country: "GB",
      language: "en",
      limit: 2,
    });

    const serp = calls.find((c) => c.path.includes("organic/live/advanced"));
    expect(serp?.body).toEqual([
      {
        keyword: "vat calculator",
        location_code: 2826,
        language_code: "en",
        device: "desktop",
        os: "windows",
        // `depth` counts every SERP element, so it must exceed the organic limit.
        depth: 20,
      },
    ]);

    expect(results.map((r) => [r.position, r.domain])).toEqual([
      [1, "a.example"],
      [2, "b.example"],
    ]);
    expect(results.every((r) => r.isLowAuthority === null && r.isNewSite === null)).toBe(
      true,
    );
  });
});
