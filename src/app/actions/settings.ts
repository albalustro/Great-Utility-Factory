"use server";

import { revalidatePath } from "next/cache";

import {
  OK,
  recalculateAllScores,
  toActionError,
  type ActionState,
} from "@/app/actions/shared";
import { getDataContext } from "@/lib/data";
import { fieldErrors, settingsInputSchema } from "@/lib/domain/schemas";

/**
 * Saves settings and immediately re-scores the whole portfolio.
 *
 * Changing the weights changes what every stored score means, so leaving old
 * scores in place would silently mix two scoring models in one table.
 */
export async function saveSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    weights: {
      demand: formData.get("weights.demand"),
      serpWeakness: formData.get("weights.serpWeakness"),
      utilityFit: formData.get("weights.utilityFit"),
      monetization: formData.get("weights.monetization"),
      evergreen: formData.get("weights.evergreen"),
      buildSimplicity: formData.get("weights.buildSimplicity"),
      clusterPotential: formData.get("weights.clusterPotential"),
    },
    thresholds: {
      build: formData.get("thresholds.build"),
      investigate: formData.get("thresholds.investigate"),
      watch: formData.get("thresholds.watch"),
    },
    demandCalibration: {
      floor: formData.get("demandCalibration.floor"),
      ceiling: formData.get("demandCalibration.ceiling"),
    },
    providers: {
      keyword: formData.get("providers.keyword"),
      serp: formData.get("providers.serp"),
      ai: formData.get("providers.ai"),
      searchAnalytics: formData.get("providers.searchAnalytics"),
    },
    defaultCountry: formData.get("defaultCountry"),
    defaultLanguage: formData.get("defaultLanguage"),
    currency: formData.get("currency"),
  };

  const parsed = settingsInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return {
      ok: false,
      error:
        errors["weights"] ??
        errors["thresholds"] ??
        errors["demandCalibration.ceiling"] ??
        "Some settings need attention.",
      fieldErrors: errors,
    };
  }

  let rescored = 0;
  try {
    const { store } = await getDataContext();
    const settings = await store.updateSettings({
      weights: parsed.data.weights,
      thresholds: parsed.data.thresholds,
      demandCalibration: parsed.data.demandCalibration,
      providers: parsed.data.providers,
      defaultCountry: parsed.data.defaultCountry.toUpperCase(),
      defaultLanguage: parsed.data.defaultLanguage.toLowerCase(),
      currency: parsed.data.currency.toUpperCase(),
    });

    rescored = await recalculateAllScores(store, settings);

    await store.appendActivity({
      entityType: "SETTINGS",
      entityId: settings.userId,
      type: "SCORE_RECALCULATED",
      summary:
        rescored > 0
          ? `Settings saved. ${rescored} opportunity score(s) recalculated.`
          : "Settings saved. No opportunity scores changed.",
      detail: { weights: settings.weights, thresholds: settings.thresholds },
    });
  } catch (error) {
    return toActionError(error);
  }

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/opportunities");
  revalidatePath("/pipeline");

  return {
    ...OK,
    message:
      rescored > 0
        ? `Settings saved. ${rescored} opportunity score(s) recalculated.`
        : "Settings saved.",
  };
}
