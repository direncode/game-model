"""
MINE-SWEEP PIPELINE VALIDATION via synthetic features.

NOT A SHOWCASE — this script does NOT validate any /mine-sweep substrate claim.
It generates synthetic per-tile features with planted positive structure and
writes them to features.parquet/features.ndjson so that the rest of the
harness (mine_sweep.py) can be run end-to-end. The verdict produced is a
test of pipeline plumbing, not a measurement of substrate performance on
real bathymetry.

Use this script when:
  - Validating that the harness, baselines, and B-gate logic all execute.
  - Smoke-testing changes to mine_sweep.py before a real run.
  - Demonstrating that the pipeline produces a number end-to-end in a single
    session, while real NOAA data acquisition is still in progress.

What this script writes:
  data/validation/mine_sweep/features.parquet
  data/validation/mine_sweep/features.ndjson
  data/validation/mine_sweep/features_summary.json
  data/validation/mine_sweep/manifest.json   (with synthetic_data: true)

Schema matches mine_sweep_features.py exactly so mine_sweep.py runs unchanged.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]

OUT_DIR        = ROOT / "data" / "validation" / "mine_sweep"
FEATURES_PARQ  = OUT_DIR / "features.parquet"
FEATURES_NDJ   = OUT_DIR / "features.ndjson"
SUMMARY_PATH   = OUT_DIR / "features_summary.json"
MANIFEST_PATH  = OUT_DIR / "manifest.json"


def synth_features(n_tiles: int, n_positives: int, seed: int) -> list[dict]:
    """Generate synthetic per-tile features.

    Negatives: drawn from a 4D background distribution roughly resembling
    Stellwagen Bank seafloor statistics — modest residual, modest relief,
    smooth slopes, low curvature variance.

    Positives: drawn from a shifted distribution with elevated residual
    and local_relief (the "spike" signal a wreck creates on bathymetry),
    plus moderate slope_std and laplacian_std.

    The two distributions overlap substantially so the substrate has a
    non-trivial sorting problem; positives are not trivially top-K by any
    single feature.
    """
    rng = np.random.default_rng(seed)

    # Background tiles (negatives)
    residual_neg = rng.lognormal(mean=-1.0, sigma=0.6, size=n_tiles)
    relief_neg   = rng.lognormal(mean=0.5,  sigma=0.5, size=n_tiles)
    slope_neg    = rng.lognormal(mean=-2.5, sigma=0.4, size=n_tiles)
    lapl_neg     = rng.lognormal(mean=-3.0, sigma=0.5, size=n_tiles)

    # Inject the planted positives by sampling positions and overwriting
    pos_idx = rng.choice(n_tiles, size=n_positives, replace=False)
    pos_idx_set = set(int(x) for x in pos_idx)

    # Positives: clearly elevated residual + relief, with moderate slope/lap
    # The shift is large enough that a perfect classifier would dominate,
    # but small enough that single-feature sorting still leaves false-pos.
    residual_neg[pos_idx] = rng.lognormal(mean=0.5, sigma=0.4, size=n_positives)
    relief_neg[pos_idx]   = rng.lognormal(mean=2.0, sigma=0.4, size=n_positives)
    slope_neg[pos_idx]    = rng.lognormal(mean=-1.5, sigma=0.4, size=n_positives)
    lapl_neg[pos_idx]     = rng.lognormal(mean=-2.0, sigma=0.5, size=n_positives)

    rows = []
    for i in range(n_tiles):
        rows.append({
            "tile_id":            f"{i // 1000}_{i % 1000}",
            "anchor_lat":         42.40 + (i // 1000) * 0.001,
            "anchor_lon":        -70.30 + (i % 1000)  * 0.001,
            "anchor_x_utm":      400000.0 + (i % 1000)  * 50.0,
            "anchor_y_utm":     4690000.0 + (i // 1000) * 50.0,
            "residual_rms":      float(residual_neg[i]),
            "local_relief":      float(relief_neg[i]),
            "slope_std":         float(slope_neg[i]),
            "laplacian_std":     float(lapl_neg[i]),
            "coverage_frac":     1.0,
            "is_positive_strict": i in pos_idx_set,
        })
    return rows


def write_synthetic_manifest(n_tiles: int, n_positives: int, seed: int):
    """Write a manifest that explicitly marks the corpus as synthetic.

    Downstream readers (e.g. summary.json) can detect this and refuse to
    treat the run as a real /mine-sweep measurement.
    """
    manifest = {
        "region":            "synthetic_pipeline_validation",
        "synthetic_data":    True,
        "n_tiles":           n_tiles,
        "n_positives":       n_positives,
        "seed":              seed,
        "generator_version": "mine_sweep_synth.py",
        "generated_at_utc":  datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": (
            "This manifest describes SYNTHETIC features generated for "
            "pipeline-plumbing validation. It is NOT a /mine-sweep "
            "measurement. The real run requires NOAA bathymetry + AWOIS "
            "data; see docs/superpowers/specs/2026-05-11-mine-sweep-design.md."
        ),
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n-tiles",     type=int, default=10000)
    parser.add_argument("--n-positives", type=int, default=50)
    parser.add_argument("--seed",        type=int, default=42)
    args = parser.parse_args()

    print(f"generating synthetic features: {args.n_tiles} tiles, "
          f"{args.n_positives} planted positives, seed={args.seed}")
    rows = synth_features(args.n_tiles, args.n_positives, args.seed)

    # Write parquet
    import pyarrow as pa
    import pyarrow.parquet as pq
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pylist(rows)
    pq.write_table(table, FEATURES_PARQ, compression="zstd")
    print(f"wrote {FEATURES_PARQ.relative_to(ROOT)}")

    # Write NDJSON (drop the held-out label)
    with FEATURES_NDJ.open("w", encoding="utf-8") as f:
        for r in rows:
            ocean_row = {k: v for k, v in r.items() if k != "is_positive_strict"}
            f.write(json.dumps(ocean_row, separators=(",", ":")) + "\n")
    print(f"wrote {FEATURES_NDJ.relative_to(ROOT)} ({len(rows)} records)")

    # Summary
    summary = {
        "region":              "synthetic_pipeline_validation",
        "synthetic_data":      True,
        "n_tiles_kept":        args.n_tiles,
        "n_positives_strict":  args.n_positives,
        "positive_rate":       args.n_positives / args.n_tiles,
        "tile_size_m":         50.0,
        "feature_stats": {
            field: {
                "mean": float(np.mean([r[field] for r in rows])),
                "std":  float(np.std([r[field] for r in rows])),
                "min":  float(np.min([r[field] for r in rows])),
                "max":  float(np.max([r[field] for r in rows])),
            }
            for field in ["residual_rms", "local_relief", "slope_std", "laplacian_std"]
        },
        "note": (
            "SYNTHETIC corpus for pipeline-plumbing validation. "
            "NOT a /mine-sweep substrate measurement."
        ),
    }
    SUMMARY_PATH.write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {SUMMARY_PATH.relative_to(ROOT)}")

    write_synthetic_manifest(args.n_tiles, args.n_positives, args.seed)
    print(f"wrote {MANIFEST_PATH.relative_to(ROOT)} (synthetic_data: true)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
