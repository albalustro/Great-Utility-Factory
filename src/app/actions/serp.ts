"use server";

import { revalidatePath } from "next/cache";

import {
  OK,
  parseForm,
  recalculateScore,
  toActionError,
  type ActionState,
} from "@/app/actions/shared";
import { getDataContext } from "@/lib/data";
import { serpResultInputSchema } from "@/lib/domain/schemas";
import { summarizeSerp } from "@/lib/scoring/serp";

function revalidate(opportunityId: string) {
  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/opportunities");
  revalidatePath("/");
}

export async function saveSerpResultAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!opportunityId) return { ok: false, error: "Missing opportunity id." };

  const parsed = parseForm(serpResultInputSchema, formData);
  if (parsed.errors) return parsed.errors;

  try {
    const { store } = await getDataContext();

    if (id) {
      await store.updateSerpResult(id, parsed.data);
    } else {
      await store.createSerpResult(opportunityId, parsed.data);
    }

    const results = await store.listSerpResults(opportunityId);
    const summary = summarizeSerp(results);

    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: opportunityId,
      type: "SERP_UPDATED",
      summary: id
        ? `SERP result #${parsed.data.position} (${parsed.data.domain}) updated.`
        : `SERP result #${parsed.data.position} (${parsed.data.domain}) recorded.`,
      detail: {
        capturedResults: summary.resultCount,
        suggestedWeakness: summary.suggestedWeaknessScore,
      },
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidate(opportunityId);
  return { ...OK, message: "SERP result saved." };
}

export async function deleteSerpResultAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!id || !opportunityId) return { ok: false, error: "Missing identifiers." };

  try {
    const { store } = await getDataContext();
    await store.deleteSerpResult(id);
    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: opportunityId,
      type: "SERP_UPDATED",
      summary: "SERP result removed.",
      detail: null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidate(opportunityId);
  return OK;
}

/**
 * Copies the evidence-derived weakness suggestion onto the opportunity.
 *
 * This is always an explicit operator action — the suggestion is never applied
 * automatically, because the stored score is a judgement the operator owns.
 */
export async function applySuggestedWeaknessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!opportunityId) return { ok: false, error: "Missing opportunity id." };

  try {
    const { store, settings } = await getDataContext();
    const results = await store.listSerpResults(opportunityId);
    const summary = summarizeSerp(results);

    if (summary.suggestedWeaknessScore === null) {
      return {
        ok: false,
        error:
          "Not enough SERP data to suggest a weakness score. Capture more results first.",
      };
    }

    const updated = await store.updateOpportunity(opportunityId, {
      serpWeaknessScore: summary.suggestedWeaknessScore,
    });

    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: opportunityId,
      type: "METRICS_CHANGED",
      summary: `SERP weakness set to ${summary.suggestedWeaknessScore}/100 from the captured SERP evidence.`,
      detail: { signals: summary.signals },
    });

    await recalculateScore(store, settings, updated);
  } catch (error) {
    return toActionError(error);
  }

  revalidate(opportunityId);
  return { ...OK, message: "SERP weakness applied." };
}
