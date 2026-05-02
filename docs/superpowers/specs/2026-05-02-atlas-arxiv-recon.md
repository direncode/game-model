# Atlas — arXiv — Pre-Implementation Recon

**Date:** 2026-05-02
**Status:** complete; substrate green-light with one re-scoping decision

## Findings

### [BLOCKER → resolved by re-scoping] MAX_CHUNKS = 100

`frontend/lib/range/form.ts:25` defines `MAX_CHUNKS = 100`. Line 69 enforces:

```ts
if (records.length >= CHUNK_SIZE * MAX_CHUNKS) break; // hard ceiling
```

With `CHUNK_SIZE = 5000`, the ceiling is **500,000 records**. The original spec called for 2.5M (Q1 = A). To respect the substrate without lifting this cap, the corpus has been re-scoped to **500k stratified sample across 1991-2025** (Q1 revised: A → C).

Trade-off: "thirty years of scientific discourse" headline is preserved. "All 2.5M abstracts" claim is dropped, replaced with honest "stratified representative sample" disclosure (same pattern DocSouth uses for its 6% coverage).

### [OK] RunPod is invoked once per formation

`form.ts:99-117` shows RunPod is submitted at Stage 4, once per formation, with the first chunk's records only (`records.slice(0, CHUNK_SIZE)`). Cost is bounded — single call per Atlas run, comparable to DocSouth.

### [OK] Chunking is server-side

`startFormation` in `form.ts:41` orchestrates chunking internally via `fingerprintWithFallback`. No browser-driven loop. No connection-drop risk.

### [ACTION ITEM] Public-read endpoint allowlist

`frontend/app/api/range-public/showcase/[slug]/route.ts:20-24` defines an explicit allowlist:

```ts
const ALLOWED: Record<string, string> = {
  docsouth:                  "docsouth.json",
  "docsouth-constellations": "docsouth_constellations.json",
  "docsouth-findings":       "docsouth_findings.json",
};
```

To ship Atlas, three new slugs must be added (`atlas`, `atlas-constellations`, `atlas-findings`). Six-line frontend change. Added as Task 5.0 in the plan.

## Plan revisions

The implementation plan (`docs/superpowers/plans/2026-05-02-atlas-arxiv-plan.md`) is updated as follows:

1. **Phase 1 harvester** gains a stratified-sampling step. After filtering (withdrawn, future-dated), papers are grouped by year. For each year, sorted by `paper_id`, every k-th paper is kept where `k = max(1, n_year / target_per_year)`. Target per year: 14,500 (gives ~440k on years with surplus, all-papers on years with deficit, total ~500k).
2. **Sampling determinism** is part of the reproducibility recipe. Re-runs against the same Kaggle snapshot produce byte-identical NDJSON.
3. **Phase 5 page prose** describes "500k stratified sample, ~14k papers/year, deterministic stride" instead of "all 2.5M abstracts." Headline becomes "Thirty years of scientific discourse, structurally sampled, citable forever."
4. **New Task 5.0**: extend the showcase allowlist in `frontend/app/api/range-public/showcase/[slug]/route.ts`.

## Conclusion

Substrate is green-lit for Atlas v1 under decision C. No `form.ts` changes required. Plan proceeds with the sampling addition.
