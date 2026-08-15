"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { toActionError, type ActionState } from "@/app/actions/shared";
import { getDataContext } from "@/lib/data";
import { opportunityInputSchema } from "@/lib/domain/schemas";
import { scoreOpportunity } from "@/lib/scoring/engine";

const payloadSchema = z.array(z.record(z.string(), z.unknown())).max(2000);

/**
 * Commits a mapped CSV import.
 *
 * The browser does the parsing and column mapping; this action re-validates
 * every row server-side, because a mapping produced in the client is untrusted
 * input like any other. Rows that fail validation are skipped and reported
 * rather than being coerced into something importable.
 */
export async function importOpportunitiesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = String(formData.get("payload") ?? "");
  if (!raw) return { ok: false, error: "Nothing to import." };

  let rows: Array<Record<string, unknown>>;
  try {
    rows = payloadSchema.parse(JSON.parse(raw));
  } catch {
    return { ok: false, error: "The import payload could not be read." };
  }

  try {
    const { store, settings } = await getDataContext();

    const valid: Array<z.infer<typeof opportunityInputSchema>> = [];
    const skipped: string[] = [];

    rows.forEach((row, index) => {
      const parsed = opportunityInputSchema.safeParse({
        ...row,
        country: row.country || settings.defaultCountry,
        language: row.language || settings.defaultLanguage,
        source: "CSV_IMPORT",
        status: row.status || "INBOX",
      });

      if (parsed.success) {
        valid.push(parsed.data);
      } else {
        skipped.push(
          `Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "invalid"}`,
        );
      }
    });

    if (valid.length === 0) {
      return {
        ok: false,
        error: `No rows could be imported. ${skipped.slice(0, 3).join(" · ")}`,
      };
    }

    const created = await store.createOpportunities(valid);

    // Score each import so the explorer is immediately sortable by value.
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
      summary: `Imported ${created.length} opportunity/opportunities from CSV${
        skipped.length ? `, skipped ${skipped.length} invalid row(s)` : ""
      }.`,
      detail: { imported: created.length, skipped },
    });

    revalidatePath("/opportunities");
    revalidatePath("/");
    revalidatePath("/pipeline");

    return {
      ok: true,
      message: skipped.length
        ? `Imported ${created.length} opportunities. ${skipped.length} row(s) were skipped: ${skipped.slice(0, 3).join(" · ")}`
        : `Imported ${created.length} opportunities.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}
