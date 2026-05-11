"""Free-tier embed operators.

Each embedder is deterministic at seed and produces a normalized matrix Z.
Classes here are self-contained; they do NOT depend on the @register
decorator framework. The module-level `_REGISTRY` maps operator-kind names
to instances; the runner pulls from this dict.

Proprietary embedders (e.g. embed.content_fp48) live only on
api.latentocean.com and are NOT shipped here. The ocean_cli package
registers stub instances under those names at import time via
ocean_cli._premium_stubs.register_premium_stubs.
"""
from __future__ import annotations

from typing import Any


class TfIdfJLEmbedder:
    """Text -> TF-IDF (uni+bigrams, sublinear) -> JL projection -> L2-normalize.

    config:
        dims:         int   - projection dim (default 128)
        max_features: int   - TF-IDF vocab cap (default 10000)
        min_df:       int   - term must appear in this many docs (default 2)
        max_df:       float - drop terms more common than this (default 0.85)
    """

    kind = "embed.tfidf_jl"
    stage = "embed"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        import numpy as np
        from sklearn.feature_extraction.text import TfidfVectorizer

        config = config or {}
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


class MinilmL6Embedder:
    """Text -> sentence-transformers MiniLM-L6-v2 -> mean-pool -> L2-normalize.

    config:
        max_length: int - token truncation cap (default 128)
        batch_size: int - records per forward pass (default 16)
        model_name: str - sentence-transformers model id (default 'sentence-transformers/all-MiniLM-L6-v2')
    """

    kind = "embed.transformer.minilm_l6"
    stage = "embed"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        import numpy as np

        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as e:
            raise RuntimeError(
                "embed.transformer.minilm_l6 requires the optional 'sentence-transformers' "
                "package. Install it with `pip install sentence-transformers`, or use "
                "embed.tfidf_jl which has no extra dependencies."
            ) from e

        config = config or {}
        records = inputs["records"]
        text_field = inputs.get("text_field", "text")
        model_name = config.get("model_name", "sentence-transformers/all-MiniLM-L6-v2")
        batch_size = int(config.get("batch_size", 16))

        model = SentenceTransformer(model_name)
        texts = [
            ((r.get("title", "") or "") + ". " + (r.get(text_field, "") or "")).strip()
            for r in records
        ]
        Z = model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
        ).astype(np.float32)
        return {
            "Z": Z,
            "embedder": "transformer:minilm-L6-v2",
            "dims": int(Z.shape[1]),
            "model": model_name,
        }


class OneHotNumericEmbedder:
    """Numeric/categorical attrs -> one-hot -> standardize -> JL -> L2-normalize.

    config:
        dims:           int       - projection dim (default 64)
        categorical:    list[str] - attribute names to one-hot encode
        attribute_path: str       - record key holding the attribute dict
                                    (default 'attributes')
    """

    kind = "embed.one_hot_numeric"
    stage = "embed"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        import numpy as np
        import pandas as pd

        config = config or {}
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
        cat_cols = [c for c in (list(categorical) + ["__type"]) if c in df.columns]
        df = pd.get_dummies(df, columns=cat_cols, drop_first=False)
        df = df.select_dtypes(include=["number", "bool"]).astype(np.float32)
        X = df.to_numpy()
        X = (X - X.mean(0)) / (X.std(0) + 1e-8)
        rng = np.random.default_rng(seed)
        proj = rng.standard_normal((X.shape[1], dims)).astype(np.float32) / np.sqrt(dims)
        Z = X @ proj
        Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)
        return {
            "Z": Z,
            "embedder": "one_hot_numeric",
            "dims": dims,
            "feature_count": int(X.shape[1]),
        }


# ── Per-module registry ──────────────────────────────────────────────────

_REGISTRY: dict[str, Any] = {
    "embed.tfidf_jl":               TfIdfJLEmbedder(),
    "embed.transformer.minilm_l6":  MinilmL6Embedder(),
    "embed.one_hot_numeric":        OneHotNumericEmbedder(),
}


def get(name: str):
    """Return the operator instance registered under `name`, or None."""
    return _REGISTRY.get(name)
