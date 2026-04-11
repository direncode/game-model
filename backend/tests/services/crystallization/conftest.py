"""SQLite compatibility shims for crystallization service tests.

The codebase uses `sqlalchemy.dialects.postgresql.JSONB` and `UUID`
directly (not the cross-dialect `JSON().with_variant(...)` pattern), so
the in-memory SQLite test fixtures can't render those types without
help. We register `@compiles` overrides scoped to the SQLite dialect
that translate to portable equivalents.

We also replace the `module_registry.created_at` server default
(`now()`, which SQLite cannot evaluate) with a Python-side default.
The Postgres-side schema is unaffected — this only mutates the
in-process SQLAlchemy column metadata loaded for these tests.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.schema import ColumnDefault


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):  # noqa: ANN001
    return "JSON"


@compiles(UUID, "sqlite")
def _compile_uuid_sqlite(element, compiler, **kw):  # noqa: ANN001
    return "CHAR(36)"


def _patch_module_registry_created_at_for_sqlite() -> None:
    """SQLite has no `now()` function; replace the server default with a
    Python-side default so INSERTs work in tests."""
    from app.models.module_registry import ModuleRegistryEntry

    col = ModuleRegistryEntry.__table__.c.created_at
    col.server_default = None
    col.default = ColumnDefault(lambda ctx=None: datetime.utcnow())


_patch_module_registry_created_at_for_sqlite()
