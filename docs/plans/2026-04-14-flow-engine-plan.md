# Flow Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a graph-based universal flow engine with self-diagnosing data wells, liquidity wires, and system-level resilience metrics — extracting validated meta-patterns from NIV while retiring its economics-specific wrapper.

**Architecture:** Directed graph where Wells (data reservoirs with sensors) connect via Wires (directed edges with liquidity/friction). The FlowGraph computes system-level metrics (resilience, circulation, cascade risk) using graph-theoretic measures. Meta-patterns from NIV (hysteresis alerts, conformal bands, ensemble disagreement, walk-forward validation) operate on the graph's time-series output. The engine observes and measures existing verticals — it does not orchestrate them.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, numpy, networkx (graph ops), pytest, React/TypeScript (frontend)

---

### Task 1: Well Data Model

**Files:**
- Create: `backend/app/services/flow_engine/__init__.py`
- Create: `backend/app/services/flow_engine/well.py`
- Test: `backend/tests/services/flow_engine/test_well.py`

**Step 1: Write the failing tests**

```python
# backend/tests/services/flow_engine/test_well.py
"""Tests for Well — self-diagnosing data reservoir."""
import pytest
from app.services.flow_engine.well import Well, WellState, HealthVector


class TestHealthVector:
    def test_normalized_clamps_to_unit(self):
        hv = HealthVector(saturation=1.5, conversion=-0.2, impulse=0.5, staleness=0.8)
        assert hv.saturation == 1.0
        assert hv.conversion == 0.0
        assert hv.impulse == 0.5
        assert hv.staleness == 0.8

    def test_as_tuple(self):
        hv = HealthVector(saturation=0.3, conversion=0.7, impulse=0.1, staleness=0.9)
        assert hv.as_tuple() == (0.3, 0.7, 0.1, 0.9)

    def test_mean_health(self):
        hv = HealthVector(saturation=0.4, conversion=0.6, impulse=0.8, staleness=0.2)
        assert abs(hv.mean() - 0.5) < 1e-9


class TestWell:
    def test_create_well(self):
        w = Well(well_id="btut", label="BTUT Engine")
        assert w.well_id == "btut"
        assert w.state == WellState.DORMANT

    def test_update_sensors(self):
        w = Well(well_id="btut", label="BTUT Engine")
        w.update_sensors(saturation=0.3, conversion=0.8, impulse=0.5, staleness=0.1)
        assert w.health.saturation == 0.3
        assert w.state == WellState.ACTIVE

    def test_saturated_state(self):
        w = Well(well_id="btut", label="BTUT Engine")
        w.update_sensors(saturation=0.95, conversion=0.5, impulse=0.5, staleness=0.1)
        assert w.state == WellState.SATURATED

    def test_starved_state(self):
        w = Well(well_id="btut", label="BTUT Engine")
        w.update_sensors(saturation=0.01, conversion=0.5, impulse=0.02, staleness=0.9)
        assert w.state == WellState.STARVED

    def test_health_history_records(self):
        w = Well(well_id="btut", label="BTUT Engine")
        w.update_sensors(saturation=0.3, conversion=0.8, impulse=0.5, staleness=0.1)
        w.update_sensors(saturation=0.5, conversion=0.7, impulse=0.4, staleness=0.2)
        assert len(w.health_history) == 2
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_well.py -v`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```python
# backend/app/services/flow_engine/__init__.py
"""Flow Engine — universal data flow primitives for Latent Ocean."""
```

```python
# backend/app/services/flow_engine/well.py
"""Well — self-diagnosing data reservoir with health sensors."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List


class WellState(str, Enum):
    ACTIVE = "active"
    SATURATED = "saturated"
    STARVED = "starved"
    DORMANT = "dormant"


@dataclass
class HealthVector:
    """Normalized sensor readings for a well. All values clamped to [0, 1]."""
    saturation: float = 0.0
    conversion: float = 0.0
    impulse: float = 0.0
    staleness: float = 0.0

    def __post_init__(self):
        self.saturation = max(0.0, min(1.0, self.saturation))
        self.conversion = max(0.0, min(1.0, self.conversion))
        self.impulse = max(0.0, min(1.0, self.impulse))
        self.staleness = max(0.0, min(1.0, self.staleness))

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.saturation, self.conversion, self.impulse, self.staleness)

    def mean(self) -> float:
        vals = self.as_tuple()
        return sum(vals) / len(vals)


# Thresholds for state derivation
_SATURATED_THRESHOLD = 0.9
_STARVED_SAT_THRESHOLD = 0.05
_STARVED_IMPULSE_THRESHOLD = 0.05


def _derive_state(health: HealthVector) -> WellState:
    if health.saturation >= _SATURATED_THRESHOLD:
        return WellState.SATURATED
    if health.saturation <= _STARVED_SAT_THRESHOLD and health.impulse <= _STARVED_IMPULSE_THRESHOLD:
        return WellState.STARVED
    return WellState.ACTIVE


class Well:
    """A data reservoir that maintains sensor readings about its own state."""

    def __init__(self, well_id: str, label: str = ""):
        self.well_id = well_id
        self.label = label or well_id
        self.health = HealthVector()
        self.state = WellState.DORMANT
        self.health_history: List[HealthVector] = []

    def update_sensors(
        self,
        saturation: float,
        conversion: float,
        impulse: float,
        staleness: float,
    ) -> None:
        self.health = HealthVector(
            saturation=saturation,
            conversion=conversion,
            impulse=impulse,
            staleness=staleness,
        )
        self.state = _derive_state(self.health)
        self.health_history.append(self.health)
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_well.py -v`
Expected: 7 passed

**Step 5: Create tests __init__**

```python
# backend/tests/services/flow_engine/__init__.py
```

**Step 6: Commit**

```bash
git add backend/app/services/flow_engine/ backend/tests/services/flow_engine/
git commit -m "feat(flow-engine): Well data model with health vector and state derivation"
```

---

### Task 2: Wire Data Model

**Files:**
- Create: `backend/app/services/flow_engine/wire.py`
- Test: `backend/tests/services/flow_engine/test_wire.py`

**Step 1: Write the failing tests**

