# TCD-JEPA Vertical — Design

**Date:** 2026-04-10
**Status:** Design approved, ready for implementation plan
**Owner:** direncode
**Related:** `backend/app/services/crystallization/`, `backend/app/services/btut/`, `backend/app/services/interpretation/`, `tcd-jepa/`

---

## 1. Context

TCD-JEPA (Topological Crystallization Dynamics for JEPA) is already cloned at `tcd-jepa/` and substantially integrated into Latent Ocean:

- **`tcd-jepa/tcd_jepa/`** ships the full 3-system architecture: `core/system1_encoder.py`, `core/system2_explorer.py`, `core/system3_crystallizer.py`, plus `exploration/` (Langevin, blank-space detector, Fisher metric, trajectory tracker), `topology/` (persistent homology), `modules/` (factory, registry, dynamic predictor).
- **`backend/app/services/crystallization/`** provides an async `TCDJEPAWrapper` around `train_graph.py`, plus `job_manager`, `gpu_manager`, `runpod_client`, `checkpoint_manager`, `nan_guard`, `config_builder`, `results_parser`.
- **`backend/app/services/btut/`** provides a thinning pipeline (tuner, cascade, convergence, threading, magnitude, quality) that emits `(survivors, survivor_edges, quality_scores)`.
- **`backend/app/services/interpretation/`** provides post-crystallization analysis (cross-module analyzer, hidden-connection detector, purity calculator, NL describer).
- **API routes** already exist for `crystallization`, `btut`, `modules`, `fsd`, `latk`.

What does **not** yet exist:

1. A unifying orchestrator that binds `BTUT survivors → TCD-JEPA crystallization → interpretation → persisted routable modules` as a single pluggable object.
2. An incremental/online crystallization path (current wrapper is batch-only, tied to `train_graph.py`).
3. A persisted `ModuleRegistry` so crystallized modules outlive a single job and can be queried, versioned, exported, and sold.
4. A routing/dispatch layer that scores incoming signals against registered modules.
5. Vertical presets (trading, inference, sovereign AI training) with distinct hyperparameters.
6. A module export format (PyTorch bundle / JSON manifest / ONNX stub) for the monetization story.

## 2. Constraint — zero change to working pipelines

**Hard rule: this feature is purely additive.** The following are guaranteed untouched:

- `backend/app/services/btut/**`
- `backend/app/services/crystallization/wrapper.py` and all existing crystallization sidecars
- `backend/app/services/interpretation/**`
- All existing routes under `backend/app/api/v1/` (`crystallization.py`, `btut.py`, `modules.py`, `fsd.py`, `latk.py`)
- `tcd-jepa/**` (read-only; imported via the existing `_TCD_JEPA_PATH` mechanism in `wrapper.py:19-24`)
- All existing DB tables, models, and Alembic migrations
- Celery tasks, websocket handlers, frontend code

Two additive edits are explicitly allowed:

1. **One-line router registration** in `backend/app/main.py` to expose the new endpoints.
2. **One new Alembic migration** that creates the `module_registry` table. No existing table is altered.

Anything else that looks like a change to a working pipeline is a design violation.

## 3. Approach — Facade + persisted ModuleRegistry (Approach B)

`TCDJEPAVertical` is a thin orchestrator composed from the existing services. It owns five stages — `ingest_btut → crystallize → interpret → register → (route | export)` — and delegates each stage to already-working code wherever possible.

The new ML work is limited to one place: the **online/incremental crystallization path**, which calls `tcd_jepa.core.system3_crystallizer.System3Crystallizer` directly to process deltas without re-running `train_graph.py`.

