"""OCEAN Foreign Function Interface — register Python operators from .ocean.

Users declare:

    extern fn my_metric(z : Z, k : Number) -> Dispersion
        impl python:my_module.my_metric

The compiler treats `my_metric` as a callable operator-kind. At runtime,
the runner imports `my_module.my_metric` and invokes it with the resolved
inputs. This is the language's escape hatch for reaching Python.

The FFI wraps an existing operator class (any subclass of Operator) into
the language. A registered FFI operator gets:
  - a registry entry (so the runner can dispatch to it)
  - an automatic schema entry derived from the extern declaration
  - a typed signature the type-checker enforces

Usage from Python side (registering an operator):

    from scripts.operators.ocean.ffi import register_extern
    register_extern("my_metric", my_metric_func, input_types={"z": "Z"},
                    output_type="Dispersion")
"""
from __future__ import annotations

from typing import Any, Callable

from .. import Operator, register


_FFI_REGISTRY: dict[str, dict] = {}


class FFIOperator(Operator):
    """An auto-generated operator that wraps a Python callable.

    The class is dynamically subclassed per `extern fn` declaration, so
    the registry keys are stable across invocations.
    """
    kind = "ffi.dispatch"
    stage = "extern"

    def run(self, inputs, *, seed, config):
        kind_name = config.get("_ffi_kind")
        entry = _FFI_REGISTRY.get(kind_name)
        if entry is None:
            raise RuntimeError(f"FFI operator {kind_name!r} not registered")
        fn = entry["fn"]
        result = fn(**{k: inputs.get(k) for k in entry["input_keys"]})
        return result if isinstance(result, dict) else {"value": result}


# Register the dispatcher once
register(FFIOperator)


def register_extern(name: str, fn: Callable, *,
                    input_types: dict[str, str],
                    output_type: str) -> None:
    """Register a Python function as a callable FFI operator.

    Args:
        name:         operator name as used in OCEAN (the `extern fn` ident)
        fn:           the Python callable
        input_types:  parameter -> OCEAN type name
        output_type:  the OCEAN type name of the return value
    """
    _FFI_REGISTRY[name] = {
        "fn":          fn,
        "input_keys":  list(input_types.keys()),
        "input_types": input_types,
        "output_type": output_type,
    }


def lookup_extern(name: str) -> dict | None:
    return _FFI_REGISTRY.get(name)


def list_externs() -> list[str]:
    return sorted(_FFI_REGISTRY.keys())
