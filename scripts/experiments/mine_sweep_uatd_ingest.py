"""
UATD INGEST — Underwater Acoustic Target Detection dataset, patch-level.

Source: figshare.com/articles/dataset/UATD_Dataset/21331143 (CC BY 4.0)
Local: data/validation/mine_sweep/raw/uatd/UATD_Test_1/
  images/      800 BMP files, 1024x1950 RGB
  annotations/ 800 XML files, Pascal VOC format
  10 object classes (ball, cube, cylinder, tyre, etc.)
  Sensor: Tritech Gemini 1200ik multibeam forward-looking sonar

What this script does:
  - Walks each image + XML pair
  - Cuts each image into PATCH_SIZE x PATCH_SIZE patches at stride PATCH_STRIDE
  - Labels each patch positive if its center falls inside any bounding box
  - Computes the four substrate features on each patch's grayscale intensity
  - Optionally subsamples to keep first-run N tractable
  - Writes features.parquet / features.ndjson / manifest.json

For the open-set harness:
  - Negatives = background patches (vast majority)
  - Positives = patches containing any of the 10 object classes
  - Train substrate on background only, score off-manifold on full test
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import xml.etree.ElementTree as ET
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

# ---------- config -------------------------------------------------------
UATD_ROOT      = ROOT / "data" / "validation" / "mine_sweep" / "raw" / "uatd" / "UATD_Test_1"
IMAGES_DIR     = UATD_ROOT / "images"
ANNOTATIONS    = UATD_ROOT / "annotations"

OUT_DIR        = ROOT / "data" / "validation" / "mine_sweep"
MANIFEST_PATH  = OUT_DIR / "manifest.json"
FEATURES_PARQ  = OUT_DIR / "features.parquet"
FEATURES_NDJ   = OUT_DIR / "features.ndjson"
SUMMARY_PATH   = OUT_DIR / "features_summary.json"

PATCH_SIZE   = 64
PATCH_STRIDE = 32
KEEP_ALL_POSITIVES = True     # always keep object-containing patches
NEG_SUBSAMPLE_RATE = 0.05     # keep 5% of background patches at random (still big)
RANDOM_SEED        = 42
# -------------------------------------------------------------------------


def parse_annotation(xml_path: Path) -> list[dict]:
    """Return list of {name, xmin, ymin, xmax, ymax} dicts."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    objs = []
    for obj in root.findall("object"):
        name = obj.findtext("name", default="").strip()
        bnd = obj.find("bndbox")
        if bnd is None or not name:
            continue
        objs.append({
            "name": name,
            "xmin": int(float(bnd.findtext("xmin", default="0"))),
            "ymin": int(float(bnd.findtext("ymin", default="0"))),
            "xmax": int(float(bnd.findtext("xmax", default="0"))),
            "ymax": int(float(bnd.findtext("ymax", default="0"))),
        })
    return objs


def is_patch_positive(patch_x: int, patch_y: int, patch_size: int, bboxes: list[dict]) -> tuple[bool, str | None]:
    """Patch is positive if its CENTER falls inside any bounding box."""
    cx = patch_x + patch_size // 2
    cy = patch_y + patch_size // 2
    for b in bboxes:
        if b["xmin"] <= cx <= b["xmax"] and b["ymin"] <= cy <= b["ymax"]:
            return True, b["name"]
    return False, None


