"""Scale-primitives for BTUT: streaming ingestion, partitioned lattice,
incremental survivor update, cold-storage tier.

Prototype quality: demonstrates the 1000x-scale *pattern* without
actually running at 1000x. Stdlib only; deterministic; unit-tested.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Iterator


@dataclass
class SurvivorChunk:
    """A bounded chunk of BTUT survivors from a streaming source."""

    corpus_id: str
    shard_index: int
    survivors: list[dict]
    fingerprints: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.fingerprints:
            self.fingerprints = {
                ((s.get("entity") or {}).get("name") or f"e_{i}"): s.get("fingerprint_48bit", "")
                for i, s in enumerate(self.survivors)
            }


class ChunkedSurvivorStream:
    """Iterate survivor shards on disk without loading the whole corpus.

    Directory layout:
        <corpus_dir>/shard_0000.json
        <corpus_dir>/shard_0001.json
        ...
    Each shard is a JSON file with a top-level `survivors` list. Shards
    are produced either by the BTUT pipeline (when configured to emit
    streaming output) or by a chunking adapter over an upstream source.
    """

    def __init__(self, corpus_dir: Path, pattern: str = "shard_*.json") -> None:
        self.corpus_dir = Path(corpus_dir)
        self.pattern = pattern

    def __iter__(self) -> Iterator[SurvivorChunk]:
        for path in sorted(self.corpus_dir.glob(self.pattern)):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            yield SurvivorChunk(
                corpus_id=data.get("corpus_id", self.corpus_dir.name),
                shard_index=int(data.get("shard_index", 0)),
                survivors=list(data.get("survivors") or []),
            )

    def survivor_count(self) -> int:
        return sum(len(c.survivors) for c in self)


@dataclass
class LatticePartition:
    """One shard of a partitioned 48-bit lattice.

    Partition assignment is a stable hash of the fingerprint, so the same
    fingerprint always lands in the same partition across runs and across
    compute nodes. This makes distributed fingerprinting embarrassingly
    parallel: every worker builds its own partitions, then a reducer
    merges by partition id.
    """

    partition_id: int
    fingerprint_counts: dict[str, int] = field(default_factory=dict)
    entity_count: int = 0


class PartitionedLattice:
    """N-way partitioned lattice over 48-bit fingerprints.

    Distributing across `n_partitions` workers: each worker consumes a
    subset of shards, every fingerprint routes to its deterministic
    partition, per-partition counts are merged without cross-worker
    communication until the reduce step.
    """

    def __init__(self, n_partitions: int = 64) -> None:
        if n_partitions <= 0:
            raise ValueError("n_partitions must be > 0")
        self.n_partitions = n_partitions

    def _partition_of(self, fingerprint: str) -> int:
        # Fast deterministic bucketing — first 16 bits mod n_partitions
        if not fingerprint:
            return 0
        try:
            head = int(fingerprint[:16] or "0", 2)
        except ValueError:
            head = hash(fingerprint) & 0xFFFF
        return head % self.n_partitions

    def ingest_stream(self, chunks: Iterable[SurvivorChunk]) -> list[LatticePartition]:
        partitions = [LatticePartition(partition_id=i) for i in range(self.n_partitions)]
        for chunk in chunks:
            for _name, fp in chunk.fingerprints.items():
                pid = self._partition_of(fp)
                part = partitions[pid]
                part.fingerprint_counts[fp] = part.fingerprint_counts.get(fp, 0) + 1
                part.entity_count += 1
        return partitions

    @staticmethod
    def merge(a: list[LatticePartition], b: list[LatticePartition]) -> list[LatticePartition]:
        if len(a) != len(b):
            raise ValueError("partition counts must match to merge")
        merged: list[LatticePartition] = []
        for pa, pb in zip(a, b):
            combined = dict(pa.fingerprint_counts)
            for fp, c in pb.fingerprint_counts.items():
                combined[fp] = combined.get(fp, 0) + c
            merged.append(LatticePartition(
                partition_id=pa.partition_id,
                fingerprint_counts=combined,
                entity_count=pa.entity_count + pb.entity_count,
            ))
        return merged


class IncrementalFingerprintIndex:
    """Streaming survivor update: keep a growing fingerprint → count + last-seen
    index that tolerates crashes via a checkpoint file.

    Idempotent: re-ingesting the same chunks does not double-count,
    because we key on (corpus_id, shard_index) to dedupe.
    """

    def __init__(self, checkpoint_path: Path) -> None:
        self.checkpoint_path = Path(checkpoint_path)
        self._counts: dict[str, int] = {}
        self._last_seen: dict[str, str] = {}  # fp -> entity name
        self._processed_shards: set[str] = set()
        self._load()

    def _load(self) -> None:
        if not self.checkpoint_path.exists():
            return
        try:
            state = json.loads(self.checkpoint_path.read_text(encoding="utf-8"))
            self._counts = dict(state.get("counts") or {})
            self._last_seen = dict(state.get("last_seen") or {})
            self._processed_shards = set(state.get("processed_shards") or [])
        except Exception:
            pass

    def _shard_key(self, chunk: SurvivorChunk) -> str:
        return f"{chunk.corpus_id}#{chunk.shard_index}"

    def update(self, chunk: SurvivorChunk) -> int:
        key = self._shard_key(chunk)
        if key in self._processed_shards:
            return 0
        self._processed_shards.add(key)
        n_added = 0
        for name, fp in chunk.fingerprints.items():
            if not fp:
                continue
            self._counts[fp] = self._counts.get(fp, 0) + 1
            self._last_seen[fp] = name
            n_added += 1
        return n_added

    def snapshot(self) -> dict:
        return {
            "counts": dict(sorted(self._counts.items())),
            "last_seen": dict(sorted(self._last_seen.items())),
            "processed_shards": sorted(self._processed_shards),
        }

    def checkpoint(self) -> None:
        self.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        self.checkpoint_path.write_text(
            json.dumps(self.snapshot(), indent=2, sort_keys=True),
            encoding="utf-8",
        )


class ColdStorageTier:
    """Cold-tier archival for survivor shards.

    Real deployments plug this against S3 Glacier / Azure Archive / GCS
    Coldline. This prototype uses the local filesystem and demonstrates
    the archive → restore → evict lifecycle.
    """

    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, corpus_id: str, shard_index: int) -> Path:
        safe_corpus = "".join(c for c in corpus_id if c.isalnum() or c in "-_")
        return self.root / safe_corpus / f"shard_{shard_index:06d}.json"

    def archive(self, chunk: SurvivorChunk) -> str:
        path = self._path_for(chunk.corpus_id, chunk.shard_index)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({
                "corpus_id": chunk.corpus_id,
                "shard_index": chunk.shard_index,
                "survivors": chunk.survivors,
            }, default=str),
            encoding="utf-8",
        )
        return str(path)

    def restore(self, archive_id: str) -> SurvivorChunk:
        path = Path(archive_id)
        data = json.loads(path.read_text(encoding="utf-8"))
        return SurvivorChunk(
            corpus_id=data.get("corpus_id", ""),
            shard_index=int(data.get("shard_index", 0)),
            survivors=list(data.get("survivors") or []),
        )

    def list_shards(self, corpus_id: str) -> list[str]:
        safe_corpus = "".join(c for c in corpus_id if c.isalnum() or c in "-_")
        d = self.root / safe_corpus
        if not d.exists():
            return []
        return sorted(str(p) for p in d.glob("shard_*.json"))

    def evict(self, corpus_id: str) -> int:
        """Permanently delete cold storage for a corpus. Returns count removed."""
        n = 0
        for p in self.list_shards(corpus_id):
            Path(p).unlink(missing_ok=True)
            n += 1
        return n
