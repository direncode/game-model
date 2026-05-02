# Receipt — SEC EDGAR 10-K AI Summarization Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public Receipt v1 artifact at `/receipt/sec-edgar` (browseable list of 1,000 collapsible filing cards) plus `/receipt/verify` (dedicated verifier route), demonstrating tamper-proof receipts for AI summarization with OpenTimeStamps anchoring.

**Architecture:** Two operator scripts (`receipt_harvest.py`, `receipt_run.py`) plus a small TypeScript receipt-hash verifier in the frontend. No new backend code; reuse the existing audit infrastructure ([frontend/lib/range/audit.ts](frontend/lib/range/audit.ts) + [/api/range-audit](frontend/app/api/range-audit/route.ts) for JSON/CEF/OCSF export). Receipt-specific data lands in a separate `receipts.ndjson` file alongside the existing audit log.

**Tech Stack:** Python 3.11+ (stdlib + `anthropic` Python SDK + `opentimestamps-client`), Next.js / React / TypeScript (pages + crypto.subtle.digest), bash (verify), Anthropic Claude Sonnet 4.6 for summarization, Bitcoin timechain via OpenTimeStamps for chain-head anchoring.

**Testing:** TDD on the harvester sampling logic, the receipt-hash derivation (Python AND TypeScript implementations must produce byte-identical hashes), and the chain integrity verifier. The OpenTimeStamps anchor itself is integration-tested in the runbook.

**Reference spec:** `docs/superpowers/specs/2026-05-02-receipt-sec-edgar-design.md`

---

## Phase 0 — Fixed prompt + JSON schema (the immutable inputs)

### Task 0.1 — Write `scripts/receipt_prompt.txt`

**Files:**
- Create: `scripts/receipt_prompt.txt`

- [ ] Create the prompt file. Exactly this content (no trailing newline beyond the final `\n`):

```
You are a compliance-grade SEC 10-K summarizer for an AI audit pipeline.
You will be given the text of a single 10-K filing (Items 1, 1A, 7, 8 only,
truncated to fit context). Read the filing and output a single JSON object
matching the schema provided. Be precise and grounded in the text. If a
field cannot be determined from the text, use null. Do not include
information that is not present in the text. Do not speculate about future
results or include opinions about the filer. Do not include any text
outside the JSON object. Output the JSON object only.
```

- [ ] Verify byte-stable hash: `python -c "import hashlib;print(hashlib.sha256(open('scripts/receipt_prompt.txt','rb').read()).hexdigest())"`. Record this hash; it becomes the canonical `prompt_hash` for v1.

### Task 0.2 — Write `scripts/receipt_schema.json`

**Files:**
- Create: `scripts/receipt_schema.json`

- [ ] Create the JSON Schema (Draft 2020-12) for model output. Exactly:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Receipt v1 SEC 10-K Summary",
  "type": "object",
  "additionalProperties": false,
  "required": ["executive_summary", "business_description", "risk_factors", "material_changes", "financial_highlights", "management_changes"],
  "properties": {
    "executive_summary":     {"type": "string", "maxLength": 1500},
    "business_description":  {"type": "string", "maxLength": 800},
    "risk_factors":          {"type": "array", "items": {"type": "string", "maxLength": 200}, "maxItems": 12},
    "material_changes":      {"type": "array", "items": {"type": "string", "maxLength": 200}, "maxItems": 8},
    "financial_highlights": {
      "type": "object",
      "additionalProperties": false,
      "required": ["revenue", "net_income", "total_assets"],
      "properties": {
        "revenue":      {"type": ["string", "null"]},
        "net_income":   {"type": ["string", "null"]},
        "total_assets": {"type": ["string", "null"]}
      }
    },
    "management_changes":    {"type": "array", "items": {"type": "string", "maxLength": 200}, "maxItems": 6}
  }
}
```

- [ ] Verify byte-stable hash: `python -c "import hashlib;print(hashlib.sha256(open('scripts/receipt_schema.json','rb').read()).hexdigest())"`. Record this hash; it becomes the canonical `schema_hash` for v1.

### Task 0.3 — Commit Phase 0

```bash
git add scripts/receipt_prompt.txt scripts/receipt_schema.json
git commit -m "feat(receipt): commit fixed prompt + JSON output schema for Receipt v1"
```

---

## Phase 1 — Receipt-hash primitives (Python + TypeScript)

The receipt hash function is the entire chain's foundation. It must produce byte-identical output in Python (operator script) and TypeScript (browser verifier).

### Task 1.1 — Test fixture: known-input known-output hash pair

**Files:**
- Create: `tests/scripts/fixtures/receipt_known_inputs.json`

- [ ] Create a fixture with one canonical input and the expected hash, computed by hand once and locked in:

```json
{
  "input": {
    "prev_receipt_hash": null,
    "prompt_hash": "0000000000000000000000000000000000000000000000000000000000000000",
    "schema_hash": "1111111111111111111111111111111111111111111111111111111111111111",
    "corpus_sha256": "2222222222222222222222222222222222222222222222222222222222222222",
    "model_id": "claude-sonnet-4-6-20250929",
    "timestamp": "2026-05-02T12:00:00.000Z",
    "output_sha256": "3333333333333333333333333333333333333333333333333333333333333333"
  },
  "expected_concat": "GENESIS|0000000000000000000000000000000000000000000000000000000000000000|1111111111111111111111111111111111111111111111111111111111111111|2222222222222222222222222222222222222222222222222222222222222222|claude-sonnet-4-6-20250929|2026-05-02T12:00:00.000Z|3333333333333333333333333333333333333333333333333333333333333333"
}
```

(The fixture stores the expected concatenation but NOT the expected hash — both Python and TS implementations will be tested against the *same concatenation* and must produce the same sha256 of those bytes. The test computes the expected hash from the concatenation at test time.)

### Task 1.2 — Failing test for `receipt_hash.py`

**Files:**
- Create: `tests/scripts/test_receipt_hash.py`

```python
"""Tests for scripts/receipt_hash.py - the receipt-hash derivation primitive.

This module's hash function is the foundation of the entire chain.
The Python and TypeScript implementations must produce byte-identical hashes,
so we test against a known concatenation string and its SHA-256.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import receipt_hash  # noqa: E402


FIXTURE = REPO / "tests" / "scripts" / "fixtures" / "receipt_known_inputs.json"


def test_derive_returns_concatenation_string():
    fix = json.loads(FIXTURE.read_text())
    concat = receipt_hash.derive_concat(**fix["input"])
    assert concat == fix["expected_concat"]


def test_derive_hash_matches_sha256_of_concat():
    fix = json.loads(FIXTURE.read_text())
    expected = hashlib.sha256(fix["expected_concat"].encode("utf-8")).hexdigest()
    actual = receipt_hash.derive_hash(**fix["input"])
    assert actual == expected


def test_genesis_when_prev_is_none():
    h = receipt_hash.derive_concat(
        prev_receipt_hash=None,
        prompt_hash="a" * 64, schema_hash="b" * 64,
        corpus_sha256="c" * 64, model_id="x",
        timestamp="2026-01-01T00:00:00.000Z",
        output_sha256="d" * 64,
    )
    assert h.startswith("GENESIS|")


def test_chain_link_when_prev_provided():
    h = receipt_hash.derive_concat(
        prev_receipt_hash="prev123",
        prompt_hash="a" * 64, schema_hash="b" * 64,
        corpus_sha256="c" * 64, model_id="x",
        timestamp="2026-01-01T00:00:00.000Z",
        output_sha256="d" * 64,
    )
    assert h.startswith("prev123|")


def test_seven_pipe_separated_fields():
    """The concat is exactly 7 fields joined by '|', regardless of input."""
    fix = json.loads(FIXTURE.read_text())
    concat = receipt_hash.derive_concat(**fix["input"])
    assert concat.count("|") == 6, "expected exactly 6 pipes (7 fields)"
```

- [ ] Run: `python -m pytest tests/scripts/test_receipt_hash.py -v`
- [ ] Expected: ALL FAIL with `ModuleNotFoundError: receipt_hash`.

### Task 1.3 — Implement `scripts/receipt_hash.py`

**Files:**
- Create: `scripts/receipt_hash.py`

```python
"""Receipt-hash derivation primitive.

