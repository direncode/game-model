"""Classify database columns for embedding strategy selection."""
from __future__ import annotations

import re


class TypeClassifier:
    """Maps DB column types to engine embedding strategies.

    Classification priority:
      1. Column name patterns (strongest signal for IDs and temporals)
      2. Column type (definitive for json, embedding, boolean)
      3. Fallback to 'text'
    """

    TEMPORAL_PATTERNS = [
        "_at", "_date", "timestamp", "created", "updated", "modified", "time",
    ]
    ID_PATTERNS = ["_id", "_uuid", "_key", "_code"]

    # Canonical PostgreSQL type families
    _NUMERIC_TYPES = frozenset({
        "integer", "int", "int2", "int4", "int8",
        "smallint", "bigint",
        "numeric", "decimal",
        "float", "float4", "float8",
        "real", "double precision", "double",
        "serial", "bigserial", "smallserial",
        "money",
    })
    _TEXT_TYPES = frozenset({
        "varchar", "character varying",
        "char", "character",
        "text", "citext",
        "name",
    })
    _TEMPORAL_TYPES = frozenset({
        "timestamp", "timestamptz",
        "timestamp with time zone",
        "timestamp without time zone",
        "date", "time", "timetz",
        "time with time zone",
        "time without time zone",
        "interval",
    })
    _JSON_TYPES = frozenset({"json", "jsonb"})
    _BOOLEAN_TYPES = frozenset({"boolean", "bool"})
    _UUID_TYPES = frozenset({"uuid"})
    _NETWORK_TYPES = frozenset({
        "inet", "cidr", "macaddr", "macaddr8",
    })
    _RANGE_TYPES = frozenset({
        "int4range", "int8range", "numrange",
        "tsrange", "tstzrange", "daterange",
    })
    _GEOMETRIC_TYPES = frozenset({
        "point", "line", "lseg", "box", "path", "polygon", "circle",
    })
    _BINARY_TYPES = frozenset({
        "bytea", "bit", "varbit", "bit varying",
    })
    _ENUM_TYPES = frozenset({
        "enum", "user-defined",
    })

    # ------------------------------------------------------------------ #

    def classify(self, column_name: str, column_type: str) -> str:
        """Classify a column into an engine-level type.

        Returns one of:
            'text', 'numeric', 'temporal', 'categorical', 'json',
            'embedding', 'id', 'boolean'
        """
        col_lower = column_name.lower()
        type_lower = column_type.lower().strip()

        # ── 1. Name-based heuristics ──────────────────────────────────
        # ID columns
        if col_lower == "id" or any(col_lower.endswith(p) for p in self.ID_PATTERNS):
            return "id"

        # Temporal columns (name takes precedence over type)
        if any(p in col_lower for p in self.TEMPORAL_PATTERNS):
            return "temporal"

        # ── 2. Type-based classification ──────────────────────────────
        # Strip length / precision specifiers: varchar(255) -> varchar
        base_type = re.sub(r"\(.*\)", "", type_lower).strip()

        # Array of floats → embedding vector
        if self._is_float_array(type_lower):
            return "embedding"

        # Other arrays → json (treat as structured)
        if "[]" in type_lower or type_lower.startswith("array"):
            return "json"

        if base_type in self._JSON_TYPES:
            return "json"

        if base_type in self._TEMPORAL_TYPES:
            return "temporal"

        if base_type in self._BOOLEAN_TYPES:
            return "boolean"

        if base_type in self._UUID_TYPES:
            return "id"

        if base_type in self._NUMERIC_TYPES:
            return "numeric"

        if base_type in self._TEXT_TYPES:
            return "text"

        # PostgreSQL-specific types that should not crash the classifier
        if base_type in self._NETWORK_TYPES:
            return "text"  # Network addresses are best treated as text

        if base_type in self._RANGE_TYPES:
            return "json"  # Range types are structured data

        if base_type in self._GEOMETRIC_TYPES:
            return "json"  # Geometric types are structured data

        if base_type in self._BINARY_TYPES:
            return "text"  # Binary data — treat as opaque text

        if base_type in self._ENUM_TYPES:
            return "categorical"

        # ── 3. Fallback ───────────────────────────────────────────────
        # Short text columns with few distinct values are often categorical,
        # but we can't know that without data — caller can refine later.
        return "text"

    # ------------------------------------------------------------------ #

    @staticmethod
    def _is_float_array(type_str: str) -> bool:
        """Check if a type string represents an array of floats."""
        float_array_patterns = [
            "float[]", "float4[]", "float8[]",
            "real[]", "double precision[]",
            "numeric[]", "decimal[]",
            "vector",  # pgvector extension
        ]
        return any(p in type_str for p in float_array_patterns)
