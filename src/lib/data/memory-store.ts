import {
  DEFAULT_SETTINGS,
  type AIAnalysis,
  type ActivityEntry,
  type Asset,
  type AssetMetric,
  type BuildPack,
  type Cluster,
  type Opportunity,
  type OpportunityFilters,
  type OpportunityStatus,
  type SerpResult,
  type Settings,
  type StatusHistoryEntry,
} from "@/lib/domain/types";
import type {
  AssetInput,
  AssetMetricInput,
  ClusterInput,
  SerpResultInput,
} from "@/lib/domain/schemas";
import { buildSeedGraph, DEMO_USER_ID } from "@/lib/data/seed";
import {
  applyOpportunityFilters,
  collectJudgements,
  type ActivityFilter,
  type NewActivity,
  type NewAnalysis,
  type NewBuildPack,
  type OpportunityIndexes,
  type OpportunityPatch,
  type OpportunityWrite,
  type ProviderSerpSnapshot,
  type Store,
} from "@/lib/data/store";

interface MemoryDb {
  settings: Settings;
  opportunities: Opportunity[];
  serpResults: SerpResult[];
  analyses: AIAnalysis[];
  buildPacks: BuildPack[];
  clusters: Cluster[];
  clusterOpportunities: Array<{ clusterId: string; opportunityId: string }>;
  assets: Asset[];
  assetMetrics: AssetMetric[];
  statusHistory: StatusHistoryEntry[];
  activity: ActivityEntry[];
}

/**
 * Process-local demo store.
 *
 * Used when Supabase is not configured so the whole workflow — filtering,
 * scoring, status transitions, build pack generation — can be exercised
 * immediately. It is explicitly NOT durable: the data resets when the server
 * process restarts, and the UI says so. Held on `globalThis` so it survives
 * dev-server hot reloads.
 */
const globalRef = globalThis as unknown as { __utilityFactoryDb?: MemoryDb };

function createDb(): MemoryDb {
  const seed = buildSeedGraph();
  const now = new Date().toISOString();

  return {
    settings: { ...DEFAULT_SETTINGS, userId: DEMO_USER_ID, updatedAt: now },
    opportunities: seed.opportunities,
    serpResults: seed.serpResults,
    analyses: [],
    buildPacks: [],
    clusters: seed.clusters,
    clusterOpportunities: seed.clusterOpportunities,
    assets: seed.assets,
    assetMetrics: seed.assetMetrics,
    statusHistory: seed.opportunities.map((o) => ({
      id: crypto.randomUUID(),
      opportunityId: o.id,
      fromStatus: null,
      toStatus: o.status,
      note: "Seeded demo record.",
      createdAt: o.statusChangedAt,
    })),
    activity: seed.opportunities.map((o) => ({
      id: crypto.randomUUID(),
      userId: DEMO_USER_ID,
      entityType: "OPPORTUNITY" as const,
      entityId: o.id,
      type: "OPPORTUNITY_CREATED" as const,
      summary: `Demo opportunity "${o.keyword}" seeded.`,
      detail: null,
      createdAt: o.createdAt,
    })),
  };
}

function db(): MemoryDb {
  if (!globalRef.__utilityFactoryDb) {
    globalRef.__utilityFactoryDb = createDb();
  }
  return globalRef.__utilityFactoryDb;
}

const nowIso = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);

export class MemoryStore implements Store {
  readonly kind = "memory" as const;

  constructor(private readonly userId: string) {}

  // --- settings ------------------------------------------------------------

  async getSettings(): Promise<Settings> {
    return clone(db().settings);
  }

  async updateSettings(
    patch: Partial<Omit<Settings, "userId" | "updatedAt">>,
  ): Promise<Settings> {
    const current = db().settings;
    db().settings = { ...current, ...patch, updatedAt: nowIso() };
    return clone(db().settings);
  }

  // --- opportunities -------------------------------------------------------

  async listOpportunities(filters?: OpportunityFilters): Promise<Opportunity[]> {
    const all = db().opportunities;
    return clone(applyOpportunityFilters(all, filters, db().clusterOpportunities));
  }

  async getOpportunity(id: string): Promise<Opportunity | null> {
    const found = db().opportunities.find((o) => o.id === id);
    return found ? clone(found) : null;
  }

