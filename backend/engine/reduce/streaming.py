"""Tier 3: Out-of-core streaming processor — memory-mapped arrays + chunked GPU.

For 300M+ entities, we cannot hold all embeddings in RAM. This module uses
numpy memory-mapped arrays on disk, with OS virtual memory paging handling
the actual RAM management. The GPU processes 50K-entity chunks at a time.

Key features:
- MMapStore: disk-backed (N, D) float16 array
- Chunked iteration with configurable halo overlap for boundary accuracy
- Progressive dimensionality reduction between cascade levels
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

import numpy as np

from .config import BTUTConfig

logger = logging.getLogger(__name__)


class MMapStore:
    """Memory-mapped embedding store for out-of-core processing.

    Backed by a numpy memmap file on disk. For 300M entities at D=32 in FP16:
    ~19.2 GB on disk, but only accessed pages loaded into RAM by the OS.
    """

    def __init__(
        self,
        total_entities: int,
        embedding_dim: int,
        mmap_dir: str = "/tmp/btut_mmap",
        dtype: np.dtype = np.float16,
    ):
        self.total_entities = total_entities
        self.embedding_dim = embedding_dim
        self.dtype = dtype
        self._count = 0

        # Create mmap directory
        os.makedirs(mmap_dir, exist_ok=True)

        # Create temporary files for embeddings and entity ID hashes
        self._emb_path = os.path.join(mmap_dir, f"btut_emb_{id(self)}.mmap")
        self._idx_path = os.path.join(mmap_dir, f"btut_idx_{id(self)}.mmap")

        # Memory-mapped embedding array: (total_entities, D) in float16
        self.embeddings = np.memmap(
            self._emb_path,
            dtype=dtype,
            mode="w+",
            shape=(total_entities, embedding_dim),
        )

        # Memory-mapped index array: entity hash → row number
        # Store 8-byte hashes for entity name lookup
        self.id_hashes = np.memmap(
            self._idx_path,
            dtype=np.int64,
            mode="w+",
            shape=(total_entities,),
        )

    def append_chunk(self, embeddings: np.ndarray, entity_hashes: np.ndarray) -> int:
        """Write a chunk of embeddings to the mmap store.

        Args:
            embeddings: (C, D) array to append
            entity_hashes: (C,) int64 hashes of entity names

        Returns:
            Start index of the appended chunk
        """
        c = embeddings.shape[0]
        start = self._count
        end = start + c

        if end > self.total_entities:
            logger.warning(
                "MMapStore overflow: tried to write %d entities but only %d slots remaining",
                c, self.total_entities - self._count,
            )
            c = self.total_entities - self._count
            end = start + c
            if c <= 0:
                return start

        self.embeddings[start:end] = embeddings[:c].astype(self.dtype)
        self.id_hashes[start:end] = entity_hashes[:c]
        self._count = end

        return start

    @property
    def count(self) -> int:
        return self._count

    def get_chunk(self, start: int, end: int) -> np.ndarray:
        """Read a chunk of embeddings. Returns (end-start, D) float32 array."""
        return self.embeddings[start:min(end, self._count)].astype(np.float32)

    def get_all(self) -> np.ndarray:
        """Read all stored embeddings as float32. Only safe for small stores."""
        return self.embeddings[:self._count].astype(np.float32)

    def cleanup(self):
        """Remove mmap files from disk."""
        del self.embeddings
        del self.id_hashes
        for path in [self._emb_path, self._idx_path]:
            try:
                os.remove(path)
            except OSError:
                pass


class ChunkedIterator:
    """Iterate over an MMapStore in chunks with configurable halo overlap.

    Halo overlap ensures boundary accuracy: each chunk includes the last
    `halo_fraction` of the previous chunk and first `halo_fraction` of
    the next chunk for density computation. Only core rows are updated.
    """

    def __init__(
        self,
        store: MMapStore,
        chunk_size: int = 50_000,
        halo_fraction: float = 0.1,
    ):
        self.store = store
        self.chunk_size = chunk_size
        self.halo_size = int(chunk_size * halo_fraction)

    def __iter__(self):
        """Yields (core_start, core_end, chunk_with_halo) tuples."""
        total = self.store.count
        pos = 0

        while pos < total:
            core_end = min(pos + self.chunk_size, total)

            # Add halo from previous chunk
            halo_start = max(0, pos - self.halo_size)
            # Add halo from next chunk
            halo_end = min(total, core_end + self.halo_size)

            chunk = self.store.get_chunk(halo_start, halo_end)

            # Core indices within this chunk
            core_local_start = pos - halo_start
            core_local_end = core_end - halo_start

            yield ChunkInfo(
                core_start=pos,
                core_end=core_end,
                halo_start=halo_start,
                halo_end=halo_end,
                core_local_start=core_local_start,
                core_local_end=core_local_end,
                data=chunk,
            )

            pos = core_end

    @property
    def num_chunks(self) -> int:
        return max(1, (self.store.count + self.chunk_size - 1) // self.chunk_size)


class ChunkInfo:
    """Metadata about a single chunk from ChunkedIterator."""

    __slots__ = [
        "core_start", "core_end", "halo_start", "halo_end",
        "core_local_start", "core_local_end", "data",
    ]

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    @property
    def core_size(self) -> int:
        return self.core_end - self.core_start

    @property
    def core_data(self) -> np.ndarray:
        return self.data[self.core_local_start:self.core_local_end]


def random_project(
    embeddings: np.ndarray,
    target_dim: int,
    seed: int = 42,
) -> np.ndarray:
    """Johnson-Lindenstrauss random projection to lower dimension.

    Used between cascade levels to progressively reduce dimensionality
    (e.g., 32 → 16 → 8) after each thinning step.
    """
    current_dim = embeddings.shape[1]
    if current_dim <= target_dim:
        return embeddings

    rng = np.random.RandomState(seed)
    projection = rng.randn(current_dim, target_dim).astype(np.float32)
    projection /= np.sqrt(target_dim)  # JL scaling

    projected = embeddings @ projection

    # Re-normalize
    norms = np.linalg.norm(projected, axis=1, keepdims=True)
    norms = np.maximum(norms, 1e-8)
    return (projected / norms).astype(np.float32)


def hash_entity_name(name: str) -> int:
    """Deterministic 64-bit hash for entity name indexing."""
    # FNV-1a 64-bit
    h = 14695981039346656037
    for byte in name.encode("utf-8"):
        h ^= byte
        h = (h * 1099511628211) & 0xFFFFFFFFFFFFFFFF
    return h
