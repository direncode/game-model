# LATK: Lineage Atlas of Technical Knowledge — Design Document

**Date:** 2026-04-10
**Status:** Phase 0 design
**Builds on:** Cross-era detection five-domain validation (docs/findings/2026-04-10-cross-era-detection-final-synthesis.md)
**Target:** Computable structural atlas of all preserved human technical knowledge

---

## Problem Statement

No existing system computes the **structural topology** of human technical writing across historical eras. Current tools answer different questions:

- Google Scholar answers "what documents mention these words?"
- Semantic Scholar answers "what documents cite this document?"
- arXiv search answers "what recent documents match this query?"
- Patent prior-art systems answer "what classified patents overlap on keywords?"

None of these answer the question this investigation has been about: **"What prior work is structurally closest to this idea, across all eras, regardless of whether anyone has ever cited it?"**

The structural closeness question is what produces:
- Lost-knowledge recovery (historical work with no modern descendants but strong structural signal)
- Novelty as a computable property (distance in the lattice to the nearest structural match)
- Cross-era lineage mapping (which modern work is the true descendant of which historical work)
- Prior-art discovery independent of classification and citation
- The exact workflow that produced the Saussure→softmax finding in this investigation

LATK is the system that answers the structural-closeness question at the scale of all preserved human technical knowledge.

---

## Goal

Build a single navigable multi-resolution BTUT lattice covering every preserved technical writing in human history, with a query API that supports:

1. `route_to_ancestors(modern_text) → ranked list of historical antecedents`
2. `route_to_descendants(historical_text) → ranked list of modern manifestations`
3. `compute_novelty(text) → scalar novelty score + nearest-match list`
4. `find_lost_knowledge(region) → historical clusters with no modern descendants`
5. `find_genuine_novelty(region) → modern clusters with no historical ancestors`
6. `cross_era_cluster(region) → shared-fingerprint clusters spanning eras`

All six query types are computable directly from the lattice topology produced by BTUT on a heterogeneous corpus.

---

## Architecture

### Data layer

```
Raw corpus ingestion
    ↓
Heterogeneous entity extraction (chunks + persons + concepts + events + locations + writings)
    ↓
Edge graph construction (authorship, citation, mention, temporal, topical)
    ↓
BTUT lattice pipeline (multi-resolution 48-bit fingerprints, clustering, survivor reduction)
    ↓
Persistent lattice store (indexed for query)
```

### Query layer

```
Query text
    ↓
Chunk + fingerprint using the same pipeline
    ↓
Lattice lookup at multiple resolutions (coarse 4-bin → medium 8-bin → fine 16-bin)
    ↓
Cluster intersection (which lattice clusters does the query fingerprint belong to?)
    ↓
Cross-era entity extraction from matched clusters
    ↓
Ranked response with cluster-overlap scores + composite anomaly ranks
```

### Scaling layer

BTUT's design targets 3000TB data reduction on $200 of compute via 13-file MFG reduction with lattice threading. LATK inherits that target: the full all-knowledge corpus is expected to fit on the same storage and compute budget because the lattice compression ratio (~85% reduction in navigable units per run at the linguistics scale) extrapolates to the target.

---

## Corpus Sources (Phased)

### Phase 1: Single-domain at scale
- **arXiv bulk tarballs** — all physics papers since 1991
- **USPTO bulk APIs** — all physics patents since 1970
- **Historical physics corpus** — Annalen der Physik, Proceedings of the Royal Society physics papers, Philosophical Transactions of the Royal Society of London, Internet Archive scans of 19th century physics texts
- Target: 5-20M entities

### Phase 2: STEM-complete
- **All arXiv** (physics, math, CS, bio, stats, quantitative finance, economics, statistics, electrical engineering)
- **All of PubMed** (bulk download via NCBI FTP)
- **USPTO + EPO + JPO bulk** (all patents, all classifications)
- **Historical STEM corpora** (Wikisource scientific texts, Gallica scientific collections, Internet Archive scientific books back to 1600)
- **Preprint servers**: bioRxiv, medRxiv, PsyArXiv, ChemRxiv, SSRN
- Target: 200-500M entities

### Phase 3: All-knowledge
- **All of Phase 2** plus:
- **Multilingual scientific corpora** with translation-then-fingerprint preprocessing (Chinese via CNKI, Japanese via J-STAGE, Russian historical science, Arabic medieval science texts, Indian mathematical history texts, classical Latin and Greek technical texts)
- **Wikisource all languages** scientific and technical sections
- **Internet Archive all digitized technical books** with decent OCR
- **Royal Society Proceedings back to 1665**
- **Chronicling America** technical and scientific sections
- Target: 2-5B entities

