# Mine-Sweep — NOAA Bathymetry Substrate Sort vs AWOIS — Design Spec

**Date:** 2026-05-11
**Owner:** Latent Ocean (lsx)
**Status:** approved for implementation
**Reference artifacts:** `/bombe`, `/atlas/arxiv`, `/pulse/uspto-inventors` (the substrate proof-showcase pattern this extends)

## Purpose

Public, citable artifact at `/mine-sweep` demonstrating that the existing TCD-JEPA recursive clustering loop, given only four deterministic per-tile bathymetry features and no context, sorts NOAA multibeam bathymetry tiles such that NOAA-published wreck/obstruction labels concentrate disproportionately in the top fraction of the sort.

Mine-Sweep is the sixth public showcase, deliberately structured as a `/bombe`-pattern *negative-space* artifact ("the substrate doesn't detect mines, it sorts tiles by structural unusualness") rather than a vertical product. It earns substrate-status credibility on a geospatial / undersea-sensing surface that the existing five showcases do not cover, while staying within the verticalless open-core infrastructure framing locked in by [`memory/framing_infrastructure_not_vertical.md`].

Mine-Sweep is also the first showcase shipped under an explicit **B-gate** — a pre-committed pass/fail threshold computed from the substrate's measurement against three baselines, with three possible verdicts (`SHIP_A`, `INCONCLUSIVE`, `SHELVE_A`). The page exists only if the gate passes. If it doesn't, the work product is `docs/commercial/MINE_SWEEP_RESULTS.md` and the substrate-status credit comes from publishing the honest negative result.

## Out of scope

- Mine detection as a binary classification task. The framing locked in by Q-Framing is "sort by structural unusualness," not "mine vs non-mine." There is no public mine-target corpus at any defensible sample size; pursuing it would require classified data we cannot access.
- Multi-modal sensor fusion (magnetometer, chemical, side-scan imagery). Single modality (bathymetry only) is the disciplined claim. Multi-modal is a possible v2 showcase if v1 succeeds.
- Real-time / streaming inference. The corpus is a fixed snapshot, matching `/atlas` and `/pulse`.
- Any claim of military operational readiness, deployment-ready capability, or program-of-record relationship. Explicit negative-space block on the showcase page enforces this.
- Side-scan sonar imagery (NOAA NOS hydrographic survey mosaics). A possible second showcase modality, structurally distinct, separate spec.
- Non-US waters. No equivalent unified public obstruction database exists outside US territorial waters.
- Lifting any feature-count ceiling. The substrate sees exactly four features, full stop, matching the `/atlas` "title + abstract only" and `/pulse` "four signals only" discipline.

## Decisions locked in (clarifying questions)

