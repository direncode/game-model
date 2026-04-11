# Latent Ocean Data Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a thin `LatentOceanDataLayer` facade that unifies ingest → BTUT → manifold → vertical export over the existing BTUT spine, with TDD, one EDGAR end-to-end demo, and zero changes to existing code.

**Architecture:** New subpackage `backend/app/services/data_layer/` with a stateful facade class, a manifold projection module (8D unit-sphere + 3D S²), a four-signal causal linker scaffold (cosine wired, three stubs), three vertical exporters (niv/tcd_jepa/data), and a demo script. Depends on existing `btut.pipeline.run_btut_pipeline` and `btut.adapters.get_adapter`. Purely additive.

**Tech Stack:** Python 3, numpy, scikit-learn (PCA), pytest, pytest-asyncio. No new deps.

**Reference:** Design doc at `docs/plans/2026-04-10-latent-ocean-data-layer-design.md`.

**Working directory:** `C:\Users\diren\Desktop\lsx-latentocean\`. Use bash (Unix-style paths — forward slashes, `/dev/null` not `NUL`).

**Test command baseline:** `cd backend && python -m pytest tests/services/test_data_layer.py -v`

---

## Task 1: Scaffold package, types, errors

**Files:**
- Create: `backend/app/services/data_layer/__init__.py`
- Create: `backend/app/services/data_layer/types.py`
- Create: `backend/app/services/data_layer/errors.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/services/__init__.py`
- Create: `backend/tests/services/test_data_layer.py`

**Step 1: Write the failing test**

```python
# backend/tests/services/test_data_layer.py
"""Tests for LatentOceanDataLayer facade."""
from __future__ import annotations

import numpy as np
import pytest

from app.services.data_layer.types import (
    IngestResult, BTUTRunResult, ManifoldCoords, Survivor,
    QualityMetrics, CausalLink,
)
from app.services.data_layer.errors import (
    NoIngestError, NoBTUTResultError, UnknownVerticalError,
)


def test_types_are_importable_dataclasses():
    ir = IngestResult(
        source_id="test", entities=[], edges=[], unique_types=[], fetch_seconds=0.0
    )
    assert ir.source_id == "test"
    ql = QualityMetrics(
        n_input=100, n_survivors=10, reduction_ratio=10,
        variance_preservation=0.9, wall_seconds=1.0, estimated_cost_usd=0.01,
    )
    assert ql.reduction_ratio == 10


def test_errors_are_exceptions():
    assert issubclass(NoIngestError, Exception)
    assert issubclass(NoBTUTResultError, Exception)
    assert issubclass(UnknownVerticalError, Exception)
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: FAIL (ModuleNotFoundError: app.services.data_layer)

**Step 3: Write minimal implementation**

```python
# backend/app/services/data_layer/__init__.py
"""Latent Ocean Data Layer — unified spine over ingest → BTUT → manifold → verticals."""
from __future__ import annotations
```

```python
# backend/app/services/data_layer/errors.py
"""Exceptions raised by LatentOceanDataLayer. Fail-fast, no silent fallbacks."""
from __future__ import annotations


class DataLayerError(Exception):
    """Base class for data layer exceptions."""


class UnknownSourceError(DataLayerError):
    """ingest() received a source id not registered with btut.adapters."""


class NoIngestError(DataLayerError):
    """apply_btut_tuner() called before ingest()."""


class NoBTUTResultError(DataLayerError):
    """project_to_manifold() or get_survivors() called before apply_btut_tuner()."""


class NoManifoldError(DataLayerError):
    """export_for_vertical() / link_causally() called before project_to_manifold()."""


class UnknownVerticalError(DataLayerError):
    """export_for_vertical() received an unknown vertical name."""
```

```python
# backend/app/services/data_layer/types.py
"""Dataclasses passed between stages of the data layer pipeline."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

import numpy as np


@dataclass
class IngestResult:
    source_id: str
    entities: list[dict]
    edges: list[dict]
    unique_types: list[str]
    fetch_seconds: float


@dataclass
class BTUTRunResult:
    summary: dict
    survivors: list[dict]            # raw survivors from run_btut_pipeline
    embeddings_8d: np.ndarray        # (n_survivors, 8) — unnormalized
    wall_seconds: float


@dataclass
class ManifoldCoords:
    coords_8d_unit: np.ndarray                # (n, 8), L2-normalized
    coords_3d_s2: np.ndarray | None           # (n, 3), unit sphere, or None
    projection_method: str                    # "l2_normalize_8d+pca_s2" etc.


@dataclass
class Survivor:
    entity: dict
    cluster: int
    scores: dict
    fingerprint: str
    coord_8d: list[float]
    coord_3d: list[float] | None


@dataclass
class QualityMetrics:
    n_input: int
    n_survivors: int
    reduction_ratio: int
    variance_preservation: float
    wall_seconds: float
    estimated_cost_usd: float


@dataclass
class CausalLink:
    source_a: str
    source_b: str
    signal: Literal["foreign_key", "semantic_field", "url_hierarchy", "cosine"]
    strength: float
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 2 passed

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/ backend/tests/
git commit -m "data_layer: scaffold package with types and errors"
```

---

## Task 2: Manifold projection module

**Files:**
- Create: `backend/app/services/data_layer/manifold.py`
- Modify: `backend/tests/services/test_data_layer.py` (append)

**Step 1: Write the failing tests**

Append to `test_data_layer.py`:

```python
from app.services.data_layer.manifold import (
    project_8d_to_unit_sphere,
    project_8d_to_s2,
)


def test_project_8d_to_unit_sphere_produces_unit_norms():
    rng = np.random.RandomState(0)
    pts = rng.randn(50, 8).astype(np.float32) * 10.0  # arbitrary scale
    unit = project_8d_to_unit_sphere(pts)
    norms = np.linalg.norm(unit, axis=1)
    assert unit.shape == (50, 8)
    assert np.allclose(norms, 1.0, atol=1e-5)


def test_project_8d_to_unit_sphere_handles_zero_row():
    pts = np.zeros((3, 8), dtype=np.float32)
    unit = project_8d_to_unit_sphere(pts)
    # Zero rows stay zero-ish (div by epsilon), no NaN/Inf.
    assert np.all(np.isfinite(unit))


def test_project_8d_to_s2_returns_unit_sphere_3d():
    rng = np.random.RandomState(1)
    pts = rng.randn(30, 8).astype(np.float32)
    unit_8 = project_8d_to_unit_sphere(pts)
    coords_3d = project_8d_to_s2(unit_8)
    assert coords_3d.shape == (30, 3)
    assert np.allclose(np.linalg.norm(coords_3d, axis=1), 1.0, atol=1e-5)


def test_project_8d_to_s2_is_deterministic_with_seed():
    rng = np.random.RandomState(2)
    pts = rng.randn(20, 8).astype(np.float32)
    a = project_8d_to_s2(pts, seed=42)
    b = project_8d_to_s2(pts, seed=42)
    assert np.allclose(a, b)


def test_project_8d_to_s2_degenerate_small_sample():
    # Fewer than 4 points → should not crash; returns zeros with warning.
    pts = np.array([[1.0] * 8, [2.0] * 8], dtype=np.float32)
    coords = project_8d_to_s2(pts)
    assert coords.shape == (2, 3)
    assert np.all(np.isfinite(coords))
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 5 new failures (ModuleNotFoundError on manifold)

**Step 3: Write minimal implementation**

```python
# backend/app/services/data_layer/manifold.py
"""Manifold projection: 8D unit hypersphere (compute) + 3D S² (display).

The 8D unit-sphere path is used for all downstream compute (cosine
linking, NIV manifold search, TCD-JEPA). The 3D S² path is display-only
and produced via PCA for best human-visible variance capture.
"""
from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger(__name__)


