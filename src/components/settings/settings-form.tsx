"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";

import { saveSettingsAction } from "@/app/actions/settings";
import { PendingButton } from "@/components/action-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTip } from "@/components/ui/tooltip";
import type { ScoringWeights, Settings } from "@/lib/domain/types";
import type { ProviderOption } from "@/lib/providers/registry";
import { cn } from "@/lib/utils";

const WEIGHT_FIELDS: Array<{ key: keyof ScoringWeights; label: string; hint: string }> = [
  {
    key: "demand",
    label: "Demand",
    hint: "Derived from search volume through the calibration curve below.",
  },
  {
    key: "serpWeakness",
    label: "SERP weakness",
    hint: "How beatable the current results are. Usually the highest-weighted factor.",
  },
  {
    key: "utilityFit",
    label: "Utility fit",
    hint: "How completely a simple tool answers the query.",
  },
  { key: "monetization", label: "Monetization", hint: "Commercial value of the traffic." },
  { key: "evergreen", label: "Evergreen", hint: "How long the demand should last." },
  {
    key: "buildSimplicity",
    label: "Build simplicity",
    hint: "How cheap it is to ship. Higher means simpler.",
  },
  {
    key: "clusterPotential",
    label: "Cluster potential",
    hint: "How many adjacent utilities this could unlock.",
  },
];

const PROVIDER_SECTIONS = [
  {
    key: "keyword" as const,
    title: "Keyword provider",
    description: "Supplies search volume, difficulty and CPC.",
  },
  {
    key: "serp" as const,
    title: "SERP provider",
    description: "Supplies the ranking results for a keyword.",
  },
  {
    key: "ai" as const,
    title: "AI provider",
    description: "Produces the structured opportunity analysis.",
  },
  {
    key: "searchAnalytics" as const,
    title: "Search analytics provider",
    description: "Supplies impressions, clicks, CTR and position for live assets.",
  },
];

export function SettingsForm({
  settings,
  catalog,
}: {
  settings: Settings;
  catalog: Record<
    "keyword" | "serp" | "ai" | "searchAnalytics",
    ProviderOption[]
  >;
}) {
  const [state, formAction] = useActionState(saveSettingsAction, {});
  const [weights, setWeights] = useState<ScoringWeights>(settings.weights);

  const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0);
  const balanced = Math.round(total) === 100;

  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Scoring weights</CardTitle>
            <CardDescription>
              How much each factor can contribute to the 100-point opportunity score.
              Saving re-scores every opportunity so old and new scores never mix.
            </CardDescription>
          </div>
          <div className="text-right">
            <div
              className={cn(
                "tabular font-mono text-2xl font-semibold leading-none",
                balanced ? "text-[var(--positive)]" : "text-[var(--danger)]",
              )}
            >
              {Math.round(total)}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              must total 100
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WEIGHT_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label>
                <InfoTip label={field.hint}>{field.label}</InfoTip>
              </Label>
              <Input
                name={`weights.${field.key}`}
                type="number"
                min={0}
                max={100}
                value={weights[field.key]}
                onChange={(event) =>
                  setWeights((current) => ({
                    ...current,
                    [field.key]: Number(event.target.value),
                  }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decision thresholds</CardTitle>
          <CardDescription>
            Where the score turns into a recommendation. Must decrease:
            BUILD &gt; INVESTIGATE &gt; WATCH.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <NumberField
            name="thresholds.build"
            label="BUILD at or above"
            defaultValue={settings.thresholds.build}
          />
          <NumberField
            name="thresholds.investigate"
            label="INVESTIGATE at or above"
            defaultValue={settings.thresholds.investigate}
          />
          <NumberField
            name="thresholds.watch"
            label="WATCH at or above"
            defaultValue={settings.thresholds.watch}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demand calibration</CardTitle>
          <CardDescription>
            There is no universal formula for &ldquo;enough demand&rdquo;. Search volume is
            log-interpolated between these two points: at or below the floor scores 0,
            at or above the ceiling scores 100.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NumberField
            name="demandCalibration.floor"
            label="Floor (searches/mo scoring 0)"
            defaultValue={settings.demandCalibration.floor}
            min={1}
          />
          <NumberField
            name="demandCalibration.ceiling"
            label="Ceiling (searches/mo scoring 100)"
            defaultValue={settings.demandCalibration.ceiling}
            min={2}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {PROVIDER_SECTIONS.map((section) => {
          const options = catalog[section.key];
          const selected = settings.providers[section.key];

          return (
            <Card key={section.key}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  name={`providers.${section.key}`}
                  defaultValue={selected}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <ul className="space-y-1.5">
                  {options.map((option) => (
                    <li
                      key={option.id}
                      className="flex items-start gap-2 rounded-md border border-border px-2.5 py-2"
                    >
                      {option.configured ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--positive)]" />
                      ) : (
                        <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium">{option.label}</span>
                          <Badge variant={option.configured ? "positive" : "muted"}>
                            {option.configured ? "Configured" : "Not configured"}
                          </Badge>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {option.detail}
                        </p>
                        {option.requiredEnv.length ? (
                          <div className="flex flex-wrap gap-1">
                            {option.requiredEnv.map((key) => (
                              <code
                                key={key}
                                className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]"
                              >
                                {key}
                              </code>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>
            Applied to new opportunities and to CSV imports that do not carry these
            columns.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Default country</Label>
            <Input
              name="defaultCountry"
              defaultValue={settings.defaultCountry}
              maxLength={8}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default language</Label>
            <Input
              name="defaultLanguage"
              defaultValue={settings.defaultLanguage}
              maxLength={8}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Currency (ISO 4217)</Label>
            <Input
              name="currency"
              defaultValue={settings.currency}
              maxLength={3}
              minLength={3}
              required
            />
          </div>
        </CardContent>
      </Card>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.ok && state.message ? (
        <Alert variant="info">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {!balanced ? (
          <p className="text-xs text-[var(--danger)]">
            Weights total {Math.round(total)}. Adjust them to 100 before saving.
          </p>
        ) : null}
        <PendingButton disabled={!balanced}>Save settings</PendingButton>
      </div>
    </form>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min = 0,
}: {
  name: string;
  label: string;
  defaultValue: number;
  min?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input name={name} type="number" min={min} defaultValue={defaultValue} required />
    </div>
  );
}
