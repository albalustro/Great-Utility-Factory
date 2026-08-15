import Link from "next/link";

import { ClusterManager } from "@/components/clusters/cluster-manager";
import { getDataContext } from "@/lib/data";

export default async function ClustersPage() {
  const { store, settings } = await getDataContext();

  const [clusters, opportunities, memberships] = await Promise.all([
    store.listClusters(),
    store.listOpportunities(),
    store.listClusterMemberships(),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Utility clusters</h1>
        <p className="text-xs text-muted-foreground">
          One winning utility is a result. A cluster of them is a business. Group
          opportunities that should share a domain and link to each other.
        </p>
      </header>

      {opportunities.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-xs text-muted-foreground">
          Add some opportunities first —{" "}
          <Link href="/opportunities/new" className="underline underline-offset-2">
            start here
          </Link>
          .
        </p>
      ) : (
        <ClusterManager
          clusters={clusters}
          opportunities={opportunities}
          memberships={memberships}
          thresholds={settings.thresholds}
        />
      )}
    </div>
  );
}
