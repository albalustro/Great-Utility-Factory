import { AlertCircle, PencilLine } from "lucide-react";

import { DecisionBadge } from "@/components/badges";
import { ScoreBar } from "@/components/score";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ScoreBreakdown } from "@/lib/scoring/engine";
import { cn } from "@/lib/utils";

/**
 * The explainability surface for the opportunity score.
 *
 * Shows raw value, weighted contribution, and the reason for every factor —
 * including the factors that scored nothing, which is usually the most
 * actionable part of the whole screen.
 */
export function ScoreBreakdownCard({ breakdown }: { breakdown: ScoreBreakdown }) {
  const { thresholds } = breakdown;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Opportunity score</CardTitle>
          <CardDescription>
            Every factor, what it contributed, and why.
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="tabular font-mono text-3xl font-semibold leading-none">
              {breakdown.total}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              out of 100
            </div>
          </div>
          <DecisionBadge decision={breakdown.decision} className="text-xs" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {breakdown.completeness < 100 ? (
          <div className="flex gap-2 rounded-md border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3 py-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
            <div className="text-xs leading-relaxed">
              <p className="font-medium">
                {breakdown.completeness}% of the scoring weight is backed by data.
              </p>
              <p className="text-muted-foreground">
                Unscored factors contribute zero rather than being estimated, so{" "}
                {breakdown.total} is a lower bound. Missing:{" "}
                {breakdown.missingFactors.join(", ")}.
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {breakdown.factors.map((factor) => (
            <div key={factor.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{factor.label}</span>
                  {factor.overridden ? (
                    <Badge variant="warning" className="gap-1">
                      <PencilLine className="size-3" />
                      Overridden
                    </Badge>
                  ) : null}
                  {!factor.hasData ? <Badge variant="muted">No data</Badge> : null}
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "tabular font-mono text-sm",
                      !factor.hasData && "text-muted-foreground",
                    )}
                  >
                    {factor.weighted.toFixed(1)}
                    <span className="text-muted-foreground"> / {factor.weight}</span>
                  </span>
                  <span className="ml-2 text-[11px] tabular text-muted-foreground">
                    raw {factor.raw === null ? "—" : factor.raw}
                  </span>
                </div>
              </div>

              <ScoreBar
                value={factor.weighted}
                max={factor.weight}
                muted={!factor.hasData}
              />

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {factor.reason}
                {factor.evidence ? (
                  <span className="ml-1 text-foreground/70">· {factor.evidence}</span>
                ) : null}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Decision thresholds
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular">
            <span>
              <DecisionBadge decision="BUILD" /> {thresholds.build}–100
            </span>
            <span>
              <DecisionBadge decision="INVESTIGATE" /> {thresholds.investigate}–
              {thresholds.build - 1}
            </span>
            <span>
              <DecisionBadge decision="WATCH" /> {thresholds.watch}–
              {thresholds.investigate - 1}
            </span>
            <span>
              <DecisionBadge decision="REJECT" /> 0–{thresholds.watch - 1}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
