import { describe, expect, it } from "vitest";

import type { Asset, AssetMetric, Opportunity } from "@/lib/domain/types";
import {
  computeNextBestActions,
  nextBestAction,
  type NextBestActionInput,
} from "@/lib/engine/next-best-action";

const NOW = new Date("2026-06-01T00:00:00.000Z");
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp-1",
    userId: "user-1",
    keyword: "test keyword",
    country: "US",
    language: "en",
    searchVolume: null,
    keywordDifficulty: null,
    cpc: null,
    trend: "UNKNOWN",
    utilityType: null,
    serpWeaknessScore: null,
    utilityFitScore: null,
    monetizationScore: null,
    evergreenScore: null,
    buildSimplicityScore: null,
    clusterPotentialScore: null,
    demandScoreOverride: null,
    demandScoreOverrideReason: null,
    opportunityScore: 0,
    status: "INBOX",
    source: "MANUAL",
    notes: null,
    isDemo: false,
    statusChangedAt: daysAgo(1),
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    ...overrides,
  };
}

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    userId: "user-1",
    opportunityId: null,
    name: "Test Asset",
    domain: null,
    url: null,
    publishedAt: daysAgo(120),
    indexedAt: daysAgo(115),
    impressions: null,
    clicks: null,
    ctr: null,
    averagePosition: null,
    pageviews: null,
    revenue: null,
    measurementPeriod: null,
    assetDecision: "WAIT",
    decisionNote: null,
    isDemo: false,
    lastUpdatedAt: daysAgo(0),
    createdAt: daysAgo(120),
    ...overrides,
  };
}

function metric(assetId: string, overrides: Partial<AssetMetric> = {}): AssetMetric {
  return {
    id: `metric-${assetId}-${Math.random()}`,
    assetId,
    periodStart: daysAgo(30),
    periodEnd: daysAgo(0),
    impressions: null,
    clicks: null,
    ctr: null,
    averagePosition: null,
    pageviews: null,
    revenue: null,
    source: "MANUAL",
    notes: null,
    createdAt: daysAgo(0),
    ...overrides,
  };
}

function input(overrides: Partial<NextBestActionInput> = {}): NextBestActionInput {
  return {
    opportunities: [],
    assets: [],
    metricsByAsset: {},
    opportunitiesWithBuildPack: new Set(),
    opportunitiesWithAnalysis: new Set(),
    opportunitiesWithSerp: new Set(),
    opportunitiesInCluster: new Set(),
    now: NOW,
    ...overrides,
  };
}

