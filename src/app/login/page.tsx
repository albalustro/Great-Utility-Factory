import Link from "next/link";
import { redirect } from "next/navigation";
import { Factory } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Sign in · Utility Factory" };

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await props.searchParams;

  // Without Supabase there is no account system — go straight to the factory.
  if (!isSupabaseConfigured()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Factory className="size-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Utility Factory</h1>
          <p className="text-xs text-muted-foreground">
            Private workspace. Sign in to continue.
          </p>
        </div>

        <LoginForm next={next ?? "/"} />

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Utility Factory is a single-operator internal tool.{" "}
          <Link href="/" className="underline underline-offset-2">
            Back to the dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
