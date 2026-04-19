# /engine Offline Sample Mode + Legend Runs — Design

**Date:** 2026-04-18
**Status:** Approved
**Owner:** direncode
**Timebox:** 30 minutes end-to-end.

## Goal

Replace the fake hardcoded `/engine` sample data (10,482 fake entities, $0.12 fake cost) with a selector over real, pre-cached pipeline results already on disk under `scripts/cross_era_analysis/output/` and `scripts/results/`.

## Scope

**In:** 11 legend datasets curated from existing caches. Frontend selector on `/engine`. Curator script that writes `ConnectResult`-shaped JSON per legend to `frontend/data/legends/<name>.json`. Keep the existing simulated reduction-animation (UX theater).

**Out:** Running any new pipelines (Phase 2). Cross-vertical legend runs (Phase 2). Backend API routes. RunPod. Large corpus reprocessing.

**Additive only:** no existing services or routes touched.

## Legend catalog

| Legend ID | Source file | Survivors |
|---|---|---|
| `edgar` | `scripts/cross_era_analysis/output/edgar_btut_result_v2.json` | 499 |
| `heterogeneous` | `scripts/cross_era_analysis/output/heterogeneous_btut_result_v2.json` | 595 |
| `polymath` | `scripts/cross_era_analysis/output/polymath_btut_result_v2.json` | 1,195 |
| `latk_physics` | `scripts/cross_era_analysis/output/latk_physics_btut_result_v2.json` | ? |
| `latk_mini` | `scripts/cross_era_analysis/output/latk_mini_btut_result_v2.json` | ? |
| `linguistics` | `scripts/cross_era_analysis/output/linguistics_btut_result_v2.json` | ? |
| `patents` | `scripts/results/patents_superpower_result.json` | 937 |
| `tesla` | `scripts/results/tesla_superpower_result.json` | ? |
| `pubmed` | `scripts/results/pubmed_superpower_result.json` | ? |
| `climate` | `scripts/results/climate_superpower_result.json` | ? |
| `comtrade` | `scripts/results/comtrade_superpower_result.json` | ? |

## Files created / modified

**Created:**
- `scripts/publish_legends.py` — reads each source file, transforms to `ConnectResult`, writes `frontend/data/legends/<id>.json` + `frontend/data/legends/manifest.json`.

**Modified:**
- `frontend/components/connect/ConnectFlow.tsx` — add legend selector, replace `generateSampleSurvivors/Connections` with dynamic import of the selected legend.
- `frontend/app/engine/page.tsx` — minor: optionally pass selected-legend name into the header badge.

## `ConnectResult` target shape (unchanged — already consumed)

```ts
{
  database_name: string;      // legend display name
  survivors: Survivor[];      // mapped from source.survivors
  clusters: number;           // source.summary.clusters or n_clusters
  coverage: number;           // source.summary.reconstruction.coverages["1.0"] or 1.0
  cost: string;               // "$0.00"
  wall_time: string;          // f"{source.summary.wall_seconds:.1f}s"
  total_entities: number;     // source.summary.total_entities or input_count
  connections: Connection[];  // derived from source edges when available, else []
}
```

Survivor mapping:
- `name` ← `survivor.entity.name` (or `survivor.name` for older shape)
- `type` ← `survivor.entity.type` (or `survivor.type`)
- `anomaly_score` ← `survivor.scores.anomaly` (or `survivor.anomaly_score`)
- `cluster` ← `survivor.cluster`
- `embedding` ← `survivor.embedding` if present, else 4-D scores vector

**Truncation:** survivors array truncated to first 300 to keep each JSON under 500 KB. `truncated_from: N` annotation preserved.

## Manifest schema

```json
{
  "legends": [
    {"id": "edgar", "display_name": "SEC EDGAR", "survivors": 300, "total_entities": 10482,
     "path": "legends/edgar.json", "description": "SEC EDGAR filings corpus"},
    ...
  ]
}
```

Used by the frontend selector to render labels.

## UI: legend selector

Button group or minimal dropdown inserted into `ConnectFlow` next to the existing "Sample data" button, visible only in the `input`/`connect` phase. Selecting a legend → fetches `/data/legends/<id>.json` (Next.js serves `frontend/data/` at `/_next/static/…` via build-time import) → `onComplete` fires with the parsed legend → intelligence phase renders.

Mechanism: a **static manifest import** (`import manifest from '@/data/legends/manifest.json'`) so no runtime fetch needed; legend payload is imported dynamically when selected via `await import('@/data/legends/edgar.json')`. Next.js bundles them.

## Non-goals

- Backend API route (everything is static imports)
- Dataset upload UI
- Legend comparison view
- Regenerating legends on frontend build

## Success criteria

1. `python scripts/publish_legends.py` writes 11 `legends/<id>.json` files + `manifest.json`.
2. `/engine` renders a selector listing all 11.
3. Clicking any legend loads its data into the intelligence phase with real survivors.
4. The "SAMPLE" badge still shows; the legend display name appears in the header.
5. No hardcoded fake data remains in `ConnectFlow.tsx`.
