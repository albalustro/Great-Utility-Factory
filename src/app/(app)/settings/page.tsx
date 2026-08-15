import { SettingsForm } from "@/components/settings/settings-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDataContext } from "@/lib/data";
import { getProviderCatalog } from "@/lib/providers/registry";

export default async function SettingsPage() {
  const { settings, mode } = await getDataContext();
  const catalog = getProviderCatalog();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Scoring model, decision thresholds, provider wiring and defaults.
        </p>
      </header>

      {mode === "demo" ? (
        <Alert variant="warning">
          <AlertTitle className="text-xs">Running in local demo mode</AlertTitle>
          <AlertDescription>
            Supabase is not configured, so settings and all other data live in memory
            and reset when the server restarts. Add{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to
            persist.
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert variant="info">
        <AlertTitle className="text-xs">API keys live in the environment</AlertTitle>
        <AlertDescription>
          Provider selection is stored in the database, but secrets never are. Set the
          environment variables listed against each provider and restart the server —
          the status below reflects what is actually available to the process.
        </AlertDescription>
      </Alert>

      <SettingsForm settings={settings} catalog={catalog} />
    </div>
  );
}