describe("computeNextBestActions", () => {
  it("tells an empty factory to import", () => {
    const action = nextBestAction(input());
    expect(action?.actionType).toBe("IMPORT");
    expect(action?.href).toBe("/opportunities/import");
  });

  it("ranks a scalable winner above everything else", () => {
    const winner = asset({ id: "winner", name: "Sleep Cycle Calculator" });

    const action = nextBestAction(
      input({
        assets: [winner],
        metricsByAsset: {
          winner: [
            metric("winner", { periodEnd: daysAgo(60), clicks: 900, impressions: 40_000, ctr: 0.022 }),
            metric("winner", {
              periodEnd: daysAgo(0),
              clicks: 5_000,
              impressions: 90_000,
              ctr: 0.055,
              revenue: 210,
            }),
          ],
        },
        opportunities: [
          opportunity({ id: "ready", status: "READY_TO_BUILD", opportunityScore: 91 }),
        ],
      }),
    );

    expect(action?.actionType).toBe("SCALE");
    expect(action?.entity.label).toBe("Sleep Cycle Calculator");
    expect(action?.evidence.length).toBeGreaterThan(0);
  });

  it("prefers optimising a served page over starting a new build", () => {
    const leaking = asset({ id: "leaking", name: "Dog Age Calculator" });

    const actions = computeNextBestActions(
      input({
        assets: [leaking],
        metricsByAsset: {
          leaking: [
            metric("leaking", {
              impressions: 61_800,
              clicks: 402,
              ctr: 0.0065,
              averagePosition: 12.3,
            }),
          ],
        },
        opportunities: [
          opportunity({ id: "ready", status: "READY_TO_BUILD", opportunityScore: 88 }),
        ],
      }),
    );

    expect(actions[0].actionType).toBe("OPTIMIZE");
    expect(actions[1].actionType).toBe("BUILD");
  });

  it("orders ready-to-build opportunities by score", () => {
    const actions = computeNextBestActions(
      input({
        opportunities: [
          opportunity({ id: "low", keyword: "low", status: "READY_TO_BUILD", opportunityScore: 62 }),
          opportunity({ id: "high", keyword: "high", status: "READY_TO_BUILD", opportunityScore: 94 }),
        ],
      }),
    );

    const builds = actions.filter((a) => a.actionType === "BUILD");
    expect(builds[0].entity.label).toBe("high");
    expect(builds[1].entity.label).toBe("low");
  });

  it("asks for a build pack for qualified opportunities that lack one", () => {
    const withPack = computeNextBestActions(
      input({
        opportunities: [opportunity({ id: "q", status: "QUALIFIED", opportunityScore: 80 })],
        opportunitiesWithBuildPack: new Set(["q"]),
      }),
    );
    expect(withPack.some((a) => a.actionType === "GENERATE_BUILD_PACK")).toBe(false);

    const withoutPack = computeNextBestActions(
      input({
        opportunities: [opportunity({ id: "q", status: "QUALIFIED", opportunityScore: 80 })],
      }),
    );
    expect(withoutPack.some((a) => a.actionType === "GENERATE_BUILD_PACK")).toBe(true);
  });

  it("points research at the missing SERP when demand is known but the SERP is not", () => {
    const actions = computeNextBestActions(
      input({
        opportunities: [
          opportunity({
            id: "r",
            keyword: "vat calculator italy",
            status: "RESEARCH",
            searchVolume: 5400,
            opportunityScore: 55,
          }),
        ],
      }),
    );

    const research = actions.find((a) => a.entity.id === "r");
    expect(research?.actionType).toBe("ANALYZE_SERP");
    expect(research?.href).toContain("tab=serp");
  });

  it("surfaces a dead asset for review but never kills it automatically", () => {
    const actions = computeNextBestActions(
      input({
        assets: [asset({ id: "dead", name: "Dragonborn Name Generator" })],
        metricsByAsset: {
          dead: [metric("dead", { impressions: 0, clicks: 0 })],
        },
      }),
    );

    const review = actions.find((a) => a.entity.id === "dead");
    expect(review?.actionType).toBe("REVIEW");
    expect(review?.actionType).not.toBe("KILL");
  });

  it("stops nagging about an asset already marked KILL", () => {
    const actions = computeNextBestActions(
      input({
        assets: [asset({ id: "dead", assetDecision: "KILL" })],
        metricsByAsset: { dead: [metric("dead", { impressions: 0, clicks: 0 })] },
      }),
    );
    expect(actions.some((a) => a.actionType === "REVIEW")).toBe(false);
  });

  it("is deterministic and stably ordered by priority", () => {
    const fixture = input({
      opportunities: [
        opportunity({ id: "a", status: "READY_TO_BUILD", opportunityScore: 70 }),
        opportunity({ id: "b", status: "QUALIFIED", opportunityScore: 65 }),
      ],
    });

    const first = computeNextBestActions(fixture);
    const second = computeNextBestActions(fixture);

    expect(first.map((a) => `${a.actionType}:${a.entity.id}`)).toEqual(
      second.map((a) => `${a.actionType}:${a.entity.id}`),
    );
    expect(first.map((a) => a.priority)).toEqual(
      [...first.map((a) => a.priority)].sort((x, y) => x - y),
    );
  });
});
