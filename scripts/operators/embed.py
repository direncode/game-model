"""Embed operators — records → Z (matrix) ∈ ℝ^{N×D}, L2-normalized.

Each embedder is deterministic at seed and produces a normalized matrix
suitable for the TCD recursive loop's energy function. New embedders go
here; the runner picks one via config.
"""
from __future__ import annotations

import hashlib
from typing import Any

from . import Operator, register


@register
class TfIdfJLEmbedder(Operator):
    """Text → TF-IDF (uni+bigrams, sublinear) → JL random projection → L2-normalize.

    Validated on TNA HW catalogue (2,169 records, 17 archives).

    config:
        dims:        int — projection dim (default 128)
        max_features: int — TF-IDF vocab cap (default 10000)
        min_df:      int — term must appear in this many docs (default 2)
        max_df:      float — drop terms more common than this (default 0.85)
    """
    kind = "embed.tfidf_jl"
    stage = "embed"

    def run(self, inputs, *, seed, config):
        import numpy as np
        from sklearn.feature_extraction.text import TfidfVectorizer

        records = inputs["records"]
        text_field = inputs.get("text_field", "text")
        dims = config.get("dims", 128)

        texts = [r.get(text_field, "") or r.get("title", "") for r in records]
        vec = TfidfVectorizer(
            max_features=config.get("max_features", 10_000),
            ngram_range=(1, 2),
            min_df=config.get("min_df", 2),
            max_df=config.get("max_df", 0.85),
            stop_words="english",
            lowercase=True,
            sublinear_tf=True,
            token_pattern=r"(?u)\b[a-z][a-z'-]+\b",
        )
        X = vec.fit_transform(texts).astype(np.float32).toarray()
        rng = np.random.default_rng(seed)
        proj = rng.standard_normal((X.shape[1], dims)).astype(np.float32) / np.sqrt(dims)
        Z = X @ proj
        Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)
        return {"Z": Z, "embedder": "tfidf_jl", "dims": dims, "vocab_size": X.shape[1]}


@register
class OneHotNumericEmbedder(Operator):
    """Numeric/categorical attributes → one-hot expansion → standardize → JL → L2.

    Validated on NSL-KDD intrusion flows (9,000 records, 3 protocols).

    config:
        dims:           int — projection dim (default 64)
        categorical:    list[str] — attribute names to one-hot encode
        attribute_path: str — record key holding the attribute dict (default 'attributes')
    """
    kind = "embed.onehot_numeric"
    stage = "embed"

    def run(self, inputs, *, seed, config):
        import numpy as np
        import pandas as pd

        records = inputs["records"]
        dims = config.get("dims", 64)
        categorical = config.get("categorical", [])
        attr_path = config.get("attribute_path", "attributes")

        rows = []
        for r in records:
            attrs = r.get(attr_path, {}) if attr_path else r
            row = dict(attrs)
            row["__type"] = r.get("type", "?")
            rows.append(row)
        df = pd.DataFrame(rows)
        cat_cols = [c for c in (categorical + ["__type"]) if c in df.columns]
        df = pd.get_dummies(df, columns=cat_cols, drop_first=False)
        # Coerce non-numeric to numeric (drop strings that didn't get one-hotted)
        df = df.select_dtypes(include=["number", "bool"]).astype(np.float32)
        X = df.to_numpy()
        X = (X - X.mean(0)) / (X.std(0) + 1e-8)
        rng = np.random.default_rng(seed)
        proj = rng.standard_normal((X.shape[1], dims)).astype(np.float32) / np.sqrt(dims)
        Z = X @ proj
        Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)
        return {"Z": Z, "embedder": "onehot_numeric", "dims": dims, "feature_count": X.shape[1]}


@register
class TransformerEmbedder(Operator):
    """Text → MiniLM-L6 transformer embedding → mean-pool → L2-normalize.

    Validated on TNA HW catalogue: same OCEAN program, swapping this in for
    embed.tfidf_jl flips HW1 (directorate_to_pm) self-basin from 0.000 to
    0.769 — a clean demonstration that the substrate architecture is
    embedder-composable and that the embedder choice is load-bearing.

    See data/validation/tna_dispersion_transformer_seed42.json for the
    reproducible artifact.

    Implementation: pure-torch BERT forward pass (no transformers library
    dependency). Model is sentence-transformers/all-MiniLM-L6-v2 — 22.7M
    params, 6 layers, 384-dim. Downloaded once via huggingface_hub or
    direct urllib fallback, cached locally.

    config:
        max_length: int   — token truncation cap (default 128)
        batch_size: int   — records per forward pass (default 16)
    """
    kind = "embed.transformer"
    stage = "embed"

    def run(self, inputs, *, seed, config):
        from ._minibert import ensure_minilm, MiniBert

        records    = inputs["records"]
        text_field = inputs.get("text_field", "text")
        max_len    = int(config.get("max_length", 128))
        batch      = int(config.get("batch_size", 16))

        snapshot = ensure_minilm()
        bert     = MiniBert.from_snapshot(snapshot)

        texts = [
            (r.get("title", "") + ". " + r.get(text_field, "")).strip()
            for r in records
        ]
        Z = bert.embed_texts(texts, snapshot, max_length=max_len, batch_size=batch)
        return {
            "Z": Z,
            "embedder": "transformer:minilm-L6-v2",
            "dims": int(Z.shape[1]),
            "model_params_m": 22.7,
            "snapshot": str(snapshot),
        }


