-- Provider-sourced metrics and provenance.
--
-- Added when the first real external provider (DataForSEO) was wired in. Two
-- things drive this migration:
--
-- 1. Ad competition is not SEO difficulty. Google Ads `competition_index`
--    measures how contested a keyword is for *advertisers*. Writing it into
--    `keyword_difficulty` would silently relabel one metric as another, so it
--    gets its own columns and its own meaning in the UI.
-- 2. Evidence needs provenance. Once numbers can arrive from an API, a reader
--    has to be able to tell which provider supplied them and when, and which
--    SERP rows were fetched versus judged by hand.

alter table public.opportunities
  add column if not exists competition_index numeric(5, 2)
    check (competition_index is null or competition_index between 0 and 100),
  add column if not exists competition_level text
    check (competition_level is null or competition_level in ('LOW', 'MEDIUM', 'HIGH')),
  add column if not exists metrics_provider text,
  add column if not exists metrics_fetched_at timestamptz;

comment on column public.opportunities.competition_index is
  'Google Ads advertiser competition, 0-100. NOT SEO keyword difficulty — kept separate on purpose.';
comment on column public.opportunities.competition_level is
  'Google Ads competition bucket (LOW/MEDIUM/HIGH) as reported by the provider.';
comment on column public.opportunities.metrics_provider is
  'Provider id that last supplied search volume / CPC / competition. NULL means the metrics were entered by hand.';
comment on column public.opportunities.metrics_fetched_at is
  'When the provider metrics above were fetched.';

-- Distinguishes rows a provider returned from rows the operator typed in.
-- Provider rows deliberately leave is_low_authority / is_new_site NULL: no
-- provider we trust supplies those yet, so they stay a manual judgement.
alter table public.serp_results
  add column if not exists source text not null default 'MANUAL'
    check (source in ('MANUAL', 'PROVIDER')),
  add column if not exists provider text,
  add column if not exists fetched_at timestamptz;

comment on column public.serp_results.source is
  'MANUAL when the operator entered the row, PROVIDER when it came from a SERP provider.';
comment on column public.serp_results.provider is
  'Provider id that supplied this row, when source = PROVIDER.';

create index if not exists opportunities_metrics_fetched_idx
  on public.opportunities (user_id, metrics_fetched_at desc nulls last);
