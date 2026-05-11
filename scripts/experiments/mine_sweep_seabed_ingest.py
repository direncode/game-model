"""
SEABED-OBJECTS INGEST — real sidescan sonar dataset, no interactive steps.

Source: github.com/huoguanying/SeabedObjects-Ship-and-Airplane-dataset
Already cloned + unzipped at data/validation/mine_sweep/raw/seabed_so/
  plane-real/plane-real/*.jpg   (62 airplane sonar images, 224x224 RGB)
  ship-real-1/*.png             (172 ship sonar images, mostly grayscale)
  ship-real-2/*.png             (151 ship)
  ship-real-3/*.png             (62  ship)
Total: 447 images, 2 classes.

Framing for the existing harness:
  positive  = airplane image  (62 / 447  ≈  14% — minority class)
  negative  = ship image      (385 / 447 ≈  86%)
  Top-1% capture: substrate must concentrate planes into the highest-anomaly
  4-5 images. Random baseline expected = 0.62 planes in top-1%.

The substrate sees the same four features it saw on bathymetry tiles:
  residual_rms, local_relief, slope_std, laplacian_std — but on the image's
  GRAYSCALE INTENSITY GRID instead of a depth grid. Same math, different
  physical interpretation.

This is a substrate-fit-profile test:
  ✓ Real published data
  ✓ Multiple emergent classes (2; fit profile prefers 8-16, so weak here)
  ✓ Positives form a manifold (planes look like planes)
  ✓ Cluster recovery is the goal (substrate's natural strength)
  ⚠ N=447 is small for substrate (fit profile prefers 10K+)
  ⚠ The two classes are so visually distinct that textbook baselines may also separate them; we report all three, gate is honest.

Per docs/SUBSTRATE_FIT_PROFILE.md.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "experiments"))

from mine_sweep_features import (  # noqa: E402
    feature_residual_rms,
    feature_local_relief,
    feature_slope_std,
    feature_laplacian_std,
)

RAW_DIR = ROOT / "data" / "validation" / "mine_sweep" / "raw" / "seabed_so"
PLANE_DIR = RAW_DIR / "plane-real" / "plane-real"
SHIP_DIRS = [
    RAW_DIR / "ship-real-1",
    RAW_DIR / "ship-real-2",
    RAW_DIR / "ship-real-3",
]

OUT_DIR        = ROOT / "data" / "validation" / "mine_sweep"
MANIFEST_PATH  = OUT_DIR / "manifest.json"
FEATURES_PARQ  = OUT_DIR / "features.parquet"
FEATURES_NDJ   = OUT_DIR / "features.ndjson"
SUMMARY_PATH   = OUT_DIR / "features_summary.json"

# The substrate's "pixel size" parameter for slope_std. For sonar imagery the
# absolute unit doesn't matter — only relative scale. Set to 1.0 so slope_std
# becomes "pixel-wise gradient magnitude std" in dimensionless intensity units.
PIXEL_SIZE_FOR_SLOPE = 1.0


def features_for_image_intensity(intensity: np.ndarray) -> dict:
    """Same four features the bathymetry pipeline uses, applied to grayscale intensity.

    `intensity` is a 2-D float array. The math is unchanged because all four
    features are pure functions of a 2-D scalar grid — depth or intensity
    is just the physical interpretation.
    """
    return {
        "residual_rms":  feature_residual_rms(intensity),
        "local_relief":  feature_local_relief(intensity),
        "slope_std":     feature_slope_std(intensity, PIXEL_SIZE_FOR_SLOPE),
        "laplacian_std": feature_laplacian_std(intensity),
    }


def load_image_grayscale(path: Path) -> np.ndarray:
    """Open image, convert to grayscale float, return as 2-D array.

    Range [0, 1.0] for numerical stability.
    """
    from PIL import Image
    img = Image.open(path).convert("L")
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr


def collect_images() -> list[dict]:
    """Walk the four directories, return a list of (path, label) records."""
    items = []
    if not PLANE_DIR.exists():
        sys.exit(f"missing {PLANE_DIR}")
    for f in sorted(PLANE_DIR.iterdir()):
        if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"):
            items.append({"path": f, "label": "plane", "is_positive_strict": True})
    for d in SHIP_DIRS:
        if not d.exists():
            sys.exit(f"missing {d}")
        for f in sorted(d.iterdir()):
            if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"):
                items.append({"path": f, "label": "ship", "is_positive_strict": False})
    return items


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=None,
        help="cap on number of images (for debug)",
    )
    args = parser.parse_args()

    items = collect_images()
    if args.limit:
        items = items[: args.limit]
    n_plane = sum(1 for it in items if it["is_positive_strict"])
    n_ship  = len(items) - n_plane
    print(f"loaded {len(items)} sonar images: {n_plane} planes (positive), {n_ship} ships (negative)")

    rows = []
    for idx, it in enumerate(items):
        try:
            intensity = load_image_grayscale(it["path"])
        except Exception as e:
            print(f"  warn: skip {it['path']}: {e}")
            continue
        if intensity.size < 100:
            continue
        feats = features_for_image_intensity(intensity)
        if any(not np.isfinite(v) for v in feats.values()):
            continue
        rows.append({
            "tile_id":             str(it["path"].name),
            "anchor_lat":          0.0,
            "anchor_lon":          0.0,
            "anchor_x_utm":        float("nan"),
            "anchor_y_utm":        float("nan"),
            "residual_rms":        float(feats["residual_rms"]),
            "local_relief":        float(feats["local_relief"]),
            "slope_std":           float(feats["slope_std"]),
            "laplacian_std":       float(feats["laplacian_std"]),
            "coverage_frac":       1.0,
            "is_positive_strict":  bool(it["is_positive_strict"]),
            "_label":              it["label"],
            "_image_shape":        list(intensity.shape),
        })
        if (idx + 1) % 50 == 0:
            print(f"  processed {idx + 1} / {len(items)}")

    kept = len(rows)
    n_positive = sum(1 for r in rows if r["is_positive_strict"])
    print(f"\nkept={kept}, positives={n_positive} (base rate {100*n_positive/kept:.2f}%)")

    # Write parquet
    import pyarrow as pa
    import pyarrow.parquet as pq
    # Drop the helper columns the substrate doesn't need before writing parquet
    public_rows = [
        {k: v for k, v in r.items() if not k.startswith("_")}
        for r in rows
    ]
    pq.write_table(pa.Table.from_pylist(public_rows), FEATURES_PARQ, compression="zstd")
    print(f"wrote {FEATURES_PARQ.relative_to(ROOT)}")

    # NDJSON (OCEAN-compatible; drops the label too)
    with FEATURES_NDJ.open("w", encoding="utf-8") as f:
        for r in public_rows:
            ocean_row = {k: v for k, v in r.items() if k != "is_positive_strict"}
            f.write(json.dumps(ocean_row, separators=(",", ":")) + "\n")
    print(f"wrote {FEATURES_NDJ.relative_to(ROOT)} ({kept} records)")

    manifest = {
        "region":           "seabed_objects_ship_and_airplane",
        "synthetic_data":   False,
        "pilot":            True,
        "pilot_note": (
            "Real sidescan sonar imagery from huoguanying/SeabedObjects-Ship-"
            "and-Airplane-dataset. 2-class problem (plane positive, ship "
            "negative). Substrate-fit-profile validates real-data pipeline at "
            "low-N (447), 2-class (vs 8-16 preferred). See "
            "docs/SUBSTRATE_FIT_PROFILE.md."
        ),
        "source": {
            "repo": "https://github.com/huoguanying/SeabedObjects-Ship-and-Airplane-dataset",
            "local_path": str(RAW_DIR.relative_to(ROOT)),
        },
        "n_images":         kept,
        "n_plane_positive": n_positive,
        "n_ship_negative":  kept - n_positive,
        "harvested_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )

    summary = {
        "region":              "seabed_objects_ship_and_airplane",
        "synthetic_data":      False,
        "pilot":               True,
        "n_tiles_kept":        kept,
        "n_positives_strict":  n_positive,
        "positive_rate":       n_positive / kept if kept else 0.0,
        "tile_size_m":         None,
        "pixel_size_m":        None,
        "feature_stats": {
            field: {
                "mean": float(np.mean([r[field] for r in rows])),
                "std":  float(np.std([r[field] for r in rows])),
                "min":  float(np.min([r[field] for r in rows])),
                "max":  float(np.max([r[field] for r in rows])),
            }
            for field in ["residual_rms", "local_relief", "slope_std", "laplacian_std"]
        },
    }
    SUMMARY_PATH.write_text(
        json.dumps(summary, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {SUMMARY_PATH.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