All three phases run the same BTUT pipeline. Scaling is an ingestion and compute question, not a methodology question.

---

## Heterogeneous Entity Schema

Every corpus ingestion produces entities of six types, following the pattern validated across five domains in the cross-era detection investigation:

| Type | What it is | Edge types |
|---|---|---|
| **chunk** | 15-word sliding window of text from a document | `part_of_writing`, `mentions_concept`, `authored_by` |
| **person** | Named author, historical figure, scientist | `authored`, `contemporary_of`, `influenced_by` |
| **concept** | Named technical concept extracted from the text | `defined_in`, `related_to`, `modernizes` |
| **event** | Named historical event, experiment, publication, patent filing | `occurred_at`, `involves`, `temporal_before` |
| **location** | Institution, city, country, laboratory | `location_of`, `produced_at` |
| **writing** | Paper, book, patent, manuscript | `contains_chunks`, `authored_by`, `cites`, `references` |

The six-type schema is what makes BTUT work correctly. Uniform chunks-only corpora auto-scale to a single cascade level and produce uninformative results. This was empirically established during the investigation.

---

## Query Semantics (Formal)

### `route_to_ancestors(query_text, k=20)`

1. Chunk `query_text` at 15-word boundaries
2. Compute multi-resolution fingerprints for each chunk using the same hash function as the lattice
3. For each fingerprint, find all lattice clusters it belongs to at each resolution
4. Filter clusters to those containing at least one historical-era entity
5. Rank historical entities by: `cross_era_cluster_count * composite_specificity * inverse_era_distance`
6. Return top k historical entities with their containing documents

Mathematically: for a query q with fingerprint set F(q), the set of historical ancestors is

$$A(q) = \{e : e \in E_{hist}, \exists c \in \text{Clusters}(F(q)), e \in c\}$$

ranked by the count of matching clusters weighted by specificity.

### `compute_novelty(query_text)`

1. Compute fingerprint distance from query to nearest lattice cluster at each resolution
2. Novelty score = weighted sum of distances, with medium-resolution weighted highest
3. High novelty = the query's fingerprint does not land inside any existing dense cluster
4. Return novelty score + k nearest matches (for the reviewer to verify)

The scalar is computable, reproducible, and (critically) independent of whether anyone has ever cited the nearest match.

### `find_lost_knowledge()`

1. Enumerate all lattice clusters
2. For each cluster, compute the era distribution of its entities
3. Return clusters where 80%+ of entities are pre-1950 and 0% are post-2000
4. These are clusters where historical work exists but has no modern descendants in the corpus
5. Human deep reading confirms whether the historical work is actually lost or merely specialized

### `find_genuine_novelty()`

Mirror image of `find_lost_knowledge`: clusters with 80%+ post-2010 entities and no pre-1950 entities. These are candidate genuinely-novel modern ideas with no structural ancestor in the preserved record.

---

## Success Metrics

### Phase 1 (physics single-domain at scale)

| Metric | Target |
|---|---|
| Entities ingested | 5-20M |
| BTUT survivors | 1-5M |
| Cross-era clusters | 100k+ |
| Known-lineage validation accuracy | ≥ 90% (Maxwell→QED, Einstein→GR, etc.) |
| Medium-resolution signature replication | Yes |
| Query latency (p95) | < 2 seconds |

### Phase 2 (STEM complete)

| Metric | Target |
|---|---|
| Entities ingested | 200-500M |
| Novelty score agreement with expert review | Kendall tau ≥ 0.5 |
| Prior-art discovery vs human baseline | Match or exceed |
| Cross-domain lineage surfacing | ≥ 50 novel cross-domain connections in first year |

### Phase 3 (all-knowledge)

| Metric | Target |
|---|---|
| Languages covered | ≥ 10 |
| Preserved technical books ingested | ≥ 1M |
| Total entities | 2-5B |
| Storage | ≤ 3000TB (design target) |
| Public API uptime | ≥ 99.5% |

---

## Infrastructure Requirements

### Compute
- Ingestion: parallelizable, embarrassingly so. Phase 1 runs on a single workstation with good network. Phase 2-3 run on modest cluster (~32-128 cores continuous for ~4-8 weeks).
- BTUT lattice: scales linearly with corpus size at the pipeline level. The 3000TB/$200 target comes from the lattice reduction, not the ingestion.
- Query: fingerprint lookup is O(log n) with appropriate indexing. Query serving fits on a modest production server.

