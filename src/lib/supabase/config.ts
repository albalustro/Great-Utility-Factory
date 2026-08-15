/**
 * Supabase configuration detection.
 *
 * The application runs in one of two modes:
 *  - `supabase`: real authentication and durable persistence.
 *  - `demo`: an in-memory store seeded with demo data, no login required.
 *
 * Mode is derived from the environment rather than a flag so there is no way to
 * accidentally point the UI at demo data while believing it is real.
 */

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    undefined
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export type AppMode = "supabase" | "demo";

export function getAppMode(): AppMode {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

/**
 * Demo mode is a development convenience, not a deployment target: the store is
 * held in process memory, so a production instance running this way loses every
 * record on the next restart or scale event. That is worth saying loudly rather
 * than leaving to a note in the sidebar.
 */
export function isUnconfiguredProduction(): boolean {
  return process.env.NODE_ENV === "production" && !isSupabaseConfigured();
}
