# Atlas — arXiv Reproducible Cross-Discipline Structural Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public Atlas v1 artifact at `/atlas` (mirrors `/docsouth`) over the full arXiv corpus, with corpus_input_sha256 + corpus_sha256 + per-query response_digest reproducibility.

**Architecture:** Tight DocSouth clone. Four scripts in `scripts/`, two Next.js pages, two local-committed showcase JSONs. No new backend code. All eight DocSouth widgets reused unchanged. Tenant `atlas_showcase`, parallel to `docsouth_showcase`.

**Tech Stack:** Python 3.11+ (scripts: stdlib + sklearn), Next.js / React / TypeScript (pages), bash (verify), existing BTUT bridge at `/api/range-form` (formation), Kaggle bulk snapshot (corpus).

**Testing:** TDD on the harvester + analyze pure functions (deterministic byte output, weighted_purity, decade trajectory, emergence-candidate filter). Integration on the verify shell script against the existing DocSouth model. Manual verify on the page render in browser preview.

**Reference spec:** `docs/superpowers/specs/2026-05-02-atlas-arxiv-design.md`

---

## Phase 0 — Pre-implementation reconnaissance 🔴

Read-only investigations. The two action items in the spec must be answered before writing scripts.

### Task 0.1 — Confirm `/api/range-form` chunking is server-side

**Files:**
- Read: `frontend/app/api/range-form/route.ts` (or `frontend/pages/api/range-form.ts` — locate via Glob first)
- Read: `backend/app/api/v1/range.py:37-110` (the bridge handler)

- [ ] Glob `frontend/app/api/range-form/**` and `frontend/pages/api/range-form*` to locate the Next.js handler.
- [ ] Read the handler. Confirm it:
  - Accepts a corpus path or NDJSON,
  - Loops over chunks of ≤5000 records server-side,
  - Calls the backend `/api/v1/range/form` per chunk,
  - Merges survivors and persists the model.
- [ ] If chunking is client-side or absent: STOP and add a Phase 0.1b task to design a server-side chunked driver before proceeding.
- [ ] Write findings into a 5-line note at the top of `scripts/arxiv_runbook.md` (created later in Task 7.1; for now save a TODO note in `/tmp/atlas_recon.md`).

### Task 0.2 — Confirm RunPod finalize is once-at-merge, not per-chunk

**Files:**
- Read: `backend/app/services/btut/pipeline.py` (locate via Glob)

- [ ] Glob `backend/app/services/btut/**/*.py` and `lo_core/**/runpod*.py`.
- [ ] Read `run_btut_pipeline` (called from `range.py:78`). Locate where RunPod is invoked.
- [ ] Confirm RunPod is called once at the merged-survivor stage (not 500× per chunk).
- [ ] If per-chunk: STOP and flag for redesign — running RunPod 500× would multiply cost ~60×.
- [ ] Save findings to `/tmp/atlas_recon.md`.

### Task 0.3 — Confirm `/api/range-public/showcase/<name>` reads by name

**Files:**
- Read: `frontend/app/api/range-public/showcase/[name]/route.ts` (locate via Glob)

- [ ] Glob `frontend/app/api/range-public/**`.
- [ ] Read the handler. Confirm:
  - It reads `/data/formed_models/_public/<name>.json` (or equivalent path),
  - It accepts an arbitrary `<name>` (no hard-coded list of valid names),
  - No auth required (public read).
- [ ] If hard-coded to a small list: add Task 5.0 to register `atlas` as an allowed name.
- [ ] Save findings to `/tmp/atlas_recon.md`.

### Task 0.4 — Commit the recon notes

- [ ] Move `/tmp/atlas_recon.md` to `docs/superpowers/specs/2026-05-02-atlas-arxiv-recon.md`.
- [ ] `git add docs/superpowers/specs/2026-05-02-atlas-arxiv-recon.md && git commit -m "docs(atlas): pre-implementation recon notes"`

---

## Phase 1 — Harvester 🔴

Build `scripts/arxiv_harvest.py`. Test-driven on a small fixture before pointing it at the 1.5 GB Kaggle dump.

### Task 1.1 — Test fixture: a 5-record mini Kaggle dump

**Files:**
- Create: `tests/scripts/fixtures/arxiv_mini.json`
- Create: `tests/scripts/fixtures/arxiv_mini_expected.ndjson`

- [ ] Create `tests/scripts/fixtures/arxiv_mini.json` containing 5 newline-delimited Kaggle-format records. Include:
  - Record 1: normal cs.LG paper, two categories
  - Record 2: a withdrawn paper (abstract starts with "This paper has been withdrawn by the author")
  - Record 3: a math.NT paper, single category
  - Record 4: a paper updated after the snapshot date (`update_date: "2999-01-01"`) — should be filtered
  - Record 5: a normal physics paper

```json
{"id":"1706.03762","title":"Attention Is All You Need","abstract":"The dominant sequence transduction models...","categories":"cs.CL cs.LG","authors":"Vaswani Ashish, ...","update_date":"2017-12-06"}
{"id":"0001.00001","title":"A Withdrawn Paper","abstract":"This paper has been withdrawn by the author due to errors.","categories":"cs.AI","authors":"Doe Jane","update_date":"2020-01-01"}
{"id":"math/0301001","title":"On the Riemann Hypothesis","abstract":"We discuss recent progress on RH...","categories":"math.NT","authors":"Smith John","update_date":"2003-01-15"}
{"id":"2999.99999","title":"Future Paper","abstract":"From the future.","categories":"cs.AI","authors":"Time Traveler","update_date":"2999-01-01"}
{"id":"hep-th/9901001","title":"On Some String Theory","abstract":"We compute the partition function...","categories":"hep-th","authors":"Witten Edward","update_date":"1999-01-15"}
```

- [ ] Create `tests/scripts/fixtures/arxiv_mini_expected.ndjson` with the expected harvest output (3 records — the withdrawn and future-dated are filtered, others are sorted by paper_id ascending).

### Task 1.2 — Write failing test for record schema + filter

**Files:**
- Create: `tests/scripts/test_arxiv_harvest.py`