### Storage
- Raw corpus: ~1-10TB for Phase 1, ~100TB for Phase 2, ~3000TB for Phase 3
- Lattice store (post-BTUT): ~10-20% of raw corpus size
- Indexes: ~5% of lattice store size

### Network
- Phase 1 ingestion: ~1-10TB download from public sources
- Phase 2-3: significant bulk download from NCBI, USPTO, Internet Archive, Wikisource, Gallica, CNKI, J-STAGE

### Cost
- Phase 1: ~$500-2000 in compute and storage for a 30-day build
- Phase 2: ~$5000-20000
- Phase 3: ~$50000-200000 (depending on how aggressively the 3000TB/$200 target is pushed)

All three phases are feasible on independent-researcher budgets. None require hyperscaler commitments.

---

## Validation Strategy

Phase 1 validation is the critical gate. The linguistics run produced Saussure at #1 with the strongest cross-era cluster overlap landing on distributional semantics — the known correct lineage. Phase 1 must produce analogous results at 10-100x scale:

| Known historical→modern physics lineage | Expected LATK cluster result |
|---|---|
| Maxwell electromagnetism → modern QED / gauge theory | Maxwell at top 5% anomalies, ≥5 shared clusters with QED papers |
| Einstein 1915 GR → modern cosmology | Einstein at top 5%, ≥5 shared clusters with cosmology papers |
| Boltzmann statistical mechanics → modern condensed matter | Boltzmann at top 5%, ≥5 shared clusters with condensed matter |
| Feynman 1949 → modern quantum field theory | Feynman at top 5%, ≥10 shared clusters with QFT papers |
| Dirac 1928 → modern quantum mechanics | Dirac at top 5%, ≥10 shared clusters with QM textbooks |
| Heisenberg 1925 → modern quantum optics | Heisenberg at top 5%, ≥5 shared clusters with QO |
| Planck 1900 → modern blackbody / statistical physics | Planck at top 5%, ≥5 shared clusters |

If ≥6 of 7 validation targets hit, Phase 1 is successful and Phase 2 launches. If fewer hit, the failure mode is analyzed (ingestion quality? chunking parameters? missing entity types?) and Phase 1 is re-run.

---

## What LATK Will Not Do

Honest boundaries preserved from the five-domain validation synthesis:

- **Will not discover physics autonomously.** It surfaces structural similarity; humans formalize.
- **Will not prove historical causation.** Structural identity ≠ documented influence.
- **Will not handle tacit or unpublished knowledge.** Text only.
- **Will not replace peer review.** Novelty scores inform reviewers; they don't replace judgment.
- **Will not eliminate bad papers.** Novelty is one axis; quality is a separate question.
- **Will not replace domain experts.** It routes attention; deep reading is irreplaceable.

These boundaries are the same as the ones the five-domain investigation established. Nothing in Phase 0 changes them.

---

## Relationship to Existing Infrastructure

LATK builds on:

- **BTUT lattice engine** (already exists) — the multi-resolution fingerprint pipeline
- **CET tool** (already exists, committed `ace5b93`) — the corpus config, chunking, discriminator, CLI
- **5-domain validation** (already exists, committed `cf31e41`, `622c1a0`) — methodology proof

LATK adds:

- **Ingestion adapters** for arXiv, USPTO, PubMed, Gallica, Internet Archive (scaffolded in this Phase 0)
- **Novelty query module** — fingerprint new text against existing lattice (scaffolded in this Phase 0)
- **Scale test** at 8000+ entities merged from all five validated domains (executed in this Phase 0)
- **Lattice persistence layer** — index the survivors for query (Phase 1)
- **Query API server** — HTTP interface to the lattice (Phase 1)
- **Phase 1 corpus builders** — physics single-domain at scale (Phase 1)

The Phase 0 deliverables are all buildable in a single development session. Phases 1-3 are scaling runs that require compute budget and wall-clock time outside a session.

---

## Single-Sentence Summary

LATK is the structural atlas of all preserved human technical knowledge, computed by running the BTUT+CET pipeline validated across five independent domains on the full heterogeneous corpus of historical and modern technical writing, exposing novelty-as-scalar, prior-art-as-lookup, lost-knowledge-as-cluster-anomaly, and cross-era-lineage-as-computable-graph to researchers, patent examiners, historians, peer reviewers, and AI agents.
