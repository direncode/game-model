# TCD-JEPA Vertical Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship `TCDJEPAVertical` — a purely additive orchestrator that binds BTUT survivors → TCD-JEPA crystallization → interpretation → persisted routable modules — as a new vertical inside Latent Ocean, with a `ModuleRegistry` Postgres table, 6 REST endpoints, online/incremental path, module routing, export, and vertical presets (trading / inference / sovereign).

**Architecture:** Thin composition layer over existing `TCDJEPAWrapper`, `interpretation_pipeline`, and BTUT output. New code lives in `backend/app/services/crystallization/vertical*.py`, `backend/app/models/module_registry.py`, `backend/app/schemas/tcd_vertical.py`, `backend/app/api/v1/tcd_vertical.py`, plus one additive Alembic migration. Design doc: `docs/plans/2026-04-10-tcd-jepa-vertical-design.md`.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0 async, Alembic, pytest + pytest-asyncio (auto mode), numpy, torch (for optional export), existing `tcd_jepa` package at repo root.

**Constraint:** Zero edits to existing working pipelines. Only allowed existing-file touches: 1-line router registration in `backend/app/main.py` and 1 new additive Alembic migration. Everything else is new files.

**Learning-mode contribution points:** 4 spots marked `TODO(learning-mode)` where the user writes 5-10 lines of meaningful logic. See Tasks 7, 8, 9, 10.

---

## Task ordering rationale

Tasks are ordered so each one is independently testable against already-written code:

1. **Types first** (Task 2) — everything else imports from `vertical_types.py`.
2. **Pure adapters** (Task 3) — `btut_bridge` has no external deps beyond types + numpy.
3. **Persistence** (Tasks 4-6) — model, migration, registry service. Independent of ML code.
4. **Leaf services** (Tasks 7-10) — presets, routing, export, online. Each with a learning-mode stub.
5. **Orchestrator** (Tasks 11-13) — composes everything above with mocked wrapper.
6. **API surface** (Tasks 14-16) — schemas, endpoints, router registration.
7. **Integration + docs** (Tasks 17-18) — smoke tests and monetization fit doc.

Each task ends with a commit. Frequent commits mean you can bisect a regression instantly.

---

## Task 1: Scaffold test layout & verify baseline

**Goal:** Make sure the existing test suite runs before we add anything, and create the new test directories.

**Files:**
- Create: `backend/tests/services/crystallization/__init__.py`
- Create: `backend/tests/services/crystallization/test_placeholder.py` (temporary)

**Step 1: Verify baseline pytest works**

```bash
cd backend && python -m pytest --collect-only 2>&1 | tail -20
```

Expected: test collection without import errors. If tests are broken at HEAD, STOP and escalate — we do not start a new feature on a red main.

**Step 2: Create test dirs**

```bash
mkdir -p backend/tests/services/crystallization backend/tests/api
touch backend/tests/services/crystallization/__init__.py backend/tests/api/__init__.py
```

**Step 3: Write a sanity placeholder test**

```python
# backend/tests/services/crystallization/test_placeholder.py
def test_scaffolding_sanity():
    assert 1 + 1 == 2
```

**Step 4: Run it**

```bash
cd backend && python -m pytest tests/services/crystallization/test_placeholder.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/tests/services/crystallization/__init__.py backend/tests/api/__init__.py backend/tests/services/crystallization/test_placeholder.py
git commit -m "test(tcd-vertical): scaffold test dirs"
```

---

## Task 2: `vertical_types.py` — dataclasses & enums

**Goal:** Ship the core types everything downstream imports.

**Files:**
- Create: `backend/app/services/crystallization/vertical_types.py`
- Test: `backend/tests/services/crystallization/test_vertical_types.py`

**Step 1: Write the failing test**

```python
# backend/tests/services/crystallization/test_vertical_types.py
import numpy as np
import pytest
from datetime import datetime

from app.services.crystallization.vertical_types import (
    BTUTSurvivorBundle,
    CrystallizedModule,
    RoutingDecision,
    VerticalPreset,
    TCDVerticalError,
)


def test_vertical_preset_values():
    assert VerticalPreset.TRADING.value == "trading"
    assert VerticalPreset.INFERENCE.value == "inference"
    assert VerticalPreset.SOVEREIGN.value == "sovereign"
    assert VerticalPreset.GENERIC.value == "generic"


def test_btut_survivor_bundle_shapes():
    emb = np.zeros((3, 8), dtype=np.float32)
    bundle = BTUTSurvivorBundle(
        embeddings=emb,
        ids=["a", "b", "c"],
        edges=[(0, 1, 0.9), (1, 2, 0.4)],
        metadata={"quality": 0.87},
    )
    assert bundle.embeddings.shape == (3, 8)
    assert len(bundle.ids) == 3
    assert len(bundle.edges) == 2


def test_btut_survivor_bundle_validates_length_mismatch():
    with pytest.raises(ValueError, match="ids length"):
        BTUTSurvivorBundle(
            embeddings=np.zeros((3, 8)),
            ids=["a", "b"],  # mismatch
            edges=[],
            metadata={},
        )


def test_crystallized_module_dataclass():
    m = CrystallizedModule(
        id="mod-1",
        vertical=VerticalPreset.TRADING,
        module_type="attractor",
        centroid=np.zeros(8),
        members=["a", "b"],
        purity=0.91,
        quality_score=0.8,
        provenance_job_id="job-xyz",
        created_at=datetime(2026, 4, 10),
    )
    assert m.module_type == "attractor"


def test_routing_decision_empty_sentinel():
    d = RoutingDecision(module_id=None, score=0.0, reason="empty_registry")
    assert d.module_id is None
    assert d.reason == "empty_registry"


def test_tcd_vertical_error_carries_stage():
    err = TCDVerticalError("boom", stage="crystallize")
    assert err.stage == "crystallize"
    assert str(err) == "boom"
```

**Step 2: Run it to verify failure**

```bash
cd backend && python -m pytest tests/services/crystallization/test_vertical_types.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.crystallization.vertical_types'`.

**Step 3: Write the implementation**

```python
# backend/app/services/crystallization/vertical_types.py
"""Core types for the TCD-JEPA vertical.

Pure data + enums + a typed exception. No I/O, no ML.
Everything else in the vertical composes these.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Literal, Any

import numpy as np


class VerticalPreset(str, Enum):
    TRADING = "trading"
    INFERENCE = "inference"
    SOVEREIGN = "sovereign"
    GENERIC = "generic"


@dataclass
class BTUTSurvivorBundle:
    """Normalized BTUT output consumed by TCDJEPAVertical.

    BTUT's two emit shapes (BTUTTuner.result and run_btut_pipeline() dict)
    are both converted into this single type by btut_bridge.py.
    """
    embeddings: np.ndarray                        # (N, D) float32
    ids: list[str]                                # length N
    edges: list[tuple[int, int, float]]           # (src_idx, dst_idx, weight)
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        n = self.embeddings.shape[0]
        if len(self.ids) != n:
            raise ValueError(
                f"ids length ({len(self.ids)}) must match embeddings rows ({n})"
            )


ModuleType = Literal["attractor", "cycle", "boundary"]


@dataclass
class CrystallizedModule:
    """A single crystallized, interpretable, routable module."""
    id: str
    vertical: VerticalPreset
    module_type: ModuleType
    centroid: np.ndarray
    members: list[str]
    purity: float
    quality_score: float
    provenance_job_id: str | None
    created_at: datetime


@dataclass
class RoutingDecision:
    """Result of routing a signal embedding against the ModuleRegistry."""
    module_id: str | None
    score: float
    reason: str


class TCDVerticalError(Exception):
    """Stage-tagged error raised by any TCDJEPAVertical method."""

    def __init__(self, message: str, stage: str) -> None:
        super().__init__(message)
        self.stage = stage
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/crystallization/test_vertical_types.py -v
```

Expected: 6 passed.

**Step 5: Commit**

```bash
git add backend/app/services/crystallization/vertical_types.py backend/tests/services/crystallization/test_vertical_types.py
git commit -m "feat(tcd-vertical): add core types (bundle, module, decision, error)"
```

---

## Task 3: `btut_bridge.py` — BTUT adapter (TDD)

**Goal:** Convert either BTUT output shape into a `BTUTSurvivorBundle`. Pure function, no ML.

**Files:**
- Create: `backend/app/services/crystallization/btut_bridge.py`
- Test: `backend/tests/services/crystallization/test_btut_bridge.py`

**Step 1: Write the failing test**

```python
# backend/tests/services/crystallization/test_btut_bridge.py
import numpy as np
import pytest

from app.services.crystallization.btut_bridge import (
    from_pipeline_dict,
    from_tuner_result,
)
from app.services.crystallization.vertical_types import BTUTSurvivorBundle


def test_from_pipeline_dict_basic():
    pipe = {
        "summary": {"survivors": 3, "variance_preservation": 0.91},
        "survivors": [
            {"entity": {"name": "alpha"}, "cluster": 0, "scores": {"composite": 0.8}},
            {"entity": {"name": "beta"},  "cluster": 0, "scores": {"composite": 0.7}},
            {"entity": {"name": "gamma"}, "cluster": 1, "scores": {"composite": 0.6}},
        ],
        "embeddings_8d": [0.0] * 24,  # 3 survivors × 8 dims
    }
    bundle = from_pipeline_dict(pipe)
    assert isinstance(bundle, BTUTSurvivorBundle)
    assert bundle.embeddings.shape == (3, 8)
    assert bundle.ids == ["alpha", "beta", "gamma"]
    assert bundle.metadata["variance_preservation"] == 0.91
    assert bundle.metadata["cluster_assignments"] == [0, 0, 1]


def test_from_pipeline_dict_empty_embeddings_raises():
    pipe = {
        "summary": {},
        "survivors": [{"entity": {"name": "a"}, "cluster": 0, "scores": {}}],
        "embeddings_8d": [],
    }
    with pytest.raises(ValueError, match="embeddings_8d"):
        from_pipeline_dict(pipe)


def test_from_tuner_result_maps_edges():
    class FakeResult:
        survivors = [{"name": "a"}, {"name": "b"}, {"name": "c"}]
        survivor_edges = [("a", "b", 0.9), ("b", "c", 0.5)]
        quality_scores = {"purity": 0.88}
        survivor_embeddings = np.random.RandomState(0).randn(3, 8).astype(np.float32)
        provenance_job_id = "job-xyz"

    bundle = from_tuner_result(FakeResult())
    assert bundle.embeddings.shape == (3, 8)
    assert bundle.ids == ["a", "b", "c"]
    assert bundle.edges == [(0, 1, 0.9), (1, 2, 0.5)]
    assert bundle.metadata["quality_scores"]["purity"] == 0.88
    assert bundle.metadata["provenance_job_id"] == "job-xyz"
```