```python
# backend/tests/services/flow_engine/test_wire.py
"""Tests for Wire — directed connection with liquidity and friction."""
import pytest
from app.services.flow_engine.wire import Wire, WireState


class TestWire:
    def test_create_wire(self):
        w = Wire(source="btut", sink="tcd_jepa")
        assert w.source == "btut"
        assert w.sink == "tcd_jepa"
        assert w.state == WireState.DORMANT

    def test_update_metrics(self):
        w = Wire(source="btut", sink="tcd_jepa")
        w.update_metrics(throughput=500.0, readiness=0.95, error_rate=0.01, retry_count=2, backpressure=0.05)
        assert w.state == WireState.FLOWING

    def test_liquidity_is_throughput_times_readiness(self):
        w = Wire(source="btut", sink="tcd_jepa")
        w.update_metrics(throughput=100.0, readiness=0.8, error_rate=0.0, retry_count=0, backpressure=0.0)
        assert abs(w.liquidity - 80.0) < 1e-9

    def test_friction_from_errors(self):
        w = Wire(source="a", sink="b")
        w.update_metrics(throughput=100.0, readiness=0.9, error_rate=0.2, retry_count=10, backpressure=0.3)
        assert w.friction > 0.0
        assert w.state == WireState.THROTTLED

    def test_blocked_state(self):
        w = Wire(source="a", sink="b")
        w.update_metrics(throughput=0.0, readiness=0.0, error_rate=0.9, retry_count=50, backpressure=1.0)
        assert w.state == WireState.BLOCKED

    def test_metrics_history_records(self):
        w = Wire(source="a", sink="b")
        w.update_metrics(throughput=100.0, readiness=0.9, error_rate=0.01, retry_count=0, backpressure=0.0)
        w.update_metrics(throughput=80.0, readiness=0.85, error_rate=0.05, retry_count=1, backpressure=0.1)
        assert len(w.metrics_history) == 2
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_wire.py -v`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```python
# backend/app/services/flow_engine/wire.py
"""Wire — directed connection between wells with liquidity and friction."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import List


class WireState(str, Enum):
    FLOWING = "flowing"
    THROTTLED = "throttled"
    BLOCKED = "blocked"
    DORMANT = "dormant"


@dataclass
class WireMetrics:
    throughput: float
    readiness: float
    error_rate: float
    retry_count: int
    backpressure: float
    liquidity: float
    friction: float


_THROTTLE_FRICTION_THRESHOLD = 0.15
_BLOCKED_READINESS_THRESHOLD = 0.1
_BLOCKED_ERROR_THRESHOLD = 0.5


def _compute_friction(error_rate: float, retry_count: int, backpressure: float) -> float:
    """Composite friction: weighted sum of error rate, normalized retries, and backpressure."""
    retry_norm = min(1.0, retry_count / 100.0)
    return 0.4 * error_rate + 0.3 * retry_norm + 0.3 * backpressure


def _derive_wire_state(throughput: float, readiness: float, friction: float) -> WireState:
    if readiness < _BLOCKED_READINESS_THRESHOLD and throughput < 1e-6:
        return WireState.BLOCKED
    if friction >= _THROTTLE_FRICTION_THRESHOLD:
        return WireState.THROTTLED
    if throughput > 0 or readiness > 0:
        return WireState.FLOWING
    return WireState.DORMANT


class Wire:
    """A directed connection between two wells."""

    def __init__(self, source: str, sink: str):
        self.source = source
        self.sink = sink
        self.liquidity: float = 0.0
        self.friction: float = 0.0
        self.state = WireState.DORMANT
        self.metrics_history: List[WireMetrics] = []

    def update_metrics(
        self,
        throughput: float,
        readiness: float,
        error_rate: float,
        retry_count: int,
        backpressure: float,
    ) -> None:
        self.liquidity = throughput * readiness
        self.friction = _compute_friction(error_rate, retry_count, backpressure)
        self.state = _derive_wire_state(throughput, readiness, self.friction)
        self.metrics_history.append(WireMetrics(
            throughput=throughput,
            readiness=readiness,
            error_rate=error_rate,
            retry_count=retry_count,
            backpressure=backpressure,
            liquidity=self.liquidity,
            friction=self.friction,
        ))
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_wire.py -v`
Expected: 6 passed

**Step 5: Commit**

```bash
git add backend/app/services/flow_engine/wire.py backend/tests/services/flow_engine/test_wire.py
git commit -m "feat(flow-engine): Wire data model with liquidity, friction, and state derivation"
```

---

### Task 3: FlowGraph — Core Graph Structure and System Metrics

**Files:**
- Create: `backend/app/services/flow_engine/graph.py`
- Test: `backend/tests/services/flow_engine/test_graph.py`

**Step 1: Write the failing tests**

