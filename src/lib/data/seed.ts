import {
  DEFAULT_DEMAND_CALIBRATION,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_THRESHOLDS,
  type Asset,
  type AssetMetric,
  type Cluster,
  type Opportunity,
  type SerpResult,
} from "@/lib/domain/types";
import { scoreOpportunity } from "@/lib/scoring/engine";

/**
 * DEMO seed data.
 *
 * Every record here is fictional and is flagged `isDemo`. The metrics are
 * plausible-looking but invented for demonstration, and the UI labels them as
 * demo data everywhere they appear. They must never be read as real-world
 * search or ranking facts.
 */

const uuid = (n: number, prefix: number) =>
  `${prefix.toString().padStart(8, "0")}-0000-4000-8000-${n.toString().padStart(12, "0")}`;

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

const OPP = (n: number) => uuid(n, 1);
const SERP = (n: number) => uuid(n, 2);
const CLUSTER = (n: number) => uuid(n, 3);
const ASSET = (n: number) => uuid(n, 4);
const METRIC = (n: number) => uuid(n, 5);

export interface SeedGraph {
  opportunities: Opportunity[];
  serpResults: SerpResult[];
  clusters: Cluster[];
  clusterOpportunities: Array<{ clusterId: string; opportunityId: string }>;
  assets: Asset[];
  assetMetrics: AssetMetric[];
}

interface SeedOpportunity {
  id: string;
  keyword: string;
  country: string;
  language: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  trend: Opportunity["trend"];
  utilityType: Opportunity["utilityType"];
  serpWeaknessScore: number | null;
  utilityFitScore: number | null;
  monetizationScore: number | null;
  evergreenScore: number | null;
  buildSimplicityScore: number | null;
  clusterPotentialScore: number | null;
  status: Opportunity["status"];
  notes: string | null;
  createdDaysAgo: number;
  statusChangedDaysAgo: number;
}

