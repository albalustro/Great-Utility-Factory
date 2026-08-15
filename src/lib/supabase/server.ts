import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * `cookies()` is async in Next.js 16, and writing cookies from a Server
 * Component is not allowed — the `setAll` handler swallows that specific case
 * because session refresh is handled in `proxy.ts` instead.
 */
export async function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: the proxy refreshes the session.
        }
      },
    },
  });
}
