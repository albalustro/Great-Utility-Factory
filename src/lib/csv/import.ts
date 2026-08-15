import {
  TRENDS,
  UTILITY_TYPES,
  type Trend,
  type UtilityType,
} from "@/lib/domain/types";

/** Opportunity fields a CSV column can be mapped onto. */
export const IMPORTABLE_FIELDS = [
  "keyword",
  "country",
  "language",
  "searchVolume",
  "keywordDifficulty",
  "cpc",
  "trend",
  "utilityType",
  "serpWeaknessScore",
  "utilityFitScore",
  "monetizationScore",
  "evergreenScore",
  "buildSimplicityScore",
  "clusterPotentialScore",
  "notes",
] as const;
export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];

export const FIELD_LABELS: Record<ImportableField, string> = {
  keyword: "Keyword (required)",
  country: "Country",
  language: "Language",
  searchVolume: "Search Volume",
  keywordDifficulty: "Keyword Difficulty",
  cpc: "CPC",
  trend: "Trend",
  utilityType: "Utility Type",
  serpWeaknessScore: "SERP Weakness (0-100)",
  utilityFitScore: "Utility Fit (0-100)",
  monetizationScore: "Monetization (0-100)",
  evergreenScore: "Evergreen (0-100)",
  buildSimplicityScore: "Build Simplicity (0-100)",
  clusterPotentialScore: "Cluster Potential (0-100)",
  notes: "Notes",
};

/** Header aliases seen in common keyword-tool exports. */
const ALIASES: Record<ImportableField, string[]> = {
  keyword: ["keyword", "keywords", "query", "term", "search term"],
  country: ["country", "location", "geo", "market"],
  language: ["language", "lang", "locale"],
  searchVolume: [
    "search volume",
    "searchvolume",
    "volume",
    "avg monthly searches",
    "avg. monthly searches",
    "monthly searches",
    "searches",
    "vol",
  ],
  keywordDifficulty: [
    "keyword difficulty",
    "difficulty",
    "kd",
    "competition",
    "seo difficulty",
  ],
  cpc: ["cpc", "cost per click", "avg cpc", "avg. cpc", "top of page bid"],
  trend: ["trend", "trending"],
  utilityType: ["utility type", "type", "tool type", "utilitytype"],
  serpWeaknessScore: ["serp weakness", "weakness", "serpweakness"],
  utilityFitScore: ["utility fit", "fit", "utilityfit"],
  monetizationScore: ["monetization", "monetisation", "money"],
  evergreenScore: ["evergreen", "durability"],
  buildSimplicityScore: ["build simplicity", "simplicity", "effort"],
  clusterPotentialScore: ["cluster potential", "cluster", "expansion"],
  notes: ["notes", "note", "comment", "comments"],
};

export type ColumnMapping = Record<number, ImportableField | "">;

/** Best-effort automatic mapping the operator can then correct. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const taken = new Set<ImportableField>();

  headers.forEach((header, index) => {
    const normalized = header.trim().toLowerCase().replace(/[_-]+/g, " ");
    const match = (IMPORTABLE_FIELDS as readonly ImportableField[]).find(
      (field) =>
        !taken.has(field) &&
        ALIASES[field].some(
          (alias) => alias === normalized || normalized.startsWith(`${alias} `),
        ),
    );
    if (match) {
      taken.add(match);
      mapping[index] = match;
    } else {
      mapping[index] = "";
    }
  });

  return mapping;
}

export interface ImportRowResult {
  rowNumber: number;
  values: Partial<Record<ImportableField, string | number | null>>;
  errors: string[];
  warnings: string[];
}

export interface ImportPreview {
  rows: ImportRowResult[];
  validCount: number;
  errorCount: number;
  /** Fields present in the mapping, for the confirmation summary. */
  mappedFields: ImportableField[];
}

export interface BuildPreviewOptions {
  defaultCountry: string;
  defaultLanguage: string;
}

