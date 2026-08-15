"use client";

import { useState } from "react";
import { AlertTriangle, FileCode2, Package } from "lucide-react";

import { generateBuildPackAction } from "@/app/actions/build-pack";
import {
  ActionForm,
  CopyButton,
  DownloadButton,
  PendingButton,
} from "@/components/action-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BuildPack } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { slugify } from "@/lib/engine/build-pack";

export function BuildPackTab({
  opportunityId,
  keyword,
  packs,
}: {
  opportunityId: string;
  keyword: string;
  packs: BuildPack[];
}) {
  const [selectedId, setSelectedId] = useState(packs[0]?.id);
  const pack = packs.find((p) => p.id === selectedId) ?? packs[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4" />
              Build pack
            </CardTitle>
            <CardDescription>
              Everything a build agent needs, assembled from recorded evidence. Each
              generation is stored as a new version.
            </CardDescription>
          </div>
          {packs.length > 1 ? (
            <select
              value={pack?.id}
              onChange={(event) => setSelectedId(event.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs shadow-sm"
            >
              {packs.map((option) => (
                <option key={option.id} value={option.id}>
                  v{option.version} · {formatDateTime(option.createdAt)}
                </option>
              ))}
            </select>
          ) : null}
        </CardHeader>

        <CardContent>
          <ActionForm action={generateBuildPackAction} hidden={{ opportunityId }}>
            <PendingButton pendingLabel="Generating…">
              {packs.length ? "Regenerate build pack" : "Generate build pack"}
            </PendingButton>
            <span className="text-[11px] text-muted-foreground">
              Uses the latest AI analysis when one exists, and recorded data otherwise.
            </span>
          </ActionForm>
        </CardContent>
      </Card>

      {!pack ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">No build pack yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Generate one to turn this opportunity into a specification and a
              ready-to-paste Claude Code prompt.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCode2 className="size-4" />
                  Claude Code build prompt
                </CardTitle>
                <CardDescription>
                  Version {pack.version} · generated {formatDateTime(pack.createdAt)} ·{" "}
                  {pack.usedAiAnalysis
                    ? "enriched by an AI analysis"
                    : "from recorded data only"}
                </CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                <CopyButton value={pack.claudeCodePrompt} label="Copy prompt" />
                <DownloadButton
                  value={pack.claudeCodePrompt}
                  filename={`${slugify(keyword)}-build-prompt.md`}
                />
              </div>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[32rem] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                {pack.claudeCodePrompt}
              </pre>
            </CardContent>
          </Card>

          {pack.content.assumptions.length ? (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle className="text-xs">
                {pack.content.assumptions.length} assumption(s) in this pack
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {pack.content.assumptions.map((assumption, index) => (
                    <li key={index}>{assumption}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Specification</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-2">
              <Field label="Product name" value={pack.content.productName} />
              <Field label="Primary keyword" value={pack.content.primaryKeyword} />
              <Field label="Suggested slug" value={pack.content.suggestedSlug} mono />
              <Field label="H1" value={pack.content.h1} />
              <Field label="Title tag" value={pack.content.suggestedTitle} />
              <Field label="Meta description" value={pack.content.metaDescription} />
              <Field label="Search intent" value={pack.content.searchIntent} wide />
              <Field
                label="Problem definition"
                value={pack.content.problemDefinition}
                wide
              />
              <Field
                label="Product description"
                value={pack.content.productDescription}
                wide
              />

              <ListField label="Secondary keywords" items={pack.content.secondaryKeywords} />
              <ListField label="Inputs" items={pack.content.inputs} />
              <ListField label="Outputs" items={pack.content.outputs} />
              <ListField label="Business logic" items={pack.content.businessLogic} />
              <ListField label="Core features" items={pack.content.coreFeatures} />
              <ListField label="Optional features" items={pack.content.optionalFeatures} />
              <ListField label="UX requirements" items={pack.content.uxRequirements} />
              <ListField
                label="Competitor observations"
                items={pack.content.competitorObservations}
              />
              <ListField label="SEO requirements" items={pack.content.seoRequirements} />
              <ListField
                label="Supporting content outline"
                items={pack.content.supportingContentOutline}
              />
              <ListField label="FAQ ideas" items={pack.content.faqIdeas} />
              <ListField label="Structured data" items={pack.content.structuredData} />
              <ListField label="Analytics events" items={pack.content.analyticsEvents} />
              <ListField
                label="Monetization considerations"
                items={pack.content.monetizationConsiderations}
              />
              <ListField
                label="Related utility ideas"
                items={pack.content.relatedUtilityIdeas}
              />
              <ListField
                label="Future cluster opportunities"
                items={pack.content.futureClusterOpportunities}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "lg:col-span-2" : undefined}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 text-sm leading-relaxed ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {items.length === 0 ? (
        <Badge variant="muted" className="mt-1">
          None recorded
        </Badge>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm leading-relaxed">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BuildPackEmptyAction({ opportunityId }: { opportunityId: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <a href={`/opportunities/${opportunityId}?tab=build-pack`}>Open build pack</a>
    </Button>
  );
}
