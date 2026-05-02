#!/usr/bin/env python3
"""
Receipt harvest: SEC EDGAR 10-K bulk -> deterministic filings_index.json.

Reads a directory of pre-fetched 10-K filing text files (accession-numbered)
and produces a manifest at filings_index.json with one record per filing
sorted by filing_id ascending. Live SEC fetch is operator-time (see runbook).

Filings are filtered for:
  - 10-K only (the input directory is expected to already be 10-K-only,
    one file per filing)
  - year >= 2018 (per spec Q1 scope)

Stratification by industry is applied during pre-fetch (operator runbook),
not here. This harvester preserves whatever stratification the input
directory already has.

Usage:
  python scripts/receipt_harvest.py \\
      --fixtures-dir /tmp/sec_edgar_filings/ \\
      --output-index /opt/latentocean/data/formed_models/_inputs/sec_edgar_filings_index.json \\
      --target-n 1000
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ACCESSION_RE = re.compile(r"^(\d{10})-(\d{2})-(\d{6})$")


def parse_accession(accession: str) -> tuple[str, int, str]:
    """Parse '0000320193-24-000123' -> ('0000320193', 2024, '000123').
    Two-digit year mapping: '00'-'99' -> 2000-2099. Within Receipt v1's
    2018-2025 scope this is unambiguous.
    """
    m = ACCESSION_RE.match(accession)
    if not m:
        raise ValueError(f"invalid accession number: {accession}")
    cik, yy, seq = m.groups()
    year = 2000 + int(yy)
    return cik, year, seq


def make_filing_id(accession: str) -> str:
    """`<accession>-10K`. The -10K suffix is fixed since Receipt v1 only handles 10-K."""
    return f"{accession}-10K"


def edgar_url_for(cik: str, accession: str) -> str:
    """Best-effort EDGAR URL pointing to the company's 10-K listing."""
    cik_int = int(cik)
    return f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik_int:010d}&type=10-K"


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
            "filing_text_path":  txt.name,
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
