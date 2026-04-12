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
        await conn.run_sync(ModuleRegistryEntry.__table__.create)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


def _mk_module(name: str, vertical: VerticalPreset = VerticalPreset.TRADING) -> CrystallizedModule:
    # Vary centroid + members so hash_module() actually distinguishes modules.
    # The original spec helper held these constant, which collided with the
    # hash function's identity (hash_module excludes id/quality/provenance).
    seed = sum(ord(c) for c in name)
    return CrystallizedModule(
        id=name,
        vertical=vertical,
        module_type="attractor",
        centroid=np.array([0.1 + seed * 0.01, 0.2, 0.3], dtype=np.float32),
        members=[f"{name}_a", f"{name}_b"],
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
    m.quality_score = 0.99  # re-run with better score
    second = await svc.register_many([m])  # same provenance + same hash → update
    assert len(first) == 1
    assert len(second) == 1  # returns the updated row
    listed = await svc.list()
    assert len(listed) == 1  # still one row
    assert listed[0].quality_score == 0.99  # mutable fields updated


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
