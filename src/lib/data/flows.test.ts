import { beforeEach, describe, expect, it } from "vitest";

import { MemoryStore } from "@/lib/data/memory-store";
import { DEMO_USER_ID } from "@/lib/data/seed";
import type { Store } from "@/lib/data/store";
import { opportunityInputSchema, serpResultInputSchema } from "@/lib/domain/schemas";
import { generateBuildPack } from "@/lib/engine/build-pack";
import { reviewAsset } from "@/lib/engine/checkpoints";
import { scoreOpportunity } from "@/lib/scoring/engine";
import { summarizeSerp } from "@/lib/scoring/serp";

/**
 * End-to-end exercise of the critical operator flows against the in-memory
 * store. These run the same code paths the server actions use, minus the
 * Next.js request plumbing.
 */

const globalRef = globalThis as unknown as { __utilityFactoryDb?: unknown };

async function rescore(store: Store, id: string) {
  const settings = await store.getSettings();
  const opportunity = await store.getOpportunity(id);
  if (!opportunity) throw new Error("missing");
  const breakdown = scoreOpportunity(opportunity, {
    weights: settings.weights,
    thresholds: settings.thresholds,
    demandCalibration: settings.demandCalibration,
  });
  return store.updateOpportunity(id, { opportunityScore: breakdown.total });
}

