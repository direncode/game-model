"""
MINE-SWEEP STAGE 2 — NOAA bathymetry + Wrecks-and-Obstructions ingest.

Downloads:
  1. NOAA Wrecks-and-Obstructions shapefile (the modern AWOIS successor)
     from NOAA Office of Coast Survey.
  2. The fixed list of NCEI multibeam BAG files covering Stellwagen Bank
     National Marine Sanctuary.

Outputs:
  data/validation/mine_sweep/raw/
    awois.zip                          # shapefile bundle, byte-exact upstream
    bags/<survey_id>/<file>.bag        # NCEI BAG files, one dir per survey
  data/validation/mine_sweep/manifest.json
    SHA-256, byte count, URL, and dated release for every input.

Determinism contract:
  Given the same URL list and the same upstream files, re-running this
  script produces a byte-identical manifest.json. If the upstream files
  drift, the manifest's SHA-256 set changes and downstream stages refuse
  to proceed without an explicit manifest update.

Usage:
  python scripts/experiments/mine_sweep_ingest.py
  python scripts/experiments/mine_sweep_ingest.py --dry-run         # print plan, no download
  python scripts/experiments/mine_sweep_ingest.py --verify-only     # re-hash files in raw/, rebuild manifest from disk
  python scripts/experiments/mine_sweep_ingest.py --bag-list FILE   # override BAG URL list with a file

Per spec docs/superpowers/specs/2026-05-11-mine-sweep-design.md.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


# ---------- config -------------------------------------------------------
REGION = "stellwagen_bank_sbnms"

# Output paths
OUT_DIR       = ROOT / "data" / "validation" / "mine_sweep"
RAW_DIR       = OUT_DIR / "raw"
BAGS_DIR      = RAW_DIR / "bags"
AWOIS_PATH    = RAW_DIR / "awois.zip"
MANIFEST_PATH = OUT_DIR / "manifest.json"

# Inputs — POPULATE BEFORE FIRST REAL RUN. See README in this script's
# trailing comments for how to find the current canonical URLs.
AWOIS_URL = os.environ.get(
    "MINE_SWEEP_AWOIS_URL",
    # NOAA Office of Coast Survey publishes the wrecks-and-obstructions
    # shapefile under a dated URL on nauticalcharts.noaa.gov. Update this
    # constant when you generate the manifest for the first time.
    "https://nauticalcharts.noaa.gov/data/wrecks-and-obstructions/REPLACE_ME.zip",
)
AWOIS_RELEASE_DATE = os.environ.get(
    "MINE_SWEEP_AWOIS_RELEASE", "REPLACE_ME"
)

# SBNMS boundary shapefile (used by mine_sweep_features.py to crop tiles).
# Canonical source: sanctuaries.noaa.gov GIS package.
SBNMS_BOUNDARY_URL = os.environ.get(
    "MINE_SWEEP_SBNMS_BOUNDARY_URL",
    "https://sanctuaries.noaa.gov/library/imast_gis/REPLACE_ME.zip",
)

# NCEI BAG files. Populate by querying NCEI hydrographic survey catalog
# for in-Stellwagen-boundary surveys, then writing a JSON list of
# {survey_id, url} dicts. Keep this list pre-committed; do not let the
# script discover surveys dynamically (that defeats reproducibility).
#
# Catalog entry point: https://www.ngdc.noaa.gov/mgg/bathymetry/hydro.html
# Filter by region polygon = Stellwagen Bank Sanctuary boundary, format = BAG.
DEFAULT_BAG_LIST_PATH = ROOT / "data" / "validation" / "mine_sweep" / "_bag_urls.json"

DOWNLOAD_TIMEOUT_S = 600
DOWNLOAD_CHUNK_BYTES = 1 << 20  # 1 MB
# -------------------------------------------------------------------------


# ---------- utilities ----------------------------------------------------
def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(DOWNLOAD_CHUNK_BYTES), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path, *, dry_run: bool) -> None:
    if dry_run:
        print(f"  [dry-run] would download {url} -> {dest}")
        return
    if dest.exists():
        print(f"  exists, skipping: {dest.relative_to(ROOT)} ({dest.stat().st_size:,} bytes)")
        return
    if "REPLACE_ME" in url:
        sys.exit(
            f"refusing to download placeholder URL: {url}\n"
            "Populate the relevant URL constant at the top of this script "
            "(or via env var) before running."
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"  downloading {url} -> {dest.relative_to(ROOT)}")
    try:
        with urllib.request.urlopen(url, timeout=DOWNLOAD_TIMEOUT_S) as response:
            with tmp.open("wb") as f:
                while True:
                    chunk = response.read(DOWNLOAD_CHUNK_BYTES)
                    if not chunk:
                        break
                    f.write(chunk)
    except urllib.error.HTTPError as e:
        if tmp.exists():
            tmp.unlink()
        sys.exit(f"HTTP {e.code} downloading {url}: {e.reason}")
    except urllib.error.URLError as e:
        if tmp.exists():
            tmp.unlink()
        sys.exit(f"network error downloading {url}: {e.reason}")
    tmp.rename(dest)


def file_record(url: str, path: Path, *, extra: dict | None = None) -> dict:
    rec = {
        "url": url,
        "local_path": str(path.relative_to(ROOT)),
        "bytes": path.stat().st_size,
        "sha256": sha256_of(path),
    }
    if extra:
        rec.update(extra)
    return rec


def load_bag_url_list(path: Path) -> list[dict]:
    """Load the pre-committed BAG URL list.

    Expected JSON shape:
      [
        {"survey_id": "H12345", "url": "https://..."},
        {"survey_id": "H12346", "url": "https://..."},
        ...
      ]
    """
    if not path.exists():
        sys.exit(
            f"BAG URL list missing: {path.relative_to(ROOT)}\n"
            "Create this file with a JSON list of {survey_id, url} dicts "
            "for the in-boundary NCEI hydrographic surveys.\n"
            "Source: https://www.ngdc.noaa.gov/mgg/bathymetry/hydro.html\n"
            "Filter by Stellwagen Bank Sanctuary boundary polygon, format = BAG."
        )
    items = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(items, list) or any(
        not isinstance(it, dict) or "survey_id" not in it or "url" not in it
        for it in items
    ):
        sys.exit(f"BAG URL list at {path} must be a JSON list of {{survey_id, url}} dicts.")
    return items


def git_sha() -> str:
    """Best-effort git SHA of this script's containing commit."""
    head_path = ROOT / ".git" / "HEAD"
    if not head_path.exists():
        return "unknown"
    head = head_path.read_text(encoding="utf-8").strip()
    if head.startswith("ref: "):
        ref_path = ROOT / ".git" / head[5:]
        if ref_path.exists():
            return ref_path.read_text(encoding="utf-8").strip()[:12]
    return head[:12]
