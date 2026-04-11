# Latent Ocean Data Layer — Design

**Date:** 2026-04-10
**Status:** Approved, ready for implementation
**Author:** Claude (Opus 4.6) + user brainstorm session

## Context

The repo already ships ~70% of a working data-reduction pipeline:

- `backend/app/services/btut/pipeline.py` — PreFilter → MiniLM embed → 8D random projection → multi-resolution threading → 3-axis scoring → stratified selection.
- `backend/app/services/btut/adapters/` — adapters for EDGAR, PubMed, Patents, Comtrade, Climate, Tesla.
- `backend/app/services/ingestion/` — normalizer, profiler, validator.
- `backend/app/services/crystallization/` — TCD-JEPA wrapper, GPU manager.
- API endpoints: `btut.py`, `datasets.py`, `latk.py`, `crystallization.py`.

The work in this design does **not** replace any of it. It adds a single unifying facade — `LatentOceanDataLayer` — that routes calls through the existing modules and fills four concrete gaps:

1. A single entry-point class matching the requested API (`ingest` / `apply_btut_tuner` / `project_to_manifold` / `get_survivors` / `export_for_vertical` / `run`).
2. Spherical manifold projection — 8D L2-normalized for compute, 3D S² for display.
3. Vertical export contracts for NIV (finance), TCD-JEPA (AI), and Data (raw sell-through).
4. Cross-source causal linking, with cosine fully wired and three other signals as stubs.

## Non-Goals

- No changes to `btut/`, `ingestion/`, `crystallization/`, or any existing API route.
- No new FastAPI endpoints in this session.
- No DB schema changes, no migrations.
- No changes to the frontend or RunPod pipelines.
- No multi-source orchestration logic beyond pairwise causal linking.

The facade is purely additive: `git rm -rf backend/app/services/data_layer/ scripts/demo_data_layer_edgar.py backend/tests/services/test_data_layer.py` returns the repo to its current state.

## Architecture

### File layout

```
backend/app/services/data_layer/
  __init__.py              exports LatentOceanDataLayer
  core.py                  the facade class
  manifold.py              8D L2-normalize + 3D S² projection
  linking.py               four-signal causal linker scaffold
  verticals.py             export contracts for niv / tcd_jepa / data
  types.py                 dataclasses: IngestResult, BTUTRunResult, etc.

backend/tests/services/
  test_data_layer.py       unit tests + mocked integration + small E2E

scripts/
  demo_data_layer_edgar.py end-to-end EDGAR run writing all 3 vertical exports
```

### Dependency direction

```
NEW data_layer/  ──imports──►  existing btut/, ingestion/, crystallization/
                  (one-way, facade only)
```

Nothing in existing code knows `data_layer` exists.

## Class API

```python
class LatentOceanDataLayer:
    def __init__(
        self,
        budget_dollars: float = 50.0,
        target_survivors: int = 300,
        compute_3d_display: bool = True,
        log_callback: Callable[[str], None] | None = None,
    ) -> None: ...

    def ingest(self, source: str | BaseDatasetAdapter, limit: int = 10_000) -> IngestResult: ...
    def apply_btut_tuner(self, ingest_result: IngestResult | None = None) -> BTUTRunResult: ...
    def project_to_manifold(self, btut_result: BTUTRunResult | None = None) -> ManifoldCoords: ...
    def link_causally(self, other: "LatentOceanDataLayer", threshold: float = 0.75) -> list[CausalLink]: ...
    def get_survivors(self) -> list[Survivor]: ...
    def get_quality_metrics(self) -> QualityMetrics: ...
    def export_for_vertical(
        self,
        vertical_name: Literal["niv", "tcd_jepa", "data"],
        write_path: Path | None = None,
    ) -> dict: ...
    def run(
        self,
        source: str | BaseDatasetAdapter,
        vertical: str | None = None,
        limit: int = 10_000,
        write_path: Path | None = None,
    ) -> dict: ...
```