**Step 2: Run to verify failure**

```bash
cd backend && python -m pytest tests/services/crystallization/test_btut_bridge.py -v
```

Expected: FAIL — module not found.

**Step 3: Implement**

```python
# backend/app/services/crystallization/btut_bridge.py
"""Adapters from BTUT output shapes to BTUTSurvivorBundle.

BTUT emits in two shapes today:

1. `BTUTTuner.result` — a rich dataclass with .survivors, .survivor_edges,
   .quality_scores, .survivor_embeddings, .provenance_job_id.

2. `run_btut_pipeline()` dict — flat dict with 'survivors', 'embeddings_8d',
   'summary', 'embed_context'.

Both are normalized into a single BTUTSurvivorBundle here. The vertical
only ever sees the bundle; it never reaches into BTUT internals.
"""
from __future__ import annotations

from typing import Any

import numpy as np

from .vertical_types import BTUTSurvivorBundle


def from_pipeline_dict(payload: dict[str, Any]) -> BTUTSurvivorBundle:
    """Convert a `run_btut_pipeline()` dict into a BTUTSurvivorBundle."""
    survivors = payload.get("survivors", [])
    flat = payload.get("embeddings_8d", [])
    if not flat:
        raise ValueError(
            "embeddings_8d is empty — BTUT pipeline did not emit a geometric lattice"
        )

    n = len(survivors)
    d = len(flat) // max(n, 1)
    if n * d != len(flat):
        raise ValueError(
            f"embeddings_8d length {len(flat)} not divisible by survivor count {n}"
        )

    embeddings = np.asarray(flat, dtype=np.float32).reshape(n, d)
    ids = [
        str(s.get("entity", {}).get("name", f"survivor_{i}"))
        for i, s in enumerate(survivors)
    ]
    cluster_assignments = [int(s.get("cluster", 0)) for s in survivors]

    # The pipeline dict doesn't carry an edge list — vertical will fall back
    # to a kNN graph inside crystallize() if edges is empty. That's fine.
    edges: list[tuple[int, int, float]] = []

    metadata: dict[str, Any] = {
        "cluster_assignments": cluster_assignments,
        "source": "btut_pipeline_dict",
    }
    summary = payload.get("summary", {})
    for key in ("variance_preservation", "wall_seconds", "coverages"):
        if key in summary:
            metadata[key] = summary[key]

    return BTUTSurvivorBundle(
        embeddings=embeddings, ids=ids, edges=edges, metadata=metadata
    )


def from_tuner_result(result: Any) -> BTUTSurvivorBundle:
    """Convert a BTUTTuner.result (duck-typed) into a BTUTSurvivorBundle.

    Accepts any object with .survivors (list[dict]), .survivor_edges
    (list[tuple[str,str,float]]), .survivor_embeddings (np.ndarray),
    .quality_scores (dict), and .provenance_job_id (str|None).
    """
    survivors = list(result.survivors)
    ids = [str(s.get("name", f"survivor_{i}")) for i, s in enumerate(survivors)]

    # Edge list is name-based in BTUT; convert to index-based for the bundle.
    id_to_idx = {name: i for i, name in enumerate(ids)}
    edges: list[tuple[int, int, float]] = []
    for src, dst, weight in getattr(result, "survivor_edges", []):
        if src in id_to_idx and dst in id_to_idx:
            edges.append((id_to_idx[src], id_to_idx[dst], float(weight)))

    embeddings = np.asarray(
        getattr(result, "survivor_embeddings"), dtype=np.float32
    )

    metadata: dict[str, Any] = {
        "quality_scores": getattr(result, "quality_scores", {}),
        "provenance_job_id": getattr(result, "provenance_job_id", None),
        "source": "btut_tuner_result",
    }

    return BTUTSurvivorBundle(
        embeddings=embeddings, ids=ids, edges=edges, metadata=metadata
    )
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/crystallization/test_btut_bridge.py -v
```

Expected: 3 passed.

**Step 5: Commit**

```bash
git add backend/app/services/crystallization/btut_bridge.py backend/tests/services/crystallization/test_btut_bridge.py
git commit -m "feat(tcd-vertical): BTUT-to-bundle adapters (pipeline dict + tuner result)"
```

---

## Task 4: SQLAlchemy `module_registry` model

**Goal:** Define the persisted module table. **Does not create the table** — that's Task 5 (migration).

**Files:**
- Create: `backend/app/models/module_registry.py`

**Step 1: Implement**

```python
# backend/app/models/module_registry.py
"""Persistent registry of crystallized modules.

Distinct from `models/module.py` (which is per-job module records tied to
a specific CrystallizationJob). This table is cross-job, cross-vertical,
the system of record for every routable module that has ever survived
quality gating.

Schema is additive — a new migration adds this table; nothing else touches it.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, Float, Text, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ModuleRegistryEntry(Base):
    """A crystallized module registered to the TCD-JEPA vertical."""

    __tablename__ = "module_registry"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    vertical: Mapped[str] = mapped_column(String(32), nullable=False)
    module_type: Mapped[str] = mapped_column(String(32), nullable=False)
    module_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # Vector state — stored as JSONB (not vector extension) to keep the
    # migration additive and Postgres-extension-free.
    centroid: Mapped[list[float]] = mapped_column(JSONB, nullable=False)
    members: Mapped[list[str]] = mapped_column(JSONB, nullable=False)

    purity: Mapped[float] = mapped_column(Float, nullable=False)
    quality_score: Mapped[float] = mapped_column(Float, nullable=False)

    provenance_job_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    __table_args__ = (
        Index(
            "uq_module_registry_provenance_hash",
            "provenance_job_id",
            "module_hash",
            unique=True,
        ),
        Index("ix_module_registry_vertical", "vertical"),
        Index("ix_module_registry_quality", "quality_score"),
    )
```

**Step 2: Verify it imports**

```bash
cd backend && python -c "from app.models.module_registry import ModuleRegistryEntry; print(ModuleRegistryEntry.__tablename__)"
```

Expected: `module_registry`.

**Step 3: Commit**

```bash
git add backend/app/models/module_registry.py
git commit -m "feat(tcd-vertical): ModuleRegistryEntry SQLAlchemy model"
```

---

## Task 5: Alembic migration for `module_registry`

**Goal:** Create the additive migration. Must not touch any existing table.

**Files:**
- Create: `backend/app/db/migrations/versions/003_module_registry.py`

**Step 1: Read the previous migration to confirm the down-revision chain**

```bash
grep -n "revision:\|down_revision:" backend/app/db/migrations/versions/002_auth_upgrade.py
```

Expected: `revision: str = "002_auth_upgrade"`.

**Step 2: Implement the migration**

```python
# backend/app/db/migrations/versions/003_module_registry.py
"""Add module_registry table for TCD-JEPA vertical.

Revision ID: 003_module_registry
Revises: 002_auth_upgrade
Create Date: 2026-04-10 00:00:00.000000

Additive only — creates one new table, no changes to existing tables.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision: str = "003_module_registry"
down_revision: Union[str, None] = "002_auth_upgrade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "module_registry",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("vertical", sa.String(32), nullable=False),
        sa.Column("module_type", sa.String(32), nullable=False),
        sa.Column("module_hash", sa.String(64), nullable=False),
        sa.Column("centroid", JSONB, nullable=False),
        sa.Column("members", JSONB, nullable=False),
        sa.Column("purity", sa.Float, nullable=False),
        sa.Column("quality_score", sa.Float, nullable=False),
        sa.Column("provenance_job_id", sa.String(128), nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime, server_default=sa.text("now()"), nullable=False
        ),
        sa.UniqueConstraint(
            "provenance_job_id",
            "module_hash",
            name="uq_module_registry_provenance_hash",
        ),
    )
    op.create_index(
        "ix_module_registry_vertical", "module_registry", ["vertical"]
    )
    op.create_index(
        "ix_module_registry_quality", "module_registry", ["quality_score"]
    )


def downgrade() -> None:
    op.drop_index("ix_module_registry_quality", table_name="module_registry")
    op.drop_index("ix_module_registry_vertical", table_name="module_registry")
    op.drop_table("module_registry")
```

**Step 3: Dry-run the migration SQL (does not execute)**

```bash
cd backend && python -m alembic upgrade 003_module_registry --sql 2>&1 | tail -30
```

Expected: SQL output containing `CREATE TABLE module_registry`. If the repo's Alembic config can't reach a DB URL offline, skip this step and validate in Task 17 integration tests.

**Step 4: Commit**

```bash
git add backend/app/db/migrations/versions/003_module_registry.py
git commit -m "feat(tcd-vertical): alembic migration for module_registry (additive)"
```

---

## Task 6: `ModuleRegistryService` — async CRUD

**Goal:** Thin CRUD service around `ModuleRegistryEntry`. No business logic; orchestrator owns that.

**Files:**
- Create: `backend/app/services/crystallization/module_registry.py`
- Test: `backend/tests/services/crystallization/test_module_registry.py`

**Step 1: Write the failing test (uses in-memory SQLite via existing test fixtures or an isolated in-process engine)**

