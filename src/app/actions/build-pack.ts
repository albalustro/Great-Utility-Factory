"use server";

import { revalidatePath } from "next/cache";

import { OK, toActionError, type ActionState } from "@/app/actions/shared";
import { getDataContext } from "@/lib/data";
import { generateBuildPack } from "@/lib/engine/build-pack";

/**
 * Generates a build pack from everything currently recorded for an opportunity.
 *
 * Each generation is stored as a new version rather than overwriting the last,
 * so a pack that was already handed to a build agent stays reproducible.
 */
export async function generateBuildPackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!opportunityId) return { ok: false, error: "Missing opportunity id." };

  try {
    const { store, settings } = await getDataContext();
    const opportunity = await store.getOpportunity(opportunityId);
    if (!opportunity) return { ok: false, error: "Opportunity not found." };

    const [serpResults, analyses, clusters, memberships] = await Promise.all([
      store.listSerpResults(opportunityId),
      store.listAnalyses(opportunityId),
      store.listClusters(),
      store.listClusterMemberships(),
    ]);

    const clusterIds = memberships
      .filter((m) => m.opportunityId === opportunityId)
      .map((m) => m.clusterId);

    const siblingIds = new Set(
      memberships
        .filter((m) => clusterIds.includes(m.clusterId) && m.opportunityId !== opportunityId)
        .map((m) => m.opportunityId),
    );

    const allOpportunities = await store.listOpportunities();
    const clusterSiblings = allOpportunities.filter((o) => siblingIds.has(o.id));

    const generated = generateBuildPack({
      opportunity,
      serpResults,
      analysis: analyses[0] ?? null,
      clusters: clusters.filter((c) => clusterIds.includes(c.id)),
      clusterSiblings,
      settings,
    });

    const pack = await store.createBuildPack({
      opportunityId,
      content: generated.content,
      claudeCodePrompt: generated.claudeCodePrompt,
      usedAiAnalysis: generated.usedAiAnalysis,
    });

    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: opportunityId,
      type: "BUILD_PACK_GENERATED",
      summary: `Build pack v${pack.version} generated${generated.usedAiAnalysis ? " using the latest AI analysis" : " from recorded data only"}.`,
      detail: {
        version: pack.version,
        assumptions: generated.content.assumptions.length,
      },
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/");
  return { ...OK, message: "Build pack generated." };
}