```python
# backend/tests/services/flow_engine/test_graph.py
"""Tests for FlowGraph — directed graph with system-level metrics."""
import pytest
from app.services.flow_engine.well import Well
from app.services.flow_engine.wire import Wire
from app.services.flow_engine.graph import FlowGraph


def _make_graph() -> FlowGraph:
    """Helper: 3-well linear chain btut -> tcd -> estate."""
    g = FlowGraph()
    g.add_well(Well("btut", "BTUT Engine"))
    g.add_well(Well("tcd", "TCD-JEPA"))
    g.add_well(Well("estate", "Data Estate"))
    g.add_wire(Wire("btut", "tcd"))
    g.add_wire(Wire("tcd", "estate"))
    return g


def _activate_graph(g: FlowGraph) -> None:
    """Push sensor readings and wire metrics to make graph active."""
    for wid in ["btut", "tcd", "estate"]:
        g.wells[wid].update_sensors(saturation=0.4, conversion=0.7, impulse=0.5, staleness=0.1)
    for w in g.wires:
        w.update_metrics(throughput=100.0, readiness=0.9, error_rate=0.02, retry_count=1, backpressure=0.05)


class TestFlowGraphStructure:
    def test_add_well(self):
        g = FlowGraph()
        g.add_well(Well("btut", "BTUT"))
        assert "btut" in g.wells

    def test_add_wire_validates_endpoints(self):
        g = FlowGraph()
        g.add_well(Well("btut"))
        with pytest.raises(ValueError, match="unknown well"):
            g.add_wire(Wire("btut", "nonexistent"))

    def test_neighbors(self):
        g = _make_graph()
        assert g.downstream("btut") == ["tcd"]
        assert g.upstream("estate") == ["tcd"]

    def test_well_count(self):
        g = _make_graph()
        assert len(g.wells) == 3
        assert len(g.wires) == 2


class TestFlowGraphMetrics:
    def test_circulation_rate(self):
        g = _make_graph()
        _activate_graph(g)
        circ = g.circulation_rate()
        # 2 wires, each liquidity=100*0.9=90, total=180
        assert abs(circ - 180.0) < 1e-6

    def test_friction_index(self):
        g = _make_graph()
        _activate_graph(g)
        fi = g.friction_index()
        assert fi > 0.0
        assert fi < 1.0

    def test_saturation_pressure(self):
        g = _make_graph()
        _activate_graph(g)
        sp = g.saturation_pressure()
        # max_sat=0.4, mean_headroom=1-0.4=0.6, pressure=0.4-0.6=-0.2 clamped to 0
        assert sp == 0.0

    def test_saturation_pressure_under_load(self):
        g = _make_graph()
        g.wells["btut"].update_sensors(saturation=0.95, conversion=0.5, impulse=0.8, staleness=0.1)
        g.wells["tcd"].update_sensors(saturation=0.7, conversion=0.5, impulse=0.6, staleness=0.1)
        g.wells["estate"].update_sensors(saturation=0.5, conversion=0.5, impulse=0.4, staleness=0.1)
        sp = g.saturation_pressure()
        assert sp > 0.0

    def test_cascade_depth(self):
        g = _make_graph()
        _activate_graph(g)
        g.wells["btut"].update_sensors(saturation=0.95, conversion=0.5, impulse=0.8, staleness=0.1)
        depth = g.cascade_depth("btut")
        assert depth == 2  # btut -> tcd -> estate

    def test_resilience_linear_chain(self):
        g = _make_graph()
        _activate_graph(g)
        # Linear chain: removing any 1 wire isolates a well
        r = g.resilience()
        assert r == 1  # min-cut of a linear chain is 1
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_graph.py -v`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```python
# backend/app/services/flow_engine/graph.py
"""FlowGraph — directed graph of Wells + Wires with system-level metrics."""
from __future__ import annotations

from collections import deque
from typing import Dict, List

import networkx as nx

from .well import Well
from .wire import Wire


class FlowGraph:
    """Directed graph of wells connected by wires. Computes system-level flow metrics."""

    def __init__(self):
        self.wells: Dict[str, Well] = {}
        self.wires: List[Wire] = []
        self._nx: nx.DiGraph = nx.DiGraph()

    def add_well(self, well: Well) -> None:
        self.wells[well.well_id] = well
        self._nx.add_node(well.well_id)

    def add_wire(self, wire: Wire) -> None:
        if wire.source not in self.wells:
            raise ValueError(f"unknown well: {wire.source}")
        if wire.sink not in self.wells:
            raise ValueError(f"unknown well: {wire.sink}")
        self.wires.append(wire)
        self._nx.add_edge(wire.source, wire.sink)

    def downstream(self, well_id: str) -> List[str]:
        return list(self._nx.successors(well_id))

    def upstream(self, well_id: str) -> List[str]:
        return list(self._nx.predecessors(well_id))

    def _wire_between(self, source: str, sink: str) -> Wire | None:
        for w in self.wires:
            if w.source == source and w.sink == sink:
                return w
        return None

    # ── System Metrics ──────────────────────────────────────────────

    def circulation_rate(self) -> float:
        """Sum of liquidity across all active wires."""
        return sum(w.liquidity for w in self.wires)

    def friction_index(self) -> float:
        """Demand-weighted mean friction. Weights by liquidity (proxy for demand)."""
        total_liq = sum(w.liquidity for w in self.wires)
        if total_liq < 1e-12:
            return 0.0
        return sum(w.friction * w.liquidity for w in self.wires) / total_liq

    def saturation_pressure(self) -> float:
        """Max saturation minus mean headroom, clamped to [0, 1]."""
        if not self.wells:
            return 0.0
        sats = [w.health.saturation for w in self.wells.values()]
        max_sat = max(sats)
        mean_headroom = sum(1.0 - s for s in sats) / len(sats)
        return max(0.0, max_sat - mean_headroom)

    def cascade_depth(self, start_well_id: str) -> int:
        """BFS depth from a well to its furthest reachable downstream well."""
        visited = {start_well_id}
        queue = deque([(start_well_id, 0)])
        max_depth = 0
        while queue:
            node, depth = queue.popleft()
            for neighbor in self.downstream(node):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, depth + 1))
                    max_depth = max(max_depth, depth + 1)
        return max_depth

    def resilience(self) -> int:
        """Min edge-cut of the flow graph (minimum wires to remove to disconnect it).

        For a connected graph, this is the edge connectivity.
        Returns 0 if the graph is already disconnected or has < 2 nodes.
        """
        if len(self.wells) < 2:
            return 0
        undirected = self._nx.to_undirected()
        if not nx.is_connected(undirected):
            return 0
        return nx.edge_connectivity(undirected)
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_graph.py -v`
Expected: 8 passed

**Step 5: Commit**

```bash
git add backend/app/services/flow_engine/graph.py backend/tests/services/flow_engine/test_graph.py
git commit -m "feat(flow-engine): FlowGraph with resilience, circulation, cascade depth, friction index"
```

---

### Task 4: Alert Hysteresis (Extracted from NIV)

**Files:**
- Create: `backend/app/services/flow_engine/alerts.py`
- Test: `backend/tests/services/flow_engine/test_alerts.py`

**Context:** This generalizes NIV's `alert_level_from_probability` (see `backend/app/services/niv/formula.py:121-179`). The key changes: remove economics-specific action text, make thresholds configurable, and operate on any `[0, 1]` metric.

**Step 1: Write the failing tests**