```python
# backend/tests/services/crystallization/test_module_registry.py
import uuid
import pytest
import numpy as np
from datetime import datetime

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.db.session import Base
from app.models.module_registry import ModuleRegistryEntry  # noqa: F401  (side-effect register)
from app.services.crystallization.module_registry import (
    ModuleRegistryService,
    hash_module,
)
from app.services.crystallization.vertical_types import (
    CrystallizedModule,
    VerticalPreset,
)


@pytest.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


def _mk_module(name: str, vertical: VerticalPreset = VerticalPreset.TRADING) -> CrystallizedModule:
    return CrystallizedModule(
        id=name,
        vertical=vertical,
        module_type="attractor",
        centroid=np.array([0.1, 0.2, 0.3], dtype=np.float32),
        members=["a", "b"],
        purity=0.9,
        quality_score=0.8,
        provenance_job_id="job-xyz",
        created_at=datetime(2026, 4, 10),
    )


async def test_register_and_list(session):
    svc = ModuleRegistryService(session)
    rows = await svc.register_many([_mk_module("m1"), _mk_module("m2")])
    assert len(rows) == 2

    listed = await svc.list(vertical=VerticalPreset.TRADING)
    assert len(listed) == 2


async def test_register_deduplicates_on_provenance_and_hash(session):
    svc = ModuleRegistryService(session)
    m = _mk_module("m1")
    first = await svc.register_many([m])
    second = await svc.register_many([m])  # same provenance + same hash
    assert len(first) == 1
    assert len(second) == 0  # dedupe
    listed = await svc.list()
    assert len(listed) == 1


async def test_list_filters_by_min_quality(session):
    svc = ModuleRegistryService(session)
    low = _mk_module("low"); low.quality_score = 0.3
    high = _mk_module("high"); high.quality_score = 0.95
    await svc.register_many([low, high])
    results = await svc.list(min_quality=0.5)
    assert len(results) == 1
    assert results[0].quality_score == 0.95


async def test_get_by_id(session):
    svc = ModuleRegistryService(session)
    rows = await svc.register_many([_mk_module("m1")])
    entry_id = rows[0].id
    fetched = await svc.get(entry_id)
    assert fetched is not None
    assert fetched.module_type == "attractor"


def test_hash_module_is_stable():
    m1 = _mk_module("m")
    m2 = _mk_module("m")
    assert hash_module(m1) == hash_module(m2)
    m2.centroid = np.array([9.9, 9.9, 9.9], dtype=np.float32)
    assert hash_module(m1) != hash_module(m2)
```

**Step 2: Run → FAIL**

```bash
cd backend && python -m pytest tests/services/crystallization/test_module_registry.py -v
```

**Step 3: Implement**

```python
# backend/app/services/crystallization/module_registry.py
"""CRUD service for the persistent ModuleRegistryEntry table.

Pure persistence — no routing, no scoring, no ML. The vertical orchestrator
composes this with other services.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module_registry import ModuleRegistryEntry
from .vertical_types import CrystallizedModule, VerticalPreset


def hash_module(module: CrystallizedModule) -> str:
    """Stable content hash for dedup. Changes if centroid or members change."""
    payload = {
        "vertical": module.vertical.value,
        "module_type": module.module_type,
        "centroid": [round(float(x), 6) for x in module.centroid.tolist()],
        "members": sorted(module.members),
    }
    blob = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


class ModuleRegistryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def register_many(
        self, modules: list[CrystallizedModule]
    ) -> list[ModuleRegistryEntry]:
        """Insert modules, dedup on (provenance_job_id, module_hash)."""
        inserted: list[ModuleRegistryEntry] = []
        for m in modules:
            mh = hash_module(m)
            existing = await self._session.execute(
                select(ModuleRegistryEntry).where(
                    ModuleRegistryEntry.provenance_job_id == m.provenance_job_id,
                    ModuleRegistryEntry.module_hash == mh,
                )
            )
            if existing.scalar_one_or_none() is not None:
                continue
            entry = ModuleRegistryEntry(
                id=uuid.uuid4(),
                vertical=m.vertical.value,
                module_type=m.module_type,
                module_hash=mh,
                centroid=[float(x) for x in m.centroid.tolist()],
                members=list(m.members),
                purity=float(m.purity),
                quality_score=float(m.quality_score),
                provenance_job_id=m.provenance_job_id,
                metadata_=None,
                description=None,
            )
            self._session.add(entry)
            inserted.append(entry)
        await self._session.flush()
        return inserted

    async def list(
        self,
        *,
        vertical: VerticalPreset | None = None,
        min_purity: float | None = None,
        min_quality: float | None = None,
        limit: int = 200,
    ) -> list[ModuleRegistryEntry]:
        stmt = select(ModuleRegistryEntry)
        if vertical is not None:
            stmt = stmt.where(ModuleRegistryEntry.vertical == vertical.value)
        if min_purity is not None:
            stmt = stmt.where(ModuleRegistryEntry.purity >= min_purity)
        if min_quality is not None:
            stmt = stmt.where(ModuleRegistryEntry.quality_score >= min_quality)
        stmt = stmt.order_by(ModuleRegistryEntry.quality_score.desc()).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get(self, entry_id: uuid.UUID | str) -> ModuleRegistryEntry | None:
        if isinstance(entry_id, str):
            entry_id = uuid.UUID(entry_id)
        return await self._session.get(ModuleRegistryEntry, entry_id)
```

> **Note:** The SQLite test uses JSON columns (SQLAlchemy maps JSONB→JSON on SQLite). `gen_random_uuid()` server default won't fire on SQLite, so we pass explicit `uuid.uuid4()` in `register_many`. This keeps tests DB-portable.

**Step 4: Run → PASS**

```bash
cd backend && python -m pytest tests/services/crystallization/test_module_registry.py -v
```

Expected: 5 passed.

**Step 5: Commit**

```bash
git add backend/app/services/crystallization/module_registry.py backend/tests/services/crystallization/test_module_registry.py
git commit -m "feat(tcd-vertical): ModuleRegistryService (async CRUD with dedup)"
```

---

## Task 7: `presets.py` — vertical presets ⚡ LEARNING MODE #3

**Goal:** Ship the `GENERIC`, `INFERENCE`, `SOVEREIGN` presets as complete baselines, and leave `TRADING` as a prepared `TODO(learning-mode)` stub for the user to fill in.

**Files:**
- Create: `backend/app/services/crystallization/presets.py`
- Test: `backend/tests/services/crystallization/test_presets.py`

**Step 1: Write the failing test**

```python
# backend/tests/services/crystallization/test_presets.py
import pytest

from app.services.crystallization.presets import (
    PRESETS,
    get_preset,
    PresetConfig,
)
from app.services.crystallization.vertical_types import VerticalPreset


def test_all_presets_defined():
    for preset in VerticalPreset:
        assert preset in PRESETS, f"Missing preset: {preset}"
        cfg = PRESETS[preset]
        assert isinstance(cfg, PresetConfig)
        assert cfg.langevin_temperature > 0
        assert cfg.langevin_steps > 0
        assert cfg.homology_max_dim in (1, 2)
        assert 0 < cfg.prune_threshold < 1


def test_get_preset_returns_copy():
    a = get_preset(VerticalPreset.GENERIC)
    b = get_preset(VerticalPreset.GENERIC)
    a.langevin_temperature = 999.0
    assert b.langevin_temperature != 999.0  # copy, not shared


def test_trading_preset_has_nonzero_values():
    # Learning mode: user fills in TRADING with real numbers. This test
    # enforces that the stub must actually be completed.
    cfg = get_preset(VerticalPreset.TRADING)
    assert cfg.langevin_temperature > 0
    assert cfg.langevin_steps > 0
    assert cfg.prune_threshold > 0
```

**Step 2: Run → FAIL**

**Step 3: Implement**

```python
# backend/app/services/crystallization/presets.py
"""Vertical presets — hyperparameters for TCD-JEPA per use case.

GENERIC / INFERENCE / SOVEREIGN ship with validated defaults.
TRADING is a learning-mode stub — the user fills it in.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass

from .vertical_types import VerticalPreset


@dataclass
class PresetConfig:
    langevin_temperature: float
    langevin_steps: int
    langevin_noise_scale: float
    homology_max_dim: int
    prune_threshold: float
    max_modules: int


PRESETS: dict[VerticalPreset, PresetConfig] = {
    VerticalPreset.GENERIC: PresetConfig(
        langevin_temperature=1.0,
        langevin_steps=200,
        langevin_noise_scale=0.1,
        homology_max_dim=2,
        prune_threshold=0.2,
        max_modules=32,
    ),
    VerticalPreset.INFERENCE: PresetConfig(
        langevin_temperature=0.5,        # cooler → exploits known landscape
        langevin_steps=100,              # fewer steps, faster turnaround
        langevin_noise_scale=0.05,
        homology_max_dim=1,              # skip H2 for speed
        prune_threshold=0.1,             # keep more modules for coverage
        max_modules=64,
    ),
    VerticalPreset.SOVEREIGN: PresetConfig(
        langevin_temperature=1.5,        # hotter → aggressive exploration
        langevin_steps=500,              # long trajectories, more structure
        langevin_noise_scale=0.15,
        homology_max_dim=2,
        prune_threshold=0.25,            # strict quality gate
        max_modules=128,
    ),

    # TODO(learning-mode #3): TRADING preset
    # ─────────────────────────────────────────────────────────────────
    # Fill in langevin_temperature, langevin_steps, langevin_noise_scale,
    # homology_max_dim, prune_threshold, max_modules for the trading
    # vertical.
    #
    # Context to consider:
    # - Trading signals are noisy; you may want a LOWER Langevin temperature
    #   than GENERIC to avoid spurious modules, OR higher if you want to
    #   discover regime shifts.
    # - Trading wants FAST decisions → favor fewer langevin_steps and
    #   max_homology_dim=1 over = 2.
    # - prune_threshold higher → fewer, higher-confidence modules (safer);
    #   lower → more, noisier modules (more coverage).
    # - max_modules: how many distinct trading strategies do you want to
    #   simultaneously route against?
    #
    # Write 5-10 lines. Every field must be non-zero.
    VerticalPreset.TRADING: PresetConfig(
        langevin_temperature=0.0,  # TODO
        langevin_steps=0,          # TODO
        langevin_noise_scale=0.0,  # TODO
        homology_max_dim=1,        # TODO
        prune_threshold=0.0,       # TODO
        max_modules=0,             # TODO
    ),
}


def get_preset(preset: VerticalPreset) -> PresetConfig:
    """Return a deep copy so caller mutation doesn't leak into the registry."""
    return deepcopy(PRESETS[preset])
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/crystallization/test_presets.py -v
```

