-- Utility Factory — core schema.
--
-- Design notes:
--  * Every external metric column is nullable on purpose. NULL means "we do not
--    know". Nothing in this schema defaults an unknown metric to zero.
--  * Enumerated values use CHECK constraints rather than Postgres enums so that
--    adding a status later is a plain migration rather than a type rewrite.
--  * Every table is owned by exactly one user; RLS is applied in the next
--    migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

comment on table public.users is
  'Application-side mirror of auth.users. Utility Factory is single-operator; this exists so foreign keys and RLS have a stable local anchor.';

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------

create table if not exists public.settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  weights jsonb not null default '{
    "demand": 20, "serpWeakness": 25, "utilityFit": 20, "monetization": 10,
    "evergreen": 10, "buildSimplicity": 10, "clusterPotential": 5
  }'::jsonb,
  thresholds jsonb not null default '{"build": 85, "investigate": 70, "watch": 50}'::jsonb,
  demand_calibration jsonb not null default '{"floor": 100, "ceiling": 50000}'::jsonb,
  providers jsonb not null default '{
    "keyword": "manual", "serp": "manual", "ai": "manual", "searchAnalytics": "manual"
  }'::jsonb,
  default_country text not null default 'US',
  default_language text not null default 'en',
  currency text not null default 'USD',
  updated_at timestamptz not null default now(),
  constraint settings_weights_total_100 check (
    round((
      coalesce((weights->>'demand')::numeric, 0) +
      coalesce((weights->>'serpWeakness')::numeric, 0) +
      coalesce((weights->>'utilityFit')::numeric, 0) +
      coalesce((weights->>'monetization')::numeric, 0) +
      coalesce((weights->>'evergreen')::numeric, 0) +
      coalesce((weights->>'buildSimplicity')::numeric, 0) +
      coalesce((weights->>'clusterPotential')::numeric, 0)
    )) = 100
  )
);

comment on constraint settings_weights_total_100 on public.settings is
  'Scoring weights must total exactly 100 so the opportunity score stays on a 0-100 scale.';

-- ---------------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------------

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  keyword text not null check (length(trim(keyword)) > 0),
  country text not null default 'US',
  language text not null default 'en',

  -- External metrics. NULL = unknown. Never fabricate a value here.
  search_volume integer check (search_volume is null or search_volume >= 0),
  keyword_difficulty numeric(5, 2) check (
    keyword_difficulty is null or (keyword_difficulty >= 0 and keyword_difficulty <= 100)
  ),
  cpc numeric(10, 2) check (cpc is null or cpc >= 0),
  trend text not null default 'UNKNOWN'
    check (trend in ('RISING', 'STABLE', 'DECLINING', 'SEASONAL', 'UNKNOWN')),

  utility_type text check (
    utility_type is null or utility_type in (
      'CALCULATOR', 'GENERATOR', 'CONVERTER', 'CHECKER', 'LOOKUP',
      'FORMATTER', 'ANALYZER', 'TEMPLATE', 'OTHER'
    )
  ),

  -- Operator judgement sub-scores, 0-100. NULL = not assessed.
  serp_weakness_score numeric(5, 2) check (serp_weakness_score is null or serp_weakness_score between 0 and 100),
  utility_fit_score numeric(5, 2) check (utility_fit_score is null or utility_fit_score between 0 and 100),
  monetization_score numeric(5, 2) check (monetization_score is null or monetization_score between 0 and 100),
  evergreen_score numeric(5, 2) check (evergreen_score is null or evergreen_score between 0 and 100),
  build_simplicity_score numeric(5, 2) check (build_simplicity_score is null or build_simplicity_score between 0 and 100),
  cluster_potential_score numeric(5, 2) check (cluster_potential_score is null or cluster_potential_score between 0 and 100),

  demand_score_override numeric(5, 2) check (
    demand_score_override is null or demand_score_override between 0 and 100
  ),
  demand_score_override_reason text,

  opportunity_score numeric(5, 2) not null default 0
    check (opportunity_score between 0 and 100),

  status text not null default 'INBOX' check (status in (
    'INBOX', 'RESEARCH', 'QUALIFIED', 'READY_TO_BUILD', 'BUILDING',
    'PUBLISHED', 'MEASURING', 'WINNER', 'KILLED'
  )),
  source text not null default 'MANUAL'
    check (source in ('MANUAL', 'CSV_IMPORT', 'KEYWORD_PROVIDER', 'SEED')),
  notes text,
  is_demo boolean not null default false,

  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An override without a reason is an unexplained number; reject it.
  constraint opportunities_override_requires_reason check (
    demand_score_override is null
    or (demand_score_override_reason is not null and length(trim(demand_score_override_reason)) > 0)
  )
);

create index if not exists opportunities_user_status_idx
  on public.opportunities (user_id, status);
create index if not exists opportunities_user_score_idx
  on public.opportunities (user_id, opportunity_score desc);
create index if not exists opportunities_user_created_idx
  on public.opportunities (user_id, created_at desc);
create index if not exists opportunities_keyword_trgm_idx
  on public.opportunities (user_id, lower(keyword));

-- ---------------------------------------------------------------------------
-- serp_results
-- ---------------------------------------------------------------------------