| Q | Decision | Reason |
|---|---|---|
| Q-Scope | A (showcase) + B (internal R&D), sequenced B → A | R&D measurement gates whether the showcase ships. Matches `/atlas` and `/pulse` precedent of "measure first, page second." |
| Q-Framing | "Sort by structural unusualness" (Framing 1, `/bombe` analog) | Matches the substrate's actual primitive (sort/cluster), uses fully public ground truth, no military claims. |
| Q-Corpus | NOAA Wrecks-and-Obstructions database + NOAA NCEI multibeam bathymetry, Stellwagen Bank National Marine Sanctuary | Highest label density in US public waters, repeatedly-mapped, fully fingerprintable, third-party regulatory ground truth (not researcher-curated). |
| Q-Metric | Top-1% enrichment vs three baselines + AUPRC + curve | Native to `/atlas` and `/pulse` voice ("chance is X, engine matches at Y"). Single headline number plus secondary chart. |
| Q-Baselines | Uniform random (chance) + Z-score on feature-z-space (textbook signal processing) + Isolation Forest (textbook ML) | Pre-empts the strongest reviewer critique ("isn't this just textbook anomaly detection?"). All three computed identically alongside substrate. |
| Q-Gate | Substrate CI lower bound ≥ 5× chance AND substrate mean ≥ 2× best non-substrate baseline | 5× is calibrated against `/atlas`'s ~2.5–4× enrichment; deliberately stricter because anomaly sorting has lower base rate. |
| Q-Modality | Single modality: bathymetry only | Matches `/atlas` ("title + abstract only") and `/pulse` ("four signals only") discipline. Multi-modal is a separate showcase. |
| Q-Tile | 50m × 50m non-overlapping, anchored to Stellwagen boundary SW corner | Tile size balances wreck-signal preservation (10–50m wrecks occupy meaningful fraction) against feature-statistic stability (100 pixels per tile at 5m resolution). |
| Q-Features | Four signals: `residual_rms`, `local_relief`, `slope_std`, `laplacian_std` | Each captures a structurally distinct property; all interpretable in one sentence; all deterministic functions of the depth grid alone. |
| Q-Score | Two-key sort: module size primary (smaller = more unusual), distance to module centroid as tiebreaker | Rarity is the substrate's structural output; within-cluster distance breaks ties. Scalar form: `-log(module_size) + ε × distance_to_centroid`. |
| Q-Substrate-config | `cluster.tcd_recursive_loop`, iters=16, max_modules=256, crystallize_every=2, langevin_steps=30, energy=corpus_mean, seeds=[42,43,44] | max_modules=256 is higher than `/atlas` default of 24 because 880K tiles need finer rarity granularity (~3,400 tiles/module average). |
| Q-CI | t-distribution with 2 df, critical value ≈ 4.303, across 3 seeds | Honest small-sample method. Normal-approximation CIs at 3 seeds is overstatement. |
| Q-Arch | Python harness + declarative `pipelines/mine_sweep.ocean` file the showcase quotes verbatim | Option II from architecture decision. Pipeline file is substrate-status vocabulary-capture vehicle. |
| Q-OCEAN-extension | Add `embed numeric features [...]` primitive to OCEAN stdlib | Required to honestly express bathymetry features in OCEAN. Reusable for future numeric-input showcases. |
| Q-Page-condition | `/mine-sweep` page added to repo only if `summary.json` B-gate verdict = `SHIP_A` | Discipline made structural. If `SHELVE_A` or `INCONCLUSIVE`, the work product is `docs/commercial/MINE_SWEEP_RESULTS.md`. |

## Constraints

- No marketing inflation. Page voice mirrors `/bombe` and `/atlas`: third-person, declarative, no first-person plural, no em dashes in displayed text, no superlatives.
- Mandatory scope/limits negative-space block on the page. States explicitly what the showcase is *not* (not a mine detector, not military, not real-time, not deployment-ready).
- All numbers on the page must trace via SHA-256 manifest to NOAA inputs. Anything not in `summary.json` does not appear on the page.
- The `.ocean` pipeline file must execute end-to-end via the OCEAN runtime and produce byte-identical modules output to the Python harness. Otherwise the showcase blocks.
- B-gate pre-committed before any substrate run. No post-hoc threshold adjustment.
- Three seeds (42, 43, 44) for substrate and Isolation Forest. Z-score baseline is deterministic (no seed). Uniform random uses 100 resamplings to characterize null distribution.
- Reproducibility recipe is the binding artifact: anyone who re-downloads the manifest's NCEI BAGs + AWOIS shapefile and runs the harness must get byte-identical features and statistically-indistinguishable substrate output.
- Substrate compute runs via existing [scripts/experiments/runpod_dispatch.py](../../scripts/experiments/runpod_dispatch.py) pattern, dispatched to RunPod GPU.
- No new frontend infrastructure. Reuses existing showcase page primitives from `/bombe`/`/atlas`.

## Architecture

### Component map and file layout

```
scripts/
  experiments/
    mine_sweep.py                  # orchestrator: ingest -> features -> substrate -> eval -> JSON
    mine_sweep_ingest.py           # NOAA download + SHA-256 manifest
    mine_sweep_features.py         # per-tile deterministic 4-feature extraction
  operators/
    feature/
      bathymetry.py                # NEW: registered operators slope/roughness/detrend-residual
                                   #      (additive to catalog, matches scripts/operators/embed.py shape)
    ocean/
      lexer.py                     # MODIFIED: add 'numeric features' lexer token
      parser.py                    # MODIFIED: route 'embed numeric features [...]' to embed AST
      stdlib/
        substrate.ocean            # MODIFIED: optional helper preset for numeric-feature pipelines

data/
  validation/
    mine_sweep/
      manifest.json                # SHA-256 of every NCEI tile + AWOIS shapefile version
      features.parquet             # extracted features, one row per tile
      features.ndjson              # OCEAN-compatible NDJSON projection of features.parquet
      modules_seed_{42,43,44}.json # substrate output per seed
      results_seed_{42,43,44}.json # per-seed enrichment + 3 baselines
      summary.json                 # aggregated, B-gate verdict

pipelines/
  mine_sweep.ocean                 # ~15-line declarative pipeline the showcase quotes

frontend/
  app/
    mine-sweep/
      page.tsx                     # showcase page (added only if B-gate = SHIP_A)
  lib/
    products/
      data.ts                      # MODIFIED: +1 entry in ALL_SHOWCASES (only if SHIP_A)

docs/
  superpowers/specs/
    2026-05-11-mine-sweep-design.md  # this document
  commercial/
    MINE_SWEEP_RESULTS.md          # internal-facing result writeup (always written, gates page)
```

