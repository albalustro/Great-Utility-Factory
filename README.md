# Utility Factory

A private operating system for discovering, evaluating, building, publishing and
monitoring simple SEO-driven web utilities — calculators, generators, converters,
checkers.

It is a single-operator internal tool, not a SaaS. There is no billing, no teams,
no marketplace. The whole product exists to shorten the distance between
*"possible opportunity"* and *"evidence-backed utility ready to build"*.

```
Discover → Analyze → Score → Select → Build → Publish → Measure → Scale or Kill
```

> **This repository ships with no credentials of any kind.** Every deployment —
> including the one you are looking at right now — connects to your own Supabase
> project and your own DataForSEO account. See
> [Running your own instance](#running-your-own-instance) below.

---

## Running your own instance

Three accounts, none of them shared with anyone else's deployment:

| Account | Required? | What it gives you |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Yes, for real use | Your database and login. Free tier is enough to start. |
| [DataForSEO](https://app.dataforseo.com) | Optional | Real search volume, CPC and SERP data. Without it the app still runs — Research and "refresh from provider" just report themselves unconfigured. |
| [Anthropic](https://console.anthropic.com) | Optional | AI opportunity analysis. Without it, that tab shows a configuration state instead of an analysis. |

Nothing runs against demo/shared infrastructure. Skip every account above and the
app still works, seeded with clearly-labelled fictional data — that's
[local demo mode](#quick-start), meant for trying the interface before you commit
to setting anything up.

**To go from a fork to your own working copy:**

1. Fork or clone this repository.
2. Create your own Supabase project and apply the migrations — full walkthrough
   in [Supabase setup](#supabase-setup).
3. Copy `.env.example` to `.env.local` and fill in the values from your own
   accounts — see [Environment variables](#environment-variables) for exactly
   what each one does and where to find it. **Never commit `.env.local`** — it's
   already gitignored, and that's what keeps your keys off GitHub.
4. `npm install && npm run dev`, and open `/login` to create your operator
   account.
5. Deploying somewhere public (Vercel, or anywhere else)? The build reads
   environment variables the same way — set them in your host's dashboard, not
   in the repository. On Vercel specifically: environment variables are baked in
   at build time, so set them *before* the first deploy, or redeploy afterwards
   if you add them later.

If a step above assumes something your setup doesn't have, the app is built to
say so rather than guess: every provider reports its own configuration status,
and a production deploy without Supabase configured shows a persistent banner
rather than quietly running on borrowed time.

---

## The two rules everything else follows from

**1. Never fabricate a metric.** Search volume, difficulty, CPC, impressions,
clicks, positions, domain authority and revenue are all nullable everywhere —
in the database, in the types, in the UI. `null` means *we do not know*, and it
renders as an em dash with a "not recorded" tooltip, never as `0`. A filter for
"minimum volume 1,000" excludes unknown-volume rows rather than treating them as
zero; a scoring factor with no data contributes zero points and is reported as
missing; an asset with no recorded metrics is never recommended for kill.

**2. AI output is interpretation, not data.** Model output is stored in a
separate table, rendered inside a visually distinct "AI interpretation — not
measured data" region, and the exact payload the model received is kept
alongside it for audit. The model is instructed never to invent an external
metric, and "reasons NOT to build" is mandatory in every analysis.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

With no environment configured the app runs in **local demo mode**: an in-memory
store seeded with fictional opportunities, SERP results, clusters and assets, all
flagged `DEMO`. No login is required. Data resets when the server restarts, and
every screen says so.

Demo mode exists for evaluating the product. **The normal path is Supabase** —
see [Supabase setup](#supabase-setup). A production build without Supabase
configured shows a persistent warning banner on every screen, because everything
you create in that state is lost on the next restart.

```bash
npm run check        # lint + typecheck + tests
npm run build        # production build
npm start            # production server
```

---

## Architecture

```
src/
  app/
    (app)/                 authenticated shell — dashboard, research,
                           opportunities, pipeline, portfolio, clusters,
                           settings
    actions/               server actions (the only write path)
    login/                 Supabase email/password auth
  components/              UI, grouped by feature; ui/ holds shadcn primitives
  lib/
    domain/                types + Zod schemas — the shared vocabulary
    scoring/               demand normalisation, scoring engine, SERP summary
    engine/                next-best-action, checkpoints, build-pack generator
    providers/             external-provider interfaces + adapters
      dataforseo/          DataForSEO client, wire-shape mapping, locations
    data/                  Store interface, Supabase + in-memory adapters, seed
    csv/                   RFC 4180 parser and import mapper
supabase/migrations/       schema and RLS
scripts/                   seed SQL generator
```

Four ideas hold it together:

**The domain layer is the contract.** `src/lib/domain/types.ts` defines every
entity and enumeration; `schemas.ts` defines the Zod validation for each one.
Everything else — database mapping, UI, server actions, tests — depends on these
and nothing depends on the UI.

**All logic is pure and testable.** Scoring, the next-best-action engine, the
checkpoint evaluator, the build-pack generator and the CSV mapper are plain
functions over plain data with no I/O. They are unit tested directly, and the
server actions are thin wrappers that load data, call them, and persist.

**Persistence sits behind one interface.** `src/lib/data/store.ts` defines
`Store`. `SupabaseStore` implements it against Postgres; `MemoryStore` implements
it against a seeded in-process object graph. `getDataContext()` picks one based
on whether Supabase is configured, and the UI cannot tell the difference.

**Writes go through server actions.** Every mutation re-validates its input with
Zod server-side (including CSV imports, whose mapping happens in the browser and
is therefore untrusted), recomputes the affected score, and appends to the
activity log.

---

## Environment variables

Every value below is one you supply from your own accounts — nothing in this
repository, including `.env.example`, contains a real key or password. Get each
one from the linked dashboard, not from anyone else's setup.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | for persistence | Supabase project URL. Without it the app runs in demo mode. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for persistence | Supabase anon/publishable key. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is also accepted. |
| `DATAFORSEO_LOGIN` | for keyword/SERP data | DataForSEO **API** login from [app.dataforseo.com/api-access](https://app.dataforseo.com/api-access) — not your dashboard account password. |
| `DATAFORSEO_PASSWORD` | for keyword/SERP data | DataForSEO API password from the same page. |
| `ANTHROPIC_API_KEY` | for AI analysis | Enables the Claude provider. Without it the AI tab shows a configuration state. |
| `ANTHROPIC_MODEL` | no | Model override. Defaults to `claude-opus-5`. |

Both DataForSEO variables must be set together, and DataForSEO must then be
selected under **Settings → Providers** for the keyword and/or SERP slot. Live
calls consume DataForSEO credits.

Copy `.env.example` to `.env.local` to start.

**Secrets are never stored in the database.** Settings stores *which* provider is
selected; credentials stay in the environment. The Settings screen reports each
provider's real configuration status by inspecting the running process.

---

## Supabase setup

Supabase provides both authentication and durable storage, and is the intended
way to run this. Demo mode is preserved as a fallback, but a production instance
without Supabase keeps every record in one process's memory.

1. Create a project at [supabase.com](https://supabase.com) named **Utility
   Factory**. Pick the region closest to you — **region cannot be changed after
   creation**.
2. Apply the migrations, in order:
   - `20260101000000_init.sql` — tables, constraints, indexes, `updated_at`
     triggers, and a trigger that mirrors new `auth.users` rows into
     `public.users` and gives them default settings.
   - `20260101000100_rls.sql` — row level security.
   - `20260201000000_provider_metrics.sql` — provider-sourced metric columns and
     provenance (see below).
   - `20260201000100_harden_functions.sql` — pins `search_path` on the trigger
     functions and revokes their `EXECUTE` from `anon`/`authenticated`, so the
     `SECURITY DEFINER` bootstrap function is not reachable over `/rest/v1/rpc`.

   With the Supabase CLI: `supabase db push`. Or paste each file into the SQL
   editor in that order.
3. Put the project URL and anon key (Project Settings → API) in `.env.local`.
4. Start the app, open `/login`, and use **Create the operator account**. The
   trigger provisions your `users` row and default settings.
5. Optionally load the demo data: run `supabase/seed.sql`. It attaches the demo
   records to the single existing user and fails loudly if there isn't one. Skip
   this on an instance you intend to use for real work.
6. Run the Supabase advisors (**Advisors → Security** in the dashboard) after
   applying migrations. A clean run reports no lints.

### What the provider-metrics migration adds

`opportunities` gains `competition_index`, `competition_level`,
`metrics_provider` and `metrics_fetched_at`; `serp_results` gains `source`,
`provider` and `fetched_at`.

Ad competition is stored separately from `keyword_difficulty` on purpose. Google
Ads `competition_index` measures how contested a keyword is *for advertisers*;
keyword difficulty measures how hard it is to rank *organically*. Writing one
into the other would silently relabel a metric as something it is not, so they
are different columns with different meanings in the UI.

To remove the demo data later:

```sql
delete from public.opportunities where is_demo;
delete from public.clusters where is_demo;
delete from public.assets where is_demo;
```

### Row level security

Every table has RLS enabled and the same rule: a row is visible only to the user
who owns it. Tables with a `user_id` check `auth.uid() = user_id` directly. Child
tables (SERP results, analyses, build packs, asset metrics, status history) have
no `user_id` of their own and inherit ownership from their parent through
`owns_opportunity()` / `owns_asset()` / `owns_cluster()`. `cluster_opportunities`
requires ownership of *both* sides, so a link cannot be used to probe for the
existence of another user's row.

### Seed data

`supabase/seed.sql` is generated from `src/lib/data/seed.ts`, which is also what
the in-memory demo store uses — one source of truth, so the two cannot drift.
Regenerate with `npm run seed:sql`. Dates are emitted as `now() - interval 'N
days'` so the demo checkpoints stay meaningful whenever the seed is applied.

Every seeded row is fictional and flagged `is_demo`. Domains use `.example`, and
the UI badges each record `DEMO`.

---

## How scoring works

The opportunity score is 100 points across seven weighted factors:

| Factor | Default weight | Source |
| --- | --- | --- |
| Demand | 20 | Derived from search volume |
| SERP weakness | 25 | Operator judgement, suggestible from SERP evidence |
| Utility fit | 20 | Operator judgement |
| Monetization | 10 | Operator judgement |
| Evergreen | 10 | Operator judgement |
| Build simplicity | 10 | Operator judgement |
| Cluster potential | 5 | Operator judgement |

Weights are configurable in Settings and must total exactly 100 — enforced in the
form, in the Zod schema, and by a database constraint. Changing them re-scores
every opportunity immediately, so two scoring models never coexist in one table.

### Demand normalisation

There is no universal formula for "enough demand", so the curve is explicit and
calibrated rather than hardcoded. Search volume is log-interpolated between two
operator-set points: at or below the **floor** scores 0, at or above the
**ceiling** scores 100. A log curve is used because the difference between 100
and 1,000 searches matters far more than the difference between 40,000 and
41,000. Both points live in Settings. The derived value can be overridden per
opportunity, but only with a stated reason — enforced by schema *and* by a
database check constraint.

### Missing factors contribute zero, and are never renormalised away

If only utility fit is assessed and it is perfect, the score is 20, not 100.
Renormalising would let one known factor manufacture a 95/100. Instead each
breakdown reports **completeness** — the share of total weight backed by data —
and the UI states that the total is a lower bound and names the missing factors.

### Everything is explainable

Each factor exposes its raw value, its weighted contribution, and a
human-readable reason, including the ones that scored nothing (whose "reason" is
the prompt to go and assess them). Decision bands are BUILD 85–100,
INVESTIGATE 70–84, WATCH 50–69, REJECT 0–49, all configurable.

### SERP weakness is evidence-additive

The SERP tab summarises captured results and can *suggest* a weakness score, but
never applies it automatically. Every point in the suggestion comes from
something explicitly recorded: low-authority domains, apparently-new domains,
non-utility pages occupying the SERP, operator flags for poor intent match or
weak competitors — minus points for strong competitors and utilities already
ranking. Unclassified results contribute nothing, and results with no authority
data are counted and reported as *unknown*, not as weak. Fewer than three
captured results produces no suggestion at all.

---

## How provider integrations work

Four interfaces in `src/lib/providers/types.ts`:

| Interface | Supplies | Real adapter |
| --- | --- | --- |
| `KeywordProvider` | search volume, difficulty, CPC, ad competition, seed expansion | DataForSEO |
| `SerpProvider` | organic top 10 for a keyword | DataForSEO |
| `AIProvider` | structured opportunity analysis | Claude |
| `SearchAnalyticsProvider` | impressions, clicks, CTR, position for live assets | none yet |

Every provider reports its own `status()` rather than throwing at import time,
which is what lets the UI render an honest "not configured" state — with the
required environment variables named — instead of crashing or, far worse,
substituting a plausible-looking number.

Manual adapters remain the default for all four and are deliberately inert: they
throw `ProviderNotConfiguredError`, which the UI renders as a configuration
state. The operator supplies the data by hand or by CSV import.

**Adding a provider** is one file plus one line: implement the interface in
`src/lib/providers/`, register the factory in `registry.ts`. The Settings screen
reads its options from that registry, so a new adapter appears automatically with
its configuration status. Nothing else in the application imports a vendor SDK.

---

## DataForSEO

The first real external data source. Authentication is HTTP Basic with the API
login and password from
[app.dataforseo.com/api-access](https://app.dataforseo.com/api-access) — these
are distinct from the dashboard account password.

### Endpoints used

| Endpoint | Used by | Supplies |
| --- | --- | --- |
| `POST /v3/keywords_data/google_ads/keywords_for_keywords/live` | Research → *Expand seeds* | Related keyword discovery (max 20 seeds/call) plus volume, CPC, competition, monthly history |
| `POST /v3/keywords_data/google_ads/search_volume/live` | Research → *Look up as typed*, and *Refresh from provider* | Volume, CPC, competition, monthly history for known keywords |
| `POST /v3/dataforseo_labs/google/bulk_keyword_difficulty/live` | both of the above | Organic keyword difficulty, 0–100 |
| `POST /v3/serp/google/organic/live/advanced` | SERP tab → *Fetch top 10* | Live Google organic results |
| `GET /v3/keywords_data/google_ads/locations` | all keyword calls | Country ISO → location code |
| `GET /v3/serp/google/locations` | SERP calls | Country ISO → location code |

Country and language: the app stores ISO-3166 alpha-2 country codes (`US`, `GB`)
and ISO language codes (`en`, `de`). Country codes are resolved to DataForSEO
numeric location codes at call time from the locations endpoints, filtered to
`location_type = "Country"` so a lookup cannot silently narrow to a region or
city, and memoised for the life of the process. Language codes pass through.

The Labs difficulty call is **best-effort**: it is billed separately from Keyword
Planner data, so if the account has no Labs subscription the call fails quietly
and `keywordDifficulty` stays `null` rather than blocking the volume and CPC the
account *can* see.

### What DataForSEO fills in, and what stays manual

Filled in automatically:

- search volume, CPC, Google Ads competition index and bucket
- keyword difficulty (Labs, when subscribed)
- trend, derived from the reported monthly search history
- organic top 10: position, domain, URL, title

**Still manual, on purpose:**

- **Low authority** and **new site** flags. No provider in this integration
  measures either. Fetched SERP rows leave both `null`, and the SERP summariser
  counts only explicitly-marked rows, so a fetch can never by itself produce a
  "weak SERP" verdict. These stay a manual judgement until there is a provider
  worth trusting for them.
- **Domain authority**, for the same reason.
- **Page type** (utility / article / directory / …) — the SERP endpoint does not
  classify pages, so fetched rows default to `OTHER` for you to correct.
- **Competitor assessment** and notes.
- All six qualitative sub-scores: SERP weakness, utility fit, monetisation,
  evergreen, build simplicity, cluster potential.
- **Asset performance** — impressions, clicks, CTR, position, revenue. Search
  Console is deliberately not wired up yet; it comes once real utilities are
  published and there is something to measure.

### Trend derivation

`deriveTrend()` in `src/lib/providers/dataforseo/mapping.ts` computes a trend
from the monthly volumes the provider actually reported — a computation over
measured data, not an estimate. Two limits are deliberate:

- Fewer than **12** complete months → `UNKNOWN`.
- `SEASONAL` requires **24** months. With a single year, a December spike and a
  keyword genuinely taking off produce the same twelve numbers; claiming
  seasonality there would assert something the data cannot support. Such a year
  reports as `RISING`, which is what the window actually shows.

Otherwise the mean of the last 3 months is compared against the preceding 9:
≥ 1.2× is `RISING`, ≤ 0.8× is `DECLINING`, anything between is `STABLE`. The
thresholds are named constants, not inline magic numbers.

### Research workflow

**Research** (`/research`) is the seed-to-opportunity path:

1. Enter one or more seeds — `calculator`, `generator`, `converter`, `checker`,
   `estimator` — up to 20 per search, with country, language and a result cap.
2. Choose **Expand seeds** (discovery) or **Look up as typed** (price exactly
   what you entered). Providers that cannot expand fall back to lookup.
3. Review the candidate table. Every cell is measured or blank; a blank means the
   provider reported nothing and is never rendered as zero. Keywords you already
   track are shown, linked, and cannot be selected again.
4. Tick what is worth tracking and import. Records are created with
   `source = KEYWORD_PROVIDER`, status `INBOX`, and `metrics_provider` /
   `metrics_fetched_at` recording where the numbers came from and when.

Imported opportunities score low at first, and that is correct: only the demand
factor can be filled from provider data. The remaining 80 points are judgements
you make in the Opportunity detail screen.

Re-fetching a SERP replaces previously fetched rows, leaves hand-entered rows
alone, and carries any judgement you already recorded against a domain onto the
new row for that domain — a refresh never silently discards review work.

---

## Next Best Action

A deterministic, side-effect-free ranker over the whole workspace. The ordering
encodes one thesis: **money already earned outranks money hoped for.**

1. Winners with momentum that have not been expanded → **SCALE**
2. Assets being served but under-converting → **OPTIMIZE**
3. `READY_TO_BUILD` opportunities, best score first → **BUILD**
4. `QUALIFIED` opportunities without a build pack → **GENERATE BUILD PACK**
5. Promising research, or demand recorded with no SERP captured → **RESEARCH / ANALYZE SERP**
6. Old assets with measured zeros → **REVIEW / POSSIBLE KILL**

Each action returns `actionType`, `entity`, `reason`, `priority`, an `href`, and
an evidence list drawn entirely from stored data. Because it is a pure function
of the workspace, it can later be replaced or ensembled with an AI ranker behind
the same signature.

---

## Experiment checkpoints

Day 7 indexed · day 14 impressions · day 30 rankings improving · day 60
meaningful clicks · day 90 meaningful traffic or revenue. Thresholds are named
constants in `src/lib/engine/checkpoints.ts`, not magic numbers.

A failed checkpoint never kills anything. The evaluator produces a *recommended*
decision plus its reasoning; the operator applies or overrides it, and an
override is recorded in the activity log with its stated reason. Two rules matter
most:

- **A kill requires measured zeros.** An asset whose metrics were simply never
  entered has no evidence against it and is left alone.
- **Optimisation outranks scaling.** An asset that clears the day-90 bar but has
  a weak CTR is recommended for OPTIMIZE, because fixing traffic already being
  served is cheaper than building the next asset.

---

## Current limitations

- **Search Analytics is manual only.** The interface and registry entry exist and
  the UI handles the unconfigured state properly, but no adapter ships. Asset
  metrics are entered by hand until Search Console is wired up.
- **Authority signals are not measured anywhere.** Low authority, new site and
  domain authority remain hand-classified. This is the single biggest gap: SERP
  weakness carries the heaviest scoring weight, and fetching a SERP gets you the
  competitor list but not a judgement of it.
- **Demo mode is not durable.** Without Supabase, data lives in one process's
  memory and resets on restart. It is intended for evaluation, not for real work,
  and a production build without Supabase says so on every screen.
- **DataForSEO calls are synchronous and uncached.** Every research run and every
  refresh is a live billed call. There is no request cache or cost ceiling in the
  app; budget limits belong in the DataForSEO dashboard.
- **Seed expansion is capped at 20 seeds per search** by the upstream Keyword
  Planner endpoint, and the review table is capped at 200 candidates per run.
- **Charts are minimal.** Asset history renders as inline SVG sparklines. The
  data model stores full metric history, so a real charting layer can be added
  without touching persistence.
- **No pagination.** The explorer and pipeline load the full working set. Fine
  for hundreds of opportunities; past a few thousand, the store interface would
  need cursor support.
- **Assets are not normalised to a fixed window.** Headline figures are whatever
  the most recent recorded window contains, and the UI labels them that way
  rather than claiming a "last 30 days" number it cannot compute.
- **AI analysis is single-shot.** No streaming, no retry-on-refusal fallback.
- **Single operator.** RLS is per-user and correct, but there is no sharing,
  invitation or role model — by design.

---

## Suggested next integrations

1. **Search Console** (`SearchAnalyticsProvider`) — the highest-value addition
   once the first utilities are live and indexed. Every checkpoint currently
   depends on hand-entered metrics; automating impressions/clicks/CTR/position
   turns the portfolio into a live instrument. Deliberately deferred until there
   is real published traffic to read.
2. **A domain-authority source** — the missing half of SERP analysis. DataForSEO
   Labs exposes `rank_info` (`main_domain_rank`, `backlinks`) on some endpoints,
   and Moz/Majestic sell the metric directly. Until one is wired in, `is_low_authority`
   and `is_new_site` must stay hand-classified rather than inferred.
3. **Cached / batched DataForSEO calls** — a short-lived cache on volume lookups,
   and the task-based (non-`/live`) endpoints for bulk work, would cut credit
   burn substantially on repeated research.
4. **Revenue/analytics** — extend `SearchAnalyticsProvider`, or add a sibling
   interface, to pull pageviews and revenue.
5. **AI-assisted next-best-action** — keep the deterministic engine as the floor
   and let a model re-rank its output, so the system degrades to something
   explainable when the model is unavailable.

---

## Testing

```bash
npm test
```

133 tests covering the parts where a bug would silently corrupt a decision: the
scoring engine and demand curve, the SERP weakness summariser, the checkpoint
evaluator, the next-best-action ranker, the build-pack generator, the CSV
parser/importer, the DataForSEO wire-shape mapping, and an end-to-end pass over
the critical flows (create → score → capture SERP → apply weakness → generate
build pack → publish asset → record metrics → review checkpoints) against the
in-memory store.

The DataForSEO tests are offline: the mapping tests run against captured payload
shapes, and the client and provider tests stub `fetch` to assert which endpoints
are called, what request bodies are sent, and how failures surface. They exist
mainly to pin the null rules: that a
measured `0` survives, that a missing field becomes `null` and not `0`, that
`UNSPECIFIED` competition does not collapse into `LOW`, that advertiser
competition never leaks into `keywordDifficulty`, and that a fetched SERP row
leaves every authority field `null`.

Several tests exist specifically to pin down the two rules at the top of this
file — that unknown never becomes zero, and that the score is never inflated by
renormalising missing factors away.