describe("critical flows", () => {
  let store: Store;

  beforeEach(() => {
    // Each test starts from a freshly seeded database.
    delete globalRef.__utilityFactoryDb;
    store = new MemoryStore(DEMO_USER_ID);
  });

  it("ships with demo data that is flagged as demo", async () => {
    const opportunities = await store.listOpportunities();
    const assets = await store.listAssets();

    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities.every((o) => o.isDemo)).toBe(true);
    expect(assets.every((a) => a.isDemo)).toBe(true);
    expect(opportunities.every((o) => o.source === "SEED")).toBe(true);
  });

  it("creates, scores, updates and re-scores an opportunity", async () => {
    const input = opportunityInputSchema.parse({
      keyword: "sleep debt calculator",
      country: "US",
      language: "en",
      searchVolume: "4400",
      keywordDifficulty: "22",
      cpc: "1.10",
      utilityType: "CALCULATOR",
      utilityFitScore: "90",
      buildSimplicityScore: "85",
    });

    const created = await store.createOpportunity(input);
    expect(created.searchVolume).toBe(4400);
    expect(created.serpWeaknessScore).toBeNull();
    expect(created.status).toBe("INBOX");
    expect(created.isDemo).toBe(false);

    const scored = await rescore(store, created.id);
    expect(scored.opportunityScore).toBeGreaterThan(0);

    // Assessing the heaviest factor should raise the score.
    await store.updateOpportunity(created.id, { serpWeaknessScore: 80 });
    const rescored = await rescore(store, created.id);
    expect(rescored.opportunityScore).toBeGreaterThan(scored.opportunityScore);
  });

  it("keeps unknown metrics unknown through a round trip", async () => {
    const input = opportunityInputSchema.parse({
      keyword: "obscure keyword",
      country: "US",
      language: "en",
      searchVolume: "",
      keywordDifficulty: "",
      cpc: "",
    });

    const created = await store.createOpportunity(input);
    expect(created.searchVolume).toBeNull();
    expect(created.keywordDifficulty).toBeNull();
    expect(created.cpc).toBeNull();

    const reloaded = await store.getOpportunity(created.id);
    expect(reloaded?.searchVolume).toBeNull();
  });

  it("records status history on every transition", async () => {
    const [first] = await store.listOpportunities();

    await store.setOpportunityStatus(first.id, "QUALIFIED", "Research complete");
    await store.setOpportunityStatus(first.id, "READY_TO_BUILD", "Build pack ready");
    // A no-op transition must not create a spurious history entry.
    await store.setOpportunityStatus(first.id, "READY_TO_BUILD", "again");

    const history = await store.listStatusHistory(first.id);
    const transitions = history.filter((h) => h.fromStatus !== null);

    expect(transitions).toHaveLength(2);
    expect(transitions[0].toStatus).toBe("READY_TO_BUILD");
    expect(transitions[0].note).toBe("Build pack ready");

    const updated = await store.getOpportunity(first.id);
    expect(updated?.status).toBe("READY_TO_BUILD");
  });

  it("captures SERP results, summarises them and applies the suggested weakness", async () => {
    const created = await store.createOpportunity(
      opportunityInputSchema.parse({
        keyword: "test serp flow",
        country: "US",
        language: "en",
      }),
    );

    for (const row of [
      { position: 1, domain: "a.example", pageType: "ARTICLE", isLowAuthority: "true" },
      { position: 2, domain: "b.example", pageType: "FORUM", assessment: "POOR_INTENT_MATCH" },
      { position: 3, domain: "c.example", pageType: "ARTICLE", isLowAuthority: "true" },
      { position: 4, domain: "d.example", pageType: "DIRECTORY", isNewSite: "true" },
    ]) {
      await store.createSerpResult(created.id, serpResultInputSchema.parse(row));
    }

    const results = await store.listSerpResults(created.id);
    expect(results).toHaveLength(4);
    expect(results[0].position).toBe(1);

    const summary = summarizeSerp(results);
    expect(summary.suggestedWeaknessScore).not.toBeNull();
    expect(summary.lowAuthorityCount).toBe(2);

    await store.updateOpportunity(created.id, {
      serpWeaknessScore: summary.suggestedWeaknessScore,
    });
    const scored = await rescore(store, created.id);

    expect(scored.serpWeaknessScore).toBe(summary.suggestedWeaknessScore);
    expect(scored.opportunityScore).toBeGreaterThan(0);
  });

  it("generates versioned build packs that reflect the current evidence", async () => {
    const [opportunity] = await store.listOpportunities();
    const settings = await store.getSettings();
    const serpResults = await store.listSerpResults(opportunity.id);

    const first = generateBuildPack({
      opportunity,
      serpResults,
      analysis: null,
      clusters: [],
      clusterSiblings: [],
      settings,
    });

    const packV1 = await store.createBuildPack({
      opportunityId: opportunity.id,
      content: first.content,
      claudeCodePrompt: first.claudeCodePrompt,
      usedAiAnalysis: first.usedAiAnalysis,
    });
    expect(packV1.version).toBe(1);

    const packV2 = await store.createBuildPack({
      opportunityId: opportunity.id,
      content: first.content,
      claudeCodePrompt: first.claudeCodePrompt,
      usedAiAnalysis: first.usedAiAnalysis,
    });
    expect(packV2.version).toBe(2);

    const packs = await store.listBuildPacks(opportunity.id);
    expect(packs[0].version).toBe(2);
    expect(packs[0].claudeCodePrompt).toContain(opportunity.keyword);

    const indexes = await store.getOpportunityIndexes();
    expect(indexes.withBuildPack.has(opportunity.id)).toBe(true);
  });

  it("records asset metrics, mirrors the latest window and drives the checkpoints", async () => {
    const asset = await store.createAsset({
      name: "Test Utility",
      opportunityId: null,
      domain: "test.example",
      url: "https://test.example/tool",
      publishedAt: new Date(Date.now() - 100 * 86_400_000).toISOString(),
      indexedAt: new Date(Date.now() - 95 * 86_400_000).toISOString(),
      measurementPeriod: "Last 30 days",
      assetDecision: "WAIT",
      decisionNote: null,
    });

    expect(asset.impressions).toBeNull();
    expect(reviewAsset(asset, []).recommendedDecision).toBe("WAIT");

    await store.createAssetMetric(asset.id, {
      periodStart: new Date(Date.now() - 60 * 86_400_000).toISOString(),
      periodEnd: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      impressions: 20_000,
      clicks: 120,
      ctr: 0.006,
      averagePosition: 15,
      pageviews: 140,
      revenue: 1.2,
      notes: null,
    });

    await store.createAssetMetric(asset.id, {
      periodStart: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      periodEnd: new Date().toISOString(),
      impressions: 60_000,
      clicks: 300,
      ctr: 0.005,
      averagePosition: 12,
      pageviews: 350,
      revenue: 3.4,
      notes: null,
    });

    const refreshed = await store.getAsset(asset.id);
    expect(refreshed?.impressions).toBe(60_000);
    expect(refreshed?.clicks).toBe(300);

    const metrics = await store.listAssetMetrics(asset.id);
    expect(metrics).toHaveLength(2);

    const review = reviewAsset(refreshed!, metrics);
    expect(review.recommendedDecision).toBe("OPTIMIZE");
    expect(review.checkpoints.find((c) => c.day === 14)!.status).toBe("MET");
  });

  it("recomputes the asset headline when a metric window is deleted", async () => {
    const [asset] = await store.listAssets();
    const before = await store.listAssetMetrics(asset.id);
    expect(before.length).toBeGreaterThan(1);

    await store.deleteAssetMetric(before[before.length - 1].id);

    const after = await store.getAsset(asset.id);
    const remaining = await store.listAssetMetrics(asset.id);

    expect(remaining).toHaveLength(before.length - 1);
    expect(after?.clicks).toBe(remaining[remaining.length - 1].clicks);
  });

  it("adds and removes cluster membership", async () => {
    const cluster = await store.createCluster({
      name: "Test Cluster",
      description: null,
      domainCandidate: null,
      theme: null,
    });
    const [opportunity] = await store.listOpportunities();

    await store.addOpportunityToCluster(cluster.id, opportunity.id);
    // Adding twice must not duplicate the link.
    await store.addOpportunityToCluster(cluster.id, opportunity.id);

    let memberships = await store.listClusterMemberships();
    expect(
      memberships.filter(
        (m) => m.clusterId === cluster.id && m.opportunityId === opportunity.id,
      ),
    ).toHaveLength(1);

    const filtered = await store.listOpportunities({ clusterId: cluster.id });
    expect(filtered.map((o) => o.id)).toEqual([opportunity.id]);

    await store.removeOpportunityFromCluster(cluster.id, opportunity.id);
    memberships = await store.listClusterMemberships();
    expect(
      memberships.some(
        (m) => m.clusterId === cluster.id && m.opportunityId === opportunity.id,
      ),
    ).toBe(false);
  });

  it("filters the explorer the way the UI asks it to", async () => {
    const highVolume = await store.listOpportunities({ minSearchVolume: 10_000 });
    expect(highVolume.every((o) => (o.searchVolume ?? 0) >= 10_000)).toBe(true);
    // Unknown volumes must be excluded by a minimum filter, not treated as zero-pass.
    expect(highVolume.every((o) => o.searchVolume !== null)).toBe(true);

    const easy = await store.listOpportunities({ maxKeywordDifficulty: 25 });
    expect(easy.every((o) => (o.keywordDifficulty ?? 999) <= 25)).toBe(true);

    const research = await store.listOpportunities({ status: ["RESEARCH"] });
    expect(research.every((o) => o.status === "RESEARCH")).toBe(true);

    const byKeyword = await store.listOpportunities({ keyword: "calculator" });
    expect(byKeyword.every((o) => o.keyword.includes("calculator"))).toBe(true);

    const generators = await store.listOpportunities({ utilityType: ["GENERATOR"] });
    expect(generators.every((o) => o.utilityType === "GENERATOR")).toBe(true);
  });

  it("cascades deletion of an opportunity's children", async () => {
    const created = await store.createOpportunity(
      opportunityInputSchema.parse({
        keyword: "doomed keyword",
        country: "US",
        language: "en",
      }),
    );
    await store.createSerpResult(
      created.id,
      serpResultInputSchema.parse({ position: 1, domain: "x.example" }),
    );
    await store.createBuildPack({
      opportunityId: created.id,
      content: { productName: "x" } as never,
      claudeCodePrompt: "x",
      usedAiAnalysis: false,
    });

    await store.deleteOpportunity(created.id);

    expect(await store.getOpportunity(created.id)).toBeNull();
    expect(await store.listSerpResults(created.id)).toHaveLength(0);
    expect(await store.listBuildPacks(created.id)).toHaveLength(0);
    expect(await store.listStatusHistory(created.id)).toHaveLength(0);
  });

  it("persists settings and reports them back", async () => {
    const updated = await store.updateSettings({
      weights: {
        demand: 30,
        serpWeakness: 30,
        utilityFit: 20,
        monetization: 10,
        evergreen: 5,
        buildSimplicity: 5,
        clusterPotential: 0,
      },
      currency: "EUR",
    });

    expect(updated.weights.demand).toBe(30);
    expect(updated.currency).toBe("EUR");

    const reloaded = await store.getSettings();
    expect(reloaded.weights.demand).toBe(30);
    expect(reloaded.thresholds.build).toBe(85);
  });

  it("writes an auditable activity trail", async () => {
    const [opportunity] = await store.listOpportunities();

    await store.appendActivity({
      entityType: "OPPORTUNITY",
      entityId: opportunity.id,
      type: "METRICS_CHANGED",
      summary: "search volume unknown → 5400",
      detail: { field: "searchVolume" },
    });

    const entries = await store.listActivity({
      entityType: "OPPORTUNITY",
      entityId: opportunity.id,
    });

    expect(entries[0].summary).toContain("5400");
    expect(entries[0].detail).toEqual({ field: "searchVolume" });
    expect(entries.every((e) => e.entityId === opportunity.id)).toBe(true);
  });
});