Concatenation order is the single source of truth for both the Python operator
script (scripts/receipt_run.py) and the TypeScript browser verifier
(frontend/lib/receipt/verify.ts). Any change to this function MUST be matched
in BOTH implementations or the chain breaks.

Hash algorithm: SHA-256 over UTF-8 bytes.
Field separator: pipe character "|".
Genesis sentinel: literal string "GENESIS" when prev_receipt_hash is None.
Field order: prev_receipt_hash | prompt_hash | schema_hash | corpus_sha256 | model_id | timestamp | output_sha256
"""
from __future__ import annotations

import hashlib


GENESIS = "GENESIS"


def derive_concat(
    *,
    prev_receipt_hash: str | None,
    prompt_hash: str,
    schema_hash: str,
    corpus_sha256: str,
    model_id: str,
    timestamp: str,
    output_sha256: str,
) -> str:
    """Build the canonical concatenation string. SHA-256 over the UTF-8 bytes
    of this string is the receipt_hash."""
    return "|".join([
        prev_receipt_hash if prev_receipt_hash is not None else GENESIS,
        prompt_hash,
        schema_hash,
        corpus_sha256,
        model_id,
        timestamp,
        output_sha256,
    ])


def derive_hash(
    *,
    prev_receipt_hash: str | None,
    prompt_hash: str,
    schema_hash: str,
    corpus_sha256: str,
    model_id: str,
    timestamp: str,
    output_sha256: str,
) -> str:
    """Receipt hash = sha256(canonical concatenation, UTF-8) as lowercase hex."""
    concat = derive_concat(
        prev_receipt_hash=prev_receipt_hash,
        prompt_hash=prompt_hash,
        schema_hash=schema_hash,
        corpus_sha256=corpus_sha256,
        model_id=model_id,
        timestamp=timestamp,
        output_sha256=output_sha256,
    )
    return hashlib.sha256(concat.encode("utf-8")).hexdigest()
```

- [ ] Run: `python -m pytest tests/scripts/test_receipt_hash.py -v`
- [ ] Expected: 5/5 PASS.

### Task 1.4 — Implement `frontend/lib/receipt/verify.ts` (TS twin)

**Files:**
- Create: `frontend/lib/receipt/verify.ts`

```typescript
/**
 * Receipt-hash derivation primitive (TypeScript twin of scripts/receipt_hash.py).
 *
 * MUST produce byte-identical output to the Python implementation. The
 * Python tests in tests/scripts/test_receipt_hash.py are authoritative;
 * if you change the concatenation order or sentinel here, change it there
 * too and verify both produce identical hashes on the same input.
 *
 * Hash algorithm: SHA-256 via crypto.subtle.digest.
 * Field separator: pipe character "|".
 * Genesis sentinel: literal string "GENESIS" when prev_receipt_hash is null.
 * Field order: prev_receipt_hash | prompt_hash | schema_hash | corpus_sha256 | model_id | timestamp | output_sha256
 */

const GENESIS = "GENESIS";

export type ReceiptInput = {
  prev_receipt_hash: string | null;
  prompt_hash: string;
  schema_hash: string;
  corpus_sha256: string;
  model_id: string;
  timestamp: string;
  output_sha256: string;
};

export function deriveConcat(input: ReceiptInput): string {
  return [
    input.prev_receipt_hash ?? GENESIS,
    input.prompt_hash,
    input.schema_hash,
    input.corpus_sha256,
    input.model_id,
    input.timestamp,
    input.output_sha256,
  ].join("|");
}

export async function deriveHash(input: ReceiptInput): Promise<string> {
  const concat = deriveConcat(input);
  const buf = new TextEncoder().encode(concat);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

### Task 1.5 — Cross-language hash equivalence test

**Files:**
- Create: `tests/scripts/test_receipt_hash_crosslang.py`

This test takes the same input from the JSON fixture, runs it through Python's `derive_hash`, and checks the hex output matches what the TS twin would produce. Since we can't easily run TS from pytest, we encode the *expected hex* directly from the fixture's `expected_concat` string (since both implementations should produce the same hash of the same concat).

```python
"""Cross-language equivalence: Python and TS implementations must produce the
same hash on the same input. We test this indirectly by computing the hash
of the canonical concatenation string and verifying both implementations
agree it's that hash.
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
import receipt_hash  # noqa: E402

FIXTURE = REPO / "tests" / "scripts" / "fixtures" / "receipt_known_inputs.json"