const OPPORTUNITIES: SeedOpportunity[] = [
  {
    id: OPP(1),
    keyword: "freelance hourly rate calculator",
    country: "US",
    language: "en",
    searchVolume: 8100,
    keywordDifficulty: 24,
    cpc: 3.4,
    trend: "RISING",
    utilityType: "CALCULATOR",
    serpWeaknessScore: 82,
    utilityFitScore: 95,
    monetizationScore: 78,
    evergreenScore: 90,
    buildSimplicityScore: 88,
    clusterPotentialScore: 95,
    status: "READY_TO_BUILD",
    notes:
      "Top of the freelance calculator cluster. SERP is dominated by blog posts that bury the answer under 1,200 words of preamble.",
    createdDaysAgo: 34,
    statusChangedDaysAgo: 6,
  },
  {
    id: OPP(2),
    keyword: "dog age calculator",
    country: "US",
    language: "en",
    searchVolume: 74000,
    keywordDifficulty: 41,
    cpc: 0.42,
    trend: "STABLE",
    utilityType: "CALCULATOR",
    serpWeaknessScore: 38,
    utilityFitScore: 92,
    monetizationScore: 30,
    evergreenScore: 95,
    buildSimplicityScore: 90,
    clusterPotentialScore: 70,
    status: "MEASURING",
    notes:
      "Huge demand but established veterinary brands hold the top four positions. Published anyway to test whether a faster tool can win position 5-10 traffic.",
    createdDaysAgo: 120,
    statusChangedDaysAgo: 74,
  },
  {
    id: OPP(3),
    keyword: "vat calculator italy",
    country: "IT",
    language: "it",
    searchVolume: 5400,
    keywordDifficulty: 18,
    cpc: 1.15,
    trend: "STABLE",
    utilityType: "CALCULATOR",
    serpWeaknessScore: 74,
    utilityFitScore: 88,
    monetizationScore: 55,
    evergreenScore: 92,
    buildSimplicityScore: 85,
    clusterPotentialScore: 80,
    status: "RESEARCH",
    notes:
      "Strong demand against a weak SERP. Needs the current IVA rates confirmed against an authoritative source before anything is built.",
    createdDaysAgo: 12,
    statusChangedDaysAgo: 9,
  },
  {
    id: OPP(4),
    keyword: "random phone number generator",
    country: "US",
    language: "en",
    searchVolume: 12100,
    keywordDifficulty: 29,
    cpc: 0.18,
    trend: "STABLE",
    utilityType: "GENERATOR",
    serpWeaknessScore: 61,
    utilityFitScore: 90,
    monetizationScore: 22,
    evergreenScore: 80,
    buildSimplicityScore: 95,
    clusterPotentialScore: 60,
    status: "QUALIFIED",
    notes:
      "Trivial to build and clearly tool intent, but the traffic is close to worthless commercially. Only worth doing as cluster filler.",
    createdDaysAgo: 21,
    statusChangedDaysAgo: 14,
  },
  {
    id: OPP(5),
    keyword: "dragonborn name generator",
    country: "US",
    language: "en",
    searchVolume: 9900,
    keywordDifficulty: 22,
    cpc: 0.09,
    trend: "DECLINING",
    utilityType: "GENERATOR",
    serpWeaknessScore: 45,
    utilityFitScore: 85,
    monetizationScore: 12,
    evergreenScore: 45,
    buildSimplicityScore: 92,
    clusterPotentialScore: 40,
    status: "MEASURING",
    notes:
      "Built early as a speed test. Fandom-style sites own this space and the commercial value was always going to be near zero.",
    createdDaysAgo: 140,
    statusChangedDaysAgo: 96,
  },
  {
    id: OPP(6),
    keyword: "sleep cycle calculator",
    country: "US",
    language: "en",
    searchVolume: 40500,
    keywordDifficulty: 33,
    cpc: 1.9,
    trend: "RISING",
    utilityType: "CALCULATOR",
    serpWeaknessScore: 68,
    utilityFitScore: 94,
    monetizationScore: 72,
    evergreenScore: 88,
    buildSimplicityScore: 86,
    clusterPotentialScore: 85,
    status: "WINNER",
    notes:
      "The clearest win in the portfolio so far. Ranks for a long tail of bedtime and wake-time variations with no extra pages.",
    createdDaysAgo: 210,
    statusChangedDaysAgo: 38,
  },
  {
    id: OPP(7),
    keyword: "contractor vs employee calculator",
    country: "US",
    language: "en",
    searchVolume: 2900,
    keywordDifficulty: 31,
    cpc: 5.6,
    trend: "RISING",
    utilityType: "CALCULATOR",
    serpWeaknessScore: 70,
    utilityFitScore: 82,
    monetizationScore: 88,
    evergreenScore: 85,
    buildSimplicityScore: 62,
    clusterPotentialScore: 88,
    status: "QUALIFIED",
    notes:
      "Highest CPC in the freelance cluster. The logic is genuinely harder — payroll tax handling varies by state.",
    createdDaysAgo: 26,
    statusChangedDaysAgo: 11,
  },
  {
    id: OPP(8),
    keyword: "freelance tax calculator",
    country: "US",
    language: "en",
    searchVolume: 18100,
    keywordDifficulty: 47,
    cpc: 6.2,
    trend: "RISING",
    utilityType: "CALCULATOR",
    serpWeaknessScore: null,
    utilityFitScore: 80,
    monetizationScore: 92,
    evergreenScore: 88,
    buildSimplicityScore: null,
    clusterPotentialScore: 90,
    status: "RESEARCH",
    notes:
      "Commercially the strongest keyword in the cluster, but the SERP has not been captured yet and the build complexity is unknown.",
    createdDaysAgo: 8,
    statusChangedDaysAgo: 5,
  },
  {
    id: OPP(9),
    keyword: "day rate calculator",
    country: "GB",
    language: "en",
    searchVolume: 3600,
    keywordDifficulty: null,
    cpc: null,
    trend: "UNKNOWN",
    utilityType: "CALCULATOR",
    serpWeaknessScore: null,
    utilityFitScore: 90,
    monetizationScore: null,
    evergreenScore: 85,
    buildSimplicityScore: 90,
    clusterPotentialScore: 82,
    status: "INBOX",
    notes:
      "Imported from a keyword export. Difficulty and CPC were not in the source file, so they stay unknown.",
    createdDaysAgo: 3,
    statusChangedDaysAgo: 3,
  },
  {
    id: OPP(10),
    keyword: "project rate calculator",
    country: "US",
    language: "en",
    searchVolume: 1300,
    keywordDifficulty: null,
    cpc: null,
    trend: "UNKNOWN",
    utilityType: "CALCULATOR",
    serpWeaknessScore: null,
    utilityFitScore: 85,
    monetizationScore: null,
    evergreenScore: 80,
    buildSimplicityScore: 85,
    clusterPotentialScore: 78,
    status: "INBOX",
    notes: "Imported from a keyword export. Not yet researched.",
    createdDaysAgo: 3,
    statusChangedDaysAgo: 3,
  },
];