Methods are stateful: calling `apply_btut_tuner()` without an argument uses the most recent `ingest()` result. Calling `ingest()` a second time cleanly replaces all per-run state (no leakage — tested).

### Supporting dataclasses (`types.py`)

- `IngestResult(source_id, entities, edges, unique_types, fetch_seconds)`
- `BTUTRunResult(summary, survivors, embeddings_8d, embeddings_384d, wall_seconds)`
- `ManifoldCoords(coords_8d_unit, coords_3d_s2, projection_method)`
- `Survivor(entity, cluster, scores, fingerprint, coord_8d, coord_3d)`
- `QualityMetrics(n_input, n_survivors, reduction_ratio, variance_preservation, wall_seconds, estimated_cost_usd)`
- `CausalLink(source_a, source_b, signal, strength)`

## Data Flow

```
source (str | adapter)
  │
  ▼ ingest()
IngestResult { entities, edges, unique_types }
  │
  ▼ apply_btut_tuner()
  │   wraps run_btut_pipeline() from btut/pipeline.py
  │   PreFilter → Embed 384D → Random-project 8D →
  │   Multi-res threading → 3-axis scoring → Stratified selection
BTUTRunResult { summary, survivors, embeddings_8d }
  │
  ▼ project_to_manifold()
  │   (1) coords_8d_unit = L2-normalize(embeddings_8d)   [always]
  │   (2) coords_3d_s2   = PCA(3) → L2-normalize          [if compute_3d_display]
ManifoldCoords { coords_8d_unit, coords_3d_s2 }
  │
  ▼ get_survivors()  (attaches manifold coords to each survivor dict)
  │
  ▼ export_for_vertical("niv" | "tcd_jepa" | "data")
dict payload (returned; optionally JSON on disk)
```

Side branch: `link_causally(other_layer)` runs after `apply_btut_tuner` on both layers.

## Manifold Projection

Two functions in `manifold.py`:

```python
def project_8d_to_unit_sphere(emb_8d: np.ndarray) -> np.ndarray:
    """L2-normalize each row to the unit 7-sphere in R^8."""
    norms = np.linalg.norm(emb_8d, axis=1, keepdims=True) + 1e-10
    return emb_8d / norms

def project_8d_to_s2(emb_8d_unit: np.ndarray, seed: int = 42) -> np.ndarray:
    """PCA to 3D then L2-normalize. For human display only."""
    from sklearn.decomposition import PCA
    pca = PCA(n_components=3, random_state=seed)
    coords_3d = pca.fit_transform(emb_8d_unit)
    norms = np.linalg.norm(coords_3d, axis=1, keepdims=True) + 1e-10
    return coords_3d / norms
```

**Why PCA for the 3D display path, random projection for the 8D compute path:** different objectives. The 8D hypersphere preserves pairwise distances (Johnson–Lindenstrauss) for downstream BTUT scoring and cosine linking. The 3D S² projection is viewed by humans and needs the best variance capture possible — PCA wins there, and the cost is paid once per run.

## Vertical Export Contracts

Each vertical gets a different payload shape:

**NIV (finance):** survivors with full attributes + 8D coords + scores. No 3D.

**TCD-JEPA (AI):** flat embedding matrix + entity IDs + type labels + cluster IDs. Optimized for batch training. Drops per-entity attributes.

**Data (sell-through / audit):** everything. Full ingest result, full BTUT summary, full survivors, both manifold coordinate systems, quality metrics.

All three live in `verticals.py`, dispatched via `EXPORTERS = {"niv": ..., "tcd_jepa": ..., "data": ...}`. See Section 5 of brainstorm for the exact dict shapes.

## Causal Linking Scaffold

Four signals, only cosine fully wired in MVP:

- **cosine** (wired): dot product of L2-normalized 8D coords across two layers. O(n_a * n_b) with numpy matmul. Threshold-based link creation.
- **foreign_key** (stub): will compare keys like `cik`, `pmid`, `patent_id`. Returns `[]`.
- **semantic_field** (stub): will match shared fields like author, company, year. Returns `[]`.
- **url_hierarchy** (stub): will compare URL path prefixes. Returns `[]`.

