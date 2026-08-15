"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { toActionError } from "@/app/actions/shared";
import { getDataContext } from "@/lib/data";
import type { OpportunityWrite } from "@/lib/data/store";
import { opportunityInputSchema } from "@/lib/domain/schemas";
import { COMPETITION_LEVELS, TRENDS } from "@/lib/domain/types";
import { getProviders } from "@/lib/providers/registry";
import { ProviderNotConfiguredError, type KeywordMetrics } from "@/lib/providers/types";
import { normalizeSearchVolume } from "@/lib/scoring/demand";
import { scoreOpportunity } from "@/lib/scoring/engine";

/**
 * Keyword research: seeds in, reviewable candidates out.
 *
 * The two halves are deliberately separate actions. Searching costs provider
 * credits and returns evidence; importing writes records. Keeping them apart is
 * what makes the review step real rather than decorative — nothing reaches the
 * Opportunity table until the operator has looked at the numbers and chosen.
 */

/** Search volume is the only score component provider data can fill in. */
export interface ResearchCandidate extends KeywordMetrics {
  /** Set when this keyword is already tracked, so it is not imported twice. */
  existingOpportunityId: string | null;
  /** Preview of the demand factor alone — not the full opportunity score. */
  demandScore: number | null;
}

export interface ResearchState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  candidates?: ResearchCandidate[];
  provider?: string;
  fetchedAt?: string;
  country?: string;
  language?: string;
  /** EXPAND discovers new keywords from seeds; LOOKUP prices the seeds as given. */
  mode?: "EXPAND" | "LOOKUP";
}

const MAX_SEEDS = 20;
const MAX_RESULTS = 200;

const searchSchema = z.object({
  seeds: z
    .string()
    .trim()
    .min(1, "Enter at least one seed keyword")
    .transform((value) =>
      [
        ...new Set(
          value
            .split(/[\n,]/)
            .map((seed) => seed.trim().toLowerCase())
            .filter(Boolean),
        ),
      ].slice(0, MAX_SEEDS),
    )
    .refine((seeds) => seeds.length > 0, "Enter at least one seed keyword"),
  country: z.string().trim().min(2).max(8),
  language: z.string().trim().min(2).max(8),
  limit: z.coerce.number().int().min(1).max(MAX_RESULTS).default(100),
  mode: z.enum(["EXPAND", "LOOKUP"]).default("EXPAND"),
});

export async function researchKeywordsAction(
  _prev: ResearchState,
  formData: FormData,
): Promise<ResearchState> {
  const parsed = searchSchema.safeParse({
    seeds: formData.get("seeds") ?? "",
    country: formData.get("country") ?? "",
    language: formData.get("language") ?? "",
    limit: formData.get("limit") ?? undefined,
    mode: formData.get("mode") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the search settings.",
    };
  }

  const { seeds, country, language, limit, mode } = parsed.data;

  try {
    const { store, settings } = await getDataContext();
    const { keyword: provider } = getProviders(settings.providers);

    // EXPAND is only offered when the provider can actually discover keywords;
    // asking a lookup-only provider to expand would silently return the seeds.
    const effectiveMode = provider.supportsExpansion ? mode : "LOOKUP";

    const metrics =
      effectiveMode === "EXPAND"
        ? await provider.expand({ seeds, country, language, limit })
        : await provider.lookup({ keywords: seeds, country, language });

    if (metrics.length === 0) {
      return {
        ok: false,
        error: `${provider.label} returned no keywords for those seeds in ${country}/${language}.`,
      };
    }

    const existing = await store.listOpportunities();
    const existingByKeyword = new Map(
      existing.map((o) => [`${o.keyword.toLowerCase()}::${o.country}`, o.id]),
    );

    const candidates: ResearchCandidate[] = metrics
      .slice(0, limit)
      .map((entry) => ({
        ...entry,
        existingOpportunityId:
          existingByKeyword.get(`${entry.keyword.toLowerCase()}::${entry.country}`) ??
          null,
        demandScore: normalizeSearchVolume(entry.searchVolume, settings.demandCalibration)
          .score,
      }));

    const known = candidates.filter((c) => c.existingOpportunityId !== null).length;

    return {
      ok: true,
      candidates,
      provider: provider.id,
      fetchedAt: new Date().toISOString(),
      country,
      language,
      mode: effectiveMode,
      message: `${provider.label} returned ${candidates.length} keyword${
        candidates.length === 1 ? "" : "s"
      }${known ? `, ${known} of which you already track` : ""}.`,
    };
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return { ok: false, error: error.message };
    }
    return toActionError(error);
  }
}

