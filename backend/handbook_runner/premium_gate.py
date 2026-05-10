"""Operator registry — the single source of truth for free vs premium.

Plan A reads this module to generate Appendix B's catalog table. The
runner imports it to gate premium-operator execution. CI checks both
sides agree.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Tier = Literal["free", "premium"]


@dataclass(frozen=True)
class OperatorSpec:
    name: str
    tier: Tier
    signature: str            # one-line type signature, e.g. "Records -> Z"
    summary: str              # one-sentence English description
    schema: dict[str, str] = field(default_factory=dict)  # param name -> short desc


OPERATOR_REGISTRY: dict[str, OperatorSpec] = {
    "load.ndjson": OperatorSpec(
        name="load.ndjson",
        tier="free",
        signature="Path -> Records",
        summary="Load an NDJSON corpus from disk, optionally stratifying the sample.",
        schema={
            "take": "sample N records (after stratification if balanced by)",
            "balanced_by": "round-robin sample across distinct values of this field",
            "text_field": "which field holds the text body (default 'text')",
            "label_field": "which field holds the coarse gold label (default 'archive')",
        },
    ),
    "embed.tfidf_jl": OperatorSpec(
        name="embed.tfidf_jl",
        tier="free",
        signature="Records -> Z",
        summary="TF-IDF embedding followed by Johnson-Lindenstrauss random projection to D dimensions.",
        schema={
            "dimensions": "target embedding dimension (typical: 64-256)",
            "min_df": "minimum document frequency for a term to be kept",
            "max_df": "maximum document frequency (drops stopword-like terms)",
            "max_features": "vocabulary cap (default: unlimited)",
        },
    ),
    "embed.transformer.minilm_l6": OperatorSpec(
        name="embed.transformer.minilm_l6",
        tier="free",
        signature="Records -> Z",
        summary="MiniLM-L6 sentence-transformer embedding at 384 dimensions native.",
        schema={
            "dimensions": "target dimension; non-native sizes are linearly projected",
        },
    ),
    "embed.content_fp48": OperatorSpec(
        name="embed.content_fp48",
        tier="premium",
        signature="Records -> Z",
        summary="Bloom-style 48-bit content fingerprint over top-K terms (premium structural primitive).",
        schema={
            "dimensions": "always 48 - fingerprint width is fixed by the primitive spec",
        },
    ),
    "reduce.btut": OperatorSpec(
        name="reduce.btut",
        tier="premium",
        signature="(Z, Records) -> (Z, Records)",
        summary="BTUT structural-anomaly pre-reduction targeting N survivors within a compute budget.",
        schema={
            "target": "target number of surviving records after reduction",
            "budget": "compute budget in dollars (proxy for time)",
        },
    ),
    "cluster.kmeans": OperatorSpec(
        name="cluster.kmeans",
        tier="free",
        signature="Z -> Modules",
        summary="Standard k-means clustering with deterministic initialization.",
        schema={
            "rounds": "number of Lloyd iterations",
            "max_modules": "upper bound on module count",
            "energy": "either 'corpus mean' or 'normal anchored on LABEL'",
        },
    ),
    "cluster.tcd_recursive_loop": OperatorSpec(
        name="cluster.tcd_recursive_loop",
        tier="premium",
        signature="Z -> Modules",
        summary="TCD recursive-loop clustering with monotone module-energy guarantees (premium algorithm).",
        schema={
            "rounds": "number of recursive-loop iterations",
            "max_modules": "upper bound on module count",
            "energy": "either 'corpus mean' or 'normal anchored on LABEL'",
            "crystallize_every": "freeze converged modules every K rounds",
        },
    ),
    "align.module": OperatorSpec(
        name="align.module",
        tier="free",
        signature="(Modules, Records, Z) -> Aligned",
        summary="Align modules to records via k-nearest neighbors.",
        schema={
            "k_nearest": "number of records per module to align",
            "fine_label_field": "which field holds the fine-grained label",
        },
    ),
    "align.dispersion": OperatorSpec(
        name="align.dispersion",
        tier="premium",
        signature="(Modules, Records, Z) -> Aligned",
        summary="Dispersion-weighted alignment (premium alignment with module-quality scoring).",
        schema={
            "k_nearest": "number of records per module to align",
            "fine_label_field": "which field holds the fine-grained label",
        },
    ),
    "find.dispersion_per_label": OperatorSpec(
        name="find.dispersion_per_label",
        tier="free",
        signature="(Aligned, Records, Z) -> Dispersion",
        summary="Compute the dispersion of each label across modules.",
        schema={},
    ),
    "persist.json": OperatorSpec(
        name="persist.json",
        tier="free",
        signature="Any -> Artifact",
        summary="Write the input value as pretty-printed JSON to disk, with a sha256 sidecar.",
        schema={
            "path": "output path; must end in .json",
        },
    ),
}


def is_free_tier(name: str) -> bool:
    op = OPERATOR_REGISTRY.get(name)
    return op is not None and op.tier == "free"


def is_premium(name: str) -> bool:
    op = OPERATOR_REGISTRY.get(name)
    return op is not None and op.tier == "premium"


def diagnostic_for_premium_op(name: str, *, line: int, col: int) -> dict[str, Any]:
    return {
        "ok": False,
        "category": "runtime",
        "diagnostic": {
            "line": line,
            "col": col,
            "token": name,
            "message": (
                f"this operator ({name}) requires a paid API key; "
                f"execution is blocked in the handbook sandbox"
            ),
            "hint": (
                "see https://latentocean.com/protocols for an API key, "
                "or copy this snippet and run locally with OCEAN_API_KEY set"
            ),
        },
    }