def project_8d_to_unit_sphere(emb_8d: np.ndarray) -> np.ndarray:
    """L2-normalize each row to the unit 7-sphere in R^8.

    Zero rows are left near zero (divided by epsilon) rather than
    NaN'd. Caller is responsible for filtering if that matters.
    """
    emb = np.asarray(emb_8d, dtype=np.float32)
    norms = np.linalg.norm(emb, axis=1, keepdims=True) + 1e-10
    return emb / norms


def project_8d_to_s2(emb_8d_unit: np.ndarray, seed: int = 42) -> np.ndarray:
    """PCA to 3D then L2-normalize. Display-only projection.

    For n < 4 points, PCA is degenerate — returns zeros and logs a
    warning. For n >= 4, deterministic given seed.
    """
    emb = np.asarray(emb_8d_unit, dtype=np.float32)
    n = emb.shape[0]
    if n < 4:
        logger.warning(
            "project_8d_to_s2: only %d points (<4), PCA degenerate, returning zeros", n
        )
        return np.zeros((n, 3), dtype=np.float32)

    from sklearn.decomposition import PCA  # local import: expensive
    pca = PCA(n_components=3, random_state=seed)
    coords_3d = pca.fit_transform(emb).astype(np.float32)
    norms = np.linalg.norm(coords_3d, axis=1, keepdims=True) + 1e-10
    return coords_3d / norms
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 7 passed total

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/manifold.py backend/tests/services/test_data_layer.py
git commit -m "data_layer: add manifold module (8D unit sphere + 3D S2 via PCA)"
```

---

## Task 3: Causal linking scaffold

**Files:**
- Create: `backend/app/services/data_layer/linking.py`
- Modify: `backend/tests/services/test_data_layer.py` (append)

**Step 1: Write the failing tests**

```python
from app.services.data_layer.linking import (
    link_by_cosine, link_by_foreign_key, link_by_semantic_field,
    link_by_url_hierarchy,
)


def test_link_by_cosine_identifies_identical_vectors():
    # Two survivors from A, two from B, where A[0]==B[0] and A[1]≠B[1].
    s_a = [{"entity": {"name": "a0"}}, {"entity": {"name": "a1"}}]
    s_b = [{"entity": {"name": "b0"}}, {"entity": {"name": "b1"}}]
    # Unit-norm vectors: a0 parallel to b0, a1 orthogonal to b1.
    e_a = np.array([[1, 0, 0, 0, 0, 0, 0, 0],
                    [0, 1, 0, 0, 0, 0, 0, 0]], dtype=np.float32)
    e_b = np.array([[1, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 1, 0, 0, 0, 0, 0]], dtype=np.float32)
    links = link_by_cosine(s_a, e_a, s_b, e_b, threshold=0.9)
    names = {(lk.source_a, lk.source_b) for lk in links}
    assert ("a0", "b0") in names
    assert ("a1", "b1") not in names
    for lk in links:
        assert lk.signal == "cosine"
        assert 0.0 <= lk.strength <= 1.0 + 1e-6


def test_link_stubs_return_empty():
    s_a = [{"entity": {"name": "x"}}]
    s_b = [{"entity": {"name": "y"}}]
    assert link_by_foreign_key(s_a, s_b) == []
    assert link_by_semantic_field(s_a, s_b) == []
    assert link_by_url_hierarchy(s_a, s_b) == []
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 2 new failures (ModuleNotFoundError on linking)

**Step 3: Write minimal implementation**

```python
# backend/app/services/data_layer/linking.py
"""Four-signal causal linker scaffold.

Cosine is fully wired. Foreign-key / semantic-field / URL-hierarchy are
stubs returning []. Stubs establish the interface for later expansion
without changing callers.
"""
from __future__ import annotations

import numpy as np

from .types import CausalLink


def link_by_cosine(
    survivors_a: list[dict],
    embeds_a_8d_unit: np.ndarray,
    survivors_b: list[dict],
    embeds_b_8d_unit: np.ndarray,
    threshold: float = 0.75,
) -> list[CausalLink]:
    """Cosine similarity on L2-normalized 8D coords.

    Since vectors are unit-norm, cosine == dot product, so we use a
    single matmul. O(n_a * n_b). For the typical 300-survivor case
    this is a 300x300 matrix — cheap.
    """
    a = np.asarray(embeds_a_8d_unit, dtype=np.float32)
    b = np.asarray(embeds_b_8d_unit, dtype=np.float32)
    if a.size == 0 or b.size == 0:
        return []
    sims = a @ b.T  # (n_a, n_b)
    hits = np.argwhere(sims >= threshold)
    return [
        CausalLink(
            source_a=survivors_a[i]["entity"]["name"],
            source_b=survivors_b[j]["entity"]["name"],
            signal="cosine",
            strength=float(sims[i, j]),
        )
        for i, j in hits
    ]


def link_by_foreign_key(
    survivors_a: list[dict], survivors_b: list[dict],
) -> list[CausalLink]:
    """STUB. Will compare attribute keys (cik, pmid, patent_id). Returns []."""
    return []


def link_by_semantic_field(
    survivors_a: list[dict], survivors_b: list[dict],
) -> list[CausalLink]:
    """STUB. Will match shared fields (author, company, year). Returns []."""
    return []


def link_by_url_hierarchy(
    survivors_a: list[dict], survivors_b: list[dict],
) -> list[CausalLink]:
    """STUB. Will compare URL path prefixes. Returns []."""
    return []


def link_all(
    survivors_a: list[dict],
    embeds_a_8d_unit: np.ndarray,
    survivors_b: list[dict],
    embeds_b_8d_unit: np.ndarray,
    cosine_threshold: float = 0.75,
) -> list[CausalLink]:
    """Run all four signals, concatenate results."""
    return [
        *link_by_cosine(survivors_a, embeds_a_8d_unit, survivors_b, embeds_b_8d_unit, cosine_threshold),
        *link_by_foreign_key(survivors_a, survivors_b),
        *link_by_semantic_field(survivors_a, survivors_b),
        *link_by_url_hierarchy(survivors_a, survivors_b),
    ]
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 9 passed total

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/linking.py backend/tests/services/test_data_layer.py
git commit -m "data_layer: add causal linking scaffold (cosine wired, 3 stubs)"
```

