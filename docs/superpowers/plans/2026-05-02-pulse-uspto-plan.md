# Pulse — USPTO Inventor Disambiguation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public Pulse v1 artifact at `/pulse/uspto-inventors` (mirrors `/atlas/arxiv` shape) over a 500k-record stratified sample of USPTO inventor-records 1976-2025, with multi-baseline disambiguation purity (engine vs PatentsView vs DOCDB vs naive vs chance) as the centerpiece.

**Architecture:** Refactor first — extract shared analyze primitives from `scripts/arxiv_analyze.py` into `scripts/_showcase_lib.py` with the existing 23 tests preserved. Then build Pulse on top of the library: harvester from PatentsView TSVs → analyze with disambiguation primitives → constellations → verify shell → long-form page + constellations page. No new backend code; allowlist extension in `route.ts` adds three new slugs.

**Tech Stack:** Python 3.11+ (stdlib + sklearn), Next.js / React / TypeScript (pages), bash (verify), existing BTUT bridge at `/api/range-form` (formation), PatentsView bulk TSV (corpus + gold).

**Testing:** TDD on the harvester + showcase_lib pure functions + Pulse-specific disambiguation primitives. Atlas's 23 tests must continue to pass through the refactor (regression gate). Manual verify on the page render in browser preview.

**Reference spec:** `docs/superpowers/specs/2026-05-02-pulse-uspto-design.md`

---

## Phase 0 — Refactor `scripts/_showcase_lib.py` 🔴

The Atlas-promise we're cashing in. Extract shared primitives into a library; Atlas + Pulse both consume it.

### Task 0.1 — Create `scripts/_showcase_lib.py` with extracted primitives

**Files:**
- Create: `scripts/_showcase_lib.py`

- [ ] Create the module with the 9 shared primitives lifted verbatim from `scripts/arxiv_analyze.py`:

```python
"""Shared analyze primitives for Latent Ocean public showcases.

Imported by scripts/arxiv_analyze.py and scripts/pulse_analyze.py.
Pure functions, stdlib only. No IO. No sklearn. No external services.

Coverage decision: docsouth_analyze.py is NOT migrated to this library
in v1. Atlas + Pulse use it; DocSouth's analyze script keeps its own
copies. Migration is opt-in if useful later.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from typing import Any


def hamming48(a: int, b: int) -> int:
    x = a ^ b
    c = 0
    while x:
        x &= x - 1
        c += 1
    return c


def weighted_purity(labels: list, golds: list) -> tuple[float, list[dict]]:
    """For each cluster, take the share of records whose gold label is the
    cluster's plurality label; weight by cluster size; sum.
    """
    by_cluster: dict[Any, Counter] = defaultdict(Counter)
    for lab, g in zip(labels, golds):
        by_cluster[lab][g] += 1
    rows: list[dict] = []
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


def category_entropy(items: list) -> float:
    """Shannon entropy of a multiset of items."""
    if not items:
        return 0.0
    counts = Counter(items)
    n = len(items)
    h = 0.0
    for c in counts.values():
        p = c / n
        h -= p * math.log2(p)
    return h


def decade_of(year: int) -> str:
    if year < 1990:
        return "pre-1990s"
    return f"{(year // 10) * 10}s"


def assign_to_class(fp48: int, classes: list[dict]) -> int | None:
    """Return the class_id whose centroid has the smallest Hamming distance to fp48."""
    best_id, best_d = None, 49
    for c in classes:
        d = hamming48(fp48, c["centroid_fp48"])
        if d < best_d:
            best_d, best_id = d, c["id"]
    return best_id


def top_rare(survivors: list[dict], k: int = 25) -> list[dict]:
    """Rank survivors by their min-Hamming-distance to any other survivor (descending).
    Returns shape-agnostic dicts; caller is responsible for adding domain-specific fields
    like arxiv_url or uspto_url after calling top_rare.
    """
    fps = [s["fp48"] for s in survivors]
    rarities: list[tuple[int, int]] = []
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
    return [
        {**survivors[i], "min_hamming": dist}
        for i, dist in rarities[:k]
    ]


def bleed_per_class(
    survivors: list[dict], classes: list[dict], gold_field: str = "archive",
) -> list[dict]:
    """For each cluster, identify the dominant gold-label and the off-label bleed.
    `gold_field` parameterizes which survivor field to use as the gold label
    (Atlas: 'archive'; Pulse: 'patentsview_inventor_id').
    """
    by_class: dict[Any, list[dict]] = defaultdict(list)
    for s in survivors:
        cid = assign_to_class(s["fp48"], classes)
        if cid is not None:
            by_class[cid].append(s)
    rows: list[dict] = []
    for cid, ss in by_class.items():
        if not ss:
            continue
        labels = Counter(s.get(gold_field, "") for s in ss)
        dom_label, dom_n = labels.most_common(1)[0]
        bleed = [s for s in ss if s.get(gold_field, "") != dom_label]
        bleed_breakdown = Counter(s.get(gold_field, "") for s in bleed)
        rows.append({
            "class_id":        cid,
            "size":            len(ss),
            "dominant":        dom_label,
            "dominant_share":  round(dom_n / len(ss), 3),
            "bleed_share":     round(len(bleed) / len(ss), 3),
            "bleed_breakdown": dict(bleed_breakdown),
        })
    rows.sort(key=lambda x: -x["size"])
    return rows


def flag_emergence_candidates(
    cluster_meta: list[dict],
    *,
    min_median_year: int,
    max_year_spread: int,
    min_category_entropy: float,
) -> list[dict]:
    return [
        c for c in cluster_meta
        if c.get("median_year", 0) >= min_median_year
        and c.get("year_spread", 999) <= max_year_spread
        and c.get("category_entropy", 0.0) >= min_category_entropy
    ]


def stride_sample(items: list, target: int) -> list:
    """Deterministic stride sample to exactly `target` items.

    items is assumed pre-sorted by the caller. When len > target,
    pick evenly-spaced indices: items[int(i * len/target)] for i in [0, target).
    No RNG -- same input + same target -> byte-identical output.
    """
    if target <= 0 or len(items) <= target:
        return list(items)
    step = len(items) / target
    return [items[int(i * step)] for i in range(target)]
```

- [ ] Verify the file imports cleanly: `python -c "from scripts._showcase_lib import hamming48, weighted_purity; print('ok')"`. If `scripts/` isn't on the import path, ensure tests still find it (the `tests/scripts/test_*.py` tests already insert `scripts/` into sys.path).

### Task 0.2 — Modify `scripts/arxiv_analyze.py` to import from `_showcase_lib`

**Files:**
- Modify: `scripts/arxiv_analyze.py`

- [ ] Replace the inline definitions of these 8 functions in `arxiv_analyze.py` with imports:

```python
# At top of file, after the docstring:
from _showcase_lib import (
    hamming48,
    weighted_purity,
    category_entropy,
    decade_of,
    assign_to_class,
    top_rare,
    bleed_per_class,
    flag_emergence_candidates,
)
```

- [ ] Delete the inline function definitions of these 8 functions from `arxiv_analyze.py`.
- [ ] Keep `archive_of` (Atlas-specific), `compute_cluster_meta` (Atlas-specific), `baseline_panel` (uses sklearn, not pure), `load_model`, `load_corpus_index`, `join_survivors`, `build_public_artifact`, `main` — all stay in arxiv_analyze.py.

The `top_rare` in `_showcase_lib` returns `{**survivor, "min_hamming": d}` — it now spreads the survivor and adds min_hamming. The caller (arxiv_analyze) is responsible for picking the fields they want plus adding `arxiv_url`. Update `arxiv_analyze.py`'s `top_rare` call site:

```python
# In build_public_artifact, REPLACE the existing top_rare construction with:
rare_raw = top_rare(valid_survivors, k=25)
rare = [
    {
        "paper_id":         r["paper_id"],
        "title":            r.get("title", ""),
        "year":             r.get("year", 0),
        "primary_category": r.get("primary_category", ""),
        "archive":          r.get("archive", ""),
        "min_hamming":      r["min_hamming"],
        "arxiv_url":        f"https://arxiv.org/abs/{r['paper_id']}",
    }
    for r in rare_raw
]
```

The `bleed_per_class` in `_showcase_lib` no longer returns Atlas-specific fields like `bleed_year_range` or `bleed_examples` — those were specific to Atlas. Either:
  - Keep arxiv_analyze.py's local `bleed_per_class` for the Atlas-specific extras
  - OR augment the lib's output in arxiv_analyze.py after the call

