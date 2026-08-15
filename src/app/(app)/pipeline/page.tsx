import Link from "next/link";
import { Plus } from "lucide-react";

import { PipelineBoard } from "@/components/pipeline/board";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { getDataContext } from "@/lib/data";

export default async function PipelinePage() {
  const { store, settings } = await getDataContext();
  const opportunities = await store.listOpportunities();

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Pipeline</h1>
          <p className="text-xs text-muted-foreground">
            Drag a card to change its status. Every move is recorded in status history.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/opportunities/new">
            <Plus className="size-4" />
            New opportunity
          </Link>
        </Button>
      </header>

      {opportunities.length === 0 ? (
        <EmptyState
          title="The pipeline is empty"
          description="Add an opportunity or import a keyword export to start moving work through the factory."
          action={
            <Button asChild size="sm">
              <Link href="/opportunities/new">New opportunity</Link>
            </Button>
          }
        />
      ) : (
        <PipelineBoard
          opportunities={opportunities}
          thresholds={settings.thresholds}
        />
      )}
    </div>
  );
}
