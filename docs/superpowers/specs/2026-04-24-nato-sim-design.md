# NATO Simulation — Design Spec

> **Home**: `frontend/app/nato-sim/` + `backend/app/services/nato_sim/` + `backend/app/api/v1/nato_sim.py`
> **Deploys to**: `https://latentocean.com/nato-sim` via the existing LO EC2 pipeline.
> **IP posture**: Attached to Latent Ocean. Trade secrets (specific prompts, heuristics, sub-processes) live server-side only. Architecture-level visibility is acceptable; craft-level visibility is not.

## Mission

Single-operator all-source warning intelligence workstation for the AWIS
(All-Source Warning Intelligence Simulation, UNC PWAD 488/361, 24–25 April 2026).
Wears a State-Department-grade SCIF console skin over the existing LO frontend.
Automates the six-step analyst workflow (**read → comprehend → organize →
prioritize → correlate → synthesize**). Ingests Discord traffic live. Drives
slash-command-based collection templates. Auto-regenerates analytical products
under human-in-the-loop verification. Built tonight, shipped tomorrow 7am,
deployable post-sim as a persistent LO vertical.

## Simulation context

- **Event**: AWIS — PWAD 488 & 361, UNC Chapel Hill
- **Dates**: Fri 24 April 2026 (6–7 pm intro); Sat 25 April 2026 (8 am–4 pm live)
- **Scenario**: NATO Eastern Flank, starting 1 April 2030. Pre-war crisis
  posture — Russian armor 40 km from Suwałki, armed men in Daugavpils, Riga
  blackout + GPS jamming, Neptun Deep sabotage, SACEUR has requested Article 5
  (all 32 allies voted yes; Turkey conditional on Black Sea response).
- **Operator**: Diren Kumaratilleke — State INR team (Room 2010), under Director
  Luke Garner + Daniel Sielicki + Daniel Zeng + Connor Lamb.
- **Sim teams**: POTUS (Adm. Dennis Blair), DNI (Jack Barr), CIA, DIA, NSA, NGA,
  FBI, EUCOM J2, NATO NIFC, Collection Control.
- **Comms**: Discord. Agencies appoint comms officers; traffic via channels;
  collection requests via formal templates routed to Control.
- **Corpus (ingested tonight)**: `THE 2026 BRIEFING BOOK NATO 2030.docx`
  (1,832 paragraphs), `Friday Introductiom.ppt` (20 slides), 30-doc starter
  corpus from ISW/CSIS/RUSI/RAND/Atlantic Council/CNAS/Jamestown/Carnegie/
  Hudson/FRUS/NATO communiques.

## Product vision — four layers

```
LAYER 4 — Executive (POTUS/DNI/NSC views)             [post-sim]
LAYER 3 — Agency Lenses (INR tomorrow; others later)
LAYER 2 — Analytical Substrate (reuses LO interpretation pipeline + lo_nlp)
LAYER 1 — Collection / Feed (Discord gateway, webhook, paste, RSS)
```

Tomorrow ships L1 + L2 + L3(INR). L3(other agencies) + L4 are post-sim.

## Scope

### Tomorrow (must ship by 7 am 25 April)

- `/nato-sim` route live at `https://latentocean.com/nato-sim` behind an access
  code gate
- Pre-ingested briefing + Friday deck + 30 starter docs
- Pre-generated analytical products: Daily Read, 15 Country Cards, Watchboard,
  Network, Dissents, Sources
- Live Discord ingestion via laptop-hosted gateway bot → `/api/v1/nato_sim/ingest/discord`
- 9 slash commands wired to Collection Templates
- Live Query dock (Opus)
- Human-in-the-loop approval queue (Discord DMs + UI tray)
- SCIF dark aesthetic inside LO's `li-*` token system — classification banners,
  BLUF blocks, portion markers, paragraph numbers, source citations
- Supabase Realtime OR simple polling for live card updates (see Stack)

### Post-sim (not tonight)

- Agency-lens profiles for CIA/DIA/NSA/NGA/FBI (Layer 3 complete)
- DNI + POTUS views (Layer 4)
- Corpora crawler at scale (200+ sources, continuous)
- Promotion from sim vertical to permanent LO feature if valuable

## Tech stack (reusing LO's)