```python
# backend/tests/services/flow_engine/test_alerts.py
"""Tests for alert hysteresis state machine, generalized from NIV."""
import pytest
from app.services.flow_engine.alerts import AlertLevel, AlertEnvelope, alert_from_metric, AlertThresholds


class TestAlertEscalation:
    def test_normal_below_threshold(self):
        env = alert_from_metric(0.1)
        assert env.level == AlertLevel.NORMAL

    def test_elevated(self):
        env = alert_from_metric(0.35)
        assert env.level == AlertLevel.ELEVATED

    def test_warning(self):
        env = alert_from_metric(0.55)
        assert env.level == AlertLevel.WARNING

    def test_critical(self):
        env = alert_from_metric(0.75)
        assert env.level == AlertLevel.CRITICAL


class TestAlertHysteresis:
    def test_stays_critical_with_small_drop(self):
        """Must drop 10pp below threshold to de-escalate (hysteresis band)."""
        critical = AlertEnvelope(level=AlertLevel.CRITICAL, severity=0.75)
        # 0.65 is above 0.70 - 0.10 = 0.60, so stays critical
        env = alert_from_metric(0.65, current=critical)
        assert env.level == AlertLevel.CRITICAL

    def test_de_escalates_with_large_drop(self):
        critical = AlertEnvelope(level=AlertLevel.CRITICAL, severity=0.75)
        # 0.55 is below 0.60, so de-escalates
        env = alert_from_metric(0.55, current=critical)
        assert env.level == AlertLevel.WARNING

    def test_elevated_hysteresis(self):
        elevated = AlertEnvelope(level=AlertLevel.ELEVATED, severity=0.35)
        env = alert_from_metric(0.25, current=elevated)
        assert env.level == AlertLevel.ELEVATED  # 0.25 >= 0.30 - 0.10

    def test_custom_thresholds(self):
        custom = AlertThresholds(elevated=0.4, warning=0.6, critical=0.8, hysteresis_band=0.15)
        env = alert_from_metric(0.45, thresholds=custom)
        assert env.level == AlertLevel.ELEVATED
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_alerts.py -v`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```python
# backend/app/services/flow_engine/alerts.py
"""Alert hysteresis state machine — generalized from NIV's AlertEnvelope.

Operates on any metric in [0, 1]. Higher = worse (like recession probability).
The hysteresis band prevents flip-flopping on noisy metrics.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class AlertLevel(str, Enum):
    NORMAL = "normal"
    ELEVATED = "elevated"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class AlertThresholds:
    elevated: float = 0.30
    warning: float = 0.50
    critical: float = 0.70
    hysteresis_band: float = 0.10


@dataclass
class AlertEnvelope:
    level: AlertLevel
    severity: float


_DEFAULT_THRESHOLDS = AlertThresholds()

_LEVEL_ORDER = [AlertLevel.NORMAL, AlertLevel.ELEVATED, AlertLevel.WARNING, AlertLevel.CRITICAL]


def alert_from_metric(
    value: float,
    current: AlertEnvelope | None = None,
    thresholds: AlertThresholds = _DEFAULT_THRESHOLDS,
) -> AlertEnvelope:
    """Compute alert level with hysteresis.

    Escalation uses raw thresholds. De-escalation requires value to drop
    below (threshold - hysteresis_band) to prevent monthly flip-flops.
    """
    t = thresholds

    if current is not None:
        hb = t.hysteresis_band
        cl = current.level
        if cl == AlertLevel.CRITICAL and value >= t.critical - hb:
            return AlertEnvelope(level=AlertLevel.CRITICAL, severity=value)
        if cl == AlertLevel.WARNING and value >= t.warning - hb:
            return AlertEnvelope(level=AlertLevel.WARNING, severity=value)
        if cl == AlertLevel.ELEVATED and value >= t.elevated - hb:
            return AlertEnvelope(level=AlertLevel.ELEVATED, severity=value)

    if value >= t.critical:
        return AlertEnvelope(level=AlertLevel.CRITICAL, severity=value)
    if value >= t.warning:
        return AlertEnvelope(level=AlertLevel.WARNING, severity=value)
    if value >= t.elevated:
        return AlertEnvelope(level=AlertLevel.ELEVATED, severity=value)
    return AlertEnvelope(level=AlertLevel.NORMAL, severity=value)
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_alerts.py -v`
Expected: 8 passed

**Step 5: Commit**

```bash
git add backend/app/services/flow_engine/alerts.py backend/tests/services/flow_engine/test_alerts.py
git commit -m "feat(flow-engine): alert hysteresis state machine, extracted from NIV"
```

---

### Task 5: Conformal Uncertainty Bands (Extracted from NIV)

**Files:**
- Create: `backend/app/services/flow_engine/conformal.py`
- Test: `backend/tests/services/flow_engine/test_conformal.py`

**Context:** This is a direct generalization of `backend/app/services/niv/conformal.py` (40 LOC). The NIV version is already clean and domain-agnostic — the main change is removing the NIV package dependency and adding a time-series batch interface.

**Step 1: Write the failing tests**

```python
# backend/tests/services/flow_engine/test_conformal.py
"""Tests for conformal uncertainty bands, extracted from NIV."""
import pytest
from app.services.flow_engine.conformal import ConformalPredictor


class TestConformalPredictor:
    def test_wide_bands_with_no_history(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        lo, hi = cp.bands(0.5)
        assert lo == 0.0
        assert hi == 1.0

    def test_bands_narrow_with_accurate_history(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        for _ in range(50):
            cp.update(pred=0.5, actual=0.5)
        lo, hi = cp.bands(0.5)
        assert hi - lo < 0.1  # tight bands for perfect predictions

    def test_bands_widen_with_noisy_history(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        import random
        random.seed(42)
        for _ in range(50):
            cp.update(pred=0.5, actual=random.random())
        lo, hi = cp.bands(0.5)
        assert hi - lo > 0.3  # wider bands for noisy predictions

    def test_coverage_tracks_accuracy(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        for _ in range(100):
            cp.update(pred=0.5, actual=0.5)
        assert cp.coverage() > 0.8

    def test_bands_clamped_to_unit(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        for _ in range(10):
            cp.update(pred=0.9, actual=0.1)
        lo, hi = cp.bands(0.9)
        assert lo >= 0.0
        assert hi <= 1.0

    def test_batch_update(self):
        cp = ConformalPredictor(alpha=0.1, window=100)
        preds = [0.5] * 20
        actuals = [0.5] * 20
        cp.update_batch(preds, actuals)
        assert cp.coverage() > 0.0
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_conformal.py -v`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```python
# backend/app/services/flow_engine/conformal.py
"""Split-conformal prediction for uncertainty bands on any [0,1] metric.

Extracted from NIV's conformal.py. Domain-agnostic: operates on any
predicted/actual pair in [0, 1].
"""
from __future__ import annotations

from collections import deque
from typing import List, Sequence

import numpy as np


class ConformalPredictor:
    """Online conformal predictor with rolling nonconformity scores."""

    def __init__(self, alpha: float = 0.1, window: int = 100):
        self.alpha = alpha
        self.window = window
        self._scores: deque[float] = deque(maxlen=window)
        self._correct: deque[bool] = deque(maxlen=window)

    def update(self, pred: float, actual: float) -> None:
        nonconformity = abs(pred - actual)
        self._scores.append(nonconformity)
        lo, hi = self.bands(pred)
        self._correct.append(lo <= actual <= hi)

    def update_batch(self, preds: Sequence[float], actuals: Sequence[float]) -> None:
        for p, a in zip(preds, actuals):
            self.update(p, a)

    def bands(self, pred: float) -> tuple[float, float]:
        if len(self._scores) < 2:
            return (0.0, 1.0)
        scores = np.array(self._scores)
        q = float(np.quantile(scores, 1 - self.alpha))
        lower = max(0.0, pred - q)
        upper = min(1.0, pred + q)
        return (float(lower), float(upper))

    def coverage(self) -> float:
        if not self._correct:
            return 0.0
        return sum(self._correct) / len(self._correct)
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_conformal.py -v`
Expected: 6 passed

