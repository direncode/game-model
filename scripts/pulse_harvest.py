#!/usr/bin/env python3
"""
Pulse harvest: PatentsView bulk TSV snapshot -> deterministic NDJSON corpus.

Reads PatentsView's bulk-distributed inventor + assignee + location + patent
TSVs (the disambiguated and not-disambiguated variants), joins them on
patent_id, normalizes inventor names to canonical form ("Surname I I"),
collects each inventor-record's co-inventors and assignee + location
metadata, and emits one NDJSON record per inventor-appearance.

Output schema per record:
  patent_id                  USPTO patent number (string)
  paper_id                   alias for patent_id (Atlas-shaped substrate compat)
  inventor_seq               0-indexed position in the patent's inventor list
  raw_name                   "Smith, John W." as it appears on the patent
  canonical_name             "Smith J W"
  co_inventors_canonical     list of canonical names of co-inventors on this patent
  assignee_id                PatentsView's assignee_id (or empty string)
  assignee_name              display string
  city, state, country       inventor's location at filing time
  primary_ipc                WIPO field id (or top IPC class code)
  year                       patent grant year
  patentsview_inventor_id    the gold-standard disambiguated id (NOT in `text`)
  raw_assignee_string        for the naive-name baseline
  title                      patent title
  text                       BTUT fingerprint payload:
                             "{canonical_name} | {co_inv_1; co_inv_2} | {assignee_id} | {city} {state} {country}"

Two-stage sampling:
  1. Group all kept records by canonical_name globally.
  2. For canonical_names with <= per_name_cap appearances, keep all.
  3. For ultra-common canonical_names, stride-sample to per_name_cap.
  4. If target_per_year > 0, apply outer stride-by-year to bring the total
     down to target_per_year * num_years (defensive cap on top of per_name).

Determinism: sort records by (patent_id, inventor_seq) ascending, canonical
JSON serialization, byte-identical re-runs.

Filters:
  - Patents granted before 1976 (pre-USPTO-bulk-distribution era).
  - Patents granted after the snapshot_nominal_date (defensive against
    snapshot drift).

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


def canonical_name(first: str, last: str) -> str:
    """Normalize an inventor name to "Surname I I" form.

    "John W. Smith"  -> "Smith J W"
    "J W Smith"      -> "Smith J W"
    "Mary-Anne O'Connor-Doyle" -> "OConnor-Doyle M"
    "Pat O'Brien"    -> "OBrien P"
    "" + "Smith"     -> "Smith"
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

    Filters: patents granted before 1976, patents granted after snapshot_nominal_date.
    """
    inv_tsv  = _read_tsv(fixtures_dir / "g_inventor_disambiguated.tsv")
    raw_tsv  = _read_tsv(fixtures_dir / "g_inventor_not_disambiguated.tsv")
    asg_tsv  = _read_tsv(fixtures_dir / "g_assignee_disambiguated.tsv")
    loc_tsv  = _read_tsv(fixtures_dir / "g_location_disambiguated.tsv")
    pat_tsv  = _read_tsv(fixtures_dir / "g_patent.tsv")

    raw_by_patent_seq = {(r["patent_id"], r["inventor_sequence"]): r for r in raw_tsv}
    asg_by_patent     = {a["patent_id"]: a for a in asg_tsv}
    loc_by_id         = {l["location_id"]: l for l in loc_tsv}
    pat_by_id         = {p["patent_id"]: p for p in pat_tsv}

    invs_by_patent: dict[str, list[tuple[int, dict]]] = defaultdict(list)
    for inv in inv_tsv:
        invs_by_patent[inv["patent_id"]].append((int(inv["inventor_sequence"]), inv))
    for pid in invs_by_patent:
        invs_by_patent[pid].sort(key=lambda x: x[0])

    out: list[dict] = []
    for inv in inv_tsv:
        patent_id = inv["patent_id"]
        seq = int(inv["inventor_sequence"])

        pat = pat_by_id.get(patent_id, {})
        patent_date = pat.get("patent_date", "")
        if not patent_date or patent_date < "1976-01-01":
            continue
        if patent_date > snapshot_nominal_date:
            continue
        year = int(patent_date[:4]) if len(patent_date) >= 4 else 0
        title = pat.get("patent_title", "")
        primary_ipc = pat.get("wipo_field_id", "")

        first = inv.get("disambig_inventor_name_first", "")
        last  = inv.get("disambig_inventor_name_last", "")
        cname = canonical_name(first, last)

        co: list[str] = []
        for other_seq, other_inv in invs_by_patent.get(patent_id, []):
            if other_seq == seq:
                continue
            co.append(canonical_name(
                other_inv.get("disambig_inventor_name_first", ""),
                other_inv.get("disambig_inventor_name_last", ""),
            ))

        raw = raw_by_patent_seq.get((patent_id, str(seq)), {})
        raw_first = raw.get("raw_inventor_name_first", "")
        raw_last  = raw.get("raw_inventor_name_last", "")
        raw_name  = f"{raw_last}, {raw_first}".strip(", ")

        asg = asg_by_patent.get(patent_id, {})
        assignee_id = asg.get("assignee_id", "")
        assignee_name = asg.get("organization", "")

        loc = loc_by_id.get(inv.get("location_id", ""), {})
        city, state, country = loc.get("city", ""), loc.get("state", ""), loc.get("country", "")

        co_str = "; ".join(co)
        text = f"{cname} | {co_str} | {assignee_id} | {city} {state} {country}".strip()

        out.append({
            "paper_id":                   patent_id,
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
    by_name: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        by_name[r["canonical_name"]].append(r)
    capped: list[dict] = []
    for name in sorted(by_name.keys()):
        bucket = sorted(by_name[name], key=lambda r: (r["patent_id"], r["inventor_seq"]))
        capped.extend(stride_sample(bucket, per_name_cap))

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
    p = argparse.ArgumentParser(description="Harvest PatentsView TSVs into deterministic NDJSON for Pulse.")
    p.add_argument("--fixtures-dir", required=True, type=Path,
                   help="Directory containing the PatentsView TSVs (g_inventor_disambiguated.tsv, etc.)")
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--snapshot-date", required=True,
                   help="Nominal snapshot date YYYY-MM-DD; patents granted after this are dropped")
    p.add_argument("--target-per-year", type=int, default=10000,
                   help="Outer stride-by-year cap. 0 = no outer stride. Default 10000.")
    p.add_argument("--per-name-cap", type=int, default=100,
                   help="Max appearances per canonical_name. Default 100.")
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
