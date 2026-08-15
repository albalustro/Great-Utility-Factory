"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  OK,
  parseForm,
  recalculateScore,
  toActionError,
  type ActionState,
} from "@/app/actions/shared";
import { getDataContext } from "@/lib/data";
import {
  opportunityFormSchema,
  statusChangeSchema,
} from "@/lib/domain/schemas";
import type { Opportunity, OpportunityStatus } from "@/lib/domain/types";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/domain/types";

function revalidateOpportunity(id?: string) {
  revalidatePath("/");
  revalidatePath("/opportunities");
  revalidatePath("/pipeline");
  if (id) revalidatePath(`/opportunities/${id}`);
}

export async function createOpportunityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(opportunityFormSchema, formData);
  if (parsed.errors) return parsed.errors;

  let createdId: string;
  try {
    const { store, settings } = await getDataContext();
    const created = await store.createOpportunity(parsed.data);
    await recalculateScore(store, settings, created);

    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: created.id,
      type: "OPPORTUNITY_CREATED",
      summary: `Opportunity "${created.keyword}" created.`,
      detail: { source: created.source, status: created.status },
    });

    createdId = created.id;
  } catch (error) {
    return toActionError(error);
  }

  revalidateOpportunity(createdId);
  redirect(`/opportunities/${createdId}`);
}

export async function updateOpportunityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing opportunity id." };

  const parsed = parseForm(opportunityFormSchema, formData);
  if (parsed.errors) return parsed.errors;

  try {
    const { store, settings } = await getDataContext();
    const before = await store.getOpportunity(id);
    if (!before) return { ok: false, error: "Opportunity not found." };

    const updated = await store.updateOpportunity(id, parsed.data);

    const metricChanges = describeMetricChanges(before, updated);
    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: id,
      type: metricChanges.length ? "METRICS_CHANGED" : "OPPORTUNITY_UPDATED",
      summary: metricChanges.length
        ? `Metrics updated: ${metricChanges.join(", ")}.`
        : `Opportunity "${updated.keyword}" updated.`,
      detail: metricChanges.length ? { changes: metricChanges } : null,
    });

    if (before.status !== updated.status) {
      await store.setOpportunityStatus(id, updated.status, "Changed from the edit form.");
    }

    await recalculateScore(store, settings, updated);
  } catch (error) {
    return toActionError(error);
  }

  revalidateOpportunity(id);
  return { ...OK, message: "Saved." };
}

function describeMetricChanges(
  beforeRecord: Opportunity,
  afterRecord: Opportunity,
): string[] {
  const before = beforeRecord as unknown as Record<string, unknown>;
  const after = afterRecord as unknown as Record<string, unknown>;
  const watched: Array<[string, string]> = [
    ["searchVolume", "search volume"],
    ["keywordDifficulty", "keyword difficulty"],
    ["cpc", "CPC"],
    ["serpWeaknessScore", "SERP weakness"],
    ["utilityFitScore", "utility fit"],
    ["monetizationScore", "monetization"],
    ["evergreenScore", "evergreen"],
    ["buildSimplicityScore", "build simplicity"],
    ["clusterPotentialScore", "cluster potential"],
    ["demandScoreOverride", "demand override"],
  ];

  const format = (value: unknown) =>
    value === null || value === undefined ? "unknown" : String(value);

  return watched
    .filter(([key]) => before[key] !== after[key])
    .map(([key, label]) => `${label} ${format(before[key])} → ${format(after[key])}`);
}

export async function changeStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = statusChangeSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    status: formData.get("status"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Invalid status change." };
  }

  try {
    const { store } = await getDataContext();
    const before = await store.getOpportunity(parsed.data.opportunityId);
    if (!before) return { ok: false, error: "Opportunity not found." };

    if (before.status === parsed.data.status) return OK;

    await store.setOpportunityStatus(
      parsed.data.opportunityId,
      parsed.data.status,
      parsed.data.note,
    );

    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: parsed.data.opportunityId,
      type: "STATUS_CHANGED",
      summary: `Status changed from ${OPPORTUNITY_STATUS_LABELS[before.status]} to ${OPPORTUNITY_STATUS_LABELS[parsed.data.status]}.`,
      detail: { from: before.status, to: parsed.data.status, note: parsed.data.note },
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidateOpportunity(parsed.data.opportunityId);
  return OK;
}

/** Used by the pipeline board's drag-and-drop. */
export async function moveOpportunityAction(
  opportunityId: string,
  status: OpportunityStatus,
): Promise<ActionState> {
  const formData = new FormData();
  formData.set("opportunityId", opportunityId);
  formData.set("status", status);
  formData.set("note", "Moved on the pipeline board.");
  return changeStatusAction({}, formData);
}

export async function deleteOpportunityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing opportunity id." };

  try {
    const { store } = await getDataContext();
    const existing = await store.getOpportunity(id);
    if (!existing) return { ok: false, error: "Opportunity not found." };

    await store.deleteOpportunity(id);
    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: id,
      type: "OPPORTUNITY_DELETED",
      summary: `Opportunity "${existing.keyword}" deleted.`,
      detail: null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidateOpportunity();
  redirect("/opportunities");
}

const clusterLinkSchema = z.object({
  opportunityId: z.string().min(1),
  clusterId: z.string().min(1),
});

export async function addToClusterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = clusterLinkSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    clusterId: formData.get("clusterId"),
  });
  if (!parsed.success) return { ok: false, error: "Select a cluster first." };

  try {
    const { store } = await getDataContext();
    const [cluster, opportunity] = await Promise.all([
      store.getCluster(parsed.data.clusterId),
      store.getOpportunity(parsed.data.opportunityId),
    ]);
    if (!cluster || !opportunity) {
      return { ok: false, error: "Cluster or opportunity not found." };
    }

    await store.addOpportunityToCluster(
      parsed.data.clusterId,
      parsed.data.opportunityId,
    );
    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: parsed.data.opportunityId,
      type: "CLUSTER_UPDATED",
      summary: `Added to cluster "${cluster.name}".`,
      detail: { clusterId: cluster.id },
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidateOpportunity(parsed.data.opportunityId);
  revalidatePath("/clusters");
  return { ...OK, message: "Added to cluster." };
}

export async function removeFromClusterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = clusterLinkSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    clusterId: formData.get("clusterId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  try {
    const { store } = await getDataContext();
    await store.removeOpportunityFromCluster(
      parsed.data.clusterId,
      parsed.data.opportunityId,
    );
  } catch (error) {
    return toActionError(error);
  }

  revalidateOpportunity(parsed.data.opportunityId);
  revalidatePath("/clusters");
  return OK;
}