**Step 5: Commit**

```bash
git add backend/app/services/flow_engine/conformal.py backend/tests/services/flow_engine/test_conformal.py
git commit -m "feat(flow-engine): conformal uncertainty bands, extracted from NIV"
```

---

### Task 6: Ensemble Disagreement (Extracted from NIV)

**Files:**
- Create: `backend/app/services/flow_engine/ensemble.py`
- Test: `backend/tests/services/flow_engine/test_ensemble.py`

**Context:** Generalizes NIV's ensemble pattern. Instead of hardcoded LR/AdaBoost/MLP, the engine accepts any callables that return a `[0, 1]` score. The combiner (log-odds averaging) and disagreement metric remain.

**Step 1: Write the failing tests**

```python
# backend/tests/services/flow_engine/test_ensemble.py
"""Tests for ensemble disagreement detection."""
import pytest
from app.services.flow_engine.ensemble import EnsembleAggregator


def estimator_high(_data) -> float:
    return 0.9

def estimator_low(_data) -> float:
    return 0.1

def estimator_mid(_data) -> float:
    return 0.5


class TestEnsembleAggregator:
    def test_agreement_low_disagreement(self):
        agg = EnsembleAggregator(estimators={"a": estimator_mid, "b": estimator_mid})
        result = agg.evaluate(None)
        assert result.disagreement < 0.01

    def test_disagreement_high(self):
        agg = EnsembleAggregator(estimators={"high": estimator_high, "low": estimator_low})
        result = agg.evaluate(None)
        assert result.disagreement > 0.3

    def test_combined_via_log_odds(self):
        agg = EnsembleAggregator(estimators={"a": estimator_high, "b": estimator_low, "c": estimator_mid})
        result = agg.evaluate(None)
        assert 0.0 < result.combined < 1.0

    def test_per_estimator_values(self):
        agg = EnsembleAggregator(estimators={"high": estimator_high, "low": estimator_low})
        result = agg.evaluate(None)
        assert abs(result.per_estimator["high"] - 0.9) < 1e-6
        assert abs(result.per_estimator["low"] - 0.1) < 1e-6

    def test_single_estimator(self):
        agg = EnsembleAggregator(estimators={"solo": estimator_mid})
        result = agg.evaluate(None)
        assert abs(result.combined - 0.5) < 1e-6
        assert result.disagreement == 0.0
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_ensemble.py -v`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```python
# backend/app/services/flow_engine/ensemble.py
"""Ensemble aggregation with disagreement detection.

Extracted from NIV's log-odds averaging combiner. Domain-agnostic:
accepts any callables that return a [0, 1] score for a given data payload.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict

import numpy as np


def _logit(p: float) -> float:
    clamped = max(1e-7, min(1 - 1e-7, p))
    return float(np.log(clamped / (1 - clamped)))


def _sigmoid(z: float) -> float:
    z = max(-500, min(500, z))
    return float(1.0 / (1.0 + np.exp(-z)))


@dataclass
class EnsembleResult:
    per_estimator: Dict[str, float]
    combined: float
    disagreement: float


class EnsembleAggregator:
    """Run multiple estimators on the same data and combine via log-odds averaging."""

    def __init__(self, estimators: Dict[str, Callable[[Any], float]]):
        self._estimators = estimators

    def evaluate(self, data: Any) -> EnsembleResult:
        scores: Dict[str, float] = {}
        for name, fn in self._estimators.items():
            scores[name] = fn(data)

        values = list(scores.values())
        if len(values) == 1:
            return EnsembleResult(
                per_estimator=scores,
                combined=values[0],
                disagreement=0.0,
            )

        logits = [_logit(v) for v in values]
        combined = _sigmoid(sum(logits) / len(logits))
        disagreement = float(np.std(values))

        return EnsembleResult(
            per_estimator=scores,
            combined=combined,
            disagreement=disagreement,
        )
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_ensemble.py -v`
Expected: 5 passed

**Step 5: Commit**

```bash
git add backend/app/services/flow_engine/ensemble.py backend/tests/services/flow_engine/test_ensemble.py
git commit -m "feat(flow-engine): ensemble disagreement detection, extracted from NIV"
```

---

### Task 7: Walk-Forward Validation Harness (Extracted from NIV)

**Files:**
- Create: `backend/app/services/flow_engine/walkforward.py`
- Test: `backend/tests/services/flow_engine/test_walkforward.py`

**Context:** Generalizes `backend/app/services/niv/walkforward.py`. The NIV version is already ensemble-agnostic (takes a factory callable). The main change: decouple from NIV's conformal import, use the flow_engine conformal instead.

**Step 1: Write the failing tests**