interface SeedSerp {
  id: string;
  opportunityId: string;
  position: number;
  domain: string;
  url: string | null;
  title: string | null;
  domainAuthority: number | null;
  pageType: SerpResult["pageType"];
  isLowAuthority: boolean | null;
  isNewSite: boolean | null;
  assessment: SerpResult["assessment"];
  notes: string | null;
}

const SERP_RESULTS: SeedSerp[] = [
  // freelance hourly rate calculator — a weak SERP, and the data says why.
  {
    id: SERP(1),
    opportunityId: OPP(1),
    position: 1,
    domain: "example-invoicing-blog.com",
    url: "https://example-invoicing-blog.com/how-to-set-your-freelance-rate",
    title: "How To Set Your Freelance Rate (2026 Guide)",
    domainAuthority: 54,
    pageType: "ARTICLE",
    isLowAuthority: false,
    isNewSite: false,
    assessment: "POOR_INTENT_MATCH",
    notes: "2,400-word guide. The calculator is a spreadsheet download at the bottom.",
  },
  {
    id: SERP(2),
    opportunityId: OPP(1),
    position: 2,
    domain: "example-freelance-tips.net",
    url: "https://example-freelance-tips.net/rate-calculator",
    title: "Freelance Rate Calculator",
    domainAuthority: 21,
    pageType: "UTILITY",
    isLowAuthority: true,
    isNewSite: false,
    assessment: "WEAK_COMPETITOR",
    notes: "A real tool, but three required fields and no explanation of the maths.",
  },
  {
    id: SERP(3),
    opportunityId: OPP(1),
    position: 3,
    domain: "example-community-forum.org",
    url: "https://example-community-forum.org/t/what-should-i-charge",
    title: "What should I charge as a freelancer?",
    domainAuthority: 62,
    pageType: "FORUM",
    isLowAuthority: false,
    isNewSite: false,
    assessment: "POOR_INTENT_MATCH",
    notes: "Thread from 2019. Answers contradict each other.",
  },
  {
    id: SERP(4),
    opportunityId: OPP(1),
    position: 4,
    domain: "example-accounting-saas.com",
    url: "https://example-accounting-saas.com/tools/rate",
    title: "Hourly Rate Calculator for Freelancers",
    domainAuthority: 71,
    pageType: "UTILITY",
    isLowAuthority: false,
    isNewSite: false,
    assessment: "STRONG_COMPETITOR",
    notes: "Good tool behind an email gate after the first result.",
  },
  {
    id: SERP(5),
    opportunityId: OPP(1),
    position: 5,
    domain: "example-newcalc.io",
    url: "https://example-newcalc.io/freelance-hourly-rate",
    title: "Freelance Hourly Rate Calculator - Free",
    domainAuthority: 8,
    pageType: "UTILITY",
    isLowAuthority: true,
    isNewSite: true,
    assessment: "WEAK_COMPETITOR",
    notes: "Registered this year and already at #5, which says the SERP is not settled.",
  },
  {
    id: SERP(6),
    opportunityId: OPP(1),
    position: 6,
    domain: "example-career-magazine.com",
    url: "https://example-career-magazine.com/freelance-pricing",
    title: "Freelance Pricing: The Complete Guide",
    domainAuthority: 68,
    pageType: "ARTICLE",
    isLowAuthority: false,
    isNewSite: false,
    assessment: "POOR_INTENT_MATCH",
    notes: null,
  },
  {
    id: SERP(7),
    opportunityId: OPP(1),
    position: 7,
    domain: "example-directory.co",
    url: "https://example-directory.co/tools/freelance-calculators",
    title: "12 Best Freelance Rate Calculators",
    domainAuthority: 33,
    pageType: "DIRECTORY",
    isLowAuthority: true,
    isNewSite: false,
    assessment: "POOR_INTENT_MATCH",
    notes: "Listicle of other people's tools — a signal nobody owns this query.",
  },
  {
    id: SERP(8),
    opportunityId: OPP(1),
    position: 8,
    domain: "example-jobs-board.com",
    url: null,
    title: "Freelance rates by skill",
    domainAuthority: null,
    pageType: "OTHER",
    isLowAuthority: null,
    isNewSite: null,
    assessment: "UNCLASSIFIED",
    notes: "Not reviewed yet — authority unknown.",
  },
  // vat calculator italy — weak, but only partially reviewed.
  {
    id: SERP(9),
    opportunityId: OPP(3),
    position: 1,
    domain: "example-fisco-blog.it",
    url: "https://example-fisco-blog.it/come-calcolare-iva",
    title: "Come calcolare l'IVA",
    domainAuthority: 29,
    pageType: "ARTICLE",
    isLowAuthority: true,
    isNewSite: false,
    assessment: "POOR_INTENT_MATCH",
    notes: "Explains the formula but makes the visitor do the arithmetic.",
  },
  {
    id: SERP(10),
    opportunityId: OPP(3),
    position: 2,
    domain: "example-calcolatori.it",
    url: "https://example-calcolatori.it/iva",
    title: "Calcolo IVA online",
    domainAuthority: 18,
    pageType: "UTILITY",
    isLowAuthority: true,
    isNewSite: false,
    assessment: "WEAK_COMPETITOR",
    notes: "Works, but the page is heavy with ads above the tool.",
  },
  {
    id: SERP(11),
    opportunityId: OPP(3),
    position: 3,
    domain: "example-partitaiva.it",
    url: "https://example-partitaiva.it/strumenti/iva",
    title: "Calcolatore IVA",
    domainAuthority: 44,
    pageType: "UTILITY",
    isLowAuthority: false,
    isNewSite: false,
    assessment: "UNCLASSIFIED",
    notes: null,
  },
  {
    id: SERP(12),
    opportunityId: OPP(3),
    position: 4,
    domain: "example-news-economia.it",
    url: null,
    title: "Aliquote IVA 2026",
    domainAuthority: null,
    pageType: "ARTICLE",
    isLowAuthority: null,
    isNewSite: null,
    assessment: "UNCLASSIFIED",
    notes: null,
  },
];

