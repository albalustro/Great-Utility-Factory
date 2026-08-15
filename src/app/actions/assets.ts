"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  OK,
  parseForm,
  toActionError,
  type ActionState,
} from "@/app/actions/shared";
import { getDataContext } from "@/lib/data";
import {
  assetDecisionSchema,
  assetInputSchema,
  assetMetricInputSchema,
} from "@/lib/domain/schemas";
import { reviewAsset } from "@/lib/engine/checkpoints";
import { formatInt } from "@/lib/format";

function revalidateAsset(id?: string) {
  revalidatePath("/");
  revalidatePath("/portfolio");
  if (id) revalidatePath(`/portfolio/${id}`);
}

export async function createAssetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(assetInputSchema, formData);
  if (parsed.errors) return parsed.errors;

  let assetId: string;
  try {
    const { store } = await getDataContext();
    const asset = await store.createAsset(parsed.data);

    await store.appendActivity({
      entityType: "ASSET",
      entityId: asset.id,
      type: "ASSET_PUBLISHED",
      summary: `Asset "${asset.name}" added to the portfolio.`,
      detail: { url: asset.url, publishedAt: asset.publishedAt },
    });

    // Publishing an asset moves its opportunity out of the build queue.
    if (asset.opportunityId) {
      const opportunity = await store.getOpportunity(asset.opportunityId);
      if (
        opportunity &&
        ["READY_TO_BUILD", "BUILDING", "QUALIFIED"].includes(opportunity.status)
      ) {
        await store.setOpportunityStatus(
          opportunity.id,
          "PUBLISHED",
          "Asset published from the portfolio.",
        );
        revalidatePath(`/opportunities/${opportunity.id}`);
        revalidatePath("/pipeline");
      }
    }

    assetId = asset.id;
  } catch (error) {
    return toActionError(error);
  }

  revalidateAsset(assetId);
  redirect(`/portfolio/${assetId}`);
}

export async function updateAssetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing asset id." };

  const parsed = parseForm(assetInputSchema, formData);
  if (parsed.errors) return parsed.errors;

  try {
    const { store } = await getDataContext();
    const asset = await store.updateAsset(id, parsed.data);
    await store.appendActivity({
      entityType: "ASSET",
      entityId: id,
      type: "ASSET_METRICS_UPDATED",
      summary: `Asset "${asset.name}" details updated.`,
      detail: null,
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidateAsset(id);
  return { ...OK, message: "Saved." };
}

export async function deleteAssetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing asset id." };

  try {
    const { store } = await getDataContext();
    await store.deleteAsset(id);
  } catch (error) {
    return toActionError(error);
  }

  revalidateAsset();
  redirect("/portfolio");
}

/**
 * Records a measurement window.
 *
 * CTR is derived from clicks/impressions when both are known rather than being
 * typed in, so the three numbers can never disagree. When impressions are
 * unknown, CTR stays unknown.
 */
export async function addAssetMetricAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const assetId = String(formData.get("assetId") ?? "");
  if (!assetId) return { ok: false, error: "Missing asset id." };

  const impressionsRaw = formData.get("impressions");
  const clicksRaw = formData.get("clicks");
  const impressions = impressionsRaw ? Number(impressionsRaw) : null;
  const clicks = clicksRaw ? Number(clicksRaw) : null;

  const derivedCtr =
    impressions !== null && impressions > 0 && clicks !== null
      ? Math.min(1, clicks / impressions)
      : impressions === 0
        ? 0
        : null;

  if (derivedCtr !== null) {
    formData.set("ctr", String(Number(derivedCtr.toFixed(4))));
  } else {
    formData.set("ctr", "");
  }

  const parsed = parseForm(assetMetricInputSchema, formData);
  if (parsed.errors) return parsed.errors;

  try {
    const { store } = await getDataContext();
    const metric = await store.createAssetMetric(assetId, parsed.data);
    const asset = await store.getAsset(assetId);

    await store.appendActivity({
      entityType: "ASSET",
      entityId: assetId,
      type: "ASSET_METRICS_UPDATED",
      summary: `Metrics recorded for ${metric.periodStart.slice(0, 10)} → ${metric.periodEnd.slice(0, 10)}: ${formatInt(metric.impressions)} impressions, ${formatInt(metric.clicks)} clicks.`,
      detail: {
        impressions: metric.impressions,
        clicks: metric.clicks,
        ctr: metric.ctr,
        averagePosition: metric.averagePosition,
        revenue: metric.revenue,
      },
    });

    // Surface the fresh recommendation immediately; never apply it silently.
    if (asset) {
      const metrics = await store.listAssetMetrics(assetId);
      const review = reviewAsset(asset, metrics);
      if (review.recommendedDecision !== asset.assetDecision) {
        return {
          ...OK,
          message: `Metrics saved. The checkpoint rules now recommend ${review.recommendedDecision} — the stored decision is unchanged until you apply it.`,
        };
      }
    }
  } catch (error) {
    return toActionError(error);
  }

  revalidateAsset(assetId);
  return { ...OK, message: "Metrics saved." };
}

export async function deleteAssetMetricAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  if (!id || !assetId) return { ok: false, error: "Missing identifiers." };

  try {
    const { store } = await getDataContext();
    await store.deleteAssetMetric(id);
  } catch (error) {
    return toActionError(error);
  }

  revalidateAsset(assetId);
  return OK;
}

export async function setAssetDecisionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = assetDecisionSchema.safeParse({
    assetId: formData.get("assetId"),
    assetDecision: formData.get("assetDecision"),
    decisionNote: formData.get("decisionNote"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid decision." };

  try {
    const { store } = await getDataContext();
    const before = await store.getAsset(parsed.data.assetId);
    if (!before) return { ok: false, error: "Asset not found." };

    const metrics = await store.listAssetMetrics(parsed.data.assetId);
    const review = reviewAsset(before, metrics);

    await store.updateAsset(parsed.data.assetId, {
      assetDecision: parsed.data.assetDecision,
      decisionNote: parsed.data.decisionNote,
    });

    const overriding = review.recommendedDecision !== parsed.data.assetDecision;

    await store.appendActivity({
      entityType: "ASSET",
      entityId: parsed.data.assetId,
      type: "DECISION_CHANGED",
      summary: `Decision changed from ${before.assetDecision} to ${parsed.data.assetDecision}${
        overriding ? ` (overriding the recommended ${review.recommendedDecision})` : ""
      }.`,
      detail: {
        from: before.assetDecision,
        to: parsed.data.assetDecision,
        recommended: review.recommendedDecision,
        note: parsed.data.decisionNote,
      },
    });

    // Keep the linked opportunity's status honest about the outcome.
    if (before.opportunityId) {
      const opportunity = await store.getOpportunity(before.opportunityId);
      if (opportunity) {
        const nextStatus =
          parsed.data.assetDecision === "SCALE"
            ? "WINNER"
            : parsed.data.assetDecision === "KILL"
              ? "KILLED"
              : null;
        if (nextStatus && opportunity.status !== nextStatus) {
          await store.setOpportunityStatus(
            opportunity.id,
            nextStatus,
            `Asset decision set to ${parsed.data.assetDecision}.`,
          );
          revalidatePath(`/opportunities/${opportunity.id}`);
          revalidatePath("/pipeline");
        }
      }
    }
  } catch (error) {
    return toActionError(error);
  }

  revalidateAsset(parsed.data.assetId);
  return { ...OK, message: "Decision saved." };
}
