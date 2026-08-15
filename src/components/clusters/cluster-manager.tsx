"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import { deleteClusterAction, saveClusterAction } from "@/app/actions/clusters";
import {
  addToClusterAction,
  removeFromClusterAction,
} from "@/app/actions/opportunities";
import { ConfirmActionForm, PendingButton } from "@/components/action-button";
import { StatusBadge } from "@/components/badges";
import { ScorePill } from "@/components/score";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  Cluster,
  DecisionThresholds,
  Opportunity,
} from "@/lib/domain/types";
import { formatInt } from "@/lib/format";

export function ClusterManager({
  clusters,
  opportunities,
  memberships,
  thresholds,
}: {
  clusters: Cluster[];
  opportunities: Opportunity[];
  memberships: Array<{ clusterId: string; opportunityId: string }>;
  thresholds: DecisionThresholds;
}) {
  const [editing, setEditing] = useState<Cluster | "new" | null>(null);
  const [addState, addAction] = useActionState(addToClusterAction, {});
  const [removeState, removeAction] = useActionState(removeFromClusterAction, {});

  const byId = new Map(opportunities.map((o) => [o.id, o]));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          New cluster
        </Button>
      </div>

      {editing ? (
        <ClusterForm
          cluster={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {[addState, removeState].map((state, index) =>
        state.error ? (
          <Alert key={index} variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null,
      )}

      {clusters.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-xs text-muted-foreground">
          No clusters yet. A good first cluster is the group of keywords your best
          opportunity naturally sits inside.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {clusters.map((cluster) => {
            const memberIds = memberships
              .filter((m) => m.clusterId === cluster.id)
              .map((m) => m.opportunityId);
            const members = memberIds
              .map((id) => byId.get(id))
              .filter((o): o is Opportunity => Boolean(o))
              .sort((a, b) => b.opportunityScore - a.opportunityScore);

            const available = opportunities.filter((o) => !memberIds.includes(o.id));
            const totalVolume = members.reduce(
              (sum, member) => sum + (member.searchVolume ?? 0),
              0,
            );
            const anyUnknownVolume = members.some((m) => m.searchVolume === null);

            return (
              <Card key={cluster.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      {cluster.name}
                      {cluster.isDemo ? <Badge variant="outline">DEMO</Badge> : null}
                    </CardTitle>
                    <CardDescription>
                      {cluster.description ?? "No description."}
                    </CardDescription>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {cluster.theme ? (
                        <Badge variant="muted">{cluster.theme}</Badge>
                      ) : null}
                      {cluster.domainCandidate ? (
                        <Badge variant="outline" className="font-mono">
                          {cluster.domainCandidate}
                        </Badge>
                      ) : null}
                      <Badge variant="muted">
                        {members.length} opportunit{members.length === 1 ? "y" : "ies"}
                      </Badge>
                      <Badge variant="muted">
                        {formatInt(totalVolume)}
                        {anyUnknownVolume ? "+" : ""} searches/mo
                      </Badge>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Edit cluster"
                      onClick={() => setEditing(cluster)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <ConfirmActionForm
                      action={deleteClusterAction}
                      hidden={{ id: cluster.id }}
                      title={`Delete cluster "${cluster.name}"?`}
                      description="The cluster is removed. The opportunities inside it are kept."
                      confirmLabel="Delete cluster"
                      trigger={
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Delete cluster"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                    />
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nothing in this cluster yet.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {members.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                        >
                          <Link
                            href={`/opportunities/${member.id}`}
                            className="min-w-0 flex-1 truncate text-sm hover:underline"
                          >
                            {member.keyword}
                          </Link>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge status={member.status} />
                            <ScorePill
                              score={member.opportunityScore}
                              thresholds={thresholds}
                              showDecision={false}
                            />
                            <form action={removeAction}>
                              <input
                                type="hidden"
                                name="clusterId"
                                value={cluster.id}
                              />
                              <input
                                type="hidden"
                                name="opportunityId"
                                value={member.id}
                              />
                              <Button
                                type="submit"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Remove ${member.keyword} from ${cluster.name}`}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {available.length ? (
                    <form action={addAction} className="flex items-center gap-2">
                      <input type="hidden" name="clusterId" value={cluster.id} />
                      <select
                        name="opportunityId"
                        defaultValue=""
                        className="h-8 flex-1 rounded-md border border-input bg-card px-2 text-xs shadow-sm"
                      >
                        <option value="" disabled>
                          Add an opportunity…
                        </option>
                        {available.map((opportunity) => (
                          <option key={opportunity.id} value={opportunity.id}>
                            {opportunity.keyword}
                          </option>
                        ))}
                      </select>
                      <PendingButton size="sm" variant="outline">
                        Add
                      </PendingButton>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClusterForm({
  cluster,
  onClose,
}: {
  cluster?: Cluster;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(saveClusterAction, {});

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{cluster ? `Edit ${cluster.name}` : "New cluster"}</CardTitle>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
          <X className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          {cluster ? <input type="hidden" name="id" value={cluster.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" required defaultValue={cluster?.name} />
            </div>
            <div className="space-y-1">
              <Label>Theme</Label>
              <Input
                name="theme"
                defaultValue={cluster?.theme ?? ""}
                placeholder="Freelance finance"
              />
            </div>
            <div className="space-y-1">
              <Label>Domain candidate</Label>
              <Input
                name="domainCandidate"
                defaultValue={cluster?.domainCandidate ?? ""}
                placeholder="freelancemath.example"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              name="description"
              rows={2}
              defaultValue={cluster?.description ?? ""}
              placeholder="What holds these utilities together?"
            />
          </div>

          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <PendingButton size="sm">
              {cluster ? "Save cluster" : "Create cluster"}
            </PendingButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