interface SeedCluster {
  id: string;
  name: string;
  description: string;
  domainCandidate: string;
  theme: string;
  opportunityIds: string[];
}

const CLUSTERS: SeedCluster[] = [
  {
    id: CLUSTER(1),
    name: "Freelance Calculators",
    description:
      "Money questions freelancers ask before they can send an invoice. High commercial intent and every tool links naturally to the next.",
    domainCandidate: "freelancemath.example",
    theme: "Freelance finance",
    opportunityIds: [OPP(1), OPP(7), OPP(8), OPP(9), OPP(10)],
  },
  {
    id: CLUSTER(2),
    name: "Sleep & Recovery Tools",
    description:
      "Built around the sleep cycle calculator, which is already ranking. Adjacent utilities should inherit some of its authority.",
    domainCandidate: "sleepmath.example",
    theme: "Health utilities",
    opportunityIds: [OPP(6)],
  },
];

interface SeedAsset {
  id: string;
  opportunityId: string;
  name: string;
  domain: string;
  url: string;
  publishedDaysAgo: number;
  indexedDaysAgo: number | null;
  assetDecision: Asset["assetDecision"];
  decisionNote: string | null;
  metrics: Array<{
    id: string;
    startDaysAgo: number;
    endDaysAgo: number;
    impressions: number | null;
    clicks: number | null;
    averagePosition: number | null;
    pageviews: number | null;
    revenue: number | null;
    notes: string | null;
  }>;
}

