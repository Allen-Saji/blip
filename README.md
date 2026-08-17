# Blip

**You never miss a blip.**

Paste any URL, describe what matters in plain English, and Blip watches it. When the thing you care about changes, you get a clean diff — even if the site redesigned itself overnight.

Built for [Into the Scrape-Verse](https://wemakedevs.org/hackathons) (WeMakeDevs × Bright Data, Aug 17–23, 2026).

## What it does

Scrapers work in testing, then break quietly the first time a site changes a class name. Google Alerts only matches keywords — it can't watch *a specific value* on *a specific page*. Blip is a personal change monitor where the self-healing is the product:

1. **Describe once.** Paste a URL and describe the field you care about in plain language ("the price", "whether it's in stock"). No selectors, no code.
2. **Watch.** [Bright Data Scraper Studio](https://brightdata.com/products/scraper-studio) extracts that field as structured data. Blip snapshots it on a schedule.
3. **Detect.** When the structured output changes, Blip diffs it and produces a human-readable "what changed" message.
4. **Self-heal.** When a site redesigns and extraction comes back empty, Blip hands Scraper Studio the original plain-language description. Scraper Studio rewrites the extraction, the collector heals, and the data keeps flowing — the user never sees a gap.

The plain-language description is the source of truth, used for the initial scrape *and* for repair.

## Try it

Guest-first: no signup. Paste a URL, type what to watch, and you get one free watch immediately. Sign in (GitHub OAuth) to save watches and get email notifications.

- **Watch cadence:** hourly / daily / weekly
- **Limits:** 1 watch per guest, 3 per account (keeps demo credit usage low)

## Architecture

Blip is an async job system, not a request/response CRUD app — Bright Data's create (5–15 min), run (30–90 s), and self-heal (up to 15 min) operations all need durable tracking and polling.

```
User                    Blip backend                         Bright Data
 │                          │                                     │
 │  POST /watches (url+desc)│                                     │
 ├─────────────────────────>│  enqueue "create" job               │
 │  ← 202 {watch: pending}  │                                     │
 │                          │  create → POST /dca/collector       │
 │                          ├────────────────────────────────────>│  (5-15 min)
 │                          │  poll automate_template             │
 │                          │<────────────────────────────────────┤  collector_id c_*
 │                          │  store c_* on watch                 │
 │                          │  enqueue "run" job                  │
 │                          │  run → POST /dca/trigger?queue_next=1│
 │                          ├────────────────────────────────────>│  (30-90s)
 │                          │  poll /dca/dataset                  │
 │                          │<────────────────────────────────────┤  JSON rows
 │                          │  diff vs previous snapshot          │
 │                          │  (change?) → email + in-app         │
 │                          │  (empty?) → enqueue "heal" job      │
 │                          │  heal → refactor_template + poll    │
 │                          ├────────────────────────────────────>│  (up to 15 min)
 │                          │  resume_automation_job (approve)    │
 │                          │<────────────────────────────────────┤  healed, same c_*
 │                          │  enqueue "run" again                │
```

### Stack

| Concern | Choice |
|---|---|
| Frontend + API | Next.js App Router + Tailwind |
| Database | Postgres + Drizzle ORM |
| Bright Data | Scraper Studio via REST API (`Collection API` + `AI Flow API`) |
| Jobs | Postgres-backed queue + worker (`FOR UPDATE SKIP LOCKED`, idempotent handlers) |
| Diff | JSON deep-diff + mechanical summary (no LLM dependency) |
| Notify | Resend (email) + in-app changes feed |
| Auth | Guest-first + GitHub OAuth via Auth.js |

### Why a custom Postgres job queue

The async reality genuinely needs durable jobs, but the job surface is tiny: three job types, each "do a thing, poll, then enqueue the next step." A Postgres-backed `jobs` table with `status`, `attempts`, `locked_at`, `next_run_at`, plus a single worker loop, is ~300 LOC with zero new infra. Two primitives make it correct:

1. `SELECT ... FOR UPDATE SKIP LOCKED` to claim jobs — prevents two worker ticks from claiming the same job.
2. **Idempotent handlers** — a crash mid-poll is safe to re-run. Every handler checks "is this step already done?" before doing work.

### Self-heal flow

1. A run returns `[]`, or fields that were present before come back null → that's "site moved", not "no change".
2. Blip enqueues a `heal` job with the watch's original plain-language description.
3. The handler calls Scraper Studio's `refactor_template` with a prompt built from that description, polls to the `pending_answer` approval gate, and auto-approves via `resume_automation_job`.
4. Same collector ID is preserved. A `run` job is enqueued to verify the recovery.

## Repo layout

```
src/
  app/                  Next.js App Router (pages + API routes)
    api/watches         POST create watch, GET list
    api/watches/[id]/check   manual "check now"
    api/changes         in-app changes feed
  db/                   Drizzle schema + Postgres connection
  lib/
    brightdata/         typed Scraper Studio REST client (create/run/heal)
    diff/               JSON deep-diff engine + mechanical summary (+ tests)
    jobs/               Postgres job queue, worker loop, scheduler
    email.ts            Resend integration
    validation.ts       Zod schemas + URL validation (public-only)
scripts/
  brightdata-contract.ts   live API contract test (create → run → heal → run)
worker.ts               long-lived job worker + scheduler entrypoint
```

## Getting started

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL, BRIGHTDATA_API_TOKEN, RESEND_API_KEY
npx drizzle-kit push    # create tables (or generate + apply migrations)
npm run dev             # frontend + API
npx tsx worker.ts       # job worker + scheduler
```

### Env vars

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `BRIGHTDATA_API_TOKEN` | yes | Bright Data API token (used by Scraper Studio REST calls) |
| `RESEND_API_KEY` | no | Resend key for email notifications |
| `GITHUB_ID` / `GITHUB_SECRET` / `AUTH_SECRET` | no (deferred) | GitHub OAuth via Auth.js |

### Tests

```bash
npx tsx src/lib/diff/engine.test.ts      # diff engine unit tests
npx tsx scripts/brightdata-contract.ts   # live Bright Data contract test (uses real credits — run deliberately)
```

## Roadmap / open items

- [ ] Provision Postgres + apply migration (first blocker for end-to-end)
- [ ] Wire Resend `from` domain + email-on-change
- [ ] GitHub OAuth (save/notify only; guest-first for the demo)
- [ ] Self-heal demo fixture site (controlled break-and-heal)
- [ ] Deploy: Vercel (frontend/API) + DigitalOcean droplet (worker)
- [ ] LLM semantic diff summaries (mechanical diff ships first by design)

## License

MIT
