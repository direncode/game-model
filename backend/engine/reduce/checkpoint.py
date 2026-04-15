"""Tier 7: Checkpoint/resume — save and restore BTUT cascade state.

Enables crash recovery by persisting:
- Current cascade level + step within level
- Evolved point states + densities
- Convergence history + budget spent
- Entity-to-index mapping

State is saved to JSON (metadata) + .npy (arrays) every N steps.
On resume, the tuner restarts from the exact cascade level and step.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from .config import BTUTConfig

logger = logging.getLogger(__name__)


@dataclass
class BTUTCheckpointState:
    """Serializable snapshot of BTUT cascade state."""

    cascade_level: int = 0
    step_within_level: int = 0
    survivor_count: int = 0
    survivor_indices: list[int] = field(default_factory=list)
    convergence_history: list[float] = field(default_factory=list)
    budget_spent_seconds: float = 0.0
    prefilter_complete: bool = False
    embedding_complete: bool = False
    timestamp: float = 0.0

    # Paths to saved arrays (set during save)
    states_path: str = ""
    densities_path: str = ""

    def to_dict(self) -> dict:
        return {
            "cascade_level": self.cascade_level,
            "step_within_level": self.step_within_level,
            "survivor_count": self.survivor_count,
            "survivor_indices": self.survivor_indices,
            "convergence_history": self.convergence_history,
            "budget_spent_seconds": self.budget_spent_seconds,
            "prefilter_complete": self.prefilter_complete,
            "embedding_complete": self.embedding_complete,
            "timestamp": self.timestamp,
            "states_path": self.states_path,
            "densities_path": self.densities_path,
        }

    @classmethod
    def from_dict(cls, d: dict) -> BTUTCheckpointState:
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


class CheckpointManager:
    """Manages BTUT checkpoint save/load for crash recovery.

    Checkpoints are written to:
        {checkpoint_dir}/{job_id}/level_{L}_step_{S}/
            metadata.json   — scalar fields + paths
            states.npy       — (N, D) evolved point positions
            densities.npy    — (N,) density values
    """

    def __init__(self, config: BTUTConfig, job_id: str = "default"):
        self.config = config
        self.job_id = job_id
        self.base_dir = os.path.join(config.checkpoint_dir, job_id)
        self._step_counter = 0

    def should_checkpoint(self) -> bool:
        """Check if it's time to save a checkpoint."""
        self._step_counter += 1
        return self._step_counter % self.config.checkpoint_every == 0

    def save(
        self,
        state: BTUTCheckpointState,
        states_array: np.ndarray | None = None,
        densities_array: np.ndarray | None = None,
    ) -> str:
        """Save checkpoint to disk. Returns checkpoint directory path."""
        checkpoint_dir = os.path.join(
            self.base_dir,
            f"level_{state.cascade_level}_step_{state.step_within_level}",
        )
        os.makedirs(checkpoint_dir, exist_ok=True)

        state.timestamp = time.time()

        # Save arrays
        if states_array is not None:
            states_path = os.path.join(checkpoint_dir, "states.npy")
            np.save(states_path, states_array)
            state.states_path = states_path

        if densities_array is not None:
            densities_path = os.path.join(checkpoint_dir, "densities.npy")
            np.save(densities_path, densities_array)
            state.densities_path = densities_path

        # Save metadata
        meta_path = os.path.join(checkpoint_dir, "metadata.json")
        with open(meta_path, "w") as f:
            json.dump(state.to_dict(), f, indent=2)

        logger.info(
            "Checkpoint saved: level=%d step=%d survivors=%d at %s",
            state.cascade_level, state.step_within_level,
            state.survivor_count, checkpoint_dir,
        )
        return checkpoint_dir

    def load_latest(self) -> tuple[BTUTCheckpointState | None, np.ndarray | None, np.ndarray | None]:
        """Load the most recent checkpoint. Returns (state, states_array, densities_array).

        Returns (None, None, None) if no checkpoint exists.
        """
        if not os.path.exists(self.base_dir):
            return None, None, None

        # Find all checkpoint directories and pick the latest by timestamp
        latest_state = None
        latest_time = 0.0
        latest_dir = None

        for entry in os.listdir(self.base_dir):
            entry_path = os.path.join(self.base_dir, entry)
            meta_path = os.path.join(entry_path, "metadata.json")
            if os.path.isdir(entry_path) and os.path.exists(meta_path):
                try:
                    with open(meta_path) as f:
                        data = json.load(f)
                    ts = data.get("timestamp", 0)
                    if ts > latest_time:
                        latest_time = ts
                        latest_state = BTUTCheckpointState.from_dict(data)
                        latest_dir = entry_path
                except (json.JSONDecodeError, KeyError):
                    continue

        if latest_state is None:
            return None, None, None

        # Load arrays
        states_array = None
        densities_array = None

        if latest_state.states_path and os.path.exists(latest_state.states_path):
            states_array = np.load(latest_state.states_path)

        if latest_state.densities_path and os.path.exists(latest_state.densities_path):
            densities_array = np.load(latest_state.densities_path)

        logger.info(
            "Checkpoint loaded: level=%d step=%d survivors=%d from %s",
            latest_state.cascade_level, latest_state.step_within_level,
            latest_state.survivor_count, latest_dir,
        )

        return latest_state, states_array, densities_array

    def cleanup(self):
        """Remove all checkpoints for this job."""
        import shutil
        if os.path.exists(self.base_dir):
            shutil.rmtree(self.base_dir, ignore_errors=True)