const ASSETS: SeedAsset[] = [
  {
    id: ASSET(1),
    opportunityId: OPP(6),
    name: "Sleep Cycle Calculator",
    domain: "sleepmath.example",
    url: "https://sleepmath.example/sleep-cycle-calculator",
    publishedDaysAgo: 168,
    indexedDaysAgo: 163,
    assetDecision: "SCALE",
    decisionNote: null,
    metrics: [
      {
        id: METRIC(1),
        startDaysAgo: 150,
        endDaysAgo: 120,
        impressions: 4200,
        clicks: 96,
        averagePosition: 18.4,
        pageviews: 130,
        revenue: 4.1,
        notes: "First full month after indexation.",
      },
      {
        id: METRIC(2),
        startDaysAgo: 120,
        endDaysAgo: 90,
        impressions: 18400,
        clicks: 640,
        averagePosition: 11.2,
        pageviews: 810,
        revenue: 24.6,
        notes: null,
      },
      {
        id: METRIC(3),
        startDaysAgo: 90,
        endDaysAgo: 60,
        impressions: 51200,
        clicks: 2380,
        averagePosition: 6.1,
        pageviews: 2900,
        revenue: 96.4,
        notes: "Picked up the long tail of bedtime variations.",
      },
      {
        id: METRIC(4),
        startDaysAgo: 60,
        endDaysAgo: 30,
        impressions: 88600,
        clicks: 5120,
        averagePosition: 3.8,
        pageviews: 6050,
        revenue: 214.8,
        notes: null,
      },
      {
        id: METRIC(5),
        startDaysAgo: 30,
        endDaysAgo: 0,
        impressions: 104300,
        clicks: 6890,
        averagePosition: 3.1,
        pageviews: 8020,
        revenue: 298.2,
        notes: "Still climbing. No new pages added around it yet.",
      },
    ],
  },
  {
    id: ASSET(2),
    opportunityId: OPP(2),
    name: "Dog Age Calculator",
    domain: "petmath.example",
    url: "https://petmath.example/dog-age-calculator",
    publishedDaysAgo: 74,
    indexedDaysAgo: 68,
    assetDecision: "WAIT",
    decisionNote: null,
    metrics: [
      {
        id: METRIC(6),
        startDaysAgo: 60,
        endDaysAgo: 30,
        impressions: 26400,
        clicks: 210,
        averagePosition: 14.6,
        pageviews: 260,
        revenue: 2.9,
        notes: null,
      },
      {
        id: METRIC(7),
        startDaysAgo: 30,
        endDaysAgo: 0,
        impressions: 61800,
        clicks: 402,
        averagePosition: 12.3,
        pageviews: 470,
        revenue: 5.4,
        notes:
          "Impressions nearly doubled but clicks barely moved — the snippet is not earning the click.",
      },
    ],
  },
  {
    id: ASSET(3),
    opportunityId: OPP(5),
    name: "Dragonborn Name Generator",
    domain: "namemath.example",
    url: "https://namemath.example/dragonborn-name-generator",
    publishedDaysAgo: 96,
    indexedDaysAgo: 90,
    assetDecision: "WAIT",
    decisionNote: null,
    metrics: [
      {
        id: METRIC(8),
        startDaysAgo: 60,
        endDaysAgo: 30,
        impressions: 0,
        clicks: 0,
        averagePosition: null,
        pageviews: 0,
        revenue: 0,
        notes: "Indexed but not being served for the target query.",
      },
      {
        id: METRIC(9),
        startDaysAgo: 30,
        endDaysAgo: 0,
        impressions: 0,
        clicks: 0,
        averagePosition: null,
        pageviews: 0,
        revenue: 0,
        notes: "Still nothing after three months.",
      },
    ],
  },
];

