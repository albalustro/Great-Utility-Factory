import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { AssetDecisionBadge, DemoBadge } from "@/components/badges";
import { Value } from "@/components/metric";
import { EmptyState, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InfoTip } from "@/components/ui/tooltip";
import { getDataContext } from "@/lib/data";
import { reviewAsset } from "@/lib/engine/checkpoints";
import {
  formatCurrency,
  formatDate,
  formatDecimal,
  formatInt,
  formatRatio,
} from "@/lib/format";

export default function PortfolioPage() {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Portfolio</h1>
          <p className="text-xs text-muted-foreground">
            Published utilities and what they have actually produced.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/portfolio/new">
            <Plus className="size-4" />
            Add asset
          </Link>
        </Button>
      </header>

      {/* Local boundary: a segment-level loading.tsx would also wrap
          /portfolio/[id] and stop a missing asset returning a real 404. */}
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <PortfolioBody />
      </Suspense>
    </div>
  );
}

async function PortfolioBody() {
  const { store, settings } = await getDataContext();
  const [assets, metricsByAsset] = await Promise.all([
    store.listAssets(),
    store.listAllAssetMetrics(),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {assets.length} live asset{assets.length === 1 ? "" : "s"}. Figures show the
        most recent recorded window.
      </p>

      {assets.length === 0 ? (
        <EmptyState
          title="No assets yet"
          description="Once a utility is live, add it here to start measuring whether it deserves more investment."
          action={
            <Button asChild size="sm">
              <Link href="/portfolio/new">Add asset</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[14rem]">Asset</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">
                  <InfoTip label="Derived from clicks ÷ impressions of the latest window.">
                    CTR
                  </InfoTip>
                </TableHead>
                <TableHead className="text-right">
                  <InfoTip label="Average position in the latest recorded window. Lower is better.">
                    Avg pos
                  </InfoTip>
                </TableHead>
                <TableHead className="text-right">Pageviews</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>
                  <InfoTip label="Change in clicks between the first and latest recorded windows.">
                    Trend
                  </InfoTip>
                </TableHead>
                <TableHead>Decision</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {assets.map((asset) => {
                const metrics = metricsByAsset[asset.id] ?? [];
                const withClicks = metrics.filter((m) => m.clicks !== null);
                const delta =
                  withClicks.length >= 2
                    ? (withClicks[withClicks.length - 1].clicks ?? 0) -
                      (withClicks[0].clicks ?? 0)
                    : null;
                const review = reviewAsset(asset, metrics);

                return (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/portfolio/${asset.id}`}
                          className="truncate font-medium hover:underline"
                        >
                          {asset.name}
                        </Link>
                        {asset.isDemo ? <DemoBadge /> : null}
                      </div>
                      {asset.domain ? (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {asset.domain}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(asset.publishedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={asset.impressions === null}>
                        {formatInt(asset.impressions)}
                      </Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={asset.clicks === null}>
                        {formatInt(asset.clicks)}
                      </Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={asset.ctr === null}>{formatRatio(asset.ctr)}</Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={asset.averagePosition === null}>
                        {formatDecimal(asset.averagePosition)}
                      </Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={asset.pageviews === null}>
                        {formatInt(asset.pageviews)}
                      </Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={asset.revenue === null}>
                        {formatCurrency(asset.revenue, settings.currency)}
                      </Value>
                    </TableCell>
                    <TableCell>
                      {delta === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={`tabular font-mono text-xs ${
                            delta > 0
                              ? "text-[var(--positive)]"
                              : delta < 0
                                ? "text-[var(--danger)]"
                                : "text-muted-foreground"
                          }`}
                        >
                          {delta > 0 ? "+" : ""}
                          {formatInt(delta)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <AssetDecisionBadge decision={asset.assetDecision} />
                        {review.isOverridden ? (
                          <InfoTip
                            label={`The checkpoint rules recommend ${review.recommendedDecision}.`}
                          >
                            <span className="text-[10px] text-muted-foreground">
                              ≠ rec.
                            </span>
                          </InfoTip>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