// ---------------------------------------------------------------------------

/**
 * The candidate shape as it comes back from the browser. It is re-validated
 * rather than trusted: the client round-trip is untrusted input, and a number
 * that arrives as a string must not become a fabricated metric.
 */
const candidateSchema = z.object({
  keyword: z.string().trim().min(1).max(300),
  searchVolume: z.number().nullable(),
  keywordDifficulty: z.number().min(0).max(100).nullable(),
  cpc: z.number().min(0).nullable(),
  competitionIndex: z.number().min(0).max(100).nullable(),
  competitionLevel: z.enum(COMPETITION_LEVELS).nullable(),
  trend: z.enum(TRENDS),
});

const importSchema = z.object({
  country: z.string().trim().min(2).max(8),
  language: z.string().trim().min(2).max(8),
  provider: z.string().trim().min(1).max(64),
  fetchedAt: z.iso.datetime(),
  candidates: z.array(candidateSchema).min(1).max(MAX_RESULTS),
});

export async function importResearchCandidatesAction(
  _prev: ResearchState,
  formData: FormData,
): Promise<ResearchState> {
  const raw = String(formData.get("payload") ?? "");
  if (!raw) return { ok: false, error: "Select at least one keyword to import." };

  let payload: z.infer<typeof importSchema>;
  try {
    payload = importSchema.parse(JSON.parse(raw));
  } catch {
    return { ok: false, error: "The selection could not be read. Run the search again." };
  }

  try {
    const { store, settings } = await getDataContext();

    const existing = await store.listOpportunities();
    const seen = new Set(
      existing.map((o) => `${o.keyword.toLowerCase()}::${o.country}`),
    );

    const writes: OpportunityWrite[] = [];
    const duplicates: string[] = [];

    for (const candidate of payload.candidates) {
      const key = `${candidate.keyword.toLowerCase()}::${payload.country}`;
      if (seen.has(key)) {
        duplicates.push(candidate.keyword);
        continue;
      }
      seen.add(key);

      // Re-validated through the same schema the manual form uses, so a research
      // import cannot create a record the rest of the app considers malformed.
      const parsed = opportunityInputSchema.safeParse({
        ...candidate,
        country: payload.country,
        language: payload.language,
        source: "KEYWORD_PROVIDER",
        status: "INBOX",
        // Everything below is a judgement the operator has not made yet. Left
        // unscored on purpose: the point of the review queue is that these get
        // filled in deliberately, not defaulted.
        utilityType: null,
        serpWeaknessScore: null,
        utilityFitScore: null,
        monetizationScore: null,
        evergreenScore: null,
        buildSimplicityScore: null,
        clusterPotentialScore: null,
        demandScoreOverride: null,
        demandScoreOverrideReason: null,
        notes: null,
      });

      if (!parsed.success) continue;

      writes.push({
        ...parsed.data,
        metricsProvider: payload.provider,
        metricsFetchedAt: payload.fetchedAt,
      });
    }

    if (writes.length === 0) {
      return {
        ok: false,
        error: duplicates.length
          ? "Every selected keyword is already in your opportunities."
          : "Nothing could be imported.",
      };
    }

    const created = await store.createOpportunities(writes);

    for (const opportunity of created) {
      const breakdown = scoreOpportunity(opportunity, {
        weights: settings.weights,
        thresholds: settings.thresholds,
        demandCalibration: settings.demandCalibration,
      });
      if (breakdown.total !== opportunity.opportunityScore) {
        await store.updateOpportunity(opportunity.id, {
          opportunityScore: breakdown.total,
        });
      }
    }

    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: created[0].id,
      type: "OPPORTUNITY_CREATED",
      summary: `Imported ${created.length} keyword${
        created.length === 1 ? "" : "s"
      } from ${payload.provider} research.`,
      detail: {
        provider: payload.provider,
        fetchedAt: payload.fetchedAt,
        country: payload.country,
        language: payload.language,
        imported: created.length,
        skippedAsDuplicate: duplicates,
      },
    });

    revalidatePath("/opportunities");
    revalidatePath("/pipeline");
    revalidatePath("/");

    return {
      ok: true,
      message: `Imported ${created.length} opportunit${
        created.length === 1 ? "y" : "ies"
      }${duplicates.length ? `. ${duplicates.length} already existed and were skipped` : ""}. Scores are low until you assess SERP weakness, utility fit and the rest.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}