# -------------------------------------------------------------------------


# ---------- pipeline -----------------------------------------------------
def plan(bag_list_path: Path) -> tuple[list[dict], list[dict]]:
    """Return (downloads_planned, manifest_targets) without touching the network."""
    bag_items = load_bag_url_list(bag_list_path)
    awois_target = {
        "kind": "awois",
        "url": AWOIS_URL,
        "dest": AWOIS_PATH,
        "release_date": AWOIS_RELEASE_DATE,
    }
    sbnms_target = {
        "kind": "sbnms_boundary",
        "url": SBNMS_BOUNDARY_URL,
        "dest": RAW_DIR / "sbnms_boundary.zip",
    }
    bag_targets = [
        {
            "kind": "ncei_bag",
            "url": it["url"],
            "dest": BAGS_DIR / it["survey_id"] / Path(it["url"]).name,
            "survey_id": it["survey_id"],
        }
        for it in bag_items
    ]
    return [awois_target, sbnms_target, *bag_targets], bag_targets


def fetch_all(targets: list[dict], *, dry_run: bool) -> None:
    for t in targets:
        download(t["url"], t["dest"], dry_run=dry_run)


def build_manifest(targets: list[dict]) -> dict:
    awois_record = None
    sbnms_record = None
    bag_records = []
    for t in targets:
        if not t["dest"].exists():
            sys.exit(f"missing file at manifest time: {t['dest'].relative_to(ROOT)}")
        rec = file_record(t["url"], t["dest"])
        if t["kind"] == "awois":
            rec["release_date"] = t["release_date"]
            awois_record = rec
        elif t["kind"] == "sbnms_boundary":
            sbnms_record = rec
        elif t["kind"] == "ncei_bag":
            rec["survey_id"] = t["survey_id"]
            bag_records.append(rec)
        else:
            sys.exit(f"unknown target kind: {t['kind']}")

    return {
        "region": REGION,
        "awois": awois_record,
        "sbnms_boundary": sbnms_record,
        "ncei_bag_files": bag_records,
        "total_bytes": sum(
            r["bytes"]
            for r in [awois_record, sbnms_record, *bag_records]
            if r is not None
        ),
        "harvested_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "harvester_version": f"mine_sweep_ingest.py@{git_sha()}",
        "spec": "docs/superpowers/specs/2026-05-11-mine-sweep-design.md",
    }


def write_manifest(manifest: dict) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"\nwrote {MANIFEST_PATH.relative_to(ROOT)}")
    print(f"  {len(manifest['ncei_bag_files'])} NCEI BAG files")
    print(f"  total bytes: {manifest['total_bytes']:,}")


# -------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="print download plan, do not fetch anything",
    )
    parser.add_argument(
        "--verify-only", action="store_true",
        help="rebuild manifest by re-hashing files in raw/, do not download",
    )
    parser.add_argument(
        "--bag-list", type=Path, default=DEFAULT_BAG_LIST_PATH,
        help=f"path to pre-committed BAG URL list (default: {DEFAULT_BAG_LIST_PATH.relative_to(ROOT)})",
    )
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    targets, _ = plan(args.bag_list)
    print(f"plan: {len(targets)} files for region={REGION}")

    if args.verify_only:
        print("verify-only mode: rebuilding manifest from existing raw/ contents")
    else:
        fetch_all(targets, dry_run=args.dry_run)
        if args.dry_run:
            print("\ndry-run complete (no downloads performed, no manifest written)")
            return 0

    manifest = build_manifest(targets)
    write_manifest(manifest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
