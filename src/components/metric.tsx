import * as React from "react";

import { cn } from "@/lib/utils";
import { UNKNOWN } from "@/lib/format";
import { InfoTip } from "@/components/ui/tooltip";

/**
 * Renders a single metric.
 *
 * When the value is unknown it shows an em dash with an explicit "not recorded"
 * tooltip rather than a zero, so a missing measurement can never be misread as a
 * measured zero.
 */
export function Metric({
  label,
  value,
  hint,
  isUnknown,
  className,
  emphasis = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  isUnknown?: boolean;
  className?: string;
  emphasis?: boolean;
}) {
  const unknown = isUnknown ?? value === UNKNOWN;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {hint ? <InfoTip label={hint}>{label}</InfoTip> : label}
      </div>
      <div
        className={cn(
          "tabular font-mono",
          emphasis ? "text-2xl font-semibold" : "text-sm",
          unknown && "text-muted-foreground",
        )}
        title={unknown ? "Not recorded" : undefined}
      >
        {value}
      </div>
    </div>
  );
}

/** Inline value that degrades to a clearly-marked unknown. */
export function Value({
  children,
  unknown,
  className,
}: {
  children: React.ReactNode;
  unknown?: boolean;
  className?: string;
}) {
  const isUnknown = unknown ?? children === UNKNOWN;
  return (
    <span
      className={cn("tabular font-mono", isUnknown && "text-muted-foreground", className)}
      title={isUnknown ? "Not recorded" : undefined}
    >
      {children}
    </span>
  );
}
