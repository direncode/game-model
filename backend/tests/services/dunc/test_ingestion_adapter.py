"""D-U-N-C ingestion adapter tests.

Verifies that the adapter produces a well-formed ParsedGraph that the
awakening pipeline can consume. Does NOT hit the actual awakening pipeline
(that's a separate integration test) — we only check shape.
"""

from __future__ import annotations

from app.services.ingestion.dunc_adapter import (
    ADAPTER_MANIFEST,
    DuncIngestionConfig,
    build_graph,
    collect_match_window,
    describe,
)


def test_manifest_exposes_required_fields():
    m = describe()
    assert m["key"] == "dunc"
    assert m["category"] == "live_data"
    assert "player_twin" in m["entity_types"]
    assert "proximity" in m["relationship_types"]
    assert m["deep_link"] == "/dunc"


def test_collect_match_window_produces_frames():
    cfg = DuncIngestionConfig(window_seconds=2.0)
    frames = collect_match_window(cfg)
    # 2s at 10Hz → 20 frames
    assert len(frames) == 20
    assert len(frames[0].players) == 22


def test_build_graph_shape():
    cfg = DuncIngestionConfig(window_seconds=5.0, seed=42)
    result = build_graph(cfg)
    graph = result.graph

    # 22 players + 1 ball = 23 entities
    assert len(graph.entities) == 23
    teams = {e.attributes["team"] for e in graph.entities if e.entity_type == "player_twin"}
    assert teams == {"home", "away"}
    ball = next(e for e in graph.entities if e.entity_type == "ball")
    assert ball.name == "BALL"

    # Every entity should have the aggregated kinematics attached
    for ent in graph.entities:
        assert "mean_x" in ent.attributes
        assert "distance_m" in ent.attributes

    # There should be at least some relationships — a match window with
    # 22 players always has at least a few proximity edges.
    assert len(graph.relationships) > 0
    kinds = {r.relationship_type for r in graph.relationships}
    # Proximity is essentially guaranteed; coherence and possession depend
    # on the sim dynamics for the seed. We only assert proximity here to
    # keep the test deterministic.
    assert "proximity" in kinds

    # Metadata sanity
    assert result.metadata["source"] == "dunc"
    assert result.metadata["frames"] == 50
    assert result.metadata["entity_count"] == 23


def test_build_graph_is_deterministic_for_same_seed():
    cfg = DuncIngestionConfig(window_seconds=2.0, seed=99)
    a = build_graph(cfg)
    b = build_graph(cfg)
    assert len(a.graph.entities) == len(b.graph.entities)
    assert len(a.graph.relationships) == len(b.graph.relationships)
