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

To run against real persistence, see [Supabase setup](#supabase-setup).

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
    (app)/                 authenticated shell — dashboard, opportunities,
                           pipeline, portfolio, clusters, settings
    actions/               server actions (the only write path)
    login/                 Supabase email/password auth
  components/              UI, grouped by feature; ui/ holds shadcn primitives
  lib/
    domain/                types + Zod schemas — the shared vocabulary
    scoring/               demand normalisation, scoring engine, SERP summary
    engine/                next-best-action, checkpoints, build-pack generator
    providers/             external-provider interfaces + adapters
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

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | for persistence | Supabase project URL. Without it the app runs in demo mode. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for persistence | Supabase anon/publishable key. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is also accepted. |
| `ANTHROPIC_API_KEY` | for AI analysis | Enables the Claude provider. Without it the AI tab shows a configuration state. |
| `ANTHROPIC_MODEL` | no | Model override. Defaults to `claude-opus-5`. |

Copy `.env.example` to `.env.local` to start.

**Secrets are never stored in the database.** Settings stores *which* provider is
selected; credentials stay in the environment. The Settings screen reports each
provider's real configuration status by inspecting the running process.

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations, in order:
   - `supabase/migrations/20260101000000_init.sql` — tables, constraints, indexes,
     `updated_at` triggers, and a trigger that mirrors new `auth.users` rows into
     `public.users` and gives them default settings.
   - `supabase/migrations/20260101000100_rls.sql` — row level security.

   With the Supabase CLI: `supabase db push`. Or paste each file into the SQL
   editor.
3. Put the project URL and anon key in `.env.local`.
4. Start the app, open `/login`, and use **Create the operator account**. The
   trigger provisions your `users` row and default settings.
5. Optionally load the demo data: run `supabase/seed.sql`. It attaches the demo
   records to the single existing user and fails loudly if there isn't one.

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

| Interface | Supplies |
| --- | --- |
| `KeywordProvider` | search volume, difficulty, CPC |
| `SerpProvider` | ranking results for a keyword |
| `AIProvider` | structured opportunity analysis |
| `SearchAnalyticsProvider` | impressions, clicks, CTR, position for live assets |

Every provider reports its own `status()` rather than throwing at import time,
which is what lets the UI render an honest "not configured" state — with the
required environment variables named — instead of crashing or, far worse,
substituting a plausible-looking number.

Manual adapters are the default for all four and are deliberately inert: they
throw `ProviderNotConfiguredError`, which the UI renders as a configuration
state. The operator supplies the data by hand or by CSV import. The one real
adapter shipped is `ClaudeAIProvider`, which uses structured outputs so the model
cannot return a shape the UI is unprepared for, and guarantees every section —
including the mandatory "reasons not to build" — is present.

**Adding a provider** is one file plus one line: implement the interface in
`src/lib/providers/`, register the factory in `registry.ts`. The Settings screen
reads its options from that registry, so a new adapter appears automatically with
its configuration status. Nothing else in the application imports a vendor SDK.

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

- **Keyword, SERP and Search Analytics providers are manual only.** The
  interfaces and the registry exist and the UI handles the unconfigured state
  properly, but no real vendor adapter ships.
- **Demo mode is not durable.** Without Supabase, data lives in one process's
  memory and resets on restart. It is intended for evaluation, not for real work.
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

1. **Search Console** (`SearchAnalyticsProvider`) — the highest-value addition by
   far. Every checkpoint currently depends on hand-entered metrics; automating
   impressions/clicks/CTR/position turns the portfolio into a live instrument.
2. **A SERP provider** — SERP weakness carries the heaviest scoring weight and is
   the most laborious field to fill in by hand. Populate `serp_results` and let
   the existing suggestion engine do the rest.
3. **A keyword provider** — automates volume, difficulty and CPC at the top of
   the funnel, and makes bulk discovery practical.
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

88 tests covering the parts where a bug would silently corrupt a decision: the
scoring engine and demand curve, the SERP weakness summariser, the checkpoint
evaluator, the next-best-action ranker, the build-pack generator, the CSV
parser/importer, and an end-to-end pass over the critical flows (create → score →
capture SERP → apply weakness → generate build pack → publish asset → record
metrics → review checkpoints) against the in-memory store.

Several tests exist specifically to pin down the two rules at the top of this
file — that unknown never becomes zero, and that the score is never inflated by
renormalising missing factors away.
