import * as React from "react";
import { AlertTriangle, Inbox, PlugZap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Empty, error, loading and no-provider states, kept consistent everywhere. */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <div className="text-muted-foreground">{icon ?? <Inbox className="size-6" />}</div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-6 py-10 text-center">
      <AlertTriangle className="size-6 text-[var(--danger)]" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Shown wherever a feature needs an external provider that is not configured.
 * It explains what is missing and what to do — it never substitutes fake output.
 */
export function NoProviderState({
  title,
  detail,
  requiredEnv,
  action,
}: {
  title: string;
  detail: string;
  requiredEnv?: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <PlugZap className="size-6 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto max-w-lg text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </div>
      {requiredEnv?.length ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {requiredEnv.map((key) => (
            <code
              key={key}
              className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px]"
            >
              {key}
            </code>
          ))}
        </div>
      ) : null}
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  );
}
