"""Stage 1: Data Awakening — full ingestion orchestration pipeline.

Coordinates file parsing, normalization, validation, profiling,
storage (MinIO + Neo4j + PostgreSQL), and audit logging.
"""

from __future__ import annotations

import io
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.neo4j import Neo4jConnection
from app.models.dataset import Dataset, EntityType, IngestionLog, RelationshipType
from app.services.ingestion.csv_adapter import CSVAdapter, ParsedGraph
from app.services.ingestion.json_adapter import JSONAdapter
from app.services.ingestion.normalizer import Normalizer
from app.services.ingestion.profiler import DatasetProfile, Profiler
from app.services.ingestion.validator import ValidationReport, Validator

logger = logging.getLogger(__name__)

# Supported file types and their adapters
_ADAPTERS = {
    "text/csv": CSVAdapter,
    "application/json": JSONAdapter,
    "csv": CSVAdapter,
    "json": JSONAdapter,
}


class AwakeningPipeline:
    """Orchestrate the full data ingestion pipeline for Stage 1.

    Pipeline steps:
    1. Parse uploaded file (CSV or JSON adapter).
    2. Normalize entities and relationships.
    3. Validate graph structure.
    4. Profile dataset statistics.
    5. Store raw file in MinIO.
    6. Store graph in Neo4j.
    7. Update dataset metadata in PostgreSQL.
    8. Log all actions to ingestion_logs.
    """

    def __init__(
        self,
        db: AsyncSession,
        neo4j: Neo4jConnection,
        minio_client: Any | None = None,
    ) -> None:
        self._db = db
        self._neo4j = neo4j
        self._minio = minio_client
        self._normalizer = Normalizer()
        self._validator = Validator()
        self._profiler = Profiler()

    async def run(
        self,
        dataset_id: uuid.UUID,
        user_id: uuid.UUID,
        file_content: bytes,
        file_name: str,
        content_type: str,
        schema_mapping: dict | None = None,
    ) -> dict:
        """Execute the complete awakening pipeline.

        Args:
            dataset_id: UUID of the dataset record (pre-created).
            user_id: UUID of the user performing the upload.
            file_content: Raw file bytes.
            file_name: Original file name.
            content_type: MIME type or extension (csv/json).
            schema_mapping: Optional column/field mapping.

        Returns:
            Dictionary with profile, validation report, and graph summary.

        Raises:
            ValueError: If file type is unsupported or data is invalid.
        """
        pipeline_start = datetime.now(timezone.utc)
        logger.info(
            "Starting awakening pipeline for dataset=%s, file=%s",
            dataset_id,
            file_name,
        )

        try:
            # Update status
            await self._update_dataset_status(dataset_id, "profiling")
            await self._log_action(
                dataset_id, user_id, "pipeline_started",
                {"file_name": file_name, "content_type": content_type},
            )

            # Step 1: Parse
            graph = await self._parse_file(
                file_content, content_type, schema_mapping
            )
            await self._log_action(
                dataset_id, user_id, "file_parsed",
                {
                    "entity_count": len(graph.entities),
                    "relationship_count": len(graph.relationships),
                },
            )

            # Step 2: Normalize
            graph = await self._normalizer.normalize(graph)
            await self._log_action(
                dataset_id, user_id, "data_normalized",
                {
                    "entity_count": len(graph.entities),
                    "relationship_count": len(graph.relationships),
                },
            )

            # Step 3: Validate
            validation = await self._validator.validate(graph)
            await self._log_action(
                dataset_id, user_id, "data_validated",
                validation.to_dict(),
            )

            if not validation.is_valid:
                await self._update_dataset_status(dataset_id, "validation_failed")
                logger.warning(
                    "Validation failed for dataset=%s: %d errors",
                    dataset_id,
                    len(validation.errors),
                )
                return {
                    "status": "validation_failed",
                    "validation": validation.to_dict(),
                }

            # Step 4: Profile
            profile = await self._profiler.profile(graph)
            await self._log_action(
                dataset_id, user_id, "data_profiled",
                profile.to_dict(),
            )

            # Step 5: Store raw file in MinIO
            storage_path = await self._store_raw_file(
                dataset_id, file_name, file_content, content_type
            )

            # Step 6: Store graph in Neo4j
            await self._store_graph_neo4j(dataset_id, graph)
            await self._log_action(
                dataset_id, user_id, "graph_stored_neo4j",
                {
                    "entity_count": len(graph.entities),
                    "relationship_count": len(graph.relationships),
                },
            )

            # Step 7: Update PostgreSQL metadata
            await self._update_dataset_metadata(
                dataset_id, profile, storage_path
            )
            await self._store_type_metadata(dataset_id, profile, graph)

            # Step 8: Final status
            await self._update_dataset_status(dataset_id, "ready")

            elapsed = (datetime.now(timezone.utc) - pipeline_start).total_seconds()
            await self._log_action(
                dataset_id, user_id, "pipeline_completed",
                {"elapsed_seconds": elapsed},
            )

            logger.info(
                "Awakening pipeline completed for dataset=%s in %.2fs",
                dataset_id,
                elapsed,
            )

            return {
                "status": "ready",
                "profile": profile.to_dict(),
                "validation": validation.to_dict(),
                "entity_count": len(graph.entities),
                "relationship_count": len(graph.relationships),
                "storage_path": storage_path,
            }

        except Exception:
            logger.exception(
                "Awakening pipeline failed for dataset=%s", dataset_id
            )
            await self._update_dataset_status(dataset_id, "failed")
            await self._log_action(
                dataset_id, user_id, "pipeline_failed", {}
            )
            raise

    async def _parse_file(
        self,
        content: bytes,
        content_type: str,
        schema_mapping: dict | None,
    ) -> ParsedGraph:
        """Select adapter and parse file content."""
        adapter_cls = _ADAPTERS.get(content_type.lower())
        if adapter_cls is None:
            raise ValueError(
                f"Unsupported file type: {content_type}. "
                f"Supported: {', '.join(_ADAPTERS.keys())}"
            )

        adapter = adapter_cls()
        return await adapter.parse(content, schema_mapping)

    async def _store_raw_file(
        self,
        dataset_id: uuid.UUID,
        file_name: str,
        content: bytes,
        content_type: str,
    ) -> str:
        """Store raw uploaded file in MinIO object storage."""
        object_path = f"datasets/{dataset_id}/raw/{file_name}"

        if self._minio is not None:
            try:
                bucket = settings.MINIO_BUCKET
                self._minio.put_object(
                    bucket,
                    object_path,
                    io.BytesIO(content),
                    len(content),
                    content_type=content_type,
                )
                logger.info(
                    "Stored raw file at %s/%s", bucket, object_path
                )
            except Exception:
                logger.exception("Failed to store raw file in MinIO")
                raise
        else:
            logger.warning(
                "MinIO client not available; raw file storage skipped"
            )

        return object_path

    async def _store_graph_neo4j(
        self, dataset_id: uuid.UUID, graph: ParsedGraph
    ) -> None:
        """Create nodes and relationships in Neo4j."""
        dataset_label = str(dataset_id).replace("-", "_")

        # Create nodes in batches
        batch_size = 500
        entities = graph.entities
        for i in range(0, len(entities), batch_size):
            batch = entities[i: i + batch_size]
            params = [
                {
                    "name": e.name,
                    "entity_type": e.entity_type or "unknown",
                    "attributes": json.dumps(e.attributes) if e.attributes else "{}",
                    "dataset_id": str(dataset_id),
                }
                for e in batch
            ]
            await self._neo4j.execute_query(
                f"""
                UNWIND $entities AS e
                MERGE (n:Entity:`{dataset_label}` {{name: e.name, dataset_id: e.dataset_id}})
                SET n.entity_type = e.entity_type,
                    n.attributes = e.attributes
                """,
                {"entities": params},
            )

        # Create relationships in batches
        rels = graph.relationships
        for i in range(0, len(rels), batch_size):
            batch = rels[i: i + batch_size]
            params = [
                {
                    "source": r.source,
                    "target": r.target,
                    "rel_type": r.relationship_type or "RELATED_TO",
                    "weight": r.weight,
                    "dataset_id": str(dataset_id),
                }
                for r in batch
            ]
            await self._neo4j.execute_query(
                f"""
                UNWIND $rels AS r
                MATCH (a:Entity:`{dataset_label}` {{name: r.source, dataset_id: r.dataset_id}})
                MATCH (b:Entity:`{dataset_label}` {{name: r.target, dataset_id: r.dataset_id}})
                MERGE (a)-[rel:RELATES_TO {{type: r.rel_type}}]->(b)
                SET rel.weight = r.weight
                """,
                {"rels": params},
            )

        logger.info(
            "Stored %d nodes and %d relationships in Neo4j",
            len(entities),
            len(rels),
        )

    async def _update_dataset_status(
        self, dataset_id: uuid.UUID, status: str
    ) -> None:
        """Update the dataset status in PostgreSQL."""
        await self._db.execute(
            update(Dataset)
            .where(Dataset.id == dataset_id)
            .values(status=status, updated_at=datetime.now(timezone.utc))
        )
        await self._db.flush()

    async def _update_dataset_metadata(
        self,
        dataset_id: uuid.UUID,
        profile: DatasetProfile,
        storage_path: str,
    ) -> None:
        """Update dataset record with profile metrics."""
        await self._db.execute(
            update(Dataset)
            .where(Dataset.id == dataset_id)
            .values(
                entity_count=profile.entity_count,
                edge_count=profile.edge_count,
                density=profile.density,
                raw_storage_path=storage_path,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await self._db.flush()

    async def _store_type_metadata(
        self,
        dataset_id: uuid.UUID,
        profile: DatasetProfile,
        graph: ParsedGraph,
    ) -> None:
        """Store entity type and relationship type records in PostgreSQL."""
        # Entity types
        for type_name, count in profile.entity_type_distribution.items():
            entity_type = EntityType(
                dataset_id=dataset_id,
                name=type_name,
                count=count,
            )
            self._db.add(entity_type)

        await self._db.flush()

        # Relationship types (simplified — source/target type mapping
        # requires entity type lookup, so we store count only)
        entity_type_rows = (
            await self._db.execute(
                select(EntityType).where(EntityType.dataset_id == dataset_id)
            )
        ).scalars().all()

        type_id_map = {et.name: et.id for et in entity_type_rows}
        fallback_type_id = type_id_map.get("unknown") or (
            entity_type_rows[0].id if entity_type_rows else None
        )

        for rel_type, count in profile.relationship_type_distribution.items():
            if fallback_type_id is None:
                break
            rel = RelationshipType(
                dataset_id=dataset_id,
                name=rel_type,
                source_type_id=fallback_type_id,
                target_type_id=fallback_type_id,
                count=count,
            )
            self._db.add(rel)

        await self._db.flush()

    async def _log_action(
        self,
        dataset_id: uuid.UUID,
        user_id: uuid.UUID,
        action: str,
        details: dict,
    ) -> None:
        """Append an entry to the ingestion log."""
        log = IngestionLog(
            dataset_id=dataset_id,
            action=action,
            details=details,
            performed_by=user_id,
        )
        self._db.add(log)
        await self._db.flush()