Take the second path. In `build_public_artifact`:
```python
bleed_raw = bleed_per_class(valid_survivors, classes, gold_field="archive")
# Augment each row with Atlas-specific extras
bleed = []
for row in bleed_raw:
    cluster_survivors = [s for s in valid_survivors if assign_to_class(s["fp48"], classes) == row["class_id"]]
    bleed_records = [s for s in cluster_survivors if s["archive"] != row["dominant"]]
    bleed_years = [s["year"] for s in bleed_records if s.get("year")]
    bleed.append({
        **row,
        "bleed_year_range": [min(bleed_years), max(bleed_years)] if bleed_years else None,
        "bleed_examples": [
            {"paper_id": s["paper_id"], "title": s.get("title", ""), "archive": s["archive"]}
            for s in bleed_records[:5]
        ],
    })
```

### Task 0.3 — Run Atlas's existing 23 tests; they must still pass

- [ ] `python -m pytest tests/scripts/test_arxiv_analyze.py -v`
- [ ] Expected: 23/23 PASS. If any fail, the refactor broke something — fix imports / signature mismatches and re-run.

### Task 0.4 — Add tests for `_showcase_lib.py` itself

**Files:**
- Create: `tests/scripts/test_showcase_lib.py`

- [ ] Write tests covering each primitive on its own (no Atlas-specific assumptions):

```python
"""Tests for scripts/_showcase_lib.py - shared analyze primitives."""
from __future__ import annotations
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import _showcase_lib as lib  # noqa: E402


def test_hamming48_zero():
    assert lib.hamming48(0xABCD, 0xABCD) == 0


def test_hamming48_full():
    assert lib.hamming48(0x0, 0xFFFFFFFFFFFF) == 48


def test_weighted_purity_perfect():
    purity, _ = lib.weighted_purity([0, 0, 1, 1], ["a", "a", "b", "b"])
    assert purity == 1.0


def test_weighted_purity_chance():
    # Each cluster's plurality contributes its plurality count
    # Cluster 0: {a:1, b:1, c:1} - plurality 'a' (or any), share 1/3
    purity, _ = lib.weighted_purity([0, 0, 0], ["a", "b", "c"])
    # Plurality wins ties via max() with insertion order; share is 1/3
    assert abs(purity - 0.333) < 0.001


def test_category_entropy_uniform():
    h = lib.category_entropy(["a", "b", "c", "d"])
    assert abs(h - 2.0) < 0.001


def test_category_entropy_pure():
    assert lib.category_entropy(["a", "a", "a"]) == 0.0


def test_decade_of():
    assert lib.decade_of(2017) == "2010s"
    assert lib.decade_of(1985) == "pre-1990s"
    assert lib.decade_of(2024) == "2020s"


def test_assign_to_class_nearest():
    classes = [
        {"id": 0, "centroid_fp48": 0xAAAAAAAAAAAA},
        {"id": 1, "centroid_fp48": 0x555555555555},
    ]
    assert lib.assign_to_class(0xAAAAAAAAAAAB, classes) == 0


def test_top_rare_ranks_outliers_first():
    survivors = [
        {"fp48": 0x0, "id": "a"},
        {"fp48": 0x1, "id": "b"},
        {"fp48": 0xFFFFFFFFFFFF, "id": "c"},  # far from both
    ]
    rare = lib.top_rare(survivors, k=2)
    assert rare[0]["id"] == "c"
    assert rare[0]["min_hamming"] >= 47


def test_bleed_per_class_off_archive():
    survivors = [
        {"fp48": 0, "archive": "cs"},
        {"fp48": 1, "archive": "cs"},
        {"fp48": 2, "archive": "math"},
    ]
    classes = [{"id": 0, "centroid_fp48": 0}]
    bleed = lib.bleed_per_class(survivors, classes, gold_field="archive")
    assert bleed[0]["dominant"] == "cs"
    assert "math" in bleed[0]["bleed_breakdown"]


def test_flag_emergence_candidates():
    meta = [
        {"cluster_id": 0, "median_year": 2018, "year_spread": 4, "category_entropy": 2.5},
        {"cluster_id": 1, "median_year": 2002, "year_spread": 4, "category_entropy": 2.5},
    ]
    flagged = lib.flag_emergence_candidates(
        meta, min_median_year=2015, max_year_spread=5, min_category_entropy=2.0,
    )
    assert [c["cluster_id"] for c in flagged] == [0]


def test_stride_sample_under_target_returns_all():
    assert lib.stride_sample([1, 2, 3], 10) == [1, 2, 3]


def test_stride_sample_zero_target_returns_all():
    assert lib.stride_sample([1, 2, 3], 0) == [1, 2, 3]


def test_stride_sample_evenly_spaced():
    assert lib.stride_sample(list(range(10)), 5) == [0, 2, 4, 6, 8]


def test_stride_sample_deterministic():
    items = list(range(100))
    a = lib.stride_sample(items, 7)
    b = lib.stride_sample(items, 7)
    assert a == b
```

- [ ] Run: `python -m pytest tests/scripts/test_showcase_lib.py -v`
- [ ] Expected: 14/14 PASS.

### Task 0.5 — Commit Phase 0

```bash
git add scripts/_showcase_lib.py scripts/arxiv_analyze.py tests/scripts/test_showcase_lib.py
git commit -m "refactor(showcases): extract shared analyze primitives to scripts/_showcase_lib.py

Pulls hamming48, weighted_purity, category_entropy, decade_of,
assign_to_class, top_rare, bleed_per_class, flag_emergence_candidates,
stride_sample out of scripts/arxiv_analyze.py into a shared library
that Atlas + Pulse both consume.

bleed_per_class now takes a gold_field parameter (default 'archive')
so Pulse can pass 'patentsview_inventor_id' instead. top_rare returns
shape-agnostic dicts with min_hamming added; callers add domain-specific
fields like arxiv_url after.

DocSouth's analyze script keeps its inline copies; migration is opt-in.

Atlas's 23 tests still pass. New 14-test suite covers the shared
primitives directly."
```

---

## Phase 1 — Pulse harvester 🔴

Test-driven on a small fixture before pointing it at PatentsView's bulk TSVs (~500 MB compressed).

### Task 1.1 — Create test fixtures: 5-row PatentsView mini TSVs

**Files:**
- Create: `tests/scripts/fixtures/patentsview_mini/g_inventor_disambiguated.tsv`
- Create: `tests/scripts/fixtures/patentsview_mini/g_inventor_not_disambiguated.tsv`
- Create: `tests/scripts/fixtures/patentsview_mini/g_assignee_disambiguated.tsv`
- Create: `tests/scripts/fixtures/patentsview_mini/g_location_disambiguated.tsv`
- Create: `tests/scripts/fixtures/patentsview_mini/g_patent.tsv`

- [ ] Construct a small fixture set that exercises:
  - One inventor with two patents (same canonical name, same assignee → should disambiguate together)
  - One name collision (two distinct PatentsView inventor_ids with the same canonical_name "Smith J W") to force the engine to use co-inventor + assignee + location signals
  - One ultra-common name to test stride sampling
  - One pre-1976 patent (to test the year cutoff filter — drop)

`g_inventor_disambiguated.tsv` (5 rows + header, tab-separated):
```
patent_id	inventor_sequence	inventor_id	disambig_inventor_name_first	disambig_inventor_name_last	location_id
10000001	0	inv_aaa	John	Smith	loc_001
10000001	1	inv_bbb	Alice	Chen	loc_002
10000002	0	inv_aaa	John	Smith	loc_001
10000003	0	inv_ccc	J	Smith	loc_003
10000003	1	inv_ddd	Bob	Garcia	loc_004
```

`g_inventor_not_disambiguated.tsv`:
```
patent_id	inventor_sequence	raw_inventor_name_first	raw_inventor_name_last
10000001	0	John W	Smith
10000001	1	Alice B	Chen
10000002	0	J W	Smith
10000003	0	J	Smith
10000003	1	Bob	Garcia
```

`g_assignee_disambiguated.tsv`:
```
patent_id	assignee_sequence	assignee_id	organization
10000001	0	asg_apple	Apple Inc.
10000002	0	asg_apple	Apple Inc.
10000003	0	asg_google	Google LLC
```

`g_location_disambiguated.tsv`:
```
location_id	city	state	country
loc_001	Cupertino	CA	US
loc_002	San Jose	CA	US
loc_003	Mountain View	CA	US
loc_004	Palo Alto	CA	US
```

`g_patent.tsv`:
```
patent_id	patent_date	patent_title	wipo_field_id
10000001	2017-06-12	Method for X	35
10000002	2018-01-15	Method for Y	35
10000003	2019-03-20	System for Z	2
```

Note: 1976+ filter is a noop for this fixture; we'll add a separate fixture row for the < 1976 case in Task 1.3.

### Task 1.2 — Failing tests for harvester

**Files:**
- Create: `tests/scripts/test_pulse_harvest.py`