  async createOpportunity(input: OpportunityWrite): Promise<Opportunity> {
    const [created] = await this.createOpportunities([input]);
    return created;
  }

  async createOpportunities(inputs: OpportunityWrite[]): Promise<Opportunity[]> {
    const created = inputs.map((input) => {
      const timestamp = nowIso();
      const opportunity: Opportunity = {
        id: crypto.randomUUID(),
        userId: this.userId,
        opportunityScore: 0,
        isDemo: false,
        statusChangedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...input,
        metricsProvider: input.metricsProvider ?? null,
        metricsFetchedAt: input.metricsFetchedAt ?? null,
      };
      db().opportunities.unshift(opportunity);
      db().statusHistory.push({
        id: crypto.randomUUID(),
        opportunityId: opportunity.id,
        fromStatus: null,
        toStatus: opportunity.status,
        note: null,
        createdAt: timestamp,
      });
      return opportunity;
    });
    return clone(created);
  }

  async updateOpportunity(id: string, patch: OpportunityPatch): Promise<Opportunity> {
    const index = db().opportunities.findIndex((o) => o.id === id);
    if (index === -1) throw new Error("Opportunity not found");
    const updated = {
      ...db().opportunities[index],
      ...patch,
      updatedAt: nowIso(),
    };
    db().opportunities[index] = updated;
    return clone(updated);
  }

  async setOpportunityStatus(
    id: string,
    status: OpportunityStatus,
    note: string | null,
  ): Promise<Opportunity> {
    const index = db().opportunities.findIndex((o) => o.id === id);
    if (index === -1) throw new Error("Opportunity not found");
    const current = db().opportunities[index];
    const timestamp = nowIso();

    if (current.status !== status) {
      db().statusHistory.push({
        id: crypto.randomUUID(),
        opportunityId: id,
        fromStatus: current.status,
        toStatus: status,
        note,
        createdAt: timestamp,
      });
    }

    const updated: Opportunity = {
      ...current,
      status,
      statusChangedAt: current.status === status ? current.statusChangedAt : timestamp,
      updatedAt: timestamp,
    };
    db().opportunities[index] = updated;
    return clone(updated);
  }

  async deleteOpportunity(id: string): Promise<void> {
    const database = db();
    database.opportunities = database.opportunities.filter((o) => o.id !== id);
    database.serpResults = database.serpResults.filter((s) => s.opportunityId !== id);
    database.analyses = database.analyses.filter((a) => a.opportunityId !== id);
    database.buildPacks = database.buildPacks.filter((b) => b.opportunityId !== id);
    database.statusHistory = database.statusHistory.filter(
      (h) => h.opportunityId !== id,
    );
    database.clusterOpportunities = database.clusterOpportunities.filter(
      (c) => c.opportunityId !== id,
    );
  }

  async getOpportunityIndexes(): Promise<OpportunityIndexes> {
    const database = db();
    return {
      withSerp: new Set(database.serpResults.map((s) => s.opportunityId)),
      withAnalysis: new Set(database.analyses.map((a) => a.opportunityId)),
      withBuildPack: new Set(database.buildPacks.map((b) => b.opportunityId)),
      inCluster: new Set(database.clusterOpportunities.map((c) => c.opportunityId)),
    };
  }

  // --- SERP ----------------------------------------------------------------

  async listSerpResults(opportunityId: string): Promise<SerpResult[]> {
    return clone(
      db()
        .serpResults.filter((s) => s.opportunityId === opportunityId)
        .sort((a, b) => a.position - b.position),
    );
  }

  async createSerpResult(
    opportunityId: string,
    input: SerpResultInput,
  ): Promise<SerpResult> {
    const timestamp = nowIso();
    const result: SerpResult = {
      id: crypto.randomUUID(),
      opportunityId,
      source: "MANUAL",
      provider: null,
      fetchedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...input,
    };
    db().serpResults.push(result);
    return clone(result);
  }

  async updateSerpResult(id: string, input: SerpResultInput): Promise<SerpResult> {
    const index = db().serpResults.findIndex((s) => s.id === id);
    if (index === -1) throw new Error("SERP result not found");
    const updated = { ...db().serpResults[index], ...input, updatedAt: nowIso() };
    db().serpResults[index] = updated;
    return clone(updated);
  }

  async deleteSerpResult(id: string): Promise<void> {
    db().serpResults = db().serpResults.filter((s) => s.id !== id);
  }

