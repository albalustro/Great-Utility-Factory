import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { DecisionBadge, DemoBadge, StatusBadge } from "@/components/badges";
import { ScorePill } from "@/components/score";
import { Value } from "@/components/metric";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InfoTip } from "@/components/ui/tooltip";
import type { DecisionThresholds, Opportunity } from "@/lib/domain/types";
import { formatCurrency, formatDecimal, formatInt, humanizeToken } from "@/lib/format";
import { decisionForScore } from "@/lib/scoring/engine";
import { cn } from "@/lib/utils";

export const SORTABLE_COLUMNS = {
  keyword: "Keyword",
  searchVolume: "Volume",
  keywordDifficulty: "KD",
  cpc: "CPC",
  serpWeaknessScore: "SERP weakness",
  utilityFitScore: "Utility fit",
  opportunityScore: "Score",
  createdAt: "Added",
} as const;

export type SortKey = keyof typeof SORTABLE_COLUMNS;

const METRIC_HINTS: Partial<Record<SortKey | "status" | "decision" | "country", string>> = {
  searchVolume:
    "Monthly search volume as supplied by you or a keyword provider. A dash means no volume has been recorded.",
  keywordDifficulty:
    "Third-party difficulty estimate, 0-100. Lower is easier. A dash means it was never recorded.",
  cpc: "Cost per click from the source data. Used as a proxy for commercial value.",
  serpWeaknessScore:
    "Your assessment of how vulnerable the SERP is, 0-100. Derived from the SERP tab evidence, but stored as your judgement.",
  utilityFitScore:
    "How completely a simple web utility can satisfy this query, 0-100.",
  opportunityScore:
    "Weighted total across all seven factors. Unscored factors contribute zero, so the total is a lower bound.",
  decision:
    "Derived from the opportunity score using the thresholds in Settings.",
};

function sortHref(
  params: URLSearchParams,
  key: SortKey,
  currentSort: SortKey,
  currentDir: "asc" | "desc",
): string {
  const next = new URLSearchParams(params.toString());
  const dir = currentSort === key && currentDir === "desc" ? "asc" : "desc";
  next.set("sort", key);
  next.set("dir", dir);
  return `/opportunities?${next.toString()}`;
}

export function OpportunityTable({
  opportunities,
  thresholds,
  currency,
  searchParams,
  sort,
  dir,
}: {
  opportunities: Opportunity[];
  thresholds: DecisionThresholds;
  currency: string;
  searchParams: URLSearchParams;
  sort: SortKey;
  dir: "asc" | "desc";
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {(Object.keys(SORTABLE_COLUMNS) as SortKey[]).map((key) => {
              const numeric = key !== "keyword";
              const active = sort === key;
              const Icon = !active ? ArrowUpDown : dir === "desc" ? ArrowDown : ArrowUp;

              return (
                <TableHead
                  key={key}
                  className={cn(numeric && "text-right", key === "keyword" && "min-w-[16rem]")}
                >
                  <Link
                    href={sortHref(searchParams, key, sort, dir)}
                    scroll={false}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground",
                      active && "text-foreground",
                    )}
                  >
                    {METRIC_HINTS[key] ? (
                      <InfoTip label={METRIC_HINTS[key]}>{SORTABLE_COLUMNS[key]}</InfoTip>
                    ) : (
                      SORTABLE_COLUMNS[key]
                    )}
                    <Icon className="size-3" />
                  </Link>
                </TableHead>
              );
            })}
            <TableHead>Country</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <InfoTip label={METRIC_HINTS.decision}>Decision</InfoTip>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {opportunities.map((opportunity) => (
            <TableRow key={opportunity.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/opportunities/${opportunity.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {opportunity.keyword}
                  </Link>
                  {opportunity.isDemo ? <DemoBadge /> : null}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Value unknown={opportunity.searchVolume === null}>
                  {formatInt(opportunity.searchVolume)}
                </Value>
              </TableCell>
              <TableCell className="text-right">
                <Value unknown={opportunity.keywordDifficulty === null}>
                  {formatDecimal(opportunity.keywordDifficulty, 0)}
                </Value>
              </TableCell>
              <TableCell className="text-right">
                <Value unknown={opportunity.cpc === null}>
                  {formatCurrency(opportunity.cpc, currency)}
                </Value>
              </TableCell>
              <TableCell className="text-right">
                <Value unknown={opportunity.serpWeaknessScore === null}>
                  {formatDecimal(opportunity.serpWeaknessScore, 0)}
                </Value>
              </TableCell>
              <TableCell className="text-right">
                <Value unknown={opportunity.utilityFitScore === null}>
                  {formatDecimal(opportunity.utilityFitScore, 0)}
                </Value>
              </TableCell>
              <TableCell className="text-right">
                <ScorePill
                  score={opportunity.opportunityScore}
                  thresholds={thresholds}
                  showDecision={false}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                {new Date(opportunity.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </TableCell>
              <TableCell className="text-xs uppercase text-muted-foreground">
                {opportunity.country}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {opportunity.utilityType ? humanizeToken(opportunity.utilityType) : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge status={opportunity.status} />
              </TableCell>
              <TableCell>
                <DecisionBadge
                  decision={decisionForScore(opportunity.opportunityScore, thresholds)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Applies sorting with nulls always last, whichever direction is chosen. */
export function sortOpportunities(
  opportunities: Opportunity[],
  sort: SortKey,
  dir: "asc" | "desc",
): Opportunity[] {
  const factor = dir === "asc" ? 1 : -1;

  return [...opportunities].sort((a, b) => {
    if (sort === "keyword") {
      return a.keyword.localeCompare(b.keyword) * factor;
    }
    if (sort === "createdAt") {
      return a.createdAt.localeCompare(b.createdAt) * factor;
    }

    const left = a[sort] as number | null;
    const right = b[sort] as number | null;

    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * factor;
  });
}
