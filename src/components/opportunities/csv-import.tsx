"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, FileUp } from "lucide-react";

import { importOpportunitiesAction } from "@/app/actions/import";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FIELD_LABELS,
  IMPORTABLE_FIELDS,
  buildImportPreview,
  suggestMapping,
  type ColumnMapping,
  type ImportableField,
} from "@/lib/csv/import";
import { normalizeDelimiter, parseCsv } from "@/lib/csv/parse";

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending ? "Importing…" : `Import ${count} opportunit${count === 1 ? "y" : "ies"}`}
    </Button>
  );
}

/**
 * Three-step import: choose a file, map its columns, confirm.
 *
 * Parsing and mapping happen in the browser so the operator can see exactly what
 * will be created before anything is written. The server re-validates every row
 * regardless.
 */
export function CsvImport({
  defaultCountry,
  defaultLanguage,
}: {
  defaultCountry: string;
  defaultLanguage: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [state, formAction] = useActionState(importOpportunitiesAction, {});

  const preview = useMemo(() => {
    if (!headers.length) return null;
    return buildImportPreview(rows, mapping, { defaultCountry, defaultLanguage });
  }, [headers.length, rows, mapping, defaultCountry, defaultLanguage]);

  const payload = useMemo(() => {
    if (!preview) return "[]";
    return JSON.stringify(
      preview.rows.filter((row) => row.errors.length === 0).map((row) => row.values),
    );
  }, [preview]);

  async function handleFile(file: File) {
    setParseError(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(normalizeDelimiter(text));

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setParseError("That file has no header row or no data rows.");
        return;
      }

      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(suggestMapping(parsed.headers));
    } catch {
      setParseError("The file could not be read as CSV.");
    }
  }

  const mappedToKeyword = Object.values(mapping).includes("keyword");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1 · Choose a file</CardTitle>
          <CardDescription>
            Any CSV, TSV or semicolon-separated export. Nothing is uploaded until you
            confirm the mapping.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 transition-colors hover:bg-accent">
            <FileUp className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {fileName ?? "Select a keyword export"}
              </p>
              <p className="text-xs text-muted-foreground">
                {fileName
                  ? `${rows.length} data row(s), ${headers.length} column(s)`
                  : "Click to browse"}
              </p>
            </div>
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>

          {parseError ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {headers.length ? (
        <Card>
          <CardHeader>
            <CardTitle>2 · Map the columns</CardTitle>
            <CardDescription>
              Columns are matched automatically where the names are recognisable.
              Anything left unmapped is ignored — it is not guessed at.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {headers.map((header, index) => (
              <div
                key={`${header}-${index}`}
                className="grid grid-cols-1 items-center gap-2 sm:grid-cols-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{header || `Column ${index + 1}`}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    e.g. {rows[0]?.[index]?.slice(0, 40) || "(empty)"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <select
                    value={mapping[index] ?? ""}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [index]: event.target.value as ImportableField | "",
                      }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
                  >
                    <option value="">Ignore this column</option>
                    {IMPORTABLE_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {FIELD_LABELS[field]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {!mappedToKeyword ? (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle className="text-xs">Keyword column is required</AlertTitle>
                <AlertDescription>
                  Map one column to Keyword before importing.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {preview && mappedToKeyword ? (
        <Card>
          <CardHeader>
            <CardTitle>3 · Confirm</CardTitle>
            <CardDescription>
              {preview.validCount} row(s) will be imported
              {preview.errorCount > 0
                ? `, ${preview.errorCount} will be skipped`
                : ""}
              . Values that could not be read are imported as unknown, never as zero.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    {preview.mappedFields.map((field) => (
                      <TableHead key={field}>{FIELD_LABELS[field]}</TableHead>
                    ))}
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 50).map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.rowNumber}
                      </TableCell>
                      {preview.mappedFields.map((field) => (
                        <TableCell key={field} className="tabular text-xs">
                          {row.values[field] === null || row.values[field] === undefined
                            ? "—"
                            : String(row.values[field])}
                        </TableCell>
                      ))}
                      <TableCell className="space-y-0.5">
                        {row.errors.map((message) => (
                          <p key={message} className="text-[11px] text-[var(--danger)]">
                            {message}
                          </p>
                        ))}
                        {row.warnings.map((message) => (
                          <p key={message} className="text-[11px] text-[var(--warning)]">
                            {message}
                          </p>
                        ))}
                        {!row.errors.length && !row.warnings.length ? (
                          <Badge variant="positive">OK</Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {preview.rows.length > 50 ? (
              <p className="text-[11px] text-muted-foreground">
                Showing the first 50 rows. All {preview.validCount} valid rows will be
                imported.
              </p>
            ) : null}

            {state.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            {state.ok && state.message ? (
              <Alert variant="info">
                <CheckCircle2 />
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <form action={formAction} className="flex justify-end">
              <input type="hidden" name="payload" value={payload} />
              <SubmitButton count={preview.validCount} />
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
