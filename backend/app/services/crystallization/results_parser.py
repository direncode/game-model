"""Parse TCD-JEPA training output into database-ready format.

Extracts modules, purity scores, training metrics, and entity embeddings
from raw training output and checkpoint files.
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any

logger = logging.getLogger(__name__)


class ResultsParser:
    """Parse TCD-JEPA output into structured results for storage."""

    async def parse_training_output(
        self, training_result: dict, checkpoint_path: str
    ) -> dict:
        """Parse complete training output into DB-ready format.

        Args:
            training_result: Raw output from TCD-JEPA wrapper.
            checkpoint_path: Path to the saved checkpoint.

        Returns:
            Dictionary with keys: modules, metrics, final_auc, final_knn,
            training_log, embeddings.
        """
        logger.info("Parsing training output from checkpoint: %s", checkpoint_path)

        modules = self._extract_modules(training_result)
        metrics = self._extract_metrics(training_result)
        embeddings = training_result.get("embeddings", {})

        final_auc = training_result.get("final_link_auc")
        final_knn = training_result.get("final_knn_accuracy")

        # Fallback: get final metrics from the last metric entry
        if final_auc is None and metrics:
            final_auc = next(
                (m.get("auc") for m in reversed(metrics) if m.get("auc") is not None),
                None,
            )
        if final_knn is None and metrics:
            final_knn = next(
                (m.get("knn") for m in reversed(metrics) if m.get("knn") is not None),
                None,
            )

        training_log = {
            "total_epochs": training_result.get("total_epochs", 0),
            "total_steps": training_result.get("total_steps", 0),
            "final_loss": training_result.get("final_loss"),
            "training_time_seconds": training_result.get("training_time"),
            "device": training_result.get("device", "unknown"),
        }

        result = {
            "modules": modules,
            "metrics": metrics,
            "final_auc": final_auc,
            "final_knn": final_knn,
            "training_log": training_log,
            "embedding_count": len(embeddings),
        }

        logger.info(
            "Parsed %d modules, %d metric entries, final_auc=%.4f, final_knn=%.4f",
            len(modules),
            len(metrics),
            final_auc or 0.0,
            final_knn or 0.0,
        )
        return result

    def _extract_modules(self, training_result: dict) -> list[dict]:
        """Extract module data with purity scores.

        Args:
            training_result: Raw training output.

        Returns:
            List of module dictionaries ready for DB storage.
        """
        raw_modules = training_result.get("modules", [])
        parsed_modules: list[dict] = []

        for idx, mod in enumerate(raw_modules):
            entities = mod.get("entities", [])
            type_dist = mod.get("type_distribution", {})

            # Calculate purity if not provided
            if not type_dist and entities:
                type_dist = self._compute_type_distribution(entities)

            purity = self._calculate_purity(type_dist)
            dominant_type = self._get_dominant_type(type_dist)

            parsed_modules.append({
                "module_index": mod.get("module_index", idx),
                "entities": entities,
                "entity_count": len(entities),
                "type_distribution": type_dist,
                "purity_score": purity,
                "dominant_type": dominant_type,
                "internal_density": mod.get("internal_density"),
                "internal_edges": mod.get("internal_edges", 0),
                "metadata": mod.get("metadata", {}),
            })

        return parsed_modules

    def _extract_metrics(self, training_result: dict) -> list[dict]:
        """Extract per-epoch training metrics.

        Args:
            training_result: Raw training output.

        Returns:
            List of metric dictionaries.
        """
        raw_metrics = training_result.get("metrics", [])
        parsed: list[dict] = []

        for entry in raw_metrics:
            loss = entry.get("loss")
            if loss is None:
                continue

            nan_detected = False
            if isinstance(loss, float):
                import math
                nan_detected = math.isnan(loss) or math.isinf(loss)

            parsed.append({
                "epoch": entry.get("epoch", 0),
                "step": entry.get("step", 0),
                "loss": loss if not nan_detected else 0.0,
                "auc": entry.get("link_auc") or entry.get("auc"),
                "knn": entry.get("knn_accuracy") or entry.get("knn"),
                "nan_detected": nan_detected,
                "gpu_utilization": entry.get("gpu_utilization"),
            })

        return parsed

    @staticmethod
    def _compute_type_distribution(entities: list[dict]) -> dict[str, int]:
        """Compute entity type distribution from entity list."""
        counter: Counter[str] = Counter()
        for entity in entities:
            etype = entity.get("type") or entity.get("entity_type") or "unknown"
            counter[etype] += 1
        return dict(counter.most_common())

    @staticmethod
    def _calculate_purity(type_distribution: dict[str, int]) -> float:
        """Calculate module purity as max_type_count / total_count."""
        if not type_distribution:
            return 0.0
        total = sum(type_distribution.values())
        if total == 0:
            return 0.0
        max_count = max(type_distribution.values())
        return max_count / total

    @staticmethod
    def _get_dominant_type(type_distribution: dict[str, int]) -> str | None:
        """Get the most common entity type in a module."""
        if not type_distribution:
            return None
        return max(type_distribution, key=type_distribution.get)
