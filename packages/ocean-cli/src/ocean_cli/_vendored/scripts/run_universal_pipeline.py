"""Universal pipeline entry point.

Loads a YAML/JSON config, executes the operator DAG, prints a summary.

Replaces:
    scripts/defense_megatest/run_btut_then_tcd.py        (NSL-KDD)
    scripts/defense_megatest/run_tna_btut_then_tcd.py    (TNA HW catalogue)

…and any future per-corpus runners. Adding a new corpus = a new config
file (and possibly a new Source operator if the data shape is novel).

Usage:
    python -m scripts.run_universal_pipeline --config configs/tna.yaml
    python -m scripts.run_universal_pipeline --config configs/nslkdd.yaml --seed 43
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Workaround for sklearn/torch MKL DLL clash on Windows: pre-load torch
# before any sklearn-using operator imports. sklearn loads its own
# OpenMP runtime which conflicts with torch's if torch is loaded second.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
import torch  # noqa: F401, E402

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Importing the package registers all operator subclasses via @register.
from scripts.operators import load_config, run_pipeline  # noqa: E402
import scripts.operators.source  # noqa: F401, E402
import scripts.operators.embed   # noqa: F401, E402
import scripts.operators.cluster # noqa: F401, E402
import scripts.operators.align   # noqa: F401, E402
import scripts.operators.narrate # noqa: F401, E402
import scripts.operators.persist # noqa: F401, E402


def main():
    ap = argparse.ArgumentParser(description="Universal corpus → modules pipeline runner.")
    ap.add_argument("--config", type=Path, required=True, help="YAML or JSON pipeline config")
    ap.add_argument("--seed", type=int, default=None,
                    help="Override config seed (otherwise uses config's value or 42)")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    cfg = load_config(args.config)
    if args.seed is not None:
        cfg.seed = args.seed
    print(f"[pipeline] config={args.config}  seed={cfg.seed}  steps={len(cfg.steps)}")
    state = run_pipeline(cfg, verbose=not args.quiet)

    print()
    print("=" * 78)
    print("PIPELINE COMPLETE")
    print("=" * 78)
    timings = state.get("_pipeline.timings", [])
    total = sum(t["wall_s"] for t in timings)
    for t in timings:
        print(f"  {t['step']:20s} {t['kind']:30s}  {t['wall_s']:>7.2f}s  sig={t['sig']}")
    print(f"  {'TOTAL':20s} {'':<30}  {total:>7.2f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