```python
# backend/tests/services/flow_engine/test_walkforward.py
"""Tests for walk-forward validation harness."""
import pytest
import numpy as np
import pandas as pd
from app.services.flow_engine.walkforward import (
    WalkForwardConfig,
    WalkForwardResult,
    walk_forward,
)


class _DummyModel:
    """Trivial model: always predicts the training mean."""
    def __init__(self):
        self._mean = 0.5

    def fit(self, X, y):
        self._mean = float(np.mean(y)) if len(y) > 0 else 0.5

    def predict_proba(self, X):
        n = X.shape[0] if hasattr(X, "shape") else len(X)
        probs = np.full((n, 2), 0.5)
        probs[:, 1] = self._mean
        probs[:, 0] = 1.0 - self._mean
        return probs


def _make_data(n: int = 100):
    """Generate synthetic binary classification data."""
    rng = np.random.RandomState(42)
    X = rng.randn(n, 3)
    y = (X[:, 0] > 0).astype(int)
    return X, y


class TestWalkForward:
    def test_returns_result(self):
        X, y = _make_data(100)
        cfg = WalkForwardConfig(warmup_frac=0.3, retrain_every=5, horizons=(1, 3))
        result = walk_forward(X, y, lambda: _DummyModel(), cfg)
        assert isinstance(result, WalkForwardResult)
        assert result.n_folds > 0

    def test_predictions_populated(self):
        X, y = _make_data(100)
        cfg = WalkForwardConfig(warmup_frac=0.3, retrain_every=5, horizons=(1,))
        result = walk_forward(X, y, lambda: _DummyModel(), cfg)
        assert len(result.predictions) > 0

    def test_metrics_per_horizon(self):
        X, y = _make_data(200)
        cfg = WalkForwardConfig(warmup_frac=0.2, retrain_every=5, horizons=(1, 3))
        result = walk_forward(X, y, lambda: _DummyModel(), cfg)
        for h in (1, 3):
            assert h in result.brier_by_horizon

    def test_conformal_bands_present(self):
        X, y = _make_data(100)
        cfg = WalkForwardConfig(warmup_frac=0.3, retrain_every=5, horizons=(1,))
        result = walk_forward(X, y, lambda: _DummyModel(), cfg)
        for pred in result.predictions:
            assert "conformal_lower" in pred
            assert "conformal_upper" in pred
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_walkforward.py -v`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```python
# backend/app/services/flow_engine/walkforward.py
"""Expanding-window walk-forward validation harness.

Extracted from NIV's walkforward.py. Ensemble-agnostic: takes any factory
returning an object with fit(X, y) and predict_proba(X) -> ndarray.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Tuple

import numpy as np
from sklearn.metrics import brier_score_loss, f1_score, roc_auc_score

from .conformal import ConformalPredictor

logger = logging.getLogger(__name__)


@dataclass
class WalkForwardConfig:
    warmup_frac: float = 0.20
    retrain_every: int = 5
    horizons: Tuple[int, ...] = (3, 6, 12, 18)
    expanding: bool = True
    fixed_window: int = 180
    conformal_alpha: float = 0.1
    conformal_window: int = 100


@dataclass
class WalkForwardResult:
    horizons: Tuple[int, ...]
    auc_by_horizon: Dict[int, float]
    brier_by_horizon: Dict[int, float]
    f1_by_horizon: Dict[int, float]
    predictions: List[Dict[str, Any]]
    n_folds: int
    n_skipped: int
    warnings: List[str] = field(default_factory=list)


def walk_forward(
    X: np.ndarray,
    y: np.ndarray,
    model_factory: Callable[[], Any],
    cfg: WalkForwardConfig = WalkForwardConfig(),
) -> WalkForwardResult:
    """Run expanding-window walk-forward evaluation."""
    n = len(y)
    warmup = max(2, int(n * cfg.warmup_frac))

    conformal = ConformalPredictor(alpha=cfg.conformal_alpha, window=cfg.conformal_window)
    model = model_factory()
    predictions: List[Dict[str, Any]] = []
    step_count = 0

    for i in range(warmup, n):
        if step_count % cfg.retrain_every == 0 or step_count == 0:
            start = 0 if cfg.expanding else max(0, i - cfg.fixed_window)
            X_train, y_train = X[start:i], y[start:i]
            if len(np.unique(y_train)) < 2:
                step_count += 1
                continue
            model.fit(X_train, y_train)

        proba = model.predict_proba(X[i:i+1])
        prob = float(proba[0, 1])
        lo, hi = conformal.bands(prob)
        conformal.update(prob, float(y[i]))

        predictions.append({
            "index": i,
            "probability": prob,
            "actual": int(y[i]),
            "conformal_lower": lo,
            "conformal_upper": hi,
            "retrained": (step_count % cfg.retrain_every == 0),
        })
        step_count += 1

    # Compute metrics per horizon
    auc: Dict[int, float] = {}
    brier: Dict[int, float] = {}
    f1: Dict[int, float] = {}
    n_skipped = 0

    for h in cfg.horizons:
        actuals = []
        probs = []
        for p in predictions:
            future_idx = p["index"] + h
            if future_idx < n:
                actuals.append(int(y[future_idx]))
                probs.append(p["probability"])
        if len(actuals) < 2 or len(set(actuals)) < 2:
            n_skipped += 1
            continue
        auc[h] = float(roc_auc_score(actuals, probs))
        brier[h] = float(brier_score_loss(actuals, probs))
        preds_binary = [1 if p > 0.5 else 0 for p in probs]
        f1[h] = float(f1_score(actuals, preds_binary, zero_division=0))

    return WalkForwardResult(
        horizons=cfg.horizons,
        auc_by_horizon=auc,
        brier_by_horizon=brier,
        f1_by_horizon=f1,
        predictions=predictions,
        n_folds=step_count,
        n_skipped=n_skipped,
    )
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/services/flow_engine/test_walkforward.py -v`
Expected: 4 passed

**Step 5: Commit**

```bash
git add backend/app/services/flow_engine/walkforward.py backend/tests/services/flow_engine/test_walkforward.py
git commit -m "feat(flow-engine): walk-forward validation harness, extracted from NIV"
```

---

### Task 8: Pydantic Schemas and API Router

**Files:**
- Create: `backend/app/schemas/flow_engine.py`
- Create: `backend/app/api/v1/flow_engine.py`
- Modify: `backend/app/api/v1/__init__.py:1-52`
- Test: `backend/tests/api/test_flow_engine_endpoints.py`

**Step 1: Write the failing test**

```python
# backend/tests/api/test_flow_engine_endpoints.py
"""Tests for flow engine API endpoints."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


class TestFlowEngineEndpoints:
    def test_graph_state(self, client):
        resp = client.get("/api/v1/flow-engine/graph")
        assert resp.status_code == 200
        data = resp.json()
        assert "wells" in data
        assert "wires" in data
        assert "metrics" in data

    def test_well_health(self, client):
        resp = client.get("/api/v1/flow-engine/wells")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_system_metrics(self, client):
        resp = client.get("/api/v1/flow-engine/metrics")
        assert resp.status_code == 200
        data = resp.json()
        assert "resilience" in data
        assert "circulation_rate" in data
        assert "saturation_pressure" in data
        assert "friction_index" in data
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/api/test_flow_engine_endpoints.py -v`
Expected: FAIL — module not found

