"use client";

import { useActionState, useState } from "react";
import { Download, Pencil, Plus, Trash2, X } from "lucide-react";

import { fetchSerpFromProviderAction } from "@/app/actions/provider";
import {
  applySuggestedWeaknessAction,
  deleteSerpResultAction,
  saveSerpResultAction,
} from "@/app/actions/serp";
import { PendingButton } from "@/components/action-button";
import { Metric } from "@/components/metric";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  PAGE_TYPES,
  SERP_ASSESSMENTS,
  SERP_ASSESSMENT_LABELS,
  type SerpResult,
} from "@/lib/domain/types";
import { formatDateTime, formatDecimal, humanizeToken } from "@/lib/format";
import type { ProviderStatus } from "@/lib/providers/types";
import { summarizeSerp } from "@/lib/scoring/serp";

const ASSESSMENT_VARIANT: Record<
  (typeof SERP_ASSESSMENTS)[number],
  "muted" | "warning" | "positive" | "danger"
> = {
  UNCLASSIFIED: "muted",
  POOR_INTENT_MATCH: "warning",
  WEAK_COMPETITOR: "positive",
  STRONG_COMPETITOR: "danger",
};

function triState(value: boolean | null): string {
  if (value === null) return "unknown";
  return value ? "yes" : "no";
}

