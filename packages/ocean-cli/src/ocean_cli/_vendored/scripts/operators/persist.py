"""Free-tier persist operator — write pipeline state to a JSON artifact."""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any


class ArtifactWriter:
    """Write a pipeline-state subset to a JSON artifact with SHA-256 manifest.

    config:
        output:        str — required, path to write JSON
        include_keys:  list[str] — optional, dotted state keys to capture.
                       If absent, captures everything except keys starting
                       with `_` (which are reserved for internal bookkeeping).
    """

    kind = "persist.json"
    stage = "persist"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42,
            config: dict | None = None) -> dict[str, Any]:
        config = config or {}
        path = Path(config["output"])
        path.parent.mkdir(parents=True, exist_ok=True)

        # `inputs` is the resolved-by-the-runner slice; that's what we ship.
        include = config.get("include_keys")
        if include:
            payload = {k: inputs[k] for k in include if k in inputs}
        else:
            payload = {k: v for k, v in inputs.items() if not k.startswith("_")}

        payload_meta = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "seed":         seed,
        }
        full = {"_meta": payload_meta, **payload}
        text = json.dumps(full, indent=2, default=_json_default)
        path.write_text(text, encoding="utf-8")
        sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
        return {"output_path": str(path), "bytes": len(text), "sha256": sha}


def _json_default(o):
    try:
        import numpy as np
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, (np.integer, np.floating)):
            return o.item()
    except ImportError:
        pass
    if hasattr(o, "tolist"):
        return o.tolist()
    return str(o)


# ── Per-module registry ──────────────────────────────────────────────────

_REGISTRY: dict[str, Any] = {
    "persist.json": ArtifactWriter(),
}


def get(name: str):
    return _REGISTRY.get(name)
