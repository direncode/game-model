"""Pre-warm the stage-4 embedding cache.

Run once after any ontology change to avoid a cold-start delay on the
first query. The cache is disk-based, keyed by ontology content, so
editing lo_nlp/data/*.json invalidates it automatically on next build.

Usage:
    python -m lo_nlp.build_embeddings
    python -m lo_nlp.build_embeddings --model all-MiniLM-L6-v2

If sentence-transformers / numpy is missing, exits with a clear message.
"""
from __future__ import annotations

import argparse
import sys
import time

from lo_nlp.resolve import (
    EMBED_MODEL_DEFAULT,
    Resolver,
    _HAS_EMBEDDINGS,
)


def main() -> int:
    ap = argparse.ArgumentParser(description="Pre-warm embedding cache for lo_nlp.Resolver")
    ap.add_argument("--model", default=EMBED_MODEL_DEFAULT)
    args = ap.parse_args()

    if not _HAS_EMBEDDINGS:
        print("sentence-transformers / numpy not available; install with:")
        print("    pip install sentence-transformers numpy")
        return 2

    r = Resolver(enable_embeddings=True, embed_model_name=args.model)
    t0 = time.time()
    ok = r._maybe_build_embeddings()
    dt = time.time() - t0
    if not ok:
        print("embedding build failed")
        return 3
    n_docs = r._embed_matrix.shape[0] if r._embed_matrix is not None else 0
    dim = r._embed_matrix.shape[1] if r._embed_matrix is not None else 0
    print(f"built {n_docs} embeddings ({dim}-dim) in {dt:.1f}s; cached at {r._cache_path()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