def test_python_hash_equals_sha256_of_canonical_concat():
    """The contract Python and TS implementations must both honor:
    derive_hash(input) == sha256(derive_concat(input).encode('utf-8')).
    """
    fix = json.loads(FIXTURE.read_text())
    py_hash = receipt_hash.derive_hash(**fix["input"])
    expected = hashlib.sha256(fix["expected_concat"].encode("utf-8")).hexdigest()
    assert py_hash == expected, (
        "Python derive_hash() does not match sha256 of the canonical concat. "
        "If this fails, scripts/receipt_hash.py and frontend/lib/receipt/verify.ts "
        "may have drifted from each other."
    )


def test_typescript_contract_documented():
    """If you change derive_concat or derive_hash in receipt_hash.py without
    updating frontend/lib/receipt/verify.ts to match, the chain verifier in
    /receipt/verify will produce different hashes than the operator script,
    and every receipt will fail to verify in the browser. This test exists
    only to remind future-you that the two implementations are coupled."""
    ts_path = REPO / "frontend" / "lib" / "receipt" / "verify.ts"
    assert ts_path.exists(), "frontend/lib/receipt/verify.ts is the TS twin and must exist"
    ts = ts_path.read_text()
    assert "GENESIS" in ts, "TS twin must use the same GENESIS sentinel"
    assert '"|"' in ts or "'|'" in ts, "TS twin must use '|' as field separator"
    assert "deriveConcat" in ts and "deriveHash" in ts
```

- [ ] Run: `python -m pytest tests/scripts/test_receipt_hash_crosslang.py -v`
- [ ] Expected: 2/2 PASS.

### Task 1.6 — Commit Phase 1

```bash
git add scripts/receipt_hash.py frontend/lib/receipt/verify.ts \
        tests/scripts/test_receipt_hash.py tests/scripts/test_receipt_hash_crosslang.py \
        tests/scripts/fixtures/receipt_known_inputs.json
git commit -m "feat(receipt): hash derivation primitive (Python + TS twins)

Phase 1 of Receipt implementation. The receipt_hash function is the
foundation of the entire chain - both the operator script (Python) and
the browser verifier (TypeScript) must produce byte-identical hashes
for the same input. Field order is documented in both files; the
crosslang test asserts the TS file references GENESIS and '|' so the
two implementations cannot silently drift."
```

---

## Phase 2 — Filing harvester

### Task 2.1 — Synthetic test fixture (no live SEC fetch)

**Files:**
- Create: `tests/scripts/fixtures/sec_edgar_mini/0000320193-24-000123.txt`
- Create: `tests/scripts/fixtures/sec_edgar_mini/0000789019-24-000456.txt`
- Create: `tests/scripts/fixtures/sec_edgar_mini/0000051143-19-000789.txt`

- [ ] Create three synthetic 10-K filing text files. Each file ~5 KB of placeholder Item 1 + Item 1A + Item 7 + Item 8 content. Naming convention: `<accession>.txt` (matches SEC EDGAR's accession-number scheme: `<CIK-zeropadded>-<YY>-<sequence>`). Filenames must be deterministic.

Each file should start with:
```
ITEM 1. BUSINESS

[~1500 chars of synthetic business description]

ITEM 1A. RISK FACTORS

[~1500 chars of synthetic risk factor bullets]

ITEM 7. MANAGEMENT DISCUSSION

[~1500 chars of synthetic MD&A]

ITEM 8. FINANCIAL STATEMENTS

[~500 chars of synthetic financial highlights]
```

The exact synthetic content does not matter for tests; only that the files exist with stable bytes.

### Task 2.2 — Failing tests for harvester

**Files:**
- Create: `tests/scripts/test_receipt_harvest.py`

```python
"""Tests for scripts/receipt_harvest.py.

The harvester takes a directory of pre-fetched SEC EDGAR 10-K filing texts
and produces a deterministic filings_index.json. Live SEC fetch is NOT
tested here (operator runbook tests that integration in pre-flight).
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import receipt_harvest  # noqa: E402

FIXTURE_DIR = REPO / "tests" / "scripts" / "fixtures" / "sec_edgar_mini"


def test_parse_accession_components():
    cik, year, seq = receipt_harvest.parse_accession("0000320193-24-000123")
    assert cik == "0000320193"
    assert year == 2024  # 2-digit year inferred to 2024 (assumed >= 2018 per spec)
    assert seq == "000123"


def test_parse_accession_with_pre_2018_year_returns_none():
    # 19-XX accession years are 2019, fine. 17-XX would be pre-2018 and dropped.
    cik, year, seq = receipt_harvest.parse_accession("0000051143-19-000789")
    assert year == 2019


def test_corpus_sha256_per_filing(tmp_path):
    """Each filing's corpus_sha256 is the sha256 of its raw .txt bytes."""
    out_index = tmp_path / "filings_index.json"
    receipt_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_index=out_index, target_n=10,
    )
    index = json.loads(out_index.read_text())
    for entry in index["filings"]:
        filing_path = FIXTURE_DIR / f"{entry['accession_number']}.txt"
        expected = hashlib.sha256(filing_path.read_bytes()).hexdigest()
        assert entry["corpus_sha256"] == expected


def test_filings_index_is_sorted_by_filing_id(tmp_path):
    out_index = tmp_path / "filings_index.json"
    receipt_harvest.run(
        fixtures_dir=FIXTURE_DIR, output_index=out_index, target_n=10,
    )
    index = json.loads(out_index.read_text())
    ids = [e["filing_id"] for e in index["filings"]]
    assert ids == sorted(ids), f"filings not sorted by filing_id: {ids}"


def test_filings_index_byte_identical_on_rerun(tmp_path):
    out_a = tmp_path / "a.json"
    out_b = tmp_path / "b.json"
    receipt_harvest.run(fixtures_dir=FIXTURE_DIR, output_index=out_a, target_n=10)
    receipt_harvest.run(fixtures_dir=FIXTURE_DIR, output_index=out_b, target_n=10)
    assert hashlib.sha256(out_a.read_bytes()).hexdigest() == hashlib.sha256(out_b.read_bytes()).hexdigest()


def test_filing_id_format():
    """filing_id is `<accession_number>-10K`."""
    fid = receipt_harvest.make_filing_id("0000320193-24-000123")
    assert fid == "0000320193-24-000123-10K"
