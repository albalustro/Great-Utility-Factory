export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * Minimal RFC 4180 CSV parser.
 *
 * Handles quoted fields, escaped quotes, embedded newlines and both CRLF and LF
 * line endings. Written by hand rather than pulled in as a dependency because
 * keyword-tool exports are small and the failure modes need to be predictable.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Drop trailing blank lines rather than importing empty opportunities.
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  if (field !== "" || row.length > 0) pushRow();

  const [headers = [], ...body] = rows;
  return {
    headers: headers.map((h) => h.trim()),
    rows: body,
  };
}

/** Detects the delimiter so tab- and semicolon-separated exports also work. */
export function normalizeDelimiter(input: string): string {
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const counts = {
    ",": (firstLine.match(/,/g) ?? []).length,
    ";": (firstLine.match(/;/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
  };
  const winner = (Object.entries(counts) as Array<[string, number]>).sort(
    (a, b) => b[1] - a[1],
  )[0];
  if (!winner || winner[0] === "," || winner[1] === 0) return input;
  // Re-quote-aware swap: only replace delimiters outside quoted sections.
  let out = "";
  let inQuotes = false;
  for (const char of input) {
    if (char === '"') inQuotes = !inQuotes;
    out += !inQuotes && char === winner[0] ? "," : char;
  }
  return out;
}
