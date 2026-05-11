"""
UATD RICH-FEATURE INGEST — same patches, same labels, but features are
deterministic 128-d Johnson-Lindenstrauss projections of the flattened
64x64 grayscale patch (4096-d raw) instead of 4 scalar summary statistics.

This is "lever 2" from the previous run: feature richness, not N.

Same source: UATD_Test_1, 800 BMP images + Pascal VOC annotations.
Same patch geometry: 64x64 stride 32.
Same labeling rule: positive if patch center falls inside any bbox.
Same train/test split (background = train normal manifold, all = test).

Only the FEATURE EXTRACTION changes:
  Before:  4 scalar stats per patch  (residual_rms, local_relief, slope_std, laplacian_std)
  After:   128-dim random-projected patch  (Johnson-Lindenstrauss, seed=42, deterministic)

The 128-dim target matches /atlas's TF-IDF + JL projection — the same
substrate config that hits perfect purity on /atlas's 500k papers. By
matching dimensionality, we put substrate on its home turf.

Outputs:
  data/validation/mine_sweep/features.parquet   (with feat_0 ... feat_127 columns)
  data/validation/mine_sweep/features.ndjson
  data/validation/mine_sweep/manifest.json      (with rich_features: true)
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

# ---------- config -------------------------------------------------------
UATD_BASE      = ROOT / "data" / "validation" / "mine_sweep" / "raw" / "uatd"
UATD_ROOT      = UATD_BASE / "UATD_Test_1"  # default; overridable via --uatd-root
IMAGES_DIR     = UATD_ROOT / "images"
ANNOTATIONS    = UATD_ROOT / "annotations"

OUT_DIR        = ROOT / "data" / "validation" / "mine_sweep"
MANIFEST_PATH  = OUT_DIR / "manifest.json"
FEATURES_PARQ  = OUT_DIR / "features.parquet"
FEATURES_NDJ   = OUT_DIR / "features.ndjson"
SUMMARY_PATH   = OUT_DIR / "features_summary.json"

PATCH_SIZE   = 64
PATCH_STRIDE = 32
JL_DIM       = 1024   # native substrate operating dimension per project owner
JL_SEED      = 42
RANDOM_SEED  = 42

KEEP_ALL_POSITIVES   = True
NEG_SUBSAMPLE_RATE   = 0.02   # 2% of background patches — keep N tractable for OCSVM
MAX_TOTAL_PATCHES    = 25_000 # absolute cap; positives always kept, negs trimmed if needed
# -------------------------------------------------------------------------


def parse_annotation(xml_path: Path) -> list[dict]:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    out = []
    for obj in root.findall("object"):
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


def is_patch_positive(patch_x: int, patch_y: int, patch_size: int, bboxes: list[dict]) -> tuple[bool, str | None]:
    cx = patch_x + patch_size // 2
    cy = patch_y + patch_size // 2
    for b in bboxes:
        if b["xmin"] <= cx <= b["xmax"] and b["ymin"] <= cy <= b["ymax"]:
            return True, b["name"]
    return False, None


def build_jl_projection(input_dim: int, output_dim: int, seed: int) -> np.ndarray:
    """Johnson-Lindenstrauss projection: random Gaussian / sqrt(D)."""
    rng = np.random.default_rng(seed)
    return rng.standard_normal((input_dim, output_dim)).astype(np.float32) / np.sqrt(output_dim)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit-images", type=int, default=None)
    parser.add_argument("--neg-subsample-rate", type=float, default=NEG_SUBSAMPLE_RATE)
    parser.add_argument("--max-total", type=int, default=MAX_TOTAL_PATCHES)
    parser.add_argument("--patch-size",   type=int, default=PATCH_SIZE)
    parser.add_argument("--patch-stride", type=int, default=PATCH_STRIDE)
    parser.add_argument("--uatd-root", type=Path, default=None,
                        help="override UATD subdirectory (default UATD_Test_1; use UATD_Training for scale-up)")
    args = parser.parse_args()

    global IMAGES_DIR, ANNOTATIONS
    if args.uatd_root is not None:
        root_path = args.uatd_root if args.uatd_root.is_absolute() else (UATD_BASE / args.uatd_root)
        IMAGES_DIR  = root_path / "images"
        ANNOTATIONS = root_path / "annotations"
        print(f"using uatd_root override: {root_path}")

    from PIL import Image

    image_paths = sorted(IMAGES_DIR.glob("*.bmp"))
    if args.limit_images:
        image_paths = image_paths[: args.limit_images]
    print(f"processing {len(image_paths)} UATD images")
    print(f"  patch_size={args.patch_size}, stride={args.patch_stride}")
    print(f"  raw_dim={args.patch_size * args.patch_size}, JL_dim={JL_DIM}, JL_seed={JL_SEED}")
    print(f"  neg_subsample_rate={args.neg_subsample_rate}, max_total={args.max_total}")

    rng = random.Random(RANDOM_SEED)
    raw_dim = args.patch_size * args.patch_size

    # Deterministic JL projection matrix
    jl_matrix = build_jl_projection(raw_dim, JL_DIM, JL_SEED)
    print(f"  JL matrix shape: {jl_matrix.shape}, sha-of-first-row: "
          f"{hex(hash(jl_matrix[0].tobytes()) & 0xFFFFFFFF)}")

    rows = []
    meta = []
    pos_count_by_class = {}
    n_neg_total = 0

    for idx, img_path in enumerate(image_paths):
        if len(rows) >= args.max_total:
            print(f"  reached max_total={args.max_total}, stopping image walk")
            break
        xml_path = ANNOTATIONS / f"{img_path.stem}.xml"
        if not xml_path.exists():
            continue
        try:
            bboxes = parse_annotation(xml_path)
            img_gray = Image.open(img_path).convert("L")
            arr = np.asarray(img_gray, dtype=np.float32) / 255.0
        except Exception:
            continue

        H, W = arr.shape
        for y in range(0, H - args.patch_size + 1, args.patch_stride):
            for x in range(0, W - args.patch_size + 1, args.patch_stride):
                is_pos, cls = is_patch_positive(x, y, args.patch_size, bboxes)
                if not is_pos:
                    n_neg_total += 1
                    if rng.random() >= args.neg_subsample_rate:
                        continue
                else:
                    pos_count_by_class[cls] = pos_count_by_class.get(cls, 0) + 1
                patch = arr[y : y + args.patch_size, x : x + args.patch_size]
                if patch.shape != (args.patch_size, args.patch_size):
                    continue
                # 4096-d flatten then JL-project to 128-d
                z = patch.reshape(-1).astype(np.float32) @ jl_matrix
                if not np.all(np.isfinite(z)):
                    continue
                rows.append(z)
                meta.append({
                    "tile_id":             f"{img_path.stem}_{x}_{y}",
                    "image_id":            img_path.stem,
                    "anchor_x_utm":        float(x),
                    "anchor_y_utm":        float(y),
                    "is_positive_strict":  bool(is_pos),
                    "label_class":         cls if is_pos else "background",
                })
                if len(rows) >= args.max_total:
                    break
            if len(rows) >= args.max_total:
                break
        if (idx + 1) % 50 == 0:
            print(f"  ... {idx + 1}/{len(image_paths)} images, kept {len(rows)} patches")

    kept = len(rows)
    Z = np.stack(rows).astype(np.float32) if rows else np.zeros((0, JL_DIM), dtype=np.float32)
    n_positive = sum(1 for m in meta if m["is_positive_strict"])
    n_negative = kept - n_positive
    print(f"\ntotal patches kept: {kept}  (Z shape: {Z.shape})")
    print(f"  positives: {n_positive}  base rate {100 * n_positive / kept:.2f}%")
    print(f"  negatives: {n_negative}  (subsampled from {n_neg_total} candidates)")
    print(f"  positive class counts:")
    for cls, count in sorted(pos_count_by_class.items(), key=lambda kv: -kv[1]):
        print(f"    {cls:<20}: {count}")

    # Build parquet rows: metadata + feat_0..feat_{JL_DIM-1}
    public_rows = []
    for m, z_row in zip(meta, Z):
        r = {
            "tile_id":             m["tile_id"],
            "image_id":            m["image_id"],
            "label_class":         m["label_class"],
            "anchor_lat":          0.0,
            "anchor_lon":          0.0,
            "anchor_x_utm":        m["anchor_x_utm"],
            "anchor_y_utm":        m["anchor_y_utm"],
            "coverage_frac":       1.0,
            "is_positive_strict":  m["is_positive_strict"],
        }
        for i, v in enumerate(z_row.tolist()):
            r[f"feat_{i}"] = float(v)
        public_rows.append(r)

    import pyarrow as pa
    import pyarrow.parquet as pq
    table = pa.Table.from_pylist(public_rows)
    pq.write_table(table, FEATURES_PARQ, compression="zstd")
    print(f"\nwrote {FEATURES_PARQ.relative_to(ROOT)}")

    with FEATURES_NDJ.open("w", encoding="utf-8") as f:
        for r in public_rows:
            ocean_row = {k: v for k, v in r.items() if k != "is_positive_strict"}
            f.write(json.dumps(ocean_row, separators=(",", ":")) + "\n")
    print(f"wrote {FEATURES_NDJ.relative_to(ROOT)} ({kept} records)")

    manifest = {
        "region":              "uatd_test_1_rich",
        "synthetic_data":      False,
        "pilot":               True,
        "rich_features":       True,
        "feature_dim":         JL_DIM,
        "jl_seed":             JL_SEED,
        "patch_size":          args.patch_size,
        "patch_stride":        args.patch_stride,
        "neg_subsample_rate":  args.neg_subsample_rate,
        "n_patches_kept":      kept,
        "n_positive":          n_positive,
        "n_negative":          n_negative,
        "positive_class_counts": pos_count_by_class,
        "source": {
            "doi": "10.6084/m9.figshare.21331143",
            "license": "CC BY 4.0",
            "sensor": "Tritech Gemini 1200ik MFLS",
        },
        "harvested_at_utc":    datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {MANIFEST_PATH.relative_to(ROOT)}")

    summary = {
        "region":             "uatd_test_1_rich",
        "synthetic_data":     False,
        "pilot":              True,
        "rich_features":      True,
        "n_tiles_kept":       kept,
        "n_positives_strict": n_positive,
        "positive_rate":      n_positive / kept if kept else 0.0,
        "feature_dim":        JL_DIM,
    }
    SUMMARY_PATH.write_text(
        json.dumps(summary, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {SUMMARY_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
