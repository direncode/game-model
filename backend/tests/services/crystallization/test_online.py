import numpy as np

from app.services.crystallization.online import (
    IncrementalCrystallizer,
    PersistenceFeature,
    detect_novel_features,
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
    # tcd_jepa.topology likely unavailable in test env; returns [] regardless.
    features = crystallizer.push(_bundle())
    assert features == []


def test_incremental_crystallizer_window_bounded():
    crystallizer = IncrementalCrystallizer(window_size=32)
    crystallizer.push(_bundle(n=40))
    assert crystallizer.window_length() <= 32


def test_detect_novel_features_empty_previous_filters_lifetime():
    new_feats = [
        PersistenceFeature(dim=0, birth=0.1, death=0.9),   # lifetime 0.8, keep
        PersistenceFeature(dim=1, birth=0.2, death=0.5),   # lifetime 0.3, keep
        PersistenceFeature(dim=0, birth=0.5, death=0.501), # lifetime ~0, drop
    ]
    novel = detect_novel_features(previous=[], current=new_feats)
    assert len(novel) == 2
    assert all(f.lifetime > 0.01 for f in novel)


def test_detect_novel_features_drops_short_lifetime():
    short_lived = [PersistenceFeature(dim=0, birth=0.5, death=0.5001)]
    novel = detect_novel_features(previous=[], current=short_lived)
    assert novel == []


def test_detect_novel_features_filters_matched_previous():
    previous = [PersistenceFeature(dim=0, birth=0.10, death=0.90)]
    current = [
        # Within epsilon of previous → matched → drop
        PersistenceFeature(dim=0, birth=0.11, death=0.91),
        # Different dim → not matched → keep
        PersistenceFeature(dim=1, birth=0.10, death=0.90),
        # Far from previous → not matched → keep
        PersistenceFeature(dim=0, birth=0.60, death=0.95),
    ]
    novel = detect_novel_features(previous=previous, current=current)
    assert len(novel) == 2
    assert {(f.dim, round(f.birth, 2)) for f in novel} == {(1, 0.10), (0, 0.60)}