### Pipeline stages

Eight stages, with effort estimates and explicit gates:

| # | Stage | Effort | Gate to next stage |
|---|-------|--------|--------------------|
| 1 | Spec doc committed to `docs/superpowers/specs/2026-05-11-mine-sweep-design.md` | <1 hr | User sign-off |
| 2 | `mine_sweep_ingest.py` — downloads NOAA shapefile + NCEI BAG list, writes `manifest.json` with SHA-256s | 0.5 day | Manifest reproduces byte-identically on rerun |
| 3 | `mine_sweep_features.py` — bathymetry → 50m tiles → 4-feature parquet | 1 day | Features reproduce byte-identically on rerun |
| 4 | OCEAN `embed numeric features [...]` extension (lexer/parser/operator routing) | 0.5 day | Conformance test passes |
| 5 | `pipelines/mine_sweep.ocean` file + executability check | 0.5 day | Byte-identical output to Python harness on tiny fixture |
| 6 | `mine_sweep.py` harness — orchestrator + substrate dispatch + baselines + B-gate | 1 day | Three baselines run on small sample |
| 7 | Full GPU run via RunPod dispatch, 3 seeds, summary.json produced | 4–12 hr async | B-gate verdict written |
| 8a | If verdict = SHIP_A: `/mine-sweep` page + `ALL_SHOWCASES` entry + optional `/mine-sweep/tiles` subpage | 1 day | Page reviewed, no marketing inflation, scope/limits block present |
| 8b | If verdict = SHELVE_A or INCONCLUSIVE: `docs/commercial/MINE_SWEEP_RESULTS.md` negative-result writeup | 0.5 day | Document signed off |

### Data ingestion (Stage 2)

**Source 1.** NOAA Wrecks and Obstructions database (the modern name for what was historically AWOIS), maintained by NOAA Office of Coast Survey. Single shapefile at `nauticalcharts.noaa.gov/data/wrecks-and-obstructions.html`. Dated release captured in manifest. Approximately 10,500 point records nationally; approximately 487 within the Stellwagen Sanctuary boundary as of recent releases.

**Source 2.** NOAA NCEI Hydrographic Survey multibeam bathymetry. BAG-format gridded depth files, typically 5-10m resolution for Stellwagen. Available at `ncei.noaa.gov` via the hydrographic survey catalog. Fixed list of BAG files (identified by survey ID) captured in manifest with SHA-256 per file.

**Region.** Stellwagen Bank National Marine Sanctuary, defined by the SBNMS boundary polygon (itself a NOAA-published boundary). Approximately 2,200 km². Pre-committed before any substrate run; no post-hoc region selection.

**Manifest format** (`data/validation/mine_sweep/manifest.json`):

```json
{
  "region": "stellwagen_bank_sbnms",
  "boundary_source": "https://nauticalcharts.noaa.gov/data/...",
  "boundary_sha256": "abc...",
  "awois_release_date": "2026-04",
  "awois_sha256": "def...",
  "awois_records_in_boundary": 487,
  "ncei_bag_files": [
    {"survey_id": "H12345", "url": "https://ncei.noaa.gov/...", "sha256": "...", "bytes": 142000000}
  ],
  "total_bytes": 8200000000,
  "harvested_at_utc": "2026-05-11T00:00:00Z",
  "harvester_version": "mine_sweep_ingest.py@<git_sha>"
}
```

**Reproducibility recipe** (the showcase quotes this verbatim):