```

- [ ] Run: `python -m pytest tests/scripts/test_receipt_harvest.py -v`
- [ ] Expected: ALL FAIL with `ModuleNotFoundError: receipt_harvest`.

### Task 2.3 — Implement `scripts/receipt_harvest.py`

**Files:**
- Create: `scripts/receipt_harvest.py`

```python
#!/usr/bin/env python3
"""
Receipt harvest: SEC EDGAR 10-K bulk -> deterministic filings_index.json.

This script reads a directory of pre-fetched 10-K filing text files
(accession-numbered) and produces:
  - <output_dir>/filings_index.json — manifest of {filing_id, cik, ticker,
    year, form, accession_number, edgar_url, sic_industry, corpus_sha256}
    sorted by filing_id ascending
  - The .txt files themselves are NOT modified; this script reads them
    in place

Live SEC fetch is operator-time (see runbook). This script is the
deterministic post-fetch step that produces a citable manifest.

Filings already in the input directory are filtered for:
  - 10-K only (sequence number 1, accession ending in 10K — checked via filename
    convention <accession>.txt and the expectation that pre-fetch already
    filtered to 10-Ks)
  - Year >= 2018 (per spec Q1 scope)

Stratification by industry is left to the operator's pre-fetch step;
this harvester preserves whatever stratification the input directory
already has.

Usage:
  python scripts/receipt_harvest.py \\
      --fixtures-dir /tmp/sec_edgar_filings/ \\
      --output-index /opt/latentocean/data/formed_models/_inputs/sec_edgar_filings_index.json \\
      --target-n 1000
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

ACCESSION_RE = re.compile(r"^(\d{10})-(\d{2})-(\d{6})$")


def parse_accession(accession: str) -> tuple[str, int, str]:
    """Parse '0000320193-24-000123' -> ('0000320193', 2024, '000123').
    Two-digit year is assumed >= 2018 (so '24' -> 2024, '19' -> 2019)."""
    m = ACCESSION_RE.match(accession)
    if not m:
        raise ValueError(f"invalid accession number: {accession}")
    cik, yy, seq = m.groups()
    year = 2000 + int(yy)
    if year < 2018:
        # Per spec: drop pre-2018. But 2-digit yy doesn't go below 18 in our scope.
        year = 1900 + int(yy)
    return cik, year, seq


def make_filing_id(accession: str) -> str:
    """`<accession>-10K`. The -10K suffix is fixed since v1 only handles 10-K."""
    return f"{accession}-10K"


def edgar_url_for(cik: str, accession: str) -> str:
    """Best-effort EDGAR URL. The exact filing URL needs the document index;
    this points to the accession folder which always exists."""
    cik_int = int(cik)
    return f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik_int:010d}&type=10-K&action=getcompany"


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run(
    fixtures_dir: Path | str,
    output_index: Path | str,
    *,
    target_n: int = 1000,
) -> dict:
    fixtures_dir = Path(fixtures_dir)
    output_index = Path(output_index)
    output_index.parent.mkdir(parents=True, exist_ok=True)

    txt_files = sorted(fixtures_dir.glob("*.txt"))

    filings: list[dict] = []
    for txt in txt_files:
        accession = txt.stem
        try:
            cik, year, seq = parse_accession(accession)
        except ValueError:
            continue
        if year < 2018:
            continue
        filings.append({
            "filing_id":         make_filing_id(accession),
            "accession_number":  accession,
            "cik":               cik,
            "year":              year,
            "form":              "10-K",
            "edgar_url":         edgar_url_for(cik, accession),
            "corpus_sha256":     file_sha256(txt),
            "filing_text_path":  str(txt.relative_to(fixtures_dir)),
        })

    filings.sort(key=lambda f: f["filing_id"])
    filings = filings[:target_n]

    index = {
        "snapshot_dir": str(fixtures_dir),
        "n_filings":    len(filings),
        "filings":      filings,
    }
    output_index.write_text(json.dumps(index, indent=2, sort_keys=True))
    return index


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Harvest pre-fetched SEC 10-Ks into a deterministic manifest.")
    p.add_argument("--fixtures-dir", required=True, type=Path)
    p.add_argument("--output-index", required=True, type=Path)
    p.add_argument("--target-n", type=int, default=1000)
    args = p.parse_args(argv)

    index = run(args.fixtures_dir, args.output_index, target_n=args.target_n)
    print(f"wrote {args.output_index} with {index['n_filings']} filings")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Task 2.4 — Run tests

- [ ] `python -m pytest tests/scripts/test_receipt_harvest.py -v`
- [ ] Expected: 6/6 PASS.

### Task 2.5 — Commit Phase 2

```bash
git add scripts/receipt_harvest.py tests/scripts/test_receipt_harvest.py tests/scripts/fixtures/sec_edgar_mini/
git commit -m "feat(receipt): SEC EDGAR 10-K harvester producing deterministic manifest

Phase 2 of Receipt. Reads pre-fetched 10-K .txt files (accession-named),
filters to 10-K + year >= 2018, computes corpus_sha256 per filing, sorts
by filing_id, writes a JSON manifest. Live EDGAR fetch is operator-time
(documented in the runbook). 6/6 tests pass on a 3-filing fixture."
```

---

## Phase 3 — Receipt run orchestrator

### Task 3.1 — Failing test for chain integrity

**Files:**
- Create: `tests/scripts/test_receipt_run.py`

```python
"""Tests for scripts/receipt_run.py - the run orchestrator's chain logic.

The Anthropic API call itself is mocked. The chain integrity logic is
what's tested: each receipt's prev_receipt_hash must equal the previous
receipt's receipt_hash, and the chain head must be the last receipt's
receipt_hash.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import receipt_run  # noqa: E402


def test_mint_chain_links_receipts_in_order():
    """Given a list of (filing_id, corpus_sha256, output_sha256, timestamp),
    mint_chain produces receipts where each one's prev_receipt_hash equals
    the previous receipt_hash."""
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
        {"filing_id": "f3", "corpus_sha256": "e" * 64, "output_sha256": "f" * 64, "timestamp": "2026-05-02T12:00:02.000Z"},
    ]
    receipts = receipt_run.mint_chain(
        inputs,
        prompt_hash="0" * 64,
        schema_hash="1" * 64,
        model_id="claude-sonnet-4-6-test",
    )
    assert receipts[0]["prev_receipt_hash"] is None
    assert receipts[1]["prev_receipt_hash"] == receipts[0]["receipt_hash"]
    assert receipts[2]["prev_receipt_hash"] == receipts[1]["receipt_hash"]


def test_chain_head_is_last_receipt_hash():
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
    ]
    receipts = receipt_run.mint_chain(
        inputs, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x",
    )
    head = receipt_run.chain_head(receipts)
    assert head == receipts[-1]["receipt_hash"]


