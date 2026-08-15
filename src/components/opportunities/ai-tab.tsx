import Link from "next/link";
import { Bot, Database, ShieldAlert } from "lucide-react";

import { analyzeOpportunityAction } from "@/app/actions/ai";
import { ActionForm, PendingButton } from "@/components/action-button";
import { DecisionBadge } from "@/components/badges";
import { NoProviderState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AIAnalysis } from "@/lib/domain/types";
import type { ProviderStatus } from "@/lib/providers/types";
import { formatDateTime } from "@/lib/format";

/**
 * AI analysis tab.
 *
 * The visual contract: anything the model said sits inside a clearly marked
 * "AI interpretation" region, and the measured data it was given is shown
 * separately above it. The two are never blended.
 */
export function AiTab({
  opportunityId,
  analyses,
  providerStatus,
}: {
  opportunityId: string;
  analyses: AIAnalysis[];
  providerStatus: ProviderStatus;
}) {
  const latest = analyses[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4" />
              Analyze opportunity
            </CardTitle>
            <CardDescription>
              The model receives only the recorded metrics and SERP rows. It is
              instructed never to invent a metric, and its output is stored as
              interpretation, not as data.
            </CardDescription>
          </div>
          <Badge variant={providerStatus.configured ? "positive" : "muted"}>
            {providerStatus.label}
          </Badge>
        </CardHeader>

        <CardContent>
          {providerStatus.configured ? (
            <ActionForm
              action={analyzeOpportunityAction}
              hidden={{ opportunityId }}
            >
              <PendingButton pendingLabel="Analyzing…">
                {latest ? "Run a new analysis" : "Analyze opportunity"}
              </PendingButton>
              <span className="text-[11px] text-muted-foreground">
                Each run is stored separately so you can compare them.
              </span>
            </ActionForm>
          ) : (
            <NoProviderState
              title="No AI provider configured"
              detail={providerStatus.detail}
              requiredEnv={providerStatus.requiredEnv}
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/settings">Open settings</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {latest ? <AnalysisCard analysis={latest} /> : null}

      {analyses.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Earlier analyses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analyses.slice(1).map((analysis) => (
              <details key={analysis.id} className="rounded-md border border-border">
                <summary className="cursor-pointer px-3 py-2 text-xs">
                  {formatDateTime(analysis.createdAt)} · {analysis.provider}
                  {analysis.model ? ` / ${analysis.model}` : ""} ·{" "}
                  {analysis.content.recommendation}
                </summary>
                <div className="border-t border-border p-3">
                  <AnalysisBody analysis={analysis} />
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AnalysisCard({ analysis }: { analysis: AIAnalysis }) {
  return (
    <Card className="border-l-4 border-l-[var(--info)]">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-[var(--info)]" />
            AI interpretation — not measured data
          </CardTitle>
          <CardDescription>
            Generated {formatDateTime(analysis.createdAt)} by {analysis.provider}
            {analysis.model ? ` / ${analysis.model}` : ""}. Treat every line as a
            hypothesis to check, not a finding.
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DecisionBadge decision={analysis.content.recommendation} />
          <Badge variant="muted">{analysis.content.confidence} confidence</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <AnalysisBody analysis={analysis} />
      </CardContent>
    </Card>
  );
}

function AnalysisBody({ analysis }: { analysis: AIAnalysis }) {
  const c = analysis.content;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Search intent" body={c.searchIntent} />
        <Section title="Problem definition" body={c.problemDefinition} />
        <Section title="Current solution landscape" body={c.currentSolutionLandscape} />
        <Section title="Product gap" body={c.productGap} />
      </div>

      <Separator />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Recommended utility" body={c.recommendedUtility} />
        <List title="Jobs to be done" items={c.jobsToBeDone} />
        <List title="Core inputs" items={c.coreInputs} />
        <List title="Expected outputs" items={c.expectedOutputs} />
        <List title="Possible differentiation" items={c.possibleDifferentiation} />
        <List title="Cluster opportunities" items={c.clusterOpportunities} />
      </div>

      <Separator />

      <div className="grid gap-5 lg:grid-cols-3">
        <List title="Reasons to build" items={c.reasonsToBuild} tone="positive" />
        <List
          title="Reasons NOT to build"
          items={c.reasonsNotToBuild}
          tone="danger"
          emphasis
        />
        <List title="Risks" items={c.risks} tone="warning" />
      </div>

      {c.assumptions.length ? (
        <>
          <Separator />
          <List title="Assumptions the model made" items={c.assumptions} tone="muted" />
        </>
      ) : null}

      <details className="rounded-md border border-border">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <Database className="size-3.5" />
          Exact data the model received
        </summary>
        <pre className="max-h-80 overflow-auto border-t border-border p-3 text-[11px] leading-relaxed">
          {JSON.stringify(analysis.inputSnapshot, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <p className="text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function List({
  title,
  items,
  tone = "default",
  emphasis = false,
}: {
  title: string;
  items: string[];
  tone?: "default" | "positive" | "danger" | "warning" | "muted";
  emphasis?: boolean;
}) {
  const toneClass = {
    default: "",
    positive: "marker:text-[var(--positive)]",
    danger: "marker:text-[var(--danger)]",
    warning: "marker:text-[var(--warning)]",
    muted: "text-muted-foreground",
  }[tone];

  return (
    <div className="space-y-1">
      <h4
        className={`text-[11px] font-semibold uppercase tracking-wider ${
          emphasis ? "text-[var(--danger)]" : "text-muted-foreground"
        }`}
      >
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None provided.</p>
      ) : (
        <ul className={`list-disc space-y-1 pl-4 text-sm leading-relaxed ${toneClass}`}>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
