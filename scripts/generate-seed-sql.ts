/**
 * Generates `supabase/seed.sql` from the canonical TypeScript demo seed.
 *
 * The TypeScript seed is the single source of truth (it is also what the
 * in-memory demo store uses), so the SQL cannot drift from it. Dates are emitted
 * as `now() - interval '<n> days'` so the demo checkpoints stay meaningful
 * whenever the seed is applied.
 *
 * Run with: npm run seed:sql
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildSeedGraph } from "../src/lib/data/seed";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const graph = buildSeedGraph(NOW);

/** Converts an absolute seed timestamp back into a relative SQL interval. */
function ts(iso: string | null): string {
  if (!iso) return "null";
  const days = Math.round((NOW.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "now()";
  return `now() - interval '${days} days'`;
}

function str(value: string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function n(value: number | null | undefined): string {
  return value === null || value === undefined ? "null" : String(value);
}

function b(value: boolean | null | undefined): string {
  return value === null || value === undefined ? "null" : value ? "true" : "false";
}

const lines: string[] = [];

lines.push(`-- Utility Factory — DEMO seed data.
--
-- GENERATED FILE — do not edit by hand.
-- Source: src/lib/data/seed.ts  ·  Regenerate with: npm run seed:sql
--
-- Every row inserted here is fictional and flagged is_demo = true. The metrics
-- are invented for demonstration and must never be read as real search,
-- ranking, or revenue data.
--
-- Usage: sign up first, then run this file (Supabase SQL editor, psql, or
-- \`supabase db reset\`). It attaches the demo rows to the single existing user
-- and fails loudly if there isn't one.
--
-- To remove the demo data later:
--   delete from public.opportunities where is_demo;
--   delete from public.clusters where is_demo;
--   delete from public.assets where is_demo;

begin;

do $$
declare
  operator_id uuid;
begin
  -- Attaches the demo data to the only user in the project, which is the
  -- expected case for a single-operator install.
  select id into operator_id from public.users order by created_at limit 1;

  if operator_id is null then
    raise exception 'No user found in public.users. Sign up first, then re-run this seed.';
  end if;
`);

lines.push(`  insert into public.opportunities (
    id, user_id, keyword, country, language, search_volume, keyword_difficulty,
    cpc, trend, utility_type, serp_weakness_score, utility_fit_score,
    monetization_score, evergreen_score, build_simplicity_score,
    cluster_potential_score, demand_score_override, demand_score_override_reason,
    opportunity_score, status, source, notes, is_demo, status_changed_at,
    created_at, updated_at
  ) values`);

lines.push(
  graph.opportunities
    .map(
      (o) =>
        `    (${str(o.id)}, operator_id, ${str(o.keyword)}, ${str(o.country)}, ${str(o.language)}, ${n(o.searchVolume)}, ${n(o.keywordDifficulty)}, ${n(o.cpc)}, ${str(o.trend)}, ${str(o.utilityType)}, ${n(o.serpWeaknessScore)}, ${n(o.utilityFitScore)}, ${n(o.monetizationScore)}, ${n(o.evergreenScore)}, ${n(o.buildSimplicityScore)}, ${n(o.clusterPotentialScore)}, ${n(o.demandScoreOverride)}, ${str(o.demandScoreOverrideReason)}, ${n(o.opportunityScore)}, ${str(o.status)}, 'SEED', ${str(o.notes)}, true, ${ts(o.statusChangedAt)}, ${ts(o.createdAt)}, ${ts(o.updatedAt)})`,
    )
    .join(",\n") + "\n  on conflict (id) do nothing;\n",
);

lines.push(`  insert into public.serp_results (
    id, opportunity_id, position, domain, url, title, domain_authority,
    page_type, is_low_authority, is_new_site, assessment, notes,
    created_at, updated_at
  ) values`);

lines.push(
  graph.serpResults
    .map(
      (s) =>
        `    (${str(s.id)}, ${str(s.opportunityId)}, ${s.position}, ${str(s.domain)}, ${str(s.url)}, ${str(s.title)}, ${n(s.domainAuthority)}, ${str(s.pageType)}, ${b(s.isLowAuthority)}, ${b(s.isNewSite)}, ${str(s.assessment)}, ${str(s.notes)}, ${ts(s.createdAt)}, ${ts(s.updatedAt)})`,
    )
    .join(",\n") + "\n  on conflict (id) do nothing;\n",
);

lines.push(`  insert into public.clusters (
    id, user_id, name, description, domain_candidate, theme, is_demo,
    created_at, updated_at
  ) values`);

lines.push(
  graph.clusters
    .map(
      (c) =>
        `    (${str(c.id)}, operator_id, ${str(c.name)}, ${str(c.description)}, ${str(c.domainCandidate)}, ${str(c.theme)}, true, ${ts(c.createdAt)}, ${ts(c.updatedAt)})`,
    )
    .join(",\n") + "\n  on conflict (id) do nothing;\n",
);

lines.push(`  insert into public.cluster_opportunities (cluster_id, opportunity_id) values`);
lines.push(
  graph.clusterOpportunities
    .map((c) => `    (${str(c.clusterId)}, ${str(c.opportunityId)})`)
    .join(",\n") + "\n  on conflict do nothing;\n",
);

lines.push(`  insert into public.assets (
    id, user_id, opportunity_id, name, domain, url, published_at, indexed_at,
    impressions, clicks, ctr, average_position, pageviews, revenue,
    measurement_period, asset_decision, decision_note, is_demo,
    last_updated_at, created_at
  ) values`);

lines.push(
  graph.assets
    .map(
      (a) =>
        `    (${str(a.id)}, operator_id, ${str(a.opportunityId)}, ${str(a.name)}, ${str(a.domain)}, ${str(a.url)}, ${ts(a.publishedAt)}, ${ts(a.indexedAt)}, ${n(a.impressions)}, ${n(a.clicks)}, ${n(a.ctr)}, ${n(a.averagePosition)}, ${n(a.pageviews)}, ${n(a.revenue)}, ${str(a.measurementPeriod)}, ${str(a.assetDecision)}, ${str(a.decisionNote)}, true, now(), ${ts(a.createdAt)})`,
    )
    .join(",\n") + "\n  on conflict (id) do nothing;\n",
);

lines.push(`  insert into public.asset_metrics (
    id, asset_id, period_start, period_end, impressions, clicks, ctr,
    average_position, pageviews, revenue, source, notes, created_at
  ) values`);

lines.push(
  graph.assetMetrics
    .map(
      (m) =>
        `    (${str(m.id)}, ${str(m.assetId)}, ${ts(m.periodStart)}, ${ts(m.periodEnd)}, ${n(m.impressions)}, ${n(m.clicks)}, ${n(m.ctr)}, ${n(m.averagePosition)}, ${n(m.pageviews)}, ${n(m.revenue)}, 'SEED', ${str(m.notes)}, ${ts(m.createdAt)})`,
    )
    .join(",\n") + "\n  on conflict (id) do nothing;\n",
);

lines.push(`  insert into public.status_history (opportunity_id, from_status, to_status, note, created_at) values`);
lines.push(
  graph.opportunities
    .map(
      (o) =>
        `    (${str(o.id)}, null, ${str(o.status)}, 'Seeded demo record.', ${ts(o.statusChangedAt)})`,
    )
    .join(",\n") + ";\n",
);

lines.push(`  insert into public.activity_log (user_id, entity_type, entity_id, type, summary, created_at) values`);
lines.push(
  graph.opportunities
    .map(
      (o) =>
        `    (operator_id, 'OPPORTUNITY', ${str(o.id)}, 'OPPORTUNITY_CREATED', ${str(`Demo opportunity "${o.keyword}" seeded.`)}, ${ts(o.createdAt)})`,
    )
    .join(",\n") + ";\n",
);

lines.push(`end $$;

commit;
`);

const target = resolve(process.cwd(), "supabase/seed.sql");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, lines.join("\n"), "utf8");

console.log(
  `Wrote ${target}: ${graph.opportunities.length} opportunities, ${graph.serpResults.length} SERP results, ${graph.clusters.length} clusters, ${graph.assets.length} assets, ${graph.assetMetrics.length} metric entries.`,
);