> Re-download the NOAA Wrecks-and-Obstructions shapefile dated 2026-04 from NOAA OCS. Re-download the listed NCEI BAG files. Run `python scripts/experiments/mine_sweep_ingest.py`. Compare the manifest's SHA-256 list to ours. Same input → same answer.

### Tile and feature extraction (Stage 3)

**Tile geometry.** 50m × 50m non-overlapping tiles, aligned to a fixed regional grid anchored at the Stellwagen Sanctuary boundary's south-west corner. At ~5m NCEI resolution each tile is 10×10 = 100 pixels. Approximately 880,000 in-boundary tiles total. Tiles with <90% coverage from any single NCEI BAG file are dropped (no edge-of-survey artifacts).

**Feature set — four signals, bathymetry only.** The substrate sees exactly four per-tile numbers:

1. `residual_rms`: RMS of the depth grid after subtracting a fitted plane. Captures "this tile is bumpier than a tilted surface would explain."
2. `local_relief`: `max(depth) − min(depth)` within the tile. Captures spike-like features (wrecks).
3. `slope_std`: standard deviation of pixel-wise slope. Captures texture roughness.
4. `laplacian_std`: standard deviation of the discrete Laplacian. Captures curvature variance independent of slope.

All four are pure functions of the tile's depth grid. No external priors, no AWOIS, no survey metadata, no depth context. The substrate is deliberately depth-unaware so it cannot learn regional priors.

**AWOIS-to-tile alignment.** Strict positive: at least one AWOIS point falls inside the tile polygon. Buffered sensitivity check: re-run with 25m and 50m buffers, report enrichment for each as a footnote.

**Per-tile output row:** `tile_id, anchor_lat, anchor_lon, residual_rms, local_relief, slope_std, laplacian_std, is_positive_strict`. `is_positive_strict` is held out from substrate; only used at evaluation time.

### OCEAN language extension (Stage 4)

Add one new embed mode to OCEAN: `embed numeric features [f1, f2, ..., fN]`. Treats the listed numeric fields as the feature matrix directly with `dim = N`, no transformation.

Implementation surface:
- `scripts/operators/ocean/lexer.py`: recognize `numeric` and `features` tokens in the embed-mode lexical context.
- `scripts/operators/ocean/parser.py`: parse `embed numeric features [<ident_list>]` as a variant of the existing embed AST node.
- `scripts/operators/embed.py`: route the new mode to a pass-through embedding that pulls the named fields from each record into a row vector.
- Conformance test: assert that `embed numeric features [a, b]` on a 3-record NDJSON `{a, b, c}` produces a 3×2 matrix matching the (a, b) values exactly.

### Pipeline file (Stage 5)

`pipelines/mine_sweep.ocean`:

```ocean
# /mine-sweep — substrate sort-by-structural-unusualness on
# NOAA bathymetry, evaluated against NOAA Wrecks-and-Obstructions labels.
# Companion to scripts/experiments/mine_sweep.py.

seed 42

sweep s from 42 to 44 do
    load data/validation/mine_sweep/features.ndjson take 880432 records
    embed numeric features [residual_rms, local_relief, slope_std, laplacian_std]
    cluster for 16 rounds max 256 modules energy = corpus mean
    save to data/validation/mine_sweep/modules_seed_${s}.json
end
```

The literal `880432` in `take N records` is a placeholder — the actual in-boundary tile count is measured during Stage 3 and the .ocean file is regenerated by the harness with the measured value. The harness writes the regenerated .ocean file before invoking the executability check.

**Executability check** (mandatory before showcase ships):

```
python -m scripts.operators.ocean.compiler pipelines/mine_sweep.ocean --execute
diff <(python scripts/experiments/mine_sweep.py --seed 42 --emit modules_only) \
     data/validation/mine_sweep/modules_seed_42.json
```

If they don't match byte-for-byte, the pipeline file is wrong and the showcase blocks.

### Substrate run + anomaly score (Stage 6 + 7)

**Feature normalization (deterministic).** Per-feature z-score across the corpus before forming Z:
```
Z[:, i] = (features[:, i] - features[:, i].mean()) / features[:, i].std()
```

**Substrate operator.** `cluster.tcd_recursive_loop` with pre-committed hyperparameters (all written into manifest):
```
iters             = 16
max_modules       = 256
crystallize_every = 2
langevin_steps    = 30
energy            = corpus_mean
seeds             = [42, 43, 44]
```

