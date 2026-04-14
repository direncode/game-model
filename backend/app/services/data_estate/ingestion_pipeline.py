"""Document ingestion pipeline for the Data Estate vertical.

Pipeline: Document text -> Entities/Edges -> BTUT -> TCD-JEPA -> Module Registry
"""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime
from typing import Any

import numpy as np

from app.services.btut.pipeline import run_btut_pipeline
from app.services.crystallization.vertical import TCDJEPAVertical
from app.services.crystallization.vertical_types import (
    BTUTSurvivorBundle,
    VerticalPreset,
)

logger = logging.getLogger(__name__)


def text_to_entities(
    raw_text: str,
    doc_id: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> tuple[list[dict], list[dict]]:
    """Convert document text into entities (chunks) and edges (similarity)."""
    paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [raw_text]

    chunks: list[str] = []
    for para in paragraphs:
        if len(para) <= chunk_size:
            chunks.append(para)
        else:
            start = 0
            while start < len(para):
                end = min(start + chunk_size, len(para))
                if end < len(para):
                    last_period = para.rfind(".", start, end)
                    if last_period > start + chunk_size // 2:
                        end = last_period + 1
                chunks.append(para[start:end].strip())
                start = end - overlap if end < len(para) else end

    entities: list[dict] = []
    for i, chunk in enumerate(chunks):
        entity_id = f"{doc_id}:chunk:{i}"
        section = _detect_section(chunk)
        entities.append({
            "name": entity_id,
            "type": "document_chunk",
            "attributes": {
                "text": chunk,
                "chunk_index": i,
                "section_hint": section,
                "char_count": len(chunk),
                "word_count": len(chunk.split()),
                "doc_id": doc_id,
            },
        })

    edges: list[dict] = []
    for i in range(len(entities) - 1):
        edges.append({
            "source": entities[i]["name"],
            "target": entities[i + 1]["name"],
            "type": "adjacent",
            "weight": 0.8,
        })
    for i in range(len(entities)):
        words_i = set(entities[i]["attributes"]["text"].lower().split())
        for j in range(i + 2, min(i + 6, len(entities))):
            words_j = set(entities[j]["attributes"]["text"].lower().split())
            overlap_ratio = len(words_i & words_j) / max(len(words_i | words_j), 1)
            if overlap_ratio > 0.15:
                edges.append({
                    "source": entities[i]["name"],
                    "target": entities[j]["name"],
                    "type": "semantic_overlap",
                    "weight": overlap_ratio,
                })

    return entities, edges


def _detect_section(text: str) -> str:
    first_line = text.split("\n")[0].strip()
    if first_line.isupper() and len(first_line) < 100:
        return first_line
    if re.match(r"^(\d+\.|\([a-z]\)|[IVXLC]+\.)\s", first_line):
        return first_line[:80]
    return ""


async def run_estate_pipeline(
    raw_text: str,
    doc_id: str,
    target_survivors: int = 100,
    budget_dollars: float = 10.0,
    progress_callback: Any | None = None,
    registry_service: Any | None = None,
) -> dict:
    """Full pipeline: text -> entities -> BTUT -> TCD-JEPA -> registry."""
    entities, edges = text_to_entities(raw_text, doc_id)
    unique_types = sorted({e.get("type", "unknown") for e in entities})

    if len(entities) < 3:
        logger.warning("Document %s produced only %d chunks, skipping", doc_id, len(entities))
        return {"doc_id": doc_id, "status": "skipped", "reason": "too_few_chunks", "chunk_count": len(entities)}

    logger.info("Estate pipeline: doc=%s chunks=%d edges=%d", doc_id, len(entities), len(edges))

    btut_result = run_btut_pipeline(
        entities=entities, edges=edges, unique_types=unique_types,
        target_survivors=target_survivors, budget_dollars=budget_dollars,
        progress_callback=progress_callback,
    )

    survivors = btut_result.get("survivors", [])
    flat_embeds = btut_result.get("embeddings_8d", [])
    n_survivors = len(survivors)

    if n_survivors == 0:
        return {"doc_id": doc_id, "status": "no_survivors", "chunk_count": len(entities)}

    if flat_embeds and len(flat_embeds) == n_survivors * 8:
        embeddings = np.asarray(flat_embeds, dtype=np.float32).reshape(n_survivors, 8)
    else:
        embeddings = np.random.randn(n_survivors, 8).astype(np.float32)

    ids = [s["entity"]["name"] for s in survivors]
    bundle_edges: list[tuple[int, int, float]] = []
    id_to_idx = {eid: i for i, eid in enumerate(ids)}
    for edge in edges:
        src_idx = id_to_idx.get(edge["source"])
        dst_idx = id_to_idx.get(edge["target"])
        if src_idx is not None and dst_idx is not None:
            bundle_edges.append((src_idx, dst_idx, edge.get("weight", 1.0)))

    bundle = BTUTSurvivorBundle(
        embeddings=embeddings, ids=ids, edges=bundle_edges,
        metadata={"provenance_job_id": f"estate-{doc_id}", "doc_id": doc_id},
    )

    vertical = TCDJEPAVertical(preset=VerticalPreset.DATA_ESTATE, registry_service=registry_service)
    vertical.ingest_btut(bundle)

    try:
        modules = await vertical.crystallize(job_id=f"estate-{doc_id}")
    except Exception as exc:
        logger.error("Crystallization failed for doc %s: %s", doc_id, exc)
        return {"doc_id": doc_id, "status": "crystallization_failed", "error": str(exc), "survivor_count": n_survivors}

    registered = []
    if registry_service is not None:
        try:
            registered = await vertical.register(modules)
        except Exception as exc:
            logger.warning("Module registration failed: %s", exc)

    return {
        "doc_id": doc_id, "status": "completed", "chunk_count": len(entities),
        "survivor_count": n_survivors, "module_count": len(modules),
        "registered_count": len(registered),
        "reduction_ratio": len(entities) / max(n_survivors, 1),
        "completed_at": datetime.utcnow().isoformat(),
    }


def compute_file_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
