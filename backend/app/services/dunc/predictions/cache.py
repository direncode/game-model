"""Filesystem cache for prediction model artifacts and data."""

from __future__ import annotations

import json
import logging
import pickle
import time
from pathlib import Path

logger = logging.getLogger(__name__)

_DEFAULT_DIR = Path(__file__).resolve().parents[4] / ".cache" / "dunc_predictions"


class ArtifactCache:
    """Simple filesystem cache for model weights, scalers, and data."""

    def __init__(self, cache_dir: Path | None = None) -> None:
        self.dir = cache_dir or _DEFAULT_DIR
        self.dir.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str, ext: str = ".json") -> Path:
        return self.dir / f"{key}{ext}"

    def save_json(self, key: str, data: dict | list) -> None:
        path = self._path(key)
        path.write_text(json.dumps(data, default=str), encoding="utf-8")

    def load_json(self, key: str) -> dict | list | None:
        path = self._path(key)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def save_pickle(self, key: str, obj: object) -> None:
        path = self._path(key, ext=".pkl")
        with open(path, "wb") as f:
            pickle.dump(obj, f)

    def load_pickle(self, key: str) -> object | None:
        path = self._path(key, ext=".pkl")
        if not path.exists():
            return None
        with open(path, "rb") as f:
            return pickle.load(f)

    def is_stale(self, key: str, max_age_hours: float = 24.0) -> bool:
        for ext in (".json", ".pkl"):
            path = self._path(key, ext=ext)
            if path.exists():
                age_hours = (time.time() - path.stat().st_mtime) / 3600
                return age_hours > max_age_hours
        return True
