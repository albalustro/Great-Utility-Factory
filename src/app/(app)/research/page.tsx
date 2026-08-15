import { KeywordResearch } from "@/components/research/keyword-research";
import { getDataContext } from "@/lib/data";
import { getProviders } from "@/lib/providers/registry";

export default async function ResearchPage() {
  const { settings } = await getDataContext();
  const { keyword } = getProviders(settings.providers);
  const status = keyword.status();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Keyword research</h1>
        <p className="text-xs text-muted-foreground">
          Start from a seed, review what the provider actually measured, then import
          the keywords worth tracking.
        </p>
      </header>

      <KeywordResearch
        defaultCountry={settings.defaultCountry}
        defaultLanguage={settings.defaultLanguage}
        currency={settings.currency}
        supportsExpansion={keyword.supportsExpansion && status.configured}
        providerConfigured={status.configured}
        providerLabel={status.label}
        providerDetail={status.detail}
      />
    </div>
  );
}