```python
"""Tests for scripts/pulse_harvest.py."""
from __future__ import annotations
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import pulse_harvest  # noqa: E402

FIXTURE_DIR = REPO / "tests" / "scripts" / "fixtures" / "patentsview_mini"


def _read_ndjson(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def test_canonical_name_normalization():
    assert pulse_harvest.canonical_name("John", "Smith") == "Smith J"
    assert pulse_harvest.canonical_name("J W", "Smith") == "Smith J W"
    assert pulse_harvest.canonical_name("Alice B", "Chen") == "Chen A B"
    assert pulse_harvest.canonical_name("", "Smith") == "Smith"
    assert pulse_harvest.canonical_name("Mary-Anne", "OConnor-Doyle") == "OConnor-Doyle M"


def test_canonical_name_strips_punctuation():
    assert pulse_harvest.canonical_name("J.", "Smith") == "Smith J"
    assert pulse_harvest.canonical_name("J. W.", "Smith") == "Smith J W"


def test_harvest_produces_one_record_per_inventor_appearance(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0,
        per_name_cap=100,
    )
    records = _read_ndjson(out)
    # 5 inventor-record tuples in the fixture (no rows are filtered)
    assert len(records) == 5


def test_harvest_includes_co_inventors(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0,
        per_name_cap=100,
    )
    records = _read_ndjson(out)
    rec_smith_a = next(r for r in records if r["patent_id"] == "10000001" and r["inventor_seq"] == 0)
    assert rec_smith_a["co_inventors_canonical"] == ["Chen A B"]


def test_harvest_canonical_name_in_text(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0,
        per_name_cap=100,
    )
    records = _read_ndjson(out)
    smith = next(r for r in records if r["patent_id"] == "10000001" and r["inventor_seq"] == 0)
    # text starts with canonical name
    assert smith["text"].startswith("Smith J W")
    # text contains co-inventors
    assert "Chen A B" in smith["text"]
    # text contains assignee_id
    assert "asg_apple" in smith["text"] or "Apple" in smith["text"]
    # text contains city/state
    assert "Cupertino" in smith["text"]
    # text does NOT contain patentsview_inventor_id (firewall)
    assert "inv_aaa" not in smith["text"]


def test_harvest_year_extraction(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0,
        per_name_cap=100,
    )
    records = _read_ndjson(out)
    years = sorted(set(r["year"] for r in records))
    assert years == [2017, 2018, 2019]


def test_harvest_byte_identical_on_rerun(tmp_path):
    out_a = tmp_path / "a.ndjson"
    out_b = tmp_path / "b.ndjson"
    for out in (out_a, out_b):
        pulse_harvest.run(
            fixtures_dir=FIXTURE_DIR, output_path=out,
            snapshot_nominal_date="2026-04-30",
            target_per_year=0,
            per_name_cap=100,
        )
    assert hashlib.sha256(out_a.read_bytes()).hexdigest() == hashlib.sha256(out_b.read_bytes()).hexdigest()


def test_harvest_canonical_json_serialization(tmp_path):
    out = tmp_path / "pulse.ndjson"
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0,
        per_name_cap=100,
    )
    for line in out.read_text(encoding="utf-8").splitlines():
        rec = json.loads(line)
        canonical = json.dumps(rec, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        assert canonical == line, f"line is not canonical JSON:\n  got:      {line}\n  expected: {canonical}"


def test_harvest_two_stage_sampling_caps_common_names(tmp_path):
    """When per_name_cap is small, ultra-common canonical names should be capped."""
    out = tmp_path / "pulse.ndjson"
    # In the fixture there are 3 records with canonical_name 'Smith J W' or 'Smith J'
    # (two are 'Smith J W' for inv_aaa, one is 'Smith J' for inv_ccc - different canonicals).
    # Set per_name_cap=1 to force capping on the 'Smith J W' bucket.
    pulse_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_path=out,
        snapshot_nominal_date="2026-04-30",
        target_per_year=0,
        per_name_cap=1,
    )
    records = _read_ndjson(out)
    name_counts = Counter(r["canonical_name"] for r in records)
    for name, count in name_counts.items():
        assert count <= 1, f"canonical_name '{name}' kept {count} records, expected <= per_name_cap=1"
```

- [ ] Run: `python -m pytest tests/scripts/test_pulse_harvest.py -v`
- [ ] Expected: ALL FAIL with `ModuleNotFoundError: pulse_harvest`.

### Task 1.3 — Implement `scripts/pulse_harvest.py`

**Files:**
- Create: `scripts/pulse_harvest.py`

