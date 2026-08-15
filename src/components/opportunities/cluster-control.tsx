"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";

import {
  addToClusterAction,
  removeFromClusterAction,
} from "@/app/actions/opportunities";
import { saveClusterAction } from "@/app/actions/clusters";
import { PendingButton } from "@/components/action-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Cluster } from "@/lib/domain/types";

/** Adds an opportunity to an existing cluster, or spins up a new one in place. */
export function ClusterControl({
  opportunityId,
  clusters,
  memberOf,
}: {
  opportunityId: string;
  clusters: Cluster[];
  memberOf: Cluster[];
}) {
  const [addState, addAction] = useActionState(addToClusterAction, {});
  const [removeState, removeAction] = useActionState(removeFromClusterAction, {});
  const [createState, createAction] = useActionState(saveClusterAction, {});
  const [creating, setCreating] = useState(false);

  const memberIds = new Set(memberOf.map((cluster) => cluster.id));
  const available = clusters.filter((cluster) => !memberIds.has(cluster.id));

  return (
    <div className="space-y-3">
      {memberOf.length ? (
        <div className="flex flex-wrap gap-1.5">
          {memberOf.map((cluster) => (
            <form key={cluster.id} action={removeAction}>
              <input type="hidden" name="opportunityId" value={opportunityId} />
              <input type="hidden" name="clusterId" value={cluster.id} />
              <Badge variant="info" className="gap-1 pr-1">
                {cluster.name}
                <button
                  type="submit"
                  aria-label={`Remove from ${cluster.name}`}
                  className="rounded p-0.5 hover:bg-black/10"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </form>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Not in a cluster. Clusters are how one winning utility turns into five.
        </p>
      )}

      {available.length ? (
        <form action={addAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <select
            name="clusterId"
            defaultValue=""
            className="h-8 rounded-md border border-input bg-card px-2 text-xs shadow-sm"
          >
            <option value="" disabled>
              Add to cluster…
            </option>
            {available.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.name}
              </option>
            ))}
          </select>
          <PendingButton size="sm" variant="outline">
            Add
          </PendingButton>
        </form>
      ) : null}

      {creating ? (
        <form action={createAction} className="space-y-2 rounded-md border border-border p-3">
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <div className="space-y-1">
            <Label>Cluster name</Label>
            <Input name="name" required placeholder="Freelance Calculators" />
          </div>
          <div className="space-y-1">
            <Label>Theme</Label>
            <Input name="theme" placeholder="Freelance finance" />
          </div>
          <div className="space-y-1">
            <Label>Domain candidate</Label>
            <Input name="domainCandidate" placeholder="freelancemath.example" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea name="description" rows={2} />
          </div>
          <div className="flex gap-2">
            <PendingButton size="sm">Create and add</PendingButton>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New cluster
        </Button>
      )}

      {[addState, removeState, createState].map((state, index) =>
        state.error ? (
          <Alert key={index} variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null,
      )}
    </div>
  );
}