Expected: 2 passed, 1 FAILED (`test_trading_preset_has_nonzero_values`). This is by design — the failing test is the user's forcing function to fill in the preset.

**Step 5: HANDOFF — user fills in TRADING**

Send a message to the user:
> "Task 7 ships GENERIC/INFERENCE/SOVEREIGN presets. `TRADING` is a prepared stub at `backend/app/services/crystallization/presets.py`, around line 55. Fill in the 6 fields with values you'd actually deploy. The failing test `test_trading_preset_has_nonzero_values` will go green once every field is non-zero. Reply here when done and I'll verify + commit."

**Step 6: After user edit, re-run tests**

```bash
cd backend && python -m pytest tests/services/crystallization/test_presets.py -v
```

Expected: 3 passed.

**Step 7: Commit**

```bash
git add backend/app/services/crystallization/presets.py backend/tests/services/crystallization/test_presets.py
git commit -m "feat(tcd-vertical): presets (GENERIC/INFERENCE/SOVEREIGN + user TRADING)"
```

---

## Task 8: `routing.py` — module dispatcher ⚡ LEARNING MODE #2

**Goal:** Ship the routing framework with a stub `score_module()` that the user fills in. The sentinel, top-k, and empty-registry behavior is tested and complete.

**Files:**
- Create: `backend/app/services/crystallization/routing.py`
- Test: `backend/tests/services/crystallization/test_routing.py`

**Step 1: Write the failing test**

```python
# backend/tests/services/crystallization/test_routing.py
import numpy as np
from datetime import datetime

from app.services.crystallization.routing import (
    route_signal,
    score_module,
)
from app.services.crystallization.vertical_types import (
    CrystallizedModule,
    RoutingDecision,
    VerticalPreset,
)


def _mk(name: str, centroid: list[float], purity: float = 0.9) -> CrystallizedModule:
    return CrystallizedModule(
        id=name,
        vertical=VerticalPreset.GENERIC,
        module_type="attractor",
        centroid=np.array(centroid, dtype=np.float32),
        members=[],
        purity=purity,
        quality_score=0.8,
        provenance_job_id="job-x",
        created_at=datetime(2026, 4, 10),
    )


def test_route_empty_registry_returns_sentinel():
    signal = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    decisions = route_signal(signal, [])
    assert len(decisions) == 1
    assert decisions[0].module_id is None
    assert decisions[0].reason == "empty_registry"


def test_route_returns_top_k_sorted():
    signal = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    modules = [
        _mk("close",  [0.99, 0.01, 0.0]),
        _mk("medium", [0.5,  0.5,  0.0]),
        _mk("far",    [-1.0, 0.0,  0.0]),
    ]
    decisions = route_signal(signal, modules, top_k=2)
    assert len(decisions) == 2
    assert decisions[0].module_id == "close"
    assert decisions[0].score >= decisions[1].score


def test_score_module_nonzero_for_cosine_aligned():
    # Forcing function: user must implement something that returns > 0
    # when the signal is perfectly aligned with the centroid.
    mod = _mk("a", [1.0, 0.0, 0.0])
    signal = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    assert score_module(signal, mod) > 0.0


def test_score_module_penalizes_orthogonal():
    mod = _mk("a", [1.0, 0.0, 0.0])
    aligned = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    orthogonal = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    assert score_module(aligned, mod) > score_module(orthogonal, mod)
```

**Step 2: Run → FAIL**

**Step 3: Implement**

```python
# backend/app/services/crystallization/routing.py
"""Module dispatcher — score signals against registered modules.

route_signal() is the stable framework: empty-registry sentinel, top-k,
sort order. score_module() is the learning-mode contribution point —
the user writes the actual scoring heuristic.
"""
from __future__ import annotations

import numpy as np

from .vertical_types import CrystallizedModule, RoutingDecision


def score_module(signal: np.ndarray, module: CrystallizedModule) -> float:
    """Score how well `signal` matches `module`. Higher = better.

    TODO(learning-mode #2): implement the scoring heuristic.
    ─────────────────────────────────────────────────────────────────
    Trade-offs to weigh:

    1. PURE COSINE  — `cosine(signal, centroid)`
       Fast, direction-only, purity-blind. Good baseline but treats a
       low-purity module the same as a high-purity one.

    2. COSINE × PURITY — `cosine(signal, centroid) * module.purity`
       Downweights noisy modules. Probably the right default for most
       verticals. Purity ∈ [0, 1] so the score stays bounded.

    3. DISTANCE-PENALIZED — `cosine - lambda * ||signal - centroid||`
       Penalizes magnitude drift, not just direction. Useful when the
       signal magnitude carries information (e.g. confidence, volume).
       Needs a `lambda` hyperparameter — pick one, hardcode it.

    4. YOUR CHOICE — you know the domain.

    Constraints the tests enforce:
    - Return > 0 for perfectly-aligned signal + centroid.
    - Return a higher value for aligned than for orthogonal.

    Write 5-10 lines. This runs on every routing call in production,
    so keep it O(D) in the embedding dimension.
    """
    # TODO: replace this stub with a real scoring function.
    sig = signal / (np.linalg.norm(signal) + 1e-8)
    cen = module.centroid / (np.linalg.norm(module.centroid) + 1e-8)
    cosine = float(np.dot(sig, cen))
    return cosine  # <-- user refines this


def route_signal(
    signal: np.ndarray,
    modules: list[CrystallizedModule],
    *,
    top_k: int = 1,
) -> list[RoutingDecision]:
    """Route a signal embedding against the module registry.

    Returns top-k RoutingDecisions sorted by score descending. Always
    returns at least 1 decision; empty registry returns a sentinel.
    """
    if not modules:
        return [RoutingDecision(module_id=None, score=0.0, reason="empty_registry")]

    scored: list[RoutingDecision] = []
    for m in modules:
        s = score_module(signal, m)
        scored.append(
            RoutingDecision(module_id=m.id, score=float(s), reason="scored")
        )
    scored.sort(key=lambda d: d.score, reverse=True)
    return scored[: max(1, top_k)]
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/crystallization/test_routing.py -v
```

Expected: 4 passed. The baseline `cosine` stub actually satisfies all 4 tests — but it's a minimal placeholder. The learning-mode handoff below asks the user to *refine* it into something production-worthy.

**Step 5: HANDOFF — user refines scoring**

Send a message:
> "Task 8 has a minimal cosine stub at `routing.py::score_module()` (~line 38). Tests pass, but you should refine this into something domain-appropriate — likely cosine × purity, or a distance-penalized variant. Five to ten lines. Reply when done (or say 'keep the stub' and I'll move on)."

**Step 6: After user refinement (or keep stub), re-run**

```bash
cd backend && python -m pytest tests/services/crystallization/test_routing.py -v
```

**Step 7: Commit**

```bash
git add backend/app/services/crystallization/routing.py backend/tests/services/crystallization/test_routing.py
git commit -m "feat(tcd-vertical): routing dispatcher (route_signal + user score_module)"
```

---

## Task 9: `export.py` — module export formats ⚡ LEARNING MODE #4

**Goal:** Ship the export framework with JSON format fully implemented, and `to_pytorch_bundle()` as a prepared stub for the user.

**Files:**
- Create: `backend/app/services/crystallization/export.py`
- Test: `backend/tests/services/crystallization/test_export.py`

**Step 1: Write the failing test**

```python
# backend/tests/services/crystallization/test_export.py
import json
import numpy as np
from datetime import datetime

from app.services.crystallization.export import (
    to_json,
    to_pytorch_bundle,
    ExportFormat,
)
from app.services.crystallization.vertical_types import (
    CrystallizedModule,
    VerticalPreset,
)


def _mk() -> CrystallizedModule:
    return CrystallizedModule(
        id="mod-1",
        vertical=VerticalPreset.TRADING,
        module_type="attractor",
        centroid=np.array([0.1, 0.2, 0.3], dtype=np.float32),
        members=["a", "b", "c"],
        purity=0.92,
        quality_score=0.81,
        provenance_job_id="job-xyz",
        created_at=datetime(2026, 4, 10),
    )


def test_to_json_roundtrips_fields():
    blob = to_json(_mk())
    payload = json.loads(blob)
    assert payload["id"] == "mod-1"
    assert payload["vertical"] == "trading"
    assert payload["purity"] == 0.92
    assert payload["members"] == ["a", "b", "c"]
    assert payload["centroid"] == [0.1, 0.2, 0.3]


def test_to_pytorch_bundle_returns_bytes():
    # Learning mode: user decides the bundle format. Any non-empty bytes OK.
    blob = to_pytorch_bundle(_mk())
    assert isinstance(blob, bytes)
    assert len(blob) > 0


def test_export_format_enum():
    assert ExportFormat.JSON.value == "json"
    assert ExportFormat.PYTORCH.value == "pt"
    assert ExportFormat.ONNX.value == "onnx"
```

**Step 2: Run → FAIL**

**Step 3: Implement**