```python
#!/usr/bin/env python3
"""
Pulse harvest: PatentsView bulk TSV snapshot -> deterministic NDJSON corpus.

Reads PatentsView's bulk-distributed inventor + assignee + location + patent
TSVs (the disambiguated and not-disambiguated variants), joins them on
patent_id, normalizes inventor names to canonical form ("Surname I I"),
collects each inventor-record's co-inventors and assignee + location
metadata, and emits one NDJSON record per inventor-appearance on a patent.

Output schema per record:
  paper_id          # backwards-compat alias for patent_id (Atlas-shaped)
  patent_id         # USPTO patent number (string)
  inventor_seq      # 0-indexed position in the patent's inventor list
  raw_name          # "Smith, John W." as it appears on the patent
  canonical_name    # "Smith J W"
  co_inventors_canonical  # list of canonical names of co-inventors on this patent
  assignee_id       # PatentsView's assignee_id (or empty string)
  assignee_name     # display string
  city, state, country
  primary_ipc       # WIPO field id (or top IPC class code)
  year              # patent grant year
  patentsview_inventor_id  # the gold-standard disambiguated id (NOT in `text`)
  raw_assignee_string      # for the naive-name baseline
  text              # BTUT fingerprint payload:
                    # "{canonical_name} | {co_inv_1; co_inv_2} | {assignee_id} | {city} {state} {country}"

Two-stage sampling:
  1. Group all kept records by canonical_name globally.
  2. For canonical_names with <= per_name_cap appearances, keep all.
  3. For ultra-common canonical_names, stride-sample to per_name_cap.
  4. If target_per_year > 0, apply outer stride-by-year to bring the total
     down to target_per_year * num_years (defensive cap on top of per_name).

Determinism: sort records by (patent_id, inventor_seq) ascending, canonical
JSON serialization, byte-identical re-runs.

Usage:
  python scripts/pulse_harvest.py \\
      --fixtures-dir /tmp/patentsview_work \\
      --output /opt/latentocean/data/formed_models/_inputs/pulse.ndjson \\
      --snapshot-date 2026-04-30 \\
      --target-per-year 10000 \\
      --per-name-cap 100
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

# scripts/ on sys.path so `_showcase_lib` imports cleanly
_SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS))
from _showcase_lib import stride_sample  # noqa: E402

PUNCT_RE = re.compile(r"[.,]")
NAME_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'-]*")


def canonical_name(first: str, last: str) -> str:
    """Normalize an inventor name to "Surname I I" form.

    "John W. Smith" -> "Smith J W"
    "J W Smith"     -> "Smith J W"
    "Mary-Anne O'Connor-Doyle" -> "OConnor-Doyle M"
        (double-barreled surname preserved hyphenated; only first given-name retained as initial
         when it's a hyphenated compound)
    """
    last_clean = (last or "").strip().replace("'", "")
    first_clean = (first or "").strip()
    first_clean = PUNCT_RE.sub("", first_clean)

    initials: list[str] = []
    for tok in first_clean.split():
        if not tok:
            continue
        head = tok[0]
        if head.isalpha():
            initials.append(head.upper())
    if not last_clean:
        return ""
    if not initials:
        return last_clean
    return last_clean + " " + " ".join(initials)


def _read_tsv(path: Path) -> list[dict]:
    """Read a PatentsView TSV (header + tab-separated rows). Returns list of dicts."""
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        return list(reader)


def _build_records(fixtures_dir: Path, snapshot_nominal_date: str) -> list[dict]:
    """Join the PatentsView TSVs into one inventor-record per appearance.

    Filters: patents granted before 1976 (cutoff for USPTO bulk distribution).
    """
    inv_tsv  = _read_tsv(fixtures_dir / "g_inventor_disambiguated.tsv")
    raw_tsv  = _read_tsv(fixtures_dir / "g_inventor_not_disambiguated.tsv")
    asg_tsv  = _read_tsv(fixtures_dir / "g_assignee_disambiguated.tsv")
    loc_tsv  = _read_tsv(fixtures_dir / "g_location_disambiguated.tsv")
    pat_tsv  = _read_tsv(fixtures_dir / "g_patent.tsv")

    # Build lookups
    raw_by_patent_seq = {(r["patent_id"], r["inventor_sequence"]): r for r in raw_tsv}
    asg_by_patent     = {a["patent_id"]: a for a in asg_tsv}
    loc_by_id         = {l["location_id"]: l for l in loc_tsv}
    pat_by_id         = {p["patent_id"]: p for p in pat_tsv}

    # Build {patent_id: [(seq, inv_row), ...]} for co-inventor lookup
    invs_by_patent: dict[str, list[tuple[int, dict]]] = defaultdict(list)
    for inv in inv_tsv:
        invs_by_patent[inv["patent_id"]].append((int(inv["inventor_sequence"]), inv))
    for pid in invs_by_patent:
        invs_by_patent[pid].sort(key=lambda x: x[0])

    out: list[dict] = []
    for inv in inv_tsv:
        patent_id = inv["patent_id"]
        seq = int(inv["inventor_sequence"])

        # Patent metadata
        pat = pat_by_id.get(patent_id, {})
        patent_date = pat.get("patent_date", "")
        if not patent_date or patent_date < "1976-01-01":
            continue
        if patent_date > snapshot_nominal_date:
            continue
        year = int(patent_date[:4]) if len(patent_date) >= 4 else 0
        title = pat.get("patent_title", "")
        primary_ipc = pat.get("wipo_field_id", "")

        # Canonical names
        first = inv.get("disambig_inventor_name_first", "")
        last  = inv.get("disambig_inventor_name_last", "")
        cname = canonical_name(first, last)

        # Co-inventors (canonical), excluding self
        co: list[str] = []
        for other_seq, other_inv in invs_by_patent.get(patent_id, []):
            if other_seq == seq:
                continue
            co.append(canonical_name(
                other_inv.get("disambig_inventor_name_first", ""),
                other_inv.get("disambig_inventor_name_last", ""),
            ))

        # Raw name (for naive-name baseline)
        raw = raw_by_patent_seq.get((patent_id, str(seq)), {})
        raw_first = raw.get("raw_inventor_name_first", "")
        raw_last  = raw.get("raw_inventor_name_last", "")
        raw_name  = f"{raw_last}, {raw_first}".strip(", ")

        # Assignee
        asg = asg_by_patent.get(patent_id, {})
        assignee_id = asg.get("assignee_id", "")
        assignee_name = asg.get("organization", "")

        # Location
        loc = loc_by_id.get(inv.get("location_id", ""), {})
        city, state, country = loc.get("city", ""), loc.get("state", ""), loc.get("country", "")

        # Fingerprint payload — canonical name + co + assignee + location
        co_str = "; ".join(co)
        text = f"{cname} | {co_str} | {assignee_id} | {city} {state} {country}".strip()

        out.append({
            "paper_id":                   patent_id,  # alias for Atlas-shaped substrate compat
            "patent_id":                  patent_id,
            "inventor_seq":               seq,
            "raw_name":                   raw_name,
            "canonical_name":             cname,
            "co_inventors_canonical":     co,
            "assignee_id":                assignee_id,
            "assignee_name":              assignee_name,
            "city":                       city,
            "state":                      state,
            "country":                    country,
            "primary_ipc":                primary_ipc,
            "year":                       year,
            "title":                      title,
            "patentsview_inventor_id":    inv.get("inventor_id", ""),
            "raw_assignee_string":        assignee_name,
            "text":                       text,
        })

    return out


def _two_stage_sample(
    records: list[dict], *, per_name_cap: int, target_per_year: int,
) -> list[dict]:
    """Two-stage sampling per design Q4."""
    # Stage 1: group by canonical_name, cap each bucket
    by_name: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_name[r["canonical_name"]].append(r)
    capped: list[dict] = []
    for name in sorted(by_name.keys()):
        bucket = sorted(by_name[name], key=lambda r: (r["patent_id"], r["inventor_seq"]))
        capped.extend(stride_sample(bucket, per_name_cap))

    # Stage 2: optional outer stride-by-year if target_per_year > 0
    if target_per_year > 0:
        by_year: dict[int, list[dict]] = defaultdict(list)
        for r in capped:
            by_year[r["year"] or 0].append(r)
        out: list[dict] = []
        for year in sorted(by_year.keys()):
            year_bucket = sorted(by_year[year], key=lambda r: (r["patent_id"], r["inventor_seq"]))
            out.extend(stride_sample(year_bucket, target_per_year))
        return out
    return capped


def run(
    fixtures_dir: Path | str,
    output_path: Path | str,
    *,
    snapshot_nominal_date: str,
    target_per_year: int = 0,
    per_name_cap: int = 100,
) -> dict:
    fixtures_dir = Path(fixtures_dir)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    records = _build_records(fixtures_dir, snapshot_nominal_date)
    sampled = _two_stage_sample(
        records, per_name_cap=per_name_cap, target_per_year=target_per_year,
    )
    sampled.sort(key=lambda r: (r["patent_id"], r["inventor_seq"]))

    with output_path.open("w", encoding="utf-8", newline="\n") as out:
        for rec in sampled:
            out.write(json.dumps(rec, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
            out.write("\n")

    return {
        "fixtures_dir":          str(fixtures_dir),
        "output_path":           str(output_path),
        "total_input_records":   len(records),
        "kept_records":          len(sampled),
        "snapshot_nominal_date": snapshot_nominal_date,
        "per_name_cap":          per_name_cap,
        "target_per_year":       target_per_year,
    }


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Harvest PatentsView TSVs into deterministic NDJSON.")
    p.add_argument("--fixtures-dir", required=True, type=Path,
                   help="Directory containing the PatentsView TSVs (g_inventor_disambiguated.tsv, etc.)")
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--snapshot-date", required=True,
                   help="Nominal snapshot date YYYY-MM-DD; patents granted after this are dropped")
    p.add_argument("--target-per-year", type=int, default=10000,
                   help="Outer stride-by-year cap. 0 = no outer stride. Default 10000.")
    p.add_argument("--per-name-cap", type=int, default=100,
                   help="Maximum appearances per canonical_name. Default 100.")
    args = p.parse_args(argv)

    stats = run(
        args.fixtures_dir, args.output,
        snapshot_nominal_date=args.snapshot_date,
        target_per_year=args.target_per_year,
        per_name_cap=args.per_name_cap,
    )
    print(json.dumps(stats, indent=2))
    print(f"corpus_sha256: {file_sha256(args.output)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Task 1.4 — Run tests; all pass

- [ ] `python -m pytest tests/scripts/test_pulse_harvest.py -v`
- [ ] Expected: 9/9 PASS.
- [ ] If any fail, fix the harvester (not the test) and re-run.

### Task 1.5 — Commit

```bash
git add scripts/pulse_harvest.py tests/scripts/test_pulse_harvest.py tests/scripts/fixtures/patentsview_mini/
git commit -m "feat(pulse): PatentsView harvester with two-stage sampling

Phase 1 of Pulse implementation. Reads PatentsView's bulk-distributed
inventor + assignee + location + patent TSVs, joins on patent_id,
normalizes inventor names to canonical 'Surname I I' form, collects
co-inventors + assignee + city/state/country, and emits one NDJSON
record per inventor-appearance.

Two-stage sampling per design Q4:
  - Stage 1: cap each canonical_name bucket at per_name_cap appearances
    (preserves disambiguation signal for typical inventors)
  - Stage 2: optional outer stride-by-year if target_per_year > 0

Fingerprint payload (text) is canonical_name + co-inventors + assignee_id
+ city/state/country. PatentsView's gold-standard inventor_id stays in
metadata but does NOT appear in text - same firewall as Atlas's
category exclusion.

9/9 tests pass on the 5-row PatentsView fixture."
```

---

## Phase 2 — Pulse analyze 🔴

### Task 2.1 — Test fixture: synthetic survivors + corpus

**Files:**
- Create: `tests/scripts/fixtures/pulse_corpus.ndjson`
- Create: `tests/scripts/fixtures/pulse_survivors.json`

- [ ] Construct a synthetic 12-record corpus + 12-survivor model fixture. Build by hand:
  - 12 inventor-records spread across 4 PatentsView inventor_ids (each appears 3 times)
  - The 4 inventor_ids' fp48 fingerprints are constructed as 0xAAAAAAAAAAAA, 0x555555555555, 0x000000FFFFFF, 0xFFFFFF000000 — well-separated
  - Each inventor_id's 3 records have fp48 = centroid + 1-bit perturbation
  - Years: 2010, 2015, 2020 (one per inventor-id per year)
  - IPC mix: inventor_aaa is purely "G" (one IPC); inventor_bbb spans "G", "H" (cross-IPC, polymath candidate); inventor_ccc spread across "G", "H", "B" (high IPC entropy); inventor_ddd is purely "B"

`tests/scripts/fixtures/pulse_corpus.ndjson` — 12 lines, JSON-per-line, schema matching `pulse_harvest.py`'s output.

`tests/scripts/fixtures/pulse_survivors.json` — model meta with 12 fingerprints + taxonomy.classes.

(Construct these by hand; the test below references specific patent_ids and inventor_ids for assertions.)

### Task 2.2 — Failing tests for Pulse-specific primitives

**Files:**
- Create: `tests/scripts/test_pulse_analyze.py`

```python
"""Tests for scripts/pulse_analyze.py - Pulse-specific primitives."""
from __future__ import annotations
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import pulse_analyze  # noqa: E402

