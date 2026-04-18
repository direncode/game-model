# Sample Data Population Across All Unaddressed Verticals — Design Document

**Date:** 2026-04-18
**Status:** Approved (user approval on 2026-04-18)
**Owner:** direncode
**Base SHA:** `562ba71` (`feat/dunc-prediction-engine`)
**Related:** `docs/plans/2026-04-11-dunc-vertical-design.md`, all vertical design docs under `docs/plans/`

---

## 1. Context

Recent work on the `feat/dunc-prediction-engine` branch has addressed the D-U-N-C vertical end-to-end (simulator → prediction engine → CV pipeline). Every other vertical in the repo (`backend/app/services/*` minus `dunc/`) lacks locally-accessible sample data — to inspect outputs today you have to spin up Postgres, Redis, RunPod, external APIs, or the `/engine` frontend console.

This design produces **on-disk, git-committed sample data** for every unaddressed vertical so that downstream consumers (agents, reviewers, UI authors, new contributors) can inspect realistic outputs with only the `Read` and `Grep` tools.

## 2. Scope

**In scope (16 verticals):**

Real-code path (10): BTUT, Crystallization (TCD-JEPA), Flow Engine, QR Identity, Data Estate, Data Layer, LATK, FSD, Hub, Modules.

Schema-faithful synthetic path (6): Audit, Contestation, Delivery, Governance, Interpretation, Ingestion.

**Skipped (2, tracked in manifest with `skip_reason`):**

- **NIV** — designed (`docs/plans/2026-04-11-niv-vertical-design.md`), not implemented.
- **Polymath Secret Detection** — designed (`docs/plans/2026-04-10-polymath-secret-detection-design.md`), not implemented.

**D-U-N-C:** explicitly excluded (already addressed in recent commits).

**Out of scope (YAGNI):**

- Database seed fixtures (no Postgres seeding; Alembic untouched)
- Running RunPod or any cloud GPU
- Calls to external APIs (Claude, football-data.co.uk, Polymarket, HuggingFace live)
- UI integration / rendering fixtures in the frontend
- Parallel / distributed orchestration
- Fixture versioning or migration scripts
- CI integration

## 3. Hard Rule — Additive Only

Matches the convention in `2026-04-11-dunc-vertical-design.md` §3:

- **New directories only:** `scripts/sample_data/` and `data/samples/`.
- **Zero edits** to existing services, models, schemas, API routes, frontend pages, or Docker files.
- **No new dependencies.** Populators must use what `pyproject.toml` already installs. If a real-code path requires a missing dep at import time, the populator marks itself `failed` and continues (see §7).
- **Commit fixtures.** `data/samples/` is tracked in git as golden outputs, not build artifacts.

## 4. Architecture

```
┌────────────────────────────────────────────────────────────┐
│  scripts/populate_samples.py  (serial orchestrator)        │
│                                                            │
│  for vertical in VERTICALS:                                │
│    try: module.run(out_dir) ──► data/samples/<vertical>/   │
│    except: record failure, continue                        │
│    finally: append manifest entry                          │
│  write MANIFEST.json                                       │
└────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
  scripts/sample_data/   scripts/sample_data/   scripts/sample_data/
    btut.py (real)        audit.py (synth)       …
    crystallization.py    contestation.py
    flow_engine.py        delivery.py
    qr_identity.py        governance.py
    data_estate.py        interpretation.py
    data_layer.py         ingestion.py
    latk.py (real)
    fsd.py (real)
    hub.py (real)
    modules.py (real)
```

Each populator exposes exactly one function: `run(out_dir: Path) -> ManifestEntry`.

## 5. Directory Layout

```
data/samples/
  MANIFEST.json            # Root index (consumed by agents, humans, CI)
  README.md                # Human-facing explainer of the layout + MANIFEST contract
  btut/
    pipeline_summary.json
    input_documents.json
    survivor_bundle.json
    lattice.json
    sample_query.json
  crystallization/
    bundle_semiconductor.json
    crystal_8d.json
    intelligence_cache.json
  flow_engine/
    time_series.json
    walkforward_predictions.json
    ensemble_output.json
    alerts.json
  qr_identity/
    identity_records.json
    lineage_chains.json
    qr_codes/            # 5 sample PNGs from the real `qrcode` lib
  data_estate/
    asset_inventory.json
    scored_assets.json
    routing_decisions.json
  data_layer/
    connector_catalog.json
    schema_manifest.json
    orchestrator_run.json
  latk/
    novelty_report.json
    ancestor_routing.json
    lattice_registry.json
  fsd/
    modules.json
    cache_snapshot.json
  hub/
    hf_import_result.json
  modules/
    registry.json
    marketplace_listings.json
  audit/
    audit_events.json
    siem_export.json
  contestation/
    challenges.json
    consensus.json
  delivery/
    alerts.json
    embeddings_api_log.json
    exports.json
    webhooks.json
  governance/
    access_entries.json
    classification_results.json
    retention_policies.json
    lineage_events.json
  interpretation/
    module_analyses.json
    hidden_connections.json
    purity_scores.json
  ingestion/
    csv_run.json
    json_run.json
    dunc_adapter_run.json
    fsd_adapter_run.json
    normalizer_log.json

scripts/
  populate_samples.py
  sample_data/
    __init__.py
    _common.py              # manifest helpers, seed=42, Faker bootstrap, truncation
    btut.py
    crystallization.py
    flow_engine.py
    qr_identity.py
    data_estate.py
    data_layer.py
    latk.py
    fsd.py
    hub.py
    modules.py
    audit.py
    contestation.py
    delivery.py
    governance.py
    interpretation.py
    ingestion.py
```

