"""Serve learned entity representations for similarity search.

Provides cosine similarity search, neighborhood queries,
module prediction, and batch similarity computation.
"""

from __future__ import annotations

import logging
import math
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module import Module, ModuleEntity
from app.services.crystallization.wrapper import TCDJEPAWrapper

logger = logging.getLogger(__name__)


@dataclass
class SimilarEntity:
    """An entity ranked by similarity."""

    name: str
    entity_type: str
    similarity: float
    module_index: int | None = None


@dataclass
class ModulePrediction:
    """Predicted module assignment for an embedding."""

    module_index: int
    module_name: str
    confidence: float


class EmbeddingAPI:
    """Serve learned entity representations for similarity and prediction."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._wrapper = TCDJEPAWrapper()
        self._embedding_cache: dict[str, dict[str, list[float]]] = {}

    async def find_similar(
        self,
        dataset_id: uuid.UUID,
        entity_name: str,
        top_k: int = 10,
        checkpoint_path: str | None = None,
    ) -> list[SimilarEntity]:
        """Find entities most similar to a given entity by embedding cosine similarity.

        Args:
            dataset_id: UUID of the dataset.
            entity_name: Name of the query entity.
            top_k: Number of results to return.
            checkpoint_path: Path to checkpoint (loaded if not cached).

        Returns:
            List of SimilarEntity sorted by descending similarity.
        """
        embeddings = await self._get_embeddings(dataset_id, checkpoint_path)

        if entity_name not in embeddings:
            logger.warning("Entity '%s' not found in embeddings", entity_name)
            return []

        query_emb = embeddings[entity_name]
        entity_module_map = await self._build_entity_module_map(dataset_id)

        scores: list[tuple[str, float]] = []
        for name, emb in embeddings.items():
            if name == entity_name:
                continue
            sim = self._cosine_similarity(query_emb, emb)
            scores.append((name, sim))

        scores.sort(key=lambda x: x[1], reverse=True)

        results = []
        for name, sim in scores[:top_k]:
            info = entity_module_map.get(name, {})
            results.append(
                SimilarEntity(
                    name=name,
                    entity_type=info.get("type", "unknown"),
                    similarity=round(sim, 4),
                    module_index=info.get("module_index"),
                )
            )

        logger.debug(
            "find_similar('%s'): returning %d results", entity_name, len(results)
        )
        return results

    async def find_neighbors(
        self,
        dataset_id: uuid.UUID,
        entity_name: str,
        radius: float = 0.8,
        checkpoint_path: str | None = None,
    ) -> list[SimilarEntity]:
        """Find all entities within a similarity radius.

        Args:
            dataset_id: UUID of the dataset.
            entity_name: Name of the query entity.
            radius: Minimum similarity threshold (0-1).
            checkpoint_path: Path to checkpoint.

        Returns:
            List of entities within the radius, sorted by similarity.
        """
        embeddings = await self._get_embeddings(dataset_id, checkpoint_path)

        if entity_name not in embeddings:
            return []

        query_emb = embeddings[entity_name]
        entity_module_map = await self._build_entity_module_map(dataset_id)

        results = []
        for name, emb in embeddings.items():
            if name == entity_name:
                continue
            sim = self._cosine_similarity(query_emb, emb)
            if sim >= radius:
                info = entity_module_map.get(name, {})
                results.append(
                    SimilarEntity(
                        name=name,
                        entity_type=info.get("type", "unknown"),
                        similarity=round(sim, 4),
                        module_index=info.get("module_index"),
                    )
                )

        results.sort(key=lambda x: x.similarity, reverse=True)
        return results

    async def predict_module(
        self,
        dataset_id: uuid.UUID,
        entity_embedding: list[float],
        checkpoint_path: str | None = None,
    ) -> list[ModulePrediction]:
        """Predict which module an embedding vector would belong to.

        Computes average similarity to each module's entities and
        returns modules ranked by confidence.

        Args:
            dataset_id: UUID of the dataset.
            entity_embedding: The embedding vector to classify.
            checkpoint_path: Path to checkpoint.

        Returns:
            List of ModulePrediction sorted by descending confidence.
        """
        embeddings = await self._get_embeddings(dataset_id, checkpoint_path)
        entity_module_map = await self._build_entity_module_map(dataset_id)

        # Group embeddings by module
        module_embeddings: dict[int, list[list[float]]] = {}
        module_names: dict[int, str] = {}

        for name, emb in embeddings.items():
            info = entity_module_map.get(name, {})
            mod_idx = info.get("module_index")
            if mod_idx is not None:
                module_embeddings.setdefault(mod_idx, []).append(emb)
                if mod_idx not in module_names:
                    module_names[mod_idx] = info.get("module_name", f"Module {mod_idx}")

        # Compute avg similarity to each module
        predictions: list[ModulePrediction] = []
        for mod_idx, embs in module_embeddings.items():
            similarities = [
                self._cosine_similarity(entity_embedding, emb) for emb in embs
            ]
            avg_sim = sum(similarities) / len(similarities) if similarities else 0.0

            predictions.append(
                ModulePrediction(
                    module_index=mod_idx,
                    module_name=module_names.get(mod_idx, f"Module {mod_idx}"),
                    confidence=round(avg_sim, 4),
                )
            )

        predictions.sort(key=lambda p: p.confidence, reverse=True)
        return predictions

    async def batch_similarity(
        self,
        dataset_id: uuid.UUID,
        entities_a: list[str],
        entities_b: list[str],
        checkpoint_path: str | None = None,
    ) -> list[dict]:
        """Compute pairwise similarity between two entity lists.

        Args:
            dataset_id: UUID of the dataset.
            entities_a: First list of entity names.
            entities_b: Second list of entity names.
            checkpoint_path: Path to checkpoint.

        Returns:
            List of {source, target, similarity} dicts.
        """
        embeddings = await self._get_embeddings(dataset_id, checkpoint_path)

        results = []
        for name_a in entities_a:
            emb_a = embeddings.get(name_a)
            if emb_a is None:
                continue

            for name_b in entities_b:
                emb_b = embeddings.get(name_b)
                if emb_b is None:
                    continue

                sim = self._cosine_similarity(emb_a, emb_b)
                results.append({
                    "source": name_a,
                    "target": name_b,
                    "similarity": round(sim, 4),
                })

        return results

    async def _get_embeddings(
        self,
        dataset_id: uuid.UUID,
        checkpoint_path: str | None,
    ) -> dict[str, list[float]]:
        """Load or retrieve cached embeddings."""
        cache_key = str(dataset_id)

        if cache_key in self._embedding_cache:
            return self._embedding_cache[cache_key]

        if checkpoint_path:
            try:
                embeddings = await self._wrapper.get_embeddings(checkpoint_path)
                self._embedding_cache[cache_key] = embeddings
                return embeddings
            except Exception:
                logger.warning(
                    "Failed to load embeddings from checkpoint; returning empty"
                )

        return {}

    async def _build_entity_module_map(
        self, dataset_id: uuid.UUID
    ) -> dict[str, dict]:
        """Build entity name -> {type, module_index, module_name} map."""
        result = await self._db.execute(
            select(ModuleEntity, Module)
            .join(Module, Module.id == ModuleEntity.module_id)
            .where(Module.dataset_id == dataset_id)
        )
        rows = result.all()

        entity_map: dict[str, dict] = {}
        for entity, module in rows:
            entity_map[entity.entity_name] = {
                "type": entity.entity_type,
                "module_index": module.module_index,
                "module_name": module.name,
            }
        return entity_map

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if len(a) != len(b) or not a:
            return 0.0

        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))

        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0

        return dot / (norm_a * norm_b)