def features_for_patch(patch_gray: np.ndarray) -> dict:
    return {
        "residual_rms":  feature_residual_rms(patch_gray),
        "local_relief":  feature_local_relief(patch_gray),
        "slope_std":     feature_slope_std(patch_gray, 1.0),
        "laplacian_std": feature_laplacian_std(patch_gray),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit-images", type=int, default=None,
                        help="cap on images processed (for debug)")
    parser.add_argument("--neg-subsample-rate", type=float, default=NEG_SUBSAMPLE_RATE,
                        help=f"fraction of background patches to keep (default {NEG_SUBSAMPLE_RATE})")
    parser.add_argument("--patch-size",   type=int, default=PATCH_SIZE)
    parser.add_argument("--patch-stride", type=int, default=PATCH_STRIDE)
    args = parser.parse_args()

    from PIL import Image

    if not IMAGES_DIR.exists():
        sys.exit(f"missing {IMAGES_DIR}")
    image_paths = sorted(IMAGES_DIR.glob("*.bmp"))
    if args.limit_images:
        image_paths = image_paths[: args.limit_images]
    print(f"processing {len(image_paths)} UATD images")
    print(f"  patch_size={args.patch_size}, patch_stride={args.patch_stride}")
    print(f"  neg_subsample_rate={args.neg_subsample_rate}")

    rng = random.Random(RANDOM_SEED)

    rows = []
    pos_count_by_class = {}
    n_neg_total = 0
    n_neg_kept  = 0

    for idx, img_path in enumerate(image_paths):
        xml_path = ANNOTATIONS / f"{img_path.stem}.xml"
        if not xml_path.exists():
            continue
        try:
            bboxes = parse_annotation(xml_path)
        except Exception as e:
            print(f"  warn: skipping {xml_path}: {e}")
            continue
        try:
            img_rgb = Image.open(img_path).convert("L")
            arr = np.asarray(img_rgb, dtype=np.float32) / 255.0
        except Exception as e:
            print(f"  warn: skipping {img_path}: {e}")
            continue

        H, W = arr.shape
        for y in range(0, H - args.patch_size + 1, args.patch_stride):
            for x in range(0, W - args.patch_size + 1, args.patch_stride):
                is_pos, cls = is_patch_positive(x, y, args.patch_size, bboxes)
                if not is_pos:
                    n_neg_total += 1
                    if rng.random() >= args.neg_subsample_rate:
                        continue
                    n_neg_kept += 1
                else:
                    pos_count_by_class[cls] = pos_count_by_class.get(cls, 0) + 1
                patch = arr[y : y + args.patch_size, x : x + args.patch_size]
                feats = features_for_patch(patch)
                if any(not np.isfinite(v) for v in feats.values()):
                    continue
                rows.append({
                    "tile_id":             f"{img_path.stem}_{x}_{y}",
                    "anchor_lat":          0.0,
                    "anchor_lon":          0.0,
                    "anchor_x_utm":        float(x),
                    "anchor_y_utm":        float(y),
                    "residual_rms":        float(feats["residual_rms"]),
                    "local_relief":        float(feats["local_relief"]),
                    "slope_std":           float(feats["slope_std"]),
                    "laplacian_std":       float(feats["laplacian_std"]),
                    "coverage_frac":       1.0,
                    "is_positive_strict":  bool(is_pos),
                })
        if (idx + 1) % 50 == 0:
            print(f"  ... {idx + 1} / {len(image_paths)} images, kept {len(rows)} patches so far")

    kept = len(rows)
    n_positive = sum(1 for r in rows if r["is_positive_strict"])
    n_negative = kept - n_positive
    print(f"\ntotal patches kept: {kept}")
    print(f"  positives (any-object): {n_positive}")
    print(f"  negatives (background): {n_negative}  (subsampled from {n_neg_total} candidates)")
    print(f"  positive class breakdown:")
    for cls, count in sorted(pos_count_by_class.items(), key=lambda kv: -kv[1]):
        print(f"    {cls:<20}: {count}")

    import pyarrow as pa
    import pyarrow.parquet as pq
    pq.write_table(pa.Table.from_pylist(rows), FEATURES_PARQ, compression="zstd")
    print(f"\nwrote {FEATURES_PARQ.relative_to(ROOT)}")

    with FEATURES_NDJ.open("w", encoding="utf-8") as f:
        for r in rows:
            ocean_row = {k: v for k, v in r.items() if k != "is_positive_strict"}
            f.write(json.dumps(ocean_row, separators=(",", ":")) + "\n")
    print(f"wrote {FEATURES_NDJ.relative_to(ROOT)} ({kept} records)")

    manifest = {
        "region":           "uatd_test_1",
        "synthetic_data":   False,
        "pilot":            True,
        "source": {
            "doi":  "10.6084/m9.figshare.21331143",
            "license": "CC BY 4.0",
            "sensor": "Tritech Gemini 1200ik MFLS",
        },
        "patch_size":       args.patch_size,
        "patch_stride":     args.patch_stride,
        "neg_subsample_rate": args.neg_subsample_rate,
        "n_images":         len(image_paths),
        "n_patches_kept":   kept,
        "n_positive":       n_positive,
        "n_negative":       n_negative,
        "positive_class_counts": pos_count_by_class,
        "harvested_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )

    summary = {
        "region":               "uatd_test_1",
        "synthetic_data":       False,
        "pilot":                True,
        "n_tiles_kept":         kept,
        "n_positives_strict":   n_positive,
        "positive_rate":        n_positive / kept if kept else 0.0,
        "n_positive_classes":   len(pos_count_by_class),
        "patch_size":           args.patch_size,
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
