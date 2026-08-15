"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/app/actions/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/ui/tooltip";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  TRENDS,
  UTILITY_TYPES,
  type Opportunity,
} from "@/lib/domain/types";
import { humanizeToken } from "@/lib/format";

const SUB_SCORES: Array<{
  name: keyof Opportunity;
  label: string;
  hint: string;
}> = [
  {
    name: "serpWeaknessScore",
    label: "SERP weakness",
    hint: "How vulnerable the SERP looks, 0-100. The SERP tab can suggest this from the results you capture.",
  },
  {
    name: "utilityFitScore",
    label: "Utility fit",
    hint: "How completely a single-purpose web utility can satisfy the query, 0-100.",
  },
  {
    name: "monetizationScore",
    label: "Monetization",
    hint: "Commercial value of the traffic, 0-100. CPC is a useful anchor.",
  },
  {
    name: "evergreenScore",
    label: "Evergreen",
    hint: "How durable the demand is likely to be over years, 0-100.",
  },
  {
    name: "buildSimplicityScore",
    label: "Build simplicity",
    hint: "How quickly this could realistically ship, 0-100. Higher is simpler.",
  },
  {
    name: "clusterPotentialScore",
    label: "Cluster potential",
    hint: "How many adjacent utilities this keyword could unlock, 0-100.",
  },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function OpportunityForm({
  action,
  opportunity,
  defaultCountry,
  defaultLanguage,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  opportunity?: Opportunity;
  defaultCountry: string;
  defaultLanguage: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [hasOverride, setHasOverride] = useState(
    opportunity?.demandScoreOverride !== null &&
      opportunity?.demandScoreOverride !== undefined,
  );

  const error = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={formAction} className="space-y-4">
      {opportunity ? <input type="hidden" name="id" value={opportunity.id} /> : null}
      <input
        type="hidden"
        name="source"
        value={opportunity?.source ?? "MANUAL"}
      />

      <Card>
        <CardHeader>
          <CardTitle>Keyword</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Keyword" error={error("keyword")} className="sm:col-span-2">
            <Input
              name="keyword"
              defaultValue={opportunity?.keyword}
              required
              placeholder="freelance hourly rate calculator"
            />
          </Field>

          <Field label="Country" error={error("country")}>
            <Input
              name="country"
              defaultValue={opportunity?.country ?? defaultCountry}
              required
              maxLength={8}
            />
          </Field>

          <Field label="Language" error={error("language")}>
            <Input
              name="language"
              defaultValue={opportunity?.language ?? defaultLanguage}
              required
              maxLength={8}
            />
          </Field>

          <Field
            label="Utility type"
            hint="What kind of tool would answer this query? Leave unset if you are not sure yet."
          >
            <select
              name="utilityType"
              defaultValue={opportunity?.utilityType ?? ""}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
            >
              <option value="">Not set</option>
              {UTILITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanizeToken(type)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select
              name="status"
              defaultValue={opportunity?.status ?? "INBOX"}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
            >
              {OPPORTUNITY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {OPPORTUNITY_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>External metrics</CardTitle>
          <p className="text-xs text-muted-foreground">
            Leave a field empty when you do not have the number. Empty means unknown
            and scores zero for that factor — it is never treated as a measured zero.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search volume (per month)" error={error("searchVolume")}>
            <Input
              name="searchVolume"
              type="number"
              min={0}
              defaultValue={opportunity?.searchVolume ?? ""}
              placeholder="unknown"
            />
          </Field>

          <Field label="Keyword difficulty (0-100)" error={error("keywordDifficulty")}>
            <Input
              name="keywordDifficulty"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={opportunity?.keywordDifficulty ?? ""}
              placeholder="unknown"
            />
          </Field>

          <Field label="CPC" error={error("cpc")}>
            <Input
              name="cpc"
              type="number"
              min={0}
              step="0.01"
              defaultValue={opportunity?.cpc ?? ""}
              placeholder="unknown"
            />
          </Field>

          <Field label="Trend">
            <select
              name="trend"
              defaultValue={opportunity?.trend ?? "UNKNOWN"}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
            >
              {TRENDS.map((trend) => (
                <option key={trend} value={trend}>
                  {humanizeToken(trend)}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessment</CardTitle>
          <p className="text-xs text-muted-foreground">
            Your judgement, 0-100 each. An un-assessed factor contributes nothing to
            the score and is reported as missing rather than assumed.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUB_SCORES.map((factor) => (
            <Field
              key={factor.name}
              label={factor.label}
              hint={factor.hint}
              error={error(String(factor.name))}
            >
              <Input
                name={String(factor.name)}
                type="number"
                min={0}
                max={100}
                defaultValue={(opportunity?.[factor.name] as number | null) ?? ""}
                placeholder="not assessed"
              />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demand override</CardTitle>
          <p className="text-xs text-muted-foreground">
            The demand score is normally derived from search volume. Override it only
            when you know something the volume does not show — and say what.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasOverride}
              onChange={(event) => setHasOverride(event.target.checked)}
              className="size-4 rounded border-input"
            />
            Override the derived demand score
          </label>

          {hasOverride ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Demand score (0-100)" error={error("demandScoreOverride")}>
                <Input
                  name="demandScoreOverride"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={opportunity?.demandScoreOverride ?? ""}
                  required
                />
              </Field>
              <Field
                label="Reason (required)"
                error={error("demandScoreOverrideReason")}
                className="sm:col-span-2"
              >
                <Input
                  name="demandScoreOverrideReason"
                  defaultValue={opportunity?.demandScoreOverrideReason ?? ""}
                  placeholder="e.g. Volume tool under-reports this seasonal query"
                  required
                />
              </Field>
            </div>
          ) : (
            <>
              <input type="hidden" name="demandScoreOverride" value="" />
              <input type="hidden" name="demandScoreOverrideReason" value="" />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            name="notes"
            rows={4}
            defaultValue={opportunity?.notes ?? ""}
            placeholder="What made this worth recording? What still needs checking?"
          />
        </CardContent>
      </Card>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.message ? (
        <Alert variant="info">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">
        {hint ? <InfoTip label={hint}>{label}</InfoTip> : label}
      </Label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