create table if not exists public.serp_results (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  position integer not null check (position between 1 and 100),
  domain text not null check (length(trim(domain)) > 0),
  url text,
  title text,
  domain_authority numeric(5, 2) check (
    domain_authority is null or domain_authority between 0 and 100
  ),
  page_type text not null default 'OTHER' check (
    page_type in ('UTILITY', 'ARTICLE', 'DIRECTORY', 'FORUM', 'ECOMMERCE', 'OTHER')
  ),
  -- Tri-state on purpose: NULL means unknown, which is not the same as false.
  is_low_authority boolean,
  is_new_site boolean,
  assessment text not null default 'UNCLASSIFIED' check (
    assessment in ('UNCLASSIFIED', 'POOR_INTENT_MATCH', 'WEAK_COMPETITOR', 'STRONG_COMPETITOR')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists serp_results_opportunity_idx
  on public.serp_results (opportunity_id, position);

-- ---------------------------------------------------------------------------
-- ai_analyses
-- ---------------------------------------------------------------------------

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  provider text not null,
  model text,
  content jsonb not null,
  -- The exact objective payload the model was given, kept for auditability.
  input_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_analyses_opportunity_idx
  on public.ai_analyses (opportunity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- build_packs
-- ---------------------------------------------------------------------------

create table if not exists public.build_packs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  content jsonb not null,
  claude_code_prompt text not null,
  used_ai_analysis boolean not null default false,
  created_at timestamptz not null default now(),
  unique (opportunity_id, version)
);

create index if not exists build_packs_opportunity_idx
  on public.build_packs (opportunity_id, version desc);

-- ---------------------------------------------------------------------------
-- clusters
-- ---------------------------------------------------------------------------

create table if not exists public.clusters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  domain_candidate text,
  theme text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.cluster_opportunities (
  cluster_id uuid not null references public.clusters (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cluster_id, opportunity_id)
);

create index if not exists cluster_opportunities_opportunity_idx
  on public.cluster_opportunities (opportunity_id);

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  domain text,
  url text,
  published_at timestamptz,
  indexed_at timestamptz,

  -- Latest known window. All nullable — unknown stays unknown.
  impressions integer check (impressions is null or impressions >= 0),
  clicks integer check (clicks is null or clicks >= 0),
  ctr numeric(6, 4) check (ctr is null or (ctr >= 0 and ctr <= 1)),
  average_position numeric(6, 2) check (average_position is null or average_position >= 0),
  pageviews integer check (pageviews is null or pageviews >= 0),
  revenue numeric(12, 2) check (revenue is null or revenue >= 0),
  measurement_period text,

  asset_decision text not null default 'WAIT'
    check (asset_decision in ('WAIT', 'OPTIMIZE', 'SCALE', 'KILL')),
  decision_note text,
  is_demo boolean not null default false,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists assets_user_idx on public.assets (user_id, published_at desc);
create index if not exists assets_opportunity_idx on public.assets (opportunity_id);

create table if not exists public.asset_metrics (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  impressions integer check (impressions is null or impressions >= 0),
  clicks integer check (clicks is null or clicks >= 0),
  ctr numeric(6, 4) check (ctr is null or (ctr >= 0 and ctr <= 1)),
  average_position numeric(6, 2) check (average_position is null or average_position >= 0),
  pageviews integer check (pageviews is null or pageviews >= 0),
  revenue numeric(12, 2) check (revenue is null or revenue >= 0),
  source text not null default 'MANUAL' check (source in ('MANUAL', 'PROVIDER', 'SEED')),
  notes text,
  created_at timestamptz not null default now(),
  constraint asset_metrics_period_order check (period_end >= period_start)
);

create index if not exists asset_metrics_asset_idx
  on public.asset_metrics (asset_id, period_end);

-- ---------------------------------------------------------------------------
-- history
-- ---------------------------------------------------------------------------

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  from_status text check (from_status is null or from_status in (
    'INBOX', 'RESEARCH', 'QUALIFIED', 'READY_TO_BUILD', 'BUILDING',
    'PUBLISHED', 'MEASURING', 'WINNER', 'KILLED'
  )),
  to_status text not null check (to_status in (
    'INBOX', 'RESEARCH', 'QUALIFIED', 'READY_TO_BUILD', 'BUILDING',
    'PUBLISHED', 'MEASURING', 'WINNER', 'KILLED'
  )),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists status_history_opportunity_idx
  on public.status_history (opportunity_id, created_at desc);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('OPPORTUNITY', 'ASSET', 'CLUSTER', 'SETTINGS')),
  entity_id uuid not null,
  type text not null check (type in (
    'OPPORTUNITY_CREATED', 'OPPORTUNITY_UPDATED', 'METRICS_CHANGED',
    'SCORE_RECALCULATED', 'STATUS_CHANGED', 'SERP_UPDATED',
    'AI_ANALYSIS_GENERATED', 'BUILD_PACK_GENERATED', 'ASSET_PUBLISHED',
    'ASSET_METRICS_UPDATED', 'DECISION_CHANGED', 'CLUSTER_UPDATED',
    'OPPORTUNITY_DELETED'
  )),
  summary text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_entity_idx
  on public.activity_log (user_id, entity_type, entity_id, created_at desc);
create index if not exists activity_log_user_idx
  on public.activity_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists opportunities_touch_updated_at on public.opportunities;
create trigger opportunities_touch_updated_at
  before update on public.opportunities
  for each row execute function public.touch_updated_at();

drop trigger if exists serp_results_touch_updated_at on public.serp_results;
create trigger serp_results_touch_updated_at
  before update on public.serp_results
  for each row execute function public.touch_updated_at();

drop trigger if exists clusters_touch_updated_at on public.clusters;
create trigger clusters_touch_updated_at
  before update on public.clusters
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- New-user bootstrap: mirror the auth user and give them default settings.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
