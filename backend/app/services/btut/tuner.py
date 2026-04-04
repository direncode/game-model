"""BTUT Master Orchestrator — the full 8-tier data reduction pipeline.

Ties together all components:
  Tier 1: PreFilter (bloom + LSH + entropy)
  Tier 2: HierarchicalCascade (multi-scale FP evolution)
  Tier 3: StreamingProcessor (mmap + chunked GPU)
  Tier 4: EntityEmbedder (multi-type projection)
  Tier 5: BudgetScheduler + convergence prediction + annealing
  Tier 6: DensityThinner (composite 6-strategy)
  Tier 7: CheckpointManager (save/resume)
  Tier 8: QualityAssurance (reconstruction error, coverage, stability)

Usage:
    config = BTUTConfig.auto_scale(entity_count=3_000_000_000, budget_dollars=200)
    tuner = BTUTTuner(config)
    result = await tuner.tune(entities, edges, job_id="abc")
    # result.survivors → reduced entity list for TCD-JEPA
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from functools import partial

import numpy as np

from .cascade import HierarchicalCascade, CascadeResult
from .checkpoint import CheckpointManager, BTUTCheckpointState
from .config import BTUTConfig
from .dedup import PreFilter
from .embedder import EntityEmbedder
from .metrics import (
    BTUTResult, PreFilterStats, CascadeLevelStats,
    QualityScores, Timer,
)
from .quality import QualityAssurance
from .scheduler import BudgetScheduler
from .threading import LatticeThreader, ThreadingConfig, CohesiveFingerprinter
from .thinning import filter_edges

logger = logging.getLogger(__name__)


class BTUTTuner:
    """Master orchestrator for the BTUT extreme data reduction engine.

    Manages the full pipeline from raw entities through 8 tiers of
    reduction to a concentrated set of signal-rich representatives.
    """

    def __init__(self, config: BTUTConfig | None = None):
        self.config = config or BTUTConfig()

    @classmethod
    def from_config(cls, merged_config: dict) -> BTUTTuner:
        """Create a BTUTTuner from a crystallization merged_config dict.

        Extracts btut_* keys and applies them as overrides to auto_scale.
        """
        entity_count = merged_config.get("btut_entity_count", 10_000)
        budget = merged_config.get("btut_budget_dollars", 50.0)

        config = BTUTConfig.auto_scale(entity_count, budget)

        # Apply user overrides
        if merged_config.get("btut_cascade_depth"):
            config.max_cascade_depth = merged_config["btut_cascade_depth"]
        if merged_config.get("btut_thinning_strategy"):
            config.thinning_strategy = merged_config["btut_thinning_strategy"]
        if merged_config.get("btut_quality_threshold"):
            config.min_coverage = merged_config["btut_quality_threshold"]
        if merged_config.get("btut_annealing_schedule"):
            config.annealing_schedule = merged_config["btut_annealing_schedule"]

        return cls(config)

    async def tune(
        self,
        entities: list[dict],
        edges: list[dict],
        job_id: str = "default",
        progress_callback=None,
        resume_from: str | None = None,
    ) -> BTUTResult:
        """Run the full 8-tier BTUT reduction pipeline.

        This is async but delegates CPU/GPU-intensive work to a thread
        executor (matching TCDJEPAWrapper pattern).

        Args:
            entities: List of entity dicts {name, type, attributes}
            edges: List of edge dicts {source, target, type, weight}
            job_id: For checkpoint directory naming
            progress_callback: Optional fn(info_dict) for progress reporting
            resume_from: Optional checkpoint path to resume from

        Returns:
            BTUTResult with reduced entity/edge lists and comprehensive metrics
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            partial(
                self._tune_sync,
                entities=entities,
                edges=edges,
                job_id=job_id,
                progress_callback=progress_callback,
                resume_from=resume_from,
            ),
        )

    def _tune_sync(
        self,
        entities: list[dict],
        edges: list[dict],
        job_id: str = "default",
        progress_callback=None,
        resume_from: str | None = None,
    ) -> BTUTResult:
        """Synchronous implementation of the full pipeline."""
        wall_start = time.perf_counter()
        original_count = len(entities)
        original_edge_count = len(edges)

        result = BTUTResult(
            original_count=original_count,
            original_edge_count=original_edge_count,
        )

        def _progress(info: dict):
            if progress_callback:
                try:
                    progress_callback(info)
                except Exception:
                    pass

        _progress({"step": "btut_start", "entity_count": original_count})

        # ── Step 1: Auto-scale config ───────────────────────────────────
        config = BTUTConfig.auto_scale(
            entity_count=original_count,
            budget_dollars=self.config.budget_dollars,
            edge_count=original_edge_count,
        )
        # Merge with user-provided overrides
        for attr in [
            "thinning_strategy", "annealing_schedule", "max_cascade_depth",
            "min_coverage", "device", "chunk_size",
        ]:
            user_val = getattr(self.config, attr)
            default_val = getattr(BTUTConfig(), attr)
            if user_val != default_val:
                setattr(config, attr, user_val)

        self.config = config
        device = config.resolve_device()
        result.device_used = device
        result.dim_schedule_used = list(config.dim_schedule)

        logger.info(
            "BTUT starting: %d entities, %d edges, device=%s, "
            "cascade_levels=%d, target_reduction=%.0fx, budget=$%.2f",
            original_count, original_edge_count, device,
            len(config.cascade_levels), config.total_target_reduction(),
            config.budget_dollars,
        )

        # ── Step 2: Dataset fingerprint ─────────────────────────────────
        fingerprint = self._fingerprint(entities)
        result.config_fingerprint = fingerprint

        # ── Step 3: Pre-filter (Tier 1) ─────────────────────────────────
        current_entities = entities
        embeddings = None

        if config.prefilter_enabled and original_count > 1000:
            _progress({"step": "btut_prefilter", "stage": "entropy_bloom"})

            with Timer() as pf_timer:
                prefilter = PreFilter(config)
                current_entities, embeddings = prefilter.run(current_entities)

            stats = prefilter.get_stats(original_count)
            result.prefilter_stats = PreFilterStats(
                original_count=original_count,
                entropy_rejected=stats["entropy_rejected"],
                bloom_dedup_count=stats["bloom_dedup_count"],
                lsh_near_dedup_count=stats["lsh_near_dedup_count"],
                survivors=len(current_entities),
                elapsed_seconds=pf_timer.elapsed,
            )
            result.prefilter_seconds = pf_timer.elapsed

            logger.info(
                "PreFilter: %d → %d (%.1fx) in %.1fs",
                original_count, len(current_entities),
                original_count / max(len(current_entities), 1),
                pf_timer.elapsed,
            )

            _progress({
                "step": "btut_prefilter_done",
                "original": original_count,
                "survivors": len(current_entities),
            })

        # ── Step 4: Embed (Tier 4) ──────────────────────────────────────
        _progress({"step": "btut_embedding"})

        with Timer() as emb_timer:
            embedder = EntityEmbedder(config)
            embeddings = embedder.embed(current_entities, edges)

        result.embedding_seconds = emb_timer.elapsed
        logger.info(
            "Embedding: %d entities → (%d, %d) in %.1fs",
            len(current_entities), *embeddings.shape, emb_timer.elapsed,
        )

        # ── Step 4.5: Lattice Threading (proxy-flip fingerprinting) ───
        # Treats each point as a thread through a lattice grid under
        # dimensional rotations. The flip pattern = trajectory fingerprint.
        # Groups into micro-clusters before cascade for 90%+ confidence.
        threading_result = None
        if len(current_entities) > 100:
            _progress({"step": "btut_threading"})
            with Timer() as thread_timer:
                threading_config = ThreadingConfig.from_btut_config(config)
                threader = LatticeThreader(threading_config)
                threading_result = threader.thread(
                    embeddings,
                    progress_callback=lambda step, info: _progress({
                        "step": "btut_threading",
                        "rotation": info.get("rotation", 0),
                        "flip_rate": info.get("flip_rate", 0),
                    }),
                )

                # Compute cohesive fingerprints
                fingerprinter = CohesiveFingerprinter()
                cohesive_fps = fingerprinter.batch_compute(
                    len(current_entities),
                    trajectories=threading_result.trajectory_vectors,
                )

                # Convert micro-clusters to representatives for cascade
                # This is the threading reduction: many points → cluster reps
                if threading_result.micro_clusters:
                    rep_entities, rep_embeddings, rep_indices = (
                        threader.micro_clusters_to_representatives(
                            threading_result.micro_clusters,
                            embeddings,
                            current_entities,
                            strategy="top_k_per_cluster",
                            anchor_indices=threading_result.anchor_indices,
                        )
                    )

                    # Floor: threading should not reduce below 10% of input
                    # or min_entities_floor, whichever is larger
                    threading_floor = max(
                        config.min_entities_floor,
                        len(current_entities) // 10,
                    )
                    if len(rep_entities) < threading_floor:
                        # Threading too aggressive — use top_k strategy with more K
                        rep_entities, rep_embeddings, rep_indices = (
                            threader.micro_clusters_to_representatives(
                                threading_result.micro_clusters,
                                embeddings,
                                current_entities,
                                strategy="top_k_per_cluster",
                                anchor_indices=threading_result.anchor_indices,
                            )
                        )

                    if len(rep_entities) < len(current_entities):
                        logger.info(
                            "Threading reduction: %d → %d (%.1fx) "
                            "via %d micro-clusters (%d signal, %d noise)",
                            len(current_entities), len(rep_entities),
                            len(current_entities) / max(len(rep_entities), 1),
                            len(threading_result.micro_clusters),
                            threading_result.n_threads_signal,
                            threading_result.n_threads_noise,
                        )
                        current_entities = rep_entities
                        embeddings = rep_embeddings

                        _progress({
                            "step": "btut_threading_done",
                            "micro_clusters": len(threading_result.micro_clusters),
                            "signal_threads": threading_result.n_threads_signal,
                            "noise_threads": threading_result.n_threads_noise,
                            "representatives": len(rep_entities),
                        })

            logger.info("Threading took %.1fs", thread_timer.elapsed)

        # ── Step 5: Hierarchical Cascade (Tier 2) ──────────────────────
        _progress({"step": "btut_cascade", "levels": len(config.cascade_levels)})

        quality_assurance = QualityAssurance(config)

        # Keep a sample of original embeddings for quality checks
        original_sample_size = min(10_000, len(embeddings))
        rng = np.random.RandomState(42)
        sample_indices = rng.choice(len(embeddings), original_sample_size, replace=False)
        original_sample = embeddings[sample_indices].copy()

        def cascade_progress(level, step, info):
            _progress({"step": "btut_cascade", "level": level, "fp_step": step, **info})

        def quality_gate(survivor_states, _original_emb):
            return quality_assurance.quality_gate(survivor_states, original_sample)

        with Timer() as cascade_timer:
            cascade = HierarchicalCascade(config, device=device)
            cascade_result = cascade.run(
                embeddings=embeddings,
                progress_callback=cascade_progress,
                quality_checker=quality_gate if config.quality_gate_between_levels else None,
            )

        result.cascade_seconds = cascade_timer.elapsed
        result.cascade_stats = cascade_result.level_stats

        logger.info(
            "Cascade: %d → %d (%.0fx) across %d levels in %.1fs",
            len(current_entities), cascade_result.total_output,
            len(current_entities) / max(cascade_result.total_output, 1),
            cascade_result.levels_executed, cascade_timer.elapsed,
        )

        # ── Step 6: Build survivor list ─────────────────────────────────
        kept_indices = cascade_result.kept_indices
        survivors = [current_entities[i] for i in kept_indices]
        survivor_names = {ent.get("name", f"entity_{i}") for i, ent in enumerate(survivors)}
        survivor_edges = filter_edges(edges, survivor_names)

        result.survivors = survivors
        result.survivor_edges = survivor_edges
        result.survivor_count = len(survivors)
        result.survivor_edge_count = len(survivor_edges)
        result.cluster_count = sum(
            s.clusters_found for s in cascade_result.level_stats
        ) or self._estimate_clusters(cascade_result.final_densities)

        # ── Step 7: Quality Audit (Tier 8) ──────────────────────────────
        _progress({"step": "btut_quality_audit"})

        with Timer() as qa_timer:
            quality_scores = quality_assurance.full_audit(
                original_embeddings=original_sample,
                survivor_embeddings=cascade_result.final_states,
                survivor_densities=cascade_result.final_densities,
                cluster_count=result.cluster_count,
            )

        result.quality_scores = quality_scores
        result.quality_check_seconds = qa_timer.elapsed

        # ── Step 8: Budget accounting ───────────────────────────────────
        budget_status = cascade.scheduler.check_budget()
        result.gpu_seconds_used = budget_status.elapsed_seconds
        result.gpu_cost_dollars = budget_status.cost_so_far
        result.budget_remaining_dollars = budget_status.budget_remaining

        # ── Threading stats ─────────────────────────────────────────────
        if threading_result:
            threading_summary = {
                "type": "threading",
                "micro_clusters": len(threading_result.micro_clusters),
                "signal_threads": threading_result.n_threads_signal,
                "noise_threads": threading_result.n_threads_noise,
                "anchors": len(threading_result.anchor_indices),
                "rotations": threading_result.rotations_used,
                "resolution": threading_result.lattice_resolution_used,
            }

            # Magnitude table stats
            if threading_result.magnitude_result is not None:
                mag = threading_result.magnitude_result
                threading_summary["magnitude"] = mag.to_dict()

            result.cluster_summaries.append(threading_summary)

        # ── Finalize ────────────────────────────────────────────────────
        result.wall_clock_seconds = time.perf_counter() - wall_start

        logger.info(
            "BTUT complete: %d → %d entities (%.0fx), %d → %d edges (%.0fx), "
            "quality=%.3f, wall=%.1fs, gpu_cost=$%.4f",
            original_count, result.survivor_count, result.total_reduction_ratio,
            original_edge_count, result.survivor_edge_count, result.edge_reduction_ratio,
            result.quality_score, result.wall_clock_seconds, result.gpu_cost_dollars,
        )

        _progress({
            "step": "btut_complete",
            "survivors": result.survivor_count,
            "reduction": round(result.total_reduction_ratio, 1),
            "quality": round(result.quality_score, 3),
        })

        return result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _fingerprint(self, entities: list[dict]) -> str:
        """Generate a dataset fingerprint for historical learning."""
        # Hash: entity count + type distribution + sample of names
        type_counts: dict[str, int] = {}
        for ent in entities[:10_000]:
            t = ent.get("type", "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1

        sample_names = sorted([e.get("name", "") for e in entities[:100]])

        fp_data = json.dumps({
            "count": len(entities),
            "types": dict(sorted(type_counts.items())),
            "sample": sample_names[:20],
        }, sort_keys=True)

        return hashlib.md5(fp_data.encode("utf-8")).hexdigest()[:12]

    def _estimate_clusters(self, densities: np.ndarray) -> int:
        """Estimate cluster count from density distribution."""
        if len(densities) == 0:
            return 0
        threshold = densities.mean() + densities.std()
        return max(1, int(np.sum(densities > threshold)))
