import "server-only";

import { redirect } from "next/navigation";

import type { SessionUser } from "@/lib/domain/types";
import { DEMO_USER_ID } from "@/lib/data/seed";
import { getAppMode, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const DEMO_USER: SessionUser = {
  id: DEMO_USER_ID,
  email: "demo@utility-factory.local",
  isDemoSession: true,
};

/**
 * Resolves the current operator.
 *
 * With Supabase configured this is the authenticated user (verified server-side
 * via `getUser()`, not read from a cookie). Without it, the application runs as
 * a single local demo operator and every screen is labelled as demo mode.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return DEMO_USER;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    isDemoSession: false,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export function appMode() {
  return getAppMode();
}
