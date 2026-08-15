"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";

import { moveOpportunityAction } from "@/app/actions/opportunities";
import { DemoBadge } from "@/components/badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  type DecisionThresholds,
  type Opportunity,
  type OpportunityStatus,
} from "@/lib/domain/types";
import { formatAge, formatDecimal, formatInt } from "@/lib/format";
import { decisionForScore } from "@/lib/scoring/engine";
import { cn } from "@/lib/utils";

/**
 * Kanban pipeline.
 *
 * Uses the native HTML5 drag-and-drop API rather than a drag library: the
 * interaction is simple enough that a dependency would cost more than it saves,
 * and the column drop targets stay keyboard-reachable through the per-card
 * status select as a fallback.
 */
export function PipelineBoard({
  opportunities,
  thresholds,
}: {
  opportunities: Opportunity[];
  thresholds: DecisionThresholds;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [items, moveItem] = useOptimistic(
    opportunities,
    (state: Opportunity[], move: { id: string; status: OpportunityStatus }) =>
      state.map((item) =>
        item.id === move.id
          ? { ...item, status: move.status, statusChangedAt: new Date().toISOString() }
          : item,
      ),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<OpportunityStatus | null>(null);

  function move(id: string, status: OpportunityStatus) {
    const current = items.find((item) => item.id === id);
    if (!current || current.status === status) return;

    setError(null);
    startTransition(async () => {
      moveItem({ id, status });
      const result = await moveOpportunityAction(id, status);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
        {OPPORTUNITY_STATUSES.map((status) => {
          const columnItems = items
            .filter((item) => item.status === status)
            .sort((a, b) => b.opportunityScore - a.opportunityScore);

          return (
            <section
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                setOverColumn(status);
              }}
              onDragLeave={() => setOverColumn((c) => (c === status ? null : c))}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain") || draggingId;
                setOverColumn(null);
                setDraggingId(null);
                if (id) move(id, status);
              }}
              className={cn(
                "flex w-64 shrink-0 flex-col rounded-lg border border-border bg-muted/30 transition-colors",
                overColumn === status && "border-primary bg-accent",
              )}
            >
              <header className="flex items-center justify-between border-b border-border px-3 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider">
                  {OPPORTUNITY_STATUS_LABELS[status]}
                </h2>
                <Badge variant="muted">{columnItems.length}</Badge>
              </header>

              <div className="flex-1 space-y-2 p-2">
                {columnItems.length === 0 ? (
                  <p className="py-6 text-center text-[11px] text-muted-foreground">
                    Empty
                  </p>
                ) : (
                  columnItems.map((item) => (
                    <article
                      key={item.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", item.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(item.id);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={cn(
                        "group cursor-grab rounded-md border border-border bg-card p-2.5 shadow-sm transition-opacity active:cursor-grabbing",
                        draggingId === item.id && "opacity-40",
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-start justify-between gap-1.5">
                            <Link
                              href={`/opportunities/${item.id}`}
                              className="line-clamp-2 text-xs font-medium hover:underline"
                            >
                              {item.keyword}
                            </Link>
                            <span className="tabular shrink-0 font-mono text-xs font-semibold">
                              {item.opportunityScore}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1">
                            {item.isDemo ? <DemoBadge /> : null}
                            <Badge
                              variant={
                                decisionForScore(item.opportunityScore, thresholds) ===
                                "BUILD"
                                  ? "positive"
                                  : "muted"
                              }
                            >
                              {decisionForScore(item.opportunityScore, thresholds)}
                            </Badge>
                          </div>

                          <dl className="grid grid-cols-2 gap-x-2 text-[10px] text-muted-foreground">
                            <div className="flex justify-between">
                              <dt>Vol</dt>
                              <dd className="tabular font-mono">
                                {formatInt(item.searchVolume)}
                              </dd>
                            </div>
                            <div className="flex justify-between">
                              <dt>SERP</dt>
                              <dd className="tabular font-mono">
                                {formatDecimal(item.serpWeaknessScore, 0)}
                              </dd>
                            </div>
                            <div className="col-span-2 flex justify-between">
                              <dt>In state</dt>
                              <dd className="tabular font-mono">
                                {formatAge(item.statusChangedAt)}
                              </dd>
                            </div>
                          </dl>

                          <select
                            aria-label={`Move ${item.keyword} to another status`}
                            value={item.status}
                            onChange={(event) =>
                              move(item.id, event.target.value as OpportunityStatus)
                            }
                            className="h-6 w-full rounded border border-input bg-card px-1 text-[10px]"
                          >
                            {OPPORTUNITY_STATUSES.map((option) => (
                              <option key={option} value={option}>
                                {OPPORTUNITY_STATUS_LABELS[option]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
