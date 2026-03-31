"""TCD-JEPA engine wrapper for the Latent Intelligence platform.

Provides a high-level async interface around the TCD-JEPA training engine,
handling path setup, GPU detection, training execution, and result extraction.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)

# Add TCD-JEPA to Python path
_TCD_JEPA_PATH = os.environ.get(
    "TCD_JEPA_PATH",
    str(Path(__file__).resolve().parents[4] / "tcd-jepa"),
)
if _TCD_JEPA_PATH not in sys.path:
    sys.path.insert(0, _TCD_JEPA_PATH)


def _import_tcd_jepa() -> dict[str, Any]:
    """Lazily import TCD-JEPA modules to avoid import errors at module load.

    Returns:
        Dictionary of imported TCD-JEPA components.

    Raises:
        ImportError: If TCD-JEPA is not available.
    """
    try:
        from tcd_jepa.core.system3_crystallizer import System3Crystallizer
        from tcd_jepa.evaluation.eval_runner import EvaluationRunner
        from tcd_jepa.evaluation.knn_evaluator import KNNEvaluator
        from tcd_jepa.manifold.sparse_graph import SparseAdjacency
        from tcd_jepa.modules.module_factory import ModuleFactory

        return {
            "System3Crystallizer": System3Crystallizer,
            "EvaluationRunner": EvaluationRunner,
            "KNNEvaluator": KNNEvaluator,
            "SparseAdjacency": SparseAdjacency,
            "ModuleFactory": ModuleFactory,
        }
    except ImportError as exc:
        logger.error(
            "TCD-JEPA not found at %s: %s", _TCD_JEPA_PATH, exc
        )
        raise ImportError(
            f"TCD-JEPA engine not available. Expected at: {_TCD_JEPA_PATH}"
        ) from exc


class TCDJEPAWrapper:
    """High-level wrapper around the TCD-JEPA crystallization engine."""

    def __init__(self) -> None:
        self._modules: dict[str, Any] | None = None

    def _ensure_imports(self) -> dict[str, Any]:
        """Import TCD-JEPA modules on first use."""
        if self._modules is None:
            self._modules = _import_tcd_jepa()
        return self._modules

    async def run_training(
        self,
        config_path: str,
        data_path: str,
        callback: Callable[[dict], None] | None = None,
    ) -> dict:
        """Run TCD-JEPA training as a blocking operation in an executor.

        Args:
            config_path: Path to YAML configuration file.
            data_path: Path to the dataset directory.
            callback: Optional progress callback receiving
                {"epoch": int, "step": int, "loss": float, ...}.

        Returns:
            Training result dictionary with final metrics and checkpoint path.

        Raises:
            RuntimeError: If training fails.
        """
        logger.info(
            "Starting TCD-JEPA training: config=%s, data=%s",
            config_path,
            data_path,
        )

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._run_training_sync,
            config_path,
            data_path,
            callback,
        )
        return result

    def _run_training_sync(
        self,
        config_path: str,
        data_path: str,
        callback: Callable[[dict], None] | None,
    ) -> dict:
        """Synchronous training execution (runs in thread pool)."""
        try:
            import torch
            import yaml

            with open(config_path, "r") as f:
                config = yaml.safe_load(f)

            # Detect device
            device = "cuda" if torch.cuda.is_available() else "cpu"
            if device == "cpu":
                logger.warning(
                    "No GPU detected — running TCD-JEPA on CPU (slow)"
                )
            else:
                gpu_name = torch.cuda.get_device_name(0)
                logger.info("Using GPU: %s", gpu_name)

            config["device"] = device
            config["data_path"] = data_path

            # Import train module
            sys.path.insert(0, _TCD_JEPA_PATH)
            from train_graph import train as tcd_train

            # Run training with progress hook
            result = tcd_train(config, progress_callback=callback)

            logger.info(
                "Training completed: loss=%.4f, checkpoint=%s",
                result.get("final_loss", -1),
                result.get("checkpoint_path", "N/A"),
            )
            return result

        except ImportError:
            logger.error("TCD-JEPA train module not importable")
            raise RuntimeError(
                "TCD-JEPA training engine not available"
            )
        except Exception as exc:
            logger.exception("TCD-JEPA training failed")
            raise RuntimeError(f"Training failed: {exc}") from exc

    async def extract_modules(
        self, checkpoint_path: str
    ) -> list[dict]:
        """Load a checkpoint and extract crystallized modules.

        Args:
            checkpoint_path: Path to the saved model checkpoint.

        Returns:
            List of module dictionaries with entity assignments,
            type distributions, and purity scores.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._extract_modules_sync, checkpoint_path
        )

    def _extract_modules_sync(self, checkpoint_path: str) -> list[dict]:
        """Synchronous module extraction."""
        try:
            import torch

            checkpoint = torch.load(
                checkpoint_path, map_location="cpu", weights_only=False
            )

            modules_data = checkpoint.get("modules", [])
            if not modules_data:
                logger.warning(
                    "No modules found in checkpoint: %s", checkpoint_path
                )
                return []

            result = []
            for idx, mod in enumerate(modules_data):
                result.append({
                    "module_index": idx,
                    "entities": mod.get("entities", []),
                    "entity_count": len(mod.get("entities", [])),
                    "type_distribution": mod.get("type_distribution", {}),
                    "internal_edges": mod.get("internal_edges", 0),
                    "metadata": mod.get("metadata", {}),
                })

            logger.info(
                "Extracted %d modules from checkpoint", len(result)
            )
            return result

        except Exception as exc:
            logger.exception("Module extraction failed")
            raise RuntimeError(
                f"Failed to extract modules from {checkpoint_path}: {exc}"
            ) from exc

    async def get_embeddings(
        self, checkpoint_path: str
    ) -> dict[str, list[float]]:
        """Extract learned entity representations from a checkpoint.

        Args:
            checkpoint_path: Path to the saved model checkpoint.

        Returns:
            Dictionary mapping entity names to embedding vectors.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._get_embeddings_sync, checkpoint_path
        )

    def _get_embeddings_sync(
        self, checkpoint_path: str
    ) -> dict[str, list[float]]:
        """Synchronous embedding extraction."""
        try:
            import torch

            checkpoint = torch.load(
                checkpoint_path, map_location="cpu", weights_only=False
            )

            embeddings = checkpoint.get("embeddings", {})
            if not embeddings:
                logger.warning(
                    "No embeddings found in checkpoint: %s",
                    checkpoint_path,
                )
                return {}

            # Convert tensors to lists
            result = {}
            for name, emb in embeddings.items():
                if hasattr(emb, "tolist"):
                    result[name] = emb.tolist()
                elif isinstance(emb, list):
                    result[name] = emb
                else:
                    result[name] = list(emb)

            logger.info("Extracted embeddings for %d entities", len(result))
            return result

        except Exception as exc:
            logger.exception("Embedding extraction failed")
            raise RuntimeError(
                f"Failed to extract embeddings from {checkpoint_path}: {exc}"
            ) from exc
