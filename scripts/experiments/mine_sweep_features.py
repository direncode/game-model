"""
MINE-SWEEP STAGE 3 — bathymetry tile feature extraction.

Reads:
  data/validation/mine_sweep/manifest.json
  data/validation/mine_sweep/raw/bags/<survey>/<file>.bag
  data/validation/mine_sweep/raw/awois.zip
  data/validation/mine_sweep/raw/sbnms_boundary.zip

Writes:
  data/validation/mine_sweep/features.parquet      # one row per in-boundary tile
  data/validation/mine_sweep/features.ndjson       # OCEAN-compatible projection
  data/validation/mine_sweep/features_summary.json # tile count, positive count, feature stats

Per-tile schema:
  tile_id          str    deterministic id "i_j" from grid index
  anchor_lat       float  tile SW-corner latitude (WGS84)
  anchor_lon       float  tile SW-corner longitude (WGS84)
  anchor_x_utm     float  tile SW-corner UTM-19N easting (meters)
  anchor_y_utm     float  tile SW-corner UTM-19N northing (meters)
  residual_rms     float  RMS of depth after planar detrend
  local_relief     float  max(depth) - min(depth) within tile
  slope_std        float  std of pixel-wise slope magnitude (dimensionless)
  laplacian_std    float  std of discrete Laplacian
  coverage_frac    float  fraction of tile pixels with valid depth data
  is_positive_strict bool  at least one AWOIS point falls inside this tile

Determinism contract:
  Given the same manifest and the same raw/ contents, re-running produces
  byte-identical features.parquet and features.ndjson. The grid origin is
  derived from the SBNMS boundary's SW corner snapped down to a 50m
  multiple in UTM-19N, so the tile grid is reproducible.

The four feature-math functions at the top of this file are pure NumPy
operations on a 2D depth tile and can be unit-tested independently of
the I/O machinery below.

Per spec docs/superpowers/specs/2026-05-11-mine-sweep-design.md.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]


# ---------- config -------------------------------------------------------
TILE_SIZE_M       = 50.0       # square tiles, 50m on a side
GRID_PROJECTION  = "EPSG:32619"  # UTM zone 19N, covers Stellwagen Bank
MIN_COVERAGE_FRAC = 0.90        # drop tiles with <90% valid pixels

# Output paths
OUT_DIR        = ROOT / "data" / "validation" / "mine_sweep"
MANIFEST_PATH  = OUT_DIR / "manifest.json"
RAW_DIR        = OUT_DIR / "raw"
FEATURES_PARQ  = OUT_DIR / "features.parquet"
FEATURES_NDJ   = OUT_DIR / "features.ndjson"
SUMMARY_PATH   = OUT_DIR / "features_summary.json"
# -------------------------------------------------------------------------


# =========================================================================
# Pure feature-math — unit-testable on a 2D numpy array, no I/O.
# =========================================================================
def feature_residual_rms(tile: np.ndarray) -> float:
    """RMS of depth after subtracting a least-squares planar fit.

    `tile` is a 2D float array; NaN values are excluded from the fit.
    Captures "bumpier than a tilted surface would explain."
    """
    h, w = tile.shape
    ys, xs = np.indices((h, w))
    valid = np.isfinite(tile)
    if valid.sum() < 4:
        return float("nan")
    x = xs[valid].astype(np.float64)
    y = ys[valid].astype(np.float64)
    z = tile[valid].astype(np.float64)
    # Solve z = a + b*x + c*y in least-squares sense
    A = np.column_stack([np.ones_like(x), x, y])
    coeffs, *_ = np.linalg.lstsq(A, z, rcond=None)
    fitted = coeffs[0] + coeffs[1] * x + coeffs[2] * y
    residual = z - fitted
    return float(math.sqrt(np.mean(residual ** 2)))


def feature_local_relief(tile: np.ndarray) -> float:
    """max(depth) - min(depth) within the tile. Captures spike-like features."""
    valid = tile[np.isfinite(tile)]
    if valid.size == 0:
        return float("nan")
    return float(valid.max() - valid.min())


def feature_slope_std(tile: np.ndarray, pixel_size_m: float) -> float:
    """Std of pixel-wise slope magnitude (rise/run in same length units).

    Slope = sqrt((dz/dx)^2 + (dz/dy)^2). Gradients computed via central
    differences with `pixel_size_m` as the spacing. NaN-bearing rows are
    excluded from the std.
    """
    if pixel_size_m <= 0:
        raise ValueError("pixel_size_m must be positive")
    dzdy, dzdx = np.gradient(tile, pixel_size_m, pixel_size_m)
    slope = np.sqrt(dzdx ** 2 + dzdy ** 2)
    valid = slope[np.isfinite(slope)]
    if valid.size < 2:
        return float("nan")
    return float(np.std(valid))


def feature_laplacian_std(tile: np.ndarray) -> float:
    """Std of the 4-neighbor discrete Laplacian.

    Approximation: L(i,j) = tile(i+1,j) + tile(i-1,j) + tile(i,j+1)
                          + tile(i,j-1) - 4*tile(i,j)
    Computed only on the interior of the tile (no edge stencils).
    """
    h, w = tile.shape
    if h < 3 or w < 3:
        return float("nan")
    interior = tile[1:-1, 1:-1]
    up    = tile[:-2, 1:-1]
    down  = tile[2:, 1:-1]
    left  = tile[1:-1, :-2]
    right = tile[1:-1, 2:]
    lap = up + down + left + right - 4 * interior
    valid = lap[np.isfinite(lap)]
    if valid.size < 2:
        return float("nan")
    return float(np.std(valid))


def coverage_fraction(tile: np.ndarray) -> float:
    """Fraction of pixels in tile that are not NaN."""
    if tile.size == 0:
        return 0.0
    return float(np.isfinite(tile).sum()) / float(tile.size)


def features_for_tile(tile: np.ndarray, pixel_size_m: float) -> dict:
    """Compute all four features for one tile. Returns NaNs for sparse tiles."""
    return {
        "residual_rms":  feature_residual_rms(tile),
        "local_relief":  feature_local_relief(tile),
        "slope_std":     feature_slope_std(tile, pixel_size_m),
        "laplacian_std": feature_laplacian_std(tile),
        "coverage_frac": coverage_fraction(tile),
    }


# =========================================================================
# I/O — depends on rasterio + geopandas + pyarrow being installed.
# =========================================================================
def require_geo_deps():
    """Import rasterio, geopandas, pyarrow at runtime. Helpful error if missing."""
    missing = []
    try:
        import rasterio  # noqa: F401
        import rasterio.warp  # noqa: F401
        import rasterio.merge  # noqa: F401
    except ImportError:
        missing.append("rasterio")
    try:
        import geopandas  # noqa: F401
    except ImportError:
        missing.append("geopandas")
    try:
        import pyarrow  # noqa: F401
    except ImportError:
        missing.append("pyarrow")
    if missing:
        sys.exit(
            f"missing geospatial deps: {', '.join(missing)}\n"
            "Install in the venv via: pip install rasterio geopandas pyarrow shapely"
        )


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        sys.exit(
            f"manifest missing: {MANIFEST_PATH.relative_to(ROOT)}\n"
            "Run scripts/experiments/mine_sweep_ingest.py first."
        )
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def load_sbnms_boundary_utm():
    """Load the SBNMS boundary polygon, reprojected to UTM-19N."""
    import geopandas as gpd
    import zipfile

    boundary_zip = ROOT / load_manifest()["sbnms_boundary"]["local_path"]
    # Find the .shp inside the zip; assume one top-level shapefile.
    with zipfile.ZipFile(boundary_zip) as zf:
        shp_names = [n for n in zf.namelist() if n.lower().endswith(".shp")]
        if not shp_names:
            sys.exit(f"no .shp found inside {boundary_zip.relative_to(ROOT)}")
        # geopandas can read from a zip path directly
        gdf = gpd.read_file(f"zip://{boundary_zip}!{shp_names[0]}")
    return gdf.to_crs(GRID_PROJECTION)


def load_awois_points_utm():
    """Load AWOIS wreck/obstruction points, reprojected to UTM-19N."""
    import geopandas as gpd
    import zipfile

    awois_zip = ROOT / load_manifest()["awois"]["local_path"]
    with zipfile.ZipFile(awois_zip) as zf:
        shp_names = [n for n in zf.namelist() if n.lower().endswith(".shp")]
        if not shp_names:
            sys.exit(f"no .shp found inside {awois_zip.relative_to(ROOT)}")
        gdf = gpd.read_file(f"zip://{awois_zip}!{shp_names[0]}")
    return gdf.to_crs(GRID_PROJECTION)


def grid_origin_for_boundary(boundary_gdf) -> tuple[float, float]:
    """Return the (origin_x, origin_y) tile-grid anchor in UTM-19N.

    Snaps the boundary's SW corner DOWN to a TILE_SIZE_M multiple so that
    the tile grid is reproducible across runs.
    """
    minx, miny, _, _ = boundary_gdf.total_bounds
    origin_x = math.floor(minx / TILE_SIZE_M) * TILE_SIZE_M
    origin_y = math.floor(miny / TILE_SIZE_M) * TILE_SIZE_M
    return float(origin_x), float(origin_y)


def build_mosaic(bag_paths: list[Path]):
    """Mosaic the listed BAG files into a single in-memory raster in UTM-19N.

    Returns (mosaic_array, transform, pixel_size_m). The mosaic is at a
    single resolution; if input BAGs have different resolutions, the
    mosaic uses the COARSEST resolution to avoid synthetic upsampling.
    """
    import rasterio
    from rasterio.merge import merge
    from rasterio.warp import calculate_default_transform, reproject, Resampling

    if not bag_paths:
        sys.exit("no BAG files to mosaic")

    # Open all sources, reproject to GRID_PROJECTION individually, then merge.
    # rasterio.merge.merge handles overlapping pixels by taking the first
    # source (deterministic if bag_paths is sorted).
    sources = []
    for p in sorted(bag_paths):
        try:
            src = rasterio.open(p)
        except Exception as e:
            sys.exit(f"failed to open BAG {p}: {e}")
        sources.append(src)

    # Find the coarsest pixel size across sources, in GRID_PROJECTION.
    pixel_sizes = []
    for s in sources:
        # Approximate post-reproject pixel size via the source resolution
        # plus a CRS-distance estimate. For Stellwagen latitudes this is
        # close enough; downstream tile math uses the mosaic's actual
        # transform.
        pixel_sizes.append(abs(s.transform.a))
    target_res = max(pixel_sizes)

    # Reproject each source to GRID_PROJECTION at target_res and merge.
    reprojected_paths = []
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        for i, src in enumerate(sources):
            transform, width, height = calculate_default_transform(
                src.crs, GRID_PROJECTION, src.width, src.height,
                *src.bounds, resolution=target_res,
            )
            tmp_path = Path(tmpdir) / f"reproj_{i}.tif"
            with rasterio.open(
                tmp_path, "w",
                driver="GTiff",
                height=height, width=width,
                count=1, dtype=np.float32,
                crs=GRID_PROJECTION, transform=transform,
                nodata=np.nan,
            ) as dst:
                reproject(
                    source=rasterio.band(src, 1),
                    destination=rasterio.band(dst, 1),
                    src_transform=src.transform, src_crs=src.crs,
                    dst_transform=transform, dst_crs=GRID_PROJECTION,
                    resampling=Resampling.bilinear,
                    src_nodata=src.nodata, dst_nodata=np.nan,
                )
            reprojected_paths.append(tmp_path)

        # Close sources before merge reopens.
        for s in sources:
            s.close()

        # Merge reprojected rasters
        merged_sources = [rasterio.open(p) for p in reprojected_paths]
        mosaic, mosaic_transform = merge(merged_sources, nodata=np.nan)
        for s in merged_sources:
            s.close()

    pixel_size_m = abs(mosaic_transform.a)
    return mosaic[0], mosaic_transform, pixel_size_m


def iterate_tiles(mosaic: np.ndarray, transform, origin_x: float, origin_y: float,
                  boundary_gdf, pixel_size_m: float):
    """Yield (tile_id, anchor_x_utm, anchor_y_utm, tile_pixels) for each
    in-boundary tile.

    Walks a TILE_SIZE_M grid anchored at (origin_x, origin_y). For each
    tile, reads the corresponding window of `mosaic` and yields the
    pixel array (NaN where no coverage).
    """
    from rasterio.windows import Window
    from shapely.geometry import box

    # Mosaic bounds in UTM-19N
    n_rows, n_cols = mosaic.shape
    mosaic_minx = transform.c
    mosaic_maxy = transform.f
    mosaic_maxx = mosaic_minx + n_cols * pixel_size_m
    mosaic_miny = mosaic_maxy - n_rows * pixel_size_m

    # Boundary union polygon for point-in-polygon test
    boundary_union = boundary_gdf.unary_union

    pixels_per_tile = max(1, round(TILE_SIZE_M / pixel_size_m))

    # Walk the tile grid covering the mosaic's bounding box
    j = 0
    y = origin_y
    while y < mosaic_maxy:
        i = 0
        x = origin_x
        while x < mosaic_maxx:
            tile_box = box(x, y, x + TILE_SIZE_M, y + TILE_SIZE_M)
            if tile_box.intersects(boundary_union):
                # Convert tile UTM bbox to mosaic pixel window
                col_off = int(round((x - mosaic_minx) / pixel_size_m))
                row_off = int(round((mosaic_maxy - (y + TILE_SIZE_M)) / pixel_size_m))
                if 0 <= col_off and col_off + pixels_per_tile <= n_cols \
                   and 0 <= row_off and row_off + pixels_per_tile <= n_rows:
                    tile_pixels = mosaic[
                        row_off : row_off + pixels_per_tile,
                        col_off : col_off + pixels_per_tile,
                    ]
                    yield (f"{i}_{j}", float(x), float(y), tile_pixels)
            i += 1
            x += TILE_SIZE_M
        j += 1
        y += TILE_SIZE_M


def utm_to_wgs84(x: float, y: float, from_crs: str = GRID_PROJECTION):
    """Reproject a single point UTM-19N -> WGS84 (lon, lat)."""
    from pyproj import Transformer
    transformer = Transformer.from_crs(from_crs, "EPSG:4326", always_xy=True)
    lon, lat = transformer.transform(x, y)
    return float(lon), float(lat)


def index_awois_to_grid(awois_gdf, origin_x: float, origin_y: float) -> set[str]:
    """Return the set of tile_ids that contain at least one AWOIS point."""
    positive_tile_ids = set()
    for _, row in awois_gdf.iterrows():
        pt = row.geometry
        if pt is None or pt.is_empty:
            continue
        i = int((pt.x - origin_x) // TILE_SIZE_M)
        j = int((pt.y - origin_y) // TILE_SIZE_M)
        positive_tile_ids.add(f"{i}_{j}")
    return positive_tile_ids


# =========================================================================
# Main
# =========================================================================
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=None,
        help="optional cap on number of tiles processed (for smoke testing)",
    )
    parser.add_argument(
        "--ndjson-only", action="store_true",
        help="skip parquet write, useful when pyarrow is unavailable",
    )
    args = parser.parse_args()

    require_geo_deps()
    import pyarrow as pa
    import pyarrow.parquet as pq

    manifest = load_manifest()
    bag_paths = [ROOT / b["local_path"] for b in manifest["ncei_bag_files"]]
    if not bag_paths:
        sys.exit("manifest has no NCEI BAG files; cannot compute features.")
    print(f"loaded manifest: {len(bag_paths)} BAG files, region={manifest['region']}")

    print("loading SBNMS boundary...")
    boundary_gdf = load_sbnms_boundary_utm()
    print("loading AWOIS points...")
    awois_gdf = load_awois_points_utm()
    # Filter AWOIS to in-boundary points only
    awois_in = awois_gdf[awois_gdf.geometry.within(boundary_gdf.unary_union)]
    print(f"  AWOIS in-boundary: {len(awois_in)} of {len(awois_gdf)}")

    print("mosaicing BAGs...")
    mosaic, transform, pixel_size_m = build_mosaic(bag_paths)
    print(f"  mosaic shape: {mosaic.shape}, pixel size: {pixel_size_m:.2f}m")

    origin_x, origin_y = grid_origin_for_boundary(boundary_gdf)
    print(f"  grid origin (UTM-19N): ({origin_x:.0f}, {origin_y:.0f})")

    positive_tile_ids = index_awois_to_grid(awois_in, origin_x, origin_y)
    print(f"  positive tile ids (strict): {len(positive_tile_ids)}")

    rows = []
    kept = 0
    dropped_coverage = 0
    for n, (tile_id, x, y, tile_pixels) in enumerate(
        iterate_tiles(mosaic, transform, origin_x, origin_y, boundary_gdf, pixel_size_m)
    ):
        feats = features_for_tile(tile_pixels, pixel_size_m)
        if feats["coverage_frac"] < MIN_COVERAGE_FRAC:
            dropped_coverage += 1
            if args.limit is not None and n >= args.limit:
                break
            continue
        lon, lat = utm_to_wgs84(x, y)
        rows.append({
            "tile_id":            tile_id,
            "anchor_lat":         lat,
            "anchor_lon":         lon,
            "anchor_x_utm":       x,
            "anchor_y_utm":       y,
            "residual_rms":       feats["residual_rms"],
            "local_relief":       feats["local_relief"],
            "slope_std":          feats["slope_std"],
            "laplacian_std":      feats["laplacian_std"],
            "coverage_frac":      feats["coverage_frac"],
            "is_positive_strict": tile_id in positive_tile_ids,
        })
        kept += 1
        if kept % 5000 == 0:
            print(f"  ... {kept} tiles kept ({dropped_coverage} dropped for coverage)")
        if args.limit is not None and kept >= args.limit:
            break

    print(f"\ntile counts: kept={kept}, dropped_coverage={dropped_coverage}")

    n_positive = sum(1 for r in rows if r["is_positive_strict"])
    print(f"positives in kept tiles: {n_positive}")

    # Write parquet
    if not args.ndjson_only:
        FEATURES_PARQ.parent.mkdir(parents=True, exist_ok=True)
        table = pa.Table.from_pylist(rows)
        pq.write_table(table, FEATURES_PARQ, compression="zstd")
        print(f"wrote {FEATURES_PARQ.relative_to(ROOT)}")

    # Write NDJSON (OCEAN-compatible projection)
    FEATURES_NDJ.parent.mkdir(parents=True, exist_ok=True)
    with FEATURES_NDJ.open("w", encoding="utf-8") as f:
        for r in rows:
            # Drop the held-out label from the OCEAN-visible projection so
            # the substrate cannot accidentally see it.
            ocean_row = {k: v for k, v in r.items() if k != "is_positive_strict"}
            f.write(json.dumps(ocean_row, separators=(",", ":")) + "\n")
    print(f"wrote {FEATURES_NDJ.relative_to(ROOT)} ({kept} records)")

    # Write summary
    summary = {
        "region": manifest["region"],
        "n_tiles_kept":         kept,
        "n_tiles_dropped_coverage": dropped_coverage,
        "n_positives_strict":   n_positive,
        "positive_rate":        (n_positive / kept) if kept else 0.0,
        "tile_size_m":          TILE_SIZE_M,
        "pixel_size_m":         pixel_size_m,
        "grid_origin_utm":      [origin_x, origin_y],
        "grid_projection":      GRID_PROJECTION,
        "manifest_sha_inputs":  {
            "awois":          manifest["awois"]["sha256"],
            "sbnms_boundary": manifest["sbnms_boundary"]["sha256"],
            "ncei_bag_files": [b["sha256"] for b in manifest["ncei_bag_files"]],
        },
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
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {SUMMARY_PATH.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
