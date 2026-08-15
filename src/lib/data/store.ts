import type {
  AIAnalysis,
  AIAnalysisContent,
  ActivityEntry,
  ActivityType,
  Asset,
  AssetMetric,
  BuildPack,
  BuildPackContent,
  Cluster,
  EntityType,
  Opportunity,
  OpportunityFilters,
  OpportunityStatus,
  SerpResult,
  Settings,
  StatusHistoryEntry,
} from "@/lib/domain/types";
import type {
  AssetInput,
  AssetMetricInput,
  ClusterInput,
  OpportunityInput,
  SerpResultInput,
} from "@/lib/domain/schemas";

/**
 * Persistence contract.
 *
 * Two adapters implement it: Supabase (the real one) and an in-memory store used
 * when Supabase is not configured, so the whole product can be exercised before
 * any infrastructure exists. Both are scoped to a single operator.
 */

export interface OpportunityIndexes {
  withSerp: Set<string>;
  withAnalysis: Set<string>;
  withBuildPack: Set<string>;
  inCluster: Set<string>;
}

export interface ActivityFilter {
  entityType?: EntityType;
  entityId?: string;
  limit?: number;
}

export interface NewActivity {
  entityType: EntityType;
  entityId: string;
  type: ActivityType;
  summary: string;
  detail?: Record<string, unknown> | null;
}

export interface NewAnalysis {
  opportunityId: string;
  provider: string;
  model: string | null;
  content: AIAnalysisContent;
  inputSnapshot: Record<string, unknown>;
}

export interface NewBuildPack {
  opportunityId: string;
  content: BuildPackContent;
  claudeCodePrompt: string;
  usedAiAnalysis: boolean;
}

export interface Store {
  /** Which backend is in use — the UI surfaces this so demo mode is never mistaken for real persistence. */
  readonly kind: "supabase" | "memory";

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Omit<Settings, "userId" | "updatedAt">>): Promise<Settings>;

  listOpportunities(filters?: OpportunityFilters): Promise<Opportunity[]>;
  getOpportunity(id: string): Promise<Opportunity | null>;
  createOpportunity(input: OpportunityInput): Promise<Opportunity>;
  createOpportunities(inputs: OpportunityInput[]): Promise<Opportunity[]>;
  updateOpportunity(
    id: string,
    patch: Partial<OpportunityInput> & { opportunityScore?: number },
  ): Promise<Opportunity>;
  setOpportunityStatus(
    id: string,
    status: OpportunityStatus,
    note: string | null,
  ): Promise<Opportunity>;
  deleteOpportunity(id: string): Promise<void>;
  getOpportunityIndexes(): Promise<OpportunityIndexes>;

  listSerpResults(opportunityId: string): Promise<SerpResult[]>;
  createSerpResult(opportunityId: string, input: SerpResultInput): Promise<SerpResult>;
  updateSerpResult(id: string, input: SerpResultInput): Promise<SerpResult>;
  deleteSerpResult(id: string): Promise<void>;

  listAnalyses(opportunityId: string): Promise<AIAnalysis[]>;
  createAnalysis(input: NewAnalysis): Promise<AIAnalysis>;

  listBuildPacks(opportunityId: string): Promise<BuildPack[]>;
  createBuildPack(input: NewBuildPack): Promise<BuildPack>;

  listClusters(): Promise<Cluster[]>;
  getCluster(id: string): Promise<Cluster | null>;
  createCluster(input: ClusterInput): Promise<Cluster>;
  updateCluster(id: string, input: ClusterInput): Promise<Cluster>;
  deleteCluster(id: string): Promise<void>;
  listClusterMemberships(): Promise<Array<{ clusterId: string; opportunityId: string }>>;
  addOpportunityToCluster(clusterId: string, opportunityId: string): Promise<void>;
  removeOpportunityFromCluster(clusterId: string, opportunityId: string): Promise<void>;

  listAssets(): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | null>;
  createAsset(input: AssetInput): Promise<Asset>;
  updateAsset(id: string, patch: Partial<AssetInput>): Promise<Asset>;
  deleteAsset(id: string): Promise<void>;

  listAssetMetrics(assetId: string): Promise<AssetMetric[]>;
  listAllAssetMetrics(): Promise<Record<string, AssetMetric[]>>;
  createAssetMetric(assetId: string, input: AssetMetricInput): Promise<AssetMetric>;
  deleteAssetMetric(id: string): Promise<void>;

  listStatusHistory(opportunityId: string): Promise<StatusHistoryEntry[]>;

  listActivity(filter?: ActivityFilter): Promise<ActivityEntry[]>;
  appendActivity(entry: NewActivity): Promise<ActivityEntry>;
}

/** Shared client-side filtering so both adapters behave identically. */
export function applyOpportunityFilters(
  opportunities: Opportunity[],
  filters: OpportunityFilters | undefined,
  memberships?: Array<{ clusterId: string; opportunityId: string }>,
): Opportunity[] {
  if (!filters) return opportunities;

  const keyword = filters.keyword?.trim().toLowerCase();
  const clusterMembers = filters.clusterId
    ? new Set(
        (memberships ?? [])
          .filter((m) => m.clusterId === filters.clusterId)
          .map((m) => m.opportunityId),
      )
    : null;

  return opportunities.filter((o) => {
    if (keyword && !o.keyword.toLowerCase().includes(keyword)) return false;
    if (filters.country && o.country !== filters.country) return false;
    if (filters.language && o.language !== filters.language) return false;
    if (
      filters.minSearchVolume !== undefined &&
      (o.searchVolume === null || o.searchVolume < filters.minSearchVolume)
    ) {
      return false;
    }
    if (
      filters.maxKeywordDifficulty !== undefined &&
      (o.keywordDifficulty === null || o.keywordDifficulty > filters.maxKeywordDifficulty)
    ) {
      return false;
    }
    if (filters.minCpc !== undefined && (o.cpc === null || o.cpc < filters.minCpc)) {
      return false;
    }
    if (
      filters.minSerpWeakness !== undefined &&
      (o.serpWeaknessScore === null || o.serpWeaknessScore < filters.minSerpWeakness)
    ) {
      return false;
    }
    if (
      filters.minOpportunityScore !== undefined &&
      o.opportunityScore < filters.minOpportunityScore
    ) {
      return false;
    }
    if (filters.status?.length && !filters.status.includes(o.status)) return false;
    if (
      filters.utilityType?.length &&
      (o.utilityType === null || !filters.utilityType.includes(o.utilityType))
    ) {
      return false;
    }
    if (clusterMembers && !clusterMembers.has(o.id)) return false;
    if (filters.includeDemo === false && o.isDemo) return false;
    return true;
  });
}
