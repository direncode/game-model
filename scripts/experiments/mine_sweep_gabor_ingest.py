"""
MINE-SWEEP GABOR-FEATURE INGEST — feature-richness lever.

Replaces JL-of-pixels (which left 5 of 8 UATD classes at 0%
within-class generalization) with a multi-scale multi-orientation
Gabor filter bank — the classical sonar/radar texture descriptor
that captures oriented intensity structure that JL averages away.

Feature design — 128-d per patch:
  4 scales × 8 orientations = 32 Gabor filters
  4 statistics per filter response (mean, std, energy, max)
  = 128 features per 64×64 patch

Same downstream contract as mine_sweep_uatd_rich_ingest.py: writes
features.parquet with feat_0 ... feat_127, plus label_class +
is_positive_strict + image_id for the campaign-intelligence tests.

Reusable for ANY 64×64-patch corpus (UATD or SeabedObjects).
Used by the cross-corpus re-anchoring test in this session.
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

UATD_BASE     = ROOT / "data" / "validation" / "mine_sweep" / "raw" / "uatd"
SEABED_BASE   = ROOT / "data" / "validation" / "mine_sweep" / "raw" / "seabed_so"
OUT_DIR       = ROOT / "data" / "validation" / "mine_sweep"
MANIFEST_PATH = OUT_DIR / "manifest.json"
FEATURES_PARQ = OUT_DIR / "features.parquet"
FEATURES_NDJ  = OUT_DIR / "features.ndjson"
SUMMARY_PATH  = OUT_DIR / "features_summary.json"

PATCH_SIZE         = 64
PATCH_STRIDE       = 32
GABOR_FREQUENCIES  = [0.05, 0.1, 0.2, 0.4]   # 4 scales
GABOR_THETAS       = [k * np.pi / 8 for k in range(8)]   # 8 orientations
GABOR_SIGMA        = 4.0
GABOR_BANDWIDTH    = 1.0
STATS_PER_FILTER   = 4    # mean, std, energy, max
FEATURE_DIM        = len(GABOR_FREQUENCIES) * len(GABOR_THETAS) * STATS_PER_FILTER  # = 128
RANDOM_SEED        = 42


def build_gabor_kernels():
    """Pre-compute Gabor kernels at fixed scales × orientations.

    Returns list of (freq, theta, kernel_real, kernel_imag).
    """
    from skimage.filters import gabor_kernel
    kernels = []
    for freq in GABOR_FREQUENCIES:
        for theta in GABOR_THETAS:
            k = gabor_kernel(frequency=freq, theta=theta,
                             sigma_x=GABOR_SIGMA, sigma_y=GABOR_SIGMA,
                             bandwidth=GABOR_BANDWIDTH)
            kernels.append((freq, theta, np.real(k).astype(np.float32),
                                          np.imag(k).astype(np.float32)))
    return kernels


def patch_to_gabor_features(patch: np.ndarray, kernels) -> np.ndarray:
    """Apply Gabor bank → magnitude response → per-filter stats.

    Returns 128-d float32 vector.
    """
    from scipy.signal import fftconvolve
    feats = np.empty(FEATURE_DIM, dtype=np.float32)
    out_idx = 0
    for freq, theta, kr, ki in kernels:
        # Filter response magnitude (real + imag squared)
        resp_r = fftconvolve(patch, kr, mode="same")
        resp_i = fftconvolve(patch, ki, mode="same")
        mag = np.sqrt(resp_r * resp_r + resp_i * resp_i)
        feats[out_idx + 0] = float(mag.mean())
        feats[out_idx + 1] = float(mag.std())
        feats[out_idx + 2] = float((mag * mag).mean())  # energy
        feats[out_idx + 3] = float(mag.max())
        out_idx += STATS_PER_FILTER
    return feats


def parse_uatd_annotation(xml_path: Path) -> list[dict]:
    tree = ET.parse(xml_path)
    out = []
    for obj in tree.getroot().findall("object"):
        name = obj.findtext("name", default="").strip()
        bnd = obj.find("bndbox")
        if bnd is None or not name:
            continue
        out.append({
            "name": name,
            "xmin": int(float(bnd.findtext("xmin", default="0"))),
            "ymin": int(float(bnd.findtext("ymin", default="0"))),
            "xmax": int(float(bnd.findtext("xmax", default="0"))),
            "ymax": int(float(bnd.findtext("ymax", default="0"))),
        })
    return out


def patch_label_for_uatd(x: int, y: int, bboxes: list[dict]) -> tuple[bool, str]:
    cx = x + PATCH_SIZE // 2
    cy = y + PATCH_SIZE // 2
    for b in bboxes:
        if b["xmin"] <= cx <= b["xmax"] and b["ymin"] <= cy <= b["ymax"]:
            return True, b["name"]
    return False, "background"


def iter_uatd_patches(images_dir: Path, annotations_dir: Path,
                      neg_subsample: float, max_total: int,
                      seed: int):
    rng = random.Random(seed)
    image_paths = sorted(images_dir.glob("*.bmp"))
    n_kept = 0
    pos_count_by_class: dict[str, int] = {}
    from PIL import Image
    for idx, img_path in enumerate(image_paths):
        if n_kept >= max_total:
            print(f"  reached max_total={max_total}, stopping at image {idx}/{len(image_paths)}")
            return n_kept, pos_count_by_class
        xml_path = annotations_dir / f"{img_path.stem}.xml"
        if not xml_path.exists():
            continue
        try:
            bboxes = parse_uatd_annotation(xml_path)
            arr = np.asarray(Image.open(img_path).convert("L"), dtype=np.float32) / 255.0
        except Exception:
            continue
        H, W = arr.shape
        for y in range(0, H - PATCH_SIZE + 1, PATCH_STRIDE):
            for x in range(0, W - PATCH_SIZE + 1, PATCH_STRIDE):
                is_pos, cls = patch_label_for_uatd(x, y, bboxes)
                if not is_pos and rng.random() >= neg_subsample:
                    continue
                if is_pos:
                    pos_count_by_class[cls] = pos_count_by_class.get(cls, 0) + 1
                patch = arr[y:y+PATCH_SIZE, x:x+PATCH_SIZE]
                if patch.shape != (PATCH_SIZE, PATCH_SIZE):
                    continue
                yield {
                    "tile_id":            f"{img_path.stem}_{x}_{y}",
                    "image_id":           img_path.stem,
                    "label_class":        cls,
                    "is_positive_strict": is_pos,
                    "anchor_x":           float(x),
                    "anchor_y":           float(y),
                    "patch":              patch,
                }
                n_kept += 1
                if (n_kept % 1000) == 0:
                    print(f"  ... patches kept={n_kept}  images={idx+1}/{len(image_paths)}")
                if n_kept >= max_total:
                    return n_kept, pos_count_by_class
    return n_kept, pos_count_by_class


def iter_seabed_patches(seabed_root: Path, neg_subsample: float, max_total: int,
                        seed: int):
    """SeabedObjects images — plane=positive, ship=negative."""
    rng = random.Random(seed)
    plane_dir = seabed_root / "plane-real" / "plane-real"
    ship_dirs = [
        seabed_root / "ship-real-1",
        seabed_root / "ship-real-2",
        seabed_root / "ship-real-3",
    ]
    from PIL import Image
    items = []
    if plane_dir.exists():
        for p in sorted(plane_dir.iterdir()):
            if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"):
                items.append((p, "plane", True))
    for d in ship_dirs:
        if not d.exists():
            continue
        for p in sorted(d.iterdir()):
            if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp"):
                items.append((p, "ship", False))
    n_kept = 0
    pos_count = 0
    for img_path, cls, is_pos in items:
        if n_kept >= max_total:
            return n_kept, pos_count
        try:
            arr = np.asarray(Image.open(img_path).convert("L"), dtype=np.float32) / 255.0
        except Exception:
            continue
        H, W = arr.shape
        for y in range(0, max(0, H - PATCH_SIZE + 1), PATCH_STRIDE):
            for x in range(0, max(0, W - PATCH_SIZE + 1), PATCH_STRIDE):
                if not is_pos and rng.random() >= neg_subsample:
                    continue
                patch = arr[y:y+PATCH_SIZE, x:x+PATCH_SIZE]
                if patch.shape != (PATCH_SIZE, PATCH_SIZE):
                    continue
                yield {
                    "tile_id":            f"{img_path.parent.name}_{img_path.stem}_{x}_{y}",
                    "image_id":           img_path.stem,
                    "label_class":        cls,
                    "is_positive_strict": is_pos,
                    "anchor_x":           float(x),
                    "anchor_y":           float(y),
                    "patch":              patch,
                }
                n_kept += 1
                if is_pos:
                    pos_count += 1
                if n_kept >= max_total:
                    return n_kept, pos_count
    return n_kept, pos_count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", choices=["uatd", "seabed"], required=True)
    parser.add_argument("--uatd-subdir", default="UATD_Training",
                        help="UATD_Test_1 or UATD_Training")
    parser.add_argument("--max-total", type=int, default=60000)
    parser.add_argument("--neg-subsample-rate", type=float, default=0.015)
    args = parser.parse_args()

    print(f"=== Gabor feature extractor ===")
    print(f"  feature_dim:     {FEATURE_DIM}")
    print(f"  patch_size:      {PATCH_SIZE}")
    print(f"  scales:          {GABOR_FREQUENCIES}")
    print(f"  orientations:    {len(GABOR_THETAS)}")
    print(f"  stats per filter: {STATS_PER_FILTER}")
    print(f"  corpus:          {args.corpus}")
    print(f"  max_total:       {args.max_total}")
    print()

    print("[1] building Gabor kernel bank")
    kernels = build_gabor_kernels()
    print(f"  built {len(kernels)} Gabor kernels")

    print("\n[2] walking patches + extracting features")
    rows = []
    n_pos = 0
    pos_class_breakdown: dict = {}

    if args.corpus == "uatd":
        uatd_root = UATD_BASE / args.uatd_subdir
        images_dir = uatd_root / "images"
        annotations_dir = uatd_root / "annotations"
        if not images_dir.exists():
            sys.exit(f"missing {images_dir}")
        gen = iter_uatd_patches(images_dir, annotations_dir,
                                args.neg_subsample_rate, args.max_total, RANDOM_SEED)
    else:
        seabed_root = SEABED_BASE
        if not seabed_root.exists():
            sys.exit(f"missing {seabed_root}")
        gen = iter_seabed_patches(seabed_root, args.neg_subsample_rate,
                                   args.max_total, RANDOM_SEED)

    # Process patches one at a time (memory-friendly).
    # No generator wrapping — just iterate the source generator directly.
    for i, p in enumerate(gen):
        feats = patch_to_gabor_features(p["patch"], kernels)
        if not np.all(np.isfinite(feats)):
            continue
        r = {
            "tile_id":             p["tile_id"],
            "image_id":            p["image_id"],
            "label_class":         p["label_class"],
            "is_positive_strict":  p["is_positive_strict"],
            "anchor_lat":          0.0,
            "anchor_lon":          0.0,
            "anchor_x_utm":        p["anchor_x"],
            "anchor_y_utm":        p["anchor_y"],
            "coverage_frac":       1.0,
        }
        for j, v in enumerate(feats.tolist()):
            r[f"feat_{j}"] = float(v)
        rows.append(r)
        if p["is_positive_strict"]:
            n_pos += 1
            pos_class_breakdown[p["label_class"]] = pos_class_breakdown.get(p["label_class"], 0) + 1
        if (i + 1) % 2000 == 0:
            print(f"  Gabor-extracted {i+1} patches")

    kept = len(rows)
    print(f"\n[3] writing artifacts")
    import pyarrow as pa
    import pyarrow.parquet as pq
    pq.write_table(pa.Table.from_pylist(rows), FEATURES_PARQ, compression="zstd")
    print(f"  wrote {FEATURES_PARQ.relative_to(ROOT)}  ({kept} records × {FEATURE_DIM} features)")

    with FEATURES_NDJ.open("w", encoding="utf-8") as f:
        for r in rows:
            ocean_row = {k: v for k, v in r.items() if k != "is_positive_strict"}
            f.write(json.dumps(ocean_row, separators=(",", ":")) + "\n")

    manifest = {
        "region":            f"{args.corpus}_gabor",
        "corpus":            args.corpus,
        "uatd_subdir":       args.uatd_subdir if args.corpus == "uatd" else None,
        "feature_extractor": "gabor_filter_bank",
        "feature_dim":       FEATURE_DIM,
        "patch_size":        PATCH_SIZE,
        "gabor_frequencies": GABOR_FREQUENCIES,
        "n_orientations":    len(GABOR_THETAS),
        "stats_per_filter":  STATS_PER_FILTER,
        "n_patches_kept":    kept,
        "n_positive":        n_pos,
        "positive_class_counts": pos_class_breakdown,
        "harvested_at_utc":  datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    print(f"  wrote {MANIFEST_PATH.relative_to(ROOT)}")

    summary = {
        "region":              f"{args.corpus}_gabor",
        "feature_extractor":   "gabor_filter_bank",
        "feature_dim":         FEATURE_DIM,
        "n_tiles_kept":        kept,
        "n_positives_strict":  n_pos,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2, sort_keys=True, default=str) + "\n", encoding="utf-8")
    print(f"  wrote {SUMMARY_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