**Anomaly score derivation** (the line of Python the user writes):
```python
def anomaly_score(tile, modules, epsilon=1e-3):
    module = modules[tile.module_id]
    rarity = -math.log(module.size)
    distance = np.linalg.norm(tile.features_z - module.centroid)
    return rarity + epsilon * distance
```

Final per-tile score normalized to percentile rank in [0, 1].

### Evaluation harness + B-gate (Stage 6 cont.)

**Three baselines, all computed identically alongside substrate:**

1. **Uniform random** (chance baseline): per-tile score = `np.random.uniform(0, 1)`. 100 resamplings to characterize null distribution.
2. **Z-score baseline** (textbook signal processing): per-tile score = `sum_i z_i^2`, i.e. squared Euclidean distance to corpus mean in feature-z-space. Deterministic, no seed. Structurally equivalent to TCD-JEPA's internal energy with `energy=corpus_mean`.
3. **Isolation Forest** (textbook ML): sklearn `IsolationForest` on the four normalized features, default hyperparameters (`n_estimators=100`, `contamination='auto'`, `random_state=seed`), seeds [42, 43, 44].

**Metrics per seed:**
- `enrichment_at_K` for K ∈ {0.1%, 0.5%, 1%, 2%, 5%, 10%}, where `enrichment_K = (positives_in_top_K / total_positives) / K`. Top-1% is the headline.
- `AUPRC` via `sklearn.metrics.average_precision_score`.
- Full enrichment curve as JSON for chart rendering.

**Aggregation across 3 seeds:** mean + 95% CI via t-distribution with 2 df (critical value ≈ 4.303), not normal-approximation. For seed-free baselines (z-score, random), CI is degenerate or computed differently and labeled as such in `summary.json`.

**B-gate function** (the user writes this, ~10 lines):

```python
def b_gate(summary):
    substrate_ci_lower = summary["substrate"]["enrichment_at_1pct_ci95"][0]
    substrate_mean     = summary["substrate"]["enrichment_at_1pct_mean"]
    best_baseline      = max(
        b["enrichment_at_1pct"] for b in summary["baselines"].values()
    )

    cond_chance   = substrate_ci_lower >= 5.0
    cond_baseline = substrate_mean >= 2.0 * best_baseline

    if cond_chance and cond_baseline:
        return "SHIP_A"
    if not cond_chance and substrate_mean >= 5.0:
        return "INCONCLUSIVE"  # mean above threshold, CI lower bound below
    return "SHELVE_A"
```

Three verdicts, all honest:
- `SHIP_A`: showcase page is added and merged.
- `INCONCLUSIVE`: signal present at insufficient power; add seeds or expand region and re-run gate. Page shelved.
- `SHELVE_A`: substrate didn't clear chance or didn't beat baselines. Publish `MINE_SWEEP_RESULTS.md` honestly. No page.

### Summary JSON shape

`data/validation/mine_sweep/summary.json`:

```json
{
  "region": "stellwagen_bank_sbnms",
  "n_tiles": 880432,
  "n_positives_strict": 487,
  "substrate": {
    "config": {"iters": 16, "max_modules": 256, "energy": "corpus_mean", "seeds": [42, 43, 44]},
    "enrichment_at_1pct_mean": null,
    "enrichment_at_1pct_ci95": [null, null],
    "enrichment_curve": null,
    "auprc_mean": null
  },
  "baselines": {
    "uniform_random":   {"enrichment_at_1pct": null, "ci95": [null, null]},
    "z_score":          {"enrichment_at_1pct": null},
    "isolation_forest": {"enrichment_at_1pct_mean": null, "ci95": [null, null]}
  },
  "buffered_sensitivity": {
    "buffer_0m":  null,
    "buffer_25m": null,
    "buffer_50m": null
  },
  "b_gate": {
    "verdict": null,
    "thresholds": {"chance_multiplier": 5.0, "baseline_multiplier": 2.0},
    "decision": null
  },
  "manifest_sha256": "...",
  "harness_version": "mine_sweep.py@<git_sha>",
  "computed_at_utc": null
}
```

Nulls populated by Stage 7. Page reads from this file at build time.

### Showcase page (Stage 8a)

`frontend/app/mine-sweep/page.tsx`. Five bullet sections matching the `/atlas` and `/pulse` shape:

