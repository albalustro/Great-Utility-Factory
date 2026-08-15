import "server-only";

import type { z } from "zod";

import type { Store } from "@/lib/data/store";
import type { Opportunity, Settings } from "@/lib/domain/types";
import { fieldErrors } from "@/lib/domain/schemas";
import { scoreOpportunity } from "@/lib/scoring/engine";

/** Uniform result shape for every form-driven server action. */
export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const OK: ActionState = { ok: true };

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { data: z.infer<T>; errors?: undefined } | { data?: undefined; errors: ActionState } {
  const result = schema.safeParse(formToObject(formData));
  if (!result.success) {
    return {
      errors: {
        ok: false,
        error: "Some fields need attention.",
        fieldErrors: fieldErrors(result.error),
      },
    };
  }
  return { data: result.data };
}

export function toActionError(error: unknown): ActionState {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";
  return { ok: false, error: message };
}

/**
 * Recomputes and persists an opportunity's score using the operator's current
 * weights, and records the recalculation in the activity log when it moves.
 *
 * Called after every mutation that can affect the score, so the stored value is
 * never stale relative to the inputs it claims to summarise.
 */
export async function recalculateScore(
  store: Store,
  settings: Settings,
  opportunity: Opportunity,
): Promise<Opportunity> {
  const breakdown = scoreOpportunity(opportunity, {
    weights: settings.weights,
    thresholds: settings.thresholds,
    demandCalibration: settings.demandCalibration,
  });

  if (breakdown.total === opportunity.opportunityScore) return opportunity;

  const updated = await store.updateOpportunity(opportunity.id, {
    opportunityScore: breakdown.total,
  });

  await store.appendActivity({
    entityType: "OPPORTUNITY",
    entityId: opportunity.id,
    type: "SCORE_RECALCULATED",
    summary: `Opportunity score moved from ${opportunity.opportunityScore} to ${breakdown.total} (${breakdown.decision}).`,
    detail: {
      previous: opportunity.opportunityScore,
      next: breakdown.total,
      decision: breakdown.decision,
      completeness: breakdown.completeness,
    },
  });

  return updated;
}

/** Recalculates every opportunity — used when the scoring weights change. */
export async function recalculateAllScores(
  store: Store,
  settings: Settings,
): Promise<number> {
  const opportunities = await store.listOpportunities();
  let changed = 0;

  for (const opportunity of opportunities) {
    const breakdown = scoreOpportunity(opportunity, {
      weights: settings.weights,
      thresholds: settings.thresholds,
      demandCalibration: settings.demandCalibration,
    });
    if (breakdown.total !== opportunity.opportunityScore) {
      await store.updateOpportunity(opportunity.id, {
        opportunityScore: breakdown.total,
      });
      changed += 1;
    }
  }

  return changed;
}
