"use server";

import { revalidatePath } from "next/cache";

import {
  OK,
  parseForm,
  toActionError,
  type ActionState,
} from "@/app/actions/shared";
import { getDataContext } from "@/lib/data";
import { clusterInputSchema } from "@/lib/domain/schemas";

export async function saveClusterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const parsed = parseForm(clusterInputSchema, formData);
  if (parsed.errors) return parsed.errors;

  try {
    const { store } = await getDataContext();
    const cluster = id
      ? await store.updateCluster(id, parsed.data)
      : await store.createCluster(parsed.data);

    // A cluster can be created straight from an opportunity page; link it here
    // so the operator does not have to do it as a second step.
    const opportunityId = String(formData.get("opportunityId") ?? "");
    if (opportunityId) {
      await store.addOpportunityToCluster(cluster.id, opportunityId);
      revalidatePath(`/opportunities/${opportunityId}`);
    }

    await store.appendActivity({
      entityType: "CLUSTER",
      entityId: cluster.id,
      type: "CLUSTER_UPDATED",
      summary: id
        ? `Cluster "${cluster.name}" updated.`
        : `Cluster "${cluster.name}" created.`,
      detail: null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/clusters");
  return { ...OK, message: id ? "Cluster updated." : "Cluster created." };
}

export async function deleteClusterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing cluster id." };

  try {
    const { store } = await getDataContext();
    const cluster = await store.getCluster(id);
    await store.deleteCluster(id);

    if (cluster) {
      await store.appendActivity({
        entityType: "CLUSTER",
        entityId: id,
        type: "CLUSTER_UPDATED",
        summary: `Cluster "${cluster.name}" deleted. Its opportunities were kept.`,
        detail: null,
      });
    }
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/clusters");
  revalidatePath("/opportunities");
  return OK;
}
