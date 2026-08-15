import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

import { deleteOpportunityAction, updateOpportunityAction } from "@/app/actions/opportunities";
import { ConfirmActionForm } from "@/components/action-button";
import { DemoBadge, StatusBadge } from "@/components/badges";
import { Metric } from "@/components/metric";
import { AiTab } from "@/components/opportunities/ai-tab";
import { BuildPackTab } from "@/components/opportunities/build-pack-tab";
import { ClusterControl } from "@/components/opportunities/cluster-control";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { ScoreBreakdownCard } from "@/components/opportunities/score-breakdown";
import { SerpTab } from "@/components/opportunities/serp-tab";
import { StatusControl } from "@/components/opportunities/status-control";
import { DecisionBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDataContext } from "@/lib/data";
import {
  formatCurrency,
  formatDateTime,
  formatDecimal,
  formatInt,
  humanizeToken,
} from "@/lib/format";
import { getProviderStatuses } from "@/lib/providers/registry";
import { scoreOpportunity } from "@/lib/scoring/engine";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "serp", label: "SERP" },
  { key: "ai", label: "AI Analysis" },
  { key: "build-pack", label: "Build Pack" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function OpportunityDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([props.params, props.searchParams]);
  const activeTab: TabKey =
    (TABS.find((t) => t.key === tab)?.key as TabKey) ?? "overview";

  const { store, settings } = await getDataContext();
  const opportunity = await store.getOpportunity(id);
  if (!opportunity) notFound();

  const [serpResults, analyses, packs, clusters, memberships, activity, history] =
    await Promise.all([
      store.listSerpResults(id),
      store.listAnalyses(id),
      store.listBuildPacks(id),
      store.listClusters(),
      store.listClusterMemberships(),
      store.listActivity({ entityType: "OPPORTUNITY", entityId: id, limit: 100 }),
      store.listStatusHistory(id),
    ]);

  const breakdown = scoreOpportunity(opportunity, {
    weights: settings.weights,
    thresholds: settings.thresholds,
    demandCalibration: settings.demandCalibration,
  });

  const memberClusterIds = new Set(
    memberships.filter((m) => m.opportunityId === id).map((m) => m.clusterId),
  );
  const memberOf = clusters.filter((cluster) => memberClusterIds.has(cluster.id));
  const providerStatuses = getProviderStatuses(settings.providers);

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/opportunities">
            <ArrowLeft className="size-4" />
            Opportunities
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {opportunity.keyword}
            </h1>
            {opportunity.isDemo ? <DemoBadge /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{opportunity.country}</Badge>
            <Badge variant="outline">{opportunity.language}</Badge>
            {opportunity.utilityType ? (
              <Badge variant="muted">{humanizeToken(opportunity.utilityType)}</Badge>
            ) : null}
            <span>·</span>
            <StatusBadge status={opportunity.status} />
            <span>·</span>
            <span>Source {humanizeToken(opportunity.source)}</span>
          </div>

          <StatusControl opportunityId={id} status={opportunity.status} />
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="text-right">
            <div className="tabular font-mono text-4xl font-semibold leading-none">
              {opportunity.opportunityScore}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Opportunity score
            </div>
          </div>
          <DecisionBadge decision={breakdown.decision} className="text-sm" />
        </div>
      </header>

      <nav className="flex gap-1 border-b border-border">
        {TABS.map((item) => {
          const active = item.key === activeTab;
          const count =
            item.key === "serp"
              ? serpResults.length
              : item.key === "ai"
                ? analyses.length
                : item.key === "build-pack"
                  ? packs.length
                  : 0;

          return (
            <Link
              key={item.key}
              href={`/opportunities/${id}?tab=${item.key}`}
              scroll={false}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              {count > 0 ? <Badge variant="muted">{count}</Badge> : null}
            </Link>
          );
        })}
      </nav>

      {activeTab === "overview" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Raw search metrics</CardTitle>
              <CardDescription>
                Exactly what was recorded. A dash means the metric is unknown, not zero.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric
                label="Search volume"
                value={formatInt(opportunity.searchVolume)}
                isUnknown={opportunity.searchVolume === null}
                hint="Monthly searches, as supplied by you or a keyword provider."
                emphasis
              />
              <Metric
                label="Keyword difficulty"
                value={formatDecimal(opportunity.keywordDifficulty, 0)}
                isUnknown={opportunity.keywordDifficulty === null}
                hint="Third-party difficulty estimate, 0-100. Lower is easier."
                emphasis
              />
              <Metric
                label="CPC"
                value={formatCurrency(opportunity.cpc, settings.currency)}
                isUnknown={opportunity.cpc === null}
                hint="Cost per click, used as a proxy for commercial value."
                emphasis
              />
              <Metric
                label="Trend"
                value={humanizeToken(opportunity.trend)}
                isUnknown={opportunity.trend === "UNKNOWN"}
                emphasis
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <ScoreBreakdownCard breakdown={breakdown} />

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Clusters</CardTitle>
                  <CardDescription>
                    Group this with the utilities it should ship alongside.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ClusterControl
                    opportunityId={id}
                    clusters={clusters}
                    memberOf={memberOf}
                  />
                </CardContent>
              </Card>

              {opportunity.notes ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {opportunity.notes}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Danger zone</CardTitle>
                  <CardDescription>
                    Deleting removes the opportunity and everything attached to it.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ConfirmActionForm
                    action={deleteOpportunityAction}
                    hidden={{ id }}
                    title={`Delete "${opportunity.keyword}"?`}
                    description="This permanently removes the opportunity, its SERP results, analyses, build packs and history. It cannot be undone."
                    confirmLabel="Delete permanently"
                    trigger={
                      <Button variant="outline" size="sm">
                        <Trash2 className="size-4" />
                        Delete opportunity
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Edit</CardTitle>
              <CardDescription>
                Changing any input re-scores the opportunity and records what moved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OpportunityForm
                action={updateOpportunityAction}
                opportunity={opportunity}
                defaultCountry={settings.defaultCountry}
                defaultLanguage={settings.defaultLanguage}
                submitLabel="Save changes"
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "serp" ? (
        <SerpTab
          opportunityId={id}
          results={serpResults}
          storedWeakness={opportunity.serpWeaknessScore}
        />
      ) : null}

      {activeTab === "ai" ? (
        <AiTab
          opportunityId={id}
          analyses={analyses}
          providerStatus={providerStatuses.ai}
        />
      ) : null}

      {activeTab === "build-pack" ? (
        <BuildPackTab
          opportunityId={id}
          keyword={opportunity.keyword}
          packs={packs}
        />
      ) : null}

      {activeTab === "activity" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>
                Every recorded change to this opportunity.
              </CardDescription>
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
              <CardTitle>Status history</CardTitle>
              <CardDescription>How this moved through the pipeline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="w-28 shrink-0 text-[11px] tabular text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      {entry.fromStatus ? (
                        <>
                          <StatusBadge status={entry.fromStatus} />
                          <span className="text-xs text-muted-foreground">→</span>
                        </>
                      ) : null}
                      <StatusBadge status={entry.toStatus} />
                    </div>
                    {entry.note ? (
                      <p className="text-[11px] text-muted-foreground">{entry.note}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