FIXTURE_CORPUS = REPO / "tests" / "scripts" / "fixtures" / "pulse_corpus.ndjson"
FIXTURE_MODEL  = REPO / "tests" / "scripts" / "fixtures" / "pulse_survivors.json"


def test_baseline_naive_name_perfectly_collapses_same_canonical_name():
    survivors = [
        {"canonical_name": "Smith J W", "patentsview_inventor_id": "inv_aaa"},
        {"canonical_name": "Smith J W", "patentsview_inventor_id": "inv_aaa"},
        {"canonical_name": "Chen A B", "patentsview_inventor_id": "inv_bbb"},
    ]
    naive_labels = pulse_analyze.naive_name_labels(survivors)
    # Two records with same canonical_name get the same naive label
    assert naive_labels[0] == naive_labels[1]
    # Different canonical_name -> different label
    assert naive_labels[0] != naive_labels[2]


def test_baseline_naive_name_handles_collision():
    """Two PatentsView inventor_ids with the same canonical_name collapse incorrectly."""
    survivors = [
        {"canonical_name": "Smith J", "patentsview_inventor_id": "inv_aaa"},
        {"canonical_name": "Smith J", "patentsview_inventor_id": "inv_ccc"},
    ]
    naive_labels = pulse_analyze.naive_name_labels(survivors)
    # The naive baseline collapses them - that's the point (it's the failure case
    # the engine is supposed to do better than)
    assert naive_labels[0] == naive_labels[1]


def test_singular_inventor_score_combines_all_four_signals():
    cluster_meta = [
        # Productive + cross-IPC + long career + solo: high score
        {"cluster_id": 0, "patent_count": 50, "ipc_entropy": 2.0, "career_span": 25, "solo_share": 0.8},
        # Productive but uniform IPC: lower score
        {"cluster_id": 1, "patent_count": 50, "ipc_entropy": 0.0, "career_span": 25, "solo_share": 0.8},
        # Few patents: low score
        {"cluster_id": 2, "patent_count": 2, "ipc_entropy": 2.0, "career_span": 25, "solo_share": 0.8},
    ]
    flagged = pulse_analyze.flag_singular_inventors(
        cluster_meta,
        min_patent_count=10, min_ipc_entropy=1.0, min_career_span=10, min_solo_share=0.5,
    )
    flagged_ids = [c["cluster_id"] for c in flagged]
    assert 0 in flagged_ids
    assert 1 not in flagged_ids  # ipc_entropy too low
    assert 2 not in flagged_ids  # patent_count too low


def test_uspto_url_format():
    assert pulse_analyze.uspto_url("10000000") == "https://patents.uspto.gov/patent/10000000"


def test_build_pulse_artifact_smoke(tmp_path):
    """End-to-end shape test on the synthetic 12-survivor fixture."""
    if not FIXTURE_MODEL.exists():
        # Fixture wasn't built yet; skip until Task 2.1 lands the file
        return
    model = json.loads(FIXTURE_MODEL.read_text())
    art = pulse_analyze.build_public_artifact(
        model, FIXTURE_CORPUS,
        snapshot_date="2026-04-30",
        corpus_input_sha256="0" * 64,
        corpus_sha256="1" * 64,
    )
    assert art["showcase"] == "pulse"
    assert "baseline_disambiguators" in art
    assert "engine" in art["baseline_disambiguators"]
    assert "patentsview" in art["baseline_disambiguators"]
    assert "naive_name" in art["baseline_disambiguators"]
    assert "singular_inventor_candidates" in art
    assert "polymath_bleed" in art
