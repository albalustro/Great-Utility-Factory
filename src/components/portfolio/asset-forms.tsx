"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

import {
  addAssetMetricAction,
  createAssetAction,
  setAssetDecisionAction,
  updateAssetAction,
} from "@/app/actions/assets";
import { PendingButton } from "@/components/action-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/ui/tooltip";
import {
  ASSET_DECISIONS,
  type Asset,
  type AssetDecision,
  type Opportunity,
} from "@/lib/domain/types";

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
      {error ? <p className="mt-1 text-[11px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function AssetForm({
  asset,
  opportunities,
  mode,
}: {
  asset?: Asset;
  opportunities: Opportunity[];
  mode: "create" | "edit";
}) {
  const [state, formAction] = useActionState(
    mode === "create" ? createAssetAction : updateAssetAction,
    {},
  );
  const error = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={formAction} className="space-y-4">
      {asset ? <input type="hidden" name="id" value={asset.id} /> : null}
      <input
        type="hidden"
        name="assetDecision"
        value={asset?.assetDecision ?? "WAIT"}
      />
      <input type="hidden" name="decisionNote" value={asset?.decisionNote ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={error("name")}>
          <Input name="name" required defaultValue={asset?.name} placeholder="Dog Age Calculator" />
        </Field>

        <Field
          label="Linked opportunity"
          hint="Links measurement back to the research that justified building it."
        >
          <select
            name="opportunityId"
            defaultValue={asset?.opportunityId ?? ""}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
          >
            <option value="">Not linked</option>
            {opportunities.map((opportunity) => (
              <option key={opportunity.id} value={opportunity.id}>
                {opportunity.keyword}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Domain">
          <Input name="domain" defaultValue={asset?.domain ?? ""} placeholder="petmath.example" />
        </Field>

        <Field label="URL">
          <Input name="url" defaultValue={asset?.url ?? ""} placeholder="https://…" />
        </Field>

        <Field label="Published" hint="Starts the checkpoint clock.">
          <Input
            name="publishedAt"
            type="date"
            defaultValue={toDateInput(asset?.publishedAt ?? null)}
          />
        </Field>

        <Field
          label="Indexed"
          hint="Leave empty until you have confirmed indexation. Empty is not the same as 'not indexed'."
        >
          <Input
            name="indexedAt"
            type="date"
            defaultValue={toDateInput(asset?.indexedAt ?? null)}
          />
        </Field>

        <Field
          label="Measurement period label"
          hint="Free text describing what the latest window covers, e.g. 'Last 30 days'."
          className="sm:col-span-2"
        >
          <Input
            name="measurementPeriod"
            defaultValue={asset?.measurementPeriod ?? ""}
            placeholder="Last 30 days"
          />
        </Field>
      </div>

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

      <div className="flex justify-end">
        <PendingButton>{mode === "create" ? "Add asset" : "Save asset"}</PendingButton>
      </div>
    </form>
  );
}

export function MetricEntryForm({ assetId }: { assetId: string }) {
  const [state, formAction] = useActionState(addAssetMetricAction, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Record metrics
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-md border border-border bg-muted/20 p-3"
    >
      <input type="hidden" name="assetId" value={assetId} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Period start" error={state.fieldErrors?.periodStart}>
          <Input name="periodStart" type="date" required />
        </Field>
        <Field label="Period end" error={state.fieldErrors?.periodEnd}>
          <Input name="periodEnd" type="date" required />
        </Field>
        <Field label="Impressions" hint="Leave empty if you do not have the number.">
          <Input name="impressions" type="number" min={0} placeholder="unknown" />
        </Field>
        <Field label="Clicks">
          <Input name="clicks" type="number" min={0} placeholder="unknown" />
        </Field>
        <Field
          label="Average position"
          hint="Lower is better. Leave empty when unknown."
        >
          <Input
            name="averagePosition"
            type="number"
            min={0}
            step="0.1"
            placeholder="unknown"
          />
        </Field>
        <Field label="Pageviews">
          <Input name="pageviews" type="number" min={0} placeholder="unknown" />
        </Field>
        <Field label="Revenue">
          <Input name="revenue" type="number" min={0} step="0.01" placeholder="unknown" />
        </Field>
        <Field label="Notes" className="lg:col-span-1">
          <Input name="notes" placeholder="Anything worth remembering" />
        </Field>
      </div>

      <p className="text-[11px] text-muted-foreground">
        CTR is derived from clicks ÷ impressions, so the three numbers can never
        disagree. If impressions are unknown, CTR stays unknown.
      </p>

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

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
        <PendingButton size="sm">Save metrics</PendingButton>
      </div>
    </form>
  );
}

export function DecisionControl({
  assetId,
  current,
  recommended,
  note,
}: {
  assetId: string;
  current: AssetDecision;
  recommended: AssetDecision;
  note: string | null;
}) {
  const [state, formAction] = useActionState(setAssetDecisionAction, {});
  const [selected, setSelected] = useState<AssetDecision>(current);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="assetId" value={assetId} />

      <div className="flex flex-wrap gap-1.5">
        {ASSET_DECISIONS.map((decision) => (
          <label
            key={decision}
            className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              selected === decision
                ? "border-primary bg-secondary"
                : "border-border hover:bg-accent"
            }`}
          >
            <input
              type="radio"
              name="assetDecision"
              value={decision}
              checked={selected === decision}
              onChange={() => setSelected(decision)}
              className="sr-only"
            />
            {decision}
            {decision === recommended ? (
              <span className="ml-1 text-[10px] text-muted-foreground">rec.</span>
            ) : null}
          </label>
        ))}
      </div>

      {selected !== recommended ? (
        <Field
          label="Why are you overriding the recommendation?"
          hint="Recorded in the activity log so the reasoning survives."
        >
          <Textarea
            name="decisionNote"
            rows={2}
            defaultValue={note ?? ""}
            placeholder="e.g. Traffic is seasonal — giving it another quarter."
          />
        </Field>
      ) : (
        <input type="hidden" name="decisionNote" value={note ?? ""} />
      )}

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

      {selected !== current ? <PendingButton size="sm">Save decision</PendingButton> : null}
    </form>
  );
}
