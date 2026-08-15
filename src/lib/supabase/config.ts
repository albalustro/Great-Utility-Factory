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