```python
"""Tests for scripts/arxiv_harvest.py."""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import arxiv_harvest  # noqa: E402


FIXTURE_INPUT = REPO / "tests" / "scripts" / "fixtures" / "arxiv_mini.json"
FIXTURE_EXPECTED = REPO / "tests" / "scripts" / "fixtures" / "arxiv_mini_expected.ndjson"
SNAPSHOT_DATE = "2026-04-30"  # nominal snapshot date for the fixture


def test_harvest_drops_withdrawn_and_future_papers(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out, snapshot_nominal_date=SNAPSHOT_DATE)
    lines = [json.loads(l) for l in out.read_text().splitlines() if l.strip()]
    assert len(lines) == 3, f"expected 3 surviving records, got {len(lines)}"
    paper_ids = [r["paper_id"] for r in lines]
    assert "0001.00001" not in paper_ids, "withdrawn paper not filtered"
    assert "2999.99999" not in paper_ids, "future-dated paper not filtered"


def test_harvest_record_schema(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out, snapshot_nominal_date=SNAPSHOT_DATE)
    lines = [json.loads(l) for l in out.read_text().splitlines() if l.strip()]
    rec = next(r for r in lines if r["paper_id"] == "1706.03762")
    assert rec["primary_category"] == "cs.CL"
    assert rec["archive"] == "cs"
    assert rec["categories"] == ["cs.CL", "cs.LG"]
    assert rec["year"] == 2017
    assert rec["authors_count"] >= 1
    assert rec["title"] == "Attention Is All You Need"
    assert rec["text"].startswith("Attention Is All You Need\n\n")


def test_harvest_sorted_by_paper_id(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out, snapshot_nominal_date=SNAPSHOT_DATE)
    lines = [json.loads(l) for l in out.read_text().splitlines() if l.strip()]
    ids = [r["paper_id"] for r in lines]
    assert ids == sorted(ids), f"records not sorted by paper_id: {ids}"


def test_harvest_byte_identical_on_rerun(tmp_path):
    out_a = tmp_path / "a.ndjson"
    out_b = tmp_path / "b.ndjson"
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out_a, snapshot_nominal_date=SNAPSHOT_DATE)
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out_b, snapshot_nominal_date=SNAPSHOT_DATE)
    sha_a = hashlib.sha256(out_a.read_bytes()).hexdigest()
    sha_b = hashlib.sha256(out_b.read_bytes()).hexdigest()
    assert sha_a == sha_b, "harvester output is not byte-identical between runs"


def test_harvest_matches_expected_fixture(tmp_path):
    out = tmp_path / "arxiv.ndjson"
    arxiv_harvest.run(input_path=FIXTURE_INPUT, output_path=out, snapshot_nominal_date=SNAPSHOT_DATE)
    assert out.read_text() == FIXTURE_EXPECTED.read_text(), \
        "harvester output does not match expected fixture (regen the fixture intentionally if the schema changed)"
```

- [ ] Run `pytest tests/scripts/test_arxiv_harvest.py -v`
- [ ] Expected: ALL FAIL with `ModuleNotFoundError: arxiv_harvest`.

### Task 1.3 — Implement minimal harvester

**Files:**
- Create: `scripts/arxiv_harvest.py`

```python
#!/usr/bin/env python3
"""
arXiv harvest: pinned Kaggle snapshot -> deterministic NDJSON corpus.

Reads the Kaggle arXiv-metadata-oai-snapshot file (newline-delimited JSON,
one record per arXiv paper). Filters withdrawn papers and papers whose
update_date is after the pinned snapshot date. Emits per-record NDJSON
sorted by paper_id ascending so re-runs are byte-identical.

The fingerprint payload (`text`) is title + "\n\n" + abstract only.
Categories and authors are kept as metadata fields but NOT in `text` —
this keeps cluster-purity-vs-categories an honest unsupervised claim.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

WITHDRAWN_RE = re.compile(r"^\s*This (paper|article|submission) has been withdrawn", re.IGNORECASE)


def _parse_year(update_date: str) -> int:
    if not update_date or len(update_date) < 4:
        return 0
    try:
        return int(update_date[:4])
    except ValueError:
        return 0


def _archive_of(primary_category: str) -> str:
    """Map a primary category like 'cs.LG' to its top-level archive 'cs'.
    Special cases: legacy categories without dots (e.g. 'hep-th') are their own archive."""
    if "." in primary_category:
        return primary_category.split(".", 1)[0]
    if "-" in primary_category:
        # legacy: hep-th -> physics archive group; for v1 keep the dash form as the archive name
        return primary_category
    return primary_category


def _record_filter(rec: dict, snapshot_nominal_date: str) -> bool:
    """Return True if the record should be kept."""
    abstract = (rec.get("abstract") or "").strip()
    if not abstract:
        return False
    if WITHDRAWN_RE.match(abstract):
        return False
    update_date = rec.get("update_date") or ""
    if update_date and update_date > snapshot_nominal_date:
        return False
    return True


def _to_record(rec: dict) -> dict:
    paper_id = rec["id"]
    title = (rec.get("title") or "").strip()
    abstract = (rec.get("abstract") or "").strip()
    categories_raw = (rec.get("categories") or "").strip()
    categories = categories_raw.split() if categories_raw else []
    primary = categories[0] if categories else ""
    authors_raw = (rec.get("authors") or "").strip()
    authors_count = len([a for a in authors_raw.split(",") if a.strip()]) or (1 if authors_raw else 0)
    return {
        "paper_id":          paper_id,
        "primary_category":  primary,
        "archive":           _archive_of(primary),
        "categories":        categories,
        "year":              _parse_year(rec.get("update_date") or ""),
        "authors_count":     authors_count,
        "title":             title,
        "abstract":          abstract,
        "text":              f"{title}\n\n{abstract}",
    }


def run(input_path: Path, output_path: Path, snapshot_nominal_date: str) -> dict:
    """Read the Kaggle JSON, filter, transform, sort, write NDJSON. Returns stats."""
    input_path = Path(input_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    kept: list[dict] = []
    skipped_withdrawn = 0
    skipped_future = 0
    skipped_empty = 0
    total = 0

    with input_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            total += 1
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            abstract = (rec.get("abstract") or "").strip()
            if not abstract:
                skipped_empty += 1
                continue
            if WITHDRAWN_RE.match(abstract):
                skipped_withdrawn += 1
                continue
            update_date = rec.get("update_date") or ""
            if update_date and update_date > snapshot_nominal_date:
                skipped_future += 1
                continue
            kept.append(_to_record(rec))

    kept.sort(key=lambda r: r["paper_id"])

    with output_path.open("w", encoding="utf-8", newline="\n") as out:
        for rec in kept:
            out.write(json.dumps(rec, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
            out.write("\n")

    return {
        "input_path":            str(input_path),
        "output_path":           str(output_path),
        "total_input_records":   total,
        "kept_records":          len(kept),
        "skipped_withdrawn":     skipped_withdrawn,
        "skipped_future":        skipped_future,
        "skipped_empty":         skipped_empty,
    }


def _file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Harvest arXiv Kaggle snapshot into deterministic NDJSON.")
    p.add_argument("--input", required=True, type=Path, help="Path to arxiv-metadata-oai-snapshot.json")
    p.add_argument("--output", required=True, type=Path, help="Path to write arxiv.ndjson")
    p.add_argument("--snapshot-date", required=True, help="Nominal snapshot date YYYY-MM-DD")
    args = p.parse_args(argv)

    stats = run(args.input, args.output, args.snapshot_date)
    print(json.dumps(stats, indent=2))
    print(f"corpus_input_sha256: {_file_sha256(args.input)}")
    print(f"corpus_sha256:       {_file_sha256(args.output)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] Generate the expected fixture by running the harvester once on `arxiv_mini.json` and committing its output as `arxiv_mini_expected.ndjson`. Use `python scripts/arxiv_harvest.py --input tests/scripts/fixtures/arxiv_mini.json --output tests/scripts/fixtures/arxiv_mini_expected.ndjson --snapshot-date 2026-04-30`.
- [ ] Inspect the generated NDJSON; confirm 3 records, sorted, no withdrawn/future. If any field looks wrong, fix it in the harvester before declaring this the "expected" output.

### Task 1.4 — Run tests, verify all pass

- [ ] Run `pytest tests/scripts/test_arxiv_harvest.py -v`
- [ ] Expected: 5/5 PASS.
- [ ] If any test fails, fix the harvester (not the test) and re-run.

### Task 1.5 — Commit

```bash
git add scripts/arxiv_harvest.py tests/scripts/test_arxiv_harvest.py tests/scripts/fixtures/arxiv_mini.json tests/scripts/fixtures/arxiv_mini_expected.ndjson
git commit -m "feat(atlas): arXiv harvester with deterministic NDJSON output