const iso = (now: Date, daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

/** Builds the full demo graph, with all dates relative to `now`. */
export function buildSeedGraph(now: Date = new Date()): SeedGraph {
  const opportunities: Opportunity[] = OPPORTUNITIES.map((seed) => {
    const base = {
      searchVolume: seed.searchVolume,
      keywordDifficulty: seed.keywordDifficulty,
      cpc: seed.cpc,
      serpWeaknessScore: seed.serpWeaknessScore,
      utilityFitScore: seed.utilityFitScore,
      monetizationScore: seed.monetizationScore,
      evergreenScore: seed.evergreenScore,
      buildSimplicityScore: seed.buildSimplicityScore,
      clusterPotentialScore: seed.clusterPotentialScore,
      demandScoreOverride: null,
      demandScoreOverrideReason: null,
    };
    const breakdown = scoreOpportunity(base, {
      weights: DEFAULT_SCORING_WEIGHTS,
      thresholds: DEFAULT_THRESHOLDS,
      demandCalibration: DEFAULT_DEMAND_CALIBRATION,
    });

    return {
      id: seed.id,
      userId: DEMO_USER_ID,
      keyword: seed.keyword,
      country: seed.country,
      language: seed.language,
      trend: seed.trend,
      utilityType: seed.utilityType,
      // The demo graph predates any provider, and inventing provenance for
      // fictional numbers would be exactly the fabrication this app forbids.
      competitionIndex: null,
      competitionLevel: null,
      metricsProvider: null,
      metricsFetchedAt: null,
      opportunityScore: breakdown.total,
      status: seed.status,
      source: "SEED",
      notes: seed.notes,
      isDemo: true,
      statusChangedAt: iso(now, seed.statusChangedDaysAgo),
      createdAt: iso(now, seed.createdDaysAgo),
      updatedAt: iso(now, Math.min(seed.statusChangedDaysAgo, seed.createdDaysAgo)),
      ...base,
    } satisfies Opportunity;
  });

  const serpResults: SerpResult[] = SERP_RESULTS.map((seed) => ({
    ...seed,
    source: "MANUAL",
    provider: null,
    fetchedAt: null,
    createdAt: iso(now, 5),
    updatedAt: iso(now, 5),
  }));

  const clusters: Cluster[] = CLUSTERS.map((seed) => ({
    id: seed.id,
    userId: DEMO_USER_ID,
    name: seed.name,
    description: seed.description,
    domainCandidate: seed.domainCandidate,
    theme: seed.theme,
    isDemo: true,
    createdAt: iso(now, 30),
    updatedAt: iso(now, 30),
  }));

  const clusterOpportunities = CLUSTERS.flatMap((cluster) =>
    cluster.opportunityIds.map((opportunityId) => ({
      clusterId: cluster.id,
      opportunityId,
    })),
  );

  const assetMetrics: AssetMetric[] = [];
  const assets: Asset[] = ASSETS.map((seed) => {
    const metrics = seed.metrics.map((metric) => {
      const ctr =
        metric.impressions && metric.impressions > 0 && metric.clicks !== null
          ? Number((metric.clicks / metric.impressions).toFixed(4))
          : metric.impressions === 0
            ? 0
            : null;
      const entry: AssetMetric = {
        id: metric.id,
        assetId: seed.id,
        periodStart: iso(now, metric.startDaysAgo),
        periodEnd: iso(now, metric.endDaysAgo),
        impressions: metric.impressions,
        clicks: metric.clicks,
        ctr,
        averagePosition: metric.averagePosition,
        pageviews: metric.pageviews,
        revenue: metric.revenue,
        source: "SEED",
        notes: metric.notes,
        createdAt: iso(now, metric.endDaysAgo),
      };
      assetMetrics.push(entry);
      return entry;
    });

    const latest = metrics[metrics.length - 1];

    return {
      id: seed.id,
      userId: DEMO_USER_ID,
      opportunityId: seed.opportunityId,
      name: seed.name,
      domain: seed.domain,
      url: seed.url,
      publishedAt: iso(now, seed.publishedDaysAgo),
      indexedAt: seed.indexedDaysAgo === null ? null : iso(now, seed.indexedDaysAgo),
      impressions: latest?.impressions ?? null,
      clicks: latest?.clicks ?? null,
      ctr: latest?.ctr ?? null,
      averagePosition: latest?.averagePosition ?? null,
      pageviews: latest?.pageviews ?? null,
      revenue: latest?.revenue ?? null,
      measurementPeriod: "Last 30 days",
      assetDecision: seed.assetDecision,
      decisionNote: seed.decisionNote,
      isDemo: true,
      lastUpdatedAt: iso(now, 0),
      createdAt: iso(now, seed.publishedDaysAgo),
    } satisfies Asset;
  });

  return {
    opportunities,
    serpResults,
    clusters,
    clusterOpportunities,
    assets,
    assetMetrics,
  };
}
