#!/usr/bin/env python3
"""
Analyze the Pulse formed model and emit the public artifact JSON.

Joins BTUT survivor fingerprints back to the PatentsView inventor-record
metadata. Computes:

  1. Multi-baseline disambiguation: engine vs PatentsView (gold) vs
     naive-name-collision vs chance.
  2. Decade trajectory of inventor productivity.
  3. Cross-IPC bleed (the polymath signal at population level).
  4. Top-25 structurally rare inventor-records (click-through to USPTO).
  5. Singular-inventor candidates: per-cluster productivity + IPC entropy +
     career-span + solo-share. Flagged without naming.

Imports shared primitives from scripts/_showcase_lib.py and adds Pulse-specific
disambiguation primitives (canonical_name normalization happens upstream in
pulse_harvest.py; this analyzer trusts the harvester's canonicalization).

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
    weighted_purity,
    category_entropy,
    decade_of,
    assign_to_class,
    top_rare,
    bleed_per_class,
)

_HOST_BASE = "/opt/latentocean/data/formed_models"
_CONT_BASE = "/data/formed_models"
_BASE = _CONT_BASE if os.path.isdir(_CONT_BASE) else _HOST_BASE
CORPUS_PATH = Path(f"{_BASE}/_inputs/pulse.ndjson")
PUBLIC_OUT  = Path(f"{_BASE}/_public/uspto.json")
TOKEN_PATH  = Path("/tmp/.pulsetoken")
BASE_URL    = os.environ.get("LO_BASE_URL", "https://www.latentocean.com")


# ---------- Pulse-specific primitives ----------

def uspto_url(patent_id: str) -> str:
    """Map a USPTO patent number to its canonical patents.uspto.gov page."""
    return f"https://patents.uspto.gov/patent/{patent_id}"


def naive_name_labels(survivors: list[dict]) -> list[str]:
    """Naive disambiguation baseline: every record with the same canonical_name
    is treated as the same inventor. The engine should reliably beat this baseline
    on the records where canonical-name collision occurs (e.g., two distinct
    'John Smith' inventors)."""
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
    when it scores above threshold on ALL FOUR signals: productivity, IPC
    breadth, career length, and solo-work share.

    No naming. The page surfaces the metrics + USPTO clickthroughs and lets
    readers (IP attorneys, M&A teams, innovation economists) judge.
    """
    return [
        c for c in cluster_meta
        if c.get("patent_count", 0) >= min_patent_count
        and c.get("ipc_entropy", 0.0) >= min_ipc_entropy
        and c.get("career_span", 0) >= min_career_span
        and c.get("solo_share", 0.0) >= min_solo_share
    ]


