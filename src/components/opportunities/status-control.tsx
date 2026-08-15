"use client";

import { useActionState, useState } from "react";

import { changeStatusAction } from "@/app/actions/opportunities";
import { PendingButton } from "@/components/action-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  type OpportunityStatus,
} from "@/lib/domain/types";

/** Inline status changer with an optional note, recorded in status history. */
export function StatusControl({
  opportunityId,
  status,
}: {
  opportunityId: string;
  status: OpportunityStatus;
}) {
  const [state, formAction] = useActionState(changeStatusAction, {});
  const [next, setNext] = useState<OpportunityStatus>(status);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <select
          name="status"
          value={next}
          onChange={(event) => setNext(event.target.value as OpportunityStatus)}
          className="h-8 rounded-md border border-input bg-card px-2 text-xs shadow-sm"
        >
          {OPPORTUNITY_STATUSES.map((option) => (
            <option key={option} value={option}>
              {OPPORTUNITY_STATUS_LABELS[option]}
            </option>
          ))}
        </select>

        {next !== status ? (
          <>
            <Input
              name="note"
              placeholder="Why? (optional)"
              className="h-8 w-56 text-xs"
            />
            <PendingButton size="sm">Move</PendingButton>
          </>
        ) : null}
      </form>

      {state.error ? (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