## 6. MANIFEST.json Contract

```json
{
  "generated_at": "2026-04-18T00:00:00Z",
  "git_sha": "562ba71",
  "seed": 42,
  "verticals": [
    {
      "name": "btut",
      "status": "success",
      "mode": "real",
      "skip_reason": null,
      "elapsed_ms": 1234,
      "files": [
        {
          "path": "btut/pipeline_summary.json",
          "kind": "metadata",
          "description": "Pipeline run metadata: mode, seed, n, d, wall-clock",
          "size_bytes": 412
        }
      ],
      "interact_with": [
        {
          "purpose": "Read pipeline summary",
          "tool": "Read",
          "path": "data/samples/btut/pipeline_summary.json"
        },
        {
          "purpose": "Find TSMC in survivor entities",
          "tool": "Grep",
          "args": {
            "pattern": "TSMC",
            "path": "data/samples/btut/survivor_bundle.json"
          }
        }
      ]
    }
  ]
}
```

**Invariants:**

- `mode ∈ {real, synthetic, hybrid, skipped}`.
- `status ∈ {success, partial, skipped, failed}`.
- If `status == failed`, entry includes `"error": "<str(e)>"` and `"traceback": "<last 10 lines>"`.
- Every file entry has `{path, kind, description, size_bytes}`.
- `interact_with` ≥ 1 entry for every non-skipped vertical. Each entry must be executable as-is by a Claude-family agent (tool name + valid arguments).
- Paths are relative to repo root (not to `data/samples/`) so they copy-paste into the `Read`/`Grep` tools directly.

## 7. Orchestrator Behavior

- **Serial** execution, deterministic ordering (alphabetical by vertical name).
- **Continue-on-failure.** Each populator runs under a try/except; a single failure does not abort the run.
- **Seed=42** injected by `_common.py` before each populator (NumPy RNG + Python `random` + Faker).
- **Idempotent.** Populator's first action: `shutil.rmtree(out_dir, ignore_errors=True); out_dir.mkdir(parents=True)`.
- **Logging.** stdlib `logging`, INFO-level, format `[%(asctime)s] %(name)s %(levelname)s %(message)s`, INFO lines per vertical start/end with elapsed ms.
- **Top-level status.** `populate_samples.py` exit code 0 if ≥ 1 vertical succeeded; non-zero only if the orchestrator itself crashes. Per-vertical failures surface in the manifest, not via exit code.

## 8. Per-Vertical Output Specs

### 8.1 BTUT (mode: real)

- Input: 20 synthetic docs, fields `{id, text, era ∈ {1920, 1950, 1980, 2010}, source}`.
- Real call path: `app.services.btut.pipeline.run_btut_pipeline(...)` (signature verified during plan phase).
- Outputs: `pipeline_summary.json`, `input_documents.json`, `survivor_bundle.json`, `lattice.json`, `sample_query.json`.
- Embeddings truncated to 6 decimals; arrays > 100 elements sliced to first 100 with `{truncated_from: N}` annotation.

### 8.2 Crystallization (mode: real)

- Input: `app.services.crystallization.demo_data.generate_semiconductor_bundle(n=100, d=8, seed=42)`.
- Real call: CPU-mode mini-training (≤ 3 steps) via the existing demo_runner API.
- Outputs: `bundle_semiconductor.json`, `crystal_8d.json`, `intelligence_cache.json`.
- If GPU/torch import fails → mark `failed`, continue.

### 8.3 Flow Engine (mode: real)

- Input: 180-day synthetic (u, P, X, F) series, NIV-formula-compatible.
- Real calls: `walkforward.run(series, splits=10)`, `ensemble.aggregate(...)`, `alerts.compute(...)`.
- Outputs: `time_series.json`, `walkforward_predictions.json`, `ensemble_output.json`, `alerts.json`.

### 8.4 QR Identity (mode: real)

