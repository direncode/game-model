"""Serialize a BTUTSurvivorBundle to a temp directory + YAML config.

This bridges the gap between the facade's in-memory BTUTSurvivorBundle
and the TCDJEPAWrapper.run_training() which expects file paths. The
generated directory is self-contained — a YAML config pointing at a
numpy adjacency file + feature file that train_graph.py can consume.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import yaml

from .presets import PresetConfig
from .vertical_types import BTUTSurvivorBundle


def serialize_bundle(
    bundle: BTUTSurvivorBundle,
    preset: PresetConfig,
    *,
    output_dir: str | None = None,
) -> tuple[str, str]:
    """Write a BTUTSurvivorBundle to disk for TCDJEPAWrapper consumption.

    Args:
        bundle: The survivor bundle to crystallize.
        preset: Vertical preset config (drives Langevin hyperparams).
        output_dir: Optional directory. Created via tempfile if None.

    Returns:
        (config_path, data_dir) — the two arguments run_training expects.
    """
    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="tcd_vertical_")
    data_dir = os.path.join(output_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    # ── Write embeddings ─────────────────────────────────────────────
    np.save(os.path.join(data_dir, "features.npy"), bundle.embeddings)

    # ── Write edge list (COO format) ─────────────────────────────────
    if bundle.edges:
        src = [e[0] for e in bundle.edges]
        dst = [e[1] for e in bundle.edges]
        weight = [e[2] for e in bundle.edges]
        edges_array = np.array([src, dst, weight], dtype=np.float32)
    else:
        edges_array = np.zeros((3, 0), dtype=np.float32)
    np.save(os.path.join(data_dir, "edges.npy"), edges_array)

    # ── Write entity IDs ─────────────────────────────────────────────
    with open(os.path.join(data_dir, "entity_ids.txt"), "w") as f:
        for eid in bundle.ids:
            f.write(eid + "\n")

    # ── Write metadata JSON ──────────────────────────────────────────
    import json
    with open(os.path.join(data_dir, "metadata.json"), "w") as f:
        json.dump(bundle.metadata, f)

    # ── Generate training config YAML ────────────────────────────────
    config: dict[str, Any] = {
        "data_path": data_dir,
        "num_nodes": int(bundle.embeddings.shape[0]),
        "feature_dim": int(bundle.embeddings.shape[1]),
        "edge_file": os.path.join(data_dir, "edges.npy"),
        "feature_file": os.path.join(data_dir, "features.npy"),
        # Langevin dynamics from preset
        "langevin_temperature": float(preset.langevin_temperature),
        "langevin_steps": int(preset.langevin_steps),
        "langevin_noise_scale": float(preset.langevin_noise_scale),
        # Topology from preset
        "homology_max_dim": int(preset.homology_max_dim),
        "prune_threshold": float(preset.prune_threshold),
        "max_modules": int(preset.max_modules),
        # Training defaults (overridable)
        "epochs": 50,
        "learning_rate": 1e-3,
        "batch_size": min(64, bundle.embeddings.shape[0]),
        "tcd": True,
    }
    config_path = os.path.join(output_dir, "tcd_config.yaml")
    with open(config_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False)

    return config_path, data_dir
