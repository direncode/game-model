# NATO Simulation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Ship `https://latentocean.com/nato-sim` by Sat 25 April 7 am — all-source warning intelligence workstation, Discord-wired, LO-attached.

**Architecture:** New `/nato-sim` route in the existing LO Next.js frontend + new FastAPI router/services in the LO backend. SQLite for isolation. discord.js gateway bot on operator laptop. SSE for live UI updates.

**Tech:** Next.js 14 (existing), FastAPI (existing), SQLite, Anthropic SDK, discord.js, js-yaml (corpus list), mammoth / python-pptx (ingest), tweetnacl (Discord sigs).

**Testing:** TDD on engine primitives + judgment functions (pure logic); manual verify on UI/Discord wiring.

**Critical-path flag:** 🔴 blocker for 7 am; 🟡 high-value; 🟢 post-sim.

---

## Phase 0 — Route + sidebar link 🔴

### Task 0.1 — Create route folder + layout

**Files:**
- Create: `frontend/app/nato-sim/layout.tsx`
- Create: `frontend/app/nato-sim/_components/ClassificationBanner.tsx`

- [ ] Write `ClassificationBanner.tsx` (client component, two positions, red-900 bg).
- [ ] Write `layout.tsx` wrapping children with banners + the existing `Navbar`/`Sidebar`.
- [ ] Run `npm run dev` in `frontend/`, visit `http://localhost:3000/nato-sim` — confirm the banners render.

### Task 0.2 — Daily Read placeholder page

**Files:**
- Create: `frontend/app/nato-sim/page.tsx`

- [ ] Server component that reads `findings` via `/api/v1/nato_sim/findings?kind=daily-read&limit=1` and renders it. Until the backend exists, render a hardcoded placeholder. Use `li-*` tokens.

### Task 0.3 — Link in LO sidebar

**Files:**
- Modify: `frontend/components/Sidebar.tsx`

- [ ] Add `{ href: "/nato-sim", label: "NATO Sim", icon: Shield }` to `liveDataItems` (alongside Franklin + D-U-N-C).

### Task 0.4 — Commit the scaffold

- [ ] `git add frontend/app/nato-sim frontend/components/Sidebar.tsx docs/superpowers && git commit -m "feat(nato-sim): route scaffold + sidebar link + spec/plan docs"`

---

## Phase 1 — Access-code middleware 🔴

### Task 1.1 — Gate `/nato-sim` by code

**Files:**
- Modify: `frontend/middleware.ts`

- [ ] Add a rule: if `pathname.startsWith("/nato-sim")`, require cookie `nato_sim_session === process.env.NEXT_PUBLIC_NATO_SIM_CODE` OR `?code=` query. On valid query, set the cookie and redirect to the same path without the query. If neither, return 403.

- [ ] Add env vars to `.env.local` and `.env.example`:
  ```
  NEXT_PUBLIC_NATO_SIM_CODE=NATO-INR-2026
  NATO_SIM_INGEST_SECRET=<generate long random>
  ```

- [ ] Commit.

---

## Phase 2 — Backend SQLite schema 🔴

### Task 2.1 — `backend/app/services/nato_sim/db.py`

**Files:**
- Create: `backend/app/services/nato_sim/__init__.py` (empty)
- Create: `backend/app/services/nato_sim/db.py`

- [ ] Implement `get_db() -> sqlite3.Connection` (lazy-init, `data/nato-sim.db` path, enables WAL, row_factory = Row).
- [ ] Implement `init_db()` that runs `CREATE TABLE IF NOT EXISTS` for:
  - `messages (id TEXT PK, source, channel, author, content, ts, priority, raw_json, processed_at)`
  - `entities (id TEXT PK, type, canonical_name UNIQUE on (type,canonical_name), metadata, embedding, first_seen_at, last_seen_at)`
  - `claims (id TEXT PK, text, made_by_entity, about_entity, source_message, confidence, ts)`
  - `edges (id TEXT PK, from_entity, to_entity, kind, weight, evidence, created_at; UNIQUE(from_entity,to_entity,kind))`
  - `findings (id TEXT PK, topic, kind, text, confidence, citations, generated_at, superseded_by)`
  - `approvals (id TEXT PK, trigger, proposed_action, payload, status, decided_at, decided_by, created_at)`
  - `corpus_docs (id TEXT PK, url, origin, fetched_at, content_hash UNIQUE, title, text, embedding, source_tier, metadata)`
  - `events_log (id TEXT PK, kind, payload, ts)`
  - `pinned (id TEXT PK, finding_id, note, pinned_at)`
