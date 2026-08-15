-- Utility Factory — DEMO seed data.
--
-- GENERATED FILE — do not edit by hand.
-- Source: src/lib/data/seed.ts  ·  Regenerate with: npm run seed:sql
--
-- Every row inserted here is fictional and flagged is_demo = true. The metrics
-- are invented for demonstration and must never be read as real search,
-- ranking, or revenue data.
--
-- Usage: sign up first, then run this file (Supabase SQL editor, psql, or
-- `supabase db reset`). It attaches the demo rows to the single existing user
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

  insert into public.opportunities (
    id, user_id, keyword, country, language, search_volume, keyword_difficulty,
    cpc, trend, utility_type, serp_weakness_score, utility_fit_score,
    monetization_score, evergreen_score, build_simplicity_score,
    cluster_potential_score, demand_score_override, demand_score_override_reason,
    opportunity_score, status, source, notes, is_demo, status_changed_at,
    created_at, updated_at
  ) values
    ('00000001-0000-4000-8000-000000000001', operator_id, 'freelance hourly rate calculator', 'US', 'en', 8100, 24, 3.4, 'RISING', 'CALCULATOR', 82, 95, 78, 90, 88, 95, null, null, 84, 'READY_TO_BUILD', 'SEED', 'Top of the freelance calculator cluster. SERP is dominated by blog posts that bury the answer under 1,200 words of preamble.', true, now() - interval '6 days', now() - interval '34 days', now() - interval '6 days'),
    ('00000001-0000-4000-8000-000000000002', operator_id, 'dog age calculator', 'US', 'en', 74000, 41, 0.42, 'STABLE', 'CALCULATOR', 38, 92, 30, 95, 90, 70, null, null, 73, 'MEASURING', 'SEED', 'Huge demand but established veterinary brands hold the top four positions. Published anyway to test whether a faster tool can win position 5-10 traffic.', true, now() - interval '74 days', now() - interval '120 days', now() - interval '74 days'),
    ('00000001-0000-4000-8000-000000000003', operator_id, 'vat calculator italy', 'IT', 'it', 5400, 18, 1.15, 'STABLE', 'CALCULATOR', 74, 88, 55, 92, 85, 80, null, null, 76, 'RESEARCH', 'SEED', 'Strong demand against a weak SERP. Needs the current IVA rates confirmed against an authoritative source before anything is built.', true, now() - interval '9 days', now() - interval '12 days', now() - interval '9 days'),
    ('00000001-0000-4000-8000-000000000004', operator_id, 'random phone number generator', 'US', 'en', 12100, 29, 0.18, 'STABLE', 'GENERATOR', 61, 90, 22, 80, 95, 60, null, null, 71, 'QUALIFIED', 'SEED', 'Trivial to build and clearly tool intent, but the traffic is close to worthless commercially. Only worth doing as cluster filler.', true, now() - interval '14 days', now() - interval '21 days', now() - interval '14 days'),
    ('00000001-0000-4000-8000-000000000005', operator_id, 'dragonborn name generator', 'US', 'en', 9900, 22, 0.09, 'DECLINING', 'GENERATOR', 45, 85, 12, 45, 92, 40, null, null, 60, 'MEASURING', 'SEED', 'Built early as a speed test. Fandom-style sites own this space and the commercial value was always going to be near zero.', true, now() - interval '96 days', now() - interval '140 days', now() - interval '96 days'),
    ('00000001-0000-4000-8000-000000000006', operator_id, 'sleep cycle calculator', 'US', 'en', 40500, 33, 1.9, 'RISING', 'CALCULATOR', 68, 94, 72, 88, 86, 85, null, null, 84, 'WINNER', 'SEED', 'The clearest win in the portfolio so far. Ranks for a long tail of bedtime and wake-time variations with no extra pages.', true, now() - interval '38 days', now() - interval '210 days', now() - interval '38 days'),
    ('00000001-0000-4000-8000-000000000007', operator_id, 'contractor vs employee calculator', 'US', 'en', 2900, 31, 5.6, 'RISING', 'CALCULATOR', 70, 82, 88, 85, 62, 88, null, null, 73, 'QUALIFIED', 'SEED', 'Highest CPC in the freelance cluster. The logic is genuinely harder — payroll tax handling varies by state.', true, now() - interval '11 days', now() - interval '26 days', now() - interval '11 days'),
    ('00000001-0000-4000-8000-000000000008', operator_id, 'freelance tax calculator', 'US', 'en', 18100, 47, 6.2, 'RISING', 'CALCULATOR', null, 80, 92, 88, null, 90, null, null, 55, 'RESEARCH', 'SEED', 'Commercially the strongest keyword in the cluster, but the SERP has not been captured yet and the build complexity is unknown.', true, now() - interval '5 days', now() - interval '8 days', now() - interval '5 days'),
    ('00000001-0000-4000-8000-000000000009', operator_id, 'day rate calculator', 'GB', 'en', 3600, null, null, 'UNKNOWN', 'CALCULATOR', null, 90, null, 85, 90, 82, null, null, 51, 'INBOX', 'SEED', 'Imported from a keyword export. Difficulty and CPC were not in the source file, so they stay unknown.', true, now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'),
    ('00000001-0000-4000-8000-000000000010', operator_id, 'project rate calculator', 'US', 'en', 1300, null, null, 'UNKNOWN', 'CALCULATOR', null, 85, null, 80, 85, 78, null, null, 46, 'INBOX', 'SEED', 'Imported from a keyword export. Not yet researched.', true, now() - interval '3 days', now() - interval '3 days', now() - interval '3 days')
  on conflict (id) do nothing;

  insert into public.serp_results (
    id, opportunity_id, position, domain, url, title, domain_authority,
    page_type, is_low_authority, is_new_site, assessment, notes,
    created_at, updated_at
  ) values
    ('00000002-0000-4000-8000-000000000001', '00000001-0000-4000-8000-000000000001', 1, 'example-invoicing-blog.com', 'https://example-invoicing-blog.com/how-to-set-your-freelance-rate', 'How To Set Your Freelance Rate (2026 Guide)', 54, 'ARTICLE', false, false, 'POOR_INTENT_MATCH', '2,400-word guide. The calculator is a spreadsheet download at the bottom.', now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000002', '00000001-0000-4000-8000-000000000001', 2, 'example-freelance-tips.net', 'https://example-freelance-tips.net/rate-calculator', 'Freelance Rate Calculator', 21, 'UTILITY', true, false, 'WEAK_COMPETITOR', 'A real tool, but three required fields and no explanation of the maths.', now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000003', '00000001-0000-4000-8000-000000000001', 3, 'example-community-forum.org', 'https://example-community-forum.org/t/what-should-i-charge', 'What should I charge as a freelancer?', 62, 'FORUM', false, false, 'POOR_INTENT_MATCH', 'Thread from 2019. Answers contradict each other.', now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000004', '00000001-0000-4000-8000-000000000001', 4, 'example-accounting-saas.com', 'https://example-accounting-saas.com/tools/rate', 'Hourly Rate Calculator for Freelancers', 71, 'UTILITY', false, false, 'STRONG_COMPETITOR', 'Good tool behind an email gate after the first result.', now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000005', '00000001-0000-4000-8000-000000000001', 5, 'example-newcalc.io', 'https://example-newcalc.io/freelance-hourly-rate', 'Freelance Hourly Rate Calculator - Free', 8, 'UTILITY', true, true, 'WEAK_COMPETITOR', 'Registered this year and already at #5, which says the SERP is not settled.', now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000006', '00000001-0000-4000-8000-000000000001', 6, 'example-career-magazine.com', 'https://example-career-magazine.com/freelance-pricing', 'Freelance Pricing: The Complete Guide', 68, 'ARTICLE', false, false, 'POOR_INTENT_MATCH', null, now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000007', '00000001-0000-4000-8000-000000000001', 7, 'example-directory.co', 'https://example-directory.co/tools/freelance-calculators', '12 Best Freelance Rate Calculators', 33, 'DIRECTORY', true, false, 'POOR_INTENT_MATCH', 'Listicle of other people''s tools — a signal nobody owns this query.', now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000008', '00000001-0000-4000-8000-000000000001', 8, 'example-jobs-board.com', null, 'Freelance rates by skill', null, 'OTHER', null, null, 'UNCLASSIFIED', 'Not reviewed yet — authority unknown.', now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000009', '00000001-0000-4000-8000-000000000003', 1, 'example-fisco-blog.it', 'https://example-fisco-blog.it/come-calcolare-iva', 'Come calcolare l''IVA', 29, 'ARTICLE', true, false, 'POOR_INTENT_MATCH', 'Explains the formula but makes the visitor do the arithmetic.', now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000010', '00000001-0000-4000-8000-000000000003', 2, 'example-calcolatori.it', 'https://example-calcolatori.it/iva', 'Calcolo IVA online', 18, 'UTILITY', true, false, 'WEAK_COMPETITOR', 'Works, but the page is heavy with ads above the tool.', now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000011', '00000001-0000-4000-8000-000000000003', 3, 'example-partitaiva.it', 'https://example-partitaiva.it/strumenti/iva', 'Calcolatore IVA', 44, 'UTILITY', false, false, 'UNCLASSIFIED', null, now() - interval '5 days', now() - interval '5 days'),
    ('00000002-0000-4000-8000-000000000012', '00000001-0000-4000-8000-000000000003', 4, 'example-news-economia.it', null, 'Aliquote IVA 2026', null, 'ARTICLE', null, null, 'UNCLASSIFIED', null, now() - interval '5 days', now() - interval '5 days')
  on conflict (id) do nothing;

  insert into public.clusters (
    id, user_id, name, description, domain_candidate, theme, is_demo,
    created_at, updated_at
  ) values
    ('00000003-0000-4000-8000-000000000001', operator_id, 'Freelance Calculators', 'Money questions freelancers ask before they can send an invoice. High commercial intent and every tool links naturally to the next.', 'freelancemath.example', 'Freelance finance', true, now() - interval '30 days', now() - interval '30 days'),
    ('00000003-0000-4000-8000-000000000002', operator_id, 'Sleep & Recovery Tools', 'Built around the sleep cycle calculator, which is already ranking. Adjacent utilities should inherit some of its authority.', 'sleepmath.example', 'Health utilities', true, now() - interval '30 days', now() - interval '30 days')
  on conflict (id) do nothing;

  insert into public.cluster_opportunities (cluster_id, opportunity_id) values
    ('00000003-0000-4000-8000-000000000001', '00000001-0000-4000-8000-000000000001'),
    ('00000003-0000-4000-8000-000000000001', '00000001-0000-4000-8000-000000000007'),
    ('00000003-0000-4000-8000-000000000001', '00000001-0000-4000-8000-000000000008'),
    ('00000003-0000-4000-8000-000000000001', '00000001-0000-4000-8000-000000000009'),
    ('00000003-0000-4000-8000-000000000001', '00000001-0000-4000-8000-000000000010'),
    ('00000003-0000-4000-8000-000000000002', '00000001-0000-4000-8000-000000000006')
  on conflict do nothing;

  insert into public.assets (
    id, user_id, opportunity_id, name, domain, url, published_at, indexed_at,
    impressions, clicks, ctr, average_position, pageviews, revenue,
    measurement_period, asset_decision, decision_note, is_demo,
    last_updated_at, created_at
  ) values
    ('00000004-0000-4000-8000-000000000001', operator_id, '00000001-0000-4000-8000-000000000006', 'Sleep Cycle Calculator', 'sleepmath.example', 'https://sleepmath.example/sleep-cycle-calculator', now() - interval '168 days', now() - interval '163 days', 104300, 6890, 0.0661, 3.1, 8020, 298.2, 'Last 30 days', 'SCALE', null, true, now(), now() - interval '168 days'),
    ('00000004-0000-4000-8000-000000000002', operator_id, '00000001-0000-4000-8000-000000000002', 'Dog Age Calculator', 'petmath.example', 'https://petmath.example/dog-age-calculator', now() - interval '74 days', now() - interval '68 days', 61800, 402, 0.0065, 12.3, 470, 5.4, 'Last 30 days', 'WAIT', null, true, now(), now() - interval '74 days'),
    ('00000004-0000-4000-8000-000000000003', operator_id, '00000001-0000-4000-8000-000000000005', 'Dragonborn Name Generator', 'namemath.example', 'https://namemath.example/dragonborn-name-generator', now() - interval '96 days', now() - interval '90 days', 0, 0, 0, null, 0, 0, 'Last 30 days', 'WAIT', null, true, now(), now() - interval '96 days')
  on conflict (id) do nothing;

  insert into public.asset_metrics (
    id, asset_id, period_start, period_end, impressions, clicks, ctr,
    average_position, pageviews, revenue, source, notes, created_at
  ) values
    ('00000005-0000-4000-8000-000000000001', '00000004-0000-4000-8000-000000000001', now() - interval '150 days', now() - interval '120 days', 4200, 96, 0.0229, 18.4, 130, 4.1, 'SEED', 'First full month after indexation.', now() - interval '120 days'),
    ('00000005-0000-4000-8000-000000000002', '00000004-0000-4000-8000-000000000001', now() - interval '120 days', now() - interval '90 days', 18400, 640, 0.0348, 11.2, 810, 24.6, 'SEED', null, now() - interval '90 days'),
    ('00000005-0000-4000-8000-000000000003', '00000004-0000-4000-8000-000000000001', now() - interval '90 days', now() - interval '60 days', 51200, 2380, 0.0465, 6.1, 2900, 96.4, 'SEED', 'Picked up the long tail of bedtime variations.', now() - interval '60 days'),
    ('00000005-0000-4000-8000-000000000004', '00000004-0000-4000-8000-000000000001', now() - interval '60 days', now() - interval '30 days', 88600, 5120, 0.0578, 3.8, 6050, 214.8, 'SEED', null, now() - interval '30 days'),
    ('00000005-0000-4000-8000-000000000005', '00000004-0000-4000-8000-000000000001', now() - interval '30 days', now(), 104300, 6890, 0.0661, 3.1, 8020, 298.2, 'SEED', 'Still climbing. No new pages added around it yet.', now()),
    ('00000005-0000-4000-8000-000000000006', '00000004-0000-4000-8000-000000000002', now() - interval '60 days', now() - interval '30 days', 26400, 210, 0.008, 14.6, 260, 2.9, 'SEED', null, now() - interval '30 days'),
    ('00000005-0000-4000-8000-000000000007', '00000004-0000-4000-8000-000000000002', now() - interval '30 days', now(), 61800, 402, 0.0065, 12.3, 470, 5.4, 'SEED', 'Impressions nearly doubled but clicks barely moved — the snippet is not earning the click.', now()),
    ('00000005-0000-4000-8000-000000000008', '00000004-0000-4000-8000-000000000003', now() - interval '60 days', now() - interval '30 days', 0, 0, 0, null, 0, 0, 'SEED', 'Indexed but not being served for the target query.', now() - interval '30 days'),
    ('00000005-0000-4000-8000-000000000009', '00000004-0000-4000-8000-000000000003', now() - interval '30 days', now(), 0, 0, 0, null, 0, 0, 'SEED', 'Still nothing after three months.', now())
  on conflict (id) do nothing;

  insert into public.status_history (opportunity_id, from_status, to_status, note, created_at) values
    ('00000001-0000-4000-8000-000000000001', null, 'READY_TO_BUILD', 'Seeded demo record.', now() - interval '6 days'),
    ('00000001-0000-4000-8000-000000000002', null, 'MEASURING', 'Seeded demo record.', now() - interval '74 days'),
    ('00000001-0000-4000-8000-000000000003', null, 'RESEARCH', 'Seeded demo record.', now() - interval '9 days'),
    ('00000001-0000-4000-8000-000000000004', null, 'QUALIFIED', 'Seeded demo record.', now() - interval '14 days'),
    ('00000001-0000-4000-8000-000000000005', null, 'MEASURING', 'Seeded demo record.', now() - interval '96 days'),
    ('00000001-0000-4000-8000-000000000006', null, 'WINNER', 'Seeded demo record.', now() - interval '38 days'),
    ('00000001-0000-4000-8000-000000000007', null, 'QUALIFIED', 'Seeded demo record.', now() - interval '11 days'),
    ('00000001-0000-4000-8000-000000000008', null, 'RESEARCH', 'Seeded demo record.', now() - interval '5 days'),
    ('00000001-0000-4000-8000-000000000009', null, 'INBOX', 'Seeded demo record.', now() - interval '3 days'),
    ('00000001-0000-4000-8000-000000000010', null, 'INBOX', 'Seeded demo record.', now() - interval '3 days');

  insert into public.activity_log (user_id, entity_type, entity_id, type, summary, created_at) values
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000001', 'OPPORTUNITY_CREATED', 'Demo opportunity "freelance hourly rate calculator" seeded.', now() - interval '34 days'),
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000002', 'OPPORTUNITY_CREATED', 'Demo opportunity "dog age calculator" seeded.', now() - interval '120 days'),
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000003', 'OPPORTUNITY_CREATED', 'Demo opportunity "vat calculator italy" seeded.', now() - interval '12 days'),
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000004', 'OPPORTUNITY_CREATED', 'Demo opportunity "random phone number generator" seeded.', now() - interval '21 days'),
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000005', 'OPPORTUNITY_CREATED', 'Demo opportunity "dragonborn name generator" seeded.', now() - interval '140 days'),
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000006', 'OPPORTUNITY_CREATED', 'Demo opportunity "sleep cycle calculator" seeded.', now() - interval '210 days'),
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000007', 'OPPORTUNITY_CREATED', 'Demo opportunity "contractor vs employee calculator" seeded.', now() - interval '26 days'),
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000008', 'OPPORTUNITY_CREATED', 'Demo opportunity "freelance tax calculator" seeded.', now() - interval '8 days'),
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000009', 'OPPORTUNITY_CREATED', 'Demo opportunity "day rate calculator" seeded.', now() - interval '3 days'),
    (operator_id, 'OPPORTUNITY', '00000001-0000-4000-8000-000000000010', 'OPPORTUNITY_CREATED', 'Demo opportunity "project rate calculator" seeded.', now() - interval '3 days');

end $$;

commit;
