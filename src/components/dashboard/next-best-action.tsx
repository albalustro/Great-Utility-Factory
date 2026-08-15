import Link from "next/link";
import {
  ArrowRight,
  Hammer,
  PackageSearch,
  Rocket,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActionType, NextBestAction } from "@/lib/engine/next-best-action";

const ACTION_META: Record<
  ActionType,
  { label: string; icon: typeof Rocket; accent: string; tone: string }
> = {
  SCALE: {
    label: "SCALE",
    icon: Rocket,
    accent: "border-l-[var(--positive)]",
    tone: "text-[var(--positive)]",
  },
  OPTIMIZE: {
    label: "OPTIMIZE",
    icon: TrendingUp,
    accent: "border-l-[var(--info)]",
    tone: "text-[var(--info)]",
  },
  BUILD: {
    label: "BUILD",
    icon: Hammer,
    accent: "border-l-[var(--positive)]",
    tone: "text-[var(--positive)]",
  },
  GENERATE_BUILD_PACK: {
    label: "GENERATE BUILD PACK",
    icon: PackageSearch,
    accent: "border-l-[var(--info)]",
    tone: "text-[var(--info)]",
  },
  RESEARCH: {
    label: "RESEARCH",
    icon: Search,
    accent: "border-l-[var(--warning)]",
    tone: "text-[var(--warning)]",
  },
  ANALYZE_SERP: {
    label: "ANALYZE SERP",
    icon: Sparkles,
    accent: "border-l-[var(--warning)]",
    tone: "text-[var(--warning)]",
  },
  REVIEW: {
    label: "REVIEW / POSSIBLE KILL",
    icon: PackageSearch,
    accent: "border-l-[var(--danger)]",
    tone: "text-[var(--danger)]",
  },
  IMPORT: {
    label: "IMPORT",
    icon: Upload,
    accent: "border-l-[var(--info)]",
    tone: "text-[var(--info)]",
  },
};

/**
 * The single most important component on the dashboard: what to do next, why,
 * and a one-click route to doing it.
 */
export function NextBestActionCard({
  action,
  alternatives,
}: {
  action: NextBestAction | null;
  alternatives: NextBestAction[];
}) {
  if (!action) {
    return (
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-medium">Nothing is waiting on you.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No opportunity is queued and no asset is asking for a decision. Add
            keywords or import a list to restart the funnel.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/opportunities/new">Add an opportunity</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const meta = ACTION_META[action.actionType];
  const Icon = meta.icon;

  return (
    <div className="space-y-3">
      <Card className={cn("border-l-4", meta.accent)}>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className={cn("size-4", meta.tone)} />
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-[0.12em]",
                    meta.tone,
                  )}
                >
                  Next best action · {meta.label}
                </span>
              </div>

              <h2 className="text-xl font-semibold tracking-tight">
                {action.entity.label}
              </h2>

              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {action.reason}
              </p>

              {action.evidence.length ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                  {action.evidence.map((line, index) => (
                    <li
                      key={index}
                      className="text-[11px] tabular text-muted-foreground"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <Button asChild className="shrink-0">
              <Link href={action.href}>
                Go
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {alternatives.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Then
          </span>
          {alternatives.map((alternative) => (
            <Link
              key={`${alternative.actionType}-${alternative.entity.id}`}
              href={alternative.href}
              className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs transition-colors hover:bg-accent"
            >
              <Badge variant="muted">{ACTION_META[alternative.actionType].label}</Badge>
              <span className="max-w-[18rem] truncate">{alternative.entity.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