export function SerpTab({
  opportunityId,
  results,
  storedWeakness,
  providerStatus,
}: {
  opportunityId: string;
  results: SerpResult[];
  storedWeakness: number | null;
  providerStatus: ProviderStatus;
}) {
  const [editing, setEditing] = useState<SerpResult | "new" | null>(null);
  const [applyState, applyAction] = useActionState(applySuggestedWeaknessAction, {});
  const [deleteState, deleteAction] = useActionState(deleteSerpResultAction, {});
  const [fetchState, fetchAction] = useActionState(fetchSerpFromProviderAction, {});

  const summary = summarizeSerp(results);
  const fetched = results.find((result) => result.fetchedAt !== null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>SERP summary</CardTitle>
            <CardDescription>
              Counts of what has actually been recorded. Unreviewed results are
              reported as unknown, never counted as weak.
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Stored weakness
            </div>
            <div className="tabular font-mono text-2xl font-semibold leading-tight">
              {storedWeakness === null ? "—" : storedWeakness}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Results captured" value={String(summary.resultCount)} />
            <Metric
              label="Low authority"
              value={String(summary.lowAuthorityCount)}
              hint="Results explicitly marked low authority. Unknown results are excluded."
            />
            <Metric
              label="Apparently new"
              value={String(summary.newSiteCount)}
              hint="Results explicitly marked as new sites."
            />
            <Metric label="Utilities" value={String(summary.utilityCount)} />
            <Metric label="Articles" value={String(summary.articleCount)} />
            <Metric
              label="Authority unknown"
              value={String(summary.unknownAuthorityCount)}
              hint="Results with no authority data at all. These are not evidence of weakness."
            />
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs leading-relaxed">{summary.explanation}</p>

            {summary.signals.length ? (
              <ul className="mt-2 space-y-1">
                {summary.signals.map((signal) => (
                  <li key={signal.label} className="flex items-start gap-2 text-[11px]">
                    <span
                      className={`tabular w-10 shrink-0 text-right font-mono font-semibold ${
                        signal.points > 0
                          ? "text-[var(--positive)]"
                          : "text-[var(--danger)]"
                      }`}
                    >
                      {signal.points > 0 ? "+" : ""}
                      {signal.points}
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{signal.label}</span>{" "}
                      — {signal.detail}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {summary.suggestedWeaknessScore !== null ? (
              <form action={applyAction} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="opportunityId" value={opportunityId} />
                <PendingButton size="sm" variant="outline">
                  Set SERP weakness to {summary.suggestedWeaknessScore}
                </PendingButton>
                <span className="text-[11px] text-muted-foreground">
                  Applies the suggestion to the score. You can still edit it by hand.
                </span>
              </form>
            ) : null}

            {applyState.error ? (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>{applyState.error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Top 10 results</CardTitle>
            <CardDescription>
              Record what you see. Leave authority fields as unknown unless you have
              real data.
              {fetched?.fetchedAt
                ? ` Last fetched from ${fetched.provider ?? "a provider"} on ${formatDateTime(fetched.fetchedAt)}.`
                : ""}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {providerStatus.configured ? (
              <form action={fetchAction}>
                <input type="hidden" name="opportunityId" value={opportunityId} />
                <PendingButton size="sm" variant="outline">
                  <Download className="size-4" />
                  Fetch top 10
                </PendingButton>
              </form>
            ) : null}
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Add result
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {providerStatus.configured ? (
            <p className="text-[11px] text-muted-foreground">
              Fetching replaces previously fetched rows and leaves rows you added by
              hand alone. Authority, page type and your assessment are never supplied
              by the provider — where you have already judged a domain, that judgement
              is carried onto the new row.
            </p>
          ) : null}

          {fetchState.error ? (
            <Alert variant="destructive">
              <AlertDescription>{fetchState.error}</AlertDescription>
            </Alert>
          ) : null}

          {fetchState.ok && fetchState.message ? (
            <Alert variant="info">
              <AlertDescription>{fetchState.message}</AlertDescription>
            </Alert>
          ) : null}

          {editing ? (
            <SerpForm
              opportunityId={opportunityId}
              result={editing === "new" ? undefined : editing}
              nextPosition={results.length + 1}
              onClose={() => setEditing(null)}
            />
          ) : null}

          {results.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No SERP results captured. Until they are, SERP weakness — the
              highest-weighted factor — cannot be assessed from evidence.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Page type</TableHead>
                  <TableHead className="text-right">DA</TableHead>
                  <TableHead>Low auth</TableHead>
                  <TableHead>New site</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="tabular font-mono text-xs">
                      {result.position}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[16rem] truncate text-sm">
                        {result.url ? (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="hover:underline"
                          >
                            {result.domain}
                          </a>
                        ) : (
                          result.domain
                        )}
                      </div>
                      {result.title ? (
                        <div className="max-w-[16rem] truncate text-[11px] text-muted-foreground">
                          {result.title}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {humanizeToken(result.pageType)}
                    </TableCell>
                    <TableCell className="tabular text-right font-mono text-xs">
                      {formatDecimal(result.domainAuthority, 0)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {triState(result.isLowAuthority)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {triState(result.isNewSite)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ASSESSMENT_VARIANT[result.assessment]}>
                        {SERP_ASSESSMENT_LABELS[result.assessment]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {result.source === "PROVIDER"
                        ? (result.provider ?? "provider")
                        : "manual"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Edit result"
                          onClick={() => setEditing(result)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={result.id} />
                          <input
                            type="hidden"
                            name="opportunityId"
                            value={opportunityId}
                          />
                          <Button
                            type="submit"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Delete result"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {deleteState.error ? (
            <Alert variant="destructive">
              <AlertDescription>{deleteState.error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SerpForm({
  opportunityId,
  result,
  nextPosition,
  onClose,
}: {
  opportunityId: string;
  result?: SerpResult;
  nextPosition: number;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(saveSerpResultAction, {});

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-md border border-border bg-muted/20 p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">
          {result ? `Edit result #${result.position}` : "New SERP result"}
        </p>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      <input type="hidden" name="opportunityId" value={opportunityId} />
      {result ? <input type="hidden" name="id" value={result.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Position</Label>
          <Input
            name="position"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={result?.position ?? nextPosition}
          />
        </div>

        <div className="space-y-1 lg:col-span-2">
          <Label>Domain</Label>
          <Input
            name="domain"
            required
            defaultValue={result?.domain}
            placeholder="example.com"
          />
        </div>

        <div className="space-y-1">
          <Label>Page type</Label>
          <select
            name="pageType"
            defaultValue={result?.pageType ?? "OTHER"}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
          >
            {PAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {humanizeToken(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 lg:col-span-2">
          <Label>URL</Label>
          <Input name="url" defaultValue={result?.url ?? ""} placeholder="https://…" />
        </div>

        <div className="space-y-1 lg:col-span-2">
          <Label>Title</Label>
          <Input name="title" defaultValue={result?.title ?? ""} />
        </div>

        <div className="space-y-1">
          <Label>Domain authority</Label>
          <Input
            name="domainAuthority"
            type="number"
            min={0}
            max={100}
            defaultValue={result?.domainAuthority ?? ""}
            placeholder="unknown"
          />
        </div>

        <div className="space-y-1">
          <Label>Low authority?</Label>
          <select
            name="isLowAuthority"
            defaultValue={
              result?.isLowAuthority === null || result?.isLowAuthority === undefined
                ? "unknown"
                : String(result.isLowAuthority)
            }
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
          >
            <option value="unknown">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label>Apparently new site?</Label>
          <select
            name="isNewSite"
            defaultValue={
              result?.isNewSite === null || result?.isNewSite === undefined
                ? "unknown"
                : String(result.isNewSite)
            }
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
          >
            <option value="unknown">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label>Assessment</Label>
          <select
            name="assessment"
            defaultValue={result?.assessment ?? "UNCLASSIFIED"}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
          >
            {SERP_ASSESSMENTS.map((assessment) => (
              <option key={assessment} value={assessment}>
                {SERP_ASSESSMENT_LABELS[assessment]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea
          name="notes"
          rows={2}
          defaultValue={result?.notes ?? ""}
          placeholder="What did you notice about this result?"
        />
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <PendingButton size="sm">{result ? "Save result" : "Add result"}</PendingButton>
      </div>
    </form>
  );
}
