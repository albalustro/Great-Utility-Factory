import { describe, expect, it } from "vitest";

import {
  buildImportPreview,
  parseNumeric,
  suggestMapping,
  type ColumnMapping,
} from "@/lib/csv/import";
import { normalizeDelimiter, parseCsv } from "@/lib/csv/parse";

const DEFAULTS = { defaultCountry: "US", defaultLanguage: "en" };

describe("parseCsv", () => {
  it("parses a simple file", () => {
    const { headers, rows } = parseCsv("keyword,volume\nfoo,100\nbar,200\n");
    expect(headers).toEqual(["keyword", "volume"]);
    expect(rows).toEqual([
      ["foo", "100"],
      ["bar", "200"],
    ]);
  });

  it("handles quoted fields, escaped quotes and embedded commas", () => {
    const { rows } = parseCsv('keyword,notes\n"a, b","he said ""hi"""\n');
    expect(rows[0]).toEqual(["a, b", 'he said "hi"']);
  });

  it("handles embedded newlines inside quotes", () => {
    const { rows } = parseCsv('keyword,notes\n"multi","line one\nline two"\n');
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("line one\nline two");
  });

  it("handles CRLF line endings and a UTF-8 BOM", () => {
    const { headers, rows } = parseCsv("﻿keyword,volume\r\nfoo,10\r\n");
    expect(headers).toEqual(["keyword", "volume"]);
    expect(rows).toEqual([["foo", "10"]]);
  });

  it("drops trailing blank lines", () => {
    const { rows } = parseCsv("keyword\nfoo\n\n\n");
    expect(rows).toEqual([["foo"]]);
  });

  it("converts tab and semicolon delimited files", () => {
    expect(parseCsv(normalizeDelimiter("a\tb\n1\t2\n")).headers).toEqual(["a", "b"]);
    expect(parseCsv(normalizeDelimiter("a;b\n1;2\n")).headers).toEqual(["a", "b"]);
  });

  it("does not rewrite delimiters inside quoted fields", () => {
    const { rows } = parseCsv(normalizeDelimiter('a;b\n"x;y";2\n'));
    expect(rows[0]).toEqual(["x;y", "2"]);
  });
});

describe("parseNumeric", () => {
  it("returns null for anything unreadable rather than defaulting to zero", () => {
    expect(parseNumeric("")).toBeNull();
    expect(parseNumeric("n/a")).toBeNull();
    expect(parseNumeric("—")).toBeNull();
  });

  it("strips currency symbols and thousands separators", () => {
    expect(parseNumeric("$1,234")).toBe(1234);
    expect(parseNumeric("€2.50")).toBe(2.5);
    expect(parseNumeric("12 300")).toBe(12300);
  });

  it("understands K and M shorthand", () => {
    expect(parseNumeric("1.2K")).toBe(1200);
    expect(parseNumeric("3M")).toBe(3_000_000);
  });

  it("reads a decimal comma", () => {
    expect(parseNumeric("1,5")).toBe(1.5);
  });

  it("preserves a genuine zero", () => {
    expect(parseNumeric("0")).toBe(0);
  });
});

describe("suggestMapping", () => {
  it("recognises common export headers", () => {
    const mapping = suggestMapping([
      "Keyword",
      "Avg. monthly searches",
      "Difficulty",
      "CPC",
      "Nonsense column",
    ]);

    expect(mapping[0]).toBe("keyword");
    expect(mapping[1]).toBe("searchVolume");
    expect(mapping[2]).toBe("keywordDifficulty");
    expect(mapping[3]).toBe("cpc");
    expect(mapping[4]).toBe("");
  });

  it("never maps two columns to the same field", () => {
    const mapping = suggestMapping(["keyword", "query", "term"]);
    const assigned = Object.values(mapping).filter(Boolean);
    expect(new Set(assigned).size).toBe(assigned.length);
  });
});

describe("buildImportPreview", () => {
  const mapping: ColumnMapping = {
    0: "keyword",
    1: "searchVolume",
    2: "cpc",
    3: "utilityType",
  };

  it("marks rows with no keyword as errors", () => {
    const preview = buildImportPreview(
      [
        ["dog age calculator", "74000", "0.42", "CALCULATOR"],
        ["", "500", "1.00", "CALCULATOR"],
      ],
      mapping,
      DEFAULTS,
    );

    expect(preview.validCount).toBe(1);
    expect(preview.errorCount).toBe(1);
    expect(preview.rows[1].errors[0]).toMatch(/keyword is empty/i);
  });

  it("imports unreadable numbers as unknown, with a warning — never as zero", () => {
    const preview = buildImportPreview(
      [["vat calculator", "n/a", "1.15", "CALCULATOR"]],
      mapping,
      DEFAULTS,
    );

    expect(preview.rows[0].values.searchVolume).toBeNull();
    expect(preview.rows[0].warnings[0]).toMatch(/not a number/i);
    expect(preview.rows[0].errors).toHaveLength(0);
  });

  it("leaves an unrecognised utility type unset rather than guessing", () => {
    const preview = buildImportPreview(
      [["thing", "100", "1", "WIDGET"]],
      mapping,
      DEFAULTS,
    );

    expect(preview.rows[0].values.utilityType).toBeNull();
    expect(preview.rows[0].warnings[0]).toMatch(/not recognised/i);
  });

  it("applies the operator defaults for country and language", () => {
    const preview = buildImportPreview(
      [["thing", "100", "1", "CALCULATOR"]],
      { ...mapping, 4: "country" },
      { defaultCountry: "GB", defaultLanguage: "en" },
    );
    expect(preview.rows[0].values.country).toBe("GB");
  });

  it("clamps out-of-range assessment scores and says so", () => {
    const preview = buildImportPreview(
      [["thing", "100", "1", "CALCULATOR", "180"]],
      { ...mapping, 4: "serpWeaknessScore" },
      DEFAULTS,
    );

    expect(preview.rows[0].values.serpWeaknessScore).toBe(100);
    expect(preview.rows[0].warnings[0]).toMatch(/clamped/i);
  });

  it("reports row numbers that match the spreadsheet", () => {
    const preview = buildImportPreview(
      [["a", "1", "1", "CALCULATOR"], ["b", "2", "2", "CALCULATOR"]],
      mapping,
      DEFAULTS,
    );
    // Row 1 is the header, so the first data row is row 2.
    expect(preview.rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });
});