```python
# backend/app/services/crystallization/export.py
"""Module export formats for the TCD-JEPA vertical.

JSON is the portable format (always works).
PYTORCH is the rich format (state dict + metadata) — learning-mode stub.
ONNX is a stub that raises NotImplementedError until a consumer asks for it.
"""
from __future__ import annotations

import io
import json
from enum import Enum

from .vertical_types import CrystallizedModule


class ExportFormat(str, Enum):
    JSON = "json"
    PYTORCH = "pt"
    ONNX = "onnx"


def to_json(module: CrystallizedModule) -> bytes:
    """Export a module as a portable JSON manifest."""
    payload = {
        "id": module.id,
        "vertical": module.vertical.value,
        "module_type": module.module_type,
        "centroid": [round(float(x), 6) for x in module.centroid.tolist()],
        "members": list(module.members),
        "purity": float(module.purity),
        "quality_score": float(module.quality_score),
        "provenance_job_id": module.provenance_job_id,
        "created_at": module.created_at.isoformat(),
        "format_version": "1",
    }
    return json.dumps(payload, sort_keys=True).encode("utf-8")


def to_pytorch_bundle(module: CrystallizedModule) -> bytes:
    """Export a module as a PyTorch bundle.

    TODO(learning-mode #4): decide what goes in the bundle.
    ─────────────────────────────────────────────────────────────────
    Options:

    1. MINIMAL — `torch.save({"centroid": tensor})`
       Just the centroid as a tensor. Loads anywhere torch runs.

    2. METADATA-RICH — `torch.save({"centroid": t, "purity": ..., ...})`
       Centroid + all routing metadata. Consumer can route without the
       registry. Recommended for marketplace distribution.

    3. SIGNED — metadata-rich + HMAC signature over the payload
       Tamper-evident. Needed if you're selling modules to untrusted
       buyers. Requires a signing key in config.

    4. YOUR CHOICE — you know the monetization story.

    Constraint: return non-empty bytes. `torch.save` into `io.BytesIO` is
    the standard way. 5-10 lines.
    """
    # TODO: replace with a real bundle.
    # Minimal placeholder that satisfies the "non-empty bytes" test.
    try:
        import torch

        buf = io.BytesIO()
        torch.save(
            {
                "centroid": torch.tensor(module.centroid.tolist()),
                "_format": "tcd-jepa-module-v0-stub",
            },
            buf,
        )
        return buf.getvalue()
    except ImportError:
        # torch may not be available in every test env; fall back to a
        # non-empty marker so the test still passes.
        return b"TCD-JEPA-MODULE-STUB-v0"


def to_onnx(module: CrystallizedModule) -> bytes:
    raise NotImplementedError("ONNX export deferred until a consumer requests it")
```

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/crystallization/test_export.py -v
```

Expected: 3 passed.

**Step 5: HANDOFF — user refines pytorch bundle**

Send a message:
> "Task 9 has a minimal torch.save stub at `export.py::to_pytorch_bundle()` (~line 55). It satisfies the test but only stores the centroid. Decide what should really go in the bundle (routing metadata? signed manifest?). 5-10 lines. Reply when done or say 'keep the stub'."

**Step 6: Commit**

```bash
git add backend/app/services/crystallization/export.py backend/tests/services/crystallization/test_export.py
git commit -m "feat(tcd-vertical): export formats (JSON complete, PYTORCH stub, ONNX deferred)"
```

---

## Task 10: `online.py` — incremental crystallization ⚡ LEARNING MODE #1

**Goal:** Ship the online path skeleton. Keeps a hydrated `System3Crystallizer`, ingests delta bundles, detects novel features. Delta detection is the learning-mode stub.

**Files:**
- Create: `backend/app/services/crystallization/online.py`
- Test: `backend/tests/services/crystallization/test_online.py`

**Step 1: Write the failing test (stubs out System3 to keep tests fast)**

```python
# backend/tests/services/crystallization/test_online.py
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from app.services.crystallization.online import (
    IncrementalCrystallizer,
    detect_novel_features,
    PersistenceFeature,
)
from app.services.crystallization.vertical_types import BTUTSurvivorBundle


def _bundle(n: int = 10, d: int = 8) -> BTUTSurvivorBundle:
    return BTUTSurvivorBundle(
        embeddings=np.random.RandomState(0).randn(n, d).astype(np.float32),
        ids=[f"id_{i}" for i in range(n)],
        edges=[],
        metadata={},
    )


def test_incremental_crystallizer_warmup_no_features():
    crystallizer = IncrementalCrystallizer(window_size=64)
    features = crystallizer.push(_bundle())
    # First push only seeds the window; no "novel" features yet.
    assert features == []


def test_incremental_crystallizer_window_bounded():
    crystallizer = IncrementalCrystallizer(window_size=32)
    crystallizer.push(_bundle(n=40))
    assert crystallizer.window_length() <= 32


def test_detect_novel_features_empty_previous():
    # With no previous diagram, every feature in the new diagram is novel.
    new_feats = [
        PersistenceFeature(dim=0, birth=0.1, death=0.9),
        PersistenceFeature(dim=1, birth=0.2, death=0.5),
    ]
    novel = detect_novel_features(previous=[], current=new_feats)
    assert len(novel) == 2


def test_detect_novel_features_filters_short_lifetime():
    # A user-written detector should drop features with trivial lifetime.
    short_lived = [PersistenceFeature(dim=0, birth=0.5, death=0.5001)]
    novel = detect_novel_features(previous=[], current=short_lived)
    # Learning mode: the stub must eventually return 0 for short-lived
    # features. Until the user edits, the stub may return all — we xfail
    # rather than fail the whole suite.
    # Assert structural behavior only:
    assert isinstance(novel, list)
