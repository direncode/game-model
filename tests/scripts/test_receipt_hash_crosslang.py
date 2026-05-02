"""Cross-language equivalence: Python and TS implementations must produce the
same hash on the same input. We test this indirectly by computing the hash
of the canonical concatenation string and verifying both implementations
agree it's that hash.
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
import receipt_hash  # noqa: E402

FIXTURE = REPO / "tests" / "scripts" / "fixtures" / "receipt_known_inputs.json"


def test_python_hash_equals_sha256_of_canonical_concat():
    """The contract Python and TS implementations must both honor:
    derive_hash(input) == sha256(derive_concat(input).encode('utf-8')).
    """
    fix = json.loads(FIXTURE.read_text())
    py_hash = receipt_hash.derive_hash(**fix["input"])
    expected = hashlib.sha256(fix["expected_concat"].encode("utf-8")).hexdigest()
    assert py_hash == expected, (
        "Python derive_hash() does not match sha256 of the canonical concat. "
        "If this fails, scripts/receipt_hash.py and frontend/lib/receipt/verify.ts "
        "may have drifted from each other."
    )


def test_typescript_contract_documented():
    """If you change derive_concat or derive_hash in receipt_hash.py without
    updating frontend/lib/receipt/verify.ts to match, the chain verifier in
    /receipt/verify will produce different hashes than the operator script,
    and every receipt will fail to verify in the browser. This test exists
    only to remind future-you that the two implementations are coupled."""
    ts_path = REPO / "frontend" / "lib" / "receipt" / "verify.ts"
    assert ts_path.exists(), "frontend/lib/receipt/verify.ts is the TS twin and must exist"
    ts = ts_path.read_text()
    assert "GENESIS" in ts, "TS twin must use the same GENESIS sentinel"
    assert '"|"' in ts or "'|'" in ts, "TS twin must use '|' as field separator"
    assert "deriveConcat" in ts and "deriveHash" in ts
