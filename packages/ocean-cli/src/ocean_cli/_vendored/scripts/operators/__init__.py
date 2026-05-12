"""Operator framework for the open-core universal pipeline.

This is the vendored open-core copy of the runtime. It uses an
instance-based registry (one operator instance per `kind`) rather than the
class-based `@register` decorator used in the closed-source full runtime.
The simpler shape is easier to ship inside a wheel and avoids the
hard dependency on `numpy`/`torch`/`sklearn` at import time — those
remain in the operator modules where they belong.

Each operator module (embed.py, cluster.py, source.py, persist.py, etc.)
declares a module-local `_REGISTRY: dict[str, OperatorInstance]` and a
`get(name) -> instance|None` helper. The pipeline runner walks every
registered module and merges them into a single dispatch table.

`load_config(path)`:
    - `.ocean` → compile via the vendored compiler → step dicts
    - `.yaml`/`.yml` → safe YAML load
    - `.json` and everything else → JSON

`run_pipeline(cfg)`:
    - resolves each step's input refs from the running state dict
    - dispatches via the merged operator registry
    - returns the final state
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


# ── Step / pipeline dataclasses ──────────────────────────────────────────

@dataclass
class StepConfig:
    name: str
    kind: str
    inputs: dict[str, str] = field(default_factory=dict)
    config: dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineConfig:
    seed: int = 42
    steps: list[StepConfig] = field(default_factory=list)


# ── Operator dispatch ────────────────────────────────────────────────────

def _merged_registry() -> dict[str, Any]:
    """Walk every operator submodule and merge its `_REGISTRY` dict."""
    out: dict[str, Any] = {}
    # Import lazily to avoid circular imports during package init
    from . import embed, cluster, align, reduce, source, persist, find  # noqa: F401
    for mod in (embed, cluster, align, reduce, source, persist, find):
        reg = getattr(mod, "_REGISTRY", None)
        if isinstance(reg, dict):
            out.update(reg)
    return out


def _signature(kind: str, inputs: dict, seed: int, config: dict) -> str:
    h = hashlib.sha256()
    h.update(kind.encode())
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


def run_pipeline(pipeline: PipelineConfig, *, verbose: bool = True) -> dict[str, Any]:
    """Execute a pipeline DAG. Returns the full state dict.

    State is keyed `<step_name>.<output_key>`. Step inputs reference upstream
    outputs by these dotted keys; the runner looks them up before calling
    the operator's `.run()`.
    """
    registry = _merged_registry()
    state: dict[str, Any] = {}
    timings: list[dict] = []

    for step in pipeline.steps:
        op = registry.get(step.kind)
        if op is None:
            raise KeyError(
                f"unknown operator kind: {step.kind!r}. "
                f"Registered kinds: {sorted(registry.keys())}"
            )

        inputs: dict[str, Any] = {}
        for in_name, ref in step.inputs.items():
            if ref not in state:
                # Soft-skip: a dangling reference (e.g. an optional upstream
                # that wasn't compiled in this build) is dropped rather than
                # raising. Operators that actually need the input should
                # error on their own missing-key check.
                if verbose:
                    print(
                        f"  [{step.name}] note: input {in_name!r} ref "
                        f"{ref!r} not in state — skipping",
                        flush=True,
                    )
                continue
            inputs[in_name] = state[ref]

        sig = _signature(step.kind, inputs, pipeline.seed, step.config)
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
    """Load a pipeline config from `.ocean`, `.yaml`/`.yml`, or `.json`.

    `.ocean` files use the full lexer + parser + typecheck + compile pipeline.
    """
    path = Path(path)
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".ocean":
        from .ocean.compiler import compile_ocean
        from .ocean.parser import ParseError
        from .ocean.lexer import LexerError
        from .ocean.compiler import CompileError
        try:
            raw = compile_ocean(text, source_name=str(path))
        except (LexerError, ParseError, CompileError) as e:
            # Bubble up as a human-readable error
            msg = e.pretty(str(path)) if hasattr(e, "pretty") else str(e)
            raise SystemExit(msg) from e
    elif path.suffix in {".yaml", ".yml"}:
        try:
            import yaml
        except ImportError as e:
            raise RuntimeError("install pyyaml to use .yaml configs") from e
        raw = yaml.safe_load(text)
    else:
        raw = json.loads(text)

    steps_raw = raw.get("steps", []) or []
    steps = [
        StepConfig(
            **{k: v for k, v in s.items() if k in {"name", "kind", "inputs", "config"}}
        )
        for s in steps_raw
    ]
    return PipelineConfig(seed=raw.get("seed", 42), steps=steps)
