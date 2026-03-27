"""Auto-generate TCD-JEPA YAML configuration based on dataset profile.

Scales training parameters (epochs, batch size, learning rate, etc.)
according to dataset size: small, medium, or large.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

from app.services.ingestion.profiler import DatasetProfile

logger = logging.getLogger(__name__)

# Tier thresholds
_SMALL_THRESHOLD = 500
_LARGE_THRESHOLD = 5000


class ConfigBuilder:
    """Build TCD-JEPA YAML configuration files based on dataset statistics."""

    def build(
        self,
        profile: DatasetProfile,
        output_dir: str | None = None,
        overrides: dict | None = None,
    ) -> dict[str, Any]:
        """Generate a TCD-JEPA config dict tuned to the dataset size.

        Args:
            profile: Dataset profile from the ingestion stage.
            output_dir: If provided, also write config as a YAML file.
            overrides: Optional key-value overrides to apply last.

        Returns:
            Complete configuration dictionary.
        """
        tier = self._determine_tier(profile.entity_count)
        logger.info(
            "Building config for %d entities (tier=%s)",
            profile.entity_count,
            tier,
        )

        config = self._base_config()
        tier_settings = self._tier_settings(tier)
        config.update(tier_settings)

        # Adjust based on graph properties
        config = self._adjust_for_density(config, profile)
        config = self._adjust_for_types(config, profile)

        # Apply user overrides
        if overrides:
            config.update(overrides)
            logger.info("Applied %d config overrides", len(overrides))

        if output_dir:
            self._write_yaml(config, output_dir)

        return config

    @staticmethod
    def _determine_tier(entity_count: int) -> str:
        """Classify dataset into size tier."""
        if entity_count < _SMALL_THRESHOLD:
            return "small"
        if entity_count < _LARGE_THRESHOLD:
            return "medium"
        return "large"

    @staticmethod
    def _base_config() -> dict[str, Any]:
        """Shared configuration defaults for all tiers."""
        return {
            "model": {
                "type": "tcd_jepa",
                "embedding_dim": 128,
                "hidden_dim": 256,
                "num_heads": 4,
                "dropout": 0.1,
                "predictor_depth": 2,
            },
            "training": {
                "optimizer": "adamw",
                "weight_decay": 0.01,
                "warmup_steps": 100,
                "scheduler": "cosine",
                "clip_grad_norm": 1.0,
                "mixed_precision": True,
                "seed": 42,
            },
            "crystallizer": {
                "algorithm": "system3",
                "min_module_size": 3,
                "resolution": 1.0,
            },
            "evaluation": {
                "knn_k": 5,
                "eval_every_n_epochs": 5,
                "link_prediction": True,
                "module_purity": True,
            },
            "logging": {
                "log_every_n_steps": 10,
                "save_checkpoints": True,
                "checkpoint_every_n_epochs": 10,
            },
        }

    @staticmethod
    def _tier_settings(tier: str) -> dict[str, Any]:
        """Per-tier training parameter overrides."""
        settings = {
            "small": {
                "training": {
                    "epochs": 50,
                    "batch_size": 32,
                    "learning_rate": 1e-3,
                    "gradient_accumulation_steps": 1,
                },
                "model": {
                    "embedding_dim": 64,
                    "hidden_dim": 128,
                    "num_heads": 2,
                },
                "crystallizer": {
                    "min_module_size": 2,
                },
            },
            "medium": {
                "training": {
                    "epochs": 100,
                    "batch_size": 64,
                    "learning_rate": 5e-4,
                    "gradient_accumulation_steps": 1,
                },
                "model": {
                    "embedding_dim": 128,
                    "hidden_dim": 256,
                    "num_heads": 4,
                },
            },
            "large": {
                "training": {
                    "epochs": 200,
                    "batch_size": 128,
                    "learning_rate": 3e-4,
                    "gradient_accumulation_steps": 4,
                },
                "model": {
                    "embedding_dim": 256,
                    "hidden_dim": 512,
                    "num_heads": 8,
                },
                "crystallizer": {
                    "min_module_size": 5,
                },
            },
        }

        tier_cfg = settings.get(tier, settings["medium"])

        # Deep-merge tier settings
        result: dict[str, Any] = {}
        for section, values in tier_cfg.items():
            if isinstance(values, dict):
                result.setdefault(section, {}).update(values)
            else:
                result[section] = values
        return result

    @staticmethod
    def _adjust_for_density(
        config: dict[str, Any], profile: DatasetProfile
    ) -> dict[str, Any]:
        """Tune parameters based on graph density."""
        if profile.density > 0.3:
            # Dense graph: higher resolution for more granular modules
            config.setdefault("crystallizer", {})["resolution"] = 1.5
            logger.info("Dense graph detected (%.4f): increased resolution", profile.density)
        elif profile.density < 0.01:
            # Sparse graph: lower resolution for broader modules
            config.setdefault("crystallizer", {})["resolution"] = 0.5
            logger.info("Sparse graph detected (%.4f): decreased resolution", profile.density)
        return config

    @staticmethod
    def _adjust_for_types(
        config: dict[str, Any], profile: DatasetProfile
    ) -> dict[str, Any]:
        """Tune parameters based on entity type diversity."""
        n_types = len(profile.entity_type_distribution)
        if n_types > 10:
            # Many types: increase embedding dimension
            current_dim = config.get("model", {}).get("embedding_dim", 128)
            config.setdefault("model", {})["embedding_dim"] = max(
                current_dim, 256
            )
            logger.info(
                "High type diversity (%d types): increased embedding dim",
                n_types,
            )
        return config

    @staticmethod
    def _write_yaml(config: dict, output_dir: str) -> str:
        """Write configuration to a YAML file."""
        output_path = Path(output_dir) / "tcd_jepa_config.yaml"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w") as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)

        logger.info("Config written to %s", output_path)
        return str(output_path)
