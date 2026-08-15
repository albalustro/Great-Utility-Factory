import { CircleDashed, CircleHelp, CircleX, CircleCheck } from "lucide-react";

import { AssetDecisionBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CheckpointReview, CheckpointStatus } from "@/lib/engine/checkpoints";
import { formatDate } from "@/lib/format";

const STATUS_META: Record<
  CheckpointStatus,
  { icon: typeof CircleCheck; className: string; label: string }
> = {
  MET: { icon: CircleCheck, className: "text-[var(--positive)]", label: "Met" },
  NOT_MET: { icon: CircleX, className: "text-[var(--danger)]", label: "Not met" },
  NO_DATA: {
    icon: CircleHelp,
    className: "text-[var(--warning)]",
    label: "No data",
  },
  PENDING: {
    icon: CircleDashed,
    className: "text-muted-foreground",
    label: "Pending",
  },
};

/**
 * Experiment checkpoints.
 *
 * A missed checkpoint never kills anything by itself — this card shows the
 * evidence and a recommendation, and the operator applies or ignores it.
 */
export function CheckpointsCard({
  review,
  storedDecision,
}: {
  review: CheckpointReview;
  storedDecision: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Experiment checkpoints</CardTitle>
          <CardDescription>
            {review.ageDays === null
              ? "No publication date recorded, so the clock has not started."
              : `${review.ageDays} day(s) since publication.`}
          </CardDescription>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Recommended
          </div>
          <AssetDecisionBadge
            decision={review.recommendedDecision}
            className="mt-1 text-xs"
          />
          {review.isOverridden ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Stored decision: {storedDecision}
            </p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ol className="space-y-2.5">
          {review.checkpoints.map((checkpoint) => {
            const meta = STATUS_META[checkpoint.status];
            const Icon = meta.icon;

            return (
              <li key={checkpoint.day} className="flex gap-3">
                <Icon className={`mt-0.5 size-4 shrink-0 ${meta.className}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      Day {checkpoint.day} — {checkpoint.question}
                    </span>
                    <Badge variant="muted">{meta.label}</Badge>
                    {checkpoint.dueAt ? (
                      <span className="text-[10px] text-muted-foreground">
                        due {formatDate(checkpoint.dueAt)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {checkpoint.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Why {review.recommendedDecision} is recommended
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed">
            {review.reasoning.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            This is a recommendation only. Nothing is killed, scaled or paused until
            you decide.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