def compute_cluster_meta(survivors: list[dict], engine_labels: list) -> list[dict]:
    """Per engine cluster, compute the four singular-inventor signals.

    A cluster's records are the survivors whose engine_label maps to that cluster.
    productivity = number of distinct patent_ids in the cluster.
    ipc_entropy  = Shannon entropy over primary_ipc values.
    career_span  = max(year) - min(year) over the cluster's records.
    solo_share   = fraction of records with empty co_inventors_canonical list.
    """
    by_cluster: dict[int, list[dict]] = defaultdict(list)
    for s, l in zip(survivors, engine_labels):
        if l is not None:
            by_cluster[l].append(s)

    out: list[dict] = []
    for cid, ss in by_cluster.items():
        patent_ids = set(s.get("patent_id", "") for s in ss)
        ipcs = [s.get("primary_ipc", "") for s in ss if s.get("primary_ipc")]
        years = [s.get("year", 0) for s in ss if s.get("year")]
        solo_count = sum(1 for s in ss if not s.get("co_inventors_canonical"))

        ipc_h = round(category_entropy(ipcs), 3)
        career_span = (max(years) - min(years)) if years else 0
        solo_share  = round(solo_count / len(ss), 3) if ss else 0.0

        out.append({
            "cluster_id":       cid,
            "size":             len(ss),
            "patent_count":     len(patent_ids),
            "ipc_entropy":      ipc_h,
            "career_span":      career_span,
            "solo_share":       solo_share,
            "median_year":      sorted(years)[len(years) // 2] if years else 0,
            "year_spread":      career_span,
            "category_entropy": ipc_h,
        })
    return out


def baseline_disambiguators(survivors: list[dict], engine_labels: list) -> dict:
    """Multi-baseline panel: engine vs PatentsView (gold) vs naive-name vs chance.

    PatentsView's inventor_id is the gold; the engine and naive-name are both
    measured against it via weighted purity. Chance is 1/N where N is the
    number of distinct PatentsView inventors in the corpus.

    PatentsView is itself an algorithmic approximation, so the engine's lift
    over the naive-name baseline is the cleaner signal of structural-
    disambiguation power (vs. surface name-collision). The "patentsview"
    field is 1.0 by definition; it sits in the panel as the reference point.
    """
    pv_gold = [s.get("patentsview_inventor_id", "") for s in survivors]
    naive   = naive_name_labels(survivors)

    engine_purity, _ = weighted_purity(engine_labels, pv_gold)
    naive_purity,  _ = weighted_purity(naive, pv_gold)

    n_pv = len(set(pv for pv in pv_gold if pv))
    chance = round(1.0 / n_pv, 3) if n_pv else 0.0

    return {
        "engine":      engine_purity,
        "patentsview": 1.0,
        "naive_name":  naive_purity,
        "chance":      chance,
        "note":        (
            "engine and naive_name are computed against PatentsView's "
            "disambig_inventor_id as gold. PatentsView itself is an "
            "algorithmic approximation; multi-baseline framing is the "
            "honest version of the disambiguation claim."
        ),
    }


# ---------- IO + orchestration ----------

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

    baselines = baseline_disambiguators(valid_survivors, valid_labels)

    cluster_meta = compute_cluster_meta(valid_survivors, valid_labels)

    candidates = flag_singular_inventors(
        cluster_meta,
        min_patent_count=10, min_ipc_entropy=1.0,
        min_career_span=10, min_solo_share=0.3,
    )

    by_decade: dict[str, list[dict]] = defaultdict(list)
    for s in valid_survivors:
        if s["year"]:
            by_decade[decade_of(s["year"])].append(s)
    decade_trajectory = []
    for dec in sorted(by_decade.keys()):
        ss = by_decade[dec]
        ipc_counts = Counter(s["primary_ipc"] for s in ss if s.get("primary_ipc"))
        decade_trajectory.append({
            "decade":      dec,
            "n_records":   len(ss),
            "n_inventors": len(set(s["patentsview_inventor_id"] for s in ss if s.get("patentsview_inventor_id"))),
            "ipc_share":   {ipc: round(c / len(ss), 3) for ipc, c in ipc_counts.most_common(8)},
        })

    polymath_bleed = bleed_per_class(valid_survivors, classes, gold_field="primary_ipc")

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
        "showcase":                       "pulse",
        "patentsview_snapshot_date":      snapshot_date,
        "corpus_input_sha256":            corpus_input_sha256,
        "corpus_sha256":                  corpus_sha256,
        "corpus_records":                 model.get("corpus_records"),
        "model_id":                       model.get("id"),
        "tenant_id":                      model.get("tenant_id"),
        "name":                           model.get("name"),
        "formed_at":                      model.get("formed_at"),
        "formation_ms":                   model.get("formation_ms"),
        "fingerprinter_mode":             model.get("fingerprinter_mode"),
        "coverage_pct":                   model.get("coverage_pct"),
        "response_digest":                model.get("response_digest"),
        "encrypted":                      model.get("encrypted"),
        "chunked":                        model.get("chunked"),
        "taxonomy_summary":               model.get("taxonomy_summary"),
        "persistence":                    model.get("persistence"),
        "n_survivors":                    len(valid_survivors),
        "baseline_disambiguators":        baselines,
        "decade_trajectory":              decade_trajectory,
        "polymath_bleed":                 polymath_bleed,
        "rare_records":                   rare,
        "cluster_meta":                   cluster_meta,
        "singular_inventor_candidates":   candidates,
        "generated_at":                   datetime.datetime.utcnow().isoformat() + "Z",
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Analyze Pulse formed model -> public artifact JSON.")
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
    print(f"  engine vs PatentsView purity:  {artifact['baseline_disambiguators']['engine']}")
    print(f"  naive-name vs PatentsView:     {artifact['baseline_disambiguators']['naive_name']}")
    print(f"  chance:                        {artifact['baseline_disambiguators']['chance']}")
    print(f"  singular-inventor candidates:  {len(artifact['singular_inventor_candidates'])}")
    print(f"  rare records:                  {len(artifact['rare_records'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