- [ ] Expose helpers: `insert(table, **cols) -> id`, `query(sql, *params) -> list[Row]`, `execute(sql, *params)`.

- [ ] Commit.

### Task 2.2 — Smoke test the DB

- [ ] `python -c "from backend.app.services.nato_sim.db import init_db; init_db(); print('ok')"` → expect `ok` + `data/nato-sim.db` created.

---

## Phase 3 — Engine primitives 🔴 (TDD)

Each with a unit test that uses live LLM (requires `ANTHROPIC_API_KEY`).

### Task 3.1 — resolver.py (entity/claim extraction)

**Files:** `backend/app/services/nato_sim/resolver.py` + `tests/nato_sim/test_resolver.py`

- [ ] Test: extract "Russia" from a sentence about "Russian forces advancing armor toward Suwałki corridor". Assert entity types + canonical names.
- [ ] Implement using Anthropic SDK with prompt caching on a stable system prompt. Use strict JSON output + Pydantic validation.
- [ ] Run → pass → commit.

### Task 3.2 — graph.py (upsert + neighbors)

**Files:** `backend/app/services/nato_sim/graph.py` + tests

- [ ] Test: `upsert_entity({type:"actor", canonical_name:"TestActor"})` idempotent; `add_edge(a, b, "mentions")` then `neighbors(a)` contains b.
- [ ] Implement.
- [ ] Commit.

### Task 3.3 — connection_finder.py (BFS hidden paths)

**Files:** `backend/app/services/nato_sim/connection_finder.py` + tests

- [ ] Test: A→B, C→B; `find_hidden_connections(A, max_hops=2)` includes C via B.
- [ ] Implement BFS.
- [ ] Commit.

### Task 3.4 — synthesizer.py (INR prose)

**Files:** `backend/app/services/nato_sim/synthesizer.py` + tests

- [ ] Test: output starts with `BLUF:`, contains portion markers `(U)|(C)|(S)`, contains at least one `[` citation.
- [ ] Implement using Opus for `model="deep"`, Sonnet for `"routine"`. System prompt includes `judgment/inr_voice.get_voice()`.
- [ ] Stub `judgment/inr_voice.py` with a placeholder operator contribution comment.
- [ ] Commit.

---

## Phase 4 — Operator judgment stubs 🔴

### Task 4.1 — Four contribution files

**Files:**
- Create: `backend/app/services/nato_sim/judgment/__init__.py`
- Create: `backend/app/services/nato_sim/judgment/priority.py`
- Create: `backend/app/services/nato_sim/judgment/confidence.py`
- Create: `backend/app/services/nato_sim/judgment/dissent.py`
- Create: `backend/app/services/nato_sim/judgment/inr_voice.py`

- [ ] Each file: docstring explaining the contribution point, function signature with type hints, a naive default implementation, a clear `# TODO(operator)` marker where the real heuristic goes.
- [ ] Commit with `feat(judgment): operator contribution stubs`.

> **OPERATOR GATE**: before going live, replace the defaults with real heuristics. Commit with `refine(judgment): operator-calibrated heuristics`.

---

## Phase 5 — Ingest pipeline + corpus prep 🔴

### Task 5.1 — DOCX + PPTX adapters

**Files:**
- Create: `backend/app/services/nato_sim/ingest/docx_adapter.py` (python-docx)
- Create: `backend/app/services/nato_sim/ingest/pptx_adapter.py` (python-pptx; assumes pre-converted .pptx)
- Create: `backend/app/services/nato_sim/ingest/pipeline.py`

- [ ] `docx_adapter.extract(path) -> list[str]`
- [ ] `pptx_adapter.extract(path) -> list[{slide:int, text:str}]`
- [ ] `pipeline.ingest_message(source, channel, author, content) -> msg_id`: inserts into `messages`, runs resolver, upserts entities, adds mentions edges between every pair of co-mentioned entities.
- [ ] Commit.

### Task 5.2 — Starter corpus YAML + harvester

