"""Cross-module relationship analysis.

Analyzes inter-module connections, shared entities, bridge entities,
and generates a module relationship graph.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.neo4j import Neo4jConnection
from app.models.module import Module, ModuleEntity, ModuleRelationship

logger = logging.getLogger(__name__)


@dataclass
class ModulePairAnalysis:
    """Analysis of the relationship between two modules."""

    source_module_id: str
    target_module_id: str
    source_module_index: int
    target_module_index: int
    shared_connection_count: int
    connection_strength: float  # normalized 0-1
    bridge_entities: list[str]  # entities connecting both modules


@dataclass
class BridgeEntity:
    """An entity that connects multiple modules."""

    name: str
    entity_type: str
    connected_module_indices: list[int]
    total_cross_module_connections: int


@dataclass
class CrossModuleReport:
    """Complete cross-module analysis report."""

    module_pair_analyses: list[ModulePairAnalysis]
    bridge_entities: list[BridgeEntity]
    total_cross_module_edges: int
    avg_connection_strength: float


class CrossModuleAnalyzer:
    """Analyze relationships between crystallized modules."""

    def __init__(self, db: AsyncSession, neo4j: Neo4jConnection) -> None:
        self._db = db
        self._neo4j = neo4j

    async def analyze(
        self, modules: list[Module], dataset_id: str
    ) -> CrossModuleReport:
        """Perform full cross-module analysis.

        Args:
            modules: List of Module instances from the same job.
            dataset_id: Dataset UUID string.

        Returns:
            CrossModuleReport with pair analyses and bridge entities.
        """
        logger.info(
            "Analyzing cross-module relationships for %d modules",
            len(modules),
        )

        # Load entity membership per module
        module_membership = await self._load_module_membership(modules)

        # Build reverse map: entity -> module indices
        entity_to_modules: dict[str, set[int]] = defaultdict(set)
        for mod_idx, entities in module_membership.items():
            for name in entities:
                entity_to_modules[name].add(mod_idx)

        # Query cross-module edges
        dataset_label = dataset_id.replace("-", "_")
        cross_edges = await self._query_cross_module_edges(
            dataset_label, module_membership
        )

        # Analyze each module pair
        pair_analyses = self._analyze_pairs(
            modules, module_membership, cross_edges
        )

        # Identify bridge entities
        bridge_entities = self._find_bridge_entities(
            modules, module_membership, cross_edges, entity_to_modules
        )

        total_cross = sum(p.shared_connection_count for p in pair_analyses)
        avg_strength = (
            sum(p.connection_strength for p in pair_analyses) / len(pair_analyses)
            if pair_analyses
            else 0.0
        )

        report = CrossModuleReport(
            module_pair_analyses=pair_analyses,
            bridge_entities=bridge_entities,
            total_cross_module_edges=total_cross,
            avg_connection_strength=round(avg_strength, 4),
        )

        logger.info(
            "Cross-module analysis: %d pairs, %d bridges, %d cross-edges",
            len(pair_analyses),
            len(bridge_entities),
            total_cross,
        )
        return report

    async def store_results(
        self, report: CrossModuleReport, modules: list[Module]
    ) -> None:
        """Store cross-module analysis results in PostgreSQL.

        Args:
            report: Analysis report to persist.
            modules: Module instances (for ID lookup by index).
        """
        index_to_id = {m.module_index: m.id for m in modules}

        for pair in report.module_pair_analyses:
            src_id = index_to_id.get(pair.source_module_index)
            tgt_id = index_to_id.get(pair.target_module_index)
            if src_id is None or tgt_id is None:
                continue

            rel = ModuleRelationship(
                source_module_id=src_id,
                target_module_id=tgt_id,
                connection_strength=pair.connection_strength,
                shared_entity_count=pair.shared_connection_count,
                description=(
                    f"{len(pair.bridge_entities)} bridge entities"
                    if pair.bridge_entities
                    else None
                ),
            )
            self._db.add(rel)

        await self._db.flush()
        logger.info(
            "Stored %d module relationships", len(report.module_pair_analyses)
        )

    async def _load_module_membership(
        self, modules: list[Module]
    ) -> dict[int, set[str]]:
        """Load entity names for each module."""
        membership: dict[int, set[str]] = {}

        for module in modules:
            result = await self._db.execute(
                select(ModuleEntity.entity_name).where(
                    ModuleEntity.module_id == module.id
                )
            )
            names = {row[0] for row in result.all()}
            membership[module.module_index] = names

        return membership

    async def _query_cross_module_edges(
        self,
        dataset_label: str,
        module_membership: dict[int, set[str]],
    ) -> list[dict]:
        """Query edges that cross module boundaries."""
        all_names = set()
        for names in module_membership.values():
            all_names.update(names)

        edges = await self._neo4j.execute_query(
            f"""
            MATCH (a:Entity:`{dataset_label}`)-[r:RELATES_TO]->(b:Entity:`{dataset_label}`)
            WHERE a.name IN $names AND b.name IN $names
            RETURN a.name AS source, b.name AS target, r.type AS type
            """,
            {"names": list(all_names)},
        )

        # Filter to only cross-module edges
        entity_module: dict[str, int] = {}
        for mod_idx, names in module_membership.items():
            for name in names:
                entity_module[name] = mod_idx

        cross_edges = []
        for edge in edges:
            src_mod = entity_module.get(edge["source"])
            tgt_mod = entity_module.get(edge["target"])
            if src_mod is not None and tgt_mod is not None and src_mod != tgt_mod:
                cross_edges.append({
                    **edge,
                    "source_module": src_mod,
                    "target_module": tgt_mod,
                })

        return cross_edges

    def _analyze_pairs(
        self,
        modules: list[Module],
        membership: dict[int, set[str]],
        cross_edges: list[dict],
    ) -> list[ModulePairAnalysis]:
        """Analyze connection strength between module pairs."""
        # Count edges per pair
        pair_counts: Counter[tuple[int, int]] = Counter()
        pair_bridges: dict[tuple[int, int], set[str]] = defaultdict(set)

        for edge in cross_edges:
            key = tuple(sorted([edge["source_module"], edge["target_module"]]))
            pair_counts[key] += 1
            pair_bridges[key].add(edge["source"])
            pair_bridges[key].add(edge["target"])

        # Build index -> module lookup
        index_to_module = {m.module_index: m for m in modules}

        # Normalize connection strength
        max_count = max(pair_counts.values()) if pair_counts else 1

        analyses = []
        for (mod_a, mod_b), count in pair_counts.most_common():
            src = index_to_module.get(mod_a)
            tgt = index_to_module.get(mod_b)
            if not src or not tgt:
                continue

            # Strength normalized by max and by module sizes
            size_factor = min(len(membership.get(mod_a, set())), len(membership.get(mod_b, set())))
            strength = count / max(size_factor, 1)
            strength = min(strength, 1.0)

            bridge_names = list(pair_bridges.get((mod_a, mod_b), set()))

            analyses.append(
                ModulePairAnalysis(
                    source_module_id=str(src.id),
                    target_module_id=str(tgt.id),
                    source_module_index=mod_a,
                    target_module_index=mod_b,
                    shared_connection_count=count,
                    connection_strength=round(strength, 4),
                    bridge_entities=bridge_names[:10],
                )
            )

        return analyses

    @staticmethod
    def _find_bridge_entities(
        modules: list[Module],
        membership: dict[int, set[str]],
        cross_edges: list[dict],
        entity_to_modules: dict[str, set[int]],
    ) -> list[BridgeEntity]:
        """Identify entities that serve as bridges between modules."""
        # Count cross-module connections per entity
        cross_counts: Counter[str] = Counter()
        for edge in cross_edges:
            cross_counts[edge["source"]] += 1
            cross_counts[edge["target"]] += 1

        # An entity is a bridge if it connects 2+ modules
        bridges: list[BridgeEntity] = []
        for name, count in cross_counts.most_common():
            connected_modules = list(entity_to_modules.get(name, set()))
            if len(connected_modules) >= 2:
                bridges.append(
                    BridgeEntity(
                        name=name,
                        entity_type="unknown",  # populated during full pipeline
                        connected_module_indices=connected_modules,
                        total_cross_module_connections=count,
                    )
                )

        return bridges[:50]  # Limit to top 50 bridges
