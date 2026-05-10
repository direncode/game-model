"""Quick smoke test: BTUT on tiny synthetic data to verify it runs on CPU/Windows
before we commit to the full Test 2 sweep.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.btut import BTUTTuner, BTUTConfig
from app.services.btut.config import CascadeLevel


def main():
    rng = np.random.default_rng(42)
    n = 200
    entities = []
    edges = []
    for i in range(n):
        entities.append({
            "name": f"e{i}",
            "type": "doc",
            "attributes": {
                "title": f"Synthetic doc {i}",
                "text": f"keyword_{i % 7} text content {rng.integers(0, 100)}",
            },
        })
    for i in range(n):
        for j in rng.choice(n, size=4, replace=False):
            if int(j) == i:
                continue
            edges.append({
                "source": f"e{i}",
                "target": f"e{int(j)}",
                "type": "knn",
                "weight": float(rng.random()),
            })

    cfg = BTUTConfig.auto_scale(entity_count=n)
    cfg.prefilter_enabled = False
    cfg.cascade_levels = [
        CascadeLevel(sigma=1.5, thinning_ratio=4, max_iterations=5, min_iterations=2),
    ]
    cfg.bootstrap_runs = 1
    cfg.min_coverage = 0.0
    cfg.max_recon_error = 1.0
    cfg.quality_gate_between_levels = False
    cfg.min_entities_floor = 20

    print(f"smoke: n={n} entities, {len(edges)} edges, target_ratio=4x")
    print(f"device: {cfg.resolve_device()}")

    tuner = BTUTTuner(cfg)
    res = asyncio.run(tuner.tune(entities, edges, job_id="smoke"))
    print(f"survivors: {len(res.survivors)} / {n}")
    print(f"survivor_edges: {len(res.survivor_edges)}")
    print(f"actual ratio: {n / max(1, len(res.survivors)):.2f}x")
    if res.survivors:
        print(f"first survivor: {res.survivors[0] if isinstance(res.survivors[0], dict) else type(res.survivors[0]).__name__}")
    print("OK")


if __name__ == "__main__":
    main()