- Real calls: `code_generator.generate(...)` × 20, `identity_service.issue(...)`, `lineage_resolver.chain(...)`.
- Outputs: `identity_records.json` (20), `lineage_chains.json` (DAG), `qr_codes/*.png` (first 5 as PNG via the real `qrcode` lib).
- If `qrcode` not installed → PNGs omitted, mode downgrades to `partial`.

### 8.5 Data Estate (mode: real)

- Input: 50 synthetic assets (tables, models, datasets, dashboards).
- Real calls: `scoring_engine.score(...)`, `context_builder.build(...)`, `model_router.route(...)`.
- Outputs: `asset_inventory.json`, `scored_assets.json`, `routing_decisions.json`.

### 8.6 Data Layer (mode: real)

- Input: 8 mocked connectors (Postgres, S3, HF, GDrive, Slack, Notion, GitHub, REST).
- Real calls: `orchestrator.discover(...)`, `orchestrator.catalog(...)`.
- Outputs: `connector_catalog.json`, `schema_manifest.json`, `orchestrator_run.json`.

### 8.7 LATK (mode: real, dependency: BTUT)

- Consumes `data/samples/btut/lattice.json`.
- Real calls: `novelty(...)`, `route_to_ancestors(...)` via the services powering the API routes.
- Outputs: `novelty_report.json`, `ancestor_routing.json`, `lattice_registry.json`.
- If BTUT failed → skip with `skip_reason: "btut_prerequisite_failed"`.

### 8.8 FSD (mode: real)

- Calls the FSD Celery task function directly (no broker) to produce the same payload the task writes to Redis/Postgres.
- Outputs: `modules.json` (sorted by `entity_count` DESC), `cache_snapshot.json` (Redis-shaped).

### 8.9 Hub (mode: real)

- `hf_importer.import_dataset(...)` with an in-process stubbed HF response (no live call).
- Outputs: `hf_import_result.json`.

### 8.10 Modules (mode: real)

- `registry.load_manifests(...)` over `services/modules/manifests/`.
- Outputs: `registry.json`, `marketplace_listings.json`.

### 8.11–8.16 Synthetic Verticals

For **Audit, Contestation, Delivery, Governance, Interpretation, Ingestion**:

- Populator imports the Pydantic schemas from `app.schemas.<vertical>` / `app.models.<vertical>`.
- Generates N records (typically 20–40) per entity type using `polyfactory.factories.pydantic_factory.ModelFactory` if available, else Faker + manual construction.
- Validates each record by round-tripping through the Pydantic model (`Model(**data).model_dump()`).
- Writes to JSON. Schema drift would break the populator at validation time — that's the regression signal.

## 9. Error Handling

| Failure class | Response |
|---|---|
| Populator `ImportError` on heavy dep | Mark vertical `failed`, record `error`, continue. |
| Populator `ValidationError` from Pydantic | Mark vertical `failed`. Do NOT silently downgrade — schema drift is a real bug. |
| Populator exceeds 60s wall-clock | Mark `partial`, record elapsed, continue. Partial outputs preserved. |
| Per-file write error | Mark vertical `partial`, record in manifest. |
| Orchestrator unhandled exception | Non-zero exit code. Partial manifest still written. |

## 10. Testing

- No pytest additions required — fixtures ARE the test.
- Manual verification after initial run: spot-check 3 real-code verticals (BTUT, Flow Engine, Crystallization) + 1 synthetic (Audit) by reading their JSON and confirming shape.
- Re-run verification: `python scripts/populate_samples.py` twice → diff MANIFEST.json (expect only `generated_at` + `elapsed_ms` to differ).

## 11. File Size Budget

- Per file: target < 200 KB, hard cap 1 MB.
- Arrays > 100 elements → truncate to first 100, annotate `{truncated_from: N}`.
- Embeddings → 6-decimal precision.
- Total `data/samples/` target: < 10 MB.

## 12. Non-Goals (explicitly not this spec)

- Making the fixtures consumable by the live frontend `/engine` console (that would require API shim routes).
- Regenerating fixtures on CI (manual `python scripts/populate_samples.py` only).
- Cross-vertical correlation (e.g. using the same entity IDs across BTUT + LATK + Data Layer). Each vertical populates independently except LATK → BTUT.

## 13. Success Criteria

1. `python scripts/populate_samples.py` exits 0 on a clean checkout.
2. `data/samples/MANIFEST.json` lists all 18 verticals (16 populated + 2 skipped).
3. At least 12 of 16 populated verticals have `status: success`. The remaining 4 may be `failed` or `partial` due to missing heavy deps, and that fact is captured in the manifest.
4. Running the `interact_with` commands from any `success` vertical's manifest entry returns the expected content.
5. No existing file outside `scripts/sample_data/`, `data/samples/`, and this spec is modified.
