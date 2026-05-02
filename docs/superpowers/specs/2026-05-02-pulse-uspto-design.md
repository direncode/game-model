# Pulse — USPTO Inventor Disambiguation — Design Spec

**Date:** 2026-05-02
**Owner:** Latent Ocean (lsx)
**Status:** approved for implementation
**Reference artifacts:** `/docsouth`, `/atlas/arxiv` (the substrate Pulse extends)

## Purpose

Public, citable artifact at `/pulse/uspto-inventors` (and tenant `pulse_showcase`) demonstrating that Latent Ocean's BTUT formation pipeline produces a deterministic, reproducible inventor-disambiguation over US patent records. Headline claim: fifty years of US innovation, deterministically disambiguated, citable forever, with multi-baseline cluster purity (engine vs PatentsView vs DOCDB vs naive-name-collision vs chance) as the centerpiece. Pulse extends the substrate into the buyer category of IP attorneys, M&A due-diligence teams, corporate IP, and academic innovation economists.

Pulse is the second of three new public showcases (Atlas shipped 2026-05-02; Receipt is queued). Each ships independently against its own design spec.

## Out of scope

- Receipt (SEC EDGAR 10-K AI summarization audit trail) — separate brainstorm + spec, structurally different product (audit trail, not BTUT formation).
- Lifting `MAX_CHUNKS = 100` in `frontend/lib/range/form.ts:25`. The 500k record ceiling is honored via two-stage sampling, identical reasoning as Atlas.
- USPTO bulk XML parsing. PatentsView's bulk TSV is used as the upstream source because it is itself derived from USPTO XML and ships pre-parsed with PatentsView's disambig_inventor_id (the gold standard for the purity claim).
- Patent claims / description text. Pulse fingerprints inventor-records, not patent-records, so patent text is irrelevant.
- Pre-1976 patents (Mary Anderson's 1903 windshield-wiper patent and similar). USPTO bulk doesn't go back that far; the cutoff is honest disclosure on the page.

## Decisions locked in (clarifying questions)

| Q | Decision | Reason |
|---|---|---|
| Q1 corpus scope | Full historical 1976-2025, stratified to 500k inventor-records | Preserves "fifty years of US innovation" framing. Substrate ceiling honored. |
| Q2 fingerprint payload | Canonicalized name (Surname I I) + co-inventor list + assignee + city/state | Strict unsupervised-disambiguation claim. PatentsView's inventor_id never appears in the fingerprint. Patent title/abstract excluded — they push records apart, not together, for the disambiguation use case. |
| Q3 gold standard | Multi-baseline panel: engine vs PatentsView (gold) vs DOCDB (USPTO's coarser) vs naive-name-collision vs chance | Honest framing. Every disambiguation system is itself an algorithm. |
| Q4 sampling | Two-stage: full coverage for canonical-names with ≤ K appearances; stride-sample ultra-common names | Preserves disambiguation signal for typical inventors (e.g., Lonnie Johnson, uncommon name). Down-samples only "John Smith"-class ultra-common names. |
| Q5 singular inventors | Static analyze-only detection. Per cluster compute (productivity, IPC entropy, career-span, solo-share). Flag top candidates without naming. | Honest. No prose claim that the engine "discovered" the named figures. Readers click through to USPTO and judge. |
| Q-arch | Refactor first: extract shared primitives to `scripts/_showcase_lib.py`, then build Pulse on top | Three duplications is enough motivation. Atlas's 23-test suite must stay green through the refactor. |

## Constraints

- Honor `MAX_CHUNKS = 100` ceiling. Sample down to 500k records.
- No new backend code. Reuse `/api/range-form` for formation, `/api/range-public/showcase/<slug>` for read (extend allowlist with three new slugs).
- Existing `/pulse` route is the Pulse product page. The showcase goes at `/pulse/uspto-inventors` (same pattern as `/atlas/arxiv`).
- Tenant: `pulse_showcase`, minted via existing `/api/range-demo-token` flow.
- Page voice mirrors `/atlas/arxiv`: scholarly-pace prose, full method disclosure, multi-baseline panel, named-most-prolific records with click-throughs to the canonical USPTO patent URLs.
- IP framing: trade secret plus OpenTimeStamps anchoring. Never claim "patents filed."
- Atlas's 23 tests must continue to pass after the refactor.

## Architecture

### Phase 0: shared library extraction

```
scripts/
  _showcase_lib.py             # NEW shared module
  arxiv_analyze.py             # MODIFIED to import primitives from _showcase_lib
tests/
  scripts/
    test_showcase_lib.py       # consolidated tests for shared primitives
    test_arxiv_analyze.py      # MODIFIED to import primitives from _showcase_lib
                               #          (existing 23 tests preserve)
```

`scripts/_showcase_lib.py` owns these primitives (currently duplicated across docsouth_analyze.py, arxiv_analyze.py):

- `hamming48(a, b)` — bit-counted XOR distance
- `weighted_purity(labels, golds)` — cluster-vs-gold purity, returns (number, rows)
- `assign_to_class(fp48, classes)` — nearest-centroid assignment
- `decade_of(year)` — "1990s" / "2000s" / "2010s" / "2020s"
- `category_entropy(items)` — Shannon entropy
- `top_rare(survivors, k)` — rank by min-Hamming distance
- `bleed_per_class(survivors, classes)` — per-cluster off-archive bleed analysis
- `flag_emergence_candidates(cluster_meta, ...)` — young+tight+diverse filter
- `stride_sample(items, target)` — deterministic stride sampling

Atlas-specific logic (build_public_artifact, baseline_panel, archive_of) stays in `scripts/arxiv_analyze.py`. Pulse-specific logic (canonical_name, baseline_disambiguators, singular_inventor_flag) stays in `scripts/pulse_analyze.py`.

### Phase 1+: new Pulse files

```
scripts/
  pulse_harvest.py             # PatentsView TSVs -> /data/formed_models/_inputs/pulse.ndjson
  pulse_analyze.py             # imports from _showcase_lib, adds disambiguation primitives
  pulse_constellations.py      # 100-finding catalog generator
  pulse_verify.sh              # port of atlas_verify.sh

showcases/
  pulse.json                   # local committed snapshot of public artifact
  pulse_findings.json          # local committed findings catalog

frontend/app/pulse/uspto-inventors/
  page.tsx                     # long-form artifact
  PulseData.tsx                # client component, fetches /api/range-public/showcase/pulse
  constellations/
    page.tsx                   # findings catalog
    PulseFindings.tsx          # client component, fetches /showcase/pulse-findings
```

Allowlist extension in `frontend/app/api/range-public/showcase/[slug]/route.ts`:
```ts
pulse:                  "uspto.json",
"pulse-constellations": "uspto_constellations.json",
"pulse-findings":       "pulse_findings.json",
```

## Components

### `scripts/_showcase_lib.py`

Shared primitives. Pure functions, no IO except where specified. Currently 9 functions extracted from arxiv_analyze.py (and duplicated in docsouth_analyze.py).

### `scripts/pulse_harvest.py`

- Inputs: PatentsView bulk TSV files pinned to a specific snapshot date:
  - `g_inventor_disambiguated.tsv` — patent_id, inventor_id, name_first, name_last, location_id
  - `g_inventor_not_disambiguated.tsv` — raw inventor strings as they appear on the patent (for the naive-name baseline)
  - `g_assignee_disambiguated.tsv` — patent_id, assignee_id, organization_name
  - `g_location_disambiguated.tsv` — location_id, city, state, country
  - `g_patent.tsv` — patent_id, grant_date, title, primary_ipc_class
- Per-record output (one inventor-appearance):
  ```json
  {
    "patent_id": "10000000",
    "inventor_seq": 0,
    "raw_name": "Smith, John W.",
    "canonical_name": "Smith J W",
    "co_inventors_canonical": ["Chen A B", "Garcia M"],
    "assignee_id": "12345",
    "assignee_name": "Apple Inc.",
    "city": "Cupertino",
    "state": "CA",
    "country": "US",
    "primary_ipc": "G06F",
    "year": 2017,
    "patentsview_inventor_id": "abc123def456",
    "raw_assignee_string": "APPLE INC",
    "text": "Smith J W | Chen A B; Garcia M | 12345 | Cupertino CA US"
  }
  ```
- **`text` field** is the BTUT fingerprint payload. Note: `patentsview_inventor_id` is in the record metadata but **not in `text`** — same firewall as Atlas (categories not in fingerprint).
- Two-stage sampling per Q4:
  1. Group by canonical_name globally
  2. For canonical_names with ≤ K appearances total (where K is configurable, default 100), keep all
  3. For ultra-common names (> K appearances), apply stride sampling within the canonical-name bucket to bring down to K
  4. Across all years, target a final 500k records via outer stride if needed
- Sort by patent_id ascending, canonical_name ascending. Canonical JSON serialization, byte-identical re-runs.
- Emits `corpus_input_sha256` (concatenation of input TSV file hashes) and `corpus_sha256` (the harvested NDJSON's hash).

### `scripts/pulse_analyze.py`

- Inputs: BTUT survivors via `/api/range-form/<model_id>`, corpus NDJSON, taxonomy.
- Computes:
  - **Cluster purity vs. PatentsView** (the headline number): treat each PatentsView inventor_id as a gold label, compute weighted purity over engine clusters.
  - **Cluster purity vs. DOCDB** (USPTO's coarser disambiguation; if available in PatentsView's bulk).
  - **Cluster purity vs. naive-name-collision**: collapse all records with identical canonical_name to a single "naive cluster," compute weighted purity.
  - **Chance baseline**: 1 / N where N = number of PatentsView inventors in the sampled corpus.
  - **Decade trajectory**: per decade, count of disambiguated inventors active, top archive (IPC class) shares.
  - **Cross-IPC bleed (the polymath signal)**: per disambiguated inventor cluster, compute IPC Shannon entropy; flag inventors who span multiple IPC classes.
  - **Top-25 rarest survivors** (structurally distant, click-throughable to USPTO).
  - **Singular-inventor candidates** per Q5: per cluster compute (patent_count, ipc_entropy, career_span, solo_share). Flag top-N who score high on all four. **No naming** — surface metrics + USPTO links, let readers judge.
- Output: `/data/formed_models/_public/uspto.json`. Schema mirrors `arxiv.json` plus disambiguation-specific blocks (`baseline_disambiguators`, `singular_inventor_candidates`, `polymath_bleed`).

### `scripts/pulse_constellations.py`

100-finding catalog grouped into thematic constellations:
- `singular_inventor_candidates` (top-25 disambiguated inventors flagged by all four signals)
- `disambiguation_disagreements` (cases where engine clusters two PatentsView inventor_ids together, or splits one across two clusters — interesting for the IP-attorney buyer)
- `cross_ipc_polymaths` (inventors with IPC entropy ≥ threshold, exposing cross-domain breadth)
- `decade_productivity_shifts` (per-decade movement of top-1% inventors by productivity)
- `assignee_disambiguation_signals` (the engine's view of how distinct two assignee strings really are — bonus finding)
- `baseline_comparison` (engine vs PatentsView vs DOCDB vs naive-name vs chance; same shape as Atlas's baseline-panel findings)
- `structurally_singular_patents` (rare-records list applied to inventor-records)

### `scripts/pulse_verify.sh`

Direct port of `scripts/atlas_verify.sh`. Tenant token at `/tmp/.pulsetoken`. Public read endpoint check: `/api/range-public/showcase/pulse`. Same 7 query intents and determinism check.

### `frontend/app/pulse/uspto-inventors/page.tsx`

Long-form artifact mirroring `/atlas/arxiv` shape. Hero, preface, corpus, live artifact (PulseData), limits, acknowledgements. Headline: "Fifty years of US innovation, deterministically disambiguated."

### `frontend/app/pulse/uspto-inventors/PulseData.tsx`

Client component, fetches `/api/range-public/showcase/pulse`. Renders:
- Corpus stats (records, inventors, snapshot, formed)
- Multi-baseline disambiguation panel (engine, PatentsView, DOCDB, naive, chance)
- Decade productivity trajectory
- Polymath / cross-IPC bleed
- Singular inventor candidates panel (no naming)
- Top-25 structurally singular inventor-records (click-through to USPTO patent page)
- Verification fields

### `frontend/app/pulse/uspto-inventors/constellations/`

Mirrors `/atlas/arxiv/constellations/` shape. Category filter pills, finding cards, USPTO clickthroughs.

## Data flow

```
[1] Pin PatentsView snapshot date (e.g., 2026-04 quarterly)
[2] Download PatentsView TSVs to EC2:
    g_inventor_disambiguated.tsv
    g_inventor_not_disambiguated.tsv
    g_assignee_disambiguated.tsv
    g_location_disambiguated.tsv
    g_patent.tsv
[3] sha256(concatenated input files in fixed order) -> corpus_input_sha256
[4] scripts/pulse_harvest.py
    Join TSVs, apply two-stage sampling, write NDJSON
    Output: /data/formed_models/_inputs/pulse.ndjson (~500k records)
[5] sha256(NDJSON) -> corpus_sha256
[6] Mint pulse_showcase tenant token
[7] POST /api/range-form (server-side chunked)
    BTUT formation across ~100 chunks
    Wall: ~25-30 minutes (smaller per-record payload than Atlas, faster fingerprinting)
    Output: model_id, response_digest, taxonomy_summary
[8] GET /api/range-form/<model_id>
[9] scripts/pulse_analyze.py -> /data/formed_models/_public/uspto.json
[10] scripts/pulse_constellations.py -> showcases/pulse_findings.json
[11] scripts/pulse_verify.sh -> 7 query digests, cross-tenant probe, audit pull
[12] Commit showcases/pulse.json + showcases/pulse_findings.json
[13] Allowlist extension committed in route.ts
[14] Deploy
```

Steps [1]-[11] run on EC2. Steps [12]-[14] run from the dev box.

## Reproducibility recipe

> Verify Pulse yourself. Download PatentsView's bulk TSVs pinned at YYYY-MM-DD. Confirm `sha256(concatenated TSVs) = <corpus_input_sha256>`. Run `scripts/pulse_harvest.py` against them. Confirm `sha256(pulse.ndjson) = <corpus_sha256>`. Re-issue the seven query intents against `model_id=<id>` and confirm each `response_digest` matches the published value byte-for-byte.

Public-artifact fields (mirroring Atlas's recipe):

| Field | Source | Frozen by |
|---|---|---|
| `patentsview_snapshot_date` | the pinned PatentsView quarterly | upstream PatentsView |
| `corpus_input_sha256` | sha256 over concatenated input TSVs | the bytes |
| `corpus_records` | NDJSON line count | the harvester |
| `corpus_sha256` | sha256 of the NDJSON | harvester determinism |
| `model_id` | engine-issued | one-shot |
| `response_digest` | per-query, 7 intents | engine determinism |

What the verifier proves and does NOT prove are identical to Atlas's disclosures.

## Failure modes and mitigations

### Disambiguation-specific risks

| Risk | Mitigation |
|---|---|
| PatentsView's disambig_inventor_id is itself approximate. Treating it as gold is a known approximation. | Multi-baseline panel makes the "PatentsView vs engine vs DOCBD vs naive" comparison the headline rather than "engine vs God's-eye-view truth." Honest disclosure on the page. |
| Common-name down-sampling drops some appearances of "John Smith" inventors. | Two-stage sampling minimizes loss for typical inventors (≤ K appearances kept fully). The named-singular-inventor candidates with uncommon names (Lonnie Johnson, Patricia Bath) are unaffected. Disclosed. |
| Co-inventor canonical-name normalization can mis-associate. "John Smith" co-inventor on patent A might or might not be the same "John Smith" as on patent B. | Co-inventor presence is one signal among several; the fingerprint also has assignee, city, state. The whole point of the structural fingerprint is that no single signal dominates. Mitigation: trust the multi-signal cluster, not the per-record collision. |
| Pre-1976 inventors are absent from USPTO bulk. The named figures Mary Anderson (1903 windshield wiper) and similar are not in the corpus. | Disclosed in the limits section. The artifact frames itself as "fifty years 1976-2025," not "all-time US innovation." |

### Refactor risks

| Risk | Mitigation |
|---|---|
| Atlas's 23 tests fail after the `_showcase_lib.py` extraction. | Extract first, immediately re-run `pytest tests/scripts/test_arxiv_analyze.py`, fix any imports. The primitives are pure functions; extraction is mechanical. |
| New shared module pulls in dependencies (sklearn, etc.). | The shared primitives are stdlib-only (Counter, defaultdict, math). sklearn stays in arxiv_analyze.py and pulse_analyze.py for the baseline panels. |
| docsouth_analyze.py also has duplicated primitives but doesn't get migrated in v1. | Acceptable. DocSouth ships, doesn't need touching. The library is opt-in. Migration is a separate cleanup item if useful later. |

### Run-scale risks (mostly inherited from Atlas, validated by the Atlas run)

| Risk | Mitigation |
|---|---|
| 100-chunk formation: ~30 min wall time. Smaller per-record payload than Atlas, faster. | Same trigger pattern as Atlas. Run from EC2 with nohup or tmux. |
| Survivor-merge memory at 500k records × 100 chunks. | Atlas validated this at scale. No new concern. |
| Public artifact JSON size. | Same shape as Atlas: only headline numbers + top-25 rare + cluster summaries serialized. |

## Pre-implementation action items

None. Phase 0 of Atlas already validated the substrate constraints (MAX_CHUNKS, RunPod call site, allowlist pattern). Pulse rides on the same answers.

## Acceptance criteria

The Pulse v1 artifact ships when:

- `/data/formed_models/_public/uspto.json` exists on production with all required fields (`corpus_input_sha256`, `corpus_sha256`, `corpus_records`, `model_id`, `response_digest`, `taxonomy_summary`, decade-trajectory, top-25 rare, singular-inventor-candidates, baseline_disambiguators, polymath-bleed).
- `scripts/pulse_verify.sh` returns 7/7 PASS on the seven query intents.
- Cross-tenant probe with a non-`pulse_showcase` token returns 404.
- Audit log retrievable in JSON, CEF, OCSF.
- `https://www.latentocean.com/pulse/uspto-inventors` renders the long-form artifact page with all data sections populated.
- `https://www.latentocean.com/pulse/uspto-inventors/constellations` renders the findings catalog.
- Prose on the page quotes only numbers and named records that exist in `_public/uspto.json`.
- `showcases/pulse.json` and `showcases/pulse_findings.json` committed to the repo.
- Atlas's 23 tests still pass after the `_showcase_lib.py` refactor.
- Verification recipe printed on the page, executable by a third party against the published hashes.

## Sequencing into Receipt

After Pulse v1 ships:

1. Receipt brainstorm + spec + plan + implementation. Receipt is structurally different (audit-trail, not BTUT formation), so the `_showcase_lib.py` library mostly doesn't apply.
2. After Receipt ships, all four showcases (DocSouth, Atlas, Pulse, Receipt) make the case for Vault as the underlying platform.