| Piece              | Choice                                         |
| ------------------ | ---------------------------------------------- |
| Frontend framework | Next.js 14 App Router (existing)               |
| UI tokens          | LO's `li-*` tailwind theme                     |
| State              | Zustand (existing) + TanStack Query (existing) |
| Backend framework  | FastAPI (existing LO)                          |
| Database           | SQLite file at `data/nato-sim.db`              |
| Embeddings + LLM   | Anthropic SDK direct (Sonnet + Opus); reuses LO's `lo_nlp` resolver utilities where applicable |
| Discord gateway    | discord.js on operator laptop                  |
| Discord HTTP ints  | FastAPI route `/api/v1/nato_sim/discord/interactions` |
| Live updates       | Server-Sent Events from FastAPI → frontend     |
| Deploy             | Existing LO pipeline (EC2 + nginx + Docker)    |

**Why SQLite instead of LO's Postgres**: isolation. Keeps nato-sim tables out
of the main Alembic chain; zero migration risk to production LO. If the vertical
proves itself and we want to promote it, migrating tables from SQLite to
Postgres is an hour of work. For tomorrow, SQLite is the right trade.

**Why reuse LO's FastAPI backend instead of Next.js API routes**: the
interpretation primitives already live there (`backend/app/services/interpretation/*`,
`lo_nlp/*`). Calling them from Python is a direct import; calling from
Node via HTTP is a round-trip. Tonight's build is entirely Python-backed;
the frontend is thin.

## File layout

```
lsx-latentocean/                                   ← existing private repo
├── frontend/
│   └── app/
│       └── nato-sim/                              ← NEW
│           ├── layout.tsx                         (classification banners + wraps kids)
│           ├── page.tsx                           (Daily Read)
│           ├── actors/page.tsx                    (list of 15 actor cards)
│           ├── actors/[id]/page.tsx               (single card)
│           ├── network/page.tsx                   (d3 force graph)
│           ├── watchboard/page.tsx                (I&W indicators)
│           ├── dissents/page.tsx                  (alternative views)
│           ├── sources/page.tsx                   (corpus browser)
│           ├── _components/                       (route-local components)
│           │   ├── ClassificationBanner.tsx
│           │   ├── TrafficColumn.tsx              (live firehose, SSE)
│           │   ├── LiveQueryDock.tsx              (docked, Opus-backed)
│           │   ├── PinnedRail.tsx
│           │   ├── ApprovalsTray.tsx
│           │   └── inr/
│           │       ├── BLUF.tsx
│           │       ├── KeyJudgment.tsx
│           │       ├── ConfidenceBadge.tsx
│           │       ├── PortionMark.tsx
│           │       ├── ParagraphNumber.tsx
│           │       └── SourceCitation.tsx
│           └── _lib/
│               ├── api.ts                         (typed fetch wrappers)
│               └── types.ts
├── backend/
│   └── app/
│       ├── api/v1/
│       │   └── nato_sim.py                        ← NEW (router + endpoints)
│       ├── services/
│       │   └── nato_sim/                          ← NEW (business logic)
│       │       ├── __init__.py
│       │       ├── db.py                          (SQLite helpers + schema)
│       │       ├── resolver.py                    (LLM entity extraction — uses lo_nlp where applicable)
│       │       ├── graph.py                       (knowledge graph CRUD)
│       │       ├── connection_finder.py           (graph path-finding)
│       │       ├── synthesizer.py                 (INR-voice prose generation)
│       │       ├── judgment/                      (OPERATOR CONTRIBUTION)
│       │       │   ├── priority.py
│       │       │   ├── confidence.py
│       │       │   ├── dissent.py
│       │       │   └── inr_voice.py
│       │       ├── ingest/
│       │       │   ├── docx_adapter.py
│       │       │   ├── pptx_adapter.py
│       │       │   ├── rss_adapter.py
│       │       │   └── pipeline.py                (resolve → graph → regen)
│       │       ├── templates/                     (Discord slash command bodies)
│       │       │   ├── rfi.py tasking.py sitrep.py assessment.py
│       │       │   ├── brief_dni.py brief_potus.py watchboard_export.py
│       │       │   ├── sources_lookup.py ingest_url.py
│       │       │   └── dispatch.py
│       │       └── corpora/
│       │           ├── starter-nato-eastern-flank.yaml
│       │           └── harvest.py
│       └── scripts/
│           └── prep_nato_corpus.py                (one-shot populator)
├── bot/                                           ← NEW sibling to frontend/
│   └── nato_sim/
│       ├── index.ts                               (discord.js gateway bot)
│       ├── register_commands.ts
│       └── verify.ts
└── docs/superpowers/
    ├── specs/2026-04-24-nato-sim-design.md        ← this file
    └── plans/2026-04-24-nato-sim-plan.md
```

## Naming / IP discipline

- **Server-side (trade secret)**: specific prompts in `synthesizer.py` and
  `judgment/inr_voice.py`; scoring heuristics in `judgment/priority.py`,
  `judgment/confidence.py`, `judgment/dissent.py`; exact RAG prompt templates;
  corpus curation strategy.