/**
 * Applies a column mapping to parsed CSV rows and reports, per row, exactly what
 * will be imported and what will be dropped.
 *
 * Unparseable numbers become `null` with a warning rather than 0 — an import
 * must never manufacture a metric.
 */
export function buildImportPreview(
  rows: string[][],
  mapping: ColumnMapping,
  options: BuildPreviewOptions,
): ImportPreview {
  const mappedFields = Object.values(mapping).filter(
    (field): field is ImportableField => field !== "",
  );

  const results: ImportRowResult[] = rows.map((row, rowIndex) => {
    const values: Partial<Record<ImportableField, string | number | null>> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [indexKey, field] of Object.entries(mapping)) {
      if (!field) continue;
      const raw = (row[Number(indexKey)] ?? "").trim();

      switch (field) {
        case "keyword":
        case "notes":
          values[field] = raw || null;
          break;
        case "country":
          values.country = raw ? raw.toUpperCase().slice(0, 8) : options.defaultCountry;
          break;
        case "language":
          values.language = raw ? raw.toLowerCase().slice(0, 8) : options.defaultLanguage;
          break;
        case "trend": {
          const normalized = raw.toUpperCase();
          if (!raw) {
            values.trend = "UNKNOWN";
          } else if ((TRENDS as readonly string[]).includes(normalized)) {
            values.trend = normalized as Trend;
          } else {
            values.trend = "UNKNOWN";
            warnings.push(`Trend "${raw}" is not recognised; imported as UNKNOWN.`);
          }
          break;
        }
        case "utilityType": {
          const normalized = raw.toUpperCase();
          if (!raw) {
            values.utilityType = null;
          } else if ((UTILITY_TYPES as readonly string[]).includes(normalized)) {
            values.utilityType = normalized as UtilityType;
          } else {
            values.utilityType = null;
            warnings.push(
              `Utility type "${raw}" is not recognised; left unset rather than guessed.`,
            );
          }
          break;
        }
        default: {
          const parsed = parseNumeric(raw);
          if (raw && parsed === null) {
            warnings.push(
              `${FIELD_LABELS[field]}: "${raw}" is not a number; imported as unknown.`,
            );
          }
          if (parsed !== null && isScoreField(field) && (parsed < 0 || parsed > 100)) {
            warnings.push(
              `${FIELD_LABELS[field]}: ${parsed} is outside 0-100 and was clamped.`,
            );
            values[field] = Math.min(100, Math.max(0, parsed));
          } else {
            values[field] = parsed;
          }
        }
      }
    }

    if (!values.keyword) {
      errors.push("Keyword is empty — this row will be skipped.");
    }

    return { rowNumber: rowIndex + 2, values, errors, warnings };
  });

  return {
    rows: results,
    validCount: results.filter((r) => r.errors.length === 0).length,
    errorCount: results.filter((r) => r.errors.length > 0).length,
    mappedFields,
  };
}

function isScoreField(field: ImportableField): boolean {
  return field.endsWith("Score");
}

/**
 * Parses a numeric cell tolerantly: strips currency symbols, thousands
 * separators and stray whitespace, and understands `1.2K` / `3M` shorthand.
 * Returns null for anything it cannot read — never a fallback zero.
 */
export function parseNumeric(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\s ]/g, "")
    .replace(/[$€£¥]/g, "")
    .replace(/%/g, "");
  if (!cleaned) return null;

  const shorthand = /^(-?[\d.,]+)([kKmM])$/.exec(cleaned);
  if (shorthand) {
    const base = toNumber(shorthand[1]);
    if (base === null) return null;
    return shorthand[2].toLowerCase() === "k" ? base * 1_000 : base * 1_000_000;
  }

  return toNumber(cleaned);
}

function toNumber(value: string): number | null {
  // Treat "1,234" as thousands and "1,23" as a decimal comma.
  let normalized = value;
  if (/,\d{3}(\D|$)/.test(normalized) || /\d,\d{3}$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else if (normalized.includes(",") && !normalized.includes(".")) {
    normalized = normalized.replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
