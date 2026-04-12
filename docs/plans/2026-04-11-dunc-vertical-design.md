# D-U-N-C Tactical Football Intelligence Engine — Vertical Design

**Date:** 2026-04-11
**Status:** Approved (user pre-approved option C + full-session execution)
**Owner:** direncode
**Related:** `backend/app/services/btut/`, `backend/app/services/crystallization/`, `frontend/app/` (vertical pattern)

---

## 1. Context

D-U-N-C turns wearable tracking (GPS/RFID) + tactical events into a live tactical intelligence surface for managers and technical staff. The current problem it solves: wearable data is post-game and underused. D-U-N-C makes it live, tactical, and immediately actionable during matches.

This vertical slots in alongside `btut`, `engine`, `franklin`, `datasets` as a first-class Latent Ocean vertical and is hosted entirely on the Latent Ocean domain. `thebigdunc.com` is a mirror via iframe embed — no code or backend on that side.

## 2. Scope (v0, single session)

**In scope:**

1. **Synthetic match simulator.** 22 player twins + ball, ~10 Hz tick, scripted tactical scenarios (under-run, pressing shift, convergence moment).
2. **Digital twins.** Per-player position, velocity, acceleration, distance, fatigue proxy, zone classification.
3. **Tactical engine.** Windowed BTUT convergence pass over recent tracking windows to surface tactical rhythms; heuristic scenario detection layered on top; pre-crystallized tactical module catalog via existing TCD-JEPA machinery (offline, out of session).
4. **Pluggable `TrackingAdapter`.** Mirrors existing `csv_adapter.py` / `fsd_adapter.py` pattern so real GPS/RFID feeds plug in as a one-file addition later.
5. **REST + WebSocket API** at `/api/v1/dunc`.
6. **Next.js `/dunc` vertical** — pitch view, twin cards, tactical insight feed, Game Approach Window, role switcher, AI agent drawer.
7. **Role-scoped UI.** Manager view vs Technical Staff view driven by a session role claim. No new auth plumbing.
8. **Embed path.** `/dunc/embed/[id]` minimal iframe view + static snippet for `thebigdunc.com`.
9. **Happy-path tests.** pytest for simulator and tactical engine; frontend typecheck.

**Out of scope (deferred, YAGNI):**

- Real LLM calls for AI agents (deterministic templated stub).
- New Alembic migration — v0 matches live in-memory per process (session scope).
- Real vendor wearable integration.
- Heatmaps, passing networks, multi-match replay.
- Production Docker compose changes.

## 3. Hard rule — additive only

Mirroring the convention in `2026-04-10-tcd-jepa-vertical-design.md` §2, this feature is purely additive. No edits to:

- `backend/app/services/btut/**`
- `backend/app/services/crystallization/wrapper.py`
- `backend/app/services/interpretation/**`
- Any existing API route
- Any existing Alembic migration

Exactly one additive edit is allowed: **one-line router registration in `backend/app/api/v1/__init__.py`.**

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        D-U-N-C Vertical                         │
│                                                                 │
│   TrackingAdapter ─▶ MatchSimulator ─▶ DigitalTwinRegistry      │
│          │                                    │                │
│          │                                    ▼                │
│          │                           TacticalEngine            │
│          │                          ┌────┴─────┐               │
│          │                          ▼          ▼               │
│          │                  BTUTConvergence   ScenarioDetector │
│          │                  (windowed call)   (heuristics)     │
│          │                          │          │               │
│          │                          └────┬─────┘               │
│          │                               ▼                     │
│          │                       InsightStream                 │
│          │                               │                     │
│          ▼                               ▼                     │
│   REST /api/v1/dunc           WebSocket /ws/dunc/{match_id}     │
│          │                               │                     │
│          └───────────────┬───────────────┘                     │
│                          ▼                                     │
│              Next.js /dunc vertical                            │
│   (PitchView · TwinCards · InsightFeed · GameApproachWindow ·  │
│    RoleSwitcher · AIAgentDrawer)                               │
│                          │                                     │
│                          ▼                                     │
│            /dunc/embed/[id]  ◀─── iframe ─── thebigdunc.com    │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Backend layout

```
backend/app/services/dunc/
  __init__.py
  adapters.py          # TrackingAdapter ABC + SyntheticAdapter
  simulator.py         # MatchSimulator (22 players + ball, 10 Hz)
  twins.py             # DigitalTwin + DigitalTwinRegistry
  tactical_engine.py   # TacticalEngine (BTUT windowed + scenario hooks)
  scenarios.py         # Scenario detectors (under-run, pressing shift, convergence)
  insights.py          # Insight dataclass + templated generator
  agents.py            # Role-scoped AI agent stub (manager/technical_staff)
  runtime.py           # MatchRuntime: owns loop, broadcasts, lifecycle
  registry.py          # In-memory ActiveMatchRegistry

backend/app/api/v1/dunc.py   # REST + WebSocket endpoints
backend/app/schemas/dunc.py  # Pydantic schemas
backend/tests/services/dunc/
  test_simulator.py
  test_tactical_engine.py
  test_runtime.py
```