**Step 3: Write schemas**

```python
# backend/app/schemas/flow_engine.py
"""Pydantic v2 schemas for the flow engine API."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class WellHealthResponse(BaseModel):
    well_id: str
    label: str
    state: str
    saturation: float
    conversion: float
    impulse: float
    staleness: float
    alert_level: str


class WireResponse(BaseModel):
    source: str
    sink: str
    state: str
    liquidity: float
    friction: float


class SystemMetricsResponse(BaseModel):
    resilience: int
    circulation_rate: float
    saturation_pressure: float
    friction_index: float


class GraphStateResponse(BaseModel):
    wells: List[WellHealthResponse]
    wires: List[WireResponse]
    metrics: SystemMetricsResponse
```

**Step 4: Write API router**

```python
# backend/app/api/v1/flow_engine.py
"""Flow Engine API — graph state, well health, system metrics."""
from __future__ import annotations

from fastapi import APIRouter

from app.schemas.flow_engine import (
    GraphStateResponse,
    SystemMetricsResponse,
    WellHealthResponse,
    WireResponse,
)
from app.services.flow_engine.graph import FlowGraph
from app.services.flow_engine.well import Well
from app.services.flow_engine.wire import Wire
from app.services.flow_engine.alerts import alert_from_metric

router = APIRouter(prefix="/flow-engine", tags=["flow-engine"])

# Singleton graph — populated by vertical adapters at startup or via discovery
_graph: FlowGraph | None = None


def get_graph() -> FlowGraph:
    global _graph
    if _graph is None:
        _graph = FlowGraph()
    return _graph


def set_graph(g: FlowGraph) -> None:
    global _graph
    _graph = g


@router.get("/graph", response_model=GraphStateResponse)
def graph_state():
    g = get_graph()
    wells = []
    for w in g.wells.values():
        alert = alert_from_metric(w.health.saturation)
        wells.append(WellHealthResponse(
            well_id=w.well_id,
            label=w.label,
            state=w.state.value,
            saturation=w.health.saturation,
            conversion=w.health.conversion,
            impulse=w.health.impulse,
            staleness=w.health.staleness,
            alert_level=alert.level.value,
        ))
    wires = [
        WireResponse(
            source=w.source, sink=w.sink, state=w.state.value,
            liquidity=w.liquidity, friction=w.friction,
        )
        for w in g.wires
    ]
    metrics = SystemMetricsResponse(
        resilience=g.resilience(),
        circulation_rate=g.circulation_rate(),
        saturation_pressure=g.saturation_pressure(),
        friction_index=g.friction_index(),
    )
    return GraphStateResponse(wells=wells, wires=wires, metrics=metrics)


@router.get("/wells", response_model=list[WellHealthResponse])
def list_wells():
    g = get_graph()
    result = []
    for w in g.wells.values():
        alert = alert_from_metric(w.health.saturation)
        result.append(WellHealthResponse(
            well_id=w.well_id, label=w.label, state=w.state.value,
            saturation=w.health.saturation, conversion=w.health.conversion,
            impulse=w.health.impulse, staleness=w.health.staleness,
            alert_level=alert.level.value,
        ))
    return result


@router.get("/metrics", response_model=SystemMetricsResponse)
def system_metrics():
    g = get_graph()
    return SystemMetricsResponse(
        resilience=g.resilience(),
        circulation_rate=g.circulation_rate(),
        saturation_pressure=g.saturation_pressure(),
        friction_index=g.friction_index(),
    )
```

**Step 5: Register router in v1/__init__.py**

Add to imports:
```python
from app.api.v1.flow_engine import router as flow_engine_router
```

Add to includes:
```python
router.include_router(flow_engine_router)
```

**Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/api/test_flow_engine_endpoints.py -v`
Expected: 3 passed

**Step 7: Commit**

```bash
git add backend/app/schemas/flow_engine.py backend/app/api/v1/flow_engine.py backend/app/api/v1/__init__.py backend/tests/api/test_flow_engine_endpoints.py
git commit -m "feat(flow-engine): API router with graph state, well health, and system metrics endpoints"
```

---

### Task 9: Package Exports and Update __init__.py

**Files:**
- Modify: `backend/app/services/flow_engine/__init__.py`

**Step 1: Write clean exports**

```python
# backend/app/services/flow_engine/__init__.py
"""Flow Engine — universal data flow primitives for Latent Ocean.

Core abstractions:
  Well     — self-diagnosing data reservoir with health sensors
  Wire     — directed connection with liquidity and friction
  FlowGraph — directed graph computing system-level metrics

Meta-patterns (extracted from NIV):
  AlertEnvelope / alert_from_metric — hysteresis state machine
  ConformalPredictor               — uncertainty bands
  EnsembleAggregator              — disagreement detection
  walk_forward                     — expanding-window validation
"""

from .well import Well, WellState, HealthVector
from .wire import Wire, WireState
from .graph import FlowGraph
from .alerts import AlertLevel, AlertEnvelope, AlertThresholds, alert_from_metric
from .conformal import ConformalPredictor
from .ensemble import EnsembleAggregator, EnsembleResult
from .walkforward import WalkForwardConfig, WalkForwardResult, walk_forward

