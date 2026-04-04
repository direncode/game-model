"""Tier 4: Multi-type embedding engine — heterogeneous entity projection.

Converts entity dicts {name, type, attributes} into a uniform (N, D) float
array. Four type-specific sub-engines handle text, numeric, time-series,
and graph data independently, then fuse via weighted concatenation.

All sub-engines are designed for petabyte-scale: no vocabulary storage,
no full-graph materialization, streaming-compatible.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import struct
from typing import Optional

import numpy as np

from .config import BTUTConfig

logger = logging.getLogger(__name__)

# Dimension budget per sub-engine (must sum to embedding_dim)
_DIM_TEXT = 8
_DIM_NUMERIC = 8
_DIM_TIMESERIES = 8
_DIM_GRAPH = 4
_DIM_TYPE_ONEHOT = 4  # Entity type encoding


# ---------------------------------------------------------------------------
# Sub-Engine: Text Projection
# ---------------------------------------------------------------------------

class TextProjector:
    """Project text attributes into a fixed-dimensional space.

    Uses the hashing trick (feature hashing) for O(1) memory regardless
    of vocabulary size, followed by random projection to target dims.

    No sklearn dependency — pure numpy implementation for portability.
    """

    def __init__(self, output_dim: int = _DIM_TEXT, seed: int = 42):
        self.output_dim = output_dim
        self.hash_dim = 2048  # Intermediate hashed feature space
        self.rng = np.random.RandomState(seed)
        # Random projection matrix: (hash_dim, output_dim)
        self.projection = self.rng.randn(self.hash_dim, output_dim).astype(np.float32)
        self.projection /= np.sqrt(output_dim)  # Johnson-Lindenstrauss scaling

    def _tokenize(self, text: str) -> list[str]:
        """Simple whitespace + punctuation tokenizer."""
        # Lowercase and split on non-alphanumeric
        tokens = []
        current = []
        for ch in text.lower():
            if ch.isalnum():
                current.append(ch)
            else:
                if current:
                    tokens.append("".join(current))
                    current = []
        if current:
            tokens.append("".join(current))
        return tokens

    def _hash_feature(self, token: str) -> tuple[int, int]:
        """Hash token to (index, sign) for feature hashing."""
        h = hashlib.md5(token.encode("utf-8")).digest()
        idx = struct.unpack("<I", h[:4])[0] % self.hash_dim
        sign = 1 if (h[4] & 1) else -1
        return idx, sign

    def transform(self, texts: list[str]) -> np.ndarray:
        """Transform text strings to (N, output_dim) array."""
        n = len(texts)
        hashed = np.zeros((n, self.hash_dim), dtype=np.float32)

        for i, text in enumerate(texts):
            tokens = self._tokenize(text)
            if not tokens:
                continue
            for token in tokens:
                idx, sign = self._hash_feature(token)
                hashed[i, idx] += sign
            # L2 normalize the hashed vector (TF-IDF-like)
            norm = np.linalg.norm(hashed[i])
            if norm > 0:
                hashed[i] /= norm

        # Project to low-dimensional space
        return hashed @ self.projection


# ---------------------------------------------------------------------------
# Sub-Engine: Numeric Projection
# ---------------------------------------------------------------------------

class NumericProjector:
    """Project numeric attributes via z-score + random projection.

    Uses running statistics for streaming compatibility — no need to
    see all data before transforming.
    """

    def __init__(self, output_dim: int = _DIM_NUMERIC, seed: int = 42):
        self.output_dim = output_dim
        self.seed = seed
        self._means: Optional[np.ndarray] = None
        self._stds: Optional[np.ndarray] = None
        self._projection: Optional[np.ndarray] = None

    def fit(self, values: np.ndarray) -> NumericProjector:
        """Compute z-score parameters and random projection matrix."""
        self._means = np.nanmean(values, axis=0)
        self._stds = np.nanstd(values, axis=0) + 1e-8
        input_dim = values.shape[1]
        rng = np.random.RandomState(self.seed)
        self._projection = rng.randn(input_dim, self.output_dim).astype(np.float32)
        self._projection /= np.sqrt(self.output_dim)
        return self

    def transform(self, values: np.ndarray) -> np.ndarray:
        """Z-score normalize then random project to (N, output_dim)."""
        if self._means is None:
            self.fit(values)
        normalized = (values - self._means) / self._stds
        # Replace NaN with 0 (missing values)
        normalized = np.nan_to_num(normalized, nan=0.0)
        return normalized @ self._projection


# ---------------------------------------------------------------------------
# Sub-Engine: Time-Series Projection
# ---------------------------------------------------------------------------

class TimeSeriesProjector:
    """Project time-series data via FFT + autocorrelation features.

    Extracts: top-K FFT magnitude coefficients, autocorrelation at
    selected lags, and linear trend slope. Total: 13 features →
    random projected to output_dim.
    """

    def __init__(self, output_dim: int = _DIM_TIMESERIES, seed: int = 42):
        self.output_dim = output_dim
        self.n_fft_coeffs = 8
        self.autocorr_lags = [1, 2, 5, 10]
        rng = np.random.RandomState(seed)
        feature_dim = self.n_fft_coeffs + len(self.autocorr_lags) + 1  # +1 for trend
        self._projection = rng.randn(feature_dim, output_dim).astype(np.float32)
        self._projection /= np.sqrt(output_dim)

    def _extract_features(self, series: list[float] | np.ndarray) -> np.ndarray:
        """Extract frequency + temporal features from a single time series."""
        arr = np.array(series, dtype=np.float64)
        if len(arr) < 2:
            return np.zeros(self.n_fft_coeffs + len(self.autocorr_lags) + 1)

        # Z-score normalize
        std = np.std(arr)
        if std > 0:
            arr = (arr - np.mean(arr)) / std

        # FFT magnitude (top K)
        fft_mag = np.abs(np.fft.rfft(arr))
        fft_top = np.zeros(self.n_fft_coeffs)
        n_available = min(len(fft_mag), self.n_fft_coeffs)
        # Sort by magnitude, take top K
        top_indices = np.argsort(fft_mag)[::-1][:n_available]
        fft_top[:n_available] = fft_mag[top_indices[:n_available]]

        # Autocorrelation
        autocorr = np.zeros(len(self.autocorr_lags))
        for j, lag in enumerate(self.autocorr_lags):
            if lag < len(arr):
                c = np.corrcoef(arr[:-lag], arr[lag:])[0, 1]
                autocorr[j] = c if np.isfinite(c) else 0.0

        # Linear trend slope
        x = np.arange(len(arr), dtype=np.float64)
        slope = np.polyfit(x, arr, 1)[0] if len(arr) > 1 else 0.0

        return np.concatenate([fft_top, autocorr, [slope]])

    def transform(self, series_list: list[list[float] | np.ndarray]) -> np.ndarray:
        """Transform list of time series to (N, output_dim)."""
        features = np.array(
            [self._extract_features(s) for s in series_list],
            dtype=np.float32,
        )
        return features @ self._projection


# ---------------------------------------------------------------------------
# Sub-Engine: Graph Projection
# ---------------------------------------------------------------------------

class GraphProjector:
    """Project graph structure via random walk hashing.

    For each entity, performs K short random walks on the adjacency graph,
    hashes each walk path, and uses the hash collection as a feature.
    O(N × K × L) time, O(N × output_dim) memory.
    """

    def __init__(
        self,
        output_dim: int = _DIM_GRAPH,
        walks_per_node: int = 5,
        walk_length: int = 8,
        seed: int = 42,
    ):
        self.output_dim = output_dim
        self.walks_per_node = walks_per_node
        self.walk_length = walk_length
        self.seed = seed
        self.hash_dim = 256
        rng = np.random.RandomState(seed)
        self._projection = rng.randn(self.hash_dim, output_dim).astype(np.float32)
        self._projection /= np.sqrt(output_dim)

    def transform(
        self,
        entity_names: list[str],
        adjacency: dict[str, list[str]],
    ) -> np.ndarray:
        """Transform graph structure to (N, output_dim) via random walk hashing."""
        rng = np.random.RandomState(self.seed)
        n = len(entity_names)
        name_set = set(entity_names)
        hashed = np.zeros((n, self.hash_dim), dtype=np.float32)

        for i, name in enumerate(entity_names):
            neighbors = adjacency.get(name, [])
            if not neighbors:
                continue

            for _ in range(self.walks_per_node):
                # Random walk
                walk = [name]
                current = name
                for _ in range(self.walk_length - 1):
                    nbrs = adjacency.get(current, [])
                    if not nbrs:
                        break
                    current = nbrs[rng.randint(len(nbrs))]
                    walk.append(current)

                # Hash the walk path
                walk_str = "->".join(walk)
                h = hashlib.md5(walk_str.encode("utf-8")).digest()
                idx = struct.unpack("<I", h[:4])[0] % self.hash_dim
                sign = 1 if (h[4] & 1) else -1
                hashed[i, idx] += sign

            # Normalize
            norm = np.linalg.norm(hashed[i])
            if norm > 0:
                hashed[i] /= norm

        return hashed @ self._projection


# ---------------------------------------------------------------------------
# EntityEmbedder — orchestrator
# ---------------------------------------------------------------------------

class EntityEmbedder:
    """Multi-type entity embedding engine.

    Auto-classifies entity attribute types, routes to appropriate sub-engine,
    and fuses outputs via weighted concatenation to produce a uniform
    (N, embedding_dim) float array.

    Streaming-compatible: the random projection matrices are fixed at init,
    so chunks can be embedded independently with consistent geometry.
    """

    def __init__(self, config: BTUTConfig):
        self.config = config
        self.embedding_dim = config.embedding_dim
        self.text_proj = TextProjector(output_dim=_DIM_TEXT) if config.text_engine_enabled else None
        self.numeric_proj = NumericProjector(output_dim=_DIM_NUMERIC) if config.numeric_engine_enabled else None
        self.ts_proj = TimeSeriesProjector(output_dim=_DIM_TIMESERIES) if config.timeseries_engine_enabled else None
        self.graph_proj = GraphProjector(output_dim=_DIM_GRAPH) if config.graph_engine_enabled else None

        self._type_vocab: dict[str, int] = {}  # Built during fit

    def _parse_attrs(self, entity: dict) -> dict:
        """Parse attributes, handling string-encoded JSON."""
        attrs = entity.get("attributes", {})
        if isinstance(attrs, str):
            try:
                attrs = json.loads(attrs)
            except (json.JSONDecodeError, TypeError):
                return {}
        return attrs if isinstance(attrs, dict) else {}

    def _classify_attrs(self, attrs: dict) -> dict[str, list]:
        """Classify attribute values by type."""
        classified = {"text": [], "numeric": [], "timeseries": [], "keys_text": [], "keys_numeric": []}
        for key, value in attrs.items():
            if isinstance(value, (list, tuple)):
                # Check if it's a numeric list (time series)
                if all(isinstance(v, (int, float)) for v in value):
                    classified["timeseries"].append(value)
                else:
                    classified["text"].append(str(value))
            elif isinstance(value, (int, float)):
                classified["numeric"].append(float(value))
                classified["keys_numeric"].append(key)
            elif isinstance(value, str):
                classified["text"].append(value)
                classified["keys_text"].append(key)
        return classified

    def _build_type_onehot(self, entities: list[dict]) -> np.ndarray:
        """One-hot encode entity types (top types + 'other' bucket)."""
        max_types = _DIM_TYPE_ONEHOT - 1  # Reserve 1 dim for "other"

        # Build or reuse type vocabulary
        if not self._type_vocab:
            type_counts: dict[str, int] = {}
            for ent in entities:
                t = ent.get("type", "unknown")
                type_counts[t] = type_counts.get(t, 0) + 1
            # Top types by frequency
            sorted_types = sorted(type_counts, key=lambda k: -type_counts[k])
            for i, t in enumerate(sorted_types[:max_types]):
                self._type_vocab[t] = i

        n = len(entities)
        onehot = np.zeros((n, _DIM_TYPE_ONEHOT), dtype=np.float32)
        for i, ent in enumerate(entities):
            t = ent.get("type", "unknown")
            idx = self._type_vocab.get(t, max_types)  # Last dim = "other"
            onehot[i, idx] = 1.0

        return onehot

    def embed(
        self,
        entities: list[dict],
        edges: list[dict] | None = None,
    ) -> np.ndarray:
        """Embed a batch of entities into (N, embedding_dim) float32 array.

        Combines type one-hot + text + numeric + time-series + graph projections.
        Missing sub-engine dimensions are zero-filled.
        """
        n = len(entities)
        if n == 0:
            return np.zeros((0, self.embedding_dim), dtype=np.float32)

        parts = []

        # 1. Entity type one-hot
        type_features = self._build_type_onehot(entities)
        parts.append(type_features)

        # 2. Collect per-type data from attributes
        all_text = []
        all_numeric = []
        all_timeseries = []

        # Discover numeric attribute keys from first pass
        numeric_keys: list[str] = []
        numeric_keys_set = set()

        for ent in entities:
            attrs = self._parse_attrs(ent)
            classified = self._classify_attrs(attrs)

            # Collect text
            text_parts = [ent.get("name", "")]
            text_parts.extend(classified["text"])
            all_text.append(" ".join(text_parts))

            # Track numeric keys
            for k in classified["keys_numeric"]:
                if k not in numeric_keys_set:
                    numeric_keys_set.add(k)
                    numeric_keys.append(k)

            # Collect time series (first one found per entity)
            if classified["timeseries"]:
                all_timeseries.append(classified["timeseries"][0])
            else:
                all_timeseries.append([0.0])

        # Extract numeric matrix using discovered keys
        numeric_keys = numeric_keys[:_DIM_NUMERIC]  # Cap at dimension budget
        if numeric_keys:
            numeric_matrix = np.zeros((n, len(numeric_keys)), dtype=np.float32)
            for i, ent in enumerate(entities):
                attrs = self._parse_attrs(ent)
                for j, key in enumerate(numeric_keys):
                    val = attrs.get(key)
                    if isinstance(val, (int, float)):
                        numeric_matrix[i, j] = float(val)
                    else:
                        numeric_matrix[i, j] = np.nan
        else:
            numeric_matrix = np.zeros((n, 1), dtype=np.float32)

        # 3. Run sub-engines
        if self.text_proj:
            text_features = self.text_proj.transform(all_text)
            parts.append(text_features)

        if self.numeric_proj:
            numeric_features = self.numeric_proj.fit(numeric_matrix).transform(numeric_matrix)
            parts.append(numeric_features)

        if self.ts_proj and any(len(ts) > 1 for ts in all_timeseries):
            ts_features = self.ts_proj.transform(all_timeseries)
            parts.append(ts_features)
        elif self.ts_proj:
            parts.append(np.zeros((n, _DIM_TIMESERIES), dtype=np.float32))

        # 4. Graph projection (if edges provided)
        if self.graph_proj and edges:
            adjacency: dict[str, list[str]] = {}
            entity_names = [ent.get("name", f"entity_{i}") for i, ent in enumerate(entities)]
            for edge in edges:
                src = edge.get("source", "")
                tgt = edge.get("target", "")
                adjacency.setdefault(src, []).append(tgt)
                adjacency.setdefault(tgt, []).append(src)

            graph_features = self.graph_proj.transform(entity_names, adjacency)
            parts.append(graph_features)
        elif self.graph_proj:
            entity_names = [ent.get("name", f"entity_{i}") for i, ent in enumerate(entities)]
            parts.append(np.zeros((n, _DIM_GRAPH), dtype=np.float32))

        # 5. Concatenate all features
        combined = np.concatenate(parts, axis=1)

        # 6. Pad or truncate to embedding_dim
        current_dim = combined.shape[1]
        if current_dim < self.embedding_dim:
            padding = np.zeros((n, self.embedding_dim - current_dim), dtype=np.float32)
            combined = np.concatenate([combined, padding], axis=1)
        elif current_dim > self.embedding_dim:
            combined = combined[:, :self.embedding_dim]

        # 7. L2 normalize rows for stable kernel computation
        norms = np.linalg.norm(combined, axis=1, keepdims=True)
        norms = np.maximum(norms, 1e-8)
        combined = combined / norms

        return combined.astype(np.float32)