`link_all(layer_a, layer_b)` runs all four and concatenates.

**Justification for cosine on 8D (not 384D):** The 8D random projection is variance-preserving, so cosine similarity in 8D is a reasonable proxy for 384D similarity. This avoids re-embedding survivors (which would add ~1–2 s/run) and avoids modifying `btut/pipeline.py` to return 384D embeddings (which violates the "don't touch btut/" rule). If fidelity turns out insufficient in practice, we can add an opt-in flag later to re-embed survivors.

## Error Handling

Fail-fast with clear exceptions. No silent fallbacks.

- `UnknownSourceError` — `ingest()` with an unknown source id
- `NoIngestError` — `apply_btut_tuner()` called before `ingest()`
- `NoBTUTResultError` — `project_to_manifold()` called before `apply_btut_tuner()`
- `UnknownVerticalError` — `export_for_vertical()` with an unknown vertical name

## Observability

Optional `log_callback: Callable[[str], None]` passed to `__init__`. The facade emits one structured log line per stage:

```
[data_layer] stage=ingest source=edgar n_entities=12450 wall=2.3s
[data_layer] stage=btut n_survivors=300 reduction=41x wall=18.7s variance=0.87
[data_layer] stage=manifold coords_8d=(300,8) coords_3d=(300,3) wall=0.2s
[data_layer] stage=export vertical=niv bytes=184321 path=scripts/exports/niv/edgar_20260410.json
```

If no callback is provided, logs go to `logging.getLogger("app.services.data_layer")`.

## Testing Strategy

`backend/tests/services/test_data_layer.py`:

1. **Unit — manifold:** synthetic 8D points, verify unit-norm + determinism.
2. **Unit — linking cosine:** craft embeddings with known dot products, assert threshold behavior.
3. **Unit — verticals:** pass a mock state, assert each export dict has expected keys.
4. **Integration (mocked BTUT):** patch `run_btut_pipeline` to return a fixed result, assert facade threads state through all steps correctly.
5. **E2E (real BTUT, small sample):** `limit=200` EDGAR run end-to-end; assert survivors > 0, quality metrics populated, all 3 vertical exports produced.
6. **Regression:** call `ingest()` twice on the same facade; verify second call replaces state cleanly.

## Demo Script

`scripts/demo_data_layer_edgar.py`:

- Creates a `LatentOceanDataLayer` instance with default config.
- Calls `layer.run("edgar", limit=500)`.
- Calls `layer.export_for_vertical(v, write_path=...)` for each of the three verticals.
- Prints a quality metrics table.
- Writes outputs to `scripts/exports/{vertical}/edgar_YYYYMMDD.json`.

## Open Risks

1. **Small-sample statistics in PCA:** if fewer than ~10 survivors, PCA may be degenerate. Mitigation: `project_8d_to_s2` falls back to returning zeros + warning if `n < 4`.
2. **Memory pressure in cosine linking:** `n_a * n_b` matrix. For `target_survivors=300` this is 300×300=90k entries — fine. If ever called with >10k survivors per side, we'd need chunking. Not in MVP scope.
3. **Adapter registration:** `ingest("edgar")` needs a lookup table `str → adapter class`. We'll build a simple `REGISTRY` dict in `data_layer/__init__.py` mapping `"edgar" → EdgarAdapter`, `"pubmed" → PubMedAdapter`, etc. Only EDGAR is wired in MVP; others are commented out but ready to enable.

## Session Deliverable

- All files under `backend/app/services/data_layer/` implemented.
- `backend/tests/services/test_data_layer.py` with ≥6 tests passing.
- `scripts/demo_data_layer_edgar.py` runs end-to-end on real EDGAR data with `limit=500` and writes all 3 vertical exports.
- This design doc committed.
- Commit-ready (single clean commit for the design doc + implementation + tests).
