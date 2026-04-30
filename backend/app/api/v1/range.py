"""Range bridge — internal endpoint that runs the real BTUT pipeline.

Called by the Next.js frontend's /api/range-form when BTUT_BRIDGE_URL
is configured. This wraps run_btut_pipeline with a simple HTTP shape
the frontend expects.

Endpoints:
  GET  /api/v1/range/form/health  -> liveness probe
  POST /api/v1/range/form         -> run BTUT, return per-record fp48s
"""

from __future__ import annotations

import hashlib
import logging
import time
from typing import Any

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/range", tags=["range"])


@router.get("/form/health")
async def health() -> dict[str, Any]:
    """Liveness probe for the BTUT bridge."""
    try:
        # Verify the BTUT module is importable on this container
        from app.services.btut.pipeline import run_btut_pipeline  # noqa: F401
        return {"status": "ok", "btut": "available", "ts": time.time()}
    except Exception as exc:
        return {"status": "degraded", "btut": "unavailable", "detail": str(exc), "ts": time.time()}


@router.post("/form")
async def form(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the real BTUT pipeline on a list of entities.

    Request shape (matches what the Next.js BtutBridgeFingerprinter sends):
      {
        "entities": [{"name": "r0", "type": "record", "attributes": {...}}, ...],
        "edges": [...],
        "target_survivors": 300,
        "n_rotations": 16,
      }

    Response:
      {
        "fingerprints": [
          {"idx": 0, "fp48Hex": "abcd...", "rawHash": "sha256...", "contributing": [...]},
          ...
        ],
        "summary": {<run_btut_pipeline summary fields>},
        "wall_seconds": float,
      }
    """
    entities = payload.get("entities") or []
    edges = payload.get("edges") or []
    target = int(payload.get("target_survivors") or 300)
    rotations = int(payload.get("n_rotations") or 16)

    if not entities:
        raise HTTPException(status_code=400, detail="entities[] required")
    if len(entities) > 5000:
        # protect the bridge — caller should batch
        raise HTTPException(status_code=413, detail="entities[] capped at 5000 per call")

    try:
        from app.services.btut.pipeline import run_btut_pipeline
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"btut not available: {exc}")

    t0 = time.time()
    try:
        result = run_btut_pipeline(
            entities=entities,
            edges=edges,
            unique_types=None,                # auto-detect
            target_survivors=min(target, len(entities)),
            budget_dollars=10.0,              # safe ceiling for bridge calls
            n_rotations=rotations,
        )
    except Exception as exc:
        logger.exception("BTUT pipeline failed in bridge")
        raise HTTPException(status_code=500, detail=f"btut pipeline error: {exc}")
    wall = time.time() - t0

    # Project survivor fingerprints into the bridge's fp48 shape.
    survivors = result.get("survivors", [])
    fingerprints: list[dict[str, Any]] = []
    for surv in survivors:
        fp_str = surv.get("fingerprint_48bit", "")
        # The pipeline emits a binary string of 0/1 over flips; pack it.
        # Take the first 48 bits, pad/truncate as needed.
        bits = fp_str.replace(" ", "")[:48].ljust(48, "0")
        # Convert "0101…" -> hex
        try:
            fp_int = int(bits, 2)
        except Exception:
            fp_int = 0
        fp48hex = f"{fp_int:012x}"

        ent = surv.get("entity", {}) or {}
        # Re-derive a stable record idx from the entity name (e.g. "r123")
        name = str(ent.get("name", ""))
        idx_str = "".join(ch for ch in name if ch.isdigit())
        try:
            idx = int(idx_str) if idx_str else 0
        except Exception:
            idx = 0

        # Canonical raw bytes for sha256: stable JSON of the entity attrs
        import json
        canonical = json.dumps(ent.get("attributes", {}), sort_keys=True, separators=(",", ":"))
        raw_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

        # Contributing fields: top-3 by composite score's denominator
        # (we don't have per-field contribution from the pipeline, so we
        #  return the field names with non-empty values)
        attrs = ent.get("attributes", {}) or {}
        contributing = sorted(
            [k for k, v in attrs.items() if v not in (None, "", [])],
            key=lambda k: -len(str(attrs.get(k, ""))),
        )[:3]

        fingerprints.append({
            "idx": idx,
            "fp48Hex": fp48hex,
            "rawHash": raw_hash,
            "contributing": contributing,
            "scores": surv.get("scores", {}),
            "cluster": surv.get("cluster"),
        })

    return {
        "fingerprints": fingerprints,
        "summary": result.get("summary", {}),
        "wall_seconds": round(wall, 3),
        "bridge_version": "v0.1",
    }
