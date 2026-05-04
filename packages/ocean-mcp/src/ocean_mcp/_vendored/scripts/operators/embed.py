# ─────────────────────────────────────────────────────────
# This file ships in ocean-mcp on PyPI / npm.
# Premium operator implementations have been stripped from
# this build and replaced with stubs in ocean_mcp._premium_stubs.
# Premium operators run only on api.latentocean.com.
# Stripped classes from this file: ContentFp48Embedder
# ─────────────────────────────────────────────────────────

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
    kind = 'embed.tfidf_jl'
    stage = 'embed'

    def run(self, inputs, *, seed, config):
        import numpy as np
        from sklearn.feature_extraction.text import TfidfVectorizer
        records = inputs['records']
        text_field = inputs.get('text_field', 'text')
        dims = config.get('dims', 128)
        texts = [r.get(text_field, '') or r.get('title', '') for r in records]
        vec = TfidfVectorizer(max_features=config.get('max_features', 10000), ngram_range=(1, 2), min_df=config.get('min_df', 2), max_df=config.get('max_df', 0.85), stop_words='english', lowercase=True, sublinear_tf=True, token_pattern="(?u)\\b[a-z][a-z'-]+\\b")
        X = vec.fit_transform(texts).astype(np.float32).toarray()
        rng = np.random.default_rng(seed)
        proj = rng.standard_normal((X.shape[1], dims)).astype(np.float32) / np.sqrt(dims)
        Z = X @ proj
        Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-08)
        return {'Z': Z, 'embedder': 'tfidf_jl', 'dims': dims, 'vocab_size': X.shape[1]}

@register
class OneHotNumericEmbedder(Operator):
    """Numeric/categorical attributes → one-hot expansion → standardize → JL → L2.

    Validated on NSL-KDD intrusion flows (9,000 records, 3 protocols).

    config:
        dims:           int — projection dim (default 64)
        categorical:    list[str] — attribute names to one-hot encode
        attribute_path: str — record key holding the attribute dict (default 'attributes')
    """
    kind = 'embed.onehot_numeric'
    stage = 'embed'

    def run(self, inputs, *, seed, config):
        import numpy as np
        import pandas as pd
        records = inputs['records']
        dims = config.get('dims', 64)
        categorical = config.get('categorical', [])
        attr_path = config.get('attribute_path', 'attributes')
        rows = []
        for r in records:
            attrs = r.get(attr_path, {}) if attr_path else r
            row = dict(attrs)
            row['__type'] = r.get('type', '?')
            rows.append(row)
        df = pd.DataFrame(rows)
        cat_cols = [c for c in categorical + ['__type'] if c in df.columns]
        df = pd.get_dummies(df, columns=cat_cols, drop_first=False)
        df = df.select_dtypes(include=['number', 'bool']).astype(np.float32)
        X = df.to_numpy()
        X = (X - X.mean(0)) / (X.std(0) + 1e-08)
        rng = np.random.default_rng(seed)
        proj = rng.standard_normal((X.shape[1], dims)).astype(np.float32) / np.sqrt(dims)
        Z = X @ proj
        Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-08)
        return {'Z': Z, 'embedder': 'onehot_numeric', 'dims': dims, 'feature_count': X.shape[1]}

def _hash_terms_to_fp48(terms) -> int:
    """Bloom-style: each term sets 3 bits of a 48-bit fingerprint."""
    fp = 0
    for t in terms:
        h = hashlib.sha256(t.encode('utf-8')).digest()
        for off in (0, 2, 4):
            pos = int.from_bytes(h[off:off + 2], 'big') % 48
            fp |= 1 << pos
    return fp & 281474976710655