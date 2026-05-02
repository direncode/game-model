# Atlas — arXiv Reproducible Cross-Discipline Structural Map — Design Spec

**Date:** 2026-05-02
**Owner:** Latent Ocean (lsx)
**Status:** approved for implementation
**Reference artifact:** `/docsouth` (the pattern Atlas is built to mirror)

## Purpose

Public, citable artifact at `/atlas/arxiv` (and tenant `atlas_showcase`) demonstrating that Latent Ocean's BTUT formation pipeline produces deterministic, reproducible structural fingerprints over a non-humanities scientific corpus. Headline claim: thirty years of scientific discourse, structurally mapped, citable forever, with cluster purity against arXiv's own primary categories as the centerpiece unsupervised-recovery number. Atlas extends the substrate validated by DocSouth into the buyer category of scientific publishers, bibliometricians, research libraries, and science-policy researchers.

Atlas is the first of three new public showcases (Pulse, Atlas, Receipt). Each ships independently against its own design spec. Pulse and Receipt are out of scope for this spec.

## Out of scope

- Pulse (USPTO patents) — separate brainstorm + spec.
- Receipt (SEC EDGAR 10-K AI summarization audit trail) — separate brainstorm + spec, structurally different product (audit trail, not BTUT formation).
- Refactoring DocSouth or extracting a shared "showcase library." Premature; reassess after second showcase ships.
- Live arXiv API ingest. Only the Kaggle bulk snapshot is in scope.
- PDF ingest. Title and abstract only.
- Author disambiguation. Atlas is paper-level, not author-level.

## Decisions locked in (clarifying questions)

| Q | Decision | Reason |
|---|---|---|
| Q1 corpus scope | Full corpus, all 2.5M abstracts, 8 disciplines, 1991-2025 | Maximum credibility, defensibility of the 30-year claim |
| Q2 fingerprint input | Title + abstract only | Strict unsupervised claim. Categories must NOT appear in the fingerprint, otherwise purity vs. categories is circular |
| Q3 source | Kaggle monthly snapshot, pinned by snapshot date | Deterministic, snapshotable, fixed-bytes. Live arXiv API mutates and breaks `corpus_sha256` |
| Q4 gold-standard granularity | Coarse (8 archives) + fine (~152 subcategories), headline coarse, disclose fine | Honest version. Strong headline number plus harder honest number, lets the reader judge |
| Q5 emergence detection | Static analyze-only. Flag young+tight+diverse clusters by (median pub year, year-spread, category Shannon entropy). No naming. | Cheap, honest, no new infra. Lets the data speak. Naming candidates becomes a v2 follow-up if signal is clean |

## Constraints

- No new backend code. The existing `/api/range-public/showcase/<name>` endpoint reads `/data/formed_models/_public/<name>.json` by name. Atlas adds a new public artifact JSON, not a new endpoint.
- All eight DocSouth widgets reused unchanged. They are data-driven from the public artifact JSON.
- Run on EC2. Bind-mount `/opt/latentocean/data/formed_models/_inputs/` is already there. Reproducibility is cleaner when the original run and the verification run share hardware.
- New tenant `atlas_showcase`, parallel to `docsouth_showcase`. Minted via the existing `/api/range-demo-token` flow.
- Voice on the artifact page mirrors DocSouth's: scholarly-pace prose, full method disclosure, baseline panel, named rare records with click-throughs to the canonical source (in this case `https://arxiv.org/abs/<paper_id>`).
- IP framing: trade secret plus OpenTimeStamps anchoring. Never claim "patents filed."

## Architecture

```
scripts/
  arxiv_harvest.py             # Kaggle snapshot -> /data/formed_models/_inputs/arxiv.ndjson
  arxiv_analyze.py             # survivors + meta -> /data/formed_models/_public/arxiv.json
  arxiv_constellations.py      # 100-finding catalog -> showcases/atlas_findings.json
  arxiv_verify.sh              # corpus_sha256 + response_digest determinism

showcases/
  atlas.json                   # local committed snapshot of the public artifact
  atlas_findings.json          # local committed 100-finding catalog

frontend/app/atlas/
  page.tsx                     # the long-form public artifact page
  constellations/page.tsx      # the 100-finding catalog page
```

Public read endpoint already exists. Atlas adds no new backend route.

## Components

### `scripts/arxiv_harvest.py`

