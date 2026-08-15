import "server-only";

import { cache } from "react";
import { connection } from "next/server";

import type { SessionUser, Settings } from "@/lib/domain/types";
import { MemoryStore } from "@/lib/data/memory-store";
import { SupabaseStore } from "@/lib/data/supabase-store";
import type { Store } from "@/lib/data/store";
import { requireSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DataContext {
  store: Store;
  user: SessionUser;
  settings: Settings;
  mode: "supabase" | "demo";
}

/**
 * Single entry point for server-side data access.
 *
 * Memoised per request with React `cache` so a page that renders several
 * components does not re-resolve the session or re-read settings.
 */
export const getDataContext = cache(async function getDataContext(): Promise<DataContext> {
  // Every screen reflects live operator data, so nothing here may be captured at
  // build time. In Supabase mode reading cookies would force this anyway, but in
  // demo mode nothing touches the request — without this the dashboard would be
  // prerendered once and then serve a frozen snapshot.
  await connection();

  const user = await requireSessionUser();

  let store: Store;
  if (isSupabaseConfigured()) {
    const client = await createSupabaseServerClient();
    store = new SupabaseStore(client, user.id);
  } else {
    store = new MemoryStore(user.id);
  }

  const settings = await store.getSettings();

  return {
    store,
    user,
    settings,
    mode: store.kind === "supabase" ? "supabase" : "demo",
  };
});