Filters withdrawn papers and papers whose update_date is after the
pinned snapshot date. Sorts by paper_id ascending and uses canonical
JSON serialization so re-runs are byte-identical given the same input.
Fingerprint payload (text) is title+abstract only — categories stay
as metadata so cluster-purity-vs-categories remains an honest
unsupervised claim."
```

---

## Phase 2 — Analyze script 🔴

Build `scripts/arxiv_analyze.py`. Mirror the structure of `docsouth_analyze.py` but with arXiv-specific gold standards.

### Task 2.1 — Synthetic survivor fixture for analyze tests

**Files:**
- Create: `tests/scripts/fixtures/atlas_survivors.json`
- Create: `tests/scripts/fixtures/atlas_corpus.ndjson`

- [ ] Create `atlas_corpus.ndjson` with 24 synthetic records: 8 records each for archives `cs`, `math`, `physics`, spread across 1995, 2005, 2015, 2020 (2 per year per archive). Each record has the harvester schema.
- [ ] Create `atlas_survivors.json` representing the model meta the engine would return: 12 fp48Hex centroids (3 archives × 4 clusters each, deliberately constructed so the dominant-by-archive recovery is high) + per-survivor recordIdx pointing into the corpus. Build by hand — the synthetic fp48 values matter only insofar as Hamming distances put each record near the right centroid.

```python
# Helper for fixture generation (one-off, not committed as test code).
# Encode "archive" into the fp48: cs = 0xAAAAAAAAAAAA, math = 0x555555555555, physics = 0x0F0F0F0F0F0F.
# Then perturb 1-2 bits per record to give sub-cluster structure.
```

### Task 2.2 — Failing test for archive extraction + weighted_purity

**Files:**
- Create: `tests/scripts/test_arxiv_analyze.py`

```python
"""Tests for scripts/arxiv_analyze.py pure functions."""
from __future__ import annotations
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import arxiv_analyze  # noqa: E402


def test_archive_of_typical_categories():
    assert arxiv_analyze.archive_of("cs.LG") == "cs"
    assert arxiv_analyze.archive_of("math.NT") == "math"
    assert arxiv_analyze.archive_of("q-bio.GN") == "q-bio"
    assert arxiv_analyze.archive_of("physics.optics") == "physics"


def test_archive_of_legacy_dashed_category():
    # Legacy categories without a dot map to themselves
    assert arxiv_analyze.archive_of("hep-th") == "hep-th"
    assert arxiv_analyze.archive_of("astro-ph") == "astro-ph"


def test_weighted_purity_perfect():
    # All cluster-0 records are 'cs', all cluster-1 are 'math'
    labels = [0, 0, 0, 1, 1, 1]
    golds = ["cs", "cs", "cs", "math", "math", "math"]
    purity, rows = arxiv_analyze.weighted_purity(labels, golds)
    assert purity == 1.0
    assert len(rows) == 2


def test_weighted_purity_mixed():
    # cluster 0 is 2/3 cs, cluster 1 is 2/3 math
    labels = [0, 0, 0, 1, 1, 1]
    golds = ["cs", "cs", "math", "math", "math", "cs"]
    purity, _ = arxiv_analyze.weighted_purity(labels, golds)
    # Each cluster contributes its plurality share (2/3) weighted by size (3)
    # Total: (2 + 2) / 6 = 0.667
    assert abs(purity - 0.667) < 0.001


def test_decade_of_year():
    assert arxiv_analyze.decade_of(1995) == "1990s"
    assert arxiv_analyze.decade_of(2007) == "2000s"
    assert arxiv_analyze.decade_of(2017) == "2010s"
    assert arxiv_analyze.decade_of(2024) == "2020s"


def test_emergence_candidate_filter():
    # Three clusters: one young+tight+diverse, two not.
    cluster_meta = [
        {"cluster_id": 0, "median_year": 2018, "year_spread": 4, "category_entropy": 2.5},  # candidate
        {"cluster_id": 1, "median_year": 2002, "year_spread": 4, "category_entropy": 2.5},  # too old
        {"cluster_id": 2, "median_year": 2018, "year_spread": 12, "category_entropy": 2.5}, # too wide
    ]
    candidates = arxiv_analyze.flag_emergence_candidates(
        cluster_meta, min_median_year=2015, max_year_spread=5, min_category_entropy=2.0
    )
    assert [c["cluster_id"] for c in candidates] == [0]
```

- [ ] Run `pytest tests/scripts/test_arxiv_analyze.py -v`
- [ ] Expected: ALL FAIL with `ModuleNotFoundError: arxiv_analyze`.

### Task 2.3 — Implement the pure functions

**Files:**
- Create: `scripts/arxiv_analyze.py`

```python
#!/usr/bin/env python3
"""
Analyze the Atlas formed model and emit the public artifact JSON.

Joins BTUT survivor fingerprints back to the original corpus metadata
(paper_id, primary_category, archive, year). Computes:

  1. Cluster purity vs. 8 archive-level disciplines (headline)
  2. Cluster purity vs. ~152 primary subcategories (verification appendix)
  3. Decade trajectory 1990s, 2000s, 2010s, 2020s
  4. Cross-discipline bleed
  5. Top-25 rarest survivors (with arxiv_url click-through)
  6. Young+tight+diverse emergence candidates (no naming)
  7. Baseline panel (TF-IDF + KMeans, LDA)

Output: /data/formed_models/_public/arxiv.json
"""
from __future__ import annotations
import datetime
import hashlib
import json
import math
import os
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