1. **Corpus.** NOAA NCEI multibeam bathymetry of Stellwagen Bank, 880K tiles at 50m. AWOIS ground truth, 487 records.
2. **Input discipline.** Four numbers per tile: residual RMS, local relief, slope std, Laplacian std. Nothing else. Pipeline file rendered inline.
3. **The sort.** TCD-JEPA recursive loop, 16 rounds, 256-module budget. Top 1% captures [N] AWOIS-known obstructions vs chance baseline of 4.87.
4. **Three baselines, identical treatment.** Uniform random ([≈1×]), z-score baseline ([Z×]), Isolation Forest ([I×]). Substrate value-add over best baseline is [M×].
5. **Stability.** Three seeds, t-distribution CI. Lower bound of CI is [L×] over chance and [B×] over best baseline. If the lower bound had not cleared 5× and 2×, this page would not exist.

**Mandatory scope/limits block** (negative space):

> What this is not: this is not a mine detector. It is not a military system. It does not perform multi-modal sensor fusion. It is not real-time. It is not deployment-ready for any operational environment. What it is: a measurement that the substrate, given only four pre-computed bathymetry features, sorts tiles such that NOAA-labeled obstructions concentrate in the top fraction of the sort at the rate stated above. Any further claim requires further work.

**Recipe block** (verbatim, like `/atlas`).

**Voice:** third-person throughout, no first-person plural, no em dashes in displayable text, no superlatives, no marketing inflation.

**`ALL_SHOWCASES` entry** in `lib/products/data.ts`: additive, follows the existing entry shape.

**Sub-page `/mine-sweep/tiles`:** v1-stretch. Stellwagen basemap with tiles colored by substrate anomaly-score percentile, AWOIS points overlaid. Include only if B-gate passes and if buildable from `summary.json` + static map tile (no live mapping library if pre-rendered suffices).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Substrate fails to clear 5× chance | Publish `MINE_SWEEP_RESULTS.md` honestly. Substrate-status credit accrues from honest negative result. No page. |
| `max_modules=256` is wrong (too coarse / too fine) | Report what was measured. Do not tune post-hoc. If signal is present but blurred, document and propose next-iteration with a different pre-committed value. |
| AWOIS-positioning error dominates enrichment | Buffered sensitivity check (0/25/50m) characterizes this. Reported as footnote on page; doesn't change gate. |
| `.ocean` file diverges from Python harness output | Executability check is mandatory pre-ship. Byte-identical diff blocks the showcase if it doesn't pass. |
| NCEI BAG file URLs rot | Manifest preserves SHA-256 + size + survey ID. Re-acquiring data from a mirror is acceptable as long as SHA-256 matches. |
| Reviewer asks "isn't this just isolation forest?" | Isolation Forest is explicitly the third baseline. The substrate must beat it by 2× to ship. The page answers this question by displaying the comparison. |
| External LLM marketing copy gets re-pasted into the page | Voice discipline is encoded in the spec; PR review surfaces violations. Scope/limits block is mandatory. |

## What this design rejects

- LLM-marketing voice ("MASSIVE results", "revolutionary", "engineered for military use", em-dash-heavy prose).
- Pre-celebration before measurement. The B-gate exists to bind against this.
- Multi-modal feature stacks. Four features, full stop.
- Convnet or transformer embeddings on tiles. Defeats interpretability and reproducibility.
- Tuning hyperparameters after seeing the result. Pre-commit before run.
- Cherry-picking a region after a multi-region sweep. Single pre-committed region (Stellwagen).
- Any claim of military operational capability. Explicit negative-space block on page.
- A `/mine-sweep` page without a passing B-gate. Discipline is structural.

## Open implementation calls (deferred to writing-plans or to the user during implementation)

- Exact `epsilon` value in `anomaly_score(tile, modules)`. Proposed 1e-3; user finalizes when writing the function.
- Exact form of `b_gate()`. Proposed thresholds 5× / 2×; user finalizes when writing the function.
- Whether `/mine-sweep/tiles` ships in v1 or is deferred. Conditional on B-gate verdict and on rendering-effort budget at that point.
- Whether to back-port the B-gate pattern to `/atlas` and `/pulse` after `/mine-sweep` ships (out of scope for this design; potential follow-on).
