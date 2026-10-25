# CompetePulse

Automated competitive intelligence for product, growth and executive teams. CompetePulse monitors competitor pricing pages, changelogs and homepages, detects material changes, synthesizes strategic insights, and routes high-impact moves to Slack or email.

Built as a local-first full-stack app: React + Vite front end, Express API, SQLite persistence, and optional Firecrawl / OpenAI / Qdrant / Slack / Resend adapters. It runs with **zero API keys** and ships with a realistic demo workspace.

---

## Quick start

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:4321**.

The first start seeds a demo workspace with 6 competitor profiles, 18 monitored pages, 48 snapshots, 30 insights, 120 feature cells and two historical executive briefings.

```bash
npm run typecheck   # strict TypeScript across server + client
npm test            # diff / extraction / embedding / alert tests
npm run build       # production client build
npm start           # production server (serves dist/public)
```

> Node 24+ is required because persistence uses the built-in `node:sqlite` module.

---

## What is implemented

| PRD area | Delivered |
| --- | --- |
| **ST-1 Competitor & target management** | Full CRUD for competitors, tiering/industry metadata, per-page URL configuration, daily/weekly/on-demand cadence, enable/disable and target-level scans |
| **ST-2 Scraping & ingestion** | Firecrawl adapter with screenshot capture, native fetch + readability extractor, demo generator fallback, cookie/nav/footer removal, clean markdown storage, snapshot history with hashes and word counts |
| **ST-3 Diff & embeddings** | Line-level LCS diffs with context, pricing table/card parser, added/removed pricing tiers, similarity + magnitude scoring, cosmetic-noise suppression, section-aware chunking, local hash embeddings or OpenAI `text-embedding-3-small`, SQLite vector index plus optional Qdrant mirror |
| **ST-4 LLM synthesis & gap analysis** | Pricing, feature-launch, messaging and partnership analysis rubrics, optional OpenAI structured-output mode, weekly executive digest generation, shared capability matrix with table-stakes/white-space readouts, grounded Q&A over retrieved snapshots |
| **ST-5 Dashboard & notifications** | Overview KPIs, filterable feed, insight drill-down with diff and captured page, competitor workspaces, feature matrix, weekly briefing archive, Slack webhook + Resend email delivery, delivery log |

### Demo mode

The seeded competitors use fictional data. Scans attempt the live URL first; if the site is unreachable and **Demo fallback** is enabled in Settings, CompetePulse generates a coherent next revision of the page so the full pipeline (capture → diff → embeddings → insight → alert) can be demonstrated offline.

Snapshots are labelled `live`, `simulated` or `seed` so simulated intelligence is never mistaken for a real capture. Disable the fallback in **Settings → Workspace** for strict live monitoring.

---

## Configuration

Copy `.env.example` to `.env` and fill in only the providers you want. Everything degrades gracefully.

| Variable | Effect when set |
| --- | --- |
| `FIRECRAWL_API_KEY` | Uses Firecrawl for JS-rendered scraping and screenshots. Falls back to native fetch on error. |
| `OPENAI_API_KEY` | Enables LLM synthesis, weekly digest writing and RAG answers. Without it, the deterministic rubric engine is used. |
| `OPENAI_MODEL` | Chat model, defaults to `gpt-4o-mini`. |
| `OPENAI_EMBEDDING_MODEL` | Defaults to `text-embedding-3-small`. Local hash embeddings are used without a key. |
| `QDRANT_URL` / `QDRANT_API_KEY` | Mirrors chunks to Qdrant and queries it, with the local SQLite index as fallback. |
| `SLACK_WEBHOOK_URL` | Fallback Slack webhook. The value in Settings takes precedence. |
| `RESEND_API_KEY` | Enables email alerts and digest delivery. |
| `PORT` / `HOST` | Bind address. Defaults to `127.0.0.1:4321`. |
| `DB_PATH` | SQLite file location. Defaults to `data/competepulse.db`. |

Slack and email can also be configured from the UI. Seeded "delivered" alerts are marked **simulated** until a real channel is connected.

---

## Architecture

