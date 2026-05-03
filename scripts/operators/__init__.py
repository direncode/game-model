"""Operator framework for the universal pipeline.

An Operator is a pure function with typed input/output + seed. Pipelines
are DAGs of operators expressed in YAML/JSON config. This replaces the
~50 hand-stitched pipeline scripts in scripts/ with a config-driven runner
+ a small library of reusable operators.

Eight stages of the universal pipeline:

    [0a] SOURCE      harvest / load corpus -> NDJSON records
    [0b] EMBED       text|numeric|graph -> Z (matrix)
    [1]  REDUCE      BTUT or stratified sample or no-op
    [2]  CLUSTER     TCD recursive loop / KMeans / LDA / IF / LOF
    [3]  ALIGN       modules <-> gold labels
    [3b] DISPERSE    per-class destination basin tally
    [4]  NARRATE     plain-English per-module text
    [5]  PERSIST     JSON artifact + sha256 manifest

Adding a new corpus is normally just:
    - a new Source operator (if the data shape is novel)
    - a config file picking which operators run with what params

See docs/UNIVERSAL_PIPELINE.md for the conceptual contract this implements.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, ClassVar


# ── Operator base class ──────────────────────────────────────────────────

class Operator:
    """Base operator. Subclasses declare:

        kind:   ClassVar[str]               # registry key, e.g. 'embed.tfidf'
        stage:  ClassVar[str]               # one of: source, embed, reduce,
                                            # cluster, align, narrate, persist
        inputs: dict[str, type]             # required upstream output names
        outputs: dict[str, type]            # what this operator produces

    and implement:

        def run(self, inputs: dict, *, seed: int = 42, config: dict) -> dict

    The runner threads outputs through the state dict, addressed by
    `<operator_name>.<output_key>`. Determinism contract: for any (inputs,
    seed, config), repeated calls produce byte-identical outputs.
    """

    kind: ClassVar[str] = ""
    stage: ClassVar[str] = ""

    def run(self, inputs: dict[str, Any], *, seed: int, config: dict) -> dict[str, Any]:
        raise NotImplementedError

    def signature(self, inputs: dict, seed: int, config: dict) -> str:
        """Stable hash for caching: SHA-256 of (kind, seed, config, input-shapes)."""
        h = hashlib.sha256()
        h.update(self.kind.encode())
        h.update(str(seed).encode())
        h.update(json.dumps(config, sort_keys=True, default=str).encode())
        for k in sorted(inputs.keys()):
            v = inputs[k]
            try:
                shape = getattr(v, "shape", None) or len(v)
            except (TypeError, AttributeError):
                shape = "scalar"
            h.update(f"{k}:{shape}".encode())
        return h.hexdigest()[:16]


# ── Registry ─────────────────────────────────────────────────────────────

_REGISTRY: dict[str, type[Operator]] = {}


def register(cls: type[Operator]) -> type[Operator]:
    """Decorator: add an operator class to the registry by its `kind`."""
    if not cls.kind:
        raise ValueError(f"{cls.__name__} must set the `kind` class attribute")
    _REGISTRY[cls.kind] = cls
    return cls


def get_operator(kind: str) -> type[Operator]:
    if kind not in _REGISTRY:
        raise KeyError(f"unknown operator kind: {kind!r}; registered: {sorted(_REGISTRY)}")
    return _REGISTRY[kind]


def registered_kinds() -> list[str]:
    return sorted(_REGISTRY.keys())


# ── Pipeline runner ──────────────────────────────────────────────────────

@dataclass
class StepConfig:
    name: str                              # logical name in the DAG
    kind: str                              # registered operator kind
    inputs: dict[str, str] = field(default_factory=dict)
                                           # logical input -> "<step>.<output>" reference
    config: dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineConfig:
    seed: int = 42
    steps: list[StepConfig] = field(default_factory=list)


def run_pipeline(pipeline: PipelineConfig, *, verbose: bool = True) -> dict[str, Any]:
    """Execute a pipeline DAG. Returns the full state dict.

    State is keyed `<step_name>.<output_key>`. Step inputs reference
    upstream outputs by these dotted keys; the runner looks them up.
    """
    state: dict[str, Any] = {}
    timings: list[dict] = []
    for step in pipeline.steps:
        op_cls = get_operator(step.kind)
        op = op_cls()
        # Resolve inputs from prior state
        inputs = {}
        for in_name, ref in step.inputs.items():
            if ref not in state:
                raise KeyError(
                    f"step {step.name!r} input {in_name!r} references "
                    f"{ref!r} but that key is not yet in state. "
                    f"Available keys: {sorted(state.keys())}"
                )
            inputs[in_name] = state[ref]

        sig = op.signature(inputs, pipeline.seed, step.config)
        if verbose:
            print(f"  [{step.name}] kind={step.kind} sig={sig} ...", flush=True)
        t0 = time.perf_counter()
        outputs = op.run(inputs, seed=pipeline.seed, config=step.config)
        wall = round(time.perf_counter() - t0, 3)

        if not isinstance(outputs, dict):
            raise TypeError(
                f"operator {step.kind} returned {type(outputs).__name__}, "
                f"expected dict[str, Any]"
            )
        for out_key, out_val in outputs.items():
            state[f"{step.name}.{out_key}"] = out_val
        timings.append({"step": step.name, "kind": step.kind, "wall_s": wall, "sig": sig})
        if verbose:
            print(f"    done in {wall}s, outputs: {list(outputs.keys())}", flush=True)

    state["_pipeline.timings"] = timings
    state["_pipeline.seed"] = pipeline.seed
    return state


# ── Config loading ───────────────────────────────────────────────────────

def load_config(path: Path) -> PipelineConfig:
    """Load a pipeline config from JSON, YAML, or `.ocean` (OCEAN language).

    `.ocean` files use the full lexer + parser + compiler pipeline; see
    docs/OCEAN_LANG.md for the language spec.
    """
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".ocean":
        from .ocean import compile_ocean
        from .ocean.parser import ParseError
        from .ocean.lexer import LexerError
        from .ocean.compiler import CompileError
        try:
            raw = compile_ocean(text, source_name=str(path))
        except (LexerError, ParseError, CompileError) as e:
            print(e.pretty(str(path)))
            raise SystemExit(1) from e
    elif path.suffix in {".yaml", ".yml"}:
        try:
            import yaml
        except ImportError as e:
            raise RuntimeError("install pyyaml to use .yaml configs") from e
        raw = yaml.safe_load(text)
    else:
        raw = json.loads(text)
    steps_raw = raw.get("steps", [])
    # Drop bookkeeping keys that StepConfig doesn't accept
    steps = [StepConfig(**{k: v for k, v in s.items() if k in {"name", "kind", "inputs", "config"}})
             for s in steps_raw]
    return PipelineConfig(seed=raw.get("seed", 42), steps=steps)
