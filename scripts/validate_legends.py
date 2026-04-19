"""Thin wrapper: run lo_core falsification harness against the 11 cached legends.

All logic lives in `lo_core.validate`. This script only loads the cached
BTUT outputs and calls into the library.
"""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

from lo_core.validate import validate_corpora

REPO_ROOT = Path(__file__).resolve().parent.parent

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("validate_legends")


LEGEND_SOURCES = {
    "edgar": REPO_ROOT / "scripts/cross_era_analysis/output/edgar_btut_result_v2.json",
    "heterogeneous": REPO_ROOT / "scripts/cross_era_analysis/output/heterogeneous_btut_result_v2.json",
    "polymath": REPO_ROOT / "scripts/cross_era_analysis/output/polymath_btut_result_v2.json",
    "latk_physics": REPO_ROOT / "scripts/cross_era_analysis/output/latk_physics_btut_result_v2.json",
    "latk_mini": REPO_ROOT / "scripts/cross_era_analysis/output/latk_mini_btut_result_v2.json",
    "linguistics": REPO_ROOT / "scripts/cross_era_analysis/output/linguistics_btut_result_v2.json",
    "patents": REPO_ROOT / "scripts/results/patents_superpower_result.json",
    "tesla": REPO_ROOT / "scripts/results/tesla_superpower_result.json",
    "pubmed": REPO_ROOT / "scripts/results/pubmed_superpower_result.json",
    "climate": REPO_ROOT / "scripts/results/climate_superpower_result.json",
    "comtrade": REPO_ROOT / "scripts/results/comtrade_superpower_result.json",
}
HELD_OUT = ("polymath", "tesla", "heterogeneous")
N_NULL = 30


def _to_jsonable(obj: Any) -> Any:
    if is_dataclass(obj):
        return _to_jsonable(asdict(obj))
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_jsonable(v) for v in obj]
    return obj


def main() -> int:
    survivors_by_corpus: dict[str, list[dict]] = {}
    for cid, path in LEGEND_SOURCES.items():
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            survivors_by_corpus[cid] = (data.get("survivors") or [])[:300]
        except Exception as e:
            log.warning("skip %s: %s", cid, e)
    log.info("Loaded %d legend corpora", len(survivors_by_corpus))

    report = validate_corpora(
        survivors_by_corpus,
        focus_corpus="polymath",
        n_iterations=N_NULL,
        held_out=HELD_OUT,
    )

    out_dir = REPO_ROOT / "data" / "validation"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "report.json").write_text(
        json.dumps(_to_jsonable(report), indent=2, sort_keys=True, default=str),
        encoding="utf-8",
    )
    log.info("Wrote %s", out_dir / "report.json")

    print()
    print("=" * 78)
    print(f"VALIDATION SUMMARY  (N={report.n_iterations}, seed={report.seed})")
    print("=" * 78)
    for t in report.null_tests:
        badge = "[PASS] SIGNIFICANT" if t.significant_at_0_05 else "       not signif"
        if t.null_mean is not None:
            print(
                f"  {t.metric:44s}  true={t.true_value:9.3f}  "
                f"null_mean={t.null_mean:9.3f}  p95={t.null_p95:9.3f}  [{badge}]"
            )
        else:
            print(
                f"  {t.metric:44s}  true={t.true_value!s:>9}  "
                f"null_prop={t.null_proportion_true}  [{badge}]"
            )
    if report.holdout:
        h = report.holdout
        print(
            f"\nHOLD-OUT: held={h.held_out}  train={h.train_bridge_count} "
            f"full={h.full_bridge_count}  heldout_bridges={h.bridges_involving_heldout}"
        )
        if h.top_heldout_bridge:
            print(f"  top heldout bridge: {h.top_heldout_bridge}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
