"""
MINE-SWEEP REAL-DATA INGEST — Stellwagen Bank, end-to-end no-interactive-steps.

Sources:
  1. GMRT GridServer (Marine Geoscience Data System / LDEO) — real bathymetry
     GeoTIFF for the Stellwagen Sanctuary bbox at 100m resolution. Single
     HTTP GET, no auth, ~6.7 MB.
  2. OpenStreetMap via Overpass API — real wreck/obstruction nodes in the
     same bbox. Public-domain (ODbL), no auth, returns JSON.

What this script does:
  1. Downloads GMRT bathymetry GeoTIFF (if not cached) for the Stellwagen bbox.
  2. Fetches OSM wrecks/obstructions for the same bbox (if not cached).
  3. Tiles the bathymetry into TILE_SIZE_M squares.
  4. Computes the four mine_sweep features per tile (residual_rms,
     local_relief, slope_std, laplacian_std), reusing the pure feature-math
     functions in mine_sweep_features.py.
  5. Marks tiles positive if any OSM wreck/obstruction node falls inside.
  6. Writes features.parquet, features.ndjson, manifest.json, features_summary.json.

This is a PILOT-grade ingest. The corpus is real but at 100m resolution
(vs 5m for the spec's NCEI multibeam BAGs). The tile size is widened to
500m so each tile is 5x5 = 25 pixels, enough for stable feature statistics.

When the full-spec ingest (NCEI BAGs at 5m, 50m tiles) is eventually run,
the SAME mine_sweep.py harness should consume that features.parquet
without changes — only the upstream resolution and tile size differ.

Per spec docs/superpowers/specs/2026-05-11-mine-sweep-design.md, this is
explicitly a pilot/feasibility variant. Real /mine-sweep showcase numbers
require the NCEI multibeam path.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "experiments"))

# Reuse the pure feature-math functions from the spec-grade features script.
from mine_sweep_features import (  # noqa: E402
    feature_residual_rms,
    feature_local_relief,
    feature_slope_std,
    feature_laplacian_std,
    coverage_fraction,
)


# ---------- config -------------------------------------------------------
REGION_BBOX = {  # Stellwagen Sanctuary, per the metadata published by NOAA
    "north":  42.766715,
    "south":  42.093300,
    "west":  -70.597366,
    "east":  -70.035064,
}
REGION_NAME = "stellwagen_bank_sbnms_gmrt_pilot"
TILE_SIZE_M = 500.0   # widened from spec's 50m because GMRT is 100m-resolution
MIN_COVERAGE_FRAC = 0.50

# Output paths
OUT_DIR        = ROOT / "data" / "validation" / "mine_sweep"
RAW_DIR        = OUT_DIR / "raw"
BATHY_PATH     = RAW_DIR / "gmrt_stellwagen.tif"
OSM_PATH       = RAW_DIR / "osm_wrecks.json"
MANIFEST_PATH  = OUT_DIR / "manifest.json"
FEATURES_PARQ  = OUT_DIR / "features.parquet"
FEATURES_NDJ   = OUT_DIR / "features.ndjson"
SUMMARY_PATH   = OUT_DIR / "features_summary.json"

# Data sources
GMRT_URL_TEMPLATE = (
    "https://www.gmrt.org/services/GridServer?"
    "north={north}&west={west}&east={east}&south={south}"
    "&layer=topo&format=geotiff&resolution=high"
)
OVERPASS_ENDPOINT = "https://overpass.kumi.systems/api/interpreter"
OVERPASS_QUERY_TEMPLATE = (
    "[out:json][timeout:25];"
    "("
    "node[\"historic\"=\"wreck\"]({south},{west},{north},{east});"
    "node[\"seamark:type\"=\"wreck\"]({south},{west},{north},{east});"
    "node[\"seamark:type\"=\"obstruction\"]({south},{west},{north},{east});"
    "way[\"historic\"=\"wreck\"]({south},{west},{north},{east});"
    "way[\"seamark:type\"=\"wreck\"]({south},{west},{north},{east});"
    ");"
    "out center;"
)
# -------------------------------------------------------------------------


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_bathymetry() -> dict:
    """Download GMRT GeoTIFF for the Stellwagen bbox if not cached."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    url = GMRT_URL_TEMPLATE.format(**REGION_BBOX)
    if not BATHY_PATH.exists():
        print(f"downloading bathymetry: GMRT GridServer @ {REGION_BBOX}")
        req = urllib.request.Request(
            url, headers={"User-Agent": "latentocean-mine-sweep/0.1"}
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            BATHY_PATH.write_bytes(r.read())
        print(f"  wrote {BATHY_PATH.relative_to(ROOT)} ({BATHY_PATH.stat().st_size:,} bytes)")
    else:
        print(f"cached: {BATHY_PATH.relative_to(ROOT)} ({BATHY_PATH.stat().st_size:,} bytes)")
    return {
        "source": "gmrt_gridserver",
        "url": url,
        "local_path": str(BATHY_PATH.relative_to(ROOT)),
        "bytes": BATHY_PATH.stat().st_size,
        "sha256": sha256_of(BATHY_PATH),
    }


def fetch_osm_wrecks() -> dict:
    """Fetch OSM wrecks/obstructions via Overpass if not cached."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if not OSM_PATH.exists():
        print(f"fetching OSM wrecks: Overpass @ {REGION_BBOX}")
        query = OVERPASS_QUERY_TEMPLATE.format(**REGION_BBOX)
        data = urllib.parse.urlencode({"data": query}).encode("utf-8")
        req = urllib.request.Request(
            OVERPASS_ENDPOINT, data=data,
            headers={"User-Agent": "latentocean-mine-sweep/0.1"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            OSM_PATH.write_bytes(r.read())
        print(f"  wrote {OSM_PATH.relative_to(ROOT)} ({OSM_PATH.stat().st_size:,} bytes)")
    else:
        print(f"cached: {OSM_PATH.relative_to(ROOT)} ({OSM_PATH.stat().st_size:,} bytes)")
    elements = json.loads(OSM_PATH.read_text())["elements"]
    points = []
    for el in elements:
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        points.append({
            "osm_id": el["id"],
            "lat": float(lat),
            "lon": float(lon),
            "tags": el.get("tags", {}),
        })
    print(f"  parsed {len(points)} positive-label points")
    return {
        "source": "openstreetmap_overpass",
        "endpoint": OVERPASS_ENDPOINT,
        "query": OVERPASS_QUERY_TEMPLATE.format(**REGION_BBOX),
        "local_path": str(OSM_PATH.relative_to(ROOT)),
        "bytes": OSM_PATH.stat().st_size,
        "sha256": sha256_of(OSM_PATH),
        "n_points": len(points),
        "points": points,
    }


def load_bathymetry():
    """Open GMRT GeoTIFF, return (depth_array, transform, crs, pixel_size_m)."""
    import rasterio
    src = rasterio.open(BATHY_PATH)
    depth = src.read(1).astype(np.float32)
    # GMRT marks no-data as a sentinel; convert to NaN
    if src.nodata is not None:
        depth[depth == src.nodata] = np.nan
    transform = src.transform
    crs = src.crs
    # GMRT delivers in geographic (EPSG:4326). Pixel size is in degrees.
    # Convert one pixel of latitude to meters (~111,000 m/deg lat).
    pixel_size_lat_deg = abs(transform.e)
    pixel_size_m = pixel_size_lat_deg * 111_000.0
    print(f"  bathymetry: shape={depth.shape}, pixel~{pixel_size_m:.0f}m, "
          f"depth range [{np.nanmin(depth):.0f}, {np.nanmax(depth):.0f}]")
    src.close()
    return depth, transform, str(crs), pixel_size_m


def grid_origin(transform, pixel_size_m: float, n_rows: int, n_cols: int) -> dict:
    """Compute the WGS84 grid origin and per-tile lat/lon delta."""
    minx = transform.c  # west bound, degrees
    maxy = transform.f  # north bound, degrees
    pixel_size_deg = abs(transform.a)  # degrees per pixel (lon)
    pixels_per_tile = max(1, round(TILE_SIZE_M / pixel_size_m))
    return {
        "minx_deg": minx,
        "maxy_deg": maxy,
        "pixel_size_deg": pixel_size_deg,
        "pixel_size_m": pixel_size_m,
        "pixels_per_tile": pixels_per_tile,
        "tile_size_deg": pixels_per_tile * pixel_size_deg,
    }


def osm_points_to_tile_ids(osm_points: list[dict], grid: dict) -> set[str]:
    """Map OSM lat/lon points to tile_ids by integer division."""
    positive_tile_ids = set()
    for p in osm_points:
        # Convert (lat, lon) to (row, col) in the bathy grid
        col = int((p["lon"] - grid["minx_deg"]) / grid["pixel_size_deg"])
        row = int((grid["maxy_deg"] - p["lat"]) / grid["pixel_size_deg"])
        i_col = col // grid["pixels_per_tile"]
        j_row = row // grid["pixels_per_tile"]
        positive_tile_ids.add(f"{i_col}_{j_row}")
    return positive_tile_ids


def features_for_tile(tile: np.ndarray, pixel_size_m: float) -> dict:
    return {
        "residual_rms":  feature_residual_rms(tile),
        "local_relief":  feature_local_relief(tile),
        "slope_std":     feature_slope_std(tile, pixel_size_m),
        "laplacian_std": feature_laplacian_std(tile),
        "coverage_frac": coverage_fraction(tile),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force-redownload", action="store_true",
        help="re-fetch GMRT bathymetry + OSM wrecks even if cached",
    )
    args = parser.parse_args()

    if args.force_redownload:
        for p in [BATHY_PATH, OSM_PATH]:
            if p.exists():
                p.unlink()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Fetch
    bathy_record = fetch_bathymetry()
    osm_record   = fetch_osm_wrecks()

    # 2. Load bathymetry
    print()
    print("loading bathymetry into memory...")
    depth, transform, crs, pixel_size_m = load_bathymetry()
    n_rows, n_cols = depth.shape

    # 3. Compute grid origin and pixels_per_tile
    grid = grid_origin(transform, pixel_size_m, n_rows, n_cols)
    print(f"  grid: pixels_per_tile={grid['pixels_per_tile']} "
          f"(target tile = {TILE_SIZE_M:.0f}m)")

    # 4. Build positive tile id set
    positive_tile_ids = osm_points_to_tile_ids(osm_record["points"], grid)
    print(f"  positive tile ids: {len(positive_tile_ids)}")

    # 5. Iterate tiles
    pp = grid["pixels_per_tile"]
    n_tiles_rows = n_rows // pp
    n_tiles_cols = n_cols // pp
    total = n_tiles_rows * n_tiles_cols
    print(f"  iterating {total} candidate tiles ({n_tiles_cols} x {n_tiles_rows})")

    rows = []
    dropped = 0
    for j in range(n_tiles_rows):
        for i in range(n_tiles_cols):
            tile = depth[j * pp : (j + 1) * pp, i * pp : (i + 1) * pp]
            feats = features_for_tile(tile, pixel_size_m)
            if feats["coverage_frac"] < MIN_COVERAGE_FRAC:
                dropped += 1
                continue
            tile_id = f"{i}_{j}"
            anchor_lon = grid["minx_deg"] + i * grid["tile_size_deg"]
            anchor_lat = grid["maxy_deg"] - (j + 1) * grid["tile_size_deg"]
            rows.append({
                "tile_id":            tile_id,
                "anchor_lat":         float(anchor_lat),
                "anchor_lon":         float(anchor_lon),
                "anchor_x_utm":       float("nan"),
                "anchor_y_utm":       float("nan"),
                "residual_rms":       float(feats["residual_rms"]),
                "local_relief":       float(feats["local_relief"]),
                "slope_std":          float(feats["slope_std"]),
                "laplacian_std":      float(feats["laplacian_std"]),
                "coverage_frac":      float(feats["coverage_frac"]),
                "is_positive_strict": tile_id in positive_tile_ids,
            })

    kept = len(rows)
    n_positive = sum(1 for r in rows if r["is_positive_strict"])
    print(f"  kept={kept}, dropped_coverage={dropped}, positives_in_kept={n_positive}")

    # 6. Persist
    import pyarrow as pa
    import pyarrow.parquet as pq
    pq.write_table(pa.Table.from_pylist(rows), FEATURES_PARQ, compression="zstd")
    print(f"wrote {FEATURES_PARQ.relative_to(ROOT)}")

    with FEATURES_NDJ.open("w", encoding="utf-8") as f:
        for r in rows:
            ocean_row = {k: v for k, v in r.items() if k != "is_positive_strict"}
            f.write(json.dumps(ocean_row, separators=(",", ":")) + "\n")
    print(f"wrote {FEATURES_NDJ.relative_to(ROOT)} ({kept} records)")

    manifest = {
        "region":          REGION_NAME,
        "region_bbox":     REGION_BBOX,
        "tile_size_m":     TILE_SIZE_M,
        "pixel_size_m":    pixel_size_m,
        "synthetic_data":  False,
        "pilot":           True,
        "pilot_note": (
            "Real-data pilot using GMRT GridServer bathymetry (100m resolution) "
            "and OSM Overpass wrecks/obstructions. Spec-grade /mine-sweep run "
            "requires NCEI multibeam BAGs (5m resolution) and NOAA OCS wrecks "
            "(via ENC Direct)."
        ),
        "sources": {
            "bathymetry": bathy_record,
            "labels":     osm_record,
        },
        "n_tiles":         kept,
        "n_positives":     n_positive,
        "harvested_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {MANIFEST_PATH.relative_to(ROOT)}")

    summary = {
        "region":               REGION_NAME,
        "synthetic_data":       False,
        "pilot":                True,
        "n_tiles_kept":         kept,
        "n_tiles_dropped":      dropped,
        "n_positives_strict":   n_positive,
        "positive_rate":        (n_positive / kept) if kept else 0.0,
        "tile_size_m":          TILE_SIZE_M,
        "pixel_size_m":         pixel_size_m,
        "feature_stats": {
            field: {
                "mean": float(np.nanmean([r[field] for r in rows])),
                "std":  float(np.nanstd([r[field] for r in rows])),
                "min":  float(np.nanmin([r[field] for r in rows])),
                "max":  float(np.nanmax([r[field] for r in rows])),
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