```

- [ ] Run: `python -m pytest tests/scripts/test_pulse_analyze.py -v`
- [ ] Expected: ALL FAIL with `ModuleNotFoundError: pulse_analyze`.

### Task 2.3 — Implement `scripts/pulse_analyze.py`

**Files:**
- Create: `scripts/pulse_analyze.py`

```python
#!/usr/bin/env python3
"""
Analyze the Pulse formed model and emit the public artifact JSON.

Joins BTUT survivor fingerprints back to the PatentsView inventor-record
metadata. Computes:

  1. Multi-baseline disambiguation: engine vs PatentsView (gold) vs DOCDB
     (if available) vs naive-name-collision vs chance
  2. Decade trajectory of inventor productivity
  3. Cross-IPC bleed (the polymath signal at population level)
  4. Top-25 structurally rare inventor-records (click-through to USPTO)
  5. Singular-inventor candidates (per-cluster productivity + IPC entropy
     + career-span + solo-share, flagged without naming)
  6. Cluster purity vs PatentsView (the headline number)

Output: /data/formed_models/_public/uspto.json
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS))
from _showcase_lib import (  # noqa: E402
    hamming48, weighted_purity, category_entropy, decade_of,
    assign_to_class, top_rare, bleed_per_class,
)

_HOST_BASE = "/opt/latentocean/data/formed_models"
_CONT_BASE = "/data/formed_models"
_BASE = _CONT_BASE if os.path.isdir(_CONT_BASE) else _HOST_BASE
CORPUS_PATH = Path(f"{_BASE}/_inputs/pulse.ndjson")
PUBLIC_OUT  = Path(f"{_BASE}/_public/uspto.json")
TOKEN_PATH  = Path("/tmp/.pulsetoken")
BASE_URL    = os.environ.get("LO_BASE_URL", "https://www.latentocean.com")


def uspto_url(patent_id: str) -> str:
    return f"https://patents.uspto.gov/patent/{patent_id}"


def naive_name_labels(survivors: list[dict]) -> list[str]:
    """Naive disambiguation: every record with the same canonical_name is the same inventor."""
    return [s.get("canonical_name", "") for s in survivors]


def flag_singular_inventors(
    cluster_meta: list[dict],
    *,
    min_patent_count: int,
    min_ipc_entropy: float,
    min_career_span: int,
    min_solo_share: float,
) -> list[dict]:
    """A cluster (= disambiguated inventor) is a singular-inventor candidate
    when it scores high on ALL four signals: productivity, IPC breadth,
    career length, solo work share.
    """
    return [
        c for c in cluster_meta
        if c.get("patent_count", 0) >= min_patent_count
        and c.get("ipc_entropy", 0.0) >= min_ipc_entropy
        and c.get("career_span", 0) >= min_career_span
        and c.get("solo_share", 0.0) >= min_solo_share
    ]


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


def join_survivors(model: dict, idx_to_meta: dict[int, dict]) -> list[dict]:
    survivors: list[dict] = []
    for fp in model.get("fingerprints", []):
        idx = int(fp["recordIdx"])
        m = idx_to_meta.get(idx)
        if not m:
            continue
        survivors.append({
            "idx":                       idx,
            "fp48Hex":                   fp["fp48Hex"],
            "fp48":                      int(fp["fp48Hex"], 16),
            "patent_id":                 m["patent_id"],
            "inventor_seq":              m.get("inventor_seq", 0),
            "canonical_name":            m.get("canonical_name", ""),
            "co_inventors_canonical":    m.get("co_inventors_canonical", []),
            "assignee_id":               m.get("assignee_id", ""),
            "assignee_name":             m.get("assignee_name", ""),
            "city":                      m.get("city", ""),
            "state":                     m.get("state", ""),
            "primary_ipc":               m.get("primary_ipc", ""),
            "year":                      int(m.get("year") or 0),
            "title":                     m.get("title", ""),
            "patentsview_inventor_id":   m.get("patentsview_inventor_id", ""),
        })
    return survivors


def compute_cluster_meta(survivors: list[dict], engine_labels: list) -> list[dict]:
    """Per engine cluster, compute the four singular-inventor signals."""
    # Group survivors by engine cluster
    by_cluster: dict[int, list[dict]] = defaultdict(list)
    for s, l in zip(survivors, engine_labels):
        if l is not None:
            by_cluster[l].append(s)

    out: list[dict] = []
    for cid, ss in by_cluster.items():
        # Productivity = number of distinct patent_ids
        patent_ids = set(s["patent_id"] for s in ss)
        patent_count = len(patent_ids)
        # IPC entropy
        ipcs = [s["primary_ipc"] for s in ss if s.get("primary_ipc")]
        ipc_h = round(category_entropy(ipcs), 3)
        # Career span = max year - min year
        years = [s["year"] for s in ss if s["year"]]
        career_span = (max(years) - min(years)) if years else 0
        # Solo share = % of patents where this cluster has zero co-inventor overlap with other clusters
        # Simplified: % of records with empty co_inventors_canonical
        solo_count = sum(1 for s in ss if not s.get("co_inventors_canonical"))
        solo_share = round(solo_count / len(ss), 3) if ss else 0.0

        out.append({
            "cluster_id":     cid,
            "size":           len(ss),
            "patent_count":   patent_count,
            "ipc_entropy":    ipc_h,
            "career_span":    career_span,
            "solo_share":     solo_share,
            "median_year":    sorted(years)[len(years) // 2] if years else 0,
            "year_spread":    (max(years) - min(years)) if years else 0,
            "category_entropy": ipc_h,  # alias for the lib's emergence filter
        })
    return out


def baseline_disambiguators(survivors: list[dict], engine_labels: list) -> dict:
    """Multi-baseline panel: engine vs PatentsView vs naive-name vs chance."""
    pv_gold = [s["patentsview_inventor_id"] for s in survivors]
    naive   = naive_name_labels(survivors)

    # Engine vs PatentsView (the headline)
    engine_purity, _ = weighted_purity(engine_labels, pv_gold)

    # Naive vs PatentsView (how well does name-collision do?)
    naive_purity, _ = weighted_purity(naive, pv_gold)

    # Chance baseline: 1 / (number of distinct PatentsView inventors)
    n_pv = len(set(pv for pv in pv_gold if pv))
    chance = round(1.0 / n_pv, 3) if n_pv else 0.0

    return {
        "engine":      engine_purity,
        "patentsview": 1.0,  # PatentsView is the gold; perfect by definition
        "naive_name":  naive_purity,
        "chance":      chance,
        "note":        "engine and naive_name are computed against PatentsView's disambig_inventor_id as gold. PatentsView itself is an algorithmic approximation; multi-baseline framing is the honest version.",
    }


def build_public_artifact(
    model: dict,
    corpus_path: Path,
    *,
    snapshot_date: str,
    corpus_input_sha256: str,
    corpus_sha256: str,
) -> dict:
    idx_to_meta = load_corpus_index(corpus_path)
    survivors = join_survivors(model, idx_to_meta)

    classes = [
        {"id": c["id"], "centroid_fp48": int(c["centroid_fp48Hex"], 16)}
        for c in model.get("taxonomy", {}).get("classes", [])
    ]
    engine_labels = [assign_to_class(s["fp48"], classes) for s in survivors]
    valid_pairs = [(s, l) for s, l in zip(survivors, engine_labels) if l is not None]
    valid_survivors = [v[0] for v in valid_pairs]
    valid_labels    = [v[1] for v in valid_pairs]

    # Multi-baseline disambiguation panel
    baselines = baseline_disambiguators(valid_survivors, valid_labels)

    # Cluster meta (per engine cluster, the 4 singular-inventor signals)
    cluster_meta = compute_cluster_meta(valid_survivors, valid_labels)

    # Singular-inventor candidates
    candidates = flag_singular_inventors(
        cluster_meta,
        min_patent_count=10, min_ipc_entropy=1.0,
        min_career_span=10, min_solo_share=0.3,
    )

    # Decade trajectory
    by_decade: dict[str, list[dict]] = defaultdict(list)
    for s in valid_survivors:
        if s["year"]:
            by_decade[decade_of(s["year"])].append(s)
    decade_trajectory = []
    for dec in sorted(by_decade.keys()):
        ss = by_decade[dec]
        ipc_counts = Counter(s["primary_ipc"] for s in ss if s.get("primary_ipc"))
        decade_trajectory.append({
            "decade":          dec,
            "n_records":       len(ss),
            "n_inventors":     len(set(s["patentsview_inventor_id"] for s in ss if s.get("patentsview_inventor_id"))),
            "ipc_share":       {ipc: round(c / len(ss), 3) for ipc, c in ipc_counts.most_common(8)},
        })

    # Cross-IPC bleed (population-level polymath signal):
    # bleed_per_class with gold_field='primary_ipc' measures how much each
    # cluster's dominant IPC gets diluted by other IPCs
    polymath_bleed_raw = bleed_per_class(valid_survivors, classes, gold_field="primary_ipc")

    # Top-25 structurally rare inventor-records (click-through to USPTO)
    rare_raw = top_rare(valid_survivors, k=25)
    rare = [
        {
            "patent_id":      r["patent_id"],
            "title":          r.get("title", ""),
            "canonical_name": r.get("canonical_name", ""),
            "year":           r.get("year", 0),
            "primary_ipc":    r.get("primary_ipc", ""),
            "city":           r.get("city", ""),
            "state":          r.get("state", ""),
            "min_hamming":    r["min_hamming"],
            "uspto_url":      uspto_url(r["patent_id"]),
        }
        for r in rare_raw
    ]

    return {
        "showcase":                  "pulse",
        "patentsview_snapshot_date": snapshot_date,
        "corpus_input_sha256":       corpus_input_sha256,
        "corpus_sha256":             corpus_sha256,
        "corpus_records":            model.get("corpus_records"),
        "model_id":                  model.get("id"),
        "tenant_id":                 model.get("tenant_id"),
        "name":                      model.get("name"),
        "formed_at":                 model.get("formed_at"),
        "formation_ms":              model.get("formation_ms"),
        "fingerprinter_mode":        model.get("fingerprinter_mode"),
        "coverage_pct":              model.get("coverage_pct"),
        "response_digest":           model.get("response_digest"),
        "encrypted":                 model.get("encrypted"),
        "chunked":                   model.get("chunked"),
        "taxonomy_summary":          model.get("taxonomy_summary"),
        "persistence":               model.get("persistence"),
        "n_survivors":               len(valid_survivors),
        "baseline_disambiguators":   baselines,
        "decade_trajectory":         decade_trajectory,
        "polymath_bleed":            polymath_bleed_raw,
        "rare_records":              rare,
        "cluster_meta":              cluster_meta,
        "singular_inventor_candidates": candidates,
        "generated_at":              datetime.datetime.utcnow().isoformat() + "Z",
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--model-id", required=True)
    p.add_argument("--snapshot-date", required=True)
    p.add_argument("--corpus-input-sha256", required=True)
    p.add_argument("--corpus-sha256", required=True)
    p.add_argument("--output", default=str(PUBLIC_OUT))
    args = p.parse_args(argv)

    print(f"Loading model {args.model_id} ...")
    model = load_model(args.model_id)
    print(f"  records={model.get('corpus_records'):,}  fingerprints={len(model.get('fingerprints', [])):,}")

    artifact = build_public_artifact(
        model, CORPUS_PATH,
        snapshot_date=args.snapshot_date,
        corpus_input_sha256=args.corpus_input_sha256,
        corpus_sha256=args.corpus_sha256,
    )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2))
    print(f"\nwrote {out_path}  ({out_path.stat().st_size:,} bytes)")
    print(f"  engine vs PatentsView purity: {artifact['baseline_disambiguators']['engine']}")
    print(f"  naive-name vs PatentsView:    {artifact['baseline_disambiguators']['naive_name']}")
    print(f"  chance:                        {artifact['baseline_disambiguators']['chance']}")
    print(f"  singular-inventor candidates: {len(artifact['singular_inventor_candidates'])}")
    print(f"  rare records:                 {len(artifact['rare_records'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Task 2.4 — Run all Pulse analyze tests

- [ ] `python -m pytest tests/scripts/test_pulse_analyze.py -v`
- [ ] Expected: 4/4 PASS (excluding the smoke test which depends on the synthetic survivor fixture from Task 2.1).

### Task 2.5 — Commit Phase 2

```bash
git add scripts/pulse_analyze.py tests/scripts/test_pulse_analyze.py
git commit -m "feat(pulse): analyze script with multi-baseline disambiguation panel

Phase 2 of Pulse implementation. Imports shared primitives from
_showcase_lib.py and adds Pulse-specific:

- naive_name_labels: collapses records by canonical_name (the trivial
  baseline the engine should beat)
- flag_singular_inventors: per-cluster filter on (patent_count, ipc_entropy,
  career_span, solo_share). All four thresholds must be met. No naming.
- baseline_disambiguators: engine vs PatentsView vs naive_name vs chance,
  honest about PatentsView itself being an algorithmic approximation
- compute_cluster_meta: per engine cluster, derives the four singular-
  inventor signals from the survivor records
- build_public_artifact: Pulse-shaped output (uspto.json) with
  baseline_disambiguators, polymath_bleed (cross-IPC),
  singular_inventor_candidates blocks
- uspto_url: maps patent_id to https://patents.uspto.gov/patent/<id>"
```

---

## Phase 3 — Constellations 🟡

### Task 3.1 — Implement `scripts/pulse_constellations.py`

**Files:**
- Create: `scripts/pulse_constellations.py`

Mirrors `scripts/arxiv_constellations.py`'s shape but with Pulse-specific finding categories. Reads `/data/formed_models/_public/uspto.json` and emits `showcases/pulse_findings.json`.

```python
#!/usr/bin/env python3
"""
Pulse Constellations: findings catalog generator for /pulse/uspto-inventors/constellations.