- **Client-side (fine to expose)**: UI components, LO branding, data model
  shapes, entity types, general architecture.
- **Never in logs**: full prompts, full LLM responses, judgment code.
  Log summaries (entity counts, latency, token counts) only.

## Engine primitives

All live server-side.

1. **resolver** — LLM extracts `{entities, claims, sources, timestamps}` from
   a text chunk. Cached by content hash. Uses Claude Sonnet with prompt caching.
2. **graph** — SQLite-backed property graph. Nodes:
   `actor | place | event | claim | system | region`.
   Edges: `mentions | relates-to | contradicts | supports | same-as`.
3. **connection_finder** — BFS up to N hops, returns paths not explicitly
   stated in any single source.
4. **synthesizer** — Opens with BLUF. Paragraphs numbered. Portion markers
   `(U) / (C) / (S) // FOR SIM USE ONLY`. Inline citations `[briefing ¶287]`.
5. **Embeddings** for RAG — optional for tomorrow; graceful fallback to lexical
   search if no embedding provider configured.

## Discord layer

- **Gateway bot** on operator laptop (`npm run nato-bot` from repo root).
  discord.js v14, listens to configured channels, forwards every message to
  `POST /api/v1/nato_sim/ingest/discord` with bearer auth.
- **HTTP Interactions** on the LO FastAPI server at
  `/api/v1/nato_sim/discord/interactions`. ed25519 signature verified.
- **9 slash commands**: `/rfi`, `/tasking`, `/sitrep`, `/assessment`,
  `/brief-dni`, `/brief-potus`, `/watchboard`, `/sources`, `/ingest`.
  Ephemeral replies. Outbound verification via confirmation card; inbound
  verification via DM for autonomous actions.

## Information architecture

```
┌─ UNCLASSIFIED // FOR SIMULATION USE ONLY ─────────────────────────┐
│ LO Sidebar │ Traffic │ Main canvas (6 views)       │ Pinned rail  │
│            │  (SSE)  │ + Live Query dock docked    │ + Approvals  │
└─ UNCLASSIFIED // FOR SIMULATION USE ONLY ─────────────────────────┘
```

LO's sidebar gets a new "NATO Sim" entry in the `liveDataItems` list,
alongside Franklin and D-U-N-C.

## Data model (SQLite)

`messages`, `entities`, `claims`, `edges`, `findings`, `approvals`,
`corpus_docs`, `events_log`, `pinned`. Same columns as prior draft; simplified
for SQLite (TEXT for uuid, JSON via TEXT, no pgvector — embeddings stored as
JSON float arrays).

## Access

- `NATO_SIM_ACCESS_CODE` env var on the LO backend
- Middleware rule: `/nato-sim/*` paths require cookie `nato_sim_session` set to
  the code, OR `?code=<CODE>` in URL (which sets the cookie on redirect)
- `/api/v1/nato_sim/ingest/*` gated by bearer `NATO_SIM_INGEST_SECRET`
- `/api/v1/nato_sim/discord/interactions` gated by ed25519 signature

## Deployment

Push to `lsx-latentocean` main branch → existing EC2 pipeline builds +
deploys → page lives at `https://latentocean.com/nato-sim`. No new
infrastructure. Env vars added to existing secrets config.

**Tonight**: operator runs `python backend/scripts/prep_nato_corpus.py` once
against the local SQLite DB. DB file committed or synced to EC2 via `scp`.

**Gateway bot**: operator runs `npm run nato-bot` from laptop tomorrow 7 am.
Bot forwards to `https://latentocean.com/api/v1/nato_sim/ingest/discord`.

## Contribution points

Four files where operator judgment shapes the product — ~5–10 lines each.
Prepped with signatures + comments + TODOs.

1. `backend/app/services/nato_sim/judgment/priority.py` —
   FLASH / IMMEDIATE / PRIORITY / ROUTINE
2. `backend/app/services/nato_sim/judgment/confidence.py` — HIGH/MEDIUM/LOW
3. `backend/app/services/nato_sim/judgment/dissent.py` — when to mandate alt-view
4. `backend/app/services/nato_sim/judgment/inr_voice.py` — system prompt

## Roadmap

- **Sim day (25 Apr)**: ship + run
- **Week 1**: agency-lens templates (CIA/DIA), migrate SQLite → Postgres if
  promoting as LO vertical
- **Month 1**: corpora crawler at scale, DNI integrator view
- **Quarter 1**: POTUS executive view, multi-operator mode, public demo assets
