"use server";

import { revalidatePath } from "next/cache";

import {
  OK,
  recalculateScore,
  toActionError,
  type ActionState,
} from "@/app/actions/shared";
import { getDataContext } from "@/lib/data";
import type { SerpResultInput } from "@/lib/domain/schemas";
import { getProviders } from "@/lib/providers/registry";
import { ProviderNotConfiguredError } from "@/lib/providers/types";
import { formatInt } from "@/lib/format";

/**
 * Pulling live provider data onto an existing opportunity.
 *
 * Both actions overwrite measured fields and leave judgement fields alone. That
 * split is the whole design: a provider can tell us how many people search for
 * something, but nothing in this integration can tell us whether a competitor is
 * weak, so those flags stay exactly where the operator left them.
 */

const SERP_DEPTH = 10;

function revalidate(opportunityId: string) {
  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/opportunities");
  revalidatePath("/");
}

export async function refreshKeywordMetricsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!opportunityId) return { ok: false, error: "Missing opportunity id." };

  try {
    const { store, settings } = await getDataContext();
    const opportunity = await store.getOpportunity(opportunityId);
    if (!opportunity) return { ok: false, error: "Opportunity not found." };

    const { keyword: provider } = getProviders(settings.providers);
    const [metrics] = await provider.lookup({
      keywords: [opportunity.keyword],
      country: opportunity.country,
      language: opportunity.language,
    });

    if (!metrics) {
      return {
        ok: false,
        error: `${provider.label} has no data for "${opportunity.keyword}" in ${opportunity.country}/${opportunity.language}. Nothing was changed.`,
      };
    }

    const fetchedAt = new Date().toISOString();

    // Written wholesale, nulls included. A provider that has stopped reporting a
    // CPC must clear the old one rather than leave a stale number looking fresh.
    const updated = await store.updateOpportunity(opportunityId, {
      searchVolume: metrics.searchVolume,
      keywordDifficulty: metrics.keywordDifficulty,
      cpc: metrics.cpc,
      competitionIndex: metrics.competitionIndex,
      competitionLevel: metrics.competitionLevel,
      trend: metrics.trend,
      metricsProvider: provider.id,
      metricsFetchedAt: fetchedAt,
    });

    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: opportunityId,
      type: "METRICS_CHANGED",
      summary: `Keyword metrics refreshed from ${provider.label}.`,
      detail: {
        provider: provider.id,
        fetchedAt,
        previous: {
          searchVolume: opportunity.searchVolume,
          keywordDifficulty: opportunity.keywordDifficulty,
          cpc: opportunity.cpc,
        },
        next: {
          searchVolume: metrics.searchVolume,
          keywordDifficulty: metrics.keywordDifficulty,
          cpc: metrics.cpc,
          competitionIndex: metrics.competitionIndex,
          competitionLevel: metrics.competitionLevel,
          trend: metrics.trend,
        },
      },
    });

    await recalculateScore(store, settings, updated);
    revalidate(opportunityId);

    return {
      ...OK,
      message: `Updated from ${provider.label}: ${
        metrics.searchVolume === null
          ? "no search volume reported"
          : `${formatInt(metrics.searchVolume)} searches/mo`
      }.`,
    };
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return { ok: false, error: error.message };
    }
    return toActionError(error);
  }
}

export async function fetchSerpFromProviderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!opportunityId) return { ok: false, error: "Missing opportunity id." };

  try {
    const { store, settings } = await getDataContext();
    const opportunity = await store.getOpportunity(opportunityId);
    if (!opportunity) return { ok: false, error: "Opportunity not found." };

    const { serp: provider } = getProviders(settings.providers);
    const fetched = await provider.fetchSerp({
      keyword: opportunity.keyword,
      country: opportunity.country,
      language: opportunity.language,
      limit: SERP_DEPTH,
    });

    if (fetched.length === 0) {
      return {
        ok: false,
        error: `${provider.label} returned no organic results for "${opportunity.keyword}". Nothing was changed.`,
      };
    }

    const fetchedAt = new Date().toISOString();

    const results: SerpResultInput[] = fetched.map((row) => ({
      position: row.position,
      domain: row.domain,
      url: row.url,
      title: row.title,
      // Deliberately unset. The SERP endpoint measures none of these, and
      // guessing them would manufacture the "weak SERP" verdict that the
      // scoring engine is supposed to earn from real review.
      domainAuthority: null,
      pageType: "OTHER",
      isLowAuthority: null,
      isNewSite: null,
      assessment: "UNCLASSIFIED",
      notes: null,
    }));

    const { inserted, carriedOver } = await store.replaceProviderSerpResults(
      opportunityId,
      { provider: provider.id, fetchedAt, results },
    );

    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: opportunityId,
      type: "SERP_UPDATED",
      summary: `Fetched ${inserted} organic result${
        inserted === 1 ? "" : "s"
      } from ${provider.label}.`,
      detail: {
        provider: provider.id,
        fetchedAt,
        inserted,
        judgementsCarriedOver: carriedOver,
        domains: fetched.map((row) => row.domain),
      },
    });

    revalidate(opportunityId);

    return {
      ...OK,
      message: `Fetched ${inserted} organic result${inserted === 1 ? "" : "s"}${
        carriedOver
          ? `, keeping your existing assessment on ${carriedOver} domain${carriedOver === 1 ? "" : "s"}`
          : ""
      }. Authority and page type stay unknown until you classify them.`,
    };
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return { ok: false, error: error.message };
    }
    return toActionError(error);
  }
}
