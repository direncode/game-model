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

    def circulation_rate(self) -> float:
        return sum(w.liquidity for w in self.wires)

    def friction_index(self) -> float:
        total_liq = sum(w.liquidity for w in self.wires)
        if total_liq < 1e-12:
            return 0.0
        return sum(w.friction * w.liquidity for w in self.wires) / total_liq

    def saturation_pressure(self) -> float:
        if not self.wells:
            return 0.0
        sats = [w.health.saturation for w in self.wells.values()]
        max_sat = max(sats)
        mean_headroom = sum(1.0 - s for s in sats) / len(sats)
        return max(0.0, max_sat - mean_headroom)

    def cascade_depth(self, start_well_id: str) -> int:
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
        if len(self.wells) < 2:
            return 0
        undirected = self._nx.to_undirected()
        if not nx.is_connected(undirected):
            return 0
        return nx.edge_connectivity(undirected)
