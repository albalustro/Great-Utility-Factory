-- Row Level Security for a private, single-operator application.
--
-- The rule is simple and uniform: a row is visible only to the user who owns it.
-- Child tables (SERP results, analyses, build packs, metrics, history) have no
-- user_id of their own — they inherit ownership from their parent, checked with
-- an EXISTS against the parent table. That keeps ownership in exactly one place
-- and makes a mis-parented row unreachable rather than leaked.

alter table public.users enable row level security;
alter table public.settings enable row level security;
alter table public.opportunities enable row level security;
alter table public.serp_results enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.build_packs enable row level security;
alter table public.clusters enable row level security;
alter table public.cluster_opportunities enable row level security;
alter table public.assets enable row level security;
alter table public.asset_metrics enable row level security;
alter table public.status_history enable row level security;
alter table public.activity_log enable row level security;

-- --- users -----------------------------------------------------------------

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- --- settings --------------------------------------------------------------

drop policy if exists settings_all_own on public.settings;
create policy settings_all_own on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- opportunities ---------------------------------------------------------

drop policy if exists opportunities_all_own on public.opportunities;
create policy opportunities_all_own on public.opportunities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- clusters --------------------------------------------------------------

drop policy if exists clusters_all_own on public.clusters;
create policy clusters_all_own on public.clusters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- assets ----------------------------------------------------------------

drop policy if exists assets_all_own on public.assets;
create policy assets_all_own on public.assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- activity --------------------------------------------------------------

drop policy if exists activity_log_all_own on public.activity_log;
create policy activity_log_all_own on public.activity_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- child tables: ownership inherited from the parent ---------------------

create or replace function public.owns_opportunity(target uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.opportunities o
    where o.id = target and o.user_id = auth.uid()
  );
$$;

create or replace function public.owns_asset(target uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.assets a
    where a.id = target and a.user_id = auth.uid()
  );
$$;

create or replace function public.owns_cluster(target uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.clusters c
    where c.id = target and c.user_id = auth.uid()
  );
$$;

drop policy if exists serp_results_all_own on public.serp_results;
create policy serp_results_all_own on public.serp_results
  for all using (public.owns_opportunity(opportunity_id))
  with check (public.owns_opportunity(opportunity_id));

drop policy if exists ai_analyses_all_own on public.ai_analyses;
create policy ai_analyses_all_own on public.ai_analyses
  for all using (public.owns_opportunity(opportunity_id))
  with check (public.owns_opportunity(opportunity_id));

drop policy if exists build_packs_all_own on public.build_packs;
create policy build_packs_all_own on public.build_packs
  for all using (public.owns_opportunity(opportunity_id))
  with check (public.owns_opportunity(opportunity_id));

drop policy if exists status_history_all_own on public.status_history;
create policy status_history_all_own on public.status_history
  for all using (public.owns_opportunity(opportunity_id))
  with check (public.owns_opportunity(opportunity_id));

drop policy if exists asset_metrics_all_own on public.asset_metrics;
create policy asset_metrics_all_own on public.asset_metrics
  for all using (public.owns_asset(asset_id))
  with check (public.owns_asset(asset_id));

-- Both sides must belong to the caller, or a link could be used to probe for
-- the existence of another user's opportunity.
drop policy if exists cluster_opportunities_all_own on public.cluster_opportunities;
create policy cluster_opportunities_all_own on public.cluster_opportunities
  for all using (
    public.owns_cluster(cluster_id) and public.owns_opportunity(opportunity_id)
  )
  with check (
    public.owns_cluster(cluster_id) and public.owns_opportunity(opportunity_id)
  );