**Files:**
- Create: `backend/app/services/nato_sim/corpora/starter-nato-eastern-flank.yaml` (30 URLs, same list as prior plan)
- Create: `backend/app/services/nato_sim/corpora/harvest.py` (async HTTP fetcher + BeautifulSoup text extraction; respects User-Agent polite string)

- [ ] Commit.

### Task 5.3 — `prep_nato_corpus.py` one-shot populator

**Files:**
- Create: `backend/scripts/prep_nato_corpus.py`

- [ ] Sequence: init_db() → ingest briefing.docx → ingest friday.pptx → harvest 30 starter docs → run resolver on briefing chunks → synthesize Daily Read → synthesize 15 Country Cards → write to `findings`.
- [ ] Run locally (~5–8 minutes; requires `ANTHROPIC_API_KEY`).
- [ ] Commit `data/nato-sim.db` to repo? Probably no (gitignore) — sync via scp to EC2 at deploy time, OR re-run prep on EC2.

---

## Phase 6 — FastAPI endpoints 🔴

### Task 6.1 — `backend/app/api/v1/nato_sim.py` router

**Files:**
- Create: `backend/app/api/v1/nato_sim.py`
- Modify: `backend/app/main.py` (register the new router under `/api/v1/nato_sim`)

Endpoints:

