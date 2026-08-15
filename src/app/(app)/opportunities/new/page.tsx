import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createOpportunityAction } from "@/app/actions/opportunities";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { Button } from "@/components/ui/button";
import { getDataContext } from "@/lib/data";

export default async function NewOpportunityPage() {
  const { settings } = await getDataContext();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/opportunities">
            <ArrowLeft className="size-4" />
            Opportunities
          </Link>
        </Button>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">New opportunity</h1>
        <p className="text-xs text-muted-foreground">
          Record what you actually know. Anything you leave blank stays unknown.
        </p>
      </div>

      <OpportunityForm
        action={createOpportunityAction}
        defaultCountry={settings.defaultCountry}
        defaultLanguage={settings.defaultLanguage}
        submitLabel="Create opportunity"
      />
    </div>
  );
}
