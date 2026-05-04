"""OCEAN macros — compile-time AST manipulation via quote/unquote.

A macro is a function that produces AST nodes at compile time. Unlike
regular `define`, which is inlined as-is, macros let you parameterize
*the structure* of the pipeline, not just its values.

Example use case: a macro that wraps any embedder in a content-vs-structural
comparison:

    macro compare_with_content(embedder_call) do
        compare
            ${embedder_call}
        against
            embed text using content fingerprint
        on dispersion of directorate_to_pm
    end

Then any caller can:

    compare_with_content(embed text into 128 dimensions)

…and get a full compare block expanded.

Implementation: macros are stored as raw AST and `${var}` placeholders are
resolved at expansion time by substituting the call argument's AST.

This is `quote` (treat the body as data) + `unquote` (splice in a value)
pattern. Lisp-style.

This is v1.1's first cut: only positional template substitution, no
hygiene, no recursive macros. It's enough for the common case (wrapping
a small body in larger boilerplate).
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from .ast import (
    DefineDecl, MacroDecl, IdentRef, VerbStmt, Param,
)


_MACRO_REGISTRY: dict[str, MacroDecl] = {}


def register_macro(macro: MacroDecl):
    """Add a macro to the global registry. Macros live separately from
    define functions because they take AST nodes, not values."""
    _MACRO_REGISTRY[macro.name] = macro


def expand_macro(name: str, arg_asts: list[Any]) -> list[Any]:
    """Expand a macro call. arg_asts are the AST nodes passed positionally.

    Returns the body of the macro with parameters substituted by the
    matching arg AST nodes.
    """
    macro = _MACRO_REGISTRY.get(name)
    if macro is None:
        raise KeyError(f"unknown macro {name!r}")
    if len(arg_asts) != len(macro.params):
        raise ValueError(
            f"macro {name!r} expects {len(macro.params)} arg(s), got {len(arg_asts)}"
        )
    bindings = dict(zip(macro.params, arg_asts))
    body = deepcopy(macro.body)
    return [_substitute(stmt, bindings) for stmt in body]


def _substitute(node, bindings: dict[str, Any]):
    """Walk a node, replacing IdentRef occurrences whose name is a macro
    parameter with the corresponding arg AST."""
    if isinstance(node, IdentRef) and node.name in bindings:
        return bindings[node.name]
    if isinstance(node, VerbStmt):
        # Walk into args and the from_ref
        new = deepcopy(node)
        if new.from_ref in bindings:
            substituted = bindings[new.from_ref]
            # Substituted is a verb_stmt; we'll just adopt its bind_name
            new.from_ref = getattr(substituted, "bind_name", None) or new.from_ref
        return new
    if isinstance(node, list):
        return [_substitute(x, bindings) for x in node]
    return node


def list_macros() -> list[str]:
    return sorted(_MACRO_REGISTRY.keys())