### 3.1 Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                       TCDJEPAVertical                              │
│  (backend/app/services/crystallization/vertical.py)                │
│                                                                    │
│   ingest_btut() ──▶ crystallize() ──▶ interpret() ──▶ register()   │
│         │               │                 │              │        │
│         ▼               ▼                 ▼              ▼        │
│   BTUTSurvivor    TCDJEPAWrapper    interpretation  ModuleRegistry │
│   Bundle          (existing)        _pipeline       (new, Postgres)│
│                         │           (existing)             │      │
│                         │                                  ▼      │
│                   3-system loop                    route() export()│
│                   (system1/2/3)                                    │
└────────────────────────────────────────────────────────────────────┘
         ▲                                                 │
         │                                                 ▼
    BTUT pipeline                                  API: /v1/tcd/*
    (read-only adapter)                            (6 new endpoints)
```

### 3.2 Data contract — BTUT → TCDJEPAVertical

From `backend/app/services/btut/tuner.py:340-349`:

```python
result.survivors          # list[dict]
result.survivor_edges     # list[(src, dst, weight)]
result.quality_scores     # dict from tier-8 audit
```

From `backend/app/services/btut/pipeline.py:390-395`:

```python
{
    "summary": {...},
    "survivors": [{"entity", "cluster", "fingerprint_48bit", "scores": {...}}, ...],
    "embeddings_8d": [...flat float32...],
    "embed_context": {...},
}
```

The `btut_bridge.py` adapter converts either shape into a single normalized input:

```python
@dataclass
class BTUTSurvivorBundle:
    embeddings: np.ndarray           # shape (N, D)
    ids: list[str]                   # length N
    edges: list[tuple[int, int, float]]  # (src_idx, dst_idx, weight)
    metadata: dict                   # quality_scores, cluster_assignments, provenance
```

`TCDJEPAVertical` never reaches into `btut.*` internals; it only consumes `BTUTSurvivorBundle`.

## 4. File layout

| File | Purpose | LOC (est.) | New? |
|---|---|---|---|
| `backend/app/services/crystallization/vertical.py` | `TCDJEPAVertical` orchestrator | ~280 | new |
| `backend/app/services/crystallization/vertical_types.py` | dataclasses & enums | ~90 | new |
| `backend/app/services/crystallization/online.py` | incremental/streaming path | ~160 | new |
| `backend/app/services/crystallization/routing.py` | module dispatcher & scoring | ~140 | new |
| `backend/app/services/crystallization/presets.py` | trading / inference / sovereign presets | ~110 | new |
| `backend/app/services/crystallization/export.py` | module export formats (pt / json / onnx stub) | ~90 | new |
| `backend/app/services/crystallization/btut_bridge.py` | BTUT output → `BTUTSurvivorBundle` | ~80 | new |
| `backend/app/models/module_registry.py` | SQLAlchemy model | ~60 | new |
| `backend/alembic/versions/<rev>_module_registry.py` | additive migration | ~50 | new |
| `backend/app/schemas/tcd_vertical.py` | Pydantic schemas | ~110 | new |
| `backend/app/api/v1/tcd_vertical.py` | 6 REST endpoints | ~220 | new |
| `backend/app/main.py` | register new router (1-line additive edit) | +2 | edit |
| `tests/services/crystallization/test_vertical.py` | orchestrator unit tests | ~180 | new |
| `tests/services/crystallization/test_btut_bridge.py` | adapter round-trip | ~120 | new |
| `tests/services/crystallization/test_routing.py` | routing unit tests | ~110 | new |
| `tests/api/test_tcd_vertical_endpoints.py` | endpoint smoke tests | ~200 | new |

**Total: ~2,000 LOC including tests, 15 new files, 1 two-line additive edit.**

## 5. Core types (`vertical_types.py`)

```python
class VerticalPreset(str, Enum):
    TRADING   = "trading"
    INFERENCE = "inference"
    SOVEREIGN = "sovereign"
    GENERIC   = "generic"

@dataclass
class BTUTSurvivorBundle:
    embeddings: np.ndarray
    ids: list[str]
    edges: list[tuple[int, int, float]]
    metadata: dict

@dataclass
class CrystallizedModule:
    id: str
    vertical: VerticalPreset
    module_type: Literal["attractor", "cycle", "boundary"]
    centroid: np.ndarray
    members: list[str]
    purity: float
    quality_score: float
    provenance_job_id: str | None
    created_at: datetime

@dataclass
class RoutingDecision:
    module_id: str | None
    score: float
    reason: str

class TCDVerticalError(Exception):
    def __init__(self, message: str, stage: str):
        super().__init__(message)
        self.stage = stage
```

## 6. Online / incremental crystallization (`online.py`)

The one piece of real ML surface area. Keeps a persistent `System3Crystallizer` hydrated from the latest checkpoint, accepts delta bundles, and runs sliding-window persistent homology:

1. Load checkpoint → warm `System3Crystallizer` + `TrajectoryTracker`.
2. On `push(bundle)`: append new points to the tracker with a ring-buffer window.
3. Recompute persistence diagram on the window only.
4. Compare against cached previous diagram → emit novel H₀/H₁/H₂ features.
5. Instantiate modules for novel features; bump purity on existing ones.

The delta-detection heuristic (step 4) is the **first learning-mode contribution point** (see §10).

## 7. Routing (`routing.py`)

Pure-Python, synchronous, no GPU. Given a signal embedding `s ∈ ℝᴰ` and the current `ModuleRegistry` contents:

1. For each registered module compute `score_module(s, module)`.
2. Return the top-k `RoutingDecision`s (default k=1).
3. Empty registry → `RoutingDecision(module_id=None, score=0.0, reason="empty_registry")`. **Never raises.**

Scoring function is the **second learning-mode contribution point** (see §10).

## 8. API surface (`api/v1/tcd_vertical.py`)

```
POST   /v1/tcd/verticals                    create TCDJEPAVertical session
POST   /v1/tcd/verticals/{id}/crystallize   run batch crystallization from a BTUT job
POST   /v1/tcd/verticals/{id}/incremental   push a delta bundle (online path)
GET    /v1/tcd/verticals/{id}/modules       list modules (filters: vertical, min_purity, min_quality)
POST   /v1/tcd/verticals/{id}/route         route a signal embedding to best module(s)
GET    /v1/tcd/modules/{module_id}/export   export a module (format=pt|json|onnx)
```

All endpoints guarded by existing `require_permission(...)` from `backend/app/core/permissions.py` — same auth model as the rest of `/v1/*`, no new auth code.

## 9. Error handling

- Every `TCDJEPAVertical.*` method wraps exceptions in `TCDVerticalError(message, stage=...)` where `stage ∈ {ingest, crystallize, interpret, register, route, export}`.
- NaN guard: reuse `crystallization/nan_guard.py` unchanged.
- GPU OOM during crystallization: fall back to CPU with a warning (same behavior as `wrapper.py:122-129`).
- Registry conflict on re-run: dedupe on `(provenance_job_id, module_hash)` — no ghost rows.
- Empty registry in `route()`: return sentinel decision, never raise.
- Export of nonexistent module: 404 at API layer, `ModuleNotFound` at service layer.

## 10. Learning-mode contribution points

Four places where domain instinct matters more than engineering. Each is a prepared file with full surrounding context, function signature, comments, and a clear `TODO` marker. Each is 5-10 lines of actual logic.

1. **`online.py::detect_novel_features(old_diagram, new_diagram) -> list[PersistenceFeature]`**
   Decide when a homology feature is "new enough" to spawn a module. Bottleneck distance threshold? Persistence lifetime filter? Combination? This is a correctness-critical call for the online path.

2. **`routing.py::score_module(signal: np.ndarray, module: CrystallizedModule) -> float`**
   Given a signal and a module centroid+radius+purity, produce a routing score. Pure cosine? Cosine × purity? Distance-penalized? Affects every routing decision in production.

3. **`presets.py::TRADING` preset dict**
   Which hyperparameters matter for the trading vertical? Langevin temperature, homology max-dim, prune threshold, Langevin step count, Langevin noise scale. Sets the default for the first real use case.

4. **`export.py::to_pytorch_bundle(module: CrystallizedModule) -> bytes`**
   What goes in the exported bundle? State dict only? State dict + routing metadata + signed manifest + purity score? Shapes the monetization product.

For everything else — plumbing, endpoints, schemas, registry model, adapter, orchestrator composition — the implementer writes the code directly. No meaningful choice to make.

## 11. Testing strategy

- **Unit** (`test_vertical.py`): mock `TCDJEPAWrapper` and `interpretation_pipeline`; verify orchestration order, error wrapping, stage tagging.
- **Unit** (`test_btut_bridge.py`): real BTUT fixture (smallest possible) → `BTUTSurvivorBundle` → assert shape, id order, edge preservation.
- **Unit** (`test_routing.py`): cosine scoring, purity-weighted scoring, empty registry sentinel, top-k tie handling.
- **Integration** (`test_tcd_vertical_endpoints.py`): all 6 endpoints hit against a SQLite test DB; assert no 500s, auth enforcement, schema validation.

**Zero ML training runs in tests.** The wrapper is mocked. Persistent homology is stubbed to return fixed diagrams. This keeps CI fast and deterministic.

## 12. Monetization fit (triple vertical)

- **Data vertical** — `BTUTSurvivorBundle` is the contract; BTUT-thinned corpora become inputs to TCD-JEPA crystallization at scale.
- **Finance vertical** — `VerticalPreset.TRADING` + `routing.route(signal)` is the dispatch layer for trading AI; modules are signal-specific, interpretable, and versioned.
- **AI vertical** — `export.to_pytorch_bundle(...)` + `ModuleRegistry` is the "module factory" surface for selling crystallized modules and inference to hyperscalers / MCP servers / sovereign AI builds.

## 13. Out of scope for this design

- Live routing service / Celery beat scheduler (deferred to a future "Approach C" follow-up if monetization validates).
- Frontend dashboard surface for modules (exists already via `modules.py` API; a vertical-specific view is a separate design).
- Cross-vertical module transfer / fine-tuning (explicitly a future extension).
- Websocket / SSE streaming for incremental results (the incremental endpoint returns synchronously in v1).
- GPU quota / billing enforcement on the incremental path.

---

**Next step:** invoke `superpowers:writing-plans` to produce the detailed implementation plan from this design.