---

## Task 4: Vertical exporters

**Files:**
- Create: `backend/app/services/data_layer/verticals.py`
- Modify: `backend/tests/services/test_data_layer.py` (append)

**Step 1: Write the failing tests**

```python
from app.services.data_layer.verticals import EXPORTERS, export_niv, export_tcd_jepa, export_data


def _make_fake_state():
    """Build a minimal namespace-like object mimicking core state."""
    class FakeState:
        pass
    st = FakeState()
    st.ingest_result = IngestResult(
        source_id="edgar", entities=[], edges=[], unique_types=["company"], fetch_seconds=1.0,
    )
    st.btut_result = BTUTRunResult(
        summary={"reduction": 10}, survivors=[],
        embeddings_8d=np.zeros((2, 8), dtype=np.float32), wall_seconds=2.0,
    )
    st.manifold = ManifoldCoords(
        coords_8d_unit=np.ones((2, 8), dtype=np.float32) / np.sqrt(8),
        coords_3d_s2=np.ones((2, 3), dtype=np.float32) / np.sqrt(3),
        projection_method="l2_normalize_8d+pca_s2",
    )
    st.survivors = [
        Survivor(
            entity={"name": "AAPL", "type": "company"},
            cluster=0, scores={"composite": 0.9}, fingerprint="0101",
            coord_8d=[1.0] + [0.0] * 7, coord_3d=[1.0, 0.0, 0.0],
        ),
        Survivor(
            entity={"name": "MSFT", "type": "company"},
            cluster=1, scores={"composite": 0.8}, fingerprint="1010",
            coord_8d=[0.0, 1.0] + [0.0] * 6, coord_3d=[0.0, 1.0, 0.0],
        ),
    ]
    st.quality_metrics = QualityMetrics(
        n_input=20, n_survivors=2, reduction_ratio=10,
        variance_preservation=0.85, wall_seconds=3.0, estimated_cost_usd=0.05,
    )
    return st


def test_export_niv_has_expected_keys():
    payload = export_niv(_make_fake_state())
    assert payload["vertical"] == "niv"
    assert payload["dataset_id"] == "edgar"
    assert payload["n_survivors"] == 2
    assert len(payload["survivors"]) == 2
    assert "quality" in payload
    assert "coord_8d" in payload["survivors"][0]


def test_export_tcd_jepa_is_matrix_shaped():
    payload = export_tcd_jepa(_make_fake_state())
    assert payload["vertical"] == "tcd_jepa"
    assert len(payload["embeddings_8d"]) == 2
    assert len(payload["embeddings_8d"][0]) == 8
    assert payload["entity_ids"] == ["AAPL", "MSFT"]
    assert payload["entity_types"] == ["company", "company"]


def test_export_data_contains_everything():
    payload = export_data(_make_fake_state())
    assert payload["vertical"] == "data"
    assert "ingest" in payload
    assert "btut_summary" in payload
    assert "manifold" in payload
    assert "coords_8d_unit" in payload["manifold"]
    assert "coords_3d_s2" in payload["manifold"]


def test_exporters_registry_has_three():
    assert set(EXPORTERS.keys()) == {"niv", "tcd_jepa", "data"}
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 4 new failures (ModuleNotFoundError on verticals)

**Step 3: Write minimal implementation**

```python
# backend/app/services/data_layer/verticals.py
"""Vertical export contracts for NIV, TCD-JEPA, and the Data vertical.

Each exporter takes a state object with the fields populated by the
facade after running ingest → btut → manifold, and returns a dict in
the handoff shape the vertical expects.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any, Callable

import numpy as np


def export_niv(state: Any) -> dict:
    """NIV (finance) vertical.

    Wants: survivors with full attributes + 8D coords + scores.
    Does NOT need 3D viz coords or full raw ingest.
    """
    return {
        "vertical": "niv",
        "dataset_id": state.ingest_result.source_id,
        "n_survivors": len(state.survivors),
        "survivors": [
            {
                "entity": s.entity,
                "coord_8d": s.coord_8d,
                "scores": s.scores,
                "cluster": s.cluster,
            }
            for s in state.survivors
        ],
        "quality": asdict(state.quality_metrics),
    }


def export_tcd_jepa(state: Any) -> dict:
    """TCD-JEPA (AI) vertical.

    Wants: flat embedding matrix + entity ids + type labels + clusters,
    optimized for batched training. Drops per-entity attributes.
    """
    if state.survivors:
        matrix = np.vstack([np.asarray(s.coord_8d, dtype=np.float32) for s in state.survivors])
    else:
        matrix = np.zeros((0, 8), dtype=np.float32)
    return {
        "vertical": "tcd_jepa",
        "dataset_id": state.ingest_result.source_id,
        "embeddings_8d": matrix.tolist(),
        "entity_ids": [s.entity.get("name", "") for s in state.survivors],
        "entity_types": [s.entity.get("type", "") for s in state.survivors],
        "clusters": [s.cluster for s in state.survivors],
    }


def export_data(state: Any) -> dict:
    """Data vertical (sell-through / audit).

    Wants: everything. Full ingest result, full BTUT summary, full
    survivors, both manifold coordinate systems, quality metrics.
    """
    return {
        "vertical": "data",
        "dataset_id": state.ingest_result.source_id,
        "ingest": asdict(state.ingest_result),
        "btut_summary": state.btut_result.summary,
        "survivors": [asdict(s) for s in state.survivors],
        "manifold": {
            "coords_8d_unit": state.manifold.coords_8d_unit.tolist(),
            "coords_3d_s2": (
                state.manifold.coords_3d_s2.tolist()
                if state.manifold.coords_3d_s2 is not None
                else None
            ),
            "projection_method": state.manifold.projection_method,
        },
        "quality": asdict(state.quality_metrics),
    }


EXPORTERS: dict[str, Callable[[Any], dict]] = {
    "niv": export_niv,
    "tcd_jepa": export_tcd_jepa,
    "data": export_data,
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 13 passed total

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/verticals.py backend/tests/services/test_data_layer.py
git commit -m "data_layer: add vertical exporters (niv, tcd_jepa, data)"
```

---

## Task 5: Core facade skeleton + ingest()

**Files:**
- Create: `backend/app/services/data_layer/core.py`
- Modify: `backend/app/services/data_layer/__init__.py` (export class)
- Modify: `backend/tests/services/test_data_layer.py` (append)

**Step 1: Write the failing tests**

```python
from unittest.mock import MagicMock, patch

from app.services.data_layer import LatentOceanDataLayer
from app.services.data_layer.errors import UnknownSourceError, NoIngestError


def _fake_adapter(entities=None, edges=None):
    adapter = MagicMock()
    adapter.fetch_entities.return_value = entities or [
        {"name": "AAPL", "type": "company", "attributes": {"ticker": "AAPL"}},
        {"name": "MSFT", "type": "company", "attributes": {"ticker": "MSFT"}},
    ]
    adapter.fetch_edges.return_value = edges or []
    return adapter


def test_facade_initial_state_is_empty():
    layer = LatentOceanDataLayer()
    assert layer.ingest_result is None
    assert layer.btut_result is None


def test_ingest_with_adapter_instance_populates_state():
    layer = LatentOceanDataLayer()
    adapter = _fake_adapter()
    result = layer.ingest(adapter)
    assert result.source_id  # non-empty (from get_meta)
    assert len(result.entities) == 2
    assert layer.ingest_result is result  # state stored


def test_ingest_with_string_source_uses_adapter_registry():
    layer = LatentOceanDataLayer()
    adapter = _fake_adapter()
    adapter.get_meta.return_value = MagicMock(dataset_id="fake")
    with patch("app.services.data_layer.core.get_adapter", return_value=adapter) as m:
        result = layer.ingest("fake", limit=50)
        m.assert_called_once_with("fake")
        adapter.fetch_entities.assert_called_once_with(limit=50)
    assert result.source_id == "fake"


def test_ingest_with_unknown_source_raises_unknown_source():
    layer = LatentOceanDataLayer()
    with patch(
        "app.services.data_layer.core.get_adapter",
        side_effect=ValueError("Unknown dataset 'nope'."),
    ):
        with pytest.raises(UnknownSourceError):
            layer.ingest("nope")


def test_apply_btut_before_ingest_raises():
    layer = LatentOceanDataLayer()
    with pytest.raises(NoIngestError):
        layer.apply_btut_tuner()
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 5 new failures (ImportError on LatentOceanDataLayer)

**Step 3: Write minimal implementation**

```python
# backend/app/services/data_layer/core.py
"""LatentOceanDataLayer — thin stateful facade over ingest → BTUT → manifold → export."""
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Callable, Literal

import numpy as np

from app.services.btut.adapters import get_adapter
from app.services.btut.adapters.base import BaseDatasetAdapter

from .errors import (
    NoIngestError,
    NoBTUTResultError,
    NoManifoldError,
    UnknownSourceError,
    UnknownVerticalError,
)
from .types import (
    BTUTRunResult,
    CausalLink,
    IngestResult,
    ManifoldCoords,
    QualityMetrics,
    Survivor,
)

logger = logging.getLogger(__name__)


class LatentOceanDataLayer:
    """Unified spine over ingestion → BTUT → manifold → vertical export.

    Thin facade: owns no business logic. Routes calls to existing
    ``btut.pipeline.run_btut_pipeline`` and ``btut.adapters.get_adapter``.
    Stateful — later methods reuse earlier results unless overridden.
    """

    def __init__(
        self,
        budget_dollars: float = 50.0,
        target_survivors: int = 300,
        compute_3d_display: bool = True,
        log_callback: Callable[[str], None] | None = None,
    ) -> None:
        self.budget_dollars = budget_dollars
        self.target_survivors = target_survivors
        self.compute_3d_display = compute_3d_display
        self._log_cb = log_callback

        # Per-run state, reset on each ingest()
        self.ingest_result: IngestResult | None = None
        self.btut_result: BTUTRunResult | None = None
        self.manifold: ManifoldCoords | None = None
        self.survivors: list[Survivor] | None = None
        self.quality_metrics: QualityMetrics | None = None

    # ──────────────────────────────────────────────────────────────────
    def _log(self, msg: str) -> None:
        logger.info(msg)
        if self._log_cb is not None:
            self._log_cb(msg)

    def _reset_state(self) -> None:
        """Called at the start of each ingest() to clear prior run state."""
        self.ingest_result = None
        self.btut_result = None
        self.manifold = None
        self.survivors = None
        self.quality_metrics = None

    # ── Stage 1: ingest ───────────────────────────────────────────────
    def ingest(
        self,
        source: str | BaseDatasetAdapter,
        limit: int = 10_000,
    ) -> IngestResult:
        """Fetch entities + edges from a dataset adapter.

        Args:
            source: Dataset id (e.g. ``"edgar"``) or a BaseDatasetAdapter instance.
            limit: Max entities to fetch (passed to adapter.fetch_entities).
        """
        self._reset_state()
        wall_start = time.time()

        if isinstance(source, str):
            try:
                adapter = get_adapter(source)
            except ValueError as e:
                raise UnknownSourceError(str(e)) from e
        else:
            adapter = source

        meta = adapter.get_meta()
        entities = adapter.fetch_entities(limit=limit)
        edges = adapter.fetch_edges(entities)

        # Derive unique_types — mirror run_btut_pipeline's auto-detection.
        unique_types = sorted({e.get("type", "unknown") for e in entities})

        fetch_seconds = time.time() - wall_start
        result = IngestResult(
            source_id=meta.dataset_id,
            entities=entities,
            edges=edges,
            unique_types=unique_types,
            fetch_seconds=fetch_seconds,
        )
        self.ingest_result = result
        self._log(
            f"[data_layer] stage=ingest source={meta.dataset_id} "
            f"n_entities={len(entities)} n_edges={len(edges)} wall={fetch_seconds:.1f}s"
        )
        return result

    # ── Stage 2: BTUT (stub — filled in Task 6) ───────────────────────
    def apply_btut_tuner(
        self,
        ingest_result: IngestResult | None = None,
    ) -> BTUTRunResult:
        ir = ingest_result or self.ingest_result
        if ir is None:
            raise NoIngestError("apply_btut_tuner() called before ingest()")
        raise NotImplementedError("Filled in Task 6")
```

And export the class:

```python
# backend/app/services/data_layer/__init__.py
"""Latent Ocean Data Layer — unified spine over ingest → BTUT → manifold → verticals."""
from __future__ import annotations

from .core import LatentOceanDataLayer

__all__ = ["LatentOceanDataLayer"]
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 18 passed total

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/core.py backend/app/services/data_layer/__init__.py backend/tests/services/test_data_layer.py
git commit -m "data_layer: add facade skeleton with ingest() and adapter registry wiring"
```

---

## Task 6: apply_btut_tuner() wrapping run_btut_pipeline

**Files:**
- Modify: `backend/app/services/data_layer/core.py`
- Modify: `backend/tests/services/test_data_layer.py` (append)

**Step 1: Write the failing tests**

```python
def test_apply_btut_calls_run_pipeline_and_stores_result():
    layer = LatentOceanDataLayer(target_survivors=50, budget_dollars=10.0)
    adapter = _fake_adapter()
    adapter.get_meta.return_value = MagicMock(dataset_id="fake")
    with patch("app.services.data_layer.core.get_adapter", return_value=adapter):
        layer.ingest("fake", limit=50)

    # Fake BTUT output matching run_btut_pipeline's return shape.
    fake_pipeline_return = {
        "summary": {
            "total_entities": 2,
            "survivors": 2,
            "reduction": 1,
            "wall_seconds": 0.5,
            "reconstruction": {"variance_preservation": 0.99},
        },
        "survivors": [
            {
                "entity": {"name": "AAPL", "type": "company", "attributes": {}},
                "cluster": 0, "fingerprint_48bit": "000", "flips": 0,
                "scores": {"diversity": 0.1, "reconstruction": 0.2, "anomaly": 0.3, "composite": 0.2},
            },
            {
                "entity": {"name": "MSFT", "type": "company", "attributes": {}},
                "cluster": 1, "fingerprint_48bit": "111", "flips": 3,
                "scores": {"diversity": 0.4, "reconstruction": 0.5, "anomaly": 0.6, "composite": 0.5},
            },
        ],
        "embeddings_8d": [1.0] * 16,  # 2 survivors * 8 dims, flattened
        "embed_context": {},
    }
    with patch(
        "app.services.data_layer.core.run_btut_pipeline",
        return_value=fake_pipeline_return,
    ) as m:
        result = layer.apply_btut_tuner()
        m.assert_called_once()
        # Verify BTUT got the right args
        call_kwargs = m.call_args.kwargs
        assert call_kwargs["target_survivors"] == 50
        assert call_kwargs["budget_dollars"] == 10.0

    assert layer.btut_result is result
    assert result.summary["survivors"] == 2
    assert result.embeddings_8d.shape == (2, 8)
    assert len(result.survivors) == 2
```

**Step 2: Run the new test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py::test_apply_btut_calls_run_pipeline_and_stores_result -v`
Expected: FAIL (NotImplementedError from Task 5 stub)

**Step 3: Implement apply_btut_tuner**

Replace the NotImplementedError stub in `core.py`:

```python
# At top of file, add:
from app.services.btut.pipeline import run_btut_pipeline


# Replace the stub method:
    def apply_btut_tuner(
        self,
        ingest_result: IngestResult | None = None,
    ) -> BTUTRunResult:
        """Run the full BTUT pipeline on the most recent (or given) ingest.

        Wraps ``btut.pipeline.run_btut_pipeline`` and stores the typed
        result on self for downstream stages.
        """
        ir = ingest_result or self.ingest_result
        if ir is None:
            raise NoIngestError("apply_btut_tuner() called before ingest()")

        wall_start = time.time()
        raw = run_btut_pipeline(
            entities=ir.entities,
            edges=ir.edges,
            unique_types=ir.unique_types,
            target_survivors=self.target_survivors,
            budget_dollars=self.budget_dollars,
            progress_callback=self._log_cb,
        )
        wall = time.time() - wall_start

        # Reshape the flat embeddings_8d back to (n, 8).
        flat = raw.get("embeddings_8d") or []
        n_surv = len(raw.get("survivors", []))
        if n_surv > 0 and len(flat) == n_surv * 8:
            embeddings_8d = np.asarray(flat, dtype=np.float32).reshape(n_surv, 8)
        else:
            embeddings_8d = np.zeros((n_surv, 8), dtype=np.float32)

        result = BTUTRunResult(
            summary=raw.get("summary", {}),
            survivors=raw.get("survivors", []),
            embeddings_8d=embeddings_8d,
            wall_seconds=wall,
        )
        self.btut_result = result
        summary = result.summary
        self._log(
            f"[data_layer] stage=btut n_survivors={n_surv} "
            f"reduction={summary.get('reduction', '?')}x wall={wall:.1f}s "
            f"variance={summary.get('reconstruction', {}).get('variance_preservation', '?')}"
        )
        return result
```

**Step 4: Run all tests**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 19 passed total

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/core.py backend/tests/services/test_data_layer.py
git commit -m "data_layer: wire apply_btut_tuner() to run_btut_pipeline"
```

---

## Task 7: project_to_manifold, get_survivors, get_quality_metrics

**Files:**
- Modify: `backend/app/services/data_layer/core.py`
- Modify: `backend/tests/services/test_data_layer.py` (append)

**Step 1: Write the failing tests**

```python
def _prime_layer_through_btut(layer):
    """Helper: ingest + apply_btut with mocks so downstream methods have state."""
    adapter = _fake_adapter()
    adapter.get_meta.return_value = MagicMock(dataset_id="fake")
    with patch("app.services.data_layer.core.get_adapter", return_value=adapter):
        layer.ingest("fake", limit=50)

    fake_pipeline_return = {
        "summary": {
            "total_entities": 2, "survivors": 2, "reduction": 1,
            "wall_seconds": 0.1,
            "reconstruction": {"variance_preservation": 0.95},
        },
        "survivors": [
            {"entity": {"name": "AAPL", "type": "company", "attributes": {}},
             "cluster": 0, "fingerprint_48bit": "000", "flips": 0,
             "scores": {"composite": 0.5}},
            {"entity": {"name": "MSFT", "type": "company", "attributes": {}},
             "cluster": 1, "fingerprint_48bit": "111", "flips": 3,
             "scores": {"composite": 0.7}},
        ],
        "embeddings_8d": [1.0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0],
    }
    with patch("app.services.data_layer.core.run_btut_pipeline", return_value=fake_pipeline_return):
        layer.apply_btut_tuner()


def test_project_to_manifold_produces_8d_and_3d_coords():
    layer = LatentOceanDataLayer(compute_3d_display=True)
    _prime_layer_through_btut(layer)
    coords = layer.project_to_manifold()
    assert coords.coords_8d_unit.shape == (2, 8)
    assert np.allclose(np.linalg.norm(coords.coords_8d_unit, axis=1), 1.0, atol=1e-5)
    # Only 2 points → PCA degenerate → zeros returned
    assert coords.coords_3d_s2 is not None
    assert coords.coords_3d_s2.shape == (2, 3)


def test_project_to_manifold_skips_3d_when_disabled():
    layer = LatentOceanDataLayer(compute_3d_display=False)
    _prime_layer_through_btut(layer)
    coords = layer.project_to_manifold()
    assert coords.coords_3d_s2 is None


def test_project_to_manifold_before_btut_raises():
    layer = LatentOceanDataLayer()
    with pytest.raises(NoBTUTResultError):
        layer.project_to_manifold()


def test_get_survivors_returns_typed_survivors_with_coords():
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    survs = layer.get_survivors()
    assert len(survs) == 2
    assert survs[0].entity["name"] == "AAPL"
    assert len(survs[0].coord_8d) == 8
    assert survs[0].coord_3d is not None and len(survs[0].coord_3d) == 3


def test_get_quality_metrics_populates_fields():
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    q = layer.get_quality_metrics()
    assert q.n_survivors == 2
    assert q.reduction_ratio == 1
    assert q.variance_preservation == 0.95
```

**Step 2: Run the new tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 5 new failures (AttributeError on project_to_manifold / get_survivors / get_quality_metrics)

**Step 3: Implement the three methods**

Add to `core.py`:

```python
# Add these imports near the top:
from .manifold import project_8d_to_s2, project_8d_to_unit_sphere


# Add these methods on the class:
    def project_to_manifold(
        self,
        btut_result: BTUTRunResult | None = None,
    ) -> ManifoldCoords:
        """L2-normalize survivor 8D embeddings; optionally compute 3D S².

        Populates ``self.manifold`` and backfills ``self.survivors``
        with manifold coords attached.
        """
        br = btut_result or self.btut_result
        if br is None:
            raise NoBTUTResultError(
                "project_to_manifold() called before apply_btut_tuner()"
            )

        wall_start = time.time()
        coords_8d_unit = project_8d_to_unit_sphere(br.embeddings_8d)
        coords_3d_s2 = (
            project_8d_to_s2(coords_8d_unit) if self.compute_3d_display else None
        )
        method = "l2_normalize_8d" + ("+pca_s2" if coords_3d_s2 is not None else "")
        manifold = ManifoldCoords(
            coords_8d_unit=coords_8d_unit,
            coords_3d_s2=coords_3d_s2,
            projection_method=method,
        )
        self.manifold = manifold
        self._hydrate_survivors()
        self._compute_quality_metrics()
        wall = time.time() - wall_start
        self._log(
            f"[data_layer] stage=manifold coords_8d={coords_8d_unit.shape} "
            f"coords_3d={None if coords_3d_s2 is None else coords_3d_s2.shape} "
            f"wall={wall:.1f}s"
        )
        return manifold

    def _hydrate_survivors(self) -> None:
        """Build typed Survivor objects from btut_result + manifold coords."""
        assert self.btut_result is not None
        assert self.manifold is not None
        out: list[Survivor] = []
        for i, s in enumerate(self.btut_result.survivors):
            out.append(
                Survivor(
                    entity=s["entity"],
                    cluster=int(s.get("cluster", 0)),
                    scores=s.get("scores", {}),
                    fingerprint=s.get("fingerprint_48bit", ""),
                    coord_8d=self.manifold.coords_8d_unit[i].tolist(),
                    coord_3d=(
                        self.manifold.coords_3d_s2[i].tolist()
                        if self.manifold.coords_3d_s2 is not None else None
                    ),
                )
            )
        self.survivors = out

    def _compute_quality_metrics(self) -> None:
        """Compute QualityMetrics from btut_result + ingest_result."""
        assert self.btut_result is not None
        assert self.ingest_result is not None
        summary = self.btut_result.summary
        n_input = int(summary.get("total_entities", len(self.ingest_result.entities)))
        n_surv = int(summary.get("survivors", 0))
        self.quality_metrics = QualityMetrics(
            n_input=n_input,
            n_survivors=n_surv,
            reduction_ratio=int(summary.get("reduction", max(n_input // max(n_surv, 1), 1))),
            variance_preservation=float(
                summary.get("reconstruction", {}).get("variance_preservation", 0.0)
            ),
            wall_seconds=float(summary.get("wall_seconds", self.btut_result.wall_seconds)),
            # Cost model: flat overhead + per-entity marginal. Conservative.
            estimated_cost_usd=round(0.01 + n_input * 1e-6, 4),
        )

    def get_survivors(self) -> list[Survivor]:
        if self.survivors is None:
            raise NoManifoldError(
                "get_survivors() called before project_to_manifold()"
            )
        return self.survivors

    def get_quality_metrics(self) -> QualityMetrics:
        if self.quality_metrics is None:
            raise NoManifoldError(
                "get_quality_metrics() called before project_to_manifold()"
            )
        return self.quality_metrics
```

**Step 4: Run all tests**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 24 passed total

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/core.py backend/tests/services/test_data_layer.py
git commit -m "data_layer: add project_to_manifold, survivors, quality metrics"
```

---

## Task 8: export_for_vertical with optional disk write

**Files:**
- Modify: `backend/app/services/data_layer/core.py`
- Modify: `backend/tests/services/test_data_layer.py` (append)

**Step 1: Write the failing tests**

```python
import json as _json


def test_export_for_vertical_returns_dict():
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    payload = layer.export_for_vertical("niv")
    assert payload["vertical"] == "niv"
    assert payload["n_survivors"] == 2


def test_export_for_vertical_writes_file_when_path_given(tmp_path):
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    out = tmp_path / "niv.json"
    payload = layer.export_for_vertical("niv", write_path=out)
    assert out.exists()
    loaded = _json.loads(out.read_text())
    assert loaded["vertical"] == "niv"
    assert loaded == payload


def test_export_for_vertical_unknown_raises():
    layer = LatentOceanDataLayer()
    _prime_layer_through_btut(layer)
    layer.project_to_manifold()
    with pytest.raises(UnknownVerticalError):
        layer.export_for_vertical("bogus")


def test_export_for_vertical_before_manifold_raises():
    layer = LatentOceanDataLayer()
    with pytest.raises(NoManifoldError):
        layer.export_for_vertical("niv")
```

**Step 2: Run the new tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 4 new failures

**Step 3: Implement the method**

Add to `core.py`:

```python
# Add imports:
import json
from .verticals import EXPORTERS


# Add method on the class:
    def export_for_vertical(
        self,
        vertical_name: Literal["niv", "tcd_jepa", "data"] | str,
        write_path: Path | None = None,
    ) -> dict:
        """Format current state into the handoff contract for a vertical.

        Args:
            vertical_name: One of ``"niv"``, ``"tcd_jepa"``, ``"data"``.
            write_path: Optional path — if given, the dict is also written
                as JSON (UTF-8, indent=2) to that path. Parent dirs created.

        Returns:
            The payload dict.
        """
        if self.manifold is None or self.survivors is None:
            raise NoManifoldError(
                "export_for_vertical() called before project_to_manifold()"
            )
        if vertical_name not in EXPORTERS:
            raise UnknownVerticalError(
                f"Unknown vertical '{vertical_name}'. "
                f"Available: {sorted(EXPORTERS.keys())}"
            )
        payload = EXPORTERS[vertical_name](self)

        if write_path is not None:
            p = Path(write_path)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
            size = p.stat().st_size
            self._log(
                f"[data_layer] stage=export vertical={vertical_name} "
                f"bytes={size} path={p}"
            )
        else:
            self._log(f"[data_layer] stage=export vertical={vertical_name} (in-memory)")

        return payload
```

**Step 4: Run all tests**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 28 passed total

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/core.py backend/tests/services/test_data_layer.py
git commit -m "data_layer: add export_for_vertical with optional disk write"
```

---

## Task 9: link_causally cross-layer method

**Files:**
- Modify: `backend/app/services/data_layer/core.py`
- Modify: `backend/tests/services/test_data_layer.py` (append)

**Step 1: Write the failing test**

```python
def test_link_causally_between_two_layers():
    # Layer A with one survivor at [1,0,0,0,0,0,0,0]
    layer_a = LatentOceanDataLayer(compute_3d_display=False)
    _prime_layer_through_btut(layer_a)
    layer_a.project_to_manifold()

    # Layer B — reuse the same prime (also [1,0,…] and [0,1,…]).
    layer_b = LatentOceanDataLayer(compute_3d_display=False)
    _prime_layer_through_btut(layer_b)
    layer_b.project_to_manifold()

    links = layer_a.link_causally(layer_b, threshold=0.9)
    # At least the identical-vector pairs should link.
    assert len(links) >= 2
    assert all(lk.signal in {"cosine", "foreign_key", "semantic_field", "url_hierarchy"} for lk in links)


def test_link_causally_before_manifold_raises():
    layer_a = LatentOceanDataLayer()
    layer_b = LatentOceanDataLayer()
    with pytest.raises(NoManifoldError):
        layer_a.link_causally(layer_b)
```

**Step 2: Run the new tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 2 new failures

**Step 3: Implement the method**

Add import and method in `core.py`:

```python
# Add import:
from .linking import link_all


# Add method on the class:
    def link_causally(
        self,
        other: "LatentOceanDataLayer",
        threshold: float = 0.75,
    ) -> list[CausalLink]:
        """Link survivors across two data layers via four-signal scaffold.

        Only cosine is fully wired; foreign-key / semantic-field /
        url-hierarchy are stubs. Requires both layers to have completed
        project_to_manifold().
        """
        if self.manifold is None or self.survivors is None:
            raise NoManifoldError(
                "link_causally() on self before project_to_manifold()"
            )
        if other.manifold is None or other.survivors is None:
            raise NoManifoldError(
                "link_causally() on other before other.project_to_manifold()"
            )
        raw_a = self.btut_result.survivors  # type: ignore[union-attr]
        raw_b = other.btut_result.survivors  # type: ignore[union-attr]
        return link_all(
            survivors_a=raw_a,
            embeds_a_8d_unit=self.manifold.coords_8d_unit,
            survivors_b=raw_b,
            embeds_b_8d_unit=other.manifold.coords_8d_unit,
            cosine_threshold=threshold,
        )
```

**Step 4: Run all tests**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 30 passed total

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/core.py backend/tests/services/test_data_layer.py
git commit -m "data_layer: add link_causally cross-layer method"
```

---

## Task 10: run() one-shot + double-ingest regression

**Files:**
- Modify: `backend/app/services/data_layer/core.py`
- Modify: `backend/tests/services/test_data_layer.py` (append)

**Step 1: Write the failing tests**

```python
def test_run_one_shot_full_pipeline():
    layer = LatentOceanDataLayer(target_survivors=50)
    adapter = _fake_adapter()
    adapter.get_meta.return_value = MagicMock(dataset_id="fake")
    fake_pipeline_return = {
        "summary": {
            "total_entities": 2, "survivors": 2, "reduction": 1,
            "wall_seconds": 0.1,
            "reconstruction": {"variance_preservation": 0.9},
        },
        "survivors": [
            {"entity": {"name": "AAPL", "type": "company", "attributes": {}},
             "cluster": 0, "fingerprint_48bit": "0", "flips": 0,
             "scores": {"composite": 0.5}},
            {"entity": {"name": "MSFT", "type": "company", "attributes": {}},
             "cluster": 1, "fingerprint_48bit": "1", "flips": 1,
             "scores": {"composite": 0.7}},
        ],
        "embeddings_8d": [1.0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0],
    }
    with patch("app.services.data_layer.core.get_adapter", return_value=adapter), \
         patch("app.services.data_layer.core.run_btut_pipeline", return_value=fake_pipeline_return):
        payload = layer.run("fake", vertical="niv", limit=50)
    assert payload["vertical"] == "niv"
    assert payload["n_survivors"] == 2
    assert layer.manifold is not None
    assert layer.quality_metrics is not None


def test_run_without_vertical_returns_quality_dict():
    layer = LatentOceanDataLayer()
    adapter = _fake_adapter()
    adapter.get_meta.return_value = MagicMock(dataset_id="fake")
    fake = {
        "summary": {"total_entities": 2, "survivors": 2, "reduction": 1,
                    "wall_seconds": 0.1,
                    "reconstruction": {"variance_preservation": 0.9}},
        "survivors": [
            {"entity": {"name": "x", "type": "t"}, "cluster": 0,
             "fingerprint_48bit": "", "flips": 0, "scores": {}},
            {"entity": {"name": "y", "type": "t"}, "cluster": 1,
             "fingerprint_48bit": "", "flips": 0, "scores": {}},
        ],
        "embeddings_8d": [1.0] + [0] * 7 + [0, 1.0] + [0] * 6,
    }
    with patch("app.services.data_layer.core.get_adapter", return_value=adapter), \
         patch("app.services.data_layer.core.run_btut_pipeline", return_value=fake):
        result = layer.run("fake", limit=50)
    # No vertical -> returns summary dict with quality
    assert "n_survivors" in result
    assert result["n_survivors"] == 2


def test_double_ingest_resets_state_cleanly():
    layer = LatentOceanDataLayer()
    adapter = _fake_adapter()
    adapter.get_meta.return_value = MagicMock(dataset_id="fake")
    with patch("app.services.data_layer.core.get_adapter", return_value=adapter):
        layer.ingest("fake", limit=10)
        # Simulate some downstream state that must be wiped.
        layer.btut_result = "stale"
        layer.manifold = "stale"
        layer.survivors = ["stale"]
        layer.quality_metrics = "stale"
        layer.ingest("fake", limit=10)  # second ingest
    assert layer.btut_result is None
    assert layer.manifold is None
    assert layer.survivors is None
    assert layer.quality_metrics is None
```

**Step 2: Run the new tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 3 new failures (AttributeError on run)

**Step 3: Implement run()**

Add method on the class:

```python
    def run(
        self,
        source: str | BaseDatasetAdapter,
        vertical: str | None = None,
        limit: int = 10_000,
        write_path: Path | None = None,
    ) -> dict:
        """One-shot: ingest → btut → manifold → (optional) export.

        If ``vertical`` is given, returns the vertical's payload dict
        (and optionally writes it to ``write_path``). Otherwise returns
        a small summary dict with quality metrics and counts.
        """
        self.ingest(source, limit=limit)
        self.apply_btut_tuner()
        self.project_to_manifold()

        if vertical is not None:
            return self.export_for_vertical(vertical, write_path=write_path)

        assert self.quality_metrics is not None  # set by project_to_manifold
        return {
            "dataset_id": self.ingest_result.source_id,  # type: ignore[union-attr]
            "n_input": self.quality_metrics.n_input,
            "n_survivors": self.quality_metrics.n_survivors,
            "reduction_ratio": self.quality_metrics.reduction_ratio,
            "variance_preservation": self.quality_metrics.variance_preservation,
            "wall_seconds": self.quality_metrics.wall_seconds,
        }
```

**Step 4: Run all tests**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v`
Expected: 33 passed total

**Step 5: Commit**

```bash
git add backend/app/services/data_layer/core.py backend/tests/services/test_data_layer.py
git commit -m "data_layer: add run() one-shot and double-ingest state reset"
```

---

## Task 11: EDGAR end-to-end demo script

**Files:**
- Create: `scripts/demo_data_layer_edgar.py`

This task is **not** TDD because it exercises real EDGAR HTTP calls. It's a smoke test the user runs manually. Success criterion is that the script completes without error and writes three JSON files.

**Step 1: Write the demo script**

```python
#!/usr/bin/env python
"""End-to-end demo: LatentOceanDataLayer running on real SEC EDGAR data.

