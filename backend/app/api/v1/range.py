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


@router.post("/persistence")
async def persistence(payload: dict[str, Any]) -> dict[str, Any]:
    """Compute persistent homology (H0, H1, H2) over a set of 48-bit fingerprints.

    Uses ripser for the Vietoris-Rips persistence diagram with Hamming distance
    as the metric. Returns birth/death pairs per dimension.

    Request:
      {
        "fingerprints": ["abcd012345ef", ...],   # hex strings, 48-bit each
        "max_dim": 2,                            # default 2; H0 H1 H2
        "max_points": 1500,                      # cap input for compute time
      }

    Response:
      {
        "bars": [{"dim": 0|1|2, "birth": float, "death": float}, ...],
        "counts": {"H0": N, "H1": M, "H2": K},
        "metric": "hamming48",
        "n_points": int,
        "wall_seconds": float,
        "library": "ripser",
      }
    """
    fps_hex = payload.get("fingerprints") or []
    if not fps_hex:
        raise HTTPException(status_code=400, detail="fingerprints[] required")
    max_dim = max(0, min(int(payload.get("max_dim") or 2), 2))
    max_points = max(50, min(int(payload.get("max_points") or 1500), 3000))

    # Sample down if needed — ripser memory is O(n^d+1)
    if len(fps_hex) > max_points:
        # Deterministic stride sampling
        stride = len(fps_hex) // max_points
        fps_hex = [fps_hex[i] for i in range(0, len(fps_hex), stride)][:max_points]

    try:
        import numpy as np
        from ripser import ripser
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"persistence libs unavailable: {exc}")

    n = len(fps_hex)
    # Decode hex to 48-bit ints
    try:
        ints = [int(h, 16) & 0xFFFFFFFFFFFF for h in fps_hex]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"bad fingerprint hex: {exc}")

    # Build pairwise Hamming distance matrix (48-bit popcount of XOR)
    t0 = time.time()
    arr = np.array(ints, dtype=np.uint64)
    dist = np.zeros((n, n), dtype=np.float32)
    for i in range(n):
        x = arr[i] ^ arr  # vector XOR
        # popcount each element
        counts = np.zeros(n, dtype=np.uint8)
        for shift in range(48):
            counts += ((x >> shift) & 1).astype(np.uint8)
        dist[i] = counts.astype(np.float32)
    # Symmetric, zero diagonal
    np.fill_diagonal(dist, 0.0)

    # Run ripser on the precomputed distance matrix
    try:
        result = ripser(dist, distance_matrix=True, maxdim=max_dim, thresh=48.0)
    except Exception as exc:
        logger.exception("ripser failed")
        raise HTTPException(status_code=500, detail=f"ripser error: {exc}")

    wall = time.time() - t0
    diagrams = result.get("dgms", [])

    bars: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    for d, dgm in enumerate(diagrams):
        n_bars = 0
        for birth, death in dgm:
            # ripser returns inf for the persistent component; clamp to maxdist
            if not (death == death):  # NaN check
                continue
            if death == float("inf"):
                death_v = 48.0
            else:
                death_v = float(death)
            birth_v = float(birth)
            if death_v <= birth_v:
                continue
            bars.append({"dim": int(d), "birth": birth_v, "death": death_v})
            n_bars += 1
        counts[f"H{d}"] = n_bars

    # Sort: H0 first, then H1, then H2; within each, longest persistence first
    bars.sort(key=lambda b: (b["dim"], -(b["death"] - b["birth"])))

    return {
        "bars": bars,
        "counts": counts,
        "metric": "hamming48",
        "n_points": n,
        "wall_seconds": round(wall, 3),
        "library": "ripser",
        "max_dim": max_dim,
        "thresh": 48.0,
    }
