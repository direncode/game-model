"""Receipt-hash derivation primitive.

Concatenation order is the single source of truth for both the Python operator
script (scripts/receipt_run.py) and the TypeScript browser verifier
(frontend/lib/receipt/verify.ts). Any change to this function MUST be matched
in BOTH implementations or the chain breaks.

Hash algorithm: SHA-256 over UTF-8 bytes.
Field separator: pipe character "|".
Genesis sentinel: literal string "GENESIS" when prev_receipt_hash is None.
Field order: prev_receipt_hash | prompt_hash | schema_hash | corpus_sha256 | model_id | timestamp | output_sha256
"""
from __future__ import annotations

import hashlib


GENESIS = "GENESIS"


def derive_concat(
    *,
    prev_receipt_hash: str | None,
    prompt_hash: str,
    schema_hash: str,
    corpus_sha256: str,
    model_id: str,
    timestamp: str,
    output_sha256: str,
) -> str:
    """Build the canonical concatenation string. SHA-256 over the UTF-8 bytes
    of this string is the receipt_hash."""
    return "|".join([
        prev_receipt_hash if prev_receipt_hash is not None else GENESIS,
        prompt_hash,
        schema_hash,
        corpus_sha256,
        model_id,
        timestamp,
        output_sha256,
    ])


def derive_hash(
    *,
    prev_receipt_hash: str | None,
    prompt_hash: str,
    schema_hash: str,
    corpus_sha256: str,
    model_id: str,
    timestamp: str,
    output_sha256: str,
) -> str:
    """Receipt hash = sha256(canonical concatenation, UTF-8) as lowercase hex."""
    concat = derive_concat(
        prev_receipt_hash=prev_receipt_hash,
        prompt_hash=prompt_hash,
        schema_hash=schema_hash,
        corpus_sha256=corpus_sha256,
        model_id=model_id,
        timestamp=timestamp,
        output_sha256=output_sha256,
    )
    return hashlib.sha256(concat.encode("utf-8")).hexdigest()
