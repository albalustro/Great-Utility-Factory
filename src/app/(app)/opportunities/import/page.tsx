import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CsvImport } from "@/components/opportunities/csv-import";
import { Button } from "@/components/ui/button";
import { getDataContext } from "@/lib/data";

export default async function ImportPage() {
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
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Import from CSV</h1>
        <p className="text-xs text-muted-foreground">
          Map an export from any keyword tool onto Utility Factory fields.
        </p>
      </div>

      <CsvImport
        defaultCountry={settings.defaultCountry}
        defaultLanguage={settings.defaultLanguage}
      />
    </div>
  );
}