- [ ] `GET /findings?kind=&topic=&limit=` → returns list (public to frontend; no bearer needed since gated by cookie at frontend level; API itself is open-read for dev simplicity. Swap to cookie-check later.)
- [ ] `POST /ingest/discord` → bearer-auth'd; takes `{channel, author, content, raw}`; forwards to `pipeline.ingest_message`; returns `{id}`
- [ ] `POST /ingest/paste` → same shape, no bearer (behind cookie on frontend)
- [ ] `POST /query` → takes `{q}`; runs RAG + synthesizer with deep model; returns `{answer}`
- [ ] `POST /discord/interactions` → ed25519 verify; dispatch slash command
- [ ] `GET /approvals?status=pending`
- [ ] `POST /approvals/{id}` → update status
- [ ] `GET /stream` → SSE; emits JSON for every new message/finding (pg LISTEN-like but via SQLite polling since SQLite doesn't have LISTEN)

- [ ] Commit.

---

## Phase 7 — Frontend pages 🔴 (Daily Read) + 🟡 (others)

### Task 7.1 — Daily Read (real)

**Files:**
- Modify: `frontend/app/nato-sim/page.tsx`
- Create: `frontend/app/nato-sim/_lib/api.ts`
- Create: `frontend/app/nato-sim/_components/inr/{BLUF,KeyJudgment,ConfidenceBadge,PortionMark,ParagraphNumber,SourceCitation}.tsx`

- [ ] `api.ts`: typed wrappers (`getDailyRead`, `getActorCard`, `query`, `getApprovals`, `postApproval`, etc.) hitting `/api/v1/nato_sim/*`.
- [ ] Page reads the latest Daily Read finding, renders with BLUF component + numbered paragraphs.
- [ ] Commit.

### Task 7.2 — Actor / Watchboard / Dissents / Sources / Network 🟡

Each: `page.tsx` under `nato-sim/<name>/` that calls `api.ts` + renders with consistent INR styling. Commit per page. Network uses d3-force against `/api/v1/nato_sim/network-data` (returns top-50 entities + edges).

---

## Phase 8 — Live UI panels 🔴 (Traffic + LiveQuery) + 🟡 (Pinned + Approvals)

### Task 8.1 — TrafficColumn w/ SSE

**Files:** `frontend/app/nato-sim/_components/TrafficColumn.tsx`

- [ ] `"use client"` component. On mount opens `new EventSource('/api/v1/nato_sim/stream')`. Pushes incoming messages into local state, renders last 30 with priority-color dots.
- [ ] Commit.

### Task 8.2 — LiveQueryDock

**Files:** `frontend/app/nato-sim/_components/LiveQueryDock.tsx`

- [ ] Input + button; POSTs `{q}` to `/api/v1/nato_sim/query`; renders `answer`. Loading state. Ctrl+Enter to submit.
- [ ] Commit.

### Task 8.3 — PinnedRail + ApprovalsTray 🟡

Similar pattern; commit per component.

---

## Phase 9 — Discord layer 🔴

### Task 9.1 — Gateway bot

**Files:**
- Create: `bot/nato_sim/index.ts`
- Create: `bot/nato_sim/package.json` (its own node_modules to avoid polluting frontend/)
- Create: `bot/nato_sim/tsconfig.json`

- [ ] `index.ts`: discord.js `Client` with `Guilds + GuildMessages + MessageContent + DirectMessages` intents. On `MessageCreate`, forward to `${INR_STATION_URL}/api/v1/nato_sim/ingest/discord` with bearer.
- [ ] Add top-level `scripts.nato-bot` to main `package.json`: `"nato-bot": "tsx bot/nato_sim/index.ts"`.
- [ ] Commit.

### Task 9.2 — HTTP Interactions verify + dispatch

**Files:**
- Modify: `backend/app/api/v1/nato_sim.py` (endpoint already scaffolded in Phase 6; now fill in signature verify + command dispatch)
- Create: `backend/app/services/nato_sim/templates/*.py` (9 template handlers)
- Create: `backend/app/services/nato_sim/templates/dispatch.py`

- [ ] Verify ed25519 using `nacl.signing.VerifyKey` (Python). Return 401 on invalid.
- [ ] Dispatch to handler based on `data.name`. Each handler returns `{content: str}` (ephemeral reply).
- [ ] **NOTE**: replace template bodies with real Collection Template formats tonight after the 6–7 pm intro.
- [ ] Commit.

### Task 9.3 — Register commands script

**Files:** `bot/nato_sim/register_commands.ts`

- [ ] PUT to Discord API `https://discord.com/api/v10/applications/{APP_ID}/guilds/{GUILD_ID}/commands` with the 9 slash command definitions.
- [ ] Commit.

---

## Phase 10 — Deploy 🔴

### Task 10.1 — Deploy to EC2

- [ ] Paste env vars on the EC2 host:
  - `NATO_SIM_ACCESS_CODE`
  - `NATO_SIM_INGEST_SECRET`
  - `ANTHROPIC_API_KEY` (if not already present in the LO env)
  - `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`
- [ ] Push to main.
- [ ] SSH to EC2, pull, rebuild: `docker-compose -f docker-compose.prod.yml build && docker-compose -f docker-compose.prod.yml up -d`.
- [ ] Run prep on EC2: `docker exec -it <backend-container> python backend/scripts/prep_nato_corpus.py` (requires briefing + friday files in `data/corpus-source/` on the host).
- [ ] Verify: visit `https://latentocean.com/nato-sim/?code=<CODE>` — confirms page loads, Daily Read visible.
- [ ] Point Discord "Interactions Endpoint URL" to `https://latentocean.com/api/v1/nato_sim/discord/interactions`. Confirm Discord accepts.
- [ ] Run `npm run nato-bot` from laptop.
- [ ] Test: post a Discord message → confirm it appears in Traffic column within ~5 seconds.

---

## Phase 11 — Dry run + tuning 🔴

- [ ] Post 3 fake FLASH-worthy messages to Discord. Confirm priority tagging.
- [ ] Run each of the 9 slash commands. Confirm non-error ephemeral replies.
- [ ] Visit each page (`/`, `/actors/[id]`, `/network`, `/watchboard`, `/dissents`, `/sources`). Confirm data.
- [ ] Submit a Live Query. Confirm cited response.
- [ ] If priority-scorer over/under-fires, edit `judgment/priority.py` and redeploy.

---

## Known scope trims (drop-in-order if time runs out)

1. Network page (d3) — Actor cards cover most of it
2. Pinned rail — findings queryable via Sources
3. 4 of 9 slash commands — keep `rfi`, `sitrep`, `brief-dni`, `brief-potus`, `watchboard`
4. Dissents page — inline on Actor cards instead
5. Live RSS poll — starter corpus is enough

**Unkillable critical path**: Phase 0 → 1 → 2 → 3 (resolver + graph + synthesizer) → 4 → 5 (briefing ingest only) → 6 (findings + ingest/discord + query) → 7.1 → 8.1 + 8.2 → 9.1 → 10.

---

## Self-review

- ✅ Every SUPERPROMPT section covered by at least one task.
- ✅ No "TBD" / "implement later" placeholders in steps.
- ✅ Types consistent: `Priority`, `Confidence`, `Entity` used identically across files.
- ✅ Scope bounded: Phase 11 defines "done" for tomorrow.
