"""Parameter schemas — the English-facing knobs for every operator.

Each operator declares a PARAM_SCHEMA describing every config knob with:
  - the technical key (used in YAML/JSON)
  - an English label (shown in the frontend)
  - a one-sentence description (the "why does this matter")
  - a type + range/choices + default

This is what makes a pipeline readable in plain English, what the frontend
form generator binds to, and what the DSL parser maps from natural-language
statements onto.

Englishify principle: a parameter named `crystallize_every` is technical;
its English label "How often to look for new basins" is what a user sees.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Param:
    key: str                    # technical name in config dict
    english: str                # what the frontend label says
    description: str            # one-sentence explanation
    type: str                   # 'int' | 'float' | 'enum' | 'string' | 'bool'
    default: Any
    min: float | None = None
    max: float | None = None
    choices: list[str] | None = None
    advanced: bool = False      # hide behind "advanced" toggle in UI


# ── Schemas, one per operator kind ─────────────────────────────────────

SOURCE_NDJSON = [
    Param("path", "Corpus file", "Where to load records from.", "string", default=None),
    Param("target", "How many records to process",
          "Process at most this many. Smaller = faster, more focused; larger = "
          "more signal but slower. Default sweeps the typical 'enough' range.",
          "int", default=500, min=50, max=50000),
    Param("stratify_by", "Balance the sample by",
          "Field to balance the sample across. Without this, larger archives "
          "dominate. Set to your coarse-label field for fair representation.",
          "string", default=None, advanced=True),
    Param("text_field", "Where the text body lives", "Field name holding the text body.",
          "string", default="text", advanced=True),
    Param("label_field", "Coarse label field",
          "Field that holds the gold/coarse label, used downstream for alignment.",
          "string", default="archive"),
]

EMBED_TFIDF_JL = [
    Param("dims", "Embedding dimensions",
          "Vector size for each record. 64 is fine for small corpora; 128 is the "
          "TNA-validated default; 256+ wastes compute on this scale.",
          "int", default=128, min=32, max=512),
    Param("max_features", "Vocabulary cap",
          "TF-IDF vocabulary maximum before projection. 10k is a reasonable cap "
          "for archival prose; raise for technical corpora with rich vocab.",
          "int", default=10_000, min=500, max=100_000, advanced=True),
    Param("min_df", "Drop rare terms",
          "Term must appear in at least this many records to count. 2 catches "
          "typos; 5+ for noisier corpora.",
          "int", default=2, min=1, max=20, advanced=True),
    Param("max_df", "Drop ubiquitous terms",
          "Drop terms appearing in this fraction of records (they carry no signal).",
          "float", default=0.85, min=0.5, max=1.0, advanced=True),
]

EMBED_ONEHOT_NUMERIC = [
    Param("dims", "Embedding dimensions", "Vector size; smaller for purely numeric data.",
          "int", default=64, min=16, max=256),
    Param("categorical", "Which fields are categorical",
          "Attributes to one-hot encode. Other fields are kept as numeric.",
          "string", default=None, advanced=True),
]

EMBED_TRANSFORMER = [
    Param("max_length", "Max tokens per record",
          "Token-level truncation cap. 128 is fine for catalog/abstract-style "
          "records; raise to 256 or 512 for long documents.",
          "int", default=128, min=32, max=512),
    Param("batch_size", "Records per forward pass",
          "How many records the transformer encodes in one batch. 16 fits on "
          "CPU comfortably; 32-64 if a GPU is available.",
          "int", default=16, min=1, max=128, advanced=True),
]

CLUSTER_TCD = [
    Param("iters", "Recursive-loop rounds",
          "How many explore-then-crystallize rounds. 16 is the validated TNA+NSLKDD "
          "default; 24+ rarely yields new structure.",
          "int", default=16, min=4, max=64),
    Param("max_modules", "Max basins to form",
          "Module budget. The loop will stop crystallizing past this. 24 is "
          "comfortable for ~500 records; raise for richer corpora.",
          "int", default=24, min=4, max=128),
    Param("crystallize_every", "How often to look for new basins",
          "Every Nth iteration the System-3 crystallizer runs. 2 means every "
          "other iter. Higher = fewer modules, more selective.",
          "int", default=2, min=1, max=10, advanced=True),
    Param("langevin_steps", "Exploration steps per round",
          "How many Langevin-dynamics steps the System-2 explorer takes per "
          "iteration. More = wider exploration, slower.",
          "int", default=30, min=5, max=200, advanced=True),
    Param("energy", "What counts as low-energy",
          "Mode-seeking ('corpus mean') is the honest default — finds dense "
          "regions without label leakage. 'Normal-anchored' uses a label and "
          "finds anomaly basins; only use when one label is privileged.",
          "enum", default="corpus_mean", choices=["corpus_mean", "normal_centroid"]),
    Param("normal_label", "Which label is 'normal'",
          "Required only when energy='normal_centroid'. The label value to anchor on.",
          "string", default=None, advanced=True),
]

ALIGN_MODULE = [
    Param("k_nearest", "Records per basin to inspect",
          "How many records around each module's centroid to count for "
          "dominant-share / bleed scoring. 50 is the TNA+NSLKDD default.",
          "int", default=50, min=10, max=500),
    Param("fine_label_field", "Fine label field",
          "Field for the fine/sub-label (e.g. attack subtype, primary HW reference). "
          "Used for sub-structure analysis only.",
          "string", default="primary_category", advanced=True),
]

ALIGN_DISPERSION: list[Param] = []  # No tunable params; reads inputs

PERSIST_JSON = [
    Param("output", "Output file", "Where to write the JSON artifact.",
          "string", default=None),
]


# Operator-kind → schema lookup
SCHEMAS: dict[str, list[Param]] = {
    "source.ndjson":              SOURCE_NDJSON,
    "embed.tfidf_jl":             EMBED_TFIDF_JL,
    "embed.onehot_numeric":       EMBED_ONEHOT_NUMERIC,
    "embed.transformer":          EMBED_TRANSFORMER,
    "cluster.tcd_recursive_loop": CLUSTER_TCD,
    "align.module":               ALIGN_MODULE,
    "align.dispersion":           ALIGN_DISPERSION,
    "persist.json":               PERSIST_JSON,
}


def schema_to_dict(schema: list[Param]) -> list[dict]:
    """JSON-serializable view of a schema for the frontend API."""
    return [
        {
            "key":         p.key,
            "english":     p.english,
            "description": p.description,
            "type":        p.type,
            "default":     p.default,
            "min":         p.min,
            "max":         p.max,
            "choices":     p.choices,
            "advanced":    p.advanced,
        }
        for p in schema
    ]


def all_schemas() -> dict[str, list[dict]]:
    """All operator schemas as JSON, ready to ship to the frontend."""
    return {kind: schema_to_dict(s) for kind, s in SCHEMAS.items()}


def validate_config(kind: str, config: dict) -> list[str]:
    """Return a list of error messages, empty if config is valid."""
    schema = SCHEMAS.get(kind)
    if schema is None:
        return [f"unknown operator kind: {kind!r}"]
    errors: list[str] = []
    keys_in_schema = {p.key for p in schema}
    for k in config:
        if k not in keys_in_schema:
            errors.append(f"{kind}: unknown param {k!r} (allowed: {sorted(keys_in_schema)})")
    for p in schema:
        v = config.get(p.key, p.default)
        if v is None and p.default is None:
            continue  # required-but-not-provided is caught at runtime
        if p.type == "int":
            if not isinstance(v, int):
                errors.append(f"{kind}.{p.key}: expected int, got {type(v).__name__}")
            elif p.min is not None and v < p.min:
                errors.append(f"{kind}.{p.key}={v} below min {p.min}")
            elif p.max is not None and v > p.max:
                errors.append(f"{kind}.{p.key}={v} above max {p.max}")
        elif p.type == "float":
            if not isinstance(v, (int, float)):
                errors.append(f"{kind}.{p.key}: expected float, got {type(v).__name__}")
            elif p.min is not None and v < p.min:
                errors.append(f"{kind}.{p.key}={v} below min {p.min}")
            elif p.max is not None and v > p.max:
                errors.append(f"{kind}.{p.key}={v} above max {p.max}")
        elif p.type == "enum":
            if v is not None and v not in (p.choices or []):
                errors.append(f"{kind}.{p.key}={v!r} not in choices {p.choices}")
    return errors
