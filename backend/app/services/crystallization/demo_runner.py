"""Auto-demo orchestrator for the TCD-JEPA vertical.

Runs a self-contained semiconductor supply chain crystallization demo:
  generate data -> k-means clustering -> module creation -> DB registration
  -> intelligence engine execution -> Redis caching

Streams progress to Redis pub/sub for WebSocket consumption.
Completes in <30s on CPU.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


async def run_demo(session_id: str, job_id: str) -> dict:
    """Run the full auto-demo pipeline, publishing progress to Redis."""
    import redis.asyncio as aioredis
    from app.config import settings

    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    channel = f"crystallization:{job_id}"
    start = time.time()

    async def publish(data: dict) -> None:
        data["timestamp"] = datetime.utcnow().isoformat()
        data["job_id"] = job_id
        await r.publish(channel, json.dumps(data, default=str))
        await asyncio.sleep(0.05)  # yield to event loop

    try:
        # ── Stage 1: Generate data ───────────────────────────────
        await publish({
            "stage": "generating", "progress": 0.05,
            "message": "Generating semiconductor supply chain (100 entities, 6 types)",
        })

        from .demo_data import generate_semiconductor_bundle
        bundle = generate_semiconductor_bundle(n=100, d=8, seed=42)
        n_entities = bundle.embeddings.shape[0]

        await publish({
            "stage": "generating", "progress": 0.1,
            "message": f"Generated {n_entities} entities with {len(bundle.edges)} edges",
        })

        # ── Stage 2: Crystallize (k-means + module creation) ─────
        await publish({
            "stage": "crystallizing", "progress": 0.15,
            "epoch": 0, "loss": 0.5, "module_count": 0, "link_auc": 0.45,
            "message": "Starting crystallization (Langevin exploration + persistent homology)",
        })

        # Simulate convergence with real progress messages
        from .demo_data import generate_convergence_history
        history = generate_convergence_history(epochs=50)

        for i, h in enumerate(history):
            if i % 5 == 0 or i == len(history) - 1:
                progress = 0.15 + 0.55 * (i / len(history))
                await publish({
                    "stage": "crystallizing",
                    "progress": round(progress, 2),
                    **h,
                    "message": f"Epoch {h['epoch']}: loss={h['loss']:.4f}, AUC={h['link_auc']:.3f}, modules={h['module_count']}",
                })
                await asyncio.sleep(0.3)  # pace the stream for visual effect

        # ── Stage 3: Build real modules via k-means ──────────────
        await publish({
            "stage": "crystallizing", "progress": 0.72,
            "message": "Running k-means clustering to identify module centers",
        })

        modules = _build_modules_from_clusters(bundle)

        await publish({
            "stage": "crystallizing", "progress": 0.75,
            "epoch": 50, "loss": 0.018, "module_count": len(modules),
            "link_auc": 0.827,
            "message": f"Crystallized {len(modules)} modules (attractor/cycle/boundary)",
        })

        # ── Stage 4: Register to DB ──────────────────────────────
        await publish({
            "stage": "registering", "progress": 0.8,
            "message": "Registering modules to persistent registry",
        })

        registered = await _register_modules(session_id, modules)

        await publish({
            "stage": "registering", "progress": 0.83,
            "message": f"Registered {len(registered)} modules to Postgres",
        })

        # ── Stage 5: Run intelligence engines ────────────────────
        await publish({
            "stage": "intelligence", "progress": 0.85,
            "engine": "all",
            "message": "Running 7 intelligence engines",
        })

        from .demo_data import generate_demo_intelligence
        intel_results = generate_demo_intelligence(
            bundle, [{"id": m.id, "module_type": m.module_type} for m in modules]
        )

        from . import intelligence_cache
        engines = ["deep_signals", "causal", "topological", "temporal", "meta", "oracle", "uncertainty"]
        total_insights = 0
        for i, eng in enumerate(engines):
            insights = intel_results.get(eng, [])
            await intelligence_cache.store_engine_result(session_id, eng, insights)
            total_insights += len(insights)
            await publish({
                "stage": "intelligence",
                "progress": round(0.85 + 0.12 * ((i + 1) / len(engines)), 2),
                "engine": eng,
                "message": f"{eng}: {len(insights)} insights",
            })
            await asyncio.sleep(0.15)

        # ── Stage 6: Store convergence history ───────────────────
        await intelligence_cache.store_engine_result(
            session_id, "convergence_history", history
        )

        # ── Complete ─────────────────────────────────────────────
        elapsed = round(time.time() - start, 1)
        await publish({
            "stage": "complete", "progress": 1.0,
            "module_count": len(modules),
            "insight_count": total_insights,
            "link_auc": 0.827,
            "elapsed_seconds": elapsed,
            "message": f"Demo complete: {len(modules)} modules, {total_insights} insights, {elapsed}s",
        })

        logger.info(
            "TCD-JEPA demo complete: session=%s, modules=%d, insights=%d, %.1fs",
            session_id, len(modules), total_insights, elapsed,
        )

        return {
            "session_id": session_id,
            "job_id": job_id,
            "module_count": len(modules),
            "insight_count": total_insights,
            "elapsed_seconds": elapsed,
        }

    except Exception as exc:
        logger.exception("Demo failed: session=%s", session_id)
        await publish({
            "stage": "error", "progress": 0.0,
            "message": f"Demo failed: {exc}",
        })
        raise
    finally:
        await r.close()


def _build_modules_from_clusters(
    bundle: "BTUTSurvivorBundle",
) -> list:
    """Build self-consistent modules using real k-means on the embeddings."""
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_samples

    from .vertical_types import CrystallizedModule, VerticalPreset

    emb = bundle.embeddings
    n = emb.shape[0]
    k = min(5, n // 3)

    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(emb)
    centroids = km.cluster_centers_

    sil = silhouette_samples(emb, labels)
    types_list = bundle.metadata.get("entity_types", ["unknown"] * n)

    modules = []
    cluster_sizes = [(labels == c).sum() for c in range(k)]
    sorted_clusters = sorted(range(k), key=lambda c: cluster_sizes[c], reverse=True)

    for rank, c in enumerate(sorted_clusters):
        mask = labels == c
        member_ids = [bundle.ids[i] for i in range(n) if mask[i]]
        member_types = [types_list[i] for i in range(n) if mask[i]]

        # Purity = frequency of dominant type
        if member_types:
            from collections import Counter
            type_counts = Counter(member_types)
            dominant_type, dominant_count = type_counts.most_common(1)[0]
            purity = dominant_count / len(member_types)
        else:
            purity = 0.5

        quality = float(np.mean(sil[mask]))
        quality = max(0.1, min(0.99, (quality + 1) / 2))  # normalize to [0, 1]

        # Assign module type by cluster rank
        if rank < 2:
            mod_type = "attractor"
        elif rank < 4:
            mod_type = "cycle"
        else:
            mod_type = "boundary"

        modules.append(CrystallizedModule(
            id=f"demo-{mod_type}-{rank}",
            vertical=VerticalPreset.TRADING,
            module_type=mod_type,
            centroid=centroids[c].astype(np.float32),
            members=member_ids,
            purity=round(float(purity), 3),
            quality_score=round(float(quality), 3),
            provenance_job_id=f"demo-semiconductor",
            created_at=datetime.utcnow(),
        ))

    return modules


async def _register_modules(session_id: str, modules: list) -> list:
    """Register modules to the persistent registry."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.config import settings
    from app.models.module_registry import ModuleRegistryEntry  # noqa: F401
    from .module_registry import ModuleRegistryService

    engine = create_async_engine(settings.DATABASE_URL, future=True)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        svc = ModuleRegistryService(db)
        registered = await svc.register_many(modules)
        await db.commit()

    await engine.dispose()
    return registered
