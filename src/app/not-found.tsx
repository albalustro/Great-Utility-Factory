import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-4xl font-semibold">404</p>
      <div className="space-y-1">
        <h1 className="text-sm font-medium">That record does not exist</h1>
        <p className="text-xs text-muted-foreground">
          It may have been deleted, or the link may be wrong.
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/">Back to the dashboard</Link>
      </Button>
    </main>
  );
}