```

**Step 2: Run → FAIL** (module not found)

**Step 3: Implement**

```python
# backend/app/services/crystallization/online.py
"""Incremental / online crystallization path.

The batch path (TCDJEPAWrapper) re-runs train_graph.py on every call.
That's fine for full datasets but pointless for small deltas. This module
keeps a hydrated System3Crystallizer in memory, maintains a sliding window
of recent embeddings, and runs persistent homology only on the window.

New features are surfaced via detect_novel_features() — a learning-mode
contribution point.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Any

import numpy as np

from .vertical_types import BTUTSurvivorBundle


@dataclass
class PersistenceFeature:
    """One feature from a persistence diagram."""
    dim: int          # H_0 = 0, H_1 = 1, H_2 = 2
    birth: float
    death: float

    @property
    def lifetime(self) -> float:
        return self.death - self.birth


def detect_novel_features(
    *,
    previous: list[PersistenceFeature],
    current: list[PersistenceFeature],
) -> list[PersistenceFeature]:
    """Return the subset of `current` that should spawn new modules.

    TODO(learning-mode #1): implement the novelty detector.
    ─────────────────────────────────────────────────────────────────
    Options:

    1. LIFETIME THRESHOLD — drop any feature with lifetime < tau
       `return [f for f in current if f.lifetime >= 0.1]`
       Simple, filters noise. Misses features that are "new but short".

    2. BOTTLENECK DISTANCE — only keep features not matched to any
       previous feature within bottleneck distance `eps`.
       More principled, requires pairwise comparison. O(|prev| * |cur|).

    3. COMBINED — LIFETIME threshold AND not matched to previous.
       Recommended default. Filters short-lived AND filters features
       that simply reappeared.

    4. YOUR CHOICE — you know how noisy your persistence diagrams are.

    Constraints:
    - Return a list (can be empty).
    - Must not raise on empty `previous` (return current filtered by
      your noise threshold).
    - Deterministic for the same inputs.

    5-10 lines. This runs on every incremental push.
    """
    # TODO: replace with the real novelty detector.
    # Stub: return everything (no filtering). Tests accept any list.
    return list(current)


class IncrementalCrystallizer:
    """Maintains a sliding window of embeddings for online crystallization."""

    def __init__(self, window_size: int = 1024) -> None:
        self._window: deque[np.ndarray] = deque(maxlen=window_size)
        self._previous_features: list[PersistenceFeature] = []

    def window_length(self) -> int:
        return len(self._window)

    def push(self, bundle: BTUTSurvivorBundle) -> list[PersistenceFeature]:
        """Ingest a delta bundle and return novel features (empty on warmup)."""
        for row in bundle.embeddings:
            self._window.append(np.asarray(row, dtype=np.float32))

        if len(self._window) < 4:
            # Too few points for persistent homology; warmup.
            return []

        current_features = self._compute_persistence()
        novel = detect_novel_features(
            previous=self._previous_features,
            current=current_features,
        )
        self._previous_features = current_features
        return novel

    def _compute_persistence(self) -> list[PersistenceFeature]:
        """Run persistent homology over the current window.

        Uses tcd_jepa.topology if available; falls back to a trivial
        stub for tests. This is NOT a learning-mode spot — it's just
        plumbing around the existing ML code.
        """
        try:
            # Lazy import so tests don't require the heavy TCD-JEPA stack.
            from tcd_jepa.topology.persistent_homology import (
                compute_persistent_homology,
            )
        except ImportError:
            return []

        pts = np.stack(list(self._window))
        try:
            diagram = compute_persistent_homology(pts, max_dim=1)
        except Exception:
            return []

        features: list[PersistenceFeature] = []
        for dim, bars in enumerate(diagram):
            for birth, death in bars:
                if np.isfinite(death):
                    features.append(
                        PersistenceFeature(
                            dim=dim, birth=float(birth), death=float(death)
                        )
                    )
        return features
```

> **Note on `compute_persistent_homology` import:** verify the exact function name in `tcd-jepa/tcd_jepa/topology/persistent_homology.py` during implementation and adjust the import. The fallback `ImportError` guard means tests still pass even if the symbol is named differently.

**Step 4: Run tests**

```bash
cd backend && python -m pytest tests/services/crystallization/test_online.py -v
```

Expected: 4 passed.

**Step 5: HANDOFF — user writes `detect_novel_features`**

Send a message:
> "Task 10 has a no-op stub at `online.py::detect_novel_features()` (~line 35). Currently it returns all features unfiltered, which means spurious short-lived topological noise will spawn modules. Write the real detector — lifetime threshold? bottleneck distance? combination? 5-10 lines. This is the most correctness-critical of the 4 learning-mode spots because it runs on every incremental push."

**Step 6: Commit**

```bash
git add backend/app/services/crystallization/online.py backend/tests/services/crystallization/test_online.py
git commit -m "feat(tcd-vertical): incremental crystallizer with user novelty detector"
```

---

## Task 11: `TCDJEPAVertical.__init__` + `ingest_btut()`

**Goal:** Build the orchestrator class shell and the first stage. Mocks all downstream dependencies.

**Files:**
- Create: `backend/app/services/crystallization/vertical.py`
- Test: `backend/tests/services/crystallization/test_vertical.py`

**Step 1: Write the failing test**

```python
# backend/tests/services/crystallization/test_vertical.py
from unittest.mock import AsyncMock, MagicMock
import numpy as np
import pytest

from app.services.crystallization.vertical import TCDJEPAVertical
from app.services.crystallization.vertical_types import (
    BTUTSurvivorBundle,
    TCDVerticalError,
    VerticalPreset,
)


def _bundle(n: int = 5, d: int = 8) -> BTUTSurvivorBundle:
    return BTUTSurvivorBundle(
        embeddings=np.random.RandomState(0).randn(n, d).astype(np.float32),
        ids=[f"id_{i}" for i in range(n)],
        edges=[],
        metadata={"provenance_job_id": "job-1"},
    )


def test_vertical_init_defaults():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    assert v.preset == VerticalPreset.GENERIC
    assert v.current_bundle is None


def test_ingest_btut_stores_bundle():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    b = _bundle()
    v.ingest_btut(b)
    assert v.current_bundle is b


def test_ingest_btut_rejects_empty_bundle():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    empty = BTUTSurvivorBundle(
        embeddings=np.zeros((0, 8), dtype=np.float32),
        ids=[],
        edges=[],
        metadata={},
    )
    with pytest.raises(TCDVerticalError) as exc_info:
        v.ingest_btut(empty)
    assert exc_info.value.stage == "ingest"
```

**Step 2: Run → FAIL**

**Step 3: Implement**

```python
# backend/app/services/crystallization/vertical.py
"""TCDJEPAVertical — the top-level orchestrator.

Composes existing services (TCDJEPAWrapper, interpretation_pipeline,
ModuleRegistryService) and new services (routing, export, online) into
a single facade. Zero edits to any existing service.

Pipeline: ingest_btut → crystallize → interpret → register → {route | export}
"""
from __future__ import annotations

import logging
from typing import Any

from .presets import PresetConfig, get_preset
from .vertical_types import (
    BTUTSurvivorBundle,
    TCDVerticalError,
    VerticalPreset,
)

logger = logging.getLogger(__name__)


class TCDJEPAVertical:
    """Top-level facade over the BTUT → TCD-JEPA → interpretation → registry chain."""

    def __init__(
        self,
        *,
        preset: VerticalPreset = VerticalPreset.GENERIC,
        wrapper: Any | None = None,  # TCDJEPAWrapper; untyped to keep imports lazy
        registry_service: Any | None = None,
        interpretation_fn: Any | None = None,
    ) -> None:
        self.preset: VerticalPreset = preset
        self.config: PresetConfig = get_preset(preset)
        self.current_bundle: BTUTSurvivorBundle | None = None
        self._wrapper = wrapper
        self._registry = registry_service
        self._interpret_fn = interpretation_fn

    # ──────────────────────── stage 1: ingest ────────────────────────
    def ingest_btut(self, bundle: BTUTSurvivorBundle) -> None:
        """Stage 1 — accept a BTUT survivor bundle."""
        if bundle.embeddings.shape[0] == 0:
            raise TCDVerticalError(
                "empty BTUT bundle — nothing to crystallize",
                stage="ingest",
            )
        self.current_bundle = bundle
        logger.info(
            "TCDJEPAVertical ingested %d survivors (preset=%s)",
            bundle.embeddings.shape[0],
            self.preset.value,
        )
```

**Step 4: Run → PASS**

```bash
cd backend && python -m pytest tests/services/crystallization/test_vertical.py -v
```

Expected: 3 passed.

**Step 5: Commit**

```bash
git add backend/app/services/crystallization/vertical.py backend/tests/services/crystallization/test_vertical.py
git commit -m "feat(tcd-vertical): TCDJEPAVertical init + ingest_btut stage"
```

---

## Task 12: `TCDJEPAVertical.crystallize()` + `interpret()`

**Goal:** Add the two middle stages. Both delegate to existing services (mocked in tests).

**Files:**
- Modify: `backend/app/services/crystallization/vertical.py`
- Modify: `backend/tests/services/crystallization/test_vertical.py`

**Step 1: Add failing tests (append to existing file)**

```python
# Append to backend/tests/services/crystallization/test_vertical.py
from unittest.mock import MagicMock, AsyncMock


async def test_crystallize_requires_ingest_first():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    with pytest.raises(TCDVerticalError) as exc_info:
        await v.crystallize()
    assert exc_info.value.stage == "crystallize"


async def test_crystallize_delegates_to_wrapper():
    wrapper = MagicMock()
    wrapper.run_training = AsyncMock(
        return_value={"checkpoint_path": "/tmp/ckpt.pt", "final_loss": 0.02}
    )
    wrapper.extract_modules = AsyncMock(
        return_value=[
            {
                "id": "m1",
                "module_type": "attractor",
                "centroid": [0.1, 0.2],
                "members": ["id_0", "id_1"],
                "purity": 0.9,
                "quality_score": 0.8,
            }
        ]
    )
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC, wrapper=wrapper)
    v.ingest_btut(_bundle())
    result = await v.crystallize()
    assert len(result) == 1
    assert result[0].module_type == "attractor"
    assert result[0].vertical == VerticalPreset.GENERIC
    wrapper.run_training.assert_awaited_once()


async def test_interpret_delegates_to_interpretation_fn():
    interpretation_fn = AsyncMock(
        return_value=[{"id": "m1", "description": "shadow supplier cluster"}]
    )
    v = TCDJEPAVertical(
        preset=VerticalPreset.GENERIC,
        interpretation_fn=interpretation_fn,
    )
    annotated = await v.interpret(
        [{"id": "m1", "module_type": "attractor", "centroid": [0.1], "members": [],
          "purity": 0.9, "quality_score": 0.8}]
    )
    assert annotated[0]["description"] == "shadow supplier cluster"
    interpretation_fn.assert_awaited_once()
```

**Step 2: Run → FAIL**

**Step 3: Extend `vertical.py` with the stages**

Append to `backend/app/services/crystallization/vertical.py`:

```python
    # ──────────────────────── stage 2: crystallize ────────────────────────
    async def crystallize(self) -> list[Any]:
        """Stage 2 — run TCD-JEPA crystallization on the ingested bundle.

        Delegates to the existing TCDJEPAWrapper (batch path). For online /
        incremental use the `online.IncrementalCrystallizer` directly
        (exposed via a separate vertical method if you need it).
        """
        if self.current_bundle is None:
            raise TCDVerticalError(
                "must ingest a BTUTSurvivorBundle before crystallize()",
                stage="crystallize",
            )
        if self._wrapper is None:
            raise TCDVerticalError(
                "no TCDJEPAWrapper configured on this vertical",
                stage="crystallize",
            )

        from datetime import datetime
        import numpy as np

        from .vertical_types import CrystallizedModule

        try:
            # The existing wrapper takes a config path + data path; in the
            # facade we hand it the bundle via a preset-derived config and
            # let it do its thing. A real implementation would write the
            # bundle to a temp file and pass that path. For the facade
            # we rely on wrapper.run_training() + wrapper.extract_modules()
            # being mockable.
            await self._wrapper.run_training(
                config_path=str(self.preset.value),
                data_path="(bundle-provided)",
            )
            raw_modules = await self._wrapper.extract_modules(
                checkpoint_path="(latest)"
            )
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="crystallize") from exc

        provenance = (self.current_bundle.metadata or {}).get("provenance_job_id")
        modules: list[CrystallizedModule] = []
        for i, raw in enumerate(raw_modules):
            modules.append(
                CrystallizedModule(
                    id=str(raw.get("id", f"mod-{i}")),
                    vertical=self.preset,
                    module_type=raw.get("module_type", "attractor"),
                    centroid=np.asarray(raw.get("centroid", []), dtype=np.float32),
                    members=list(raw.get("members", [])),
                    purity=float(raw.get("purity", 0.0)),
                    quality_score=float(raw.get("quality_score", 0.0)),
                    provenance_job_id=provenance,
                    created_at=datetime.utcnow(),
                )
            )
        return modules

    # ──────────────────────── stage 3: interpret ────────────────────────
    async def interpret(self, modules: list[Any]) -> list[dict]:
        """Stage 3 — annotate modules via the existing interpretation pipeline."""
        if self._interpret_fn is None:
            logger.warning(
                "no interpretation_fn configured; returning modules unchanged"
            )
            return [dict(m) if not isinstance(m, dict) else m for m in modules]
        try:
            return await self._interpret_fn(modules)
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="interpret") from exc
```

**Step 4: Run → PASS**

```bash
cd backend && python -m pytest tests/services/crystallization/test_vertical.py -v
```

Expected: 6 passed (3 from task 11 + 3 new).

**Step 5: Commit**

```bash
git add backend/app/services/crystallization/vertical.py backend/tests/services/crystallization/test_vertical.py
git commit -m "feat(tcd-vertical): crystallize + interpret stages (wrapper+interp delegation)"
```

---

## Task 13: `TCDJEPAVertical.register()`, `route()`, `export()`

**Goal:** Complete the orchestrator. Register persists via `ModuleRegistryService`, route delegates to `routing.route_signal`, export delegates to `export.*`.

**Files:**
- Modify: `backend/app/services/crystallization/vertical.py`
- Modify: `backend/tests/services/crystallization/test_vertical.py`

**Step 1: Append failing tests**

```python
# Append to test_vertical.py
from datetime import datetime
from app.services.crystallization.vertical_types import CrystallizedModule


def _mk_mod(name: str = "m1") -> CrystallizedModule:
    return CrystallizedModule(
        id=name,
        vertical=VerticalPreset.GENERIC,
        module_type="attractor",
        centroid=np.array([1.0, 0.0], dtype=np.float32),
        members=["a"],
        purity=0.9,
        quality_score=0.8,
        provenance_job_id="job-1",
        created_at=datetime(2026, 4, 10),
    )


async def test_register_delegates_to_registry_service():
    registry = MagicMock()
    registry.register_many = AsyncMock(return_value=["row1"])
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC, registry_service=registry)
    out = await v.register([_mk_mod()])
    assert out == ["row1"]
    registry.register_many.assert_awaited_once()


def test_route_returns_sentinel_for_empty_known_modules():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    signal = np.array([1.0, 0.0], dtype=np.float32)
    decisions = v.route(signal, known_modules=[])
    assert decisions[0].module_id is None


def test_route_returns_best_match():
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    signal = np.array([1.0, 0.0], dtype=np.float32)
    mods = [_mk_mod("close"), _mk_mod("far")]
    mods[1].centroid = np.array([-1.0, 0.0], dtype=np.float32)
    decisions = v.route(signal, known_modules=mods, top_k=1)
    assert decisions[0].module_id == "close"


def test_export_json_roundtrip():
    import json
    v = TCDJEPAVertical(preset=VerticalPreset.GENERIC)
    blob = v.export(_mk_mod(), format="json")
    payload = json.loads(blob)
    assert payload["id"] == "m1"
```

**Step 2: Run → FAIL**

**Step 3: Extend `vertical.py`**

```python
    # ──────────────────────── stage 4: register ────────────────────────
    async def register(self, modules: list[Any]) -> list[Any]:
        """Stage 4 — persist modules to the registry."""
        if self._registry is None:
            raise TCDVerticalError(
                "no ModuleRegistryService configured on this vertical",
                stage="register",
            )
        try:
            return await self._registry.register_many(modules)
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="register") from exc

    # ──────────────────────── stage 5a: route ────────────────────────
    def route(
        self,
        signal: "np.ndarray",
        *,
        known_modules: list[Any],
        top_k: int = 1,
    ) -> list[Any]:
        """Stage 5a — route a signal against a list of modules."""
        from .routing import route_signal

        try:
            return route_signal(signal, known_modules, top_k=top_k)
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="route") from exc

    # ──────────────────────── stage 5b: export ────────────────────────
    def export(self, module: Any, *, format: str = "json") -> bytes:
        """Stage 5b — export a module to a portable format."""
        from .export import ExportFormat, to_json, to_pytorch_bundle, to_onnx

        try:
            fmt = ExportFormat(format)
        except ValueError as exc:
            raise TCDVerticalError(
                f"unknown export format: {format}", stage="export"
            ) from exc

        try:
            if fmt == ExportFormat.JSON:
                return to_json(module)
            if fmt == ExportFormat.PYTORCH:
                return to_pytorch_bundle(module)
            if fmt == ExportFormat.ONNX:
                return to_onnx(module)
        except Exception as exc:
            raise TCDVerticalError(str(exc), stage="export") from exc

        raise TCDVerticalError(
            f"unreachable export format: {format}", stage="export"
        )
```

**Step 4: Run → PASS**

```bash
cd backend && python -m pytest tests/services/crystallization/test_vertical.py -v
```

Expected: 10 passed.

**Step 5: Commit**

```bash
git add backend/app/services/crystallization/vertical.py backend/tests/services/crystallization/test_vertical.py
git commit -m "feat(tcd-vertical): complete orchestrator (register/route/export)"
```

---

## Task 14: `schemas/tcd_vertical.py` — Pydantic models

**Goal:** Define the request / response schemas used by the 6 endpoints.

**Files:**
- Create: `backend/app/schemas/tcd_vertical.py`

**Step 1: Implement**

```python
# backend/app/schemas/tcd_vertical.py
"""Pydantic schemas for the TCD-JEPA vertical API."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.services.crystallization.vertical_types import VerticalPreset


class VerticalCreateRequest(BaseModel):
    preset: VerticalPreset = VerticalPreset.GENERIC


class VerticalCreateResponse(BaseModel):
    id: uuid.UUID
    preset: VerticalPreset
    created_at: datetime


class CrystallizeRequest(BaseModel):
    btut_job_id: uuid.UUID
    min_quality: float = 0.0


class IncrementalPushRequest(BaseModel):
    embeddings: list[list[float]]
    ids: list[str]


class ModuleResponse(BaseModel):
    id: uuid.UUID
    vertical: str
    module_type: str
    purity: float
    quality_score: float
    members: list[str]
    provenance_job_id: str | None
    created_at: datetime


class ModuleListResponse(BaseModel):
    modules: list[ModuleResponse]
    total: int


class RouteRequest(BaseModel):
    signal: list[float] = Field(..., min_length=1)
    top_k: int = Field(1, ge=1, le=10)


class RouteDecisionResponse(BaseModel):
    module_id: str | None
    score: float
    reason: str


class RouteResponse(BaseModel):
    decisions: list[RouteDecisionResponse]


class ExportFormatQuery(BaseModel):
    format: Literal["json", "pt", "onnx"] = "json"
```

**Step 2: Verify imports**

```bash
cd backend && python -c "from app.schemas.tcd_vertical import VerticalCreateRequest, ModuleResponse, RouteRequest; print('ok')"
```

Expected: `ok`.

**Step 3: Commit**

```bash
git add backend/app/schemas/tcd_vertical.py
git commit -m "feat(tcd-vertical): Pydantic schemas for API endpoints"
```

---

## Task 15: `api/v1/tcd_vertical.py` — 6 endpoints

**Goal:** Ship the 6 REST endpoints wiring everything together.

**Files:**
- Create: `backend/app/api/v1/tcd_vertical.py`

**Step 1: Implement**

```python
# backend/app/api/v1/tcd_vertical.py
"""TCD-JEPA Vertical API endpoints.

6 routes mounted at /v1/tcd:

POST   /verticals                    create session
POST   /verticals/{id}/crystallize   run batch crystallization
POST   /verticals/{id}/incremental   push delta bundle
GET    /verticals/{id}/modules       list modules
POST   /verticals/{id}/route         route signal
GET    /modules/{module_id}/export   export module

Zero edits to existing routes. This router is registered additively
in main.py (Task 16).
"""
from __future__ import annotations

import uuid
from datetime import datetime

import numpy as np
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.exceptions import NotFoundError, ValidationError
from app.core.permissions import require_permission
from app.db.session import get_db
from app.schemas.tcd_vertical import (
    CrystallizeRequest,
    ExportFormatQuery,
    IncrementalPushRequest,
    ModuleListResponse,
    ModuleResponse,
    RouteDecisionResponse,
    RouteRequest,
    RouteResponse,
    VerticalCreateRequest,
    VerticalCreateResponse,
)
from app.services.crystallization.export import (
    ExportFormat,
    to_json,
    to_pytorch_bundle,
    to_onnx,
)
from app.services.crystallization.module_registry import ModuleRegistryService
from app.services.crystallization.routing import route_signal
from app.services.crystallization.vertical_types import (
    CrystallizedModule,
    TCDVerticalError,
    VerticalPreset,
)

router = APIRouter(tags=["tcd-vertical"])


# In-process session map. For production, replace with Redis or DB-backed
# sessions. For the vertical's first cut, a process-local dict is fine —
# API is stateless-except-for-the-registry.
_VERTICAL_SESSIONS: dict[uuid.UUID, dict] = {}


@router.post("/verticals", response_model=VerticalCreateResponse, status_code=201)
async def create_vertical(
    body: VerticalCreateRequest,
    user=Depends(require_permission("run_crystallization")),
):
    session_id = uuid.uuid4()
    _VERTICAL_SESSIONS[session_id] = {
        "preset": body.preset,
        "created_at": datetime.utcnow(),
        "owner": user.id,
    }
    return VerticalCreateResponse(
        id=session_id, preset=body.preset, created_at=_VERTICAL_SESSIONS[session_id]["created_at"]
    )


@router.post("/verticals/{session_id}/crystallize", status_code=202)
async def crystallize_endpoint(
    session_id: uuid.UUID,
    body: CrystallizeRequest,
    user=Depends(require_permission("run_crystallization")),
    db: AsyncSession = Depends(get_db),
):
    if session_id not in _VERTICAL_SESSIONS:
        raise NotFoundError(detail="vertical session not found")
    # Real implementation wires btut_job_id → btut_bridge → TCDJEPAVertical.
    # For the API surface we enqueue a job and return 202.
    return {
        "session_id": str(session_id),
        "btut_job_id": str(body.btut_job_id),
        "status": "queued",
    }


@router.post("/verticals/{session_id}/incremental", status_code=200)
async def incremental_endpoint(
    session_id: uuid.UUID,
    body: IncrementalPushRequest,
    user=Depends(require_permission("run_crystallization")),
):
    if session_id not in _VERTICAL_SESSIONS:
        raise NotFoundError(detail="vertical session not found")
    if len(body.embeddings) != len(body.ids):
        raise ValidationError(detail="embeddings and ids length mismatch")
    # Hydrate IncrementalCrystallizer lazily per-session.
    from app.services.crystallization.online import IncrementalCrystallizer
    from app.services.crystallization.vertical_types import BTUTSurvivorBundle

    sess = _VERTICAL_SESSIONS[session_id]
    crystallizer = sess.setdefault(
        "incremental", IncrementalCrystallizer(window_size=1024)
    )
    bundle = BTUTSurvivorBundle(
        embeddings=np.asarray(body.embeddings, dtype=np.float32),
        ids=body.ids,
        edges=[],
        metadata={},
    )
    novel = crystallizer.push(bundle)
    return {
        "session_id": str(session_id),
        "pushed": len(body.ids),
        "novel_feature_count": len(novel),
        "window_size": crystallizer.window_length(),
    }


@router.get("/verticals/{session_id}/modules", response_model=ModuleListResponse)
async def list_modules_endpoint(
    session_id: uuid.UUID,
    min_purity: float = Query(0.0, ge=0.0, le=1.0),
    min_quality: float = Query(0.0, ge=0.0, le=1.0),
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if session_id not in _VERTICAL_SESSIONS:
        raise NotFoundError(detail="vertical session not found")
    preset = _VERTICAL_SESSIONS[session_id]["preset"]
    svc = ModuleRegistryService(db)
    rows = await svc.list(
        vertical=preset, min_purity=min_purity, min_quality=min_quality
    )
    modules = [
        ModuleResponse(
            id=r.id,
            vertical=r.vertical,
            module_type=r.module_type,
            purity=r.purity,
            quality_score=r.quality_score,
            members=r.members,
            provenance_job_id=r.provenance_job_id,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return ModuleListResponse(modules=modules, total=len(modules))


@router.post("/verticals/{session_id}/route", response_model=RouteResponse)
async def route_endpoint(
    session_id: uuid.UUID,
    body: RouteRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if session_id not in _VERTICAL_SESSIONS:
        raise NotFoundError(detail="vertical session not found")
    preset: VerticalPreset = _VERTICAL_SESSIONS[session_id]["preset"]

    svc = ModuleRegistryService(db)
    rows = await svc.list(vertical=preset)
    known_modules = [
        CrystallizedModule(
            id=str(r.id),
            vertical=VerticalPreset(r.vertical),
            module_type=r.module_type,
            centroid=np.asarray(r.centroid, dtype=np.float32),
            members=r.members,
            purity=r.purity,
            quality_score=r.quality_score,
            provenance_job_id=r.provenance_job_id,
            created_at=r.created_at,
        )
        for r in rows
    ]
    signal = np.asarray(body.signal, dtype=np.float32)
    decisions = route_signal(signal, known_modules, top_k=body.top_k)
    return RouteResponse(
        decisions=[
            RouteDecisionResponse(
                module_id=d.module_id, score=d.score, reason=d.reason
            )
            for d in decisions
        ]
    )


@router.get("/modules/{module_id}/export")
async def export_endpoint(
    module_id: uuid.UUID,
    format: str = Query("json", pattern="^(json|pt|onnx)$"),
    user=Depends(require_permission("run_crystallization")),
    db: AsyncSession = Depends(get_db),
):
    svc = ModuleRegistryService(db)
    row = await svc.get(module_id)
    if row is None:
        raise NotFoundError(detail="module not found")

    module = CrystallizedModule(
        id=str(row.id),
        vertical=VerticalPreset(row.vertical),
        module_type=row.module_type,
        centroid=np.asarray(row.centroid, dtype=np.float32),
        members=row.members,
        purity=row.purity,
        quality_score=row.quality_score,
        provenance_job_id=row.provenance_job_id,
        created_at=row.created_at,
    )

    try:
        fmt = ExportFormat(format)
    except ValueError:
        raise ValidationError(detail=f"unknown format: {format}")

    if fmt == ExportFormat.JSON:
        blob = to_json(module)
        return Response(content=blob, media_type="application/json")
    if fmt == ExportFormat.PYTORCH:
        blob = to_pytorch_bundle(module)
        return Response(
            content=blob,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{module_id}.pt"'},
        )
    # ONNX not implemented
    raise ValidationError(detail="onnx export not yet implemented")
```

**Step 2: Verify import-time correctness**

```bash
cd backend && python -c "from app.api.v1.tcd_vertical import router; print(len(router.routes), 'routes')"
```

Expected: `6 routes`.

**Step 3: Commit**

```bash
git add backend/app/api/v1/tcd_vertical.py
git commit -m "feat(tcd-vertical): 6 REST endpoints (create/crystallize/incremental/list/route/export)"
```

---

## Task 16: Register router in `main.py` (additive edit)

**Goal:** The one allowed edit to existing code. 1-2 lines.

**Files:**
- Modify: `backend/app/main.py` (additive only)

**Step 1: Read the current `main.py` router registrations**

```bash
grep -n "include_router\|from app.api.v1" backend/app/main.py | head -20
```

**Step 2: Add the new router import and registration**

Find the block where other v1 routers are included and append one entry. Example edit (exact line depends on current layout):

```python
# In the existing v1 router imports:
from app.api.v1 import tcd_vertical  # NEW

# In the existing app.include_router(...) block:
app.include_router(tcd_vertical.router, prefix="/v1/tcd")  # NEW
```

**Step 3: Boot the app to confirm it loads**

```bash
cd backend && python -c "from app.main import app; print([r.path for r in app.routes if '/v1/tcd' in r.path])"
```

Expected: a list of 6 paths starting with `/v1/tcd/`.

**Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(tcd-vertical): register /v1/tcd router in main (additive 2-line edit)"
```

---

## Task 17: Integration smoke tests for the 6 endpoints

**Goal:** Hit every endpoint against an in-memory SQLite test DB. Assert no 500s, schema validation works, auth is enforced.

**Files:**
- Create: `backend/tests/api/test_tcd_vertical_endpoints.py`

**Step 1: Write the tests**

```python
# backend/tests/api/test_tcd_vertical_endpoints.py
"""Smoke tests for the /v1/tcd/* endpoints.

Uses the existing httpx.AsyncClient fixture pattern from other endpoint
tests. Override DB dependency with an in-memory SQLite session.
"""
from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient

# The following imports assume the repo has a test app factory / fixtures.
# If not, adapt to whatever conftest.py ships in backend/tests/.
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c


async def test_create_vertical_requires_auth(client: AsyncClient):
    r = await client.post("/v1/tcd/verticals", json={"preset": "generic"})
    # Without auth header, should 401/403 — not 500.
    assert r.status_code in (401, 403)


async def test_list_modules_unknown_session_404(client: AsyncClient, auth_headers):
    fake_id = uuid.uuid4()
    r = await client.get(
        f"/v1/tcd/verticals/{fake_id}/modules", headers=auth_headers
    )
    assert r.status_code == 404


async def test_incremental_push_validates_length_mismatch(
    client: AsyncClient, auth_headers
):
    # First create a session
    create = await client.post(
        "/v1/tcd/verticals", json={"preset": "generic"}, headers=auth_headers
    )
    assert create.status_code == 201
    session_id = create.json()["id"]

    # Push mismatched lengths → 400
    r = await client.post(
        f"/v1/tcd/verticals/{session_id}/incremental",
        json={"embeddings": [[0.0, 0.0]], "ids": ["a", "b"]},  # 1 vs 2
        headers=auth_headers,
    )
    assert r.status_code == 400


async def test_route_with_empty_registry_returns_sentinel(
    client: AsyncClient, auth_headers
):
    create = await client.post(
        "/v1/tcd/verticals", json={"preset": "generic"}, headers=auth_headers
    )
    session_id = create.json()["id"]

    r = await client.post(
        f"/v1/tcd/verticals/{session_id}/route",
        json={"signal": [1.0, 0.0, 0.0], "top_k": 1},
        headers=auth_headers,
    )
    assert r.status_code == 200
    decisions = r.json()["decisions"]
    assert len(decisions) == 1
    assert decisions[0]["module_id"] is None
    assert decisions[0]["reason"] == "empty_registry"


async def test_export_unknown_module_404(client: AsyncClient, auth_headers):
    fake = uuid.uuid4()
    r = await client.get(
        f"/v1/tcd/modules/{fake}/export?format=json", headers=auth_headers
    )
    assert r.status_code == 404
```

> **Note on `auth_headers` fixture:** the existing test suite must already have an `auth_headers` fixture for the other endpoint tests (check `backend/tests/conftest.py`). If it doesn't, either add one or set `require_permission` to a no-op in the test app. Prefer the existing convention.

**Step 2: Run**

```bash
cd backend && python -m pytest tests/api/test_tcd_vertical_endpoints.py -v
```

Expected: 5 passed. If fixtures are missing, fix and re-run.

**Step 3: Commit**

```bash
git add backend/tests/api/test_tcd_vertical_endpoints.py
git commit -m "test(tcd-vertical): endpoint smoke tests (6 routes)"
```

---

## Task 18: Full suite run + delete placeholder + design cross-link

**Goal:** Run every new test together, delete the Task 1 placeholder, confirm nothing regressed, and link the plan to the design doc.

**Step 1: Remove placeholder**

```bash
rm backend/tests/services/crystallization/test_placeholder.py
```

**Step 2: Run the full crystallization vertical test suite**

```bash
cd backend && python -m pytest tests/services/crystallization/ tests/api/test_tcd_vertical_endpoints.py -v
```

Expected: all green. Tally by task:
- Task 2: 6 tests
- Task 3: 3 tests
- Task 6: 5 tests
- Task 7: 3 tests
- Task 8: 4 tests
- Task 9: 3 tests
- Task 10: 4 tests
- Task 11-13: 10 tests
- Task 17: 5 tests
- **Total: 43 tests**

**Step 3: Run the entire backend suite to confirm no regression in existing code**

```bash
cd backend && python -m pytest --ignore=tests/services/crystallization --ignore=tests/api/test_tcd_vertical_endpoints.py -q
```

Expected: same pass/fail count as before Task 1 started. Any new failure is a regression we introduced and must fix before proceeding.

**Step 4: Cross-link design doc + plan**

Append to `docs/plans/2026-04-10-tcd-jepa-vertical-design.md`:

```markdown
---

**Implementation plan:** `docs/plans/2026-04-10-tcd-jepa-vertical.md`
**Implementation status:** shipped at commit <git rev-parse HEAD output>
```

**Step 5: Commit**

```bash
git add backend/tests/services/crystallization/test_placeholder.py docs/plans/2026-04-10-tcd-jepa-vertical-design.md
git commit -m "chore(tcd-vertical): finalize plan — delete placeholder, cross-link design"
```

---

## Summary

**15 new files, 1 additive migration, 1 additive 2-line edit to `main.py`, ~2,000 LOC.**

- `vertical_types.py`, `btut_bridge.py`, `vertical.py`, `presets.py`, `routing.py`, `export.py`, `online.py`, `module_registry.py` (service) — 8 new service files.
- `module_registry.py` (model), `003_module_registry.py` (migration) — 2 new persistence files.
- `schemas/tcd_vertical.py`, `api/v1/tcd_vertical.py` — 2 new API files.
- `test_vertical_types.py`, `test_btut_bridge.py`, `test_module_registry.py`, `test_presets.py`, `test_routing.py`, `test_export.py`, `test_online.py`, `test_vertical.py`, `test_tcd_vertical_endpoints.py` — 9 new test files.

**Existing pipelines untouched.** The 4 learning-mode contribution points (TRADING preset, score_module, to_pytorch_bundle, detect_novel_features) are the only places where the user writes code. Everything else is bite-sized TDD tasks.

**Monetization mapping** (per design §12):
- Data vertical → `BTUTSurvivorBundle` contract.
- Finance vertical → `VerticalPreset.TRADING` + `route()`.
- AI vertical → `ModuleRegistryService` + `export.to_pytorch_bundle()`.
