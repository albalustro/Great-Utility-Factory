import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AssetForm } from "@/components/portfolio/asset-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDataContext } from "@/lib/data";

export default async function NewAssetPage() {
  const { store } = await getDataContext();
  const opportunities = await store.listOpportunities();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/portfolio">
            <ArrowLeft className="size-4" />
            Portfolio
          </Link>
        </Button>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Add asset</h1>
        <p className="text-xs text-muted-foreground">
          Register a published utility so it can be measured against the checkpoints.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <AssetForm opportunities={opportunities} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
