"""Stage 3: Interpretation — full analysis orchestration pipeline.

Coordinates module analysis, purity calculation, hidden connection
detection, LLM description generation, and cross-module analysis.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.neo4j import Neo4jConnection
from app.models.crystallization import CrystallizationJob
from app.models.governance import LineageEvent
from app.models.module import HiddenConnection, Module
from app.services.crystallization.wrapper import TCDJEPAWrapper
from app.services.interpretation.cross_module_analyzer import CrossModuleAnalyzer
from app.services.interpretation.hidden_connection_detector import HiddenConnectionDetector
from app.services.interpretation.module_analyzer import ModuleAnalyzer
from app.services.interpretation.natural_language_describer import NaturalLanguageDescriber
from app.services.interpretation.purity_calculator import PurityCalculator

logger = logging.getLogger(__name__)


class InterpretationPipeline:
    """Orchestrate the full interpretation pipeline for Stage 3.

    Pipeline steps:
    1. For each module: statistical analysis and purity calculation.
    2. Detect hidden connections using learned embeddings.
    3. Generate LLM-powered descriptions for each module.
    4. Analyze cross-module relationships.
    5. Store all results in PostgreSQL.
    6. Record lineage events.
    """

    def __init__(
        self,
        db: AsyncSession,
        neo4j: Neo4jConnection,
        anthropic_client: Any | None = None,
    ) -> None:
        self._db = db
        self._neo4j = neo4j
        self._module_analyzer = ModuleAnalyzer(db, neo4j)
        self._purity_calculator = PurityCalculator(db)
        self._hidden_detector = HiddenConnectionDetector(db, neo4j)
        self._describer = NaturalLanguageDescriber(anthropic_client)
        self._cross_analyzer = CrossModuleAnalyzer(db, neo4j)

    async def run(
        self, dataset_id: str, job_id: str
    ) -> dict:
        """Execute the complete interpretation pipeline.

        Args:
            dataset_id: UUID string of the dataset.
            job_id: UUID string of the crystallization job.

        Returns:
            Dictionary with interpretation results summary.
        """
        pipeline_start = datetime.now(timezone.utc)
        logger.info(
            "Starting interpretation pipeline: dataset=%s, job=%s",
            dataset_id,
            job_id,
        )

        try:
            # Load modules for this job
            result = await self._db.execute(
                select(Module)
                .where(Module.job_id == uuid.UUID(job_id))
                .order_by(Module.module_index)
            )
            modules = list(result.scalars().all())

            if not modules:
                logger.warning("No modules found for job=%s", job_id)
                return {"status": "no_modules", "module_count": 0}

            # Load checkpoint path for embeddings
            job_result = await self._db.execute(
                select(CrystallizationJob).where(
                    CrystallizationJob.id == uuid.UUID(job_id)
                )
            )
            job = job_result.scalar_one()
            checkpoint_path = job.checkpoint_path

            # Step 1: Analyze each module and calculate purity
            analyses = []
            purities = []
            for module in modules:
                analysis = await self._module_analyzer.analyze_module(
                    module, dataset_id
                )
                analyses.append(analysis)

                purity = await self._purity_calculator.calculate(module)
                purities.append(purity)

                # Update module record
                await self._db.execute(
                    update(Module)
                    .where(Module.id == module.id)
                    .values(
                        purity_score=purity.score,
                        dominant_type=purity.dominant_type,
                        type_distribution=purity.distribution,
                        internal_density=analysis.internal_density,
                        anchor_entities=[
                            {"name": a.name, "centrality": a.degree_centrality}
                            for a in analysis.anchor_entities
                        ],
                    )
                )

            await self._db.flush()

            # Step 2: Detect hidden connections
            hidden_connections = []
            if checkpoint_path:
                try:
                    wrapper = TCDJEPAWrapper()
                    embeddings = await wrapper.get_embeddings(checkpoint_path)

                    hidden_connections = await self._hidden_detector.detect(
                        modules, embeddings, dataset_id
                    )

                    # Store hidden connections
                    await self._store_hidden_connections(
                        hidden_connections, modules, job_id
                    )
                except Exception:
                    logger.warning(
                        "Hidden connection detection failed; continuing pipeline",
                        exc_info=True,
                    )

            # Step 3: Generate LLM descriptions
            analysis_pairs = list(zip(analyses, [p.score for p in purities]))
            descriptions = await self._describer.describe_batch(analysis_pairs)

            # Update module names and descriptions
            for desc in descriptions:
                await self._db.execute(
                    update(Module)
                    .where(Module.id == uuid.UUID(desc.module_id))
                    .values(
                        name=desc.name,
                        description=desc.description,
                        confidence=desc.confidence,
                    )
                )

            await self._db.flush()

            # Step 4: Cross-module analysis
            cross_report = await self._cross_analyzer.analyze(
                modules, dataset_id
            )
            await self._cross_analyzer.store_results(cross_report, modules)

            # Step 5: Record lineage
            await self._record_lineage(dataset_id, job_id, modules)

            await self._db.commit()

            elapsed = (datetime.now(timezone.utc) - pipeline_start).total_seconds()
            logger.info(
                "Interpretation pipeline completed in %.2fs: "
                "%d modules, %d hidden connections, %d cross-module pairs",
                elapsed,
                len(modules),
                len(hidden_connections),
                len(cross_report.module_pair_analyses),
            )

            return {
                "status": "completed",
                "module_count": len(modules),
                "hidden_connection_count": len(hidden_connections),
                "cross_module_pairs": len(cross_report.module_pair_analyses),
                "bridge_entity_count": len(cross_report.bridge_entities),
                "avg_purity": round(
                    sum(p.score for p in purities) / len(purities), 4
                ),
                "elapsed_seconds": elapsed,
            }

        except Exception:
            logger.exception(
                "Interpretation pipeline failed: dataset=%s, job=%s",
                dataset_id,
                job_id,
            )
            raise

    async def _store_hidden_connections(
        self,
        connections: list,
        modules: list[Module],
        job_id: str,
    ) -> None:
        """Persist detected hidden connections to PostgreSQL."""
        index_to_id = {m.module_index: m.id for m in modules}

        for conn in connections:
            src_mod_id = index_to_id.get(conn.source_module_index)
            tgt_mod_id = index_to_id.get(conn.target_module_index)
            if src_mod_id is None or tgt_mod_id is None:
                continue

            hc = HiddenConnection(
                job_id=uuid.UUID(job_id),
                source_entity=conn.source_entity,
                target_entity=conn.target_entity,
                source_module_id=src_mod_id,
                target_module_id=tgt_mod_id,
                similarity_score=conn.similarity_score,
                has_direct_edge=conn.has_direct_edge,
            )
            self._db.add(hc)

        await self._db.flush()
        logger.info("Stored %d hidden connections", len(connections))

    async def _record_lineage(
        self, dataset_id: str, job_id: str, modules: list[Module]
    ) -> None:
        """Record interpretation lineage events."""
        event = LineageEvent(
            event_type="interpretation",
            subject_type="crystallization_job",
            subject_id=uuid.UUID(job_id),
            actor_type="system",
            actor_id=uuid.UUID(job_id),
            action="interpretation_completed",
            inputs={"job_id": job_id, "dataset_id": dataset_id},
            outputs={
                "module_count": len(modules),
                "module_ids": [str(m.id) for m in modules],
            },
        )
        self._db.add(event)
        await self._db.flush()
