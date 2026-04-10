# LATK Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Lineage Atlas of Technical Knowledge as phased scaling runs on top of the already-validated BTUT+CET pipeline.

**Architecture:** Python package `latk_tool/` extending `cet_tool/` with ingestion adapters, a lattice persistence layer, a novelty query module, and phased corpus builders. Each phase runs the same BTUT pipeline on progressively larger corpora.

**Tech Stack:** Python 3.11+, the existing `app.services.btut.pipeline` BTUT engine, `requests` / `feedparser` for arXiv API, `tarfile` for arXiv bulk, `lxml` for USPTO XML, standard library for the rest.

---

## Phase 0: Foundations (single session, ~1 day)

### Task 0.1: Scaffold `latk_tool/` package

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/__init__.py`
- Create: `scripts/cross_era_analysis/latk_tool/ingest/__init__.py`
- Create: `scripts/cross_era_analysis/latk_tool/query/__init__.py`
- Create: `scripts/cross_era_analysis/latk_tool/scale/__init__.py`

**Step 1: Create the package directories and `__init__.py` files**

```python
# latk_tool/__init__.py
"""LATK: Lineage Atlas of Technical Knowledge.

Extends CET tool with ingestion adapters, novelty query,
and scaling infrastructure for the LATK program.
"""
__version__ = "0.1.0"
```

**Step 2: Commit**

```bash
git add scripts/cross_era_analysis/latk_tool/
git commit -m "Scaffold latk_tool package for LATK Phase 0"
```

### Task 0.2: Generic text ingestion adapter

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/ingest/text_ingest.py`

**Step 1: Write `ingest_text_directory(path, regime_name) → list[DocumentEntry]`**

Accepts a directory of `.txt` files, returns a list of `DocumentEntry` dataclasses compatible with the CET tool. Reuses `cet_tool.corpus.chunk_text` for chunking.

**Step 2: Test on an existing corpus directory**

```bash
python -c "from latk_tool.ingest.text_ingest import ingest_text_directory; docs = ingest_text_directory('scripts/cross_era_analysis/documents', 'linguistics'); print(len(docs))"
```

Expected: prints count of documents.

**Step 3: Commit**

### Task 0.3: arXiv ingestion adapter (scaffolded, runnable in future)

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/ingest/arxiv_ingest.py`

**Step 1: Write `fetch_arxiv_category(category, max_results, start_year) → list[PaperRecord]`**

Uses the public `http://export.arxiv.org/api/query` endpoint. Returns records with `id`, `title`, `abstract`, `authors`, `published`, `category`.

**Step 2: Write `paper_records_to_entities(records) → dict` returning the LATK entity schema**

Produces chunks (from abstracts), person entities (authors), concept entities (extracted via simple NP chunking from titles), event entities (the publication event), and writing entities (the paper itself).

**Step 3: Skeleton test with small fetch**

(Do not run in Phase 0 — requires network; document the test command for Phase 1)

**Step 4: Commit**

