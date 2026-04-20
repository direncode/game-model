"""SEC 8-K Item 4.02 benchmark — real restatement ground truth.

Item 4.02 of Form 8-K is titled:
  "Non-Reliance on Previously Issued Financial Statements or a Related
   Audit Report or Completed Interim Review"

Companies file this when they're telling investors their previously-
published financials are no longer reliable. This is the canonical
public ground truth for restatement *timing* — the exact data that
Audit Analytics monetizes at ~$50k/year in their Disclosure Research
product. SEC gives it away free via their full-text-search API.

This script:
  1. Pulls all 8-K filings via SEC EDGAR FTS where Item 4.02 is
     disclosed (2022–2026 window)
  2. Joins them to BTUT survivors in scripts/edgar_btut_result_5000.json
  3. Reports coverage + whether BTUT had each filer in its survivor
     set already when they filed the Item 4.02

Output:
  data/validation/sec_8k_item402_benchmark.json
"""
from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
UA = "LatentOcean-Benchmark/0.2.0 (sales@latentocean.com)"


def sec_fts_item402(start="2022-01-01", end="2026-12-31", max_pages=5) -> list[dict]:
    """Pull 8-K filings mentioning Item 4.02 via SEC full-text search."""
    out = []
    for page in range(max_pages):
        frm = page * 100
        q = urllib.parse.quote('"Item 4.02"')
        url = (
            "https://efts.sec.gov/LATEST/search-index"
            f"?q={q}&forms=8-K&dateRange=custom"
            f"&startdt={start}&enddt={end}&from={frm}"
        )
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print(f"  SEC FTS page {page} error: {e}")
            break
        hits = ((body.get("hits") or {}).get("hits") or [])
        if not hits:
            break
        for h in hits:
            src = h.get("_source") or {}
            ciks = src.get("ciks") or []
            out.append({
                "accession": h.get("_id", ""),
                "form": src.get("form", ""),
                "filed": src.get("file_date", ""),
                "ciks": [str(int(c)) for c in ciks] if ciks else [],
                "display_name": src.get("display_names", [""])[0] if src.get("display_names") else "",
            })
        time.sleep(0.2)  # be gentle
    return out


def load_btut_cik_set() -> tuple[set[str], dict[str, str]]:
    """Return (set of CIKs in BTUT survivors, CIK→name map)."""
    btut_path = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"
    cache_path = REPO_ROOT / "scripts" / "edgar_cache.json"
    btut = json.loads(btut_path.read_text(encoding="utf-8"))
    cache = json.loads(cache_path.read_text(encoding="utf-8"))
    # CIK→name map from the raw cache
    cik_to_name: dict[str, str] = {}
    for e in cache.get("entities", []):
        if e.get("type") != "filing":
            continue
        a = e.get("attributes") or "{}"
        if isinstance(a, str):
            try:
                a = json.loads(a)
            except Exception:
                continue
        cik = str(a.get("company_cik", ""))
        name = a.get("company_name", "")
        if cik and name and cik not in cik_to_name:
            cik_to_name[cik] = name
    # CIKs that have fact-level survivors in the BTUT output
    in_btut: set[str] = set()
    FACT_RE = re.compile(r"^fact_(\d+)_")
    for s in btut.get("survivors") or []:
        name = (s.get("entity") or {}).get("name", "")
        m = FACT_RE.match(name)
        if m:
            in_btut.add(m.group(1))
    return in_btut, cik_to_name


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=5)
    ap.add_argument("--output", default=str(
        REPO_ROOT / "data" / "validation" / "sec_8k_item402_benchmark.json"))
    args = ap.parse_args()

    t0 = time.perf_counter()
    print("SEC 8-K Item 4.02 benchmark\n" + "-" * 60)

    print("  pulling SEC FTS for Item 4.02 8-K filings...")
    filings = sec_fts_item402(max_pages=args.pages)
    print(f"    pulled {len(filings)} 8-K filings mentioning Item 4.02")

    in_btut, cik_name = load_btut_cik_set()
    print(f"  BTUT survivor set covers {len(in_btut)} distinct CIKs")

    # Group filings by CIK and check BTUT overlap
    per_filer: dict[str, list[dict]] = defaultdict(list)
    for f in filings:
        for cik in f["ciks"]:
            per_filer[cik].append(f)

    total_filers = len(per_filer)
    flagged_by_btut = {c for c in per_filer if c in in_btut}
    unflagged = {c for c in per_filer if c not in in_btut}

    coverage_rate = len(flagged_by_btut) / max(1, total_filers)

    # Lead-time analysis (since BTUT is from a cached snapshot, any filer
    # already in the BTUT survivor set BEFORE their Item 4.02 date was
    # flagged "pre-filing")
    preflagged_lead_days: list[int] = []
    for cik in flagged_by_btut:
        dates = sorted(f["filed"] for f in per_filer[cik] if f["filed"])
        if dates:
            # Time from earliest Item 4.02 date back to a hypothetical
            # snapshot date (we use the BTUT cache's implied snapshot,
            # here approximated as 2025-12-31 — edit when snapshot date
            # is authoritatively known).
            snapshot = "2025-12-31"
            try:
                t1 = time.strptime(snapshot, "%Y-%m-%d")
                t2 = time.strptime(dates[0], "%Y-%m-%d")
                delta = int((time.mktime(t2) - time.mktime(t1)) / 86400)
                if delta > 0:
                    preflagged_lead_days.append(delta)
            except Exception:
                pass

    summary = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "wall_seconds": round(time.perf_counter() - t0, 2),
        "source": "SEC EDGAR full-text search (public, no auth)",
        "comparable_vendor_product": "Audit Analytics Disclosure Research (~$50k/yr)",
        "total_8k_item_402_filings_pulled": len(filings),
        "total_distinct_filers": total_filers,
        "filers_in_btut_survivor_set": len(flagged_by_btut),
        "filers_not_in_btut_survivor_set": len(unflagged),
        "btut_coverage_rate": round(coverage_rate, 4),
        "preflagged_median_lead_days": (
            sorted(preflagged_lead_days)[len(preflagged_lead_days) // 2]
            if preflagged_lead_days else None
        ),
        "preflagged_count": len(preflagged_lead_days),
        "sample_filers_in_btut": sorted(
            [{"cik": c, "name": cik_name.get(c, f"CIK {c}"),
              "n_filings": len(per_filer[c])}
             for c in list(flagged_by_btut)[:20]],
            key=lambda r: -r["n_filings"],
        ),
        "commercial_framing": {
            "free_source": True,
            "what_vendor_charges": "Audit Analytics ~$50k/yr for historical database",
            "what_we_prove": (
                "Given public SEC data, we can show which Item-4.02 filers "
                "were already in our structural-outlier set — a lead-time "
                "proof-of-concept that a pilot customer would then extend "
                "with their vendor's dated-consensus data."
            ),
        },
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")

    print()
    print("=" * 78)
    print("SEC 8-K Item 4.02 benchmark summary")
    print("=" * 78)
    print(f"  8-K filings with Item 4.02 pulled:   {summary['total_8k_item_402_filings_pulled']}")
    print(f"  distinct filers:                     {summary['total_distinct_filers']}")
    print(f"  covered by BTUT survivor set:        {summary['filers_in_btut_survivor_set']}")
    print(f"  coverage rate:                       {summary['btut_coverage_rate']*100:.1f}%")
    print(f"  wall:                                {summary['wall_seconds']}s")
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
