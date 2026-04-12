"""D-U-N-C → Latent Ocean ingestion adapter.

Wraps the D-U-N-C tactical football vertical as a first-class ingestion
source on latentocean.com. Mirrors the same interface as `csv_adapter.py`,
`json_adapter.py`, and `fsd_adapter.py` (the Franklin Street Data adapter):
each adapter produces a `ParsedGraph` — entities + relationships + metadata —
that the awakening pipeline downstream can normalize and feed into BTUT and
TCD-JEPA.

What is a "graph" for football tracking?
    Entities: every player twin + the ball
    Relationships: (a) average proximity links between players (clustering
                   reveals tactical shape), (b) velocity-coherence links
                   (who moves together), and (c) ball-possession edges
                   (ball ↔ nearest home/away player over the window).

This is intentionally simple. The real tactical intelligence lives in the
live vertical at `app/services/dunc/`; this adapter is the bridge that lets
D-U-N-C appear as a regular Latent Ocean data source — listed alongside CSV
uploads, HuggingFace hub datasets, and FSD on the main site.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Iterable, Literal

from app.services.ingestion.csv_adapter import (
    ParsedEntity,
    ParsedGraph,
    ParsedRelationship,
)
from app.services.dunc.adapters import TrackingFrame
from app.services.dunc.simulator import MatchPreset, MatchSimulator

logger = logging.getLogger(__name__)


# ── Metadata block — this is what the frontend adapter catalog renders ──
ADAPTER_MANIFEST: dict = {
    "key": "dunc",
    "name": "D-U-N-C · Live Football Tracking",
    "description": (
        "Streaming GPS/RFID wearable telemetry from match play. Converts "
        "player position, velocity, and tactical events into an ingestable "
        "graph for BTUT thinning and TCD-JEPA crystallization."
    ),
    "category": "live_data",
    "status": "live",
    "data_kind": "streaming_tracking",
    "entity_types": ["player_twin", "ball"],
    "relationship_types": ["proximity", "coherence", "possession"],
    "rate_hz": 10,
    "deep_link": "/dunc",
    "docs": "docs/plans/2026-04-11-dunc-vertical-design.md",
}


@dataclass
class DuncIngestionConfig:
    """Parameters for building a ParsedGraph from a D-U-N-C match window."""

    preset_name: str = "demo"
    seed: int = 1337
    hz: float = 10.0
    # How many seconds of match to sample. 30s at 10Hz is 300 frames, plenty
    # for a rich graph without blowing up the BTUT cascade.
    window_seconds: float = 30.0
    # Proximity edges are created for any two players whose average distance
    # across the window is ≤ this many meters.
    proximity_m: float = 12.0
    # Coherence edges are created for any two players whose velocity vectors
    # were aligned (cosine similarity) above this threshold on average.
    coherence_threshold: float = 0.75


def collect_match_window(cfg: DuncIngestionConfig) -> list[TrackingFrame]:
    """Run the simulator forward `window_seconds` and return the frames.

    Deterministic given the seed. Used both for one-shot ingestion and as
    the reference implementation that a real vendor adapter would mimic.
    """
    sim = MatchSimulator(MatchPreset(name=cfg.preset_name, seed=cfg.seed, hz=cfg.hz))
    n_frames = int(cfg.window_seconds * cfg.hz)
    frames: list[TrackingFrame] = []
    for _ in range(n_frames):
        frames.append(sim.step())
    return frames


@dataclass
class DuncIngestionResult:
    """Container returned by `build_graph`.

    `graph` is a standard `ParsedGraph` that plugs straight into the
    awakening pipeline. `metadata` is a side-channel describing how the
    graph was built; useful for the adapter catalog and for audit logs.
    """

    graph: ParsedGraph
    metadata: dict


def build_graph(cfg: DuncIngestionConfig, frames: list[TrackingFrame] | None = None) -> DuncIngestionResult:
    """Build a ParsedGraph from a window of D-U-N-C tracking frames.

    This is the shape the awakening pipeline expects: `entities` + `relationships`.
    Downstream BTUT will consume the entity set and relationship weights as a
    weighted graph to thin.
    """
    if frames is None:
        frames = collect_match_window(cfg)
    if not frames:
        return _empty_graph()

    # ── Build entities (players + ball) ──
    entities: dict[str, ParsedEntity] = {}

    # The schema is derived from the first frame; every frame has the same
    # set of players because the simulator is deterministic.
    for sample in frames[0].players:
        entities[sample.player_id] = ParsedEntity(
            name=sample.player_id,
            entity_type="player_twin",
            attributes={
                "team": sample.team,
                "number": sample.number,
                "role": sample.role,
                "source": "dunc",
            },
        )
    entities["BALL"] = ParsedEntity(
        name="BALL",
        entity_type="ball",
        attributes={"source": "dunc"},
    )

    # ── Aggregate stats across the window for each entity ──
    positions: dict[str, list[tuple[float, float]]] = {k: [] for k in entities}
    velocities: dict[str, list[tuple[float, float]]] = {k: [] for k in entities}

    for frame in frames:
        for sample in frame.players:
            positions[sample.player_id].append((sample.x, sample.y))
            velocities[sample.player_id].append((sample.vx, sample.vy))
        positions["BALL"].append((frame.ball.x, frame.ball.y))
        velocities["BALL"].append((frame.ball.vx, frame.ball.vy))

    # Enrich entity attributes with aggregate kinematics
    for pid, ent in entities.items():
        xs = positions[pid]
        vs = velocities[pid]
        if not xs:
            continue
        mean_x = sum(p[0] for p in xs) / len(xs)
        mean_y = sum(p[1] for p in xs) / len(xs)
        total_dist = 0.0
        for i in range(1, len(xs)):
            total_dist += math.hypot(xs[i][0] - xs[i - 1][0], xs[i][1] - xs[i - 1][1])
        mean_speed = sum(math.hypot(v[0], v[1]) for v in vs) / len(vs)
        ent.attributes["mean_x"] = round(mean_x, 2)
        ent.attributes["mean_y"] = round(mean_y, 2)
        ent.attributes["distance_m"] = round(total_dist, 2)
        ent.attributes["mean_speed"] = round(mean_speed, 2)

    # ── Build relationships ──
    relationships: list[ParsedRelationship] = []

    player_ids = [pid for pid in entities if pid != "BALL"]
    n_frames = len(frames)

    # Proximity edges — average pairwise distance across the window.
    for i, a in enumerate(player_ids):
        pa = positions[a]
        for b in player_ids[i + 1 :]:
            pb = positions[b]
            if len(pa) != len(pb):
                continue
            avg_d = sum(math.hypot(pa[k][0] - pb[k][0], pa[k][1] - pb[k][1]) for k in range(n_frames)) / n_frames
            if avg_d <= cfg.proximity_m:
                # Closer = stronger edge. Linear weight in [0, 1].
                weight = max(0.0, 1.0 - avg_d / cfg.proximity_m)
                relationships.append(
                    ParsedRelationship(
                        source=a,
                        target=b,
                        relationship_type="proximity",
                        weight=round(weight, 3),
                        attributes={"avg_distance_m": round(avg_d, 2)},
                    )
                )

    # Coherence edges — average cosine similarity of velocity vectors.
    for i, a in enumerate(player_ids):
        va = velocities[a]
        for b in player_ids[i + 1 :]:
            vb = velocities[b]
            if len(va) != len(vb):
                continue
            acc = 0.0
            counted = 0
            for k in range(n_frames):
                sa = math.hypot(va[k][0], va[k][1])
                sb = math.hypot(vb[k][0], vb[k][1])
                if sa < 0.3 or sb < 0.3:
                    continue  # too slow — cosine is noise
                cos = (va[k][0] * vb[k][0] + va[k][1] * vb[k][1]) / (sa * sb)
                acc += cos
                counted += 1
            if counted == 0:
                continue
            mean_cos = acc / counted
            if mean_cos >= cfg.coherence_threshold:
                relationships.append(
                    ParsedRelationship(
                        source=a,
                        target=b,
                        relationship_type="coherence",
                        weight=round(mean_cos, 3),
                        attributes={"samples": counted},
                    )
                )

    # Possession edges — ball to nearest player per tick, aggregated.
    possession_counts: dict[str, int] = {}
    ball_positions = positions["BALL"]
    for k, (bx, by) in enumerate(ball_positions):
        nearest: str | None = None
        nearest_d = float("inf")
        for pid in player_ids:
            px, py = positions[pid][k]
            d = math.hypot(bx - px, by - py)
            if d < nearest_d:
                nearest_d = d
                nearest = pid
        if nearest is not None and nearest_d < 5.0:
            possession_counts[nearest] = possession_counts.get(nearest, 0) + 1
    for pid, count in possession_counts.items():
        weight = count / n_frames
        relationships.append(
            ParsedRelationship(
                source="BALL",
                target=pid,
                relationship_type="possession",
                weight=round(weight, 3),
                attributes={"ticks": count},
            )
        )

    graph = ParsedGraph(
        entities=list(entities.values()),
        relationships=relationships,
    )
    metadata = {
        "source": "dunc",
        "preset": cfg.preset_name,
        "seed": cfg.seed,
        "hz": cfg.hz,
        "window_seconds": cfg.window_seconds,
        "frames": n_frames,
        "entity_count": len(entities),
        "relationship_count": len(relationships),
    }
    return DuncIngestionResult(graph=graph, metadata=metadata)


def describe() -> dict:
    """Return the manifest block — the frontend adapter catalog reads this."""
    return dict(ADAPTER_MANIFEST)


def _empty_graph() -> DuncIngestionResult:
    return DuncIngestionResult(
        graph=ParsedGraph(entities=[], relationships=[]),
        metadata={"source": "dunc", "frames": 0},
    )
