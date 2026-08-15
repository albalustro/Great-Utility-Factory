import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  OPPORTUNITY_STATUS_LABELS,
  type AssetDecision,
  type Decision,
  type OpportunityStatus,
} from "@/lib/domain/types";

/**
 * Badge vocabulary.
 *
 * Colour carries meaning consistently across the whole application:
 * green = act on it, blue = look closer, amber = hold, red = stop.
 */

const DECISION_VARIANT: Record<Decision, "positive" | "info" | "warning" | "danger"> = {
  BUILD: "positive",
  INVESTIGATE: "info",
  WATCH: "warning",
  REJECT: "danger",
};

export function DecisionBadge({
  decision,
  className,
}: {
  decision: Decision;
  className?: string;
}) {
  return (
    <Badge variant={DECISION_VARIANT[decision]} className={cn("font-semibold", className)}>
      {decision}
    </Badge>
  );
}

const ASSET_DECISION_VARIANT: Record<
  AssetDecision,
  "positive" | "info" | "warning" | "danger"
> = {
  SCALE: "positive",
  OPTIMIZE: "info",
  WAIT: "warning",
  KILL: "danger",
};

export function AssetDecisionBadge({
  decision,
  className,
}: {
  decision: AssetDecision;
  className?: string;
}) {
  return (
    <Badge
      variant={ASSET_DECISION_VARIANT[decision]}
      className={cn("font-semibold", className)}
    >
      {decision}
    </Badge>
  );
}

const STATUS_VARIANT: Record<
  OpportunityStatus,
  "muted" | "outline" | "info" | "positive" | "warning" | "danger"
> = {
  INBOX: "muted",
  RESEARCH: "outline",
  QUALIFIED: "info",
  READY_TO_BUILD: "info",
  BUILDING: "warning",
  PUBLISHED: "outline",
  MEASURING: "warning",
  WINNER: "positive",
  KILLED: "danger",
};

export function StatusBadge({
  status,
  className,
}: {
  status: OpportunityStatus;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {OPPORTUNITY_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Marks records created by the demo seed so they can never pass for real data. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-dashed text-muted-foreground", className)}>
      DEMO
    </Badge>
  );
}