Exercises the full facade: ingest → BTUT → manifold → export to all
three verticals. Uses a small limit so it finishes in a few minutes
and doesn't hit EDGAR rate limits hard.

Run:
    cd backend && python ../scripts/demo_data_layer_edgar.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Allow running from repo root: add backend/ to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.data_layer import LatentOceanDataLayer  # noqa: E402


def main() -> int:
    out_root = REPO_ROOT / "scripts" / "exports"
    out_root.mkdir(parents=True, exist_ok=True)
    date_tag = time.strftime("%Y%m%d")

    print(f"[demo] Starting LatentOceanDataLayer EDGAR demo")
    print(f"[demo] Output root: {out_root}")

    def _log(msg: str) -> None:
        print(msg, flush=True)

    layer = LatentOceanDataLayer(
        budget_dollars=5.0,
        target_survivors=100,
        compute_3d_display=True,
        log_callback=_log,
    )

    # Small limit so demo finishes fast and stays polite to EDGAR.
    layer.ingest("edgar", limit=500)
    layer.apply_btut_tuner()
    layer.project_to_manifold()

    for vertical in ("niv", "tcd_jepa", "data"):
        path = out_root / vertical / f"edgar_{date_tag}.json"
        layer.export_for_vertical(vertical, write_path=path)

    q = layer.get_quality_metrics()
    print("\n[demo] ─── Quality Metrics ─────────────────────")
    print(f"  n_input               : {q.n_input}")
    print(f"  n_survivors           : {q.n_survivors}")
    print(f"  reduction_ratio       : {q.reduction_ratio}x")
    print(f"  variance_preservation : {q.variance_preservation:.3f}")
    print(f"  wall_seconds          : {q.wall_seconds:.1f}")
    print(f"  estimated_cost_usd    : ${q.estimated_cost_usd:.4f}")
    print("[demo] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Step 2: Verify imports resolve**

Run: `cd backend && python -c "from app.services.data_layer import LatentOceanDataLayer; print('ok')"`
Expected: `ok`

**Step 3: Dry-run the demo (small limit)**

Run: `cd backend && python ../scripts/demo_data_layer_edgar.py`
Expected: runs without errors, prints quality metrics, creates three JSON files under `scripts/exports/{niv,tcd_jepa,data}/edgar_*.json`.

**Note:** If EDGAR is slow or rate-limits, it's OK for this step to take 2-5 minutes. If it fails due to network issues, skip this step and note the failure — the unit test suite is authoritative for correctness; the demo is aspirational.

**Step 4: Verify export files exist**

Run: `ls scripts/exports/niv/ scripts/exports/tcd_jepa/ scripts/exports/data/ 2>/dev/null` (use Glob tool, not bash ls)
Expected: one JSON file in each vertical directory.

**Step 5: Commit**

```bash
git add scripts/demo_data_layer_edgar.py
git commit -m "data_layer: add EDGAR end-to-end demo script"
```

Note: do NOT commit the generated `scripts/exports/*.json` files. Add them to `.gitignore` if needed, or explicitly leave them untracked.

---

## Task 12: Final sweep + full test run + plan commit

**Files:**
- No new files — verification pass only.

**Step 1: Run the entire test suite one last time**

Run: `cd backend && python -m pytest tests/services/test_data_layer.py -v --tb=short`
Expected: all ~33 tests pass, no warnings from data_layer.

**Step 2: Verify zero imports from data_layer leaked into existing code**

Run: `cd backend && grep -r "data_layer" app/ --include="*.py" -l` (use Grep tool)
Expected: only files under `app/services/data_layer/` match. No leakage into `btut/`, `ingestion/`, `crystallization/`, or `api/`.

**Step 3: Verify the existing BTUT pipeline still imports**

Run: `cd backend && python -c "from app.services.btut.pipeline import run_btut_pipeline; print('btut ok')"`
Expected: `btut ok`

**Step 4: Commit the plan doc itself**

```bash
git add docs/plans/2026-04-10-latent-ocean-data-layer-plan.md
git commit -m "data_layer: add implementation plan"
```

**Step 5: Show the final file tree**

Run: `find backend/app/services/data_layer backend/tests/services scripts/demo_data_layer_edgar.py -type f` (use Glob tool for each pattern)
Expected output:
```
backend/app/services/data_layer/__init__.py
backend/app/services/data_layer/core.py
backend/app/services/data_layer/errors.py
backend/app/services/data_layer/linking.py
backend/app/services/data_layer/manifold.py
backend/app/services/data_layer/types.py
backend/app/services/data_layer/verticals.py
backend/tests/__init__.py
backend/tests/services/__init__.py
backend/tests/services/test_data_layer.py
scripts/demo_data_layer_edgar.py
```

Report final commit list to the user:
```bash
git log --oneline -15
```

---

## Summary of commits produced

1. `LatentOceanDataLayer: design for thin facade over existing BTUT spine` *(already committed before plan execution)*
2. `data_layer: scaffold package with types and errors`
3. `data_layer: add manifold module (8D unit sphere + 3D S2 via PCA)`
4. `data_layer: add causal linking scaffold (cosine wired, 3 stubs)`
5. `data_layer: add vertical exporters (niv, tcd_jepa, data)`
6. `data_layer: add facade skeleton with ingest() and adapter registry wiring`
7. `data_layer: wire apply_btut_tuner() to run_btut_pipeline`
8. `data_layer: add project_to_manifold, survivors, quality metrics`
9. `data_layer: add export_for_vertical with optional disk write`
10. `data_layer: add link_causally cross-layer method`
11. `data_layer: add run() one-shot and double-ingest state reset`
12. `data_layer: add EDGAR end-to-end demo script`
13. `data_layer: add implementation plan`
