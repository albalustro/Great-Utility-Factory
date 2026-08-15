"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { refreshKeywordMetricsAction } from "@/app/actions/provider";
import { PendingButton } from "@/components/action-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/format";
import type { ProviderStatus } from "@/lib/providers/types";

/**
 * Provenance line plus the refresh control for an opportunity's keyword metrics.
 *
 * Provenance is shown even when nothing has been fetched, because "you typed
 * these in" and "a provider measured these on Tuesday" carry very different
 * weight when deciding whether to build something.
 */
export function ProviderMetricsControl({
  opportunityId,
  metricsProvider,
  metricsFetchedAt,
  providerStatus,
}: {
  opportunityId: string;
  metricsProvider: string | null;
  metricsFetchedAt: string | null;
  providerStatus: ProviderStatus;
}) {
  const [state, formAction] = useActionState(refreshKeywordMetricsAction, {});

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {metricsProvider && metricsFetchedAt
            ? `Fetched from ${metricsProvider} on ${formatDateTime(metricsFetchedAt)}.`
            : "Entered by hand — no provider has supplied these numbers."}
        </p>

        {providerStatus.configured ? (
          <form action={formAction}>
            <input type="hidden" name="opportunityId" value={opportunityId} />
            <PendingButton size="sm" variant="outline">
              <RefreshCw className="size-3.5" />
              Refresh from {providerStatus.label}
            </PendingButton>
          </form>
        ) : (
          <p className="text-[11px] text-muted-foreground">{providerStatus.detail}</p>
        )}
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
    </div>
  );
}
