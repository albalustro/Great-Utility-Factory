import { describe, expect, it } from "vitest";

import type { Asset, AssetMetric } from "@/lib/domain/types";
import { CHECKPOINT_THRESHOLDS, reviewAsset } from "@/lib/engine/checkpoints";

const NOW = new Date("2026-06-01T00:00:00.000Z");
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    userId: "user-1",
    opportunityId: null,
    name: "Test Utility",
    domain: null,
    url: null,
    publishedAt: daysAgo(100),
    indexedAt: null,
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
    createdAt: daysAgo(100),
    ...overrides,
  };
}

let metricCounter = 0;
function metric(overrides: Partial<AssetMetric> = {}): AssetMetric {
  metricCounter += 1;
  return {
    id: `metric-${metricCounter}`,
    assetId: "asset-1",
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

describe("reviewAsset", () => {
  it("waits when the asset has no publication date", () => {
    const review = reviewAsset(asset({ publishedAt: null }), [], NOW);
    expect(review.recommendedDecision).toBe("WAIT");
    expect(review.ageDays).toBeNull();
    expect(review.reasoning[0]).toMatch(/no publication date/i);
  });

  it("marks checkpoints pending before they are due", () => {
    const review = reviewAsset(asset({ publishedAt: daysAgo(3) }), [], NOW);
    expect(review.checkpoints.every((c) => c.status === "PENDING")).toBe(true);
  });

  it("distinguishes 'no data' from 'not met'", () => {
    // Due, but nothing recorded at all.
    const noData = reviewAsset(asset({ publishedAt: daysAgo(40) }), [], NOW);
    expect(noData.checkpoints.find((c) => c.day === 14)!.status).toBe("NO_DATA");

    // Due, and a real measured zero.
    const measuredZero = reviewAsset(
      asset({ publishedAt: daysAgo(40) }),
      [metric({ impressions: 0, clicks: 0 })],
      NOW,
    );
    expect(measuredZero.checkpoints.find((c) => c.day === 14)!.status).toBe("NOT_MET");
  });

  it("passes day 7 only when indexation was actually recorded", () => {
    expect(
      reviewAsset(asset({ indexedAt: daysAgo(90) }), [], NOW).checkpoints[0].status,
    ).toBe("MET");
    expect(reviewAsset(asset({ indexedAt: null }), [], NOW).checkpoints[0].status).toBe(
      "NOT_MET",
    );
  });

  it("needs two positioned windows before judging the ranking trend", () => {
    const single = reviewAsset(
      asset(),
      [metric({ averagePosition: 12 })],
      NOW,
    );
    expect(single.checkpoints.find((c) => c.day === 30)!.status).toBe("NO_DATA");

    const improving = reviewAsset(
      asset(),
      [
        metric({ periodEnd: daysAgo(60), averagePosition: 22 }),
        metric({ periodEnd: daysAgo(0), averagePosition: 9 }),
      ],
      NOW,
    );
    expect(improving.checkpoints.find((c) => c.day === 30)!.status).toBe("MET");
  });

  it("recommends OPTIMIZE when impressions are healthy but CTR is weak", () => {
    const review = reviewAsset(
      asset({ indexedAt: daysAgo(90) }),
      [metric({ impressions: 50_000, clicks: 300, ctr: 0.006, averagePosition: 12 })],
      NOW,
    );

    expect(review.recommendedDecision).toBe("OPTIMIZE");
    expect(review.reasoning.join(" ")).toMatch(/CTR/);
  });

  it("recommends SCALE once the day-90 bar is cleared", () => {
    const review = reviewAsset(
      asset({ indexedAt: daysAgo(95) }),
      [
        metric({ periodEnd: daysAgo(60), impressions: 20_000, clicks: 400, ctr: 0.02 }),
        metric({
          periodEnd: daysAgo(0),
          impressions: 90_000,
          clicks: 5_000,
          ctr: 0.055,
          averagePosition: 3.2,
          revenue: 210,
        }),
      ],
      NOW,
    );

    expect(review.recommendedDecision).toBe("SCALE");
  });

  it("recommends KILL only after 90 days with measured zeros", () => {
    const review = reviewAsset(
      asset({ publishedAt: daysAgo(120), indexedAt: daysAgo(115) }),
      [
        metric({ periodEnd: daysAgo(30), impressions: 0, clicks: 0 }),
        metric({ periodEnd: daysAgo(0), impressions: 0, clicks: 0 }),
      ],
      NOW,
    );

    expect(review.recommendedDecision).toBe("KILL");
    expect(review.reasoning.join(" ")).toMatch(/confirm the data/i);
  });

  it("does not kill an old asset whose metrics were simply never recorded", () => {
    const review = reviewAsset(asset({ publishedAt: daysAgo(200) }), [], NOW);
    expect(review.recommendedDecision).toBe("WAIT");
    expect(review.reasoning.join(" ")).toMatch(/no measurement data/i);
  });

  it("reports an override when the stored decision differs from the recommendation", () => {
    const review = reviewAsset(
      asset({ publishedAt: daysAgo(10), assetDecision: "SCALE" }),
      [],
      NOW,
    );
    expect(review.recommendedDecision).toBe("WAIT");
    expect(review.isOverridden).toBe(true);
  });

  it("exposes its thresholds rather than hiding magic numbers", () => {
    expect(CHECKPOINT_THRESHOLDS.minMeaningfulClicks).toBeGreaterThan(0);
    expect(CHECKPOINT_THRESHOLDS.minSustainedClicks).toBeGreaterThan(
      CHECKPOINT_THRESHOLDS.minMeaningfulClicks,
    );
    expect(CHECKPOINT_THRESHOLDS.weakCtr).toBeLessThan(1);
  });
});