_HOST_BASE = "/opt/latentocean/data/formed_models"
_CONT_BASE = "/data/formed_models"
_BASE = _CONT_BASE if os.path.isdir(_CONT_BASE) else _HOST_BASE
CORPUS_PATH = Path(f"{_BASE}/_inputs/arxiv.ndjson")
PUBLIC_OUT  = Path(f"{_BASE}/_public/arxiv.json")
TOKEN_PATH  = Path("/tmp/.atlastoken")
BASE_URL    = "https://www.latentocean.com"


def hamming48(a: int, b: int) -> int:
    x = a ^ b
    c = 0
    while x:
        x &= x - 1
        c += 1
    return c


def archive_of(primary_category: str) -> str:
    if "." in primary_category:
        return primary_category.split(".", 1)[0]
    return primary_category


def decade_of(year: int) -> str:
    if year < 1990:
        return "pre-1990s"
    return f"{(year // 10) * 10}s"


def weighted_purity(labels: list[int], golds: list[str]) -> tuple[float, list[dict]]:
    """For each cluster, take the share of records whose gold label is the
    cluster's plurality label; weight by cluster size; sum.
    """
    by_cluster: dict[int, Counter] = defaultdict(Counter)
    for lab, g in zip(labels, golds):
        by_cluster[lab][g] += 1
    rows = []
    weighted = 0
    total = 0
    for cid, ctr in by_cluster.items():
        size = sum(ctr.values())
        if size == 0:
            continue
        dom_label, dom_n = max(ctr.items(), key=lambda x: x[1])
        rows.append({
            "cluster":         cid,
            "size":            size,
            "dominant":        dom_label,
            "dominant_share": round(dom_n / size, 3),
            "breakdown":       dict(ctr),
        })
        weighted += dom_n
        total += size
    rows.sort(key=lambda x: -x["size"])
    return (round(weighted / total, 3) if total else 0.0, rows)


def category_entropy(categories: list[str]) -> float:
    """Shannon entropy of a multiset of categories."""
    if not categories:
        return 0.0
    counts = Counter(categories)
    n = len(categories)
    h = 0.0
    for c in counts.values():
        p = c / n
        h -= p * math.log2(p)
    return h


def flag_emergence_candidates(
    cluster_meta: list[dict],
    *,
    min_median_year: int,
    max_year_spread: int,
    min_category_entropy: float,
) -> list[dict]:
    return [
        c for c in cluster_meta
        if c["median_year"] >= min_median_year
        and c["year_spread"] <= max_year_spread
        and c["category_entropy"] >= min_category_entropy
    ]


# (load_model, load_corpus_index, join, top-rare, baseline-panel, main()
#  to be added in subsequent tasks; see Task 2.5 / 2.7 / 2.9.)
```

- [ ] Run `pytest tests/scripts/test_arxiv_analyze.py -v`
- [ ] Expected: 6/6 PASS.

### Task 2.4 — Test top-25 rare records

**Files:**
- Modify: `tests/scripts/test_arxiv_analyze.py` — append:

```python
def test_top_rare_records_by_hamming_radius():
    # Build a tiny survivors list with known rarity ordering.
    survivors = [
        {"idx": 0, "fp48": 0xAAAA00000000, "paper_id": "1", "title": "A", "year": 2020,
         "primary_category": "cs.LG", "archive": "cs"},
        {"idx": 1, "fp48": 0xAAAA00000001, "paper_id": "2", "title": "B", "year": 2020,
         "primary_category": "cs.LG", "archive": "cs"},
        {"idx": 2, "fp48": 0x55555555AAAA, "paper_id": "3", "title": "RARE", "year": 2020,
         "primary_category": "math.NT", "archive": "math"},
    ]
    rare = arxiv_analyze.top_rare(survivors, k=2)
    assert rare[0]["paper_id"] == "3", "the structurally distant record should be ranked rarest"
    assert rare[0]["arxiv_url"] == "https://arxiv.org/abs/3"
```

- [ ] Run test, expect FAIL.

### Task 2.5 — Implement `top_rare`

Append to `scripts/arxiv_analyze.py`:

```python
def top_rare(survivors: list[dict], k: int = 25) -> list[dict]:
    """Rank survivors by their min-Hamming-distance to any other survivor (descending).
    A survivor with no close neighbors is structurally rare."""
    fps = [s["fp48"] for s in survivors]
    rarities: list[tuple[int, int]] = []  # (idx, min_d_to_neighbor)
    for i, fp_i in enumerate(fps):
        best = 49
        for j, fp_j in enumerate(fps):
            if i == j:
                continue
            d = hamming48(fp_i, fp_j)
            if d < best:
                best = d
        rarities.append((i, best))
    rarities.sort(key=lambda x: -x[1])
    out = []
    for i, dist in rarities[:k]:
        s = survivors[i]
        out.append({
            "paper_id":         s["paper_id"],
            "title":            s.get("title", ""),
            "year":             s.get("year", 0),
            "primary_category": s.get("primary_category", ""),
            "archive":          s.get("archive", ""),
            "min_hamming":      dist,
            "arxiv_url":        f"https://arxiv.org/abs/{s['paper_id']}",
        })
    return out
```

- [ ] Run test, expect PASS.

### Task 2.6 — Test bleed + cluster summary helpers

**Files:**
- Modify: `tests/scripts/test_arxiv_analyze.py` — append a test for `bleed_per_class` (port from DocSouth's pattern; the function flags survivors whose cluster's modal-archive differs from the survivor's own archive).

```python
def test_bleed_per_class_identifies_off_archive_papers():
    # Cluster 0 is dominantly 'cs' but contains one math paper -> bleed
    survivors = [
        {"fp48": 0, "primary_category": "cs.LG", "archive": "cs", "year": 2020, "paper_id": "1", "title": "A"},
        {"fp48": 0, "primary_category": "cs.AI", "archive": "cs", "year": 2020, "paper_id": "2", "title": "B"},
        {"fp48": 0, "primary_category": "math.NT", "archive": "math", "year": 2020, "paper_id": "3", "title": "C"},
    ]
    classes = [{"id": 0, "centroid_fp48": 0}]
    bleed = arxiv_analyze.bleed_per_class(survivors, classes)
    assert bleed[0]["dominant"] == "cs"
    assert bleed[0]["bleed_share"] == round(1 / 3, 3)
    assert "math" in bleed[0]["bleed_breakdown"]
