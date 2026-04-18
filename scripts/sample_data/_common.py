"""Shared helpers for sample-data populators."""
from __future__ import annotations

import json
import random
import shutil
import sys
import time
import traceback
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable

import numpy as np

SEED = 42
REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLES_ROOT = REPO_ROOT / "data" / "samples"
BACKEND_ROOT = REPO_ROOT / "backend"


def ensure_backend_on_path() -> None:
    p = str(BACKEND_ROOT)
    if p not in sys.path:
        sys.path.insert(0, p)


def seed_all() -> None:
    random.seed(SEED)
    np.random.seed(SEED)


def reset_dir(out_dir: Path) -> Path:
    shutil.rmtree(out_dir, ignore_errors=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def write_json(path: Path, payload: Any) -> int:
    """Write JSON with sorted keys and 2-space indent. Returns bytes written."""
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2, sort_keys=True, default=str)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def truncate_array(arr: list, limit: int = 100) -> tuple[list, int | None]:
    if len(arr) <= limit:
        return arr, None
    return arr[:limit], len(arr)


def round_floats(obj: Any, decimals: int = 6) -> Any:
    if isinstance(obj, float):
        return round(obj, decimals)
    if isinstance(obj, dict):
        return {k: round_floats(v, decimals) for k, v in obj.items()}
    if isinstance(obj, list):
        return [round_floats(v, decimals) for v in obj]
    if isinstance(obj, tuple):
        return tuple(round_floats(v, decimals) for v in obj)
    return obj


@dataclass
class FileEntry:
    path: str
    kind: str
    description: str
    size_bytes: int


@dataclass
class InteractEntry:
    purpose: str
    tool: str
    path: str | None = None
    args: dict | None = None


@dataclass
class ManifestEntry:
    name: str
    status: str = "success"
    mode: str = "real"
    skip_reason: str | None = None
    elapsed_ms: int = 0
    files: list[FileEntry] = field(default_factory=list)
    interact_with: list[InteractEntry] = field(default_factory=list)
    error: str | None = None
    traceback: str | None = None


def add_file(entry: ManifestEntry, path: Path, kind: str, description: str) -> None:
    rel = path.relative_to(REPO_ROOT).as_posix()
    size = path.stat().st_size if path.exists() else 0
    entry.files.append(FileEntry(path=rel, kind=kind, description=description, size_bytes=size))


def add_interact(
    entry: ManifestEntry,
    purpose: str,
    tool: str,
    path: str | None = None,
    args: dict | None = None,
) -> None:
    entry.interact_with.append(InteractEntry(purpose=purpose, tool=tool, path=path, args=args))


def run_populator(
    name: str, populator: Callable[[Path], ManifestEntry], mode: str = "real"
) -> ManifestEntry:
    """Wrap populator with seeding, reset, timing, and error capture."""
    seed_all()
    out_dir = reset_dir(SAMPLES_ROOT / name)
    t0 = time.time()
    try:
        entry = populator(out_dir)
    except Exception as e:
        entry = ManifestEntry(
            name=name,
            status="failed",
            mode=mode,
            error=f"{type(e).__name__}: {e}",
            traceback="".join(traceback.format_tb(e.__traceback__)[-10:]),
        )
    entry.elapsed_ms = int((time.time() - t0) * 1000)
    return entry


def manifest_entry_to_dict(e: ManifestEntry) -> dict:
    d = asdict(e)
    for iw in d.get("interact_with", []):
        for k in ("path", "args"):
            if iw.get(k) is None:
                iw.pop(k, None)
    if d.get("skip_reason") is None:
        d.pop("skip_reason", None)
    if d.get("error") is None:
        d.pop("error", None)
        d.pop("traceback", None)
    return d
