"""Englishify DSL — natural-language pipeline syntax.

Users write pipelines as a sequence of English statements; the parser
translates them into the operator-config JSON the runner expects.

Example DSL:

    Load tmp/bombe_tna_full.ndjson, take 500 records balanced by archive
    Embed text into 128 dimensions
    Cluster using TCD recursive loop, 16 rounds, energy = corpus mean
    Align modules using 50 nearest records, label field is archive
    Find dispersion of each label
    Save to data/validation/tna_run.json

This compiles to the equivalent JSON config of the universal runner.

The DSL is intentionally rigid (verb-keyed grammar) so the LLM-shaped
ambiguity stays out of the parameter values. Users edit knobs through
the schema (see schema.py); the DSL just picks operators and hooks them
up. A graphical frontend would render the same statements as labeled
form rows.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass
class DSLError(Exception):
    line: int
    text: str
    message: str

    def __str__(self):
        return f"line {self.line}: {self.text!r} — {self.message}"


# ── Verb table: each verb maps to (operator_kind, arg parser) ────────────

VERB_TO_OP = {
    "load":      "source.ndjson",
    "embed":     "embed.tfidf_jl",         # default; overridable
    "cluster":   "cluster.tcd_recursive_loop",
    "align":     "align.module",
    "find":      "align.dispersion",       # "find dispersion ..."
    "save":      "persist.json",
}

# Stage names used to wire inputs across steps automatically.
DEFAULT_STEP_INPUTS: dict[str, dict[str, str]] = {
    "embed": {
        "records": "source.records",
        "text_field": "source.text_field",
    },
    "cluster": {
        "Z": "embed.Z",
        "records": "source.records",
        "label_field": "source.label_field",
    },
    "align": {
        "modules": "cluster.modules",
        "records": "source.records",
        "Z": "embed.Z",
        "label_field": "source.label_field",
    },
    "disperse": {
        "aligned_modules": "align.aligned_modules",
        "records": "source.records",
        "Z": "embed.Z",
        "label_field": "source.label_field",
    },
    "persist": {
        "aligned_modules":      "align.aligned_modules",
        "dispersion_per_label": "disperse.dispersion_per_label",
        "per_record_assignments": "disperse.per_record_assignments",
    },
}


# ── Tokenizer ────────────────────────────────────────────────────────────

NUM_RE  = re.compile(r"\d+(?:\.\d+)?")
PATH_RE = re.compile(r"[\w./\\-]+\.(?:ndjson|json|csv|tsv|txt|yaml|yml)")


def parse_dsl(text: str) -> dict:
    """Parse a multi-line DSL text into a pipeline-config dict.

    Returns the same shape `load_config` accepts:
        {"seed": int, "steps": [{name, kind, inputs, config}, ...]}
    """
    lines = [(i + 1, ln.strip()) for i, ln in enumerate(text.splitlines())]
    lines = [(n, ln) for n, ln in lines if ln and not ln.startswith("#")]

    seed = 42
    steps: list[dict] = []

    for line_no, raw in lines:
        ln = raw.lower()
        if ln.startswith("seed"):
            m = NUM_RE.search(raw)
            if not m:
                raise DSLError(line_no, raw, "expected a number after 'seed'")
            seed = int(m.group())
            continue

        # Pick the verb (first whitespace-separated word)
        verb = ln.split(None, 1)[0]
        if verb not in VERB_TO_OP:
            raise DSLError(line_no, raw,
                           f"unknown verb {verb!r}; allowed: {sorted(VERB_TO_OP)}")
        kind = VERB_TO_OP[verb]
        rest = raw.split(None, 1)[1] if " " in raw else ""

        # Special-case "find dispersion": override the kind.
        if verb == "find":
            if "disper" not in ln:
                raise DSLError(line_no, raw, "only 'find dispersion ...' is supported here")
            kind = "align.dispersion"
            steps.append({
                "name": "disperse", "kind": kind,
                "inputs": DEFAULT_STEP_INPUTS["disperse"], "config": {},
            })
            continue

        config = _parse_args(verb, rest, line_no, raw)
        name = {"load": "source", "embed": "embed", "cluster": "cluster",
                "align": "align", "save": "persist"}.get(verb, verb)
        inputs = DEFAULT_STEP_INPUTS.get(name, {})
        steps.append({"name": name, "kind": kind, "inputs": inputs, "config": config})

    return {"seed": seed, "steps": steps}


# ── Per-verb argument parsers ────────────────────────────────────────────

def _parse_args(verb: str, rest: str, line_no: int, raw: str) -> dict:
    """Verb-specific argument extraction. Each verb has its own grammar."""
    if verb == "load":
        return _parse_load(rest, line_no, raw)
    if verb == "embed":
        return _parse_embed(rest, line_no, raw)
    if verb == "cluster":
        return _parse_cluster(rest, line_no, raw)
    if verb == "align":
        return _parse_align(rest, line_no, raw)
    if verb == "save":
        return _parse_save(rest, line_no, raw)
    return {}


def _parse_load(rest: str, line_no: int, raw: str) -> dict:
    """Load <path> [, take <N> records [balanced by <field>]] [, label field is <field>]"""
    cfg: dict = {}
    path_m = PATH_RE.search(rest)
    if not path_m:
        raise DSLError(line_no, raw, "expected a file path ending in .ndjson/.csv/...")
    cfg["path"] = path_m.group()

    take_m = re.search(r"take\s+(\d+)\s+records?", rest, re.I)
    if take_m:
        cfg["target"] = int(take_m.group(1))

    balanced_m = re.search(r"balanced\s+by\s+(\w+)", rest, re.I)
    if balanced_m:
        cfg["stratify_by"] = balanced_m.group(1)

    label_m = re.search(r"label\s+field\s+is\s+(\w+)", rest, re.I)
    if label_m:
        cfg["label_field"] = label_m.group(1)

    text_m = re.search(r"text\s+field\s+is\s+(\w+)", rest, re.I)
    if text_m:
        cfg["text_field"] = text_m.group(1)
    return cfg


def _parse_embed(rest: str, line_no: int, raw: str) -> dict:
    """Embed text into <D> dimensions [using TF-IDF | content fingerprint | one-hot]"""
    cfg: dict = {}
    dim_m = re.search(r"(\d+)\s*dim", rest, re.I)
    if dim_m:
        cfg["dims"] = int(dim_m.group(1))
    return cfg


def _parse_cluster(rest: str, line_no: int, raw: str) -> dict:
    """Cluster using TCD ... [, <N> rounds] [, max <M> modules]
        [, energy = corpus mean | normal anchored on <label>]"""
    cfg: dict = {}
    rounds_m = re.search(r"(\d+)\s*rounds?", rest, re.I)
    if rounds_m:
        cfg["iters"] = int(rounds_m.group(1))

    max_m = re.search(r"max\s+(\d+)\s+modules?", rest, re.I)
    if max_m:
        cfg["max_modules"] = int(max_m.group(1))

    if "corpus mean" in rest.lower():
        cfg["energy"] = "corpus_mean"
    elif "normal anchored" in rest.lower():
        cfg["energy"] = "normal_centroid"
        anchor_m = re.search(r"anchored\s+on\s+(\w+)", rest, re.I)
        if anchor_m:
            cfg["normal_label"] = anchor_m.group(1)

    crys_m = re.search(r"crystallize\s+every\s+(\d+)", rest, re.I)
    if crys_m:
        cfg["crystallize_every"] = int(crys_m.group(1))
    return cfg


def _parse_align(rest: str, line_no: int, raw: str) -> dict:
    """Align modules using <K> nearest records [, fine label field is <field>]"""
    cfg: dict = {}
    k_m = re.search(r"(\d+)\s+nearest", rest, re.I)
    if k_m:
        cfg["k_nearest"] = int(k_m.group(1))
    fine_m = re.search(r"fine\s+label\s+field\s+is\s+(\w+)", rest, re.I)
    if fine_m:
        cfg["fine_label_field"] = fine_m.group(1)
    return cfg


def _parse_save(rest: str, line_no: int, raw: str) -> dict:
    """Save to <path>"""
    cfg: dict = {}
    path_m = PATH_RE.search(rest)
    if not path_m:
        raise DSLError(line_no, raw, "expected a file path")
    cfg["output"] = path_m.group()
    return cfg
