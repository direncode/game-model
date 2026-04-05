"""Celery task for BTUT RAG analysis + report generation."""

from __future__ import annotations

import asyncio
import json
import logging

from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="btut.generate_report",
    queue="reports",
    bind=True,
    max_retries=2,
    soft_time_limit=300,
    time_limit=360,
)
def generate_btut_report_task(
    self,
    entity_keys: list[str],
    dataset_id: str = "edgar",
    report_format: str = "pdf",
    report_type: str = "full_analysis",
    user_id: str | None = None,
):
    """Async BTUT report generation: RAG fetch + Claude synthesis + PDF/DOCX render."""
    task_id = self.request.id
    logger.info("BTUT report starting: entities=%s dataset=%s format=%s", entity_keys, dataset_id, report_format)

    self.update_state(state="PROGRESS", meta={"step": "fetching_sources", "entities": entity_keys})

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(
            _generate_report_async(self, entity_keys, dataset_id, report_format, report_type)
        )
        return result
    finally:
        loop.close()


async def _generate_report_async(task, entity_keys, dataset_id, report_format, report_type):
    """Async implementation of report generation."""
    from app.services.btut.query_engine import get_query_engine
    from app.services.btut.rag_engine import RAGEngine
    from app.services.btut.rag_synthesizer import RAGSynthesizer, BTUTContext
    from app.services.btut.btut_report_generator import BTUTReportGenerator

    engine = get_query_engine(dataset_id=dataset_id)
    rag = RAGEngine()
    synthesizer = RAGSynthesizer()
    report_gen = BTUTReportGenerator()

    entity_data = []
    rag_syntheses = []

    for i, key in enumerate(entity_keys):
        task.update_state(state="PROGRESS", meta={
            "step": "analyzing",
            "entity": key,
            "progress": f"{i+1}/{len(entity_keys)}",
        })

        # Get BTUT analysis
        analysis = engine.analyze(key)
        if not analysis:
            logger.warning("Entity not found: %s", key)
            continue

        entity_data.append(analysis)

        # Build BTUT context
        metadata = analysis.get("metadata", {})
        ctx = BTUTContext(
            entity_key=key,
            entity_name=analysis.get("company_name") or analysis.get("ticker", key),
            entity_type=analysis.get("entity_type", ""),
            dataset_id=dataset_id,
            scores=analysis.get("scores", {}),
            structural_role=metadata.get("structural_role", {}).get("role", ""),
            role_description=metadata.get("structural_role", {}).get("description", ""),
            fingerprint=analysis.get("lattice_profile", {}).get("fingerprint_48bit", ""),
            flips=analysis.get("lattice_profile", {}).get("total_flips", 0),
            cluster_id=analysis.get("cluster", {}).get("id", -1),
            cluster_size=analysis.get("cluster", {}).get("total_members", 0),
            anomaly_tags=metadata.get("anomaly_taxonomy", []),
            anomaly_story=analysis.get("anomaly_story", ""),
            peer_network=metadata.get("peer_network", []),
            attributes=analysis.get("attributes", {}),
        )

        # Fetch and index sources
        task.update_state(state="PROGRESS", meta={
            "step": "fetching_sources",
            "entity": key,
        })

        manifest = await rag.fetch_and_index(
            entity_key=key,
            dataset_id=dataset_id,
            entity_attrs=analysis.get("attributes", {}),
            entity_type=analysis.get("entity_type", ""),
        )

        # Search for relevant chunks
        chunks = await rag.search_chunks(key, dataset_id, top_k=15)

        # Synthesize with Claude
        task.update_state(state="PROGRESS", meta={
            "step": "synthesizing",
            "entity": key,
            "chunks": len(chunks),
        })

        synthesis, was_cached = await synthesizer.synthesize_cached(ctx, chunks)
        rag_syntheses.append(synthesis.to_dict())

    if not entity_data:
        return {"status": "error", "message": "No valid entities found"}

    # Generate report
    task.update_state(state="PROGRESS", meta={"step": "rendering", "format": report_format})

    report = await report_gen.generate(
        entity_data=entity_data,
        rag_syntheses=rag_syntheses,
        dataset_id=dataset_id,
        report_format=report_format,
        report_type=report_type,
    )

    # Save to disk (MinIO integration can be added later)
    import os
    from pathlib import Path
    report_dir = Path("/app/data/reports")
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / report.filename
    report_path.write_bytes(report.content_bytes)

    logger.info("Report generated: %s (%d bytes)", report.filename, len(report.content_bytes))

    return {
        "status": "completed",
        "filename": report.filename,
        "format": report_format,
        "size_bytes": len(report.content_bytes),
        "entity_count": len(entity_data),
        "download_path": str(report_path),
    }
