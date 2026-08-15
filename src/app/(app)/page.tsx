import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Plus, TrendingUp, Upload } from "lucide-react";

import { AssetDecisionBadge, DemoBadge, StatusBadge } from "@/components/badges";
import { FactoryFunnel } from "@/components/dashboard/funnel";
import { NextBestActionCard } from "@/components/dashboard/next-best-action";
import { Metric } from "@/components/metric";
import { ScorePill } from "@/components/score";
import { CardsSkeleton, EmptyState } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDataContext } from "@/lib/data";
import { loadDashboard, type AssetWithReview } from "@/lib/dashboard";
import {
  UNKNOWN,
  formatCurrency,
  formatDate,
  formatInt,
  formatRatio,
} from "@/lib/format";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            What is worth your next three hours.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/opportunities/import">
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/opportunities/new">
              <Plus className="size-4" />
              New opportunity
            </Link>
          </Button>
        </div>
      </header>

      {/* Streamed separately so the header paints immediately. The boundary is
          local to this page rather than a segment-level loading.tsx, which would
          also wrap the detail routes and stop them returning a real 404. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardBody />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-28 w-full" />
      <CardsSkeleton count={6} />
      <CardsSkeleton count={2} />
    </div>
  );
}

async function DashboardBody() {
  const [data, { settings }] = await Promise.all([loadDashboard(), getDataContext()]);
  const [primary, ...rest] = data.actions;

  return (
    <div className="space-y-6">
      {data.isDemoData ? (
        <Alert variant="info">
          <AlertTitle className="text-xs">Demo data is present</AlertTitle>
          <AlertDescription>
            Records marked <DemoBadge /> are fictional examples used to show the
            interface. Their metrics are invented and are not real search, ranking or
            revenue data.
          </AlertDescription>
        </Alert>
      ) : null}

      <NextBestActionCard action={primary ?? null} alternatives={rest.slice(0, 3)} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard label="Opportunities discovered" value={formatInt(data.kpis.discovered)} />
        <KpiCard label="Qualified" value={formatInt(data.kpis.qualified)} />
        <KpiCard label="Ready to build" value={formatInt(data.kpis.readyToBuild)} />
        <KpiCard label="Utilities live" value={formatInt(data.kpis.live)} />
        <KpiCard
          label="Organic clicks"
          value={formatInt(data.kpis.clicksLatestWindow)}
          hint={
            data.kpis.clicksLatestWindow === null
              ? "No click data has been recorded for any asset."
              : `Sum of the latest recorded window across ${data.kpis.assetsWithClickData} asset(s). Windows are whatever periods you entered — they are not normalised to 30 days.`
          }
        />
        <KpiCard
          label="Revenue"
          value={formatCurrency(data.kpis.revenueLatestWindow, data.currency)}
          hint={
            data.kpis.revenueLatestWindow === null
              ? "No revenue data has been recorded for any asset."
              : `Sum of the latest recorded window across ${data.kpis.assetsWithRevenueData} asset(s).`
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <FactoryFunnel stages={data.funnel} />

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Top opportunities</CardTitle>
              <CardDescription>Highest scoring, excluding killed.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/opportunities">
                All
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.topOpportunities.length === 0 ? (
              <EmptyState
                title="No opportunities yet"
                description="Add one manually or import a keyword export to get started."
                action={
                  <Button asChild size="sm">
                    <Link href="/opportunities/new">New opportunity</Link>
                  </Button>
                }
              />
            ) : (
              data.topOpportunities.map((opportunity) => (
                <Link
                  key={opportunity.id}
                  href={`/opportunities/${opportunity.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm">{opportunity.keyword}</span>
                    {opportunity.isDemo ? <DemoBadge /> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={opportunity.status} />
                    <ScorePill
                      score={opportunity.opportunityScore}
                      thresholds={settings.thresholds}
                    />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AssetListCard
          title="Recently published"
          description="Newest assets in the portfolio."
          items={data.recentlyPublished}
          currency={data.currency}
          empty="Nothing published yet."
          render={(item) => (
            <span className="text-[11px] text-muted-foreground">
              Published {formatDate(item.asset.publishedAt)}
            </span>
          )}
        />

        <AssetListCard
          title="Gaining traction"
          description="Clicks up between the first and latest recorded windows."
          icon={<TrendingUp className="size-3.5 text-[var(--positive)]" />}
          items={data.gainingTraction}
          currency={data.currency}
          empty="No asset has two comparable click windows yet."
          render={(item) => (
            <span className="text-[11px] tabular text-[var(--positive)]">
              +{formatInt(item.clickDelta)} clicks
            </span>
          )}
        />

        <AssetListCard
          title="Requires attention"
          description="Missed a checkpoint or is under-converting."
          icon={<AlertTriangle className="size-3.5 text-[var(--warning)]" />}
          items={data.needsAttention}
          currency={data.currency}
          empty="Nothing is flagged."
          render={(item) => (
            <span className="text-[11px] text-muted-foreground">
              Recommended: {item.review.recommendedDecision}
            </span>
          )}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="px-4 py-3.5">
        <Metric
          label={label}
          value={value}
          hint={hint}
          isUnknown={value === UNKNOWN}
          emphasis
        />
      </CardContent>
    </Card>
  );
}

function AssetListCard({
  title,
  description,
  items,
  currency,
  empty,
  icon,
  render,
}: {
  title: string;
  description: string;
  items: AssetWithReview[];
  currency: string;
  empty: string;
  icon?: React.ReactNode;
  render: (item: AssetWithReview) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
        ) : (
          items.map((item) => (
            <Link
              key={item.asset.id}
              href={`/portfolio/${item.asset.id}`}
              className="flex flex-col gap-1 rounded-md px-2 py-2 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm">{item.asset.name}</span>
                <AssetDecisionBadge decision={item.asset.assetDecision} />
              </div>
              <div className="flex items-center justify-between gap-2">
                {render(item)}
                <span className="text-[11px] tabular text-muted-foreground">
                  {formatInt(item.asset.clicks)} clicks · {formatRatio(item.asset.ctr)} CTR ·{" "}
                  {formatCurrency(item.asset.revenue, currency)}
                </span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
