"""Generator ABC — the seam for future fine-tuning.

Core ships with `TemplateGenerator`, a deterministic, offline narrator.
Customers plug in a `FineTunedGenerator` (their own weights, their own
training data) and everything else keeps working unchanged.

Invariant: Generator output AUGMENTS findings; it never changes their
shape. Fine-tuning is additive, never core.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from lo_core.schemas import Findings


class Generator(ABC):
    """Produce human-readable narrative from structured findings.

    Implementations:
      - `TemplateGenerator` (shipped): deterministic template fill.
      - `FineTunedGenerator` (customer-supplied): local fine-tuned model.
    """

    @abstractmethod
    def narrate_corpus(self, findings: Findings) -> str:
        """One-paragraph narrative summary of the corpus analysis."""
        raise NotImplementedError

    @abstractmethod
    def narrate_entity(self, findings: Findings, entity_name: str) -> str:
        """Per-entity explanation (why this entity is interesting)."""
        raise NotImplementedError


class TemplateGenerator(Generator):
    """Deterministic template-based narrator.

    Serves as (a) baseline for fine-tune evaluation and (b) guaranteed
    fallback when no fine-tune is available.
    """

    def narrate_corpus(self, findings: Findings) -> str:
        parts: list[str] = []
        parts.append(
            f"{findings.corpus_id}: {findings.survivor_count} survivors across "
            f"{findings.cluster_count} clusters."
        )
        hypotheses = (findings.paradigm_distribution or {}).get("hypothesis_by_corpus", {})
        confirmed = [c for c, h in hypotheses.items() if h.get("confirmed")]
        if confirmed:
            parts.append(f"Paradigm hypothesis confirmed for: {', '.join(sorted(confirmed))}.")
        not_confirmed = [c for c, h in hypotheses.items() if not h.get("confirmed")]
        if not_confirmed:
            parts.append(f"Hypothesis not confirmed for: {', '.join(sorted(not_confirmed))}.")
        if findings.convergent_clusters:
            top = findings.convergent_clusters[0]
            parts.append(
                f"Densest convergent cluster: {top.cluster} "
                f"({top.hot_count}/{top.total} hot, "
                f"{int(top.hot_fraction * 100)}%); dominant paradigm {top.dominant_paradigm or 'mixed'}."
            )
        if findings.cross_era_anchors:
            names = ", ".join(a.name for a in findings.cross_era_anchors[:3])
            parts.append(f"Cross-era anchors: {names}.")
        if findings.convergence_index:
            top = findings.convergence_index[0]
            parts.append(
                f"Top convergence entity: {top.name} (score {top.convergence:.3f})."
            )
        return " ".join(parts)

    def narrate_entity(self, findings: Findings, entity_name: str) -> str:
        # Pull the row from the convergence index if present
        for entry in findings.convergence_index:
            if entry.name == entity_name:
                d = entry.dimensions
                parts = [
                    f"anomaly {int(d.get('anomaly', 0) * 100)}%",
                    f"cluster-rank {int(d.get('cluster_percentile', 0) * 100)}%",
                ]
                if d.get("cross_era", 0) > 0:
                    parts.append("cross-era anchor")
                if d.get("rare_fingerprint", 0) >= 0.7:
                    parts.append("rare cross-corpus fingerprint")
                return f"{entity_name}: " + " · ".join(parts)
        # Fall back to within-cluster rank
        rank = findings.within_cluster_rank.get(entity_name)
        if rank:
            return (
                f"{entity_name}: rank {rank.rank}/{rank.total_in_cluster} "
                f"in cluster {rank.cluster}"
            )
        return f"{entity_name}: no analytic signal above threshold."
