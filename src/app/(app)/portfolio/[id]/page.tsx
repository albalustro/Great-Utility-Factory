import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";

import { deleteAssetAction, deleteAssetMetricAction } from "@/app/actions/assets";
import { ConfirmActionForm } from "@/components/action-button";
import { AssetDecisionBadge, DemoBadge } from "@/components/badges";
import { Metric, Value } from "@/components/metric";
import {
  AssetForm,
  DecisionControl,
  MetricEntryForm,
} from "@/components/portfolio/asset-forms";
import { CheckpointsCard } from "@/components/portfolio/checkpoints";
import { Sparkline } from "@/components/portfolio/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDataContext } from "@/lib/data";
import { reviewAsset } from "@/lib/engine/checkpoints";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatInt,
  formatRatio,
  humanizeToken,
} from "@/lib/format";

export default async function AssetDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { store, settings } = await getDataContext();

  const asset = await store.getAsset(id);
  if (!asset) notFound();

  const [metrics, opportunities, activity] = await Promise.all([
    store.listAssetMetrics(id),
    store.listOpportunities(),
    store.listActivity({ entityType: "ASSET", entityId: id, limit: 50 }),
  ]);

  const review = reviewAsset(asset, metrics);
  const linked = opportunities.find((o) => o.id === asset.opportunityId);
  const labels = metrics.map((m) => m.periodEnd.slice(0, 10));

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/portfolio">
            <ArrowLeft className="size-4" />
            Portfolio
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{asset.name}</h1>
            {asset.isDemo ? <DemoBadge /> : null}
            <AssetDecisionBadge decision={asset.assetDecision} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {asset.url ? (
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 hover:underline"
              >
                {asset.domain ?? asset.url}
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <span>{asset.domain ?? "No URL recorded"}</span>
            )}
            <span>·</span>
            <span>Published {formatDate(asset.publishedAt)}</span>
            <span>·</span>
            <span>
              Indexed{" "}
              {asset.indexedAt ? formatDate(asset.indexedAt) : "not recorded"}
            </span>
            {linked ? (
              <>
                <span>·</span>
                <Link
                  href={`/opportunities/${linked.id}`}
                  className="hover:underline"
                >
                  {linked.keyword}
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Latest recorded window</CardTitle>
            <CardDescription>
              {asset.measurementPeriod ?? "No period label recorded"} · last updated{" "}
              {formatDateTime(asset.lastUpdatedAt)}
            </CardDescription>
          </div>
          <MetricEntryForm assetId={asset.id} />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Metric
            label="Impressions"
            value={formatInt(asset.impressions)}
            isUnknown={asset.impressions === null}
            emphasis
          />
          <Metric
            label="Clicks"
            value={formatInt(asset.clicks)}
            isUnknown={asset.clicks === null}
            emphasis
          />
          <Metric
            label="CTR"
            value={formatRatio(asset.ctr)}
            isUnknown={asset.ctr === null}
            hint="Derived from clicks ÷ impressions."
            emphasis
          />
          <Metric
            label="Avg position"
            value={formatDecimal(asset.averagePosition)}
            isUnknown={asset.averagePosition === null}
            emphasis
          />
          <Metric
            label="Pageviews"
            value={formatInt(asset.pageviews)}
            isUnknown={asset.pageviews === null}
            emphasis
          />
          <Metric
            label="Revenue"
            value={formatCurrency(asset.revenue, settings.currency)}
            isUnknown={asset.revenue === null}
            emphasis
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clicks over time</CardTitle>
            <CardDescription>
              One point per recorded window. Windows with no click data are skipped,
              not drawn as zero.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Sparkline values={metrics.map((m) => m.clicks)} labels={labels} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average position over time</CardTitle>
            <CardDescription>Lower is better, so a rising line is good.</CardDescription>
          </CardHeader>
          <CardContent>
            <Sparkline
              values={metrics.map((m) => m.averagePosition)}
              labels={labels}
              invert
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <CheckpointsCard review={review} storedDecision={asset.assetDecision} />

        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
            <CardDescription>
              The recommendation is advisory. Overriding it is normal — the reason is
              recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DecisionControl
              assetId={asset.id}
              current={asset.assetDecision}
              recommended={review.recommendedDecision}
              note={asset.decisionNote}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metric history</CardTitle>
          <CardDescription>
            Every window you have recorded. The most recent one drives the headline
            figures above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No metrics recorded. Until at least one window exists, the checkpoints
              cannot say anything about this asset.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Avg pos</TableHead>
                  <TableHead className="text-right">Pageviews</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...metrics].reverse().map((metric) => (
                  <TableRow key={metric.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(metric.periodStart)} → {formatDate(metric.periodEnd)}
                      {metric.notes ? (
                        <p className="text-[11px] text-muted-foreground">
                          {metric.notes}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={metric.impressions === null}>
                        {formatInt(metric.impressions)}
                      </Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={metric.clicks === null}>
                        {formatInt(metric.clicks)}
                      </Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={metric.ctr === null}>
                        {formatRatio(metric.ctr)}
                      </Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={metric.averagePosition === null}>
                        {formatDecimal(metric.averagePosition)}
                      </Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={metric.pageviews === null}>
                        {formatInt(metric.pageviews)}
                      </Value>
                    </TableCell>
                    <TableCell className="text-right">
                      <Value unknown={metric.revenue === null}>
                        {formatCurrency(metric.revenue, settings.currency)}
                      </Value>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{humanizeToken(metric.source)}</Badge>
                    </TableCell>
                    <TableCell>
                      <ConfirmActionForm
                        action={deleteAssetMetricAction}
                        hidden={{ id: metric.id, assetId: asset.id }}
                        title="Delete this metric entry?"
                        description="The window will be removed and the headline figures recalculated from what remains."
                        confirmLabel="Delete entry"
                        trigger={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Delete metric entry"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Asset details</CardTitle>
          </CardHeader>
          <CardContent>
            <AssetForm asset={asset} opportunities={opportunities} mode="edit" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nothing recorded yet.
                </p>
              ) : (
                activity.map((entry) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="w-28 shrink-0 text-[11px] tabular text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <Badge variant="muted">{humanizeToken(entry.type)}</Badge>
                      <p className="text-xs leading-relaxed">{entry.summary}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
              <CardDescription>
                Deleting the asset also deletes its metric history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfirmActionForm
                action={deleteAssetAction}
                hidden={{ id: asset.id }}
                title={`Delete "${asset.name}"?`}
                description="This permanently removes the asset and every metric window recorded against it. It cannot be undone."
                confirmLabel="Delete permanently"
                trigger={
                  <Button variant="outline" size="sm">
                    <Trash2 className="size-4" />
                    Delete asset
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
