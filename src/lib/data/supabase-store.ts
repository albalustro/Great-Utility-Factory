import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_SETTINGS,
  type AIAnalysis,
  type AIAnalysisContent,
  type ActivityEntry,
  type ActivityType,
  type Asset,
  type AssetDecision,
  type AssetMetric,
  type BuildPack,
  type BuildPackContent,
  type Cluster,
  type CompetitionLevel,
  type EntityType,
  type Opportunity,
  type OpportunityFilters,
  type OpportunitySource,
  type OpportunityStatus,
  type PageType,
  type SerpAssessment,
  type SerpResult,
  type Settings,
  type StatusHistoryEntry,
  type Trend,
  type UtilityType,
} from "@/lib/domain/types";
import type {
  AssetInput,
  AssetMetricInput,
  ClusterInput,
  SerpResultInput,
} from "@/lib/domain/schemas";
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

/** PostgREST can hand back numerics as strings depending on driver settings. */
const num = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(parsed) ? parsed : null;
};

const bool = (value: unknown): boolean | null =>
  value === null || value === undefined ? null : Boolean(value);

type Row = Record<string, unknown>;

function mapOpportunity(row: Row): Opportunity {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    keyword: row.keyword as string,
    country: row.country as string,
    language: row.language as string,
    searchVolume: num(row.search_volume),
    keywordDifficulty: num(row.keyword_difficulty),
    cpc: num(row.cpc),
    competitionIndex: num(row.competition_index),
    competitionLevel: (row.competition_level as CompetitionLevel | null) ?? null,
    metricsProvider: (row.metrics_provider as string | null) ?? null,
    metricsFetchedAt: (row.metrics_fetched_at as string | null) ?? null,
    trend: row.trend as Trend,
    utilityType: (row.utility_type as UtilityType | null) ?? null,
    serpWeaknessScore: num(row.serp_weakness_score),
    utilityFitScore: num(row.utility_fit_score),
    monetizationScore: num(row.monetization_score),
    evergreenScore: num(row.evergreen_score),
    buildSimplicityScore: num(row.build_simplicity_score),
    clusterPotentialScore: num(row.cluster_potential_score),
    demandScoreOverride: num(row.demand_score_override),
    demandScoreOverrideReason: (row.demand_score_override_reason as string | null) ?? null,
    opportunityScore: num(row.opportunity_score) ?? 0,
    status: row.status as OpportunityStatus,
    source: row.source as OpportunitySource,
    notes: (row.notes as string | null) ?? null,
    isDemo: Boolean(row.is_demo),
    statusChangedAt: row.status_changed_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function opportunityToRow(input: OpportunityPatch): Row {
  const row: Row = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("keyword", input.keyword);
  set("country", input.country);
  set("language", input.language);
  set("search_volume", input.searchVolume);
  set("keyword_difficulty", input.keywordDifficulty);
  set("cpc", input.cpc);
  set("competition_index", input.competitionIndex);
  set("competition_level", input.competitionLevel);
  set("metrics_provider", input.metricsProvider);
  set("metrics_fetched_at", input.metricsFetchedAt);
  set("trend", input.trend);
  set("utility_type", input.utilityType);
  set("serp_weakness_score", input.serpWeaknessScore);
  set("utility_fit_score", input.utilityFitScore);
  set("monetization_score", input.monetizationScore);
  set("evergreen_score", input.evergreenScore);
  set("build_simplicity_score", input.buildSimplicityScore);
  set("cluster_potential_score", input.clusterPotentialScore);
  set("demand_score_override", input.demandScoreOverride);
  set("demand_score_override_reason", input.demandScoreOverrideReason);
  set("status", input.status);
  set("source", input.source);
  set("notes", input.notes);
  set("opportunity_score", input.opportunityScore);
  return row;
}

function mapSerp(row: Row): SerpResult {
  return {
    id: row.id as string,
    opportunityId: row.opportunity_id as string,
    position: num(row.position) ?? 0,
    domain: row.domain as string,
    url: (row.url as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    domainAuthority: num(row.domain_authority),
    pageType: row.page_type as PageType,
    isLowAuthority: bool(row.is_low_authority),
    isNewSite: bool(row.is_new_site),
    assessment: row.assessment as SerpAssessment,
    notes: (row.notes as string | null) ?? null,
    source: (row.source as "MANUAL" | "PROVIDER" | null) ?? "MANUAL",
    provider: (row.provider as string | null) ?? null,
    fetchedAt: (row.fetched_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const serpToRow = (input: SerpResultInput): Row => ({
  position: input.position,
  domain: input.domain,
  url: input.url,
  title: input.title,
  domain_authority: input.domainAuthority,
  page_type: input.pageType,
  is_low_authority: input.isLowAuthority,
  is_new_site: input.isNewSite,
  assessment: input.assessment,
  notes: input.notes,
});

function mapAsset(row: Row): Asset {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    opportunityId: (row.opportunity_id as string | null) ?? null,
    name: row.name as string,
    domain: (row.domain as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    indexedAt: (row.indexed_at as string | null) ?? null,
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    ctr: num(row.ctr),
    averagePosition: num(row.average_position),
    pageviews: num(row.pageviews),
    revenue: num(row.revenue),
    measurementPeriod: (row.measurement_period as string | null) ?? null,
    assetDecision: row.asset_decision as AssetDecision,
    decisionNote: (row.decision_note as string | null) ?? null,
    isDemo: Boolean(row.is_demo),
    lastUpdatedAt: row.last_updated_at as string,
    createdAt: row.created_at as string,
  };
}

function assetToRow(input: Partial<AssetInput>): Row {
  const row: Row = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("name", input.name);
  set("opportunity_id", input.opportunityId);
  set("domain", input.domain);
  set("url", input.url);
  set("published_at", input.publishedAt);
  set("indexed_at", input.indexedAt);
  set("measurement_period", input.measurementPeriod);
  set("asset_decision", input.assetDecision);
  set("decision_note", input.decisionNote);
  return row;
}

function mapMetric(row: Row): AssetMetric {
  return {
    id: row.id as string,
    assetId: row.asset_id as string,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    ctr: num(row.ctr),
    averagePosition: num(row.average_position),
    pageviews: num(row.pageviews),
    revenue: num(row.revenue),
    source: (row.source as AssetMetric["source"]) ?? "MANUAL",
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapCluster(row: Row): Cluster {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    domainCandidate: (row.domain_candidate as string | null) ?? null,
    theme: (row.theme as string | null) ?? null,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Throws with the PostgREST message so failures are debuggable, not silent. */
function unwrap(result: {
  data: unknown;
  error: { message: string } | null;
}): unknown {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) {
    throw new Error("No data returned");
  }
  return result.data;
}

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  // --- settings ------------------------------------------------------------

  async getSettings(): Promise<Settings> {
    const { data, error } = await this.client
      .from("settings")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      // First run for this user, or the bootstrap trigger did not fire.
      const created = unwrap(
        await this.client
          .from("settings")
          .insert({ user_id: this.userId })
          .select("*")
          .single(),
      );
      return this.mapSettings(created as Row);
    }

    return this.mapSettings(data as Row);
  }

  private mapSettings(row: Row): Settings {
    return {
      userId: row.user_id as string,
      weights: (row.weights as Settings["weights"]) ?? DEFAULT_SETTINGS.weights,
      thresholds:
        (row.thresholds as Settings["thresholds"]) ?? DEFAULT_SETTINGS.thresholds,
      demandCalibration:
        (row.demand_calibration as Settings["demandCalibration"]) ??
        DEFAULT_SETTINGS.demandCalibration,
      providers:
        (row.providers as Settings["providers"]) ?? DEFAULT_SETTINGS.providers,
      defaultCountry: (row.default_country as string) ?? DEFAULT_SETTINGS.defaultCountry,
      defaultLanguage:
        (row.default_language as string) ?? DEFAULT_SETTINGS.defaultLanguage,
      currency: (row.currency as string) ?? DEFAULT_SETTINGS.currency,
      updatedAt: row.updated_at as string,
    };
  }

  async updateSettings(
    patch: Partial<Omit<Settings, "userId" | "updatedAt">>,
  ): Promise<Settings> {
    const row: Row = { user_id: this.userId, updated_at: new Date().toISOString() };
    if (patch.weights) row.weights = patch.weights;
    if (patch.thresholds) row.thresholds = patch.thresholds;
    if (patch.demandCalibration) row.demand_calibration = patch.demandCalibration;
    if (patch.providers) row.providers = patch.providers;
    if (patch.defaultCountry) row.default_country = patch.defaultCountry;
    if (patch.defaultLanguage) row.default_language = patch.defaultLanguage;
    if (patch.currency) row.currency = patch.currency;

    const data = unwrap(
      await this.client
        .from("settings")
        .upsert(row, { onConflict: "user_id" })
        .select("*")
        .single(),
    );
    return this.mapSettings(data as Row);
  }

  // --- opportunities -------------------------------------------------------

  async listOpportunities(filters?: OpportunityFilters): Promise<Opportunity[]> {
    let query = this.client
      .from("opportunities")
      .select("*")
      .eq("user_id", this.userId);

    // Push the cheap, index-friendly predicates into Postgres; the rest are
    // applied by the shared filter so both adapters behave identically.
    if (filters?.status?.length) query = query.in("status", filters.status);
    if (filters?.country) query = query.eq("country", filters.country);
    if (filters?.language) query = query.eq("language", filters.language);
    if (filters?.keyword) query = query.ilike("keyword", `%${filters.keyword}%`);
    if (filters?.minOpportunityScore !== undefined) {
      query = query.gte("opportunity_score", filters.minOpportunityScore);
    }

    const data = unwrap(await query.order("opportunity_score", { ascending: false }));
    const mapped = (data as Row[]).map(mapOpportunity);

    const memberships = filters?.clusterId
      ? await this.listClusterMemberships()
      : undefined;
    return applyOpportunityFilters(mapped, filters, memberships);
  }

  async getOpportunity(id: string): Promise<Opportunity | null> {
    const { data, error } = await this.client
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapOpportunity(data as Row) : null;
  }

  async createOpportunity(input: OpportunityWrite): Promise<Opportunity> {
    const [created] = await this.createOpportunities([input]);
    return created;
  }

  async createOpportunities(inputs: OpportunityWrite[]): Promise<Opportunity[]> {
    if (inputs.length === 0) return [];

    const rows = inputs.map((input) => ({
      ...opportunityToRow(input),
      user_id: this.userId,
    }));

    const data = unwrap(
      await this.client.from("opportunities").insert(rows).select("*"),
    ) as Row[];

    const created = data.map(mapOpportunity);

    await this.client.from("status_history").insert(
      created.map((o) => ({
        opportunity_id: o.id,
        from_status: null,
        to_status: o.status,
      })),
    );

    return created;
  }

  async updateOpportunity(id: string, patch: OpportunityPatch): Promise<Opportunity> {
    const data = unwrap(
      await this.client
        .from("opportunities")
        .update(opportunityToRow(patch))
        .eq("id", id)
        .eq("user_id", this.userId)
        .select("*")
        .single(),
    );
    return mapOpportunity(data as Row);
  }

  async setOpportunityStatus(
    id: string,
    status: OpportunityStatus,
    note: string | null,
  ): Promise<Opportunity> {
    const current = await this.getOpportunity(id);
    if (!current) throw new Error("Opportunity not found");

    if (current.status === status) return current;

    const data = unwrap(
      await this.client
        .from("opportunities")
        .update({ status, status_changed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", this.userId)
        .select("*")
        .single(),
    );

    await this.client.from("status_history").insert({
      opportunity_id: id,
      from_status: current.status,
      to_status: status,
      note,
    });

    return mapOpportunity(data as Row);
  }

  async deleteOpportunity(id: string): Promise<void> {
    const { error } = await this.client
      .from("opportunities")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId);
    if (error) throw new Error(error.message);
  }

  async getOpportunityIndexes(): Promise<OpportunityIndexes> {
    const [serp, analyses, packs, clusterLinks] = await Promise.all([
      this.client.from("serp_results").select("opportunity_id"),
      this.client.from("ai_analyses").select("opportunity_id"),
      this.client.from("build_packs").select("opportunity_id"),
      this.client.from("cluster_opportunities").select("opportunity_id"),
    ]);

    const toSet = (result: { data: Row[] | null }) =>
      new Set((result.data ?? []).map((row) => row.opportunity_id as string));

    return {
      withSerp: toSet(serp as { data: Row[] | null }),
      withAnalysis: toSet(analyses as { data: Row[] | null }),
      withBuildPack: toSet(packs as { data: Row[] | null }),
      inCluster: toSet(clusterLinks as { data: Row[] | null }),
    };
  }

  // --- SERP ----------------------------------------------------------------

  async listSerpResults(opportunityId: string): Promise<SerpResult[]> {
    const data = unwrap(
      await this.client
        .from("serp_results")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("position", { ascending: true }),
    ) as Row[];
    return data.map(mapSerp);
  }

  async createSerpResult(
    opportunityId: string,
    input: SerpResultInput,
  ): Promise<SerpResult> {
    const data = unwrap(
      await this.client
        .from("serp_results")
        .insert({ ...serpToRow(input), opportunity_id: opportunityId })
        .select("*")
        .single(),
    );
    return mapSerp(data as Row);
  }

  async updateSerpResult(id: string, input: SerpResultInput): Promise<SerpResult> {
    const data = unwrap(
      await this.client
        .from("serp_results")
        .update(serpToRow(input))
        .eq("id", id)
        .select("*")
        .single(),
    );
    return mapSerp(data as Row);
  }

  async deleteSerpResult(id: string): Promise<void> {
    const { error } = await this.client.from("serp_results").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async replaceProviderSerpResults(
    opportunityId: string,
    snapshot: ProviderSerpSnapshot,
  ): Promise<{ inserted: number; carriedOver: number }> {
    const existing = await this.listSerpResults(opportunityId);
    const judgements = collectJudgements(existing);

    const { error } = await this.client
      .from("serp_results")
      .delete()
      .eq("opportunity_id", opportunityId)
      .eq("source", "PROVIDER");
    if (error) throw new Error(error.message);

    if (snapshot.results.length === 0) return { inserted: 0, carriedOver: 0 };

    let carriedOver = 0;
    const rows = snapshot.results.map((input) => {
      const prior = judgements.get(input.domain.toLowerCase());
      if (prior) carriedOver += 1;
      return {
        ...serpToRow(prior ? { ...input, ...prior } : input),
        opportunity_id: opportunityId,
        source: "PROVIDER",
        provider: snapshot.provider,
        fetched_at: snapshot.fetchedAt,
      };
    });

    unwrap(await this.client.from("serp_results").insert(rows).select("id"));

    return { inserted: rows.length, carriedOver };
  }

  // --- AI analyses ---------------------------------------------------------

  async listAnalyses(opportunityId: string): Promise<AIAnalysis[]> {
    const data = unwrap(
      await this.client
        .from("ai_analyses")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false }),
    ) as Row[];

    return data.map((row) => ({
      id: row.id as string,
      opportunityId: row.opportunity_id as string,
      provider: row.provider as string,
      model: (row.model as string | null) ?? null,
      content: row.content as AIAnalysisContent,
      inputSnapshot: (row.input_snapshot as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    }));
  }

  async createAnalysis(input: NewAnalysis): Promise<AIAnalysis> {
    const data = unwrap(
      await this.client
        .from("ai_analyses")
        .insert({
          opportunity_id: input.opportunityId,
          provider: input.provider,
          model: input.model,
          content: input.content,
          input_snapshot: input.inputSnapshot,
        })
        .select("*")
        .single(),
    ) as Row;

    return {
      id: data.id as string,
      opportunityId: data.opportunity_id as string,
      provider: data.provider as string,
      model: (data.model as string | null) ?? null,
      content: data.content as AIAnalysisContent,
      inputSnapshot: (data.input_snapshot as Record<string, unknown>) ?? {},
      createdAt: data.created_at as string,
    };
  }

  // --- build packs ---------------------------------------------------------

  async listBuildPacks(opportunityId: string): Promise<BuildPack[]> {
    const data = unwrap(
      await this.client
        .from("build_packs")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("version", { ascending: false }),
    ) as Row[];

    return data.map((row) => ({
      id: row.id as string,
      opportunityId: row.opportunity_id as string,
      version: num(row.version) ?? 1,
      content: row.content as BuildPackContent,
      claudeCodePrompt: row.claude_code_prompt as string,
      usedAiAnalysis: Boolean(row.used_ai_analysis),
      createdAt: row.created_at as string,
    }));
  }

  async createBuildPack(input: NewBuildPack): Promise<BuildPack> {
    const existing = await this.listBuildPacks(input.opportunityId);
    const version = (existing[0]?.version ?? 0) + 1;

    const data = unwrap(
      await this.client
        .from("build_packs")
        .insert({
          opportunity_id: input.opportunityId,
          version,
          content: input.content,
          claude_code_prompt: input.claudeCodePrompt,
          used_ai_analysis: input.usedAiAnalysis,
        })
        .select("*")
        .single(),
    ) as Row;

    return {
      id: data.id as string,
      opportunityId: data.opportunity_id as string,
      version: num(data.version) ?? version,
      content: data.content as BuildPackContent,
      claudeCodePrompt: data.claude_code_prompt as string,
      usedAiAnalysis: Boolean(data.used_ai_analysis),
      createdAt: data.created_at as string,
    };
  }

  // --- clusters ------------------------------------------------------------

  async listClusters(): Promise<Cluster[]> {
    const data = unwrap(
      await this.client
        .from("clusters")
        .select("*")
        .eq("user_id", this.userId)
        .order("name", { ascending: true }),
    ) as Row[];
    return data.map(mapCluster);
  }

  async getCluster(id: string): Promise<Cluster | null> {
    const { data, error } = await this.client
      .from("clusters")
      .select("*")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapCluster(data as Row) : null;
  }

  async createCluster(input: ClusterInput): Promise<Cluster> {
    const data = unwrap(
      await this.client
        .from("clusters")
        .insert({
          user_id: this.userId,
          name: input.name,
          description: input.description,
          domain_candidate: input.domainCandidate,
          theme: input.theme,
        })
        .select("*")
        .single(),
    );
    return mapCluster(data as Row);
  }

  async updateCluster(id: string, input: ClusterInput): Promise<Cluster> {
    const data = unwrap(
      await this.client
        .from("clusters")
        .update({
          name: input.name,
          description: input.description,
          domain_candidate: input.domainCandidate,
          theme: input.theme,
        })
        .eq("id", id)
        .eq("user_id", this.userId)
        .select("*")
        .single(),
    );
    return mapCluster(data as Row);
  }

  async deleteCluster(id: string): Promise<void> {
    const { error } = await this.client
      .from("clusters")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId);
    if (error) throw new Error(error.message);
  }

  async listClusterMemberships() {
    const data = unwrap(
      await this.client.from("cluster_opportunities").select("cluster_id, opportunity_id"),
    ) as Row[];
    return data.map((row) => ({
      clusterId: row.cluster_id as string,
      opportunityId: row.opportunity_id as string,
    }));
  }

  async addOpportunityToCluster(
    clusterId: string,
    opportunityId: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("cluster_opportunities")
      .upsert(
        { cluster_id: clusterId, opportunity_id: opportunityId },
        { onConflict: "cluster_id,opportunity_id" },
      );
    if (error) throw new Error(error.message);
  }

  async removeOpportunityFromCluster(
    clusterId: string,
    opportunityId: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("cluster_opportunities")
      .delete()
      .eq("cluster_id", clusterId)
      .eq("opportunity_id", opportunityId);
    if (error) throw new Error(error.message);
  }

  // --- assets --------------------------------------------------------------

  async listAssets(): Promise<Asset[]> {
    const data = unwrap(
      await this.client
        .from("assets")
        .select("*")
        .eq("user_id", this.userId)
        .order("published_at", { ascending: false, nullsFirst: false }),
    ) as Row[];
    return data.map(mapAsset);
  }

  async getAsset(id: string): Promise<Asset | null> {
    const { data, error } = await this.client
      .from("assets")
      .select("*")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapAsset(data as Row) : null;
  }

  async createAsset(input: AssetInput): Promise<Asset> {
    const data = unwrap(
      await this.client
        .from("assets")
        .insert({ ...assetToRow(input), user_id: this.userId })
        .select("*")
        .single(),
    );
    return mapAsset(data as Row);
  }

  async updateAsset(id: string, patch: Partial<AssetInput>): Promise<Asset> {
    const data = unwrap(
      await this.client
        .from("assets")
        .update({ ...assetToRow(patch), last_updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", this.userId)
        .select("*")
        .single(),
    );
    return mapAsset(data as Row);
  }

  async deleteAsset(id: string): Promise<void> {
    const { error } = await this.client
      .from("assets")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId);
    if (error) throw new Error(error.message);
  }

  // --- asset metrics -------------------------------------------------------

  async listAssetMetrics(assetId: string): Promise<AssetMetric[]> {
    const data = unwrap(
      await this.client
        .from("asset_metrics")
        .select("*")
        .eq("asset_id", assetId)
        .order("period_end", { ascending: true }),
    ) as Row[];
    return data.map(mapMetric);
  }

  async listAllAssetMetrics(): Promise<Record<string, AssetMetric[]>> {
    const data = unwrap(
      await this.client
        .from("asset_metrics")
        .select("*")
        .order("period_end", { ascending: true }),
    ) as Row[];

    const grouped: Record<string, AssetMetric[]> = {};
    for (const row of data) {
      const metric = mapMetric(row);
      (grouped[metric.assetId] ??= []).push(metric);
    }
    return grouped;
  }

  async createAssetMetric(
    assetId: string,
    input: AssetMetricInput,
  ): Promise<AssetMetric> {
    const data = unwrap(
      await this.client
        .from("asset_metrics")
        .insert({
          asset_id: assetId,
          period_start: input.periodStart,
          period_end: input.periodEnd,
          impressions: input.impressions,
          clicks: input.clicks,
          ctr: input.ctr,
          average_position: input.averagePosition,
          pageviews: input.pageviews,
          revenue: input.revenue,
          notes: input.notes,
          source: "MANUAL",
        })
        .select("*")
        .single(),
    );
    await this.syncAssetFromMetrics(assetId);
    return mapMetric(data as Row);
  }

  async deleteAssetMetric(id: string): Promise<void> {
    const { data } = await this.client
      .from("asset_metrics")
      .select("asset_id")
      .eq("id", id)
      .maybeSingle();

    const { error } = await this.client.from("asset_metrics").delete().eq("id", id);
    if (error) throw new Error(error.message);

    const assetId = (data as Row | null)?.asset_id as string | undefined;
    if (assetId) await this.syncAssetFromMetrics(assetId);
  }

  /** Mirrors the latest metric window onto the asset for cheap list rendering. */
  private async syncAssetFromMetrics(assetId: string): Promise<void> {
    const metrics = await this.listAssetMetrics(assetId);
    const latest = metrics[metrics.length - 1];

    await this.client
      .from("assets")
      .update({
        impressions: latest?.impressions ?? null,
        clicks: latest?.clicks ?? null,
        ctr: latest?.ctr ?? null,
        average_position: latest?.averagePosition ?? null,
        pageviews: latest?.pageviews ?? null,
        revenue: latest?.revenue ?? null,
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", assetId)
      .eq("user_id", this.userId);
  }

  // --- history -------------------------------------------------------------

  async listStatusHistory(opportunityId: string): Promise<StatusHistoryEntry[]> {
    const data = unwrap(
      await this.client
        .from("status_history")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false }),
    ) as Row[];

    return data.map((row) => ({
      id: row.id as string,
      opportunityId: row.opportunity_id as string,
      fromStatus: (row.from_status as OpportunityStatus | null) ?? null,
      toStatus: row.to_status as OpportunityStatus,
      note: (row.note as string | null) ?? null,
      createdAt: row.created_at as string,
    }));
  }

  async listActivity(filter: ActivityFilter = {}): Promise<ActivityEntry[]> {
    let query = this.client
      .from("activity_log")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 100);

    if (filter.entityType) query = query.eq("entity_type", filter.entityType);
    if (filter.entityId) query = query.eq("entity_id", filter.entityId);

    const data = unwrap(await query) as Row[];

    return data.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      entityType: row.entity_type as EntityType,
      entityId: row.entity_id as string,
      type: row.type as ActivityType,
      summary: row.summary as string,
      detail: (row.detail as Record<string, unknown> | null) ?? null,
      createdAt: row.created_at as string,
    }));
  }

  async appendActivity(entry: NewActivity): Promise<ActivityEntry> {
    const data = unwrap(
      await this.client
        .from("activity_log")
        .insert({
          user_id: this.userId,
          entity_type: entry.entityType,
          entity_id: entry.entityId,
          type: entry.type,
          summary: entry.summary,
          detail: entry.detail ?? null,
        })
        .select("*")
        .single(),
    ) as Row;

    return {
      id: data.id as string,
      userId: data.user_id as string,
      entityType: data.entity_type as EntityType,
      entityId: data.entity_id as string,
      type: data.type as ActivityType,
      summary: data.summary as string,
      detail: (data.detail as Record<string, unknown> | null) ?? null,
      createdAt: data.created_at as string,
    };
  }
}