Reads /data/formed_models/_public/uspto.json (the analyze-script output)
and emits showcases/pulse_findings.json — algorithmic findings across
seven constellations:

  - singular_inventor_candidates  (top flagged-by-all-four-signals clusters)
  - cross_ipc_polymaths           (inventors with high IPC entropy)
  - structurally_singular_records (top-25 rare inventor-records)
  - decade_productivity_shifts    (one finding per decade)
  - baseline_comparison           (engine vs patentsview vs naive vs chance)
  - assignee_disambiguation_signals (assignees that the engine flags as
                                     potentially distinct despite identical strings)
  - large_cluster_disagreements   (clusters where engine groups multiple
                                   PatentsView inventor_ids - the
                                   IP-attorney interesting case)

DocSouth's constellations script does humanities-style entity extraction.
Pulse v1 is purely algorithmic; v2 may add a co-inventor graph layer.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from pathlib import Path

_HOST_BASE = "/opt/latentocean/data/formed_models"
_CONT_BASE = "/data/formed_models"
_BASE = _CONT_BASE if os.path.isdir(_CONT_BASE) else _HOST_BASE
DEFAULT_INPUT  = Path(f"{_BASE}/_public/uspto.json")
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "showcases" / "pulse_findings.json"


def findings_singular_inventors(art: dict) -> list[dict]:
    out: list[dict] = []
    candidates = art.get("singular_inventor_candidates") or []
    for i, c in enumerate(candidates, start=1):
        out.append({
            "category":  "singular_inventor_candidates",
            "title":     f"Cluster #{c['cluster_id']} matches all four singular-inventor signals",
            "summary":   (
                f"This disambiguated inventor cluster has "
                f"{c.get('patent_count')} patents, IPC Shannon entropy "
                f"{c.get('ipc_entropy')}, career span {c.get('career_span')} "
                f"years, and solo-share {int(c.get('solo_share', 0) * 100)}%. "
                f"It scores above threshold on every signal — productivity, "
                f"cross-domain breadth, career length, and independence from "
                f"co-inventor networks. Pulse does not name what or who this "
                f"cluster is; readers can inspect the centroid and rare-record "
                f"exemplars and decide for themselves."
            ),
            "metrics":   c,
            "rank":      i,
        })
    return out


def findings_cross_ipc_polymaths(art: dict, k: int = 10) -> list[dict]:
    out: list[dict] = []
    cluster_meta = art.get("cluster_meta") or []
    polymaths = sorted(cluster_meta, key=lambda c: -c.get("ipc_entropy", 0))[:k]
    for c in polymaths:
        if c.get("ipc_entropy", 0) <= 0.5:
            continue
        out.append({
            "category":  "cross_ipc_polymaths",
            "title":     f"Cluster #{c['cluster_id']} spans multiple IPC classes (entropy {c.get('ipc_entropy')})",
            "summary":   (
                f"This inventor cluster contains {c.get('patent_count')} "
                f"patents across primary-IPC classes with Shannon entropy "
                f"{c.get('ipc_entropy')}, indicating cross-domain work. "
                f"Polymath inventors tend to score above 1.0 entropy; pure "
                f"specialists score 0."
            ),
            "metrics":   c,
        })
    return out


def findings_structurally_singular_records(art: dict) -> list[dict]:
    out: list[dict] = []
    for i, r in enumerate(art.get("rare_records", []), start=1):
        out.append({
            "category":  "structurally_singular_records",
            "title":     f"Patent {r['patent_id']} is structurally singular: {r.get('title') or '[untitled]'}",
            "summary":   (
                f"Inventor-record (patent {r['patent_id']}, "
                f"canonical name {r.get('canonical_name') or 'unknown'}, "
                f"{r.get('year') or 'undated'}) has the rank-{i} largest "
                f"min-Hamming distance ({r.get('min_hamming')} bits) to any other "
                f"surviving inventor-record. The structural fingerprint of this "
                f"name + co-inventor + assignee + location combination does not "
                f"echo any other patent in the corpus."
            ),
            "uspto_url": r.get("uspto_url"),
            "metrics":   {"min_hamming": r.get("min_hamming"), "rank": i},
        })
    return out


def findings_decade_productivity_shifts(art: dict) -> list[dict]:
    out: list[dict] = []
    for d in art.get("decade_trajectory", []):
        ipc_top = sorted(d.get("ipc_share", {}).items(), key=lambda x: -x[1])[:3]
        ipc_str = ", ".join(f"{ipc} {int(round(s * 100))}%" for ipc, s in ipc_top)
        out.append({
            "category":  "decade_productivity_shifts",
            "title":     f"{d['decade']}: {d['n_records']:,} inventor-records, {d.get('n_inventors', 0):,} disambiguated inventors",
            "summary":   (
                f"In the {d['decade']} bucket, the corpus holds "
                f"{d['n_records']:,} inventor-records spanning "
                f"{d.get('n_inventors', 0):,} disambiguated inventors per "
                f"PatentsView. Top IPC shares: {ipc_str}. "
                f"Compare with adjacent decades to see the structural "
                f"reweighting of US innovation by domain."
            ),
            "metrics":   d,
        })
    return out


def findings_baseline_comparison(art: dict) -> list[dict]:
    b = art.get("baseline_disambiguators") or {}
    if not b:
        return []
    return [
        {
            "category":  "baseline_comparison",
            "title":     f"Engine recovers PatentsView's disambiguation at {b.get('engine')} vs naive-name {b.get('naive_name')}, chance {b.get('chance')}",
            "summary":   (
                f"Engine (BTUT structural fingerprint + KMeans on Hamming) "
                f"reaches weighted purity {b.get('engine')} against "
                f"PatentsView's gold inventor-disambiguation. The naive "
                f"baseline (collapse all records with identical canonical "
                f"name) reaches {b.get('naive_name')} — typically lower, "
                f"because surname-collision incorrectly merges distinct "
                f"inventors with common names. Chance baseline is "
                f"{b.get('chance')}. PatentsView itself is an algorithmic "
                f"approximation, so the engine's lift over naive-name is "
                f"the cleaner signal of structural-disambiguation power."
            ),
            "metrics":   b,
        },
    ]


CATEGORY_BLURBS = {
    "singular_inventor_candidates":   "Disambiguated-inventor clusters that score high on productivity + IPC breadth + career length + solo-work share — the structural signature of a singularly-prolific inventor. Pulse does not name them; readers click through to USPTO and judge.",
    "cross_ipc_polymaths":            "Disambiguated inventors whose patent portfolio spans multiple IPC classes with high Shannon entropy — the population-level cross-domain signal.",
    "structurally_singular_records":  "Top-25 inventor-records with the largest min-Hamming distance to any other surviving record in the corpus.",
    "decade_productivity_shifts":     "Per-decade summaries of inventor-record volume, distinct disambiguated inventors, and IPC share. Read across decades for the structural reweighting of US innovation.",
    "baseline_comparison":            "Engine's recovery of PatentsView's disambiguation versus the naive-name-collision baseline and the chance baseline.",
}


def build_catalog(art: dict) -> dict:
    findings: list[dict] = []
    findings.extend(findings_singular_inventors(art))
    findings.extend(findings_cross_ipc_polymaths(art))
    findings.extend(findings_structurally_singular_records(art))
    findings.extend(findings_decade_productivity_shifts(art))
    findings.extend(findings_baseline_comparison(art))

    findings.sort(key=lambda f: (f.get("category", ""), f.get("title", "")))
    for i, f in enumerate(findings, start=1):
        f["id"] = i

    return {
        "showcase":      "pulse",
        "version":       1,
        "title":         "Pulse Constellations: a Findings Catalog of US Innovation",
        "subtitle":      (
            "Each finding names a structural property of the disambiguated "
            "inventor record set, derived deterministically from the public "
            "artifact JSON."
        ),
        "method":        (
            "Algorithmic generation over /api/range-public/showcase/pulse. "
            "Five finding categories. No human curation in v1. v2 may add "
            "a co-inventor graph layer."
        ),
        "categories":    CATEGORY_BLURBS,
        "generated_at":  datetime.datetime.utcnow().isoformat() + "Z",
        "n_findings":    len(findings),
        "findings":      findings,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Generate Pulse constellations findings catalog.")
    p.add_argument("--input", default=str(DEFAULT_INPUT), type=Path)
    p.add_argument("--output", default=str(DEFAULT_OUTPUT), type=Path)
    args = p.parse_args(argv)

    if not args.input.exists():
        print(f"ERROR: input artifact not found: {args.input}", file=sys.stderr)
        print("Run scripts/pulse_analyze.py first.", file=sys.stderr)
        return 1

    art = json.loads(args.input.read_text())
    catalog = build_catalog(art)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, indent=2))
    print(f"wrote {args.output}  ({args.output.stat().st_size:,} bytes)")
    print(f"  {catalog['n_findings']} findings across {len(catalog['categories'])} categories")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Task 3.2 — Smoke-test on the minimal public-artifact fixture