- Input: pinned Kaggle snapshot file (e.g., `arxiv-metadata-oai-snapshot-2026-04.json`), residing at `/tmp/arxiv_work/arxiv-metadata-oai-snapshot.json` on EC2.
- Per-record fields kept: `id`, `title`, `abstract`, `categories`, `authors`, `update_date`.
- Filter: drop withdrawn papers (abstract begins with the withdrawal pattern). Drop records where `update_date > snapshot_nominal_date`.
- Fingerprint payload: `text = title + "\n\n" + abstract`. Categories and authors are NOT in `text`.
- Sort: by `paper_id` ascending. Guarantees byte-identical NDJSON given the same input file.
- Output: NDJSON at `/opt/latentocean/data/formed_models/_inputs/arxiv.ndjson`.
- Output schema per record:
  ```json
  {
    "paper_id": "1706.03762",
    "primary_category": "cs.CL",
    "archive": "cs",
    "categories": ["cs.CL", "cs.LG"],
    "year": 2017,
    "authors_count": 8,
    "title": "Attention Is All You Need",
    "abstract": "The dominant sequence transduction models...",
    "text": "Attention Is All You Need\n\nThe dominant sequence transduction models..."
  }
  ```
- Determinism: stable JSON serialization with sorted keys and `(",", ":")` separators, lines `\n`-terminated.
- Emits `corpus_input_sha256` (the raw Kaggle file's hash) and `corpus_sha256` (the NDJSON's hash) into the public artifact JSON at analyze time. Both hashes also surface in `showcases/atlas.json` when the local snapshot is committed.

### `scripts/arxiv_analyze.py`

- Inputs:
  - BTUT survivors via `GET /api/range-form/<model_id>` (using `atlas_showcase` token)
  - Corpus NDJSON at `/data/formed_models/_inputs/arxiv.ndjson`
  - Taxonomy JSON from the model meta