```

- [ ] Run test, expect FAIL.

### Task 2.7 — Implement bleed + assign_to_class helpers

Append to `scripts/arxiv_analyze.py`:

```python
def assign_to_class(fp48: int, classes: list[dict]) -> int | None:
    """Return the class_id whose centroid has the smallest Hamming distance to fp48."""
    best_id, best_d = None, 49
    for c in classes:
        d = hamming48(fp48, c["centroid_fp48"])
        if d < best_d:
            best_d, best_id = d, c["id"]
    return best_id


def bleed_per_class(survivors: list[dict], classes: list[dict]) -> list[dict]:
    """For each cluster, identify the dominant archive and the off-archive bleed share."""
    by_class: dict[int, list[dict]] = defaultdict(list)
    for s in survivors:
        cid = assign_to_class(s["fp48"], classes)
        if cid is not None:
            by_class[cid].append(s)
    rows = []
    for cid, ss in by_class.items():
        archives = Counter(s["archive"] for s in ss)
        dom_archive, dom_n = archives.most_common(1)[0]
        bleed = [s for s in ss if s["archive"] != dom_archive]
        bleed_breakdown = Counter(s["archive"] for s in bleed)
        bleed_years = [s["year"] for s in bleed if s.get("year")]
        rows.append({
            "class_id":          cid,
            "size":              len(ss),
            "dominant":          dom_archive,
            "dominant_share":    round(dom_n / len(ss), 3),
            "bleed_share":       round(len(bleed) / len(ss), 3),
            "bleed_breakdown":   dict(bleed_breakdown),
            "bleed_year_range":  [min(bleed_years), max(bleed_years)] if bleed_years else None,
            "bleed_examples":    [
                {"paper_id": s["paper_id"], "title": s.get("title", ""), "archive": s["archive"]}
                for s in bleed[:5]
            ],
        })
    rows.sort(key=lambda x: -x["size"])
    return rows