```
Browser (React + Vite)
   │  REST /api
   ▼
Express server ─────────────── scheduler (node-cron)
   │                               │ due targets / weekly digest
   ▼                               ▼
SQLite (node:sqlite)  ◄──── pipeline service
   competitors, targets, snapshots, diffs, insights,
   chunks+vectors, features, digests, notifications
   │
   ├─ scraper: Firecrawl → native fetch → demo generator
   ├─ extract: cheerio → markdown, pricing tiers, chunks
   ├─ diff: noise filter, LCS, similarity, pricing deltas
   ├─ embed: OpenAI or local feature hashing → SQLite/Qdrant
   ├─ analyze: rubric engine or LLM → insight drafts
   └─ notify: Slack / Resend, thresholded by impact
```

### Noise control

Before diffing, CompetePulse removes blank lines, timestamps, copyright/footer boilerplate, "last updated" stamps and consent copy. Pages that differ only in formatting produce **no diff, no insight and no alert**. A recording of the algorithm's behavior lives in [server/tests/engine.test.ts](server/tests/engine.test.ts).

### Insight generation

Heuristics classify pricing changes (including percentage moves and new/retired tiers), feature launches, partnerships and homepage repositioning. Impact is assigned from explicit rules. When `OPENAI_API_KEY` is present, the same diff is sent to an LLM with a strict JSON contract; failures fall back to the rubric engine, so ingestion never blocks on the model provider.

### Weekly briefing

Digests aggregate the selected week's signals into an executive summary, pricing watch, product/partnership moves, messaging shifts and numbered recommended actions. They can be generated on demand, refreshed mid-week, and delivered to Slack/email. Re-generating a week updates that briefing instead of duplicating it.

### Feature gap matrix

All competitors share a 20-capability catalog spanning AI, data, analytics, automation, integrations, security and platform. Each cell is editable inline. Coverage readouts highlight **table stakes** (5–6 of 6 competitors) and **white space** (0–1).

---

## API sketch

```
GET    /api/stats                      workspace KPIs + 14-day activity
GET    /api/competitors                list with targets and change counts
POST   /api/competitors                create competitor (+ default targets)
GET    /api/competitors/:id            workspace detail
PATCH  /api/competitors/:id            edit metadata
DELETE /api/competitors/:id            remove competitor and history
POST   /api/targets                    add a monitored page
PATCH  /api/targets/:id                change URL / cadence / enabled
POST   /api/scan                       scan one target, one competitor, or all
GET    /api/feed                       filtered insights
GET    /api/insights/:id               single insight
POST   /api/insights/:id/notify        deliver an alert
GET    /api/snapshots/:id              snapshot + linked diff
POST   /api/search                     semantic + keyword search
POST   /api/ask                        grounded competitive Q&A
GET    /api/matrix                     shared capability matrix
PATCH  /api/features/:id               edit matrix cell
GET    /api/digests                    archive
POST   /api/digests/generate           generate current/previous week
POST   /api/digests/:id/send           deliver briefing
GET    /api/settings                   settings + provider status
PUT    /api/settings                   save settings
POST   /api/settings/test-slack        verify a webhook
GET    /api/notifications              delivery log
```

---

## Design notes & limits

- **Local single-tenant app.** There is no authentication layer; run it on localhost or behind your own auth proxy. Do not expose it directly to the public internet.
- **Screenshots** are captured only when Firecrawl is configured. Otherwise the UI renders the archived markdown inside a browser-style frame and labels it as a text capture.
- **Embeddings** without a key are deterministic feature hashes — good for lexical retrieval, not a substitute for semantic embeddings.
- **Qdrant** is mirrored best-effort; local SQLite remains the source of truth for search fallback.
- **Scheduler** runs in the API process. Multiple server instances against the same database should use one scheduler.
- **Demo data** is fictional. Keep the demo fallback off when monitoring real competitors if you do not want simulated revisions when a site is down.
- Seeded historical alerts are `simulated` by design; only Slack/Resend deliveries become `sent`.

---

## Verification

```bash
npm run typecheck
npm test
npm run build
PORT=4400 npm start   # serve the production bundle
```

The test suite covers pricing extraction, price-change detection, cosmetic suppression, changelog diffs, HTML cleanup, section chunking, embedding ranking and alert thresholds.
