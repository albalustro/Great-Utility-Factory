import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/tooltip";
import type { FunnelStage } from "@/lib/dashboard";

/**
 * The factory funnel.
 *
 * Bar width is relative to the widest stage, so the drop-off between stages is
 * visible at a glance rather than requiring the reader to compare numbers.
 */
export function FactoryFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Factory funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {stages.map((stage, index) => {
          const previous = stages[index - 1];
          const conversion =
            previous && previous.count > 0
              ? Math.round((stage.count / previous.count) * 100)
              : null;

          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-xs text-muted-foreground">
                <InfoTip label={stage.hint}>{stage.label}</InfoTip>
              </div>

              <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-primary/80 transition-all"
                  style={{ width: `${Math.max((stage.count / max) * 100, stage.count > 0 ? 4 : 0)}%` }}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold tabular text-primary-foreground mix-blend-difference">
                  {stage.count}
                </span>
              </div>

              <div className="w-16 shrink-0 text-right text-[11px] tabular text-muted-foreground">
                {conversion === null ? (
                  ""
                ) : (
                  <span className="inline-flex items-center gap-0.5">
                    <ChevronRight className="size-3" />
                    {conversion}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