### Task 0.4: Novelty query module

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/query/novelty.py`

**Step 1: Write `load_lattice(btut_result_path) → LatticeIndex`**

Loads a BTUT result JSON and builds an in-memory index: `{fingerprint → [entity_ids]}` at each resolution (coarse/medium/fine).

**Step 2: Write `fingerprint_text(text, discriminator_config) → MultiResFingerprint`**

Chunks the text, computes fingerprints using the same hash function as the BTUT pipeline at coarse/medium/fine resolutions.

**Step 3: Write `query_novelty(text, lattice_index) → NoveltyReport`**

Returns: `nearest_entities` (ranked), `novelty_score` (scalar), `matched_clusters`, `era_distribution_of_matches`.

**Step 4: Test against the linguistics lattice**

```bash
python -c "
from latk_tool.query.novelty import load_lattice, query_novelty
lattice = load_lattice('scripts/cross_era_analysis/output/linguistics_btut_result.json')
report = query_novelty('Meaning is determined by a word\\'s opposition to all other words in the system.', lattice)
print(report.novelty_score)
print(report.nearest_entities[:5])
"
```

Expected: nearest entities should include Saussure / system_of_differences / distributional_semantics.

**Step 5: Commit**

### Task 0.5: Multi-domain scaling test corpus

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/scale/build_latk_mini_corpus.py`

**Step 1: Write the merger script**

Loads all five validated corpora (wireless/full, polymath, linguistics, heterogeneous) from `scripts/cross_era_analysis/output/`. Merges entities with namespace prefixes (`ling__`, `poly__`, `wrls__`, etc.) to avoid ID collisions. Merges edges. Produces `scripts/cross_era_analysis/output/latk_mini_corpus.json`.

Target: ~8000 entities, ~10000 edges, 9+ entity types, spanning all 5 domains.

**Step 2: Run the merger**

```bash
python scripts/cross_era_analysis/latk_tool/scale/build_latk_mini_corpus.py
```

Expected: prints entity/edge counts, writes output JSON.

**Step 3: Commit**

### Task 0.6: Run LATK-mini BTUT scaling test

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/scale/run_latk_mini_btut.py`

**Step 1: Write the runner** (similar to `run_linguistics_btut.py` but on the merged corpus, with target_survivors=1500)

**Step 2: Upload to production server and run**

```bash
scp scripts/cross_era_analysis/output/latk_mini_corpus.json <prod>:/tmp/
scp scripts/cross_era_analysis/latk_tool/scale/run_latk_mini_btut.py <prod>:/tmp/
ssh <prod> "docker compose exec -T backend bash -c 'PYTHONPATH=/app python /tmp/run_latk_mini_btut.py'"
```

Expected: BTUT completes in 60-300 seconds, produces survivors + clusters + fingerprints.

**Step 3: Pull results back**

```bash
scp <prod>:/tmp/latk_mini_btut_result.json scripts/cross_era_analysis/output/
```

**Step 4: Verify medium-resolution signature**

```bash
python -c "
import json
r = json.load(open('scripts/cross_era_analysis/output/latk_mini_btut_result.json'))
# Count unique fingerprints at each resolution from the survivors
# Verify: med < coarse AND med < fine
"
```

Expected: medium-resolution unique fingerprint count is lower than coarse and fine (Tesla signature).

**Step 5: Commit results**

### Task 0.7: Phase 0 summary document

**Files:**
- Create: `docs/findings/2026-04-10-latk-phase0-results.md`

**Step 1: Write the summary**

Covers:
- Scaling test results (entity count, cluster count, fingerprint counts at each resolution)
- Whether the Tesla medium-resolution signature replicated at 8k-entity scale
- Any cross-domain clusters surfaced by the merged corpus
- Next steps for Phase 1

**Step 2: Commit**

---

## Phase 1: Physics at scale (30 days)

### Task 1.1: arXiv physics bulk ingest

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/scale/ingest_arxiv_physics.py`

**Step 1: Fetch all arXiv physics papers from 1991-present via bulk API**

Paginate through `http://export.arxiv.org/api/query?search_query=cat:physics.*&max_results=1000` with 3-second delays to respect rate limits.

**Step 2: Store raw records to local disk as JSONL**

Expected: ~2M papers, ~20GB raw.

**Step 3: Commit the ingest script**

### Task 1.2: USPTO physics patents bulk ingest

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/scale/ingest_uspto_physics.py`

**Step 1: Download USPTO bulk patent XML for classifications G01-G21 (physics)**

Uses the USPTO bulk data system at https://bulkdata.uspto.gov/.

**Step 2: Parse XML → PaperRecord-compatible dict**

**Step 3: Store to JSONL**

Expected: ~500k-1M patents.

**Step 4: Commit**

### Task 1.3: Historical physics corpus ingest

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/scale/ingest_historical_physics.py`

**Step 1: Fetch Annalen der Physik scans from Internet Archive**

**Step 2: OCR text extraction with confidence filtering**

**Step 3: Chunk and entity-extract**

**Step 4: Commit**

### Task 1.4: Build LATK-physics corpus

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/scale/build_latk_physics_corpus.py`

**Step 1: Merge arXiv + USPTO + historical corpora into one heterogeneous entity graph**

Expected: 5-20M entities, 6 entity types, ~50-200M edges.

**Step 2: Persist to compressed JSON**

**Step 3: Commit**

### Task 1.5: Run BTUT on LATK-physics

**Step 1: Provision compute for multi-hour run**

**Step 2: Execute BTUT pipeline**

Expected: 4-12 hours.

**Step 3: Persist result + lattice index**

### Task 1.6: Validation against known physics lineages

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/scale/validate_physics_lineages.py`

**Step 1: Define validation set**

7 known historical→modern physics lineages (Maxwell→QED, Einstein→GR cosmology, Boltzmann→condensed matter, Feynman→QFT, Dirac→QM, Heisenberg→QO, Planck→statistical physics).

**Step 2: For each lineage, run `route_to_ancestors` on 5 representative modern papers**

**Step 3: Check whether the historical figure is in the top-20 ancestors**

Target: ≥90% hit rate.

**Step 4: Commit the validation report**

### Task 1.7: Phase 1 public query API

**Files:**
- Create: `scripts/cross_era_analysis/latk_tool/query/api_server.py`

**Step 1: FastAPI server exposing the 6 query types**

**Step 2: Lattice index loaded at startup**

**Step 3: Deploy on production server**

---

## Phase 2: STEM-complete (90 days)

Same shape as Phase 1 but for all of arXiv, PubMed, USPTO+EPO+JPO, and historical STEM corpora. Scales corpus 10-100x; expected ~2x-3x engineering effort over Phase 1 for the multi-source ingest plumbing.

**Key tasks:**
- `ingest_arxiv_all.py` — all arXiv categories
- `ingest_pubmed.py` — NCBI FTP bulk
- `ingest_uspto_all.py` — all USPTO classifications
- `ingest_epo.py` — EPO bulk
- `ingest_historical_stem.py` — Gallica, Wikisource, Internet Archive
- `build_latk_stem_corpus.py` — merge
- `run_latk_stem_btut.py` — BTUT at STEM scale
- `validate_cross_domain_lineages.py` — validation across multiple domains

---

## Phase 3: All-knowledge (12 months)

Adds multilingual corpora and all digitized technical books. Translation preprocessing required for non-English sources. The 3000TB-on-$200 compression target is realized here.

**Key tasks:**
- `ingest_multilingual.py` — CNKI, J-STAGE, Russian, Arabic, Latin/Greek historical
- `translate_preprocess.py` — translation to English before fingerprinting
- `ingest_wikisource_all.py` — Wikisource all languages
- `ingest_internet_archive_books.py` — IA scanned technical books
- `ingest_royal_society_proceedings.py` — Royal Society back to 1665
- `build_latk_all_corpus.py` — full merge
- `run_latk_all_btut.py` — full-scale BTUT run
- `validate_cross_civilization_lineages.py` — validation across civilizations

---

## Commit Discipline

- Each task ends with a commit
- Commit messages reference the task ID (e.g., "LATK 0.3: arXiv adapter")
- Phase 0 ships as a single coherent commit set
- Phases 1-3 ship incrementally with per-task commits

## Handoff Discipline

- Each phase ends with a handoff document
- Phase 0 handoff: `docs/findings/2026-04-10-latk-phase0-results.md`
- Phase 1 handoff: `docs/findings/YYYY-MM-DD-latk-phase1-results.md`
- Etc.
- Handoff documents cover: what ran, what the results were, what validation passed, what the next phase needs.

## Remember

- DRY, YAGNI, TDD, frequent commits
- BTUT pipeline is the unchanged core — never modify it
- CET tool is the base layer — `latk_tool` extends, does not replace
- Heterogeneous entity schema is mandatory — uniform corpora fail
- Medium-resolution signature is the quality gate — every phase must replicate it
- Deep reading is irreplaceable — LATK routes attention, humans formalize
