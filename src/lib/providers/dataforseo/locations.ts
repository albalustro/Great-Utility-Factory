import "server-only";

import { callDataForSeo, type DataForSeoCredentials } from "@/lib/providers/dataforseo/client";

/**
 * Country ISO code → DataForSEO location code.
 *
 * The app stores countries as ISO-3166 alpha-2 ("US", "GB", "DE") because that
 * is what an operator types. DataForSEO addresses locations by numeric code.
 * Rather than shipping a hardcoded table that silently rots, the mapping is
 * fetched from the API and memoised for the life of the process.
 *
 * The two endpoint families keep separate location catalogues, and the codes
 * are not guaranteed to agree, so each is resolved against its own list.
 */

export type LocationFamily = "keywords_data" | "serp";

const PATHS: Record<LocationFamily, string> = {
  keywords_data: "/v3/keywords_data/google_ads/locations",
  serp: "/v3/serp/google/locations",
};

interface LocationRow {
  location_code?: number | null;
  location_name?: string | null;
  location_type?: string | null;
  country_iso_code?: string | null;
}

/**
 * Held on globalThis so a dev-server hot reload does not re-fetch a list of
 * several thousand rows on every edit.
 */
const globalRef = globalThis as unknown as {
  __dataForSeoLocations?: Partial<Record<LocationFamily, Map<string, number>>>;
};

export class UnknownLocationError extends Error {
  constructor(readonly country: string) {
    super(
      `DataForSEO has no country-level location for "${country}". Use an ISO-3166 alpha-2 country code such as US, GB or DE.`,
    );
    this.name = "UnknownLocationError";
  }
}

async function loadCatalogue(
  family: LocationFamily,
  credentials: DataForSeoCredentials,
): Promise<Map<string, number>> {
  const cache = (globalRef.__dataForSeoLocations ??= {});
  const cached = cache[family];
  if (cached) return cached;

  const { results } = await callDataForSeo<LocationRow>(PATHS[family], { credentials });

  const map = new Map<string, number>();
  for (const row of results) {
    // Only whole countries. Regions and cities share the ISO code of their
    // country, and picking one of those would quietly narrow every lookup to,
    // say, Alabama instead of the United States.
    if (row.location_type !== "Country") continue;
    const iso = row.country_iso_code?.trim().toUpperCase();
    const code = typeof row.location_code === "number" ? row.location_code : null;
    if (iso && code !== null && !map.has(iso)) map.set(iso, code);
  }

  cache[family] = map;
  return map;
}

export async function resolveLocationCode(
  family: LocationFamily,
  country: string,
  credentials: DataForSeoCredentials,
): Promise<number> {
  const iso = country.trim().toUpperCase();
  const catalogue = await loadCatalogue(family, credentials);
  const code = catalogue.get(iso);
  if (code === undefined) throw new UnknownLocationError(country);
  return code;
}

/** Test seam and hot-reload escape hatch. */
export function clearLocationCache(): void {
  globalRef.__dataForSeoLocations = {};
}