@register
class ContentFp48Embedder(Operator):
    """Promote DocSouth's content_fp48 primitive to the universal lib.

    Each record's top-K TF-IDF terms hash into a 48-bit Bloom-style
    fingerprint (3 bit positions per term). Records with overlapping top
    terms produce fp48s with low Hamming distance. Useful as a CONTENT
    fingerprint variant alongside the structural fingerprint.

    Output is integer fp48s, not a float matrix. Pair with downstream
    operators that consume bit-vectors (Hamming-based clustering).

    config:
        top_k_terms: int — number of TF-IDF terms per record to hash (default 32)
        max_features: int — TF-IDF vocab cap (default 10000)
    """
    kind = "embed.content_fp48"
    stage = "embed"

    def run(self, inputs, *, seed, config):
        import numpy as np
        from sklearn.feature_extraction.text import TfidfVectorizer

        records = inputs["records"]
        text_field = inputs.get("text_field", "text")
        top_k = config.get("top_k_terms", 32)

        texts = [r.get(text_field, "") for r in records]
        vec = TfidfVectorizer(
            max_features=config.get("max_features", 10_000),
            stop_words="english",
            lowercase=True,
            token_pattern=r"(?u)\b[a-z][a-z'-]+\b",
        )
        X = vec.fit_transform(texts)
        terms = np.array(vec.get_feature_names_out())
        fps = []
        for i in range(X.shape[0]):
            row = X.getrow(i)
            if row.nnz == 0:
                fps.append(0)
                continue
            top_idx = row.toarray().ravel().argsort()[-top_k:][::-1]
            top_terms = terms[top_idx]
            fps.append(_hash_terms_to_fp48(top_terms))
        return {"fp48s": np.array(fps, dtype=np.uint64), "top_k_terms": top_k}


def _hash_terms_to_fp48(terms) -> int:
    """Bloom-style: each term sets 3 bits of a 48-bit fingerprint."""
    fp = 0
    for t in terms:
        h = hashlib.sha256(t.encode("utf-8")).digest()
        for off in (0, 2, 4):
            pos = int.from_bytes(h[off:off + 2], "big") % 48
            fp |= (1 << pos)
    return fp & 0xFFFFFFFFFFFF


@register
class NumericDirectEmbedder(Operator):
    """Named numeric fields → Z, per-feature z-scored, no projection.

    Use when records already carry pre-computed numeric features that
    should reach the substrate unchanged in dimension and direction. Unlike
    one-hot/tfidf embedders, this operator does NOT L2-normalize rows —
    preserving per-feature magnitude differences that downstream substrate
    energy depends on (e.g. spike-like features in bathymetry tiles).

    First used by /mine-sweep showcase (4 bathymetry features per tile).
    The companion .ocean syntax `embed numeric features [...]` lives in
    scripts/operators/ocean/lexer.py + parser.py — see the extension notes
    at pipelines/mine_sweep.ocean.extension_notes.md.

    config:
        fields:         list[str] — record field names to pull as features
        attribute_path: str       — record key holding the field dict
                                    (default '' meaning top-level of record)
        l2_normalize:   bool      — opt-in L2 row-normalization
                                    (default False, preserves magnitudes)
    """
    kind = "embed.numeric_direct"
    stage = "embed"

    def run(self, inputs, *, seed, config):
        import numpy as np

        records = inputs["records"]
        fields  = config.get("fields")
        if not fields or not isinstance(fields, list):
            raise ValueError(
                "embed.numeric_direct requires config['fields'] as a non-empty list of field names"
            )
        attr_path = config.get("attribute_path", "")

        def extract(r):
            src = r.get(attr_path, r) if attr_path else r
            row = []
            for f in fields:
                v = src.get(f)
                if v is None or (isinstance(v, float) and (v != v)):  # None or NaN
                    raise ValueError(
                        f"record missing or NaN-valued required feature {f!r}; "
                        f"upstream feature extractor must drop these"
                    )
                row.append(float(v))
            return row

        X = np.asarray([extract(r) for r in records], dtype=np.float32)
        # Per-feature z-score across the corpus.
        mean = X.mean(axis=0)
        std  = X.std(axis=0)
        Z = (X - mean) / (std + 1e-8)

        if config.get("l2_normalize", False):
            Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)

        return {
            "Z":             Z.astype(np.float32),
            "embedder":      "numeric_direct",
            "dims":          int(Z.shape[1]),
            "fields":        list(fields),
            "feature_mean":  mean.tolist(),
            "feature_std":   std.tolist(),
            "l2_normalized": bool(config.get("l2_normalize", False)),
        }
