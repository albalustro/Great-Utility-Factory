"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { CheckCircle2, Search } from "lucide-react";

import {
  importResearchCandidatesAction,
  researchKeywordsAction,
  type ResearchCandidate,
  type ResearchState,
} from "@/app/actions/research";
import { Value } from "@/components/metric";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InfoTip } from "@/components/ui/tooltip";
import { formatCurrency, formatInt } from "@/lib/format";

type SortKey = "searchVolume" | "keyword" | "cpc" | "competitionIndex" | "keywordDifficulty";

const SUGGESTED_SEEDS = [
  "calculator",
  "generator",
  "converter",
  "checker",
  "estimator",
];

function SearchButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Search className="size-4" />
      {pending ? "Querying provider…" : label}
    </Button>
  );
}

function ImportButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending
        ? "Importing…"
        : `Import ${count} selected keyword${count === 1 ? "" : "s"}`}
    </Button>
  );
}

/**
 * Seed keywords → provider candidates → review → import.
 *
 * The review table is the point of this screen. Candidates arrive with real
 * numbers or explicit blanks, and nothing is written to Opportunities until the
 * operator ticks it. Keywords already tracked are shown but cannot be selected,
 * so a second research run does not quietly duplicate the first.
 */
export function KeywordResearch({
  defaultCountry,
  defaultLanguage,
  currency,
  supportsExpansion,
  providerConfigured,
  providerLabel,
  providerDetail,
}: {
  defaultCountry: string;
  defaultLanguage: string;
  currency: string;
  supportsExpansion: boolean;
  providerConfigured: boolean;
  providerLabel: string;
  providerDetail: string;
}) {
  const [search, searchAction] = useActionState<ResearchState, FormData>(
    researchKeywordsAction,
    {},
  );
  const [imported, importAction] = useActionState<ResearchState, FormData>(
    importResearchCandidatesAction,
    {},
  );

  const candidates = useMemo(() => search.candidates ?? [], [search.candidates]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("searchVolume");

  // A new result set invalidates the old selection entirely. Adjusted during
  // render rather than in an effect, so the table never paints one frame with
  // ticks belonging to the previous search. `fetchedAt` identifies each run.
  const [lastRun, setLastRun] = useState(search.fetchedAt);
  if (search.fetchedAt !== lastRun) {
    setLastRun(search.fetchedAt);
    setSelected(new Set());
  }

  const importable = useMemo(
    () => candidates.filter((c) => c.existingOpportunityId === null),
    [candidates],
  );

  const sorted = useMemo(() => {
    const copy = [...candidates];
    copy.sort((a, b) => {
      if (sort === "keyword") return a.keyword.localeCompare(b.keyword);
      const left = a[sort];
      const right = b[sort];
      // Unknowns sink to the bottom rather than sorting as zero.
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return right - left;
    });
    return copy;
  }, [candidates, sort]);

  const payload = useMemo(() => {
    if (!search.provider || !search.fetchedAt || !search.country || !search.language) {
      return "";
    }
    const chosen = importable.filter((c) => selected.has(c.keyword));
    if (chosen.length === 0) return "";
    return JSON.stringify({
      country: search.country,
      language: search.language,
      provider: search.provider,
      fetchedAt: search.fetchedAt,
      candidates: chosen.map((c) => ({
        keyword: c.keyword,
        searchVolume: c.searchVolume,
        keywordDifficulty: c.keywordDifficulty,
        cpc: c.cpc,
        competitionIndex: c.competitionIndex,
        competitionLevel: c.competitionLevel,
        trend: c.trend,
      })),
    });
  }, [importable, selected, search]);

  const toggle = (keyword: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });

  const allSelected = importable.length > 0 && selected.size === importable.length;

  return (
    <div className="space-y-4">
      {!providerConfigured ? (
        <Alert variant="warning">
          <AlertTitle className="text-xs">No keyword provider is connected</AlertTitle>
          <AlertDescription>
            {providerDetail} Until then, add keywords by hand or import a CSV export.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>1 · Seed keywords</CardTitle>
          <CardDescription>
            One per line, or comma-separated. Up to 20 seeds per search.
            {supportsExpansion
              ? " Expansion asks the provider for related keywords; lookup prices exactly what you type."
              : " This provider cannot discover new keywords, so it will price exactly what you type."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={searchAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="seeds">Seeds</Label>
              <Textarea
                id="seeds"
                name="seeds"
                rows={4}
                placeholder={SUGGESTED_SEEDS.join("\n")}
                defaultValue=""
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Common starting points: {SUGGESTED_SEEDS.join(", ")}.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  defaultValue={defaultCountry}
                  maxLength={8}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  name="language"
                  defaultValue={defaultLanguage}
                  maxLength={8}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="limit">Max results</Label>
                <Input
                  id="limit"
                  name="limit"
                  type="number"
                  min={1}
                  max={200}
                  defaultValue={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mode">Mode</Label>
                <select
                  id="mode"
                  name="mode"
                  defaultValue={supportsExpansion ? "EXPAND" : "LOOKUP"}
                  disabled={!supportsExpansion}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm disabled:opacity-50"
                >
                  <option value="EXPAND">Expand seeds</option>
                  <option value="LOOKUP">Look up as typed</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Queries {providerLabel} and consumes provider credits.
              </p>
              <SearchButton label={supportsExpansion ? "Find keywords" : "Fetch metrics"} />
            </div>
          </form>

          {search.error ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{search.error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {candidates.length > 0 ? (
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>2 · Review candidates</CardTitle>
              <CardDescription>
                {search.message} Blank cells mean the provider had no data for that
                field — they are never filled in with zero.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="sort" className="text-[11px] text-muted-foreground">
                Sort
              </Label>
              <select
                id="sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-8 rounded-md border border-input bg-card px-2 text-xs shadow-sm"
              >
                <option value="searchVolume">Search volume</option>
                <option value="cpc">CPC</option>
                <option value="competitionIndex">Ad competition</option>
                <option value="keywordDifficulty">Keyword difficulty</option>
                <option value="keyword">Keyword (A–Z)</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={importable.length === 0}
                onClick={() =>
                  setSelected(
                    allSelected ? new Set() : new Set(importable.map((c) => c.keyword)),
                  )
                }
              >
                {allSelected ? "Clear selection" : `Select all ${importable.length} new`}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                {selected.size} selected · {candidates.length - importable.length} already
                tracked
              </p>
            </div>

            <div className="max-h-[32rem] overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="min-w-[16rem]">Keyword</TableHead>
                    <TableHead className="text-right">Volume/mo</TableHead>
                    <TableHead className="text-right">
                      <InfoTip label="Demand factor only, from search volume. Not the opportunity score — that needs your SERP and fit assessments.">
                        Demand
                      </InfoTip>
                    </TableHead>
                    <TableHead className="text-right">CPC</TableHead>
                    <TableHead className="text-right">
                      <InfoTip label="Google Ads advertiser competition, 0-100. This is NOT organic ranking difficulty.">
                        Ad comp.
                      </InfoTip>
                    </TableHead>
                    <TableHead className="text-right">
                      <InfoTip label="Organic keyword difficulty, when the provider supplied one.">
                        KD
                      </InfoTip>
                    </TableHead>
                    <TableHead>
                      <InfoTip label="Derived from the provider's monthly search history. UNKNOWN when there is less than a year of data.">
                        Trend
                      </InfoTip>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {sorted.map((candidate) => (
                    <CandidateRow
                      key={candidate.keyword}
                      candidate={candidate}
                      currency={currency}
                      checked={selected.has(candidate.keyword)}
                      onToggle={() => toggle(candidate.keyword)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {imported.error ? (
              <Alert variant="destructive">
                <AlertDescription>{imported.error}</AlertDescription>
              </Alert>
            ) : null}

            {imported.ok && imported.message ? (
              <Alert variant="info">
                <CheckCircle2 />
                <AlertDescription>
                  {imported.message}{" "}
                  <Link href="/opportunities" className="underline">
                    Open the explorer
                  </Link>
                  .
                </AlertDescription>
              </Alert>
            ) : null}

            <form action={importAction} className="flex justify-end">
              <input type="hidden" name="payload" value={payload} />
              <ImportButton count={selected.size} />
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function CandidateRow({
  candidate,
  currency,
  checked,
  onToggle,
}: {
  candidate: ResearchCandidate;
  currency: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const tracked = candidate.existingOpportunityId !== null;

  return (
    <TableRow className={tracked ? "opacity-60" : undefined}>
      <TableCell>
        <input
          type="checkbox"
          checked={checked}
          disabled={tracked}
          onChange={onToggle}
          aria-label={`Select ${candidate.keyword}`}
          className="size-4 accent-[var(--primary)]"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm">{candidate.keyword}</span>
          {tracked ? (
            <Link
              href={`/opportunities/${candidate.existingOpportunityId}`}
              className="shrink-0"
            >
              <Badge variant="outline">Tracked</Badge>
            </Link>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Value unknown={candidate.searchVolume === null}>
          {formatInt(candidate.searchVolume)}
        </Value>
      </TableCell>
      <TableCell className="text-right">
        <Value unknown={candidate.demandScore === null}>
          {candidate.demandScore === null ? "—" : `${candidate.demandScore}`}
        </Value>
      </TableCell>
      <TableCell className="text-right">
        <Value unknown={candidate.cpc === null}>
          {formatCurrency(candidate.cpc, currency)}
        </Value>
      </TableCell>
      <TableCell className="text-right">
        <Value unknown={candidate.competitionIndex === null}>
          {candidate.competitionIndex === null
            ? "—"
            : `${candidate.competitionIndex}${
                candidate.competitionLevel ? ` (${candidate.competitionLevel})` : ""
              }`}
        </Value>
      </TableCell>
      <TableCell className="text-right">
        <Value unknown={candidate.keywordDifficulty === null}>
          {candidate.keywordDifficulty === null ? "—" : `${candidate.keywordDifficulty}`}
        </Value>
      </TableCell>
      <TableCell>
        <span
          className={`text-xs ${
            candidate.trend === "UNKNOWN" ? "text-muted-foreground" : ""
          }`}
        >
          {candidate.trend === "UNKNOWN" ? "—" : candidate.trend}
        </span>
      </TableCell>
    </TableRow>
  );
}