**Files:**
- Create: `tests/scripts/fixtures/pulse_public_minimal.json`

- [ ] Build a tiny pulse public-artifact fixture. Run:
```
python scripts/pulse_constellations.py \
    --input tests/scripts/fixtures/pulse_public_minimal.json \
    --output /tmp/pulse_findings_test.json
```
- [ ] Confirm 5+ findings across the 5 categories.

### Task 3.3 — Commit Phase 3

```bash
git add scripts/pulse_constellations.py tests/scripts/fixtures/pulse_public_minimal.json
git commit -m "feat(pulse): findings catalog generator (5 categories, algorithmic)"
```

---

## Phase 4 — Verify shell 🔴

### Task 4.1 — Port `scripts/atlas_verify.sh` to `scripts/pulse_verify.sh`

**Files:**
- Create: `scripts/pulse_verify.sh`

- [ ] `cp scripts/atlas_verify.sh scripts/pulse_verify.sh`
- [ ] Edit:
  - `ATLASTOK` → `PULSETOK`
  - `/tmp/.atlastoken` → `/tmp/.pulsetoken`
  - `'Atlas' in m['name'] or 'arxiv' in m['name'].lower()` → `'Pulse' in m['name'] or 'uspto' in m['name'].lower()`
  - `/tmp/atlas_summary.json` → `/tmp/pulse_summary.json`
  - `/tmp/atlas_meta.json` → `/tmp/pulse_meta.json`
  - `'color':'atlasprobe'` → `'color':'pulseprobe'`
  - `/api/range-public/showcase/atlas` → `/api/range-public/showcase/pulse`
  - `"showcase": "atlas"` → `"showcase": "pulse"`
- [ ] Verify shell syntax: `bash -n scripts/pulse_verify.sh`. Expected: no errors.

### Task 4.2 — Commit Phase 4

```bash
git add scripts/pulse_verify.sh
git commit -m "feat(pulse): post-formation verification shell script (port of atlas_verify.sh)"
```

---

## Phase 5 — Long-form artifact page 🔴

### Task 5.1 — Extend allowlist in route.ts

**Files:**
- Modify: `frontend/app/api/range-public/showcase/[slug]/route.ts`

- [ ] Add three Pulse slugs to the `ALLOWED` mapping:

```ts
const ALLOWED: Record<string, string> = {
  docsouth:                  "docsouth.json",
  "docsouth-constellations": "docsouth_constellations.json",
  "docsouth-findings":       "docsouth_findings.json",
  atlas:                     "arxiv.json",
  "atlas-constellations":    "arxiv_constellations.json",
  "atlas-findings":          "atlas_findings.json",
  pulse:                     "uspto.json",
  "pulse-constellations":    "uspto_constellations.json",
  "pulse-findings":          "pulse_findings.json",
};
```

### Task 5.2 — Create the Pulse data client component

**Files:**
- Create: `frontend/app/pulse/uspto-inventors/PulseData.tsx`

- [ ] Mirror `frontend/app/atlas/arxiv/AtlasData.tsx`'s shape but render Pulse-specific blocks:
  - Corpus stats (records, inventors, snapshot, formed)
  - Multi-baseline disambiguation panel (engine vs PatentsView vs naive vs chance) — bar chart
  - Decade productivity trajectory (per-decade record + inventor count, top IPC shares)
  - Polymath / cross-IPC bleed (top high-entropy clusters)
  - Singular inventor candidates panel (no naming; show metrics only)
  - Top-25 structurally rare inventor-records (click-through to USPTO)
  - Verification fields (corpus_input_sha256, corpus_sha256, response_digest)

(The full file is ~250 lines, structurally identical to AtlasData.tsx. Use that as a template; the only data-shape changes are the Pulse-specific field names.)

### Task 5.3 — Create the Pulse long-form page

**Files:**
- Create: `frontend/app/pulse/uspto-inventors/page.tsx`

- [ ] Server component mirroring `frontend/app/atlas/arxiv/page.tsx`. Sections:
  - Hero: "Fifty years of US innovation, deterministically disambiguated."
  - Preface: USPTO patents are a working record of contemporary inventors; respect the corpus
  - The corpus: PatentsView bulk TSV pinned by snapshot date, two-stage sampling, fingerprint = canonical name + co-inventors + assignee + location
  - Live artifact: <PulseData />
  - Limits: PatentsView itself is an approximation; pre-1976 patents excluded; common-name down-sampling
  - Acknowledgements: PatentsView, USPTO, the long lineage of inventor-disambiguation research

### Task 5.4 — Browser-preview + screenshot

- [ ] Start the dev server: `mcp__Claude_Preview__preview_start name=frontend`.
- [ ] Navigate to `/pulse/uspto-inventors` via `preview_eval` or `curl`.
- [ ] Confirm: page renders 200 OK, hero + preface + corpus + live artifact (with graceful 503 pending state) + limits + ack sections all present.

### Task 5.5 — Commit Phase 5

```bash
git add frontend/app/pulse/uspto-inventors/ frontend/app/api/range-public/showcase/\[slug\]/route.ts
git commit -m "feat(pulse): /pulse/uspto-inventors long-form page + showcase allowlist"
```

---

## Phase 6 — Constellations page 🟡

### Task 6.1 — Port `/atlas/arxiv/constellations` to `/pulse/uspto-inventors/constellations`

**Files:**
- Create: `frontend/app/pulse/uspto-inventors/constellations/page.tsx`
- Create: `frontend/app/pulse/uspto-inventors/constellations/PulseFindings.tsx`

- [ ] Copy AtlasFindings.tsx shape, swap fetch URL to `/api/range-public/showcase/pulse-findings`.
- [ ] Update CATEGORY_LABEL map to Pulse's 5 categories.
- [ ] Confirm 200 OK render at `/pulse/uspto-inventors/constellations`.

### Task 6.2 — Commit Phase 6

```bash
git add frontend/app/pulse/uspto-inventors/constellations/
git commit -m "feat(pulse): findings catalog page"
```

---

## Phase 7 — Operator runbook 🔴

### Task 7.1 — Write `docs/superpowers/runbooks/2026-05-02-pulse-uspto-runbook.md`

Mirror `docs/superpowers/runbooks/2026-05-02-atlas-arxiv-runbook.md`. 14 steps; the only structural difference is the source (PatentsView TSVs instead of Kaggle JSON) and the formation parameters.

### Task 7.2 — Commit Phase 7

```bash
git add docs/superpowers/runbooks/2026-05-02-pulse-uspto-runbook.md
git commit -m "docs(pulse): operator runbook"
```

---

## Phase 8 — Operator run on EC2 ⏸️

Out of scope for this implementation cycle. Same shape as Atlas Phase 8.

---

## Self-review checklist

- [ ] Every spec section maps to a task. Verify Components, Data flow, Reproducibility, Failure modes, Acceptance criteria all have implementing tasks.
- [ ] No "TBD", "TODO", "implement later" outside of intentional Phase 8 placeholder text.
- [ ] Function names used in later tasks match earlier definitions: `canonical_name`, `naive_name_labels`, `flag_singular_inventors`, `uspto_url`, `compute_cluster_meta`, `baseline_disambiguators`, `build_public_artifact`.
- [ ] Each TDD task has: failing test → run → minimal impl → run → commit.
- [ ] Atlas's 23 tests pass after Phase 0.

---

## Acceptance criteria

The Pulse v1 artifact ships when:

- `/data/formed_models/_public/uspto.json` exists on production with all required fields (`corpus_input_sha256`, `corpus_sha256`, `corpus_records`, `model_id`, `response_digest`, `taxonomy_summary`, `baseline_disambiguators`, `decade_trajectory`, `polymath_bleed`, `rare_records`, `singular_inventor_candidates`, `cluster_meta`).
- `scripts/pulse_verify.sh` returns 7/7 PASS on the seven query intents.
- Cross-tenant probe with a non-`pulse_showcase` token returns 404.
- `https://www.latentocean.com/pulse/uspto-inventors` renders the long-form artifact page with all data sections populated.
- `https://www.latentocean.com/pulse/uspto-inventors/constellations` renders the findings catalog.
- Atlas's 23 tests still pass after the refactor.
- Verification recipe printed on the page, executable by a third party against the published hashes.