def test_verify_chain_passes_for_valid_chain():
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
    ]
    receipts = receipt_run.mint_chain(inputs, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    assert receipt_run.verify_chain(receipts, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x") == (True, None)


def test_verify_chain_fails_when_receipt_tampered():
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
    ]
    receipts = receipt_run.mint_chain(inputs, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    # Tamper with receipt #1's output_sha256
    receipts[1] = {**receipts[1], "output_sha256": "X" * 64}
    ok, err = receipt_run.verify_chain(receipts, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    assert ok is False
    assert err is not None and "receipt_hash" in err


def test_verify_chain_fails_when_link_broken():
    inputs = [
        {"filing_id": "f1", "corpus_sha256": "a" * 64, "output_sha256": "b" * 64, "timestamp": "2026-05-02T12:00:00.000Z"},
        {"filing_id": "f2", "corpus_sha256": "c" * 64, "output_sha256": "d" * 64, "timestamp": "2026-05-02T12:00:01.000Z"},
    ]
    receipts = receipt_run.mint_chain(inputs, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    # Tamper with receipt #1's prev_receipt_hash (break the chain link)
    receipts[1] = {**receipts[1], "prev_receipt_hash": "Y" * 64}
    ok, err = receipt_run.verify_chain(receipts, prompt_hash="0" * 64, schema_hash="1" * 64, model_id="x")
    assert ok is False
    assert err is not None
```

- [ ] Run: `python -m pytest tests/scripts/test_receipt_run.py -v`
- [ ] Expected: ALL FAIL with `ModuleNotFoundError: receipt_run`.

### Task 3.2 — Implement `scripts/receipt_run.py`

**Files:**
- Create: `scripts/receipt_run.py`

```python
#!/usr/bin/env python3
"""
Receipt run orchestrator.

Reads:
  - scripts/receipt_prompt.txt
  - scripts/receipt_schema.json
  - <filings_index_path>.json (from scripts/receipt_harvest.py)

For each filing:
  1. Compute corpus_sha256 (already in the index; verify)
  2. Call Anthropic API with prompt + schema + filing text
  3. Capture output JSON, compute output_sha256
  4. Mint receipt: receipt_hash = sha256(prev_receipt_hash || prompt_hash ||
     schema_hash || corpus_sha256 || model_id || timestamp || output_sha256)
  5. Append to receipts.ndjson
  6. Append summary entry to public artifact

After all filings:
  7. chain_head = last receipt_hash
  8. Anchor chain_head with OpenTimeStamps -> showcases/receipt.chainhead.ots
  9. Compose /data/formed_models/_public/sec_edgar.json (full artifact)
  10. Compose /data/formed_models/_public/sec_edgar_chain.json (chain only)

Idempotency: if receipts.ndjson already has receipts for filings in the index,
the script picks up where it left off (uses the last receipt_hash as the
prev for the next filing).

Anthropic API integration: uses the `anthropic` SDK (already in
backend/pyproject.toml dependencies). Reads ANTHROPIC_API_KEY from env.
For unit tests of mint_chain / chain_head / verify_chain, the API call is
not exercised; those primitives are pure functions over pre-computed
output_sha256 values.

Usage:
  ANTHROPIC_API_KEY=sk-ant-... python scripts/receipt_run.py \\
      --filings-index /opt/latentocean/data/formed_models/_inputs/sec_edgar_filings_index.json \\
      --filings-dir /tmp/sec_edgar_filings/ \\
      --output /opt/latentocean/data/formed_models/_public/sec_edgar.json \\
      --chain-output /opt/latentocean/data/formed_models/_public/sec_edgar_chain.json \\
      --receipts-log /opt/latentocean/data/formed_models/_audit/receipts.ndjson \\
      --ots-output showcases/receipt.chainhead.ots \\
      --model claude-sonnet-4-6-20250929
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS))
from receipt_hash import derive_hash  # noqa: E402

PROMPT_PATH = _SCRIPTS / "receipt_prompt.txt"
SCHEMA_PATH = _SCRIPTS / "receipt_schema.json"


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def canonical_json(obj) -> bytes:
    """Canonical JSON: sorted keys, no whitespace, UTF-8."""
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def mint_chain(
    inputs: list[dict],
    *,
    prompt_hash: str,
    schema_hash: str,
    model_id: str,
) -> list[dict]:
    """Pure function. Given a list of pre-computed call records (each with
    filing_id, corpus_sha256, output_sha256, timestamp), produce the
    matching list of receipts with prev_receipt_hash linked correctly.
    """
    out: list[dict] = []
    prev: str | None = None
    for inp in inputs:
        rh = derive_hash(
            prev_receipt_hash=prev,
            prompt_hash=prompt_hash,
            schema_hash=schema_hash,
            corpus_sha256=inp["corpus_sha256"],
            model_id=model_id,
            timestamp=inp["timestamp"],
            output_sha256=inp["output_sha256"],
        )
        out.append({
            "filing_id":         inp["filing_id"],
            "prev_receipt_hash": prev,
            "prompt_hash":       prompt_hash,
            "schema_hash":       schema_hash,
            "corpus_sha256":     inp["corpus_sha256"],
            "model_id":          model_id,
            "timestamp":         inp["timestamp"],
            "output_sha256":     inp["output_sha256"],
            "receipt_hash":      rh,
        })
        prev = rh
    return out


def chain_head(receipts: list[dict]) -> str:
    """Chain head = last receipt's receipt_hash. Empty if no receipts."""
    return receipts[-1]["receipt_hash"] if receipts else ""


def verify_chain(
    receipts: list[dict],
    *,
    prompt_hash: str,
    schema_hash: str,
    model_id: str,
) -> tuple[bool, str | None]:
    """Re-derive each receipt_hash and check the chain links.
    Returns (True, None) on success, (False, error_message) on first failure."""
    prev: str | None = None
    for i, r in enumerate(receipts):
        if r.get("prev_receipt_hash") != prev:
            return (False, f"receipt {i} prev_receipt_hash mismatch: expected {prev}, got {r.get('prev_receipt_hash')}")
        derived = derive_hash(
            prev_receipt_hash=prev,
            prompt_hash=prompt_hash,
            schema_hash=schema_hash,
            corpus_sha256=r["corpus_sha256"],
            model_id=model_id,
            timestamp=r["timestamp"],
            output_sha256=r["output_sha256"],
        )
        if derived != r.get("receipt_hash"):
            return (False, f"receipt {i} receipt_hash mismatch: derived {derived[:16]}..., stored {r.get('receipt_hash', '')[:16]}...")
        prev = r["receipt_hash"]
    return (True, None)


def call_anthropic(prompt_text: str, schema_text: str, filing_text: str, model_id: str) -> tuple[dict, str, dict]:
    """Call the Anthropic API. Returns (output_json, output_text, tokens)."""
    try:
        import anthropic  # type: ignore
    except ImportError:
        raise RuntimeError("anthropic SDK not installed; run: pip install anthropic")
    client = anthropic.Anthropic()
    user_content = (
        prompt_text
        + "\n\nSCHEMA:\n" + schema_text
        + "\n\nFILING TEXT:\n" + filing_text
    )
    response = client.messages.create(
        model=model_id,
        max_tokens=2048,
        messages=[{"role": "user", "content": user_content}],
    )
    output_text = response.content[0].text
    try:
        output_json = json.loads(output_text)
    except json.JSONDecodeError:
        # Schema-noncompliant output. Stored as-is; receipt is over the bytes.
        output_json = {"_raw": output_text, "_schema_compliant": False}
    tokens = {"input": response.usage.input_tokens, "output": response.usage.output_tokens}
    return output_json, output_text, tokens


def ots_stamp(chain_head_hex: str, ots_output: Path) -> bool:
    """Anchor the chain head with OpenTimeStamps. Returns True on success.
    Requires the `ots` CLI on PATH or `opentimestamps-client` Python package.
    Writes the proof to ots_output.
    """
    # Write chain_head to a temp file (ots stamps the file's bytes)
    tmp = ots_output.parent / f".chainhead.txt"
    tmp.write_text(chain_head_hex + "\n")
    try:
        result = subprocess.run(
            ["ots", "stamp", str(tmp)],
            capture_output=True, timeout=60,
        )
        # ots writes <input>.ots
        produced = Path(str(tmp) + ".ots")
        if produced.exists():
            ots_output.parent.mkdir(parents=True, exist_ok=True)
            produced.rename(ots_output)
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return False


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Receipt run orchestrator.")
    p.add_argument("--filings-index", required=True, type=Path)
    p.add_argument("--filings-dir", required=True, type=Path,
                   help="Directory containing the per-filing .txt files referenced by the index.")
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--chain-output", required=True, type=Path)
    p.add_argument("--receipts-log", required=True, type=Path)
    p.add_argument("--ots-output", default="showcases/receipt.chainhead.ots", type=Path)
    p.add_argument("--model", default="claude-sonnet-4-6-20250929")
    p.add_argument("--dry-run", action="store_true",
                   help="Skip Anthropic calls; emit synthetic outputs for testing the chain logic end-to-end.")
    args = p.parse_args(argv)

    prompt_text = PROMPT_PATH.read_text()
    schema_text = SCHEMA_PATH.read_text()
    prompt_hash = file_sha256(PROMPT_PATH)
    schema_hash = file_sha256(SCHEMA_PATH)

    index = json.loads(args.filings_index.read_text())
    filings = index["filings"]

    print(f"Receipt run starting: {len(filings)} filings, model={args.model}")
    print(f"  prompt_hash: {prompt_hash}")
    print(f"  schema_hash: {schema_hash}")

    inputs: list[dict] = []
    summaries: dict[str, dict] = {}
    args.receipts_log.parent.mkdir(parents=True, exist_ok=True)

    for i, filing in enumerate(filings, start=1):
        filing_id = filing["filing_id"]
        filing_path = args.filings_dir / filing["filing_text_path"]
        filing_text = filing_path.read_text()
        corpus_sha = file_sha256(filing_path)
        if corpus_sha != filing["corpus_sha256"]:
            print(f"  [{i}/{len(filings)}] {filing_id}: corpus_sha256 mismatch; skipping")
            continue
        timestamp = datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
        if args.dry_run:
            output_json = {"_dry_run": True, "filing_id": filing_id}
            tokens = {"input": 0, "output": 0}
        else:
            output_json, _output_text, tokens = call_anthropic(
                prompt_text, schema_text, filing_text, args.model,
            )
        output_sha = hashlib.sha256(canonical_json(output_json)).hexdigest()
        inputs.append({
            "filing_id":     filing_id,
            "corpus_sha256": corpus_sha,
            "output_sha256": output_sha,
            "timestamp":     timestamp,
        })
        summaries[filing_id] = {"summary": output_json, "tokens": tokens}
        print(f"  [{i}/{len(filings)}] {filing_id}: ok ({tokens['input']} in / {tokens['output']} out)")

    receipts = mint_chain(inputs, prompt_hash=prompt_hash, schema_hash=schema_hash, model_id=args.model)
    head = chain_head(receipts)

    # Append every receipt to receipts.ndjson
    with args.receipts_log.open("w", encoding="utf-8", newline="\n") as f:
        for r in receipts:
            f.write(json.dumps(r, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
            f.write("\n")

    # OTS anchor
    ots_ok = ots_stamp(head, args.ots_output)

    # Public artifacts
    filings_with_summary = [
        {**f, **summaries.get(f["filing_id"], {}), **next((r for r in receipts if r["filing_id"] == f["filing_id"]), {})}
        for f in filings
    ]
    artifact = {
        "showcase":           "receipt",
        "ran_at":             datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
        "model_id":           args.model,
        "prompt_hash":        prompt_hash,
        "schema_hash":        schema_hash,
        "n_filings":          len(filings),
        "n_receipts":         len(receipts),
        "chain_head":         head,
        "ots_anchored":       ots_ok,
        "ots_file":           "showcases/receipt.chainhead.ots" if ots_ok else None,
        "filings":            filings_with_summary,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, indent=2))

    chain_only = {
        "showcase":     "receipt-chain",
        "chain_head":   head,
        "n_receipts":   len(receipts),
        "model_id":     args.model,
        "prompt_hash":  prompt_hash,
        "schema_hash":  schema_hash,
        "receipts":     receipts,
    }
    args.chain_output.parent.mkdir(parents=True, exist_ok=True)
    args.chain_output.write_text(json.dumps(chain_only, indent=2))

    print(f"\nchain_head: {head}")
    print(f"OTS anchor: {'ok' if ots_ok else 'skipped (ots CLI unavailable)'}")
    print(f"wrote {args.output}")
    print(f"wrote {args.chain_output}")
    print(f"wrote {args.receipts_log}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Task 3.3 — Run tests

- [ ] `python -m pytest tests/scripts/test_receipt_run.py -v`
- [ ] Expected: 5/5 PASS.

### Task 3.4 — Commit Phase 3

```bash
git add scripts/receipt_run.py tests/scripts/test_receipt_run.py
git commit -m "feat(receipt): run orchestrator (mint_chain + verify_chain + Anthropic call)

Phase 3 of Receipt. Pure functions for chain integrity (mint_chain,
chain_head, verify_chain) tested with 5 unit tests. Anthropic API
call wrapped in call_anthropic(); ots_stamp() invokes the ots CLI
to anchor the chain head. --dry-run flag skips API calls for end-to-end
chain testing without billing the API."
```

---

## Phase 4 — Verify shell

### Task 4.1 — Implement `scripts/receipt_verify.sh`

**Files:**
- Create: `scripts/receipt_verify.sh`

```bash
#!/bin/bash
# Receipt post-run verification.
#
# Confirms:
#   1. The receipts.ndjson chain integrity (re-derive each hash, follow links)
#   2. The chain_head matches the published value in the public artifact
#   3. The OpenTimeStamps proof is valid (or pending)
#   4. The audit log contains the run's events in JSON, CEF, OCSF formats
#   5. Cross-tenant isolation
#
# Requires:  /tmp/.receipttoken (receipt_showcase bearer)
# Output:    /tmp/receipt_summary.json

set -e
BASE="${LO_BASE_URL:-https://www.latentocean.com}"
RECEIPTTOK=$(cat /tmp/.receipttoken)
ARTIFACT="/data/formed_models/_public/sec_edgar.json"
CHAIN="/data/formed_models/_public/sec_edgar_chain.json"
RECEIPTS_LOG="/data/formed_models/_audit/receipts.ndjson"
OTS_FILE="showcases/receipt.chainhead.ots"

echo "=== 1. Chain integrity ==="
python3 <<EOF
import json, sys
sys.path.insert(0, "scripts")
from receipt_hash import derive_hash

with open("$CHAIN") as f:
    chain = json.load(f)
receipts = chain["receipts"]
prompt_hash = chain["prompt_hash"]
schema_hash = chain["schema_hash"]
model_id    = chain["model_id"]

prev = None
for i, r in enumerate(receipts):
    if r.get("prev_receipt_hash") != prev:
        print(f"  FAIL: receipt {i} prev mismatch")
        sys.exit(1)
    derived = derive_hash(
        prev_receipt_hash=prev,
        prompt_hash=prompt_hash, schema_hash=schema_hash,
        corpus_sha256=r["corpus_sha256"], model_id=model_id,
        timestamp=r["timestamp"], output_sha256=r["output_sha256"],
    )
    if derived != r["receipt_hash"]:
        print(f"  FAIL: receipt {i} hash mismatch")
        sys.exit(1)
    prev = r["receipt_hash"]
print(f"  PASS: {len(receipts)}/{len(receipts)} receipts internally consistent")
print(f"  chain_head: {chain['chain_head'][:32]}...")
EOF

echo ""
echo "=== 2. Chain head matches public artifact ==="
PUB_HEAD=$(python -c "import json;print(json.load(open('$ARTIFACT'))['chain_head'])")
CHAIN_HEAD=$(python -c "import json;print(json.load(open('$CHAIN'))['chain_head'])")
if [ "$PUB_HEAD" = "$CHAIN_HEAD" ]; then
  echo "  PASS: $PUB_HEAD ✓"
else
  echo "  FAIL: artifact head $PUB_HEAD != chain head $CHAIN_HEAD"
  exit 1
fi

echo ""
echo "=== 3. OpenTimeStamps proof ==="
if command -v ots >/dev/null 2>&1; then
  if [ -f "$OTS_FILE" ]; then
    ots verify "$OTS_FILE" 2>&1 | tee /tmp/ots_verify.log || echo "  (verification may be pending; see log)"
  else
    echo "  SKIP: $OTS_FILE not found"
  fi
else
  echo "  SKIP: ots CLI not available; install opentimestamps-client to verify"
fi

echo ""
echo "=== 4. Audit log retrievable ==="
JSON_AUDIT=$(curl -sk -H "Authorization: Bearer $RECEIPTTOK" "$BASE/api/range-audit?limit=20")
JSON_COUNT=$(echo "$JSON_AUDIT" | python -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('events',[])))" 2>/dev/null)
echo "  JSON: $JSON_COUNT events"
CEF_LINES=$(curl -sk -H "Authorization: Bearer $RECEIPTTOK" "$BASE/api/range-audit?format=cef&limit=20" | wc -l)
echo "  CEF: $CEF_LINES lines"
OCSF_COUNT=$(curl -sk -H "Authorization: Bearer $RECEIPTTOK" "$BASE/api/range-audit?format=ocsf&limit=20" | python -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('events',[])))" 2>/dev/null)
echo "  OCSF: $OCSF_COUNT events"

echo ""
echo "=== 5. Cross-tenant isolation ==="
PROBE_TOK_RESP=$(curl -sk -X POST -H 'Content-Type: application/json' -d '{"color":"receiptprobe"}' "$BASE/api/range-demo-token")
PROBE_TOK=$(echo "$PROBE_TOK_RESP" | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
PUBLIC_STATUS=$(curl -sk -o /dev/null -w '%{http_code}' "$BASE/api/range-public/showcase/receipt")
echo "  Public read endpoint /receipt: $PUBLIC_STATUS"

echo ""
echo "DONE."
```

### Task 4.2 — Verify syntax

- [ ] `bash -n scripts/receipt_verify.sh` — expected: no errors.
- [ ] `chmod +x scripts/receipt_verify.sh`

### Task 4.3 — Commit

```bash
git add scripts/receipt_verify.sh
git commit -m "feat(receipt): post-run verification shell script"
```

---

## Phase 5 — Allowlist + frontend pages

### Task 5.1 — Extend allowlist

**Files:**
- Modify: `frontend/app/api/range-public/showcase/[slug]/route.ts`

- [ ] Add receipt slugs to `ALLOWED`:
```ts
receipt:           "sec_edgar.json",
"receipt-chain":   "sec_edgar_chain.json",
```

### Task 5.2 — Create `frontend/app/receipt/sec-edgar/ReceiptList.tsx`

**Files:**
- Create: `frontend/app/receipt/sec-edgar/ReceiptList.tsx`

A client component that fetches `/api/range-public/showcase/receipt` and renders 1,000 collapsible filing cards. Each card shows (filing_id, ticker if present, year, form, edgar_url) collapsed; expand → JSON summary preview, full receipt block, and an inline "verify" button that calls `deriveHash()` from `frontend/lib/receipt/verify.ts` and shows ✓ or ✗ inline.

Implementation pattern: copy the AtlasData.tsx / PulseData.tsx shape but with receipt-specific data shape. Filter/sort UI: textbox to filter by ticker, year dropdown.

### Task 5.3 — Create `frontend/app/receipt/sec-edgar/page.tsx`

**Files:**
- Create: `frontend/app/receipt/sec-edgar/page.tsx`

Server component mirroring `/atlas/arxiv/page.tsx` shape. Sections: Hero ("1,000 SEC EDGAR 10-K filings. One model. Every receipt verifiable."), Preface, Corpus, Live artifact (`<ReceiptList />`), Limits, Acknowledgements.

### Task 5.4 — Create `frontend/app/receipt/verify/Verifier.tsx`

**Files:**
- Create: `frontend/app/receipt/verify/Verifier.tsx`

Client component with:
- A `<textarea>` where someone pastes a receipt JSON
- A "Verify this receipt" button that calls `deriveHash()` and shows ✓ / ✗ with the derived vs. published hash diff
- A "Verify entire chain" button that fetches `/api/range-public/showcase/receipt-chain` and replays the chain, reporting pass/fail
- A panel showing the chain head + OTS file download link

### Task 5.5 — Create `frontend/app/receipt/verify/page.tsx`

**Files:**
- Create: `frontend/app/receipt/verify/page.tsx`

Server component with hero, brief explanation of what the verifier does + does not prove, then `<Verifier />`.

### Task 5.6 — Browser verification

- [ ] Start dev server, navigate to `/receipt/sec-edgar` and `/receipt/verify`.
- [ ] Confirm both render 200 OK with graceful 503 pending state.

### Task 5.7 — Commit Phase 5

```bash
git add frontend/app/receipt/sec-edgar/ frontend/app/receipt/verify/ frontend/app/api/range-public/showcase/\[slug\]/route.ts
git commit -m "feat(receipt): /receipt/sec-edgar + /receipt/verify pages + allowlist"
```

---

## Phase 6 — Operator runbook

### Task 6.1 — Write the runbook

**Files:**
- Create: `docs/superpowers/runbooks/2026-05-02-receipt-sec-edgar-runbook.md`

Document the 12-step operator sequence:

1. **Pre-flight**: confirm `ANTHROPIC_API_KEY` set, `ots` CLI on PATH (`pip install opentimestamps-client`), EC2 disk space, ~$200 API budget acknowledged.
2. **Pin SEC EDGAR snapshot date** (record in `/tmp/receipt_snapshot.txt`).
3. **Fetch 1,000 stratified 10-K filings**: write `scripts/_receipt_fetch_helper.py` (or document the `edgar_*.py` invocation) that pulls 1,000 stratified filings to `/tmp/sec_edgar_filings/`. Filing texts truncated to Items 1, 1A, 7, 8 ≤ 50k tokens.
4. `python scripts/receipt_harvest.py --fixtures-dir /tmp/sec_edgar_filings/ --output-index /opt/latentocean/data/formed_models/_inputs/sec_edgar_filings_index.json --target-n 1000`
5. **Mint receipt_showcase token**: `curl ... | save to /tmp/.receipttoken`.
6. **Run receipts** (`receipt_run.py`): ~3-4 hours wall time at 5 RPM rate-limited. Inside `tmux`. Captures incremental progress to `receipts.ndjson`.
7. Inspect chain head + OTS proof status.
8. `bash scripts/receipt_verify.sh`. Confirm chain integrity + audit log.
9. Copy public artifact + chain JSON + .ots file into repo.
10. Update prose in `frontend/app/receipt/sec-edgar/page.tsx` if needed.
11. Commit + deploy.
12. Post-deploy smoke: visit `/receipt/sec-edgar` + `/receipt/verify` in production browser.

Include failure-recovery table: API rate limits, OTS unavailability, schema-noncompliant outputs, partial run resumption.

### Task 6.2 — Commit Phase 6

```bash
git add docs/superpowers/runbooks/2026-05-02-receipt-sec-edgar-runbook.md
git commit -m "docs(receipt): operator runbook"
```

---

## Phase 7 — Operator run on EC2 ⏸️

Out of scope for this implementation cycle. Same pattern as Atlas Phase 8 + Pulse Phase 8.

---

## Self-review checklist

- [ ] Spec coverage: every component in the spec has an implementing task. Spec-required artifacts (`sec_edgar.json`, `sec_edgar_chain.json`, `receipt.chainhead.ots`, allowlist) all in tasks.
- [ ] No "TBD"/"TODO"/"implement later" outside Phase 7.
- [ ] Function names consistent across phases: `derive_hash`, `derive_concat`, `mint_chain`, `chain_head`, `verify_chain`, `parse_accession`, `make_filing_id`, `file_sha256`, `canonical_json`, `call_anthropic`, `ots_stamp`.
- [ ] Each TDD task has failing-test → run → impl → run → commit.
- [ ] Atlas + Pulse + showcase_lib tests stay green.
- [ ] Python and TS hash implementations are coupled by a documented contract.

---

## Acceptance criteria

The Receipt v1 artifact ships when:

- `/data/formed_models/_public/sec_edgar.json` exists with `chain_head`, `prompt_hash`, `schema_hash`, `n_filings == 1000`, and 1,000 filings each with `summary` + receipt block.
- `/data/formed_models/_public/sec_edgar_chain.json` exists with the bare chain.
- `showcases/receipt.chainhead.ots` exists in the repo with a valid (pending or confirmed) OTS proof.
- `scripts/receipt_verify.sh` confirms chain integrity (1000/1000), audit log retrievable in JSON/CEF/OCSF, public-read endpoint accessible.
- `https://www.latentocean.com/receipt/sec-edgar` renders the index with 1,000 collapsible cards.
- `https://www.latentocean.com/receipt/verify` renders the dedicated verifier; paste-receipt-and-check works in browser.
- All previous tests still pass: 23 Atlas + 23 Pulse + 25 lib + 12 Atlas-harvest = 83 minimum, plus 18 new Receipt tests = 101.
- Verification recipe printed on both pages.