  async replaceProviderSerpResults(
    opportunityId: string,
    snapshot: ProviderSerpSnapshot,
  ): Promise<{ inserted: number; carriedOver: number }> {
    const existing = db().serpResults.filter((s) => s.opportunityId === opportunityId);
    const judgements = collectJudgements(existing);

    db().serpResults = db().serpResults.filter(
      (s) => !(s.opportunityId === opportunityId && s.source === "PROVIDER"),
    );

    const timestamp = nowIso();
    let carriedOver = 0;
    for (const input of snapshot.results) {
      const prior = judgements.get(input.domain.toLowerCase());
      if (prior) carriedOver += 1;
      db().serpResults.push({
        id: crypto.randomUUID(),
        opportunityId,
        ...input,
        ...(prior ?? {}),
        source: "PROVIDER",
        provider: snapshot.provider,
        fetchedAt: snapshot.fetchedAt,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return { inserted: snapshot.results.length, carriedOver };
  }

  // --- AI analyses ---------------------------------------------------------

  async listAnalyses(opportunityId: string): Promise<AIAnalysis[]> {
    return clone(
      db()
        .analyses.filter((a) => a.opportunityId === opportunityId)
        .reverse()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async createAnalysis(input: NewAnalysis): Promise<AIAnalysis> {
    const analysis: AIAnalysis = {
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      ...input,
    };
    db().analyses.push(analysis);
    return clone(analysis);
  }

  // --- build packs ---------------------------------------------------------

  async listBuildPacks(opportunityId: string): Promise<BuildPack[]> {
    return clone(
      db()
        .buildPacks.filter((b) => b.opportunityId === opportunityId)
        .sort((a, b) => b.version - a.version),
    );
  }

  async createBuildPack(input: NewBuildPack): Promise<BuildPack> {
    const existing = db().buildPacks.filter(
      (b) => b.opportunityId === input.opportunityId,
    );
    const pack: BuildPack = {
      id: crypto.randomUUID(),
      version: existing.length + 1,
      createdAt: nowIso(),
      ...input,
    };
    db().buildPacks.push(pack);
    return clone(pack);
  }

  // --- clusters ------------------------------------------------------------

  async listClusters(): Promise<Cluster[]> {
    return clone([...db().clusters].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async getCluster(id: string): Promise<Cluster | null> {
    const found = db().clusters.find((c) => c.id === id);
    return found ? clone(found) : null;
  }

  async createCluster(input: ClusterInput): Promise<Cluster> {
    const timestamp = nowIso();
    const cluster: Cluster = {
      id: crypto.randomUUID(),
      userId: this.userId,
      isDemo: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...input,
    };
    db().clusters.push(cluster);
    return clone(cluster);
  }

  async updateCluster(id: string, input: ClusterInput): Promise<Cluster> {
    const index = db().clusters.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Cluster not found");
    const updated = { ...db().clusters[index], ...input, updatedAt: nowIso() };
    db().clusters[index] = updated;
    return clone(updated);
  }

  async deleteCluster(id: string): Promise<void> {
    db().clusters = db().clusters.filter((c) => c.id !== id);
    db().clusterOpportunities = db().clusterOpportunities.filter(
      (c) => c.clusterId !== id,
    );
  }

  async listClusterMemberships() {
    return clone(db().clusterOpportunities);
  }

  async addOpportunityToCluster(
    clusterId: string,
    opportunityId: string,
  ): Promise<void> {
    const exists = db().clusterOpportunities.some(
      (c) => c.clusterId === clusterId && c.opportunityId === opportunityId,
    );
    if (!exists) db().clusterOpportunities.push({ clusterId, opportunityId });
  }

  async removeOpportunityFromCluster(
    clusterId: string,
    opportunityId: string,
  ): Promise<void> {
    db().clusterOpportunities = db().clusterOpportunities.filter(
      (c) => !(c.clusterId === clusterId && c.opportunityId === opportunityId),
    );
  }

  // --- assets --------------------------------------------------------------

  async listAssets(): Promise<Asset[]> {
    return clone(
      [...db().assets].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")),
    );
  }

  async getAsset(id: string): Promise<Asset | null> {
    const found = db().assets.find((a) => a.id === id);
    return found ? clone(found) : null;
  }

  async createAsset(input: AssetInput): Promise<Asset> {
    const timestamp = nowIso();
    const asset: Asset = {
      id: crypto.randomUUID(),
      userId: this.userId,
      impressions: null,
      clicks: null,
      ctr: null,
      averagePosition: null,
      pageviews: null,
      revenue: null,
      isDemo: false,
      lastUpdatedAt: timestamp,
      createdAt: timestamp,
      ...input,
    };
    db().assets.push(asset);
    return clone(asset);
  }

  async updateAsset(id: string, patch: Partial<AssetInput>): Promise<Asset> {
    const index = db().assets.findIndex((a) => a.id === id);
    if (index === -1) throw new Error("Asset not found");
    const updated = { ...db().assets[index], ...patch, lastUpdatedAt: nowIso() };
    db().assets[index] = updated;
    return clone(updated);
  }

  async deleteAsset(id: string): Promise<void> {
    db().assets = db().assets.filter((a) => a.id !== id);
    db().assetMetrics = db().assetMetrics.filter((m) => m.assetId !== id);
  }

  // --- asset metrics -------------------------------------------------------

  async listAssetMetrics(assetId: string): Promise<AssetMetric[]> {
    return clone(
      db()
        .assetMetrics.filter((m) => m.assetId === assetId)
        .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd)),
    );
  }

  async listAllAssetMetrics(): Promise<Record<string, AssetMetric[]>> {
    const grouped: Record<string, AssetMetric[]> = {};
    for (const metric of db().assetMetrics) {
      (grouped[metric.assetId] ??= []).push(clone(metric));
    }
    for (const list of Object.values(grouped)) {
      list.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
    }
    return grouped;
  }

  async createAssetMetric(
    assetId: string,
    input: AssetMetricInput,
  ): Promise<AssetMetric> {
    const metric: AssetMetric = {
      id: crypto.randomUUID(),
      assetId,
      source: "MANUAL",
      createdAt: nowIso(),
      ...input,
    };
    db().assetMetrics.push(metric);
    await this.syncAssetFromMetrics(assetId);
    return clone(metric);
  }

  async deleteAssetMetric(id: string): Promise<void> {
    const metric = db().assetMetrics.find((m) => m.id === id);
    db().assetMetrics = db().assetMetrics.filter((m) => m.id !== id);
    if (metric) await this.syncAssetFromMetrics(metric.assetId);
  }

  /** Keeps the asset's headline numbers equal to its most recent metric window. */
  private async syncAssetFromMetrics(assetId: string): Promise<void> {
    const metrics = await this.listAssetMetrics(assetId);
    const latest = metrics[metrics.length - 1];
    const index = db().assets.findIndex((a) => a.id === assetId);
    if (index === -1) return;
    db().assets[index] = {
      ...db().assets[index],
      impressions: latest?.impressions ?? null,
      clicks: latest?.clicks ?? null,
      ctr: latest?.ctr ?? null,
      averagePosition: latest?.averagePosition ?? null,
      pageviews: latest?.pageviews ?? null,
      revenue: latest?.revenue ?? null,
      lastUpdatedAt: nowIso(),
    };
  }

  // --- history -------------------------------------------------------------

  async listStatusHistory(opportunityId: string): Promise<StatusHistoryEntry[]> {
    // Reverse before sorting so that entries written in the same millisecond
    // keep newest-insertion-first order: Array#sort is stable, so equal
    // timestamps preserve the reversed insertion order rather than flipping.
    return clone(
      db()
        .statusHistory.filter((h) => h.opportunityId === opportunityId)
        .reverse()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async listActivity(filter: ActivityFilter = {}): Promise<ActivityEntry[]> {
    let entries = db().activity;
    if (filter.entityType) {
      entries = entries.filter((e) => e.entityType === filter.entityType);
    }
    if (filter.entityId) {
      entries = entries.filter((e) => e.entityId === filter.entityId);
    }
    return clone(
      entries
        .slice()
        .reverse()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100),
    );
  }

  async appendActivity(entry: NewActivity): Promise<ActivityEntry> {
    const activity: ActivityEntry = {
      ...entry,
      id: crypto.randomUUID(),
      userId: this.userId,
      detail: entry.detail ?? null,
      createdAt: nowIso(),
    };
    db().activity.push(activity);
    return clone(activity);
  }
}
