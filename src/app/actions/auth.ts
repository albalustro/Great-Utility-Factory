"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export interface AuthState {
  error?: string;
  message?: string;
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase is not configured, so there is no account to sign in to. The app is running in local demo mode.",
    };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: error.message };

  const next = String(formData.get("next") || "/");
  redirect(next.startsWith("/") ? next : "/");
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase is not configured. Add your project URL and anon key to enable accounts.",
    };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);

  if (error) return { error: error.message };

  if (!data.session) {
    return {
      message:
        "Account created. Check your email to confirm the address, then sign in.",
    };
  }

  redirect("/");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
