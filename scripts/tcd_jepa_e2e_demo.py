#!/usr/bin/env python3
"""End-to-end TCD-JEPA vertical demo — runs locally without a server.

Demonstrates the full pipeline:
  BTUT survivors -> ingest -> crystallize (mocked wrapper) -> interpret ->
  register -> route -> export

Usage:
    cd backend && python ../scripts/tcd_jepa_e2e_demo.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock

import numpy as np

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))


def _make_demo_survivors(n: int = 50, d: int = 8) -> dict:
    """Simulate a BTUT pipeline dict with clustered survivors."""
    rng = np.random.RandomState(42)
    # 3 clusters in 8D space
    centers = rng.randn(3, d).astype(np.float32) * 3
    cluster_sizes = [20, 15, 15]
    embeddings = []
    survivors = []
    for ci, (center, size) in enumerate(zip(centers, cluster_sizes)):
        pts = center + rng.randn(size, d).astype(np.float32) * 0.5
        embeddings.append(pts)
        for j in range(size):
            survivors.append({
                "entity": {"name": f"entity_{ci}_{j}"},
                "cluster": ci,
                "scores": {"composite": float(rng.uniform(0.5, 1.0))},
            })
    flat_emb = np.vstack(embeddings).flatten().tolist()
    return {
        "summary": {"survivors": n, "variance_preservation": 0.93},
        "survivors": survivors,
        "embeddings_8d": flat_emb,
    }


def _make_mock_wrapper() -> AsyncMock:
    """Mock TCDJEPAWrapper that returns 3 typed modules."""
    wrapper = AsyncMock()
    wrapper.run_training = AsyncMock(return_value={
        "checkpoint_path": "/tmp/demo_ckpt.pt",
        "final_loss": 0.018,
    })
    wrapper.extract_modules = AsyncMock(return_value=[
        {
            "id": "mod-attractor-0",
            "module_type": "attractor",
            "centroid": np.random.RandomState(1).randn(8).tolist(),
            "members": [f"entity_0_{i}" for i in range(20)],
            "purity": 0.94,
            "quality_score": 0.89,
        },
        {
            "id": "mod-cycle-1",
            "module_type": "cycle",
            "centroid": np.random.RandomState(2).randn(8).tolist(),
            "members": [f"entity_1_{i}" for i in range(15)],
            "purity": 0.87,
            "quality_score": 0.82,
        },
        {
            "id": "mod-boundary-2",
            "module_type": "boundary",
            "centroid": np.random.RandomState(3).randn(8).tolist(),
            "members": [f"entity_2_{i}" for i in range(15)],
            "purity": 0.91,
            "quality_score": 0.85,
        },
    ])
    return wrapper


async def run_demo():
    from app.services.crystallization.btut_bridge import from_pipeline_dict
    from app.services.crystallization.vertical import TCDJEPAVertical
    from app.services.crystallization.vertical_types import VerticalPreset
    from app.services.crystallization.routing import route_signal
    from app.services.crystallization.export import to_json, to_pytorch_bundle

    print("=" * 70)
    print("  TCD-JEPA VERTICAL — END-TO-END DEMO")
    print("=" * 70)

    # ── Step 1: Simulate BTUT output ─────────────────────────────────
    print("\n[1/7] Generating demo BTUT survivors (50 entities, 3 clusters, 8D)...")
    btut_dict = _make_demo_survivors()
    bundle = from_pipeline_dict(btut_dict)
    print(f"      Bundle: {bundle.embeddings.shape[0]} survivors, {bundle.embeddings.shape[1]}D embeddings")
    print(f"      Metadata: variance_preservation={bundle.metadata.get('variance_preservation')}")

    # ── Step 2: Create vertical ──────────────────────────────────────
    print("\n[2/7] Creating TCDJEPAVertical (preset=TRADING)...")
    vertical = TCDJEPAVertical(
        preset=VerticalPreset.TRADING,
        wrapper=_make_mock_wrapper(),
    )
    print(f"      Preset: T={vertical.config.langevin_temperature}, "
          f"steps={vertical.config.langevin_steps}, "
          f"prune={vertical.config.prune_threshold}, "
          f"max_modules={vertical.config.max_modules}")

    # ── Step 3: Ingest ───────────────────────────────────────────────
    print("\n[3/7] Ingesting BTUT bundle...")
    vertical.ingest_btut(bundle)
    print(f"      Ingested {bundle.embeddings.shape[0]} survivors")

    # ── Step 4: Crystallize ──────────────────────────────────────────
    print("\n[4/7] Running crystallization (mocked wrapper)...")
    modules = await vertical.crystallize()
    print(f"      Crystallized {len(modules)} modules:")
    for m in modules:
        print(f"        - {m.id}: type={m.module_type}, purity={m.purity:.2f}, "
              f"quality={m.quality_score:.2f}, {len(m.members)} members")

    # ── Step 5: Interpret ────────────────────────────────────────────
    print("\n[5/7] Interpreting modules (no interpretation_fn -> passthrough)...")
    annotated = await vertical.interpret(modules)
    print(f"      {len(annotated)} modules annotated")

    # ── Step 6: Route ────────────────────────────────────────────────
    print("\n[6/7] Routing a test signal against the module registry...")
    test_signal = np.random.RandomState(99).randn(8).astype(np.float32)
    decisions = route_signal(test_signal, modules, top_k=3)
    print(f"      Top-3 routing decisions:")
    for d in decisions:
        print(f"        - module={d.module_id}, score={d.score:.4f}, reason={d.reason}")

    # ── Step 7: Export ───────────────────────────────────────────────
    print("\n[7/7] Exporting best module...")
    best = modules[0]
    json_blob = to_json(best)
    pt_blob = to_pytorch_bundle(best)
    manifest = json.loads(json_blob)
    print(f"      JSON manifest ({len(json_blob)} bytes):")
    print(f"        id={manifest['id']}, vertical={manifest['vertical']}, "
          f"purity={manifest['purity']}, format_version={manifest['format_version']}")
    print(f"      PyTorch bundle: {len(pt_blob)} bytes")

    print("\n" + "=" * 70)
    print("  DEMO COMPLETE — full pipeline executed successfully")
    print("=" * 70)
    print("\n  Pipeline: BTUT survivors -> ingest -> crystallize -> interpret -> route -> export")
    print(f"  Modules: {len(modules)} crystallized, 3 types (attractor/cycle/boundary)")
    print(f"  Best route: {decisions[0].module_id} (score={decisions[0].score:.4f})")
    print(f"  Export: JSON ({len(json_blob)}B) + PyTorch ({len(pt_blob)}B)")
    print()


if __name__ == "__main__":
    asyncio.run(run_demo())