Integration with existing BTUT convergence is **read-only**: the tactical engine constructs a small window tensor and calls `ConvergenceDetector.update(...)`, feeding it the last N ticks. BTUT code is untouched.

## 6. Frontend layout

```
frontend/app/dunc/
  layout.tsx           # Dark enterprise shell (nav, role indicator)
  page.tsx             # Landing: match list + "Start Demo Match"
  match/[id]/page.tsx  # Live dashboard
  embed/[id]/page.tsx  # Minimal iframe-friendly view

frontend/components/dunc/
  PitchView.tsx        # SVG pitch with live twins, role zones
  TwinCard.tsx         # Per-player metrics + fatigue gauge
  InsightFeed.tsx      # Scrollable tactical events stream
  GameApproachWindow.tsx  # AI-generated tactical suggestions
  RoleSwitcher.tsx     # Manager | Technical Staff toggle (demo)
  AIAgentDrawer.tsx    # Side drawer with role-scoped assistant
  ScenarioBadge.tsx    # Visual badges for detected scenarios

frontend/lib/dunc/
  api.ts               # Fetch helpers
  ws.ts                # useDuncMatchStream hook (WS client)
  store.ts             # Zustand store for live twin state
  types.ts             # Shared types matching backend schemas
```

## 7. Data contracts

### 7.1 Tick (WS message)

```ts
type DuncTick = {
  match_id: string;
  t: number;              // ticks since kickoff
  clock_sec: number;      // match clock
  ball: { x: number; y: number; vx: number; vy: number };
  players: {
    id: string;
    team: "home" | "away";
    number: number;
    role: string;         // "GK" | "CB" | "LB" | ... | "ST"
    x: number;            // pitch meters, 0..105
    y: number;            // pitch meters, 0..68
    vx: number;
    vy: number;
    speed: number;        // m/s
    distance_m: number;   // cumulative
    fatigue: number;      // 0..1
  }[];
  insights: DuncInsight[];   // any that fired this tick
};
```

### 7.2 Insight

```ts
type DuncInsight = {
  id: string;
  t: number;
  kind: "under_run" | "pressing_shift" | "convergence" | "transition" | "info";
  severity: "info" | "notable" | "critical";
  title: string;
  summary: string;         // templated NL
  actors: string[];        // player ids
  evidence: Record<string, number | string>;
  audience: ("manager" | "technical_staff")[];
};
```

## 8. API surface

```
GET    /api/v1/dunc/health
POST   /api/v1/dunc/matches                 {preset?: "demo"} → MatchSummary
GET    /api/v1/dunc/matches                 → MatchSummary[]
GET    /api/v1/dunc/matches/{id}            → MatchSummary
POST   /api/v1/dunc/matches/{id}/start
POST   /api/v1/dunc/matches/{id}/pause
POST   /api/v1/dunc/matches/{id}/trigger    {scenario: "under_run"|"pressing_shift"|"convergence"}
POST   /api/v1/dunc/agent/query             {role, match_id, question} → AgentReply
WS     /ws/dunc/matches/{id}                streams DuncTick frames
```

## 9. Role scoping

- Frontend has a `RoleSwitcher` that stores `role` in localStorage (`dunc.role`).
- Every API/WS call includes `?role=manager|technical_staff`.
- `InsightFeed` and `AIAgentDrawer` filter by `audience` client-side.
- No new backend auth plumbing; existing `AuditLogMiddleware` still runs.

This is a v0 role shim. Real RBAC lands when D-U-N-C gets Clerk role claims wired in (separate task).

## 10. Testing

- `test_simulator.py` — simulator advances, players stay on pitch, ball constrained, determinism with seed.
- `test_tactical_engine.py` — under-run trigger fires correct insight with correct actors; convergence window produces non-NaN metrics.
- `test_runtime.py` — runtime start/stop/broadcast queue smoke test.
- Frontend: `npm run lint` + `tsc --noEmit` via `next build` smoke.

## 11. Risks & explicit trade-offs

1. **BTUT at 10 Hz.** We do not run full BTUT per tick. We run convergence detection only, on ≤256-point windows, at most once per second. Full crystallization is offline.
2. **In-memory match state.** v0 matches vanish on process restart. Acceptable for demo; persistence lands with the next migration.
3. **Templated "AI" agent.** Zero LLM dependency for v0. `agents.py` exposes a clean `generate_reply(role, context, question)` seam for LLM wiring later.
4. **Embed origin.** `/dunc/embed/[id]` sets `X-Frame-Options: ALLOWALL` (or removes the default DENY) only for that route; all other routes keep default policy. Content Security Policy stays restrictive.
