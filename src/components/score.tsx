import { cn } from "@/lib/utils";
import { DecisionBadge } from "@/components/badges";
import { decisionForScore } from "@/lib/scoring/engine";
import type { DecisionThresholds } from "@/lib/domain/types";

/** Compact score + decision pair used in tables and cards. */
export function ScorePill({
  score,
  thresholds,
  showDecision = true,
  className,
}: {
  score: number;
  thresholds?: DecisionThresholds;
  showDecision?: boolean;
  className?: string;
}) {
  const decision = decisionForScore(score, thresholds);

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="tabular font-mono text-sm font-semibold">{score}</span>
      {showDecision ? <DecisionBadge decision={decision} /> : null}
    </span>
  );
}

/** Horizontal bar showing a factor's contribution against its maximum. */
export function ScoreBar({
  value,
  max,
  className,
  muted = false,
}: {
  value: number;
  max: number;
  className?: string;
  muted?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full", muted ? "bg-muted-foreground/40" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