__all__ = [
    "Well", "WellState", "HealthVector",
    "Wire", "WireState",
    "FlowGraph",
    "AlertLevel", "AlertEnvelope", "AlertThresholds", "alert_from_metric",
    "ConformalPredictor",
    "EnsembleAggregator", "EnsembleResult",
    "WalkForwardConfig", "WalkForwardResult", "walk_forward",
]
```

**Step 2: Run full test suite**

Run: `cd backend && python -m pytest tests/services/flow_engine/ tests/api/test_flow_engine_endpoints.py -v`
Expected: All 34 tests pass

**Step 3: Commit**

```bash
git add backend/app/services/flow_engine/__init__.py
git commit -m "feat(flow-engine): clean package exports"
```

---

### Task 10: Frontend API Client and Flow Graph Page

**Files:**
- Create: `frontend/lib/flow-engine/api.ts`
- Create: `frontend/app/flow-engine/page.tsx`
- Modify: `frontend/components/Sidebar.tsx` (add nav link)

**Step 1: Write API client**

Reference `frontend/lib/dunc/api.ts` for the fetch pattern used in this project.

```typescript
// frontend/lib/flow-engine/api.ts
const BASE = "/api/v1/flow-engine";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Flow engine API error: ${res.status}`);
  return res.json();
}

export interface WellHealth {
  well_id: string;
  label: string;
  state: string;
  saturation: number;
  conversion: number;
  impulse: number;
  staleness: number;
  alert_level: string;
}

export interface WireInfo {
  source: string;
  sink: string;
  state: string;
  liquidity: number;
  friction: number;
}

export interface SystemMetrics {
  resilience: number;
  circulation_rate: number;
  saturation_pressure: number;
  friction_index: number;
}

export interface GraphState {
  wells: WellHealth[];
  wires: WireInfo[];
  metrics: SystemMetrics;
}

export const flowEngineApi = {
  graphState: () => request<GraphState>("/graph"),
  wells: () => request<WellHealth[]>("/wells"),
  metrics: () => request<SystemMetrics>("/metrics"),
};
```

**Step 2: Write the page**

This is a scaffold page with live graph state polling. The full visualization (interactive graph with D3/force layout) is a follow-up task.

```tsx
// frontend/app/flow-engine/page.tsx
"use client";

import { useEffect, useState } from "react";
import { flowEngineApi, GraphState } from "@/lib/flow-engine/api";

export default function FlowEnginePage() {
  const [graph, setGraph] = useState<GraphState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await flowEngineApi.graphState();
        setGraph(data);
      } catch (e: any) {
        setError(e.message);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <div className="p-6 text-red-400">Error: {error}</div>;
  if (!graph) return <div className="p-6 text-zinc-400">Loading flow graph...</div>;

  const m = graph.metrics;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Flow Engine</h1>

      {/* System Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Resilience", value: m.resilience },
          { label: "Circulation", value: m.circulation_rate.toFixed(1) },
          { label: "Saturation Pressure", value: m.saturation_pressure.toFixed(3) },
          { label: "Friction Index", value: m.friction_index.toFixed(3) },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</div>
            <div className="text-2xl font-mono mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Wells */}
      <h2 className="text-lg font-semibold mb-3">Wells</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {graph.wells.map((w) => (
          <div key={w.well_id} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{w.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                w.alert_level === "critical" ? "bg-red-900 text-red-300" :
                w.alert_level === "warning" ? "bg-amber-900 text-amber-300" :
                w.alert_level === "elevated" ? "bg-yellow-900 text-yellow-300" :
                "bg-zinc-800 text-zinc-400"
              }`}>{w.state}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
              <span>Saturation: {(w.saturation * 100).toFixed(0)}%</span>
              <span>Conversion: {(w.conversion * 100).toFixed(0)}%</span>
              <span>Impulse: {(w.impulse * 100).toFixed(0)}%</span>
              <span>Staleness: {(w.staleness * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Wires */}
      <h2 className="text-lg font-semibold mb-3">Wires</h2>
      <div className="space-y-2">
        {graph.wires.map((w, i) => (
          <div key={i} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 flex items-center gap-4">
            <span className="font-mono text-sm">{w.source}</span>
            <span className="text-zinc-600">→</span>
            <span className="font-mono text-sm">{w.sink}</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
              w.state === "blocked" ? "bg-red-900 text-red-300" :
              w.state === "throttled" ? "bg-amber-900 text-amber-300" :
              "bg-emerald-900 text-emerald-300"
            }`}>{w.state}</span>
            <span className="text-xs text-zinc-500">liq: {w.liquidity.toFixed(1)}</span>
            <span className="text-xs text-zinc-500">fric: {w.friction.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Add Sidebar nav link**

In `frontend/components/Sidebar.tsx`, add a navigation entry for `/flow-engine` with label "Flow Engine". Follow the existing pattern for other vertical links (e.g., `/dunc`, `/tcd-jepa`, `/data-estate`).

**Step 4: Commit**

```bash
git add frontend/lib/flow-engine/ frontend/app/flow-engine/ frontend/components/Sidebar.tsx
git commit -m "feat(flow-engine): frontend API client, dashboard page, and sidebar nav"
```

---

### Task 11: NIV Retirement — Remove Economics-Specific Code

**Files:**
- Delete: `backend/app/services/niv/` (entire directory)
- Delete: `backend/app/api/v1/niv.py`
- Delete: `backend/app/schemas/niv.py`
- Delete: `frontend/app/niv/` (entire directory)
- Delete: `frontend/components/niv/` (entire directory)
- Delete: `frontend/hooks/useNIVData.ts`
- Modify: `backend/app/api/v1/__init__.py` — remove niv_router import and include
- Delete: `backend/tests/services/niv/` (if exists)

**Step 1: Archive NIV design doc**

The existing `docs/plans/2026-04-11-niv-vertical-design.md` stays as historical reference. No action needed.

**Step 2: Remove backend NIV**

```bash
rm -rf backend/app/services/niv/
rm backend/app/api/v1/niv.py
rm backend/app/schemas/niv.py
rm -rf backend/tests/services/niv/
```

**Step 3: Remove NIV router registration from `backend/app/api/v1/__init__.py`**

Remove these lines:
```python
from app.api.v1.niv import router as niv_router
```
```python
router.include_router(niv_router)
```

**Step 4: Remove frontend NIV**

```bash
rm -rf frontend/app/niv/
rm -rf frontend/components/niv/
rm frontend/hooks/useNIVData.ts
```

**Step 5: Remove NIV from Sidebar.tsx**

Remove the `/niv` navigation entry from `frontend/components/Sidebar.tsx`.

**Step 6: Check for remaining NIV references**

Run: `grep -r "niv" --include="*.py" --include="*.ts" --include="*.tsx" backend/ frontend/ -l`

Fix any remaining imports or references.

**Step 7: Run full test suite**

Run: `cd backend && python -m pytest -v`
Expected: All tests pass (no NIV tests remain, no broken imports)

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: retire NIV economics vertical — patterns extracted to flow-engine"
```

---

## Dependency Note

Ensure `networkx` is in `backend/pyproject.toml` dependencies. Check with:
```bash
grep networkx backend/pyproject.toml
```
If missing, add `"networkx>=3.0"` to the `[project.dependencies]` list.
