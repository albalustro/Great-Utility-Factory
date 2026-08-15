import { Suspense } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";

import { OpportunityFiltersBar } from "@/components/opportunities/filters";
import {
  OpportunityTable,
  sortOpportunities,
  type SortKey,
} from "@/components/opportunities/table";
import { EmptyState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { getDataContext } from "@/lib/data";
import { opportunityFilterSchema } from "@/lib/domain/schemas";
import type { Decision, OpportunityFilters } from "@/lib/domain/types";
import { decisionForScore } from "@/lib/scoring/engine";

const DEFAULT_SORT: SortKey = "opportunityScore";

export default async function OpportunitiesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await props.searchParams;
  const key = new URLSearchParams(
    Object.entries(rawParams).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  ).toString();

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Opportunity explorer</h1>
          <p className="text-xs text-muted-foreground">
            Every keyword in the factory, and what the evidence says about it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/opportunities/import">
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/opportunities/new">
              <Plus className="size-4" />
              New opportunity
            </Link>
          </Button>
        </div>
      </header>

      {/* Local boundary: a segment-level loading.tsx would also wrap
          /opportunities/[id] and stop a missing record returning a real 404. */}
      <Suspense key={key} fallback={<TableSkeleton rows={10} />}>
        <ExplorerBody rawParams={rawParams} />
      </Suspense>
    </div>
  );
}

async function ExplorerBody({
  rawParams,
}: {
  rawParams: Record<string, string | string[] | undefined>;
}) {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string" && value !== "") flat[key] = value;
  }

  const parsed = opportunityFilterSchema.safeParse(flat);
  const query = parsed.success ? parsed.data : {};

  const { store, settings } = await getDataContext();

  const filters: OpportunityFilters = {
    keyword: query.keyword,
    country: query.country,
    language: query.language,
    minSearchVolume: query.minSearchVolume,
    maxKeywordDifficulty: query.maxKeywordDifficulty,
    minCpc: query.minCpc,
    minSerpWeakness: query.minSerpWeakness,
    minOpportunityScore: query.minOpportunityScore,
    status: query.status,
    utilityType: query.utilityType,
    clusterId: query.clusterId,
  };

  const [all, filtered] = await Promise.all([
    store.listOpportunities(),
    store.listOpportunities(filters),
  ]);

  // Decision is derived rather than stored, so it is filtered after scoring.
  const decisionFilter = query.decision as Decision[] | undefined;
  const visible = decisionFilter?.length
    ? filtered.filter((o) =>
        decisionFilter.includes(decisionForScore(o.opportunityScore, settings.thresholds)),
      )
    : filtered;

  const sort = (query.sort as SortKey) ?? DEFAULT_SORT;
  const dir = query.dir ?? "desc";
  const sorted = sortOpportunities(visible, sort, dir);

  const countries = [...new Set(all.map((o) => o.country))].sort();
  const languages = [...new Set(all.map((o) => o.language))].sort();

  const searchParams = new URLSearchParams(flat);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {sorted.length} of {all.length} opportunities
        {sorted.length !== all.length ? " match the current filters" : ""}.
      </p>

      <OpportunityFiltersBar countries={countries} languages={languages} />

      {sorted.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? "No opportunities yet" : "No opportunities match"}
          description={
            all.length === 0
              ? "Add a keyword by hand, or import a keyword-tool export and map the columns."
              : "Loosen the filters, or clear them to see everything again."
          }
          action={
            all.length === 0 ? (
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/opportunities/import">Import CSV</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/opportunities/new">New opportunity</Link>
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <OpportunityTable
          opportunities={sorted}
          thresholds={settings.thresholds}
          currency={settings.currency}
          searchParams={searchParams}
          sort={sort}
          dir={dir}
        />
      )}
    </div>
  );
}
