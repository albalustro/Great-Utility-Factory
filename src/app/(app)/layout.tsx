import Link from "next/link";
import { Factory, LogOut } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { MainNav } from "@/components/app-shell/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDataContext } from "@/lib/data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, mode, store } = await getDataContext();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground">
            <Factory className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Utility Factory</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Research terminal
            </p>
          </div>
        </div>

        <div className="px-2">
          <MainNav />
        </div>

        <div className="mt-auto space-y-2 border-t border-border p-3">
          {mode === "demo" ? (
            <div className="rounded-md border border-dashed border-border bg-muted/40 p-2">
              <p className="text-[11px] font-medium">Local demo mode</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                Supabase is not configured. Data lives in memory and resets when the
                server restarts.
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground" title={user.email}>
                {user.email}
              </p>
              <Badge variant="muted" className="mt-0.5">
                {store.kind === "supabase" ? "Supabase" : "In-memory"}
              </Badge>
            </div>
            {mode === "supabase" ? (
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="size-4" />
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Factory className="size-4" />
            <span className="text-sm font-semibold">Utility Factory</span>
          </Link>
        </header>

        <div className="border-b border-border bg-card px-4 py-2 lg:hidden">
          <MainNav />
        </div>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
