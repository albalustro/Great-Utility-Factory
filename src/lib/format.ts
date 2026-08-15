/**
 * Formatting helpers.
 *
 * The single most important rule here: `null` renders as an em dash, never as
 * "0". A missing metric and a measured zero mean completely different things in
 * this product, and the UI must not blur them.
 */

export const UNKNOWN = "—";

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined) return UNKNOWN;
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function formatDecimal(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined) return UNKNOWN;
  return value.toFixed(digits);
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
): string {
  if (value === null || value === undefined) return UNKNOWN;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Takes a 0-1 ratio and renders it as a percentage. */
export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return UNKNOWN;
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return UNKNOWN;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNKNOWN;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return UNKNOWN;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNKNOWN;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysBetween(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/** "3d", "12d", "4mo" — compact enough for a kanban card. */
export function formatAge(iso: string | null | undefined, now = new Date()): string {
  const days = daysBetween(iso, now);
  if (days === null) return UNKNOWN;
  if (days < 1) return "today";
  if (days < 60) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Turns an enum-ish token into readable text: READY_TO_BUILD -> Ready To Build. */
export function humanizeToken(value: string): string {
  return titleCase(value.replace(/_/g, " "));
}