- Joins survivors back to corpus by `recordIdx` (same join pattern as `docsouth_analyze.py`).
- Computes:
  - **Coarse purity** vs. 8 archive-level disciplines (cs, math, physics, q-bio, q-fin, stat, econ, eess). Weighted-purity metric, same shape as DocSouth's `weighted_purity`.
  - **Fine purity** vs. ~152 primary subcategories. Disclosed in verification appendix, not the headline.
  - **Decade trajectory** 1990s, 2000s, 2010s, 2020s. Content-weighted variant cloned from DocSouth.
  - **Cross-discipline bleed** — papers whose cluster's modal-archive differs from the paper's archive. Per-archive bleed-out rates plus named exemplars.
  - **Top-25 rarest survivors** by Hamming-radius rarity (same metric as DocSouth's rare-records list). Each carries `paper_id`, `title`, `archive`, `primary_category`, `year`, `arxiv_url = "https://arxiv.org/abs/<paper_id>"`.
  - **Young+tight+diverse cluster flag** per Q5. For each cluster, compute (median pub year, year-spread = p90 - p10, Shannon entropy over primary categories). Flag clusters where `median_year >= 2015`, `year_spread <= 5y`, `category_entropy >= threshold`. Initial threshold: top quartile of entropy among clusters meeting the year filters. NO naming — emit cluster_id, the three metrics, and the rare-record exemplars at the cluster's center. Reader judges.
  - **Baseline panel** — TF-IDF + KMeans@K=12 and LDA@K=12 on `text`, both compared to the engine's coarse purity number.
- Output: `/data/formed_models/_public/arxiv.json`. Schema mirrors DocSouth's `_public/docsouth.json` plus an `emergence_candidates` block.

### `scripts/arxiv_constellations.py`

- 100-finding catalog grouped into 12 thematic constellations. Mirrors DocSouth's structure (12 constellations × ~8 findings each).
- Atlas-specific themes: discipline boundaries, candidate emerged clusters, cross-discipline bleed papers, named rare papers, structural anachronisms (a 1995 paper that clusters with 2018-era cs.LG, for example), discipline-specific micro-clusters.
- Output: `showcases/atlas_findings.json`.

### `scripts/arxiv_verify.sh`

- Direct port of `scripts/docsouth_verify.sh`. Uses `atlas_showcase` token at `/tmp/atlastoken`.
- Lists models for the tenant. Confirms a model named "Atlas" or similar exists.
- Fires 7 query intents: `what_is_rare`, `novel_classes`, `show_taxonomy`, `describe_corpus`, `compare_to_llm`, `summarize`, `lineage_trace`.
- Re-issues each query, compares `response_digest` byte-for-byte. PASS = 7/7.
- Cross-tenant probe: probe token from a different color must get 404 on the Atlas model_id.
- Pulls audit log in JSON, CEF, OCSF.
- Emits `/tmp/atlas_summary.json`.

### `frontend/app/atlas/page.tsx`

- Long-form artifact page. Same eight widgets as DocSouth: `PersistenceBarcodeWidget`, `ClusterPurityWidget`, `DecadeTrajectoryWidget`, `NamedRareRecordsWidget`, `CorpusVerificationWidget`, `BaselineComparisonWidget`, `CrossCollectionBleedWidget` (the bleed widget renamed in prose to "cross-discipline bleed"), `ContentDriftWidget`.
- Headline: "Thirty years of scientific discourse, structurally mapped, citable forever."
- Tenant: `atlas_showcase`. Public read endpoint: `/api/range-public/showcase/atlas`.
- Sections (mirroring DocSouth): preface, the corpus, topology, recovery (cluster purity), bleed (cross-discipline), thirty years (decade drift), baselines, named rare, verification, limits, acknowledgements.
- Section voice: scholarly-pace prose, written against the actual numbers in `_public/arxiv.json` after the formation run completes. Not before.

### `frontend/app/atlas/constellations/page.tsx`

- 100 findings rendered as 12 constellations. Direct port of `frontend/app/docsouth/constellations/page.tsx` shape, sourcing from `showcases/atlas_findings.json`.

## Data flow

```
[1] Pin Kaggle snapshot date (e.g., 2026-04 monthly dump)
[2] Download arxiv-metadata-oai-snapshot-YYYY-MM.json (~1.5 GB) to EC2
[3] sha256(input file) -> corpus_input_sha256 (freezes upstream)
[4] scripts/arxiv_harvest.py -> /data/formed_models/_inputs/arxiv.ndjson
[5] sha256(NDJSON) -> corpus_sha256 (freezes what the engine sees)
[6] Mint atlas_showcase tenant token via /api/range-demo-token color=atlas_showcase
[7] POST /api/range-form (frontend bridge) with the corpus path
    BTUT bridge chunks at 5000/call -> 500 chunks at ~15s each (~125 min wall)
    Survivors merged, RunPod finalize, ripser persistence
    Output: model_id, response_digest, taxonomy_summary
[8] GET /api/range-form/<model_id> -> full meta + survivors
[9] scripts/arxiv_analyze.py -> /data/formed_models/_public/arxiv.json
[10] scripts/arxiv_constellations.py -> showcases/atlas_findings.json
[11] scripts/arxiv_verify.sh -> 7 query digests, cross-tenant probe, audit pull
[12] Commit showcases/atlas.json + showcases/atlas_findings.json
[13] Update frontend/app/atlas/page.tsx prose against the actual numbers
[14] Deploy
```

Steps [1] through [10] run on EC2. Steps [12] through [14] run from the dev box.

## Reproducibility recipe (etched on the artifact page)

> Verify Atlas yourself. Download Kaggle's arXiv metadata snapshot pinned at YYYY-MM-DD. Confirm `sha256(file) = <corpus_input_sha256>`. Run `scripts/arxiv_harvest.py` against it. Confirm `sha256(arxiv.ndjson) = <corpus_sha256>`. Re-issue the seven query intents against `model_id=<id>` and confirm each `response_digest` matches the published value byte-for-byte.

Public-artifact fields:

| Field | Source | Frozen by |
|---|---|---|
| `kaggle_snapshot_date` | the pinned monthly dump | upstream Kaggle |
| `corpus_input_sha256` | sha256 of the raw Kaggle JSON | the file's bytes |
| `corpus_records` | count of NDJSON lines | the harvester |
| `corpus_bytes` | size of NDJSON | the harvester |
| `corpus_sha256` | sha256 of the NDJSON | harvester determinism |
| `formed_at` | timestamp of formation run | the engine |
| `model_id` | issued by the engine | one-shot |
| `response_digest` | per-query response digest, all 7 intents | engine determinism |

Atlas adds `corpus_input_sha256` (an upstream-pin hash). DocSouth has only `corpus_sha256`. Backport to DocSouth as a follow-up after Atlas ships.

What the verifier proves:

- Same Kaggle snapshot -> same NDJSON (harvester is deterministic: sort, filter, canonical JSON serialization).
- Same NDJSON -> same survivors (BTUT pipeline is deterministic given a fixed seed and fixed corpus).
- Same model -> same `response_digest` for the seven canonical queries.

What the verifier does NOT prove (honest disclosure on the artifact page):

- The Kaggle dump is itself a snapshot. If Kaggle removes it, `corpus_input_sha256` still verifies if a reader has a copy. The repo commits both hashes inside `showcases/atlas.json` (the local committed snapshot of the public artifact), so the file's hash is anchored in the repo even if Kaggle removes it.
- The RunPod GPU finalize step depends on a specific GPU. Re-running on a different GPU may produce structurally similar but not byte-identical persistence bars. The seven-query `response_digest` is invariant to this. The persistence-bars number may drift in the third decimal place. (Same caveat as DocSouth.)

## Failure modes and mitigations

### Run-scale risks

| Risk | Mitigation |
|---|---|
| 500-chunk formation: ~125 min wall time. If the BTUT bridge orchestrates serially in-browser, a dropped connection kills the run. | Action item before harvest: read the frontend BTUT bridge code to confirm orchestration is server-side. If not, drive formation from a `curl` on EC2 with `nohup` plus status polling. |
| RunPod cost at 500 chunks. If RunPod finalize is per-chunk, cost balloons. | Action item before harvest: read the BTUT pipeline merge code to confirm finalize is invoked once at merge time, not per-chunk. |
| Survivor-merge memory: 500 x 300 = 150k survivors x ~1-2 KB each = 150-300 MB peak. | Tractable on EC2. Flag in runbook. |
| Public artifact JSON size if all 150k survivors get serialized. | `_public/arxiv.json` carries headline numbers, top-25 rare records, per-cluster summaries. Full survivor list stays in the engine. Page lazy-loads via separate endpoint if needed. |

### Reproducibility risks

| Risk | Mitigation |
|---|---|
| Kaggle removes the snapshot. | `corpus_input_sha256` and `corpus_sha256` both land inside `showcases/atlas.json` and are committed to the repo. The Kaggle URL is convenience. The hashes are authority. |
| Withdrawn or replaced papers in the dump. | Harvester drops papers whose abstract starts with the withdrawal pattern. Documented in the script header. |
| Non-English abstracts (small fraction). | Keep them. They surface in the rare-records list, which is honest behavior. Acknowledged in the artifact page's limits section. |
| Multi-category papers. | Use `categories[0]` (= `primary_category`) for gold-standard purity. Full categories list retained for the bleed analysis. |

### Substrate risks

| Risk | Mitigation |
|---|---|
| BTUT determinism across runs. | Verify the BTUT pipeline already uses a fixed seed. If DocSouth's verify recipe passes today, this invariant already holds. |
| RunPod GPU drift on persistence bars. | Already a known DocSouth caveat. Acknowledged on the Atlas page identically. |
| `atlas_showcase` tenant does not exist yet. | Mint via the existing `/api/range-demo-token color=atlas_showcase` flow. No new code. |

### Artifact-page risks

| Risk | Mitigation |
|---|---|
| Prose written before formation lies about numbers. | Harvest, form, analyze first. Write prose against the actual `_public/arxiv.json`. |
| Young+tight+diverse signal could be empty or noisy. | Thresholds tuneable. Initial values target the top decile of clusters by combined score. If signal is weak, demote the section to "no clear emergence signal under this method." Better than fabricating one. |

## Pre-implementation action items (read-only investigations)

Two items need verification before code is written:

1. **Frontend BTUT bridge orchestration** — confirm `/api/range-form` (the Next.js handler that wraps the backend `/api/v1/range/form`) chunks server-side, not in-browser. If client-side, design a server-side fallback path before harvesting.
2. **RunPod finalize call site** — confirm RunPod is invoked once at merge time, not per-chunk. If per-chunk, redesign the finalize step or budget for 500x cost.

Both are read-only investigations of existing code.

## Acceptance criteria

The Atlas v1 artifact ships when:

- `/data/formed_models/_public/arxiv.json` exists on production with all required fields (`corpus_input_sha256`, `corpus_sha256`, `corpus_records`, `model_id`, `response_digest`, `taxonomy_summary`, decade-trajectory, top-25 rare, emergence-candidates, baseline-panel).
- `scripts/arxiv_verify.sh` returns 7/7 PASS on the seven query intents.
- Cross-tenant probe with a non-`atlas_showcase` token returns 404 on the Atlas `model_id`.
- Audit log retrievable in JSON, CEF, OCSF.
- `https://www.latentocean.com/atlas` renders the long-form artifact page with all eight widgets populated from the public JSON.
- `https://www.latentocean.com/atlas/constellations` renders the 100-finding catalog.
- Prose on `/atlas` quotes only numbers and named records that exist in `_public/arxiv.json`.
- `showcases/atlas.json` and `showcases/atlas_findings.json` committed to the repo.
- Verification recipe printed on the page, executable by a third party against the published hashes.

## Sequencing into Pulse and Receipt

After Atlas v1 ships:

1. Reassess whether the duplicated DocSouth + Atlas analyze logic warrants extraction into `lo_core/showcase_analyze.py`. If yes, refactor before Pulse.
2. Brainstorm Pulse (USPTO patents) as its own design spec. Likely larger corpus and harder gold-standard problem (PatentsView is itself an approximation, not ground truth).
3. Brainstorm Receipt (SEC EDGAR 10-K AI summarization audit trail) as its own design spec. Different product shape than DocSouth, Atlas, Pulse: audit-trail, not BTUT formation.

Each subsequent showcase gets its own brainstorm, spec, plan, implementation cycle.
