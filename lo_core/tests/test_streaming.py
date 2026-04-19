"""Tests for streaming + partitioned + incremental + cold-storage primitives."""
from __future__ import annotations

import json
from pathlib import Path

from lo_core.streaming import (
    ChunkedSurvivorStream,
    ColdStorageTier,
    IncrementalFingerprintIndex,
    PartitionedLattice,
    SurvivorChunk,
)


def _write_shard(corpus_dir: Path, idx: int, n_survivors: int, fp_offset: int = 0) -> None:
    corpus_dir.mkdir(parents=True, exist_ok=True)
    survs = [
        {
            "entity": {"name": f"e_{idx}_{i}"},
            "fingerprint_48bit": f"{(fp_offset + i * 37 + idx * 101) % 2**48:048b}",
            "cluster": i % 4,
            "scores": {"anomaly": 0.5},
        }
        for i in range(n_survivors)
    ]
    (corpus_dir / f"shard_{idx:04d}.json").write_text(
        json.dumps({"corpus_id": corpus_dir.name, "shard_index": idx, "survivors": survs}),
        encoding="utf-8",
    )


def test_chunked_stream_iterates_without_loading_all(tmp_path):
    corpus = tmp_path / "corpus_a"
    for i in range(5):
        _write_shard(corpus, i, 100)
    stream = ChunkedSurvivorStream(corpus)
    chunks = list(stream)
    assert len(chunks) == 5
    assert all(isinstance(c, SurvivorChunk) for c in chunks)
    assert sum(len(c.survivors) for c in chunks) == 500
    assert stream.survivor_count() == 500


def test_partitioned_lattice_is_deterministic(tmp_path):
    corpus = tmp_path / "corpus_b"
    for i in range(3):
        _write_shard(corpus, i, 50)
    stream = ChunkedSurvivorStream(corpus)

    p8 = PartitionedLattice(n_partitions=8)
    partitions_a = p8.ingest_stream(list(stream))
    partitions_b = p8.ingest_stream(list(ChunkedSurvivorStream(corpus)))

    assert len(partitions_a) == 8
    # Same input → same partitioning
    for a, b in zip(partitions_a, partitions_b):
        assert a.fingerprint_counts == b.fingerprint_counts

    # Merge matches total entity count
    total = sum(p.entity_count for p in partitions_a)
    assert total == 150


def test_partitioned_lattice_no_cross_contamination(tmp_path):
    corpus = tmp_path / "corpus_c"
    _write_shard(corpus, 0, 100)
    stream = list(ChunkedSurvivorStream(corpus))
    p = PartitionedLattice(n_partitions=4)
    partitions = p.ingest_stream(stream)
    # Each fingerprint lives in exactly one partition
    seen: set[str] = set()
    for part in partitions:
        for fp in part.fingerprint_counts:
            assert fp not in seen, f"fingerprint {fp} in multiple partitions"
            seen.add(fp)


def test_incremental_index_is_idempotent_and_checkpointable(tmp_path):
    corpus = tmp_path / "corpus_d"
    for i in range(3):
        _write_shard(corpus, i, 50)
    ckpt = tmp_path / "index.json"
    idx = IncrementalFingerprintIndex(ckpt)
    for chunk in ChunkedSurvivorStream(corpus):
        idx.update(chunk)
    snapshot_1 = idx.snapshot()
    idx.checkpoint()

    # Re-feed the same chunks; idempotent
    for chunk in ChunkedSurvivorStream(corpus):
        idx.update(chunk)
    snapshot_2 = idx.snapshot()
    assert snapshot_1 == snapshot_2

    # New instance loads the checkpoint
    idx2 = IncrementalFingerprintIndex(ckpt)
    assert idx2.snapshot() == snapshot_1


def test_cold_storage_archive_roundtrip(tmp_path):
    cold = ColdStorageTier(tmp_path / "archive")
    chunk = SurvivorChunk(
        corpus_id="test",
        shard_index=5,
        survivors=[{"entity": {"name": "x"}, "fingerprint_48bit": "1" * 48}],
        fingerprints={"x": "1" * 48},
    )
    aid = cold.archive(chunk)
    assert aid.endswith("shard_000005.json")
    restored = cold.restore(aid)
    assert restored.corpus_id == "test"
    assert restored.shard_index == 5
    assert len(restored.survivors) == 1
    shards = cold.list_shards("test")
    assert aid in shards
    evicted = cold.evict("test")
    assert evicted == 1
    assert cold.list_shards("test") == []


if __name__ == "__main__":
    import traceback
    import tempfile
    passed, failed = 0, 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            with tempfile.TemporaryDirectory() as td:
                try:
                    fn(Path(td))
                    print(f"  PASS  {name}")
                    passed += 1
                except Exception:
                    print(f"  FAIL  {name}")
                    traceback.print_exc()
                    failed += 1
    print(f"\n{passed} passed, {failed} failed")