```

- [ ] Run test, expect PASS.

### Task 2.8 — Wire up `main()` and JSON-shape integration test

Append to `scripts/arxiv_analyze.py`:

```python
def load_model(model_id: str) -> dict:
    token = TOKEN_PATH.read_text().strip()
    req = urllib.request.Request(
        f"{BASE_URL}/api/range-form/{model_id}",
        headers={"Authorization": f"Bearer {token}",
                 "User-Agent": "Mozilla/5.0 (compatible; LatentOcean/1.0)"},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def load_corpus_index(corpus_path: Path) -> dict[int, dict]:
    out: dict[int, dict] = {}
    with corpus_path.open(encoding="utf-8") as f:
        for idx, line in enumerate(f):
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            out[idx] = rec
    return out


def build_public_artifact(model: dict, corpus_path: Path, snapshot_date: str,
                          corpus_input_sha256: str, corpus_sha256: str) -> dict:
    idx_to_meta = load_corpus_index(corpus_path)
    survivors = []
    for fp in model["fingerprints"]:
        idx = int(fp["recordIdx"])
        m = idx_to_meta.get(idx)
        if not m:
            continue
        survivors.append({
            "idx":               idx,
            "fp48Hex":           fp["fp48Hex"],
            "fp48":              int(fp["fp48Hex"], 16),
            "paper_id":          m["paper_id"],
            "primary_category":  m["primary_category"],
            "archive":           m["archive"],
            "categories":        m.get("categories", []),
            "year":              int(m.get("year") or 0),
            "title":             m.get("title", ""),
        })

    classes = [
        {"id": c["id"], "centroid_fp48": int(c["centroid_fp48Hex"], 16)}
        for c in model["taxonomy"]["classes"]
    ]

    # Coarse purity (8 archives)
    labels = [assign_to_class(s["fp48"], classes) for s in survivors]
    archives = [s["archive"] for s in survivors]
    coarse_purity, coarse_rows = weighted_purity(
        [l for l in labels if l is not None],
        [a for l, a in zip(labels, archives) if l is not None],
    )

    # Fine purity (~152 primary subcategories)
    primary_cats = [s["primary_category"] for s in survivors]
    fine_purity, _fine_rows = weighted_purity(
        [l for l in labels if l is not None],
        [p for l, p in zip(labels, primary_cats) if l is not None],
    )

    # Decade trajectory
    by_decade: dict[str, list[dict]] = defaultdict(list)
    for s in survivors:
        if s["year"]:
            by_decade[decade_of(s["year"])].append(s)
    decade_trajectory = []
    for dec in sorted(by_decade.keys()):
        ss = by_decade[dec]
        archive_counts = Counter(s["archive"] for s in ss)
        decade_trajectory.append({
            "decade":          dec,
            "n_survivors":     len(ss),
            "archive_share":   {a: round(c / len(ss), 3) for a, c in archive_counts.items()},
        })

    # Bleed
    bleed = bleed_per_class(survivors, classes)

    # Rare records
    rare = top_rare(survivors, k=25)

    # Emergence candidates (per cluster meta)
    cluster_meta = []
    for cid_dict in coarse_rows:
        cid = cid_dict["cluster"]
        cluster_survivors = [s for s, l in zip(survivors, labels) if l == cid]
        years = [s["year"] for s in cluster_survivors if s["year"]]
        cats = [s["primary_category"] for s in cluster_survivors]
        if not years:
            continue
        years.sort()
        median_year = years[len(years) // 2]
        year_spread = (years[int(0.9 * len(years))] - years[int(0.1 * len(years))]) if len(years) > 4 else (years[-1] - years[0])
        cluster_meta.append({
            "cluster_id":        cid,
            "size":              len(cluster_survivors),
            "median_year":       median_year,
            "year_spread":       year_spread,
            "category_entropy":  round(category_entropy(cats), 3),
        })
    candidates = flag_emergence_candidates(
        cluster_meta,
        min_median_year=2015,
        max_year_spread=5,
        min_category_entropy=2.0,
    )

    return {
        "showcase":              "atlas",
        "kaggle_snapshot_date":  snapshot_date,
        "corpus_input_sha256":   corpus_input_sha256,
        "corpus_sha256":         corpus_sha256,
        "corpus_records":        model.get("corpus_records"),
        "corpus_bytes":          model.get("corpus_bytes"),
        "model_id":              model.get("id"),
        "formed_at":             model.get("formed_at"),
        "response_digest":       model.get("response_digest"),
        "encrypted":             model.get("encrypted"),
        "coverage_pct":          model.get("coverage_pct"),
        "fingerprinter_mode":    model.get("fingerprinter_mode"),
        "taxonomy_summary":      model.get("taxonomy_summary"),
        "persistence":           model.get("persistence"),
        "purity": {
            "coarse_8_archive":  coarse_purity,
            "fine_subcategory":  fine_purity,
            "rows":              coarse_rows,
        },
        "decade_trajectory":     decade_trajectory,
        "bleed_per_class":       bleed,
        "rare_records":          rare,
        "emergence_candidates":  candidates,
        "cluster_meta":          cluster_meta,
        "generated_at":          datetime.datetime.utcnow().isoformat() + "Z",
    }


def main(argv: list[str] | None = None) -> int:
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--model-id", required=True)
    p.add_argument("--snapshot-date", required=True)
    p.add_argument("--corpus-input-sha256", required=True)
    p.add_argument("--corpus-sha256", required=True)
    p.add_argument("--output", default=str(PUBLIC_OUT))
    args = p.parse_args(argv)

    model = load_model(args.model_id)
    artifact = build_public_artifact(
        model, CORPUS_PATH,
        args.snapshot_date, args.corpus_input_sha256, args.corpus_sha256,
    )
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2))
    print(f"wrote {out_path}  ({out_path.stat().st_size:,} bytes)")
    print(f"coarse purity: {artifact['purity']['coarse_8_archive']}")
    print(f"fine purity:   {artifact['purity']['fine_subcategory']}")
    print(f"emergence candidates: {len(artifact['emergence_candidates'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] Append integration test using the synthetic survivor + corpus fixture from Task 2.1:

```python
def test_build_public_artifact_smoke(tmp_path):
    """End-to-end shape test on the synthetic fixture."""
    fixture_corpus = REPO / "tests" / "scripts" / "fixtures" / "atlas_corpus.ndjson"
    fixture_model  = REPO / "tests" / "scripts" / "fixtures" / "atlas_survivors.json"
    model = json.loads(fixture_model.read_text())
    art = arxiv_analyze.build_public_artifact(
        model, fixture_corpus,
        snapshot_date="2026-04-30",
        corpus_input_sha256="0" * 64,
        corpus_sha256="1" * 64,
    )
    assert art["showcase"] == "atlas"
    assert "purity" in art
    assert "decade_trajectory" in art
    assert "rare_records" in art
    assert "emergence_candidates" in art
    assert art["purity"]["coarse_8_archive"] >= 0.5  # well-constructed fixture should produce strong purity
```

### Task 2.9 — Run all analyze tests

- [ ] Run `pytest tests/scripts/test_arxiv_analyze.py -v`
- [ ] Expected: 9/9 PASS (6 unit tests from earlier + 1 top_rare + 1 bleed + 1 smoke).

### Task 2.10 — Add baseline panel (TF-IDF + LDA)

This is computationally heavier and uses sklearn. Add to `arxiv_analyze.py` after `build_public_artifact` returns:

```python
def baseline_panel(survivors_with_text: list[dict], K: int = 12) -> dict:
    """TF-IDF + KMeans and LDA baselines. Both compared to the engine via weighted_purity vs. archive."""
    from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
    from sklearn.cluster import KMeans
    from sklearn.decomposition import LatentDirichletAllocation

    texts = [s["text"] for s in survivors_with_text]
    archives = [s["archive"] for s in survivors_with_text]

    rs = 42
    vec = TfidfVectorizer(
        max_features=20_000, ngram_range=(1, 2), min_df=2, max_df=0.85,
        stop_words="english", lowercase=True,
        token_pattern=r"(?u)\b[a-z][a-z'-]+\b",
    )
    X = vec.fit_transform(texts)
    km = KMeans(n_clusters=K, random_state=rs, n_init=10).fit(X)
    tfidf_purity, _ = weighted_purity(km.labels_.tolist(), archives)

    cv = CountVectorizer(
        max_features=10_000, min_df=2, max_df=0.85, stop_words="english",
        lowercase=True, token_pattern=r"(?u)\b[a-z][a-z'-]+\b",
    )
    Xc = cv.fit_transform(texts)
    lda = LatentDirichletAllocation(
        n_components=K, random_state=rs, max_iter=20, learning_method="online", batch_size=512,
    ).fit(Xc)
    lda_labels = lda.transform(Xc).argmax(axis=1).tolist()
    lda_purity, _ = weighted_purity(lda_labels, archives)

    n_archives = len(set(archives))
    return {
        "K":                  K,
        "chance":             round(1.0 / n_archives, 3) if n_archives else 0.0,
        "tfidf_kmeans":       tfidf_purity,
        "lda_argmax":         lda_purity,
    }
```

Then in `main()`, augment the artifact:

```python
# At the end of main(), after artifact is built but before write:
# Need to enrich survivors with text from the corpus
idx_to_meta = load_corpus_index(CORPUS_PATH)
survivors_with_text = [
    {**idx_to_meta[fp["recordIdx"]], "archive": idx_to_meta[fp["recordIdx"]].get("archive", "")}
    for fp in model["fingerprints"] if fp["recordIdx"] in idx_to_meta
]
artifact["baseline_panel"] = baseline_panel(survivors_with_text, K=12)
```

(Refactor as needed — the goal is `artifact["baseline_panel"]` populated.)

- [ ] No automated test for baseline panel; smoke-test by running with `--model-id <DocSouth model>` and inspecting `baseline_panel` in the output. (DocSouth survivors won't have arXiv archives, so the purity will look strange, but the call shape can be validated.)

### Task 2.11 — Commit Phase 2

```bash
git add scripts/arxiv_analyze.py tests/scripts/test_arxiv_analyze.py tests/scripts/fixtures/atlas_*.json tests/scripts/fixtures/atlas_corpus.ndjson
git commit -m "feat(atlas): analyze script with coarse+fine purity, bleed, rare, emergence candidates

Computes coarse purity vs. 8 archives (headline) and fine purity vs.
~152 subcategories (verification appendix). Decade trajectory across
1990s-2020s. Cross-discipline bleed per cluster. Top-25 structurally
rarest survivors with arxiv.org URL click-through. Young+tight+diverse
cluster flag for emergence-candidate disclosure (no naming). Baseline
panel: TF-IDF + KMeans@K=12 and LDA@K=12."
```

---

## Phase 3 — Constellations (100-finding catalog) 🟡

Build `scripts/arxiv_constellations.py`. Less critical than Phase 1-2; ships with the page but the page renders without it (it just lacks the `/atlas/constellations` deep-dive).

### Task 3.1 — Read the existing DocSouth constellations script

**Files:**
- Read: `scripts/docsouth_constellations.py` (entire file)

- [ ] Read the file. Note the structure: 12 thematic categories, ~8 findings each, sourcing from DocSouth's public JSON.

### Task 3.2 — Adapt to arXiv

**Files:**
- Create: `scripts/arxiv_constellations.py`

Mirror `docsouth_constellations.py`'s structure but with arXiv-specific themes:
- discipline boundaries (purity per archive)
- candidate emerged clusters (one finding per emergence_candidate)
- cross-discipline bleed papers (one finding per high-bleed cluster)
- named rare papers (top-25)
- structural anachronisms (a 1995 paper that clusters with 2018-era cs.LG, identified by year-vs-cluster-median-year delta)
- discipline-specific micro-clusters

```python
#!/usr/bin/env python3
"""Generate the 100-finding constellation catalog for Atlas.
Reads /data/formed_models/_public/arxiv.json and emits showcases/atlas_findings.json.
"""
# Implementation mirrors docsouth_constellations.py's shape — 12 constellations
# x ~8 findings each. See that file as the reference implementation.
```

(Full implementation to mirror DocSouth's; specific finding-text templates depend on the actual numbers from the formation run, so finalize after analyze runs.)

### Task 3.3 — Smoke-test with synthetic public JSON

- [ ] Hand-craft `tests/scripts/fixtures/arxiv_public_minimal.json` with the minimum fields needed to exercise the constellation generator.
- [ ] Run `python scripts/arxiv_constellations.py --input tests/scripts/fixtures/arxiv_public_minimal.json --output /tmp/atlas_findings_test.json`
- [ ] Confirm 12 constellations, ~100 findings total in the output JSON.

### Task 3.4 — Commit

```bash
git add scripts/arxiv_constellations.py tests/scripts/fixtures/arxiv_public_minimal.json
git commit -m "feat(atlas): 100-finding constellations catalog generator"
```

---

## Phase 4 — Verify shell script 🔴

Direct port of `scripts/docsouth_verify.sh`. The structural changes are: tenant token path, model-name regex, output path.

### Task 4.1 — Port the script

**Files:**
- Create: `scripts/atlas_verify.sh`

- [ ] Copy `scripts/docsouth_verify.sh` to `scripts/atlas_verify.sh`.
- [ ] Change `DOCTOK=$(cat /tmp/doctoken)` to `ATLASTOK=$(cat /tmp/.atlastoken)`.
- [ ] Change `'DocSouth' in m['name']` matchers to `'Atlas' in m['name']` (or the actual model name we end up using).
- [ ] Change `/tmp/docsouth_summary.json` to `/tmp/atlas_summary.json` (and similar `_meta` paths).
- [ ] Confirm the 7 query intents are unchanged (they're tenant-agnostic).

### Task 4.2 — Smoke-test against existing DocSouth model

The point is to confirm the script's curl/jq machinery works end-to-end. Use the existing DocSouth tenant token to verify the invariants are still passing. (We're not running it against an Atlas model yet — that's operator time.)

- [ ] Manually run `bash scripts/atlas_verify.sh` (with the DocSouth token in `/tmp/.atlastoken` for this smoke test) — expect 7/7 PASS, even though the headers say "Atlas" in places. This proves the script's mechanics, not its semantics.
- [ ] Reset `/tmp/.atlastoken` to a placeholder for the actual Atlas run.

### Task 4.3 — Commit

```bash
git add scripts/atlas_verify.sh
git commit -m "feat(atlas): verify script (port of docsouth_verify.sh)"
```

---

## Phase 5 — Atlas long-form artifact page 🔴

### Task 5.1 — Page scaffold

**Files:**
- Create: `frontend/app/atlas/page.tsx`

Start by copying `frontend/app/docsouth/page.tsx` to `frontend/app/atlas/page.tsx`. Edit:

- [ ] Title metadata: "Atlas · Latent Ocean × arXiv".
- [ ] Description: "30 years of scientific discourse, structurally fingerprinted with full disclosure of method, baselines, and the bleed analysis where the actual interdisciplinary finding lives."
- [ ] Hero copy:
  - Replace "711 texts. Four collections. 180 years." with the actual numbers once formation runs (placeholder: "2.5M papers. Eight disciplines. Thirty years.").
  - Replace UNC Libraries / DocSouth references with arXiv references.
- [ ] Replace the API endpoint reference: `/api/range-public/showcase/atlas` (was `/api/range-public/showcase/docsouth`).
- [ ] Replace the section anchors: keep most (preface, corpus, topology, recovery, bleed, baselines, named rare, verification, limits, acknowledgements). Rename `bleed` → `bleed` (still about cross-discipline; same widget). Add an `emergence` section anchor for the young+tight+diverse cluster panel.
- [ ] Constellations link: `/atlas/constellations` (was `/docsouth/constellations`).

### Task 5.2 — Wire widgets to /api/range-public/showcase/atlas

The widgets fetch from a public endpoint. Confirm they take a `tenant` or `name` prop, or that they hit a fixed URL containing the showcase name. Look at how DocSouth's page passes data into them.

- [ ] Read 2-3 widget implementations (e.g., `ClusterPurityWidget.tsx`, `DecadeTrajectoryWidget.tsx`) to confirm the API path is parameterized by showcase name.
- [ ] If hard-coded to `docsouth`: refactor to take a `showcase` prop (default "docsouth"). Pass `showcase="atlas"` from the Atlas page.
- [ ] If parameterized already: just pass `showcase="atlas"`.

### Task 5.3 — Prose sections (placeholder until formation runs)

The actual numbers in the prose come from `_public/arxiv.json` after the formation run. Until then:

- [ ] Write each prose section against `<TBD>` placeholder values (with explicit `TBD` markers, NOT silent placeholders).
- [ ] Sections to write (mirror DocSouth's):
  - Preface (no slavery-related ethics paragraph; instead: arXiv is a working scientific archive, contributors are alive, citation norms apply, the artifact respects the corpus)
  - The corpus (2.5M papers, 8 disciplines, 1991-2025, fields kept)
  - Topology (BTUT primitive at 48-bit, ripser persistence, RunPod finalize, K=12 taxonomy)
  - Recovery (coarse purity vs. 8 archives, headline number)
  - Bleed (cross-discipline bleed, named exemplars)
  - Thirty years (decade trajectory, content drift)
  - Baselines (TF-IDF + KMeans, LDA, chance)
  - Named rare (top-25 with arxiv.org links)
  - Emergence (young+tight+diverse clusters; honest disclosure: no naming)
  - Verification (the recipe with `corpus_input_sha256`, `corpus_sha256`, `model_id`, 7 `response_digest` values)
  - Limits (RunPod GPU drift caveat, non-English abstracts, multi-category papers, primary-category vs. all-categories)
  - Acknowledgements (arXiv, Cornell, Kaggle dataset maintainers)

### Task 5.4 — Browser-preview the scaffold

- [ ] Start the dev server via `preview_start`.
- [ ] Navigate to `/atlas`.
- [ ] Confirm: page renders, all widgets show "loading" or empty states (since the public JSON doesn't exist yet).
- [ ] No console errors that aren't expected fetch-404s on `/api/range-public/showcase/atlas`.

### Task 5.5 — Commit

```bash
git add frontend/app/atlas/page.tsx
# Plus widget refactor if needed
git commit -m "feat(atlas): long-form artifact page scaffold

Mirrors /docsouth's structure. Eight DocSouth widgets reused unchanged
(parameterized by showcase=atlas). Prose written against TBD placeholders
to be filled in after the formation run produces _public/arxiv.json."
```

---

## Phase 6 — Constellations page 🟡

### Task 6.1 — Port the constellations page

**Files:**
- Create: `frontend/app/atlas/constellations/page.tsx`

- [ ] Copy `frontend/app/docsouth/constellations/page.tsx` to `frontend/app/atlas/constellations/page.tsx`.
- [ ] Change the source: `showcases/atlas_findings.json` instead of `showcases/docsouth_findings.json` (or whichever path the page uses — read the existing page first).
- [ ] Update the page metadata title and description.

### Task 6.2 — Browser-preview

- [ ] Navigate to `/atlas/constellations`.
- [ ] Until `showcases/atlas_findings.json` is populated, the page should render an empty-state ("0 findings"). That's fine; finalize after Phase 8.

### Task 6.3 — Commit

```bash
git add frontend/app/atlas/constellations/page.tsx
git commit -m "feat(atlas): constellations catalog page scaffold"
```

---

## Phase 7 — Operator runbook 🔴

The actual harvest + formation + analyze run is operator time, not engineer time. But the operator needs a precise script to follow. Document it.

### Task 7.1 — Write the runbook

**Files:**
- Create: `docs/superpowers/runbooks/2026-05-02-atlas-arxiv-runbook.md`

Sections:
- [ ] Pre-flight: EC2 disk space (~5 GB free), Kaggle API credentials, RunPod credit confirmed.
- [ ] Step 1: Pin a Kaggle snapshot date. Record it.
- [ ] Step 2: Download the snapshot to `/tmp/arxiv_work/` on EC2 via `kaggle datasets download Cornell-University/arxiv` (or manual download + `scp`).
- [ ] Step 3: `sha256sum` the file. Record `corpus_input_sha256`.
- [ ] Step 4: Run `python scripts/arxiv_harvest.py --input ... --output /opt/latentocean/data/formed_models/_inputs/arxiv.ndjson --snapshot-date YYYY-MM-DD`.
- [ ] Step 5: `sha256sum` the NDJSON. Record `corpus_sha256`.
- [ ] Step 6: Mint `atlas_showcase` token: `curl -X POST -H 'Content-Type: application/json' -d '{"color":"atlas_showcase"}' https://www.latentocean.com/api/range-demo-token | jq -r .token > /tmp/.atlastoken`.
- [ ] Step 7: Form the model. (Exact curl pattern based on Phase 0 recon — see whether `/api/range-form` accepts a corpus path or needs the NDJSON uploaded.) Record `model_id` from the response.
- [ ] Step 8: `python scripts/arxiv_analyze.py --model-id <id> --snapshot-date YYYY-MM-DD --corpus-input-sha256 <hash> --corpus-sha256 <hash>`.
- [ ] Step 9: `python scripts/arxiv_constellations.py --input /data/formed_models/_public/arxiv.json --output showcases/atlas_findings.json`.
- [ ] Step 10: `bash scripts/atlas_verify.sh` (with `/tmp/.atlastoken`). Confirm 7/7 PASS, cross-tenant 404, audit log retrievable.
- [ ] Step 11: `cp /data/formed_models/_public/arxiv.json showcases/atlas.json`.
- [ ] Step 12: Update `frontend/app/atlas/page.tsx` prose with actual numbers (replacing `<TBD>` markers).
- [ ] Step 13: Commit the showcase JSONs and the prose updates.
- [ ] Step 14: Deploy via the existing deploy script.

### Task 7.2 — Commit the runbook

```bash
git add docs/superpowers/runbooks/2026-05-02-atlas-arxiv-runbook.md
git commit -m "docs(atlas): operator runbook for harvest -> form -> analyze -> ship"
```

---

## Phase 8 — Operator run (NOT in this implementation cycle) ⏸️

This phase lives outside the engineer's task list because it requires:
- ~125 minutes of wall time (BTUT formation across 500 chunks)
- Kaggle API credentials on EC2
- RunPod credit
- Manual intervention if anything fails mid-run

Once the engineer has shipped Phase 0-7, the operator runs the runbook end-to-end. Output: populated `_public/arxiv.json`, populated `showcases/atlas.json` and `showcases/atlas_findings.json`, prose updates committed, deployed.

---

## Self-review checklist (run before declaring the plan complete)

- [ ] Every spec section has a task that implements it. Verify each row of the spec's "Components" table maps to at least one task.
- [ ] No "TBD", "TODO", "implement later" in any task body (only in displayed deliverable prose where placeholder is intentional and marked).
- [ ] Function names used in later tasks match those defined in earlier tasks (e.g., `weighted_purity`, `archive_of`, `top_rare`, `bleed_per_class`, `flag_emergence_candidates`).
- [ ] Each TDD task has: failing test → run → minimal impl → run → commit.
- [ ] All commits are scoped to one component.
- [ ] Files paths are absolute or repo-relative; no `<your-path-here>` placeholders.

---

## Acceptance criteria (from the spec)

The Atlas v1 artifact ships when:

- `/data/formed_models/_public/arxiv.json` exists on production with all required fields.
- `scripts/atlas_verify.sh` returns 7/7 PASS on the seven query intents.
- Cross-tenant probe with a non-`atlas_showcase` token returns 404.
- Audit log retrievable in JSON, CEF, OCSF.
- `https://www.latentocean.com/atlas` renders the long-form artifact page with all eight widgets populated.
- `https://www.latentocean.com/atlas/constellations` renders the 100-finding catalog.
- Prose on `/atlas` quotes only numbers and named records that exist in `_public/arxiv.json`.
- `showcases/atlas.json` and `showcases/atlas_findings.json` committed to the repo.
- Verification recipe printed on the page, executable by a third party against the published hashes.
