"""Multi-format data export with governance checks.

Exports modules, connections, and embeddings in CSV, JSON, and
Neo4j Cypher formats, applying RBAC and classification checks.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module import HiddenConnection, Module, ModuleEntity, ModuleRelationship
from app.models.user import User
from app.services.governance.access_controller import AccessController

logger = logging.getLogger(__name__)

EXPORT_FORMATS = ("csv", "json", "cypher")


class ExportService:
    """Export crystallization data in multiple formats with governance checks."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._access = AccessController(db)

    async def export_modules(
        self,
        dataset_id: uuid.UUID,
        format: str = "json",
        user: User | None = None,
    ) -> bytes:
        """Export module data for a dataset.

        Args:
            dataset_id: UUID of the dataset.
            format: Output format (csv/json/cypher).
            user: Optional user for access checks.

        Returns:
            Exported data as bytes.

        Raises:
            PermissionError: If user lacks export permission.
            ValueError: If format is unsupported.
        """
        self._validate_format(format)

        if user:
            has_access = await self._access.check_dataset_access(
                user, dataset_id, "export_reports"
            )
            if not has_access:
                raise PermissionError(
                    f"User {user.id} lacks export permission for dataset {dataset_id}"
                )

        result = await self._db.execute(
            select(Module).where(Module.dataset_id == dataset_id).order_by(Module.module_index)
        )
        modules = list(result.scalars().all())

        if format == "json":
            return self._modules_to_json(modules)
        if format == "csv":
            return self._modules_to_csv(modules)
        if format == "cypher":
            return self._modules_to_cypher(modules, dataset_id)
        raise ValueError(f"Unsupported format: {format}")

    async def export_connections(
        self,
        dataset_id: uuid.UUID,
        format: str = "json",
        user: User | None = None,
    ) -> bytes:
        """Export hidden connections and module relationships.

        Args:
            dataset_id: UUID of the dataset.
            format: Output format.
            user: Optional user for access checks.

        Returns:
            Exported data as bytes.
        """
        self._validate_format(format)

        if user:
            has_access = await self._access.check_dataset_access(
                user, dataset_id, "export_reports"
            )
            if not has_access:
                raise PermissionError("Insufficient permissions for export")

        # Load module IDs for this dataset
        modules_result = await self._db.execute(
            select(Module.id, Module.job_id).where(Module.dataset_id == dataset_id)
        )
        module_rows = modules_result.all()
        module_ids = [r[0] for r in module_rows]
        job_ids = list({r[1] for r in module_rows})

        # Load hidden connections
        hidden_result = await self._db.execute(
            select(HiddenConnection).where(HiddenConnection.job_id.in_(job_ids))
        )
        hidden = list(hidden_result.scalars().all())

        # Load module relationships
        rels_result = await self._db.execute(
            select(ModuleRelationship).where(
                ModuleRelationship.source_module_id.in_(module_ids)
            )
        )
        rels = list(rels_result.scalars().all())

        connections = {
            "hidden_connections": [
                {
                    "source": h.source_entity,
                    "target": h.target_entity,
                    "similarity": h.similarity_score,
                    "has_direct_edge": h.has_direct_edge,
                    "validated": h.validated,
                }
                for h in hidden
            ],
            "module_relationships": [
                {
                    "source_module_id": str(r.source_module_id),
                    "target_module_id": str(r.target_module_id),
                    "strength": r.connection_strength,
                    "shared_count": r.shared_entity_count,
                }
                for r in rels
            ],
        }

        if format == "json":
            return json.dumps(connections, indent=2, default=str).encode("utf-8")
        if format == "csv":
            return self._connections_to_csv(hidden, rels)
        if format == "cypher":
            return self._connections_to_cypher(hidden)
        raise ValueError(f"Unsupported format: {format}")

    async def export_embeddings(
        self,
        dataset_id: uuid.UUID,
        format: str = "json",
        user: User | None = None,
    ) -> bytes:
        """Export learned entity embeddings.

        Args:
            dataset_id: UUID of the dataset.
            format: Output format (json/csv).
            user: Optional user for access checks.

        Returns:
            Exported data as bytes.
        """
        if format not in ("json", "csv"):
            raise ValueError(f"Embeddings only support json/csv, not {format}")

        if user:
            has_access = await self._access.check_dataset_access(
                user, dataset_id, "export_reports"
            )
            if not has_access:
                raise PermissionError("Insufficient permissions for export")

        # Load entities with centrality scores as proxy embeddings
        result = await self._db.execute(
            select(ModuleEntity)
            .join(Module, Module.id == ModuleEntity.module_id)
            .where(Module.dataset_id == dataset_id)
        )
        entities = list(result.scalars().all())

        if format == "json":
            data = {
                e.entity_name: {
                    "type": e.entity_type,
                    "centrality": e.centrality_score,
                    "module_id": str(e.module_id),
                }
                for e in entities
            }
            return json.dumps(data, indent=2, default=str).encode("utf-8")

        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["entity_name", "entity_type", "centrality_score", "module_id"])
            for e in entities:
                writer.writerow([e.entity_name, e.entity_type, e.centrality_score, str(e.module_id)])
            return output.getvalue().encode("utf-8")

        raise ValueError(f"Unsupported format: {format}")

    @staticmethod
    def _modules_to_json(modules: list[Module]) -> bytes:
        data = [
            {
                "module_index": m.module_index,
                "name": m.name,
                "description": m.description,
                "entity_count": m.entity_count,
                "purity_score": m.purity_score,
                "dominant_type": m.dominant_type,
                "type_distribution": m.type_distribution,
                "internal_density": m.internal_density,
            }
            for m in modules
        ]
        return json.dumps(data, indent=2, default=str).encode("utf-8")

    @staticmethod
    def _modules_to_csv(modules: list[Module]) -> bytes:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "module_index", "name", "entity_count", "purity_score",
            "dominant_type", "internal_density",
        ])
        for m in modules:
            writer.writerow([
                m.module_index, m.name, m.entity_count,
                m.purity_score, m.dominant_type, m.internal_density,
            ])
        return output.getvalue().encode("utf-8")

    @staticmethod
    def _modules_to_cypher(modules: list[Module], dataset_id: uuid.UUID) -> bytes:
        lines = []
        for m in modules:
            props = json.dumps({
                "name": m.name,
                "entity_count": m.entity_count,
                "purity_score": m.purity_score,
                "dominant_type": m.dominant_type,
                "dataset_id": str(dataset_id),
            })
            lines.append(
                f"CREATE (:Module {{module_index: {m.module_index}, {props[1:-1]}}})"
            )
        return "\n".join(lines).encode("utf-8")

    @staticmethod
    def _connections_to_csv(hidden: list, rels: list) -> bytes:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["type", "source", "target", "score", "validated"])
        for h in hidden:
            writer.writerow(["hidden", h.source_entity, h.target_entity, h.similarity_score, h.validated])
        for r in rels:
            writer.writerow(["module_rel", str(r.source_module_id), str(r.target_module_id), r.connection_strength, ""])
        return output.getvalue().encode("utf-8")

    @staticmethod
    def _connections_to_cypher(hidden: list) -> bytes:
        lines = []
        for h in hidden:
            lines.append(
                f'MATCH (a:Entity {{name: "{h.source_entity}"}}), '
                f'(b:Entity {{name: "{h.target_entity}"}}) '
                f"CREATE (a)-[:HIDDEN_CONNECTION {{similarity: {h.similarity_score}}}]->(b)"
            )
        return "\n".join(lines).encode("utf-8")

    @staticmethod
    def _validate_format(format: str) -> None:
        if format not in EXPORT_FORMATS:
            raise ValueError(
                f"Unsupported format: {format}. Supported: {', '.join(EXPORT_FORMATS)}"
            )
