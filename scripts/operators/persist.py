"""Persist operators — pipeline state → JSON artifact + sha256 manifest."""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

from . import Operator, register


@register
class ArtifactWriter(Operator):
    """Write a pipeline-state subset to a JSON artifact with SHA-256 manifest.

    config:
        output:        str — required, path to write JSON
        include_keys:  list[str] — optional, dotted state keys to capture.
                       If absent, captures all state keys except numpy arrays.
    """
    kind = "persist.json"
    stage = "persist"

    def run(self, inputs, *, seed, config):
        path = Path(config["output"])
        path.parent.mkdir(parents=True, exist_ok=True)

        # `inputs` here is the slice the runner passes; the artifact writer
        # is special — it can reach into the full state via `inputs.state`.
        state = inputs.get("state", inputs)
        include = config.get("include_keys")
        if include:
            payload = {k: state[k] for k in include if k in state}
        else:
            payload = {k: v for k, v in state.items()
                       if not k.startswith("_") and _is_jsonable(v)}

        payload_meta = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "seed":         seed,
        }
        full = {"_meta": payload_meta, **payload}
        text = json.dumps(full, indent=2, default=_json_default)
        path.write_text(text, encoding="utf-8")
        sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
        return {"output_path": str(path), "bytes": len(text), "sha256": sha}


def _is_jsonable(v) -> bool:
    if v is None or isinstance(v, (bool, int, float, str)):
        return True
    if isinstance(v, (list, tuple)):
        return True  # let the encoder fall through, with _json_default fallback
    if isinstance(v, dict):
        return True
    # numpy arrays handled in _json_default; let it try
    return True


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
