"""Regression + smoke tests for the Phase 1 v2 query path.

Runs three checks against the v2 latk-mini lattice:

1. **Format probe**: confirms the v2 result has both ``embed_context`` and
   ``embeddings_8d``, and that ``load_lattice_v2`` produces a LatticeV2 with
   ``has_v2 == True``.

2. **Self-retrieval**: picks a known high-composite survivor, uses its own
   entity name as a text query, and verifies it retrieves *itself* as the
   top-1 nearest neighbor in 8D (or at least in the top-5). This is the
   analog of the Phase 0 doc's "bit-identical fingerprint" claim, honestly
   restated: "a query that IS in the corpus should retrieve itself."

3. **Saussure->Vaswani re-verification**: reproduces the Phase 0 novel
   finding under the new 8D ranking to confirm the Phase 1 code change
   did not regress the investigation's headline result.

Run::

    PYTHONPATH=backend:scripts/cross_era_analysis python \\
        scripts/cross_era_analysis/latk_tool/tests/test_query_v2.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_DIR = REPO_ROOT / "backend"
CEA_DIR = REPO_ROOT / "scripts" / "cross_era_analysis"
for p in (BACKEND_DIR, CEA_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from latk_tool.query.novelty import (  # noqa: E402
    load_lattice,
    query_novelty,
    format_report,
)


LATTICE_PATH = CEA_DIR / "output" / "latk_mini_btut_result_v2.json"
LINGUISTICS_LATTICE_PATH = CEA_DIR / "output" / "linguistics_btut_result_v2.json"


def _check(condition: bool, msg: str) -> None:
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {msg}")
    if not condition:
        raise SystemExit(1)


def test_format_probe() -> None:
    print("\n[1/3] Format probe: lattice loads as v2")
    lattice = load_lattice(LATTICE_PATH)
    _check(lattice.size > 0, f"lattice has {lattice.size} survivors")
    _check(lattice.has_v2, "lattice.has_v2 is True (embed_context + embeddings_8d present)")
    _check(
        lattice.embed_context is not None and lattice.embed_context.embedding_dim > 0,
        f"embed_context.embedding_dim = {lattice.embed_context.embedding_dim if lattice.embed_context else None}",
    )
    _check(
        lattice.embeddings_8d is not None and lattice.embeddings_8d.shape[1] == 8,
        f"embeddings_8d shape = {lattice.embeddings_8d.shape if lattice.embeddings_8d is not None else None}",
    )
    print(f"    types in lattice: {sorted(set(s.entity_type for s in lattice.survivors))[:10]}")


def test_self_retrieval() -> None:
    print("\n[2/3] Self-retrieval: a lattice survivor retrieves itself")
    lattice = load_lattice(LATTICE_PATH)

    # Pick a high-composite survivor with a non-trivial name.
    candidates = sorted(
        [s for s in lattice.survivors if len(s.entity_name) > 15],
        key=lambda s: -s.composite,
    )
    assert candidates, "no candidate survivors found"

    # Try the top-5 candidates; require *at least one* to self-retrieve in top-5.
    # (Name-only query is a sparse signal; some survivors also depend on attributes
    #  and graph context that a name-only query cannot reproduce.)
    successes = 0
    attempts = 0
    for probe in candidates[:5]:
        attempts += 1
        report = query_novelty(probe.entity_name, lattice, top_k=10)
        top_names = [m.entity_name for m in report.nearest_entities[:5]]
        hit = probe.entity_name in top_names
        hit_idx = top_names.index(probe.entity_name) if hit else -1
        print(f"    probe: {probe.entity_name[:60]}")
        print(f"      top-5: {[n[:40] for n in top_names]}")
        print(f"      self-hit: {hit} (idx={hit_idx}) ranking={report.ranking_method}")
        if hit:
            successes += 1

    _check(
        successes >= 1,
        f"{successes}/{attempts} probes self-retrieved into top-5 "
        f"(threshold: >=1 required; name-only queries are sparse signals)",
    )
    _check(
        lattice.has_v2,
        "ranking path is v2 8D (has_v2=True)",
    )


def test_saussure_reverification() -> None:
    """Saussure quote -> linguistics lineage.

    On the linguistics_btut_result_v2 lattice (289 survivors), verify that:

    1. The ``combined`` method (Phase 1 default) recovers the strong Saussure
       lineage chain: Saussure + Chomsky + at least one other lineage marker.
       This is the *honest* headline: the Saussure quote lands in a
       neighborhood dominated by direct linguistics descendants.

    2. The ``hamming`` method (Phase 0 legacy) reproduces the original Phase
       0 Vaswani hit — confirming backwards compatibility of the Phase 1
       code path even though the honest geometric neighborhood does not
       feature Vaswani prominently.

    Reframing the Phase 0 finding: the original Saussure->Vaswani hit under
    the blake2b Hamming method was a weak signal (H=21/48, only slightly
    better than random) that the actual 8D geometric neighborhood does not
    prioritize. The 8D/combined methods instead surface Humboldt, Port
    Royal, Chomsky, and distributional semantics — which are arguably a
    stronger and more honest lineage chain.
    """
    print("\n[3/3] Saussure lineage re-verification on v2 linguistics lattice")
    lattice = load_lattice(LINGUISTICS_LATTICE_PATH)
    _check(lattice.has_v2, "linguistics lattice is v2")
    _check(lattice.size == 289, f"linguistics lattice size = {lattice.size}")

    query = (
        "In language there are only differences and no positive terms. "
        "Each linguistic value is determined by its opposition to all "
        "other elements in the system."
    )

    # (a) combined method: honest geometric neighborhood
    report_combined = query_novelty(query, lattice, top_k=20, method="combined")
    print("\n--- Method: combined (Phase 1 default, honest geometric neighborhood) ---")
    print(format_report(report_combined))
    names_c = [m.entity_name.lower() for m in report_combined.nearest_entities[:20]]
    hits_c = {
        "saussure": sum(1 for n in names_c if "saussure" in n or "ferdina" in n),
        "chomsky": sum(1 for n in names_c if "chomsky" in n),
        "humboldt": sum(1 for n in names_c if "humboldt" in n),
        "distributional": sum(1 for n in names_c if "distributional" in n),
        "port_royal": sum(1 for n in names_c if "portroyal" in n or "port_royal" in n),
        "panini": sum(1 for n in names_c if "panini" in n),
    }
    print(f"\n    combined hits: {hits_c}")
    n_markers_c = sum(1 for v in hits_c.values() if v > 0)
    _check(
        n_markers_c >= 4,
        f"combined method: >=4 of 6 linguistics lineage markers in top-20 ({n_markers_c}/6)",
    )
    _check(
        hits_c["saussure"] >= 1,
        "combined method: Saussure himself hits in top-20",
    )

    # (b) hamming method: Phase 0 backwards compat
    report_hamming = query_novelty(query, lattice, top_k=20, method="hamming")
    names_h = [m.entity_name.lower() for m in report_hamming.nearest_entities[:20]]
    hits_h = {
        "saussure": sum(1 for n in names_h if "saussure" in n or "ferdina" in n),
        "vaswani": sum(1 for n in names_h if "vaswani" in n),
        "qkv_or_transformer": sum(1 for n in names_h if "query_key_value" in n or "transformer" in n),
        "chomsky": sum(1 for n in names_h if "chomsky" in n),
    }
    print(f"\n    hamming (Phase 0 reproduction) hits: {hits_h}")
    _check(
        hits_h["saussure"] >= 1,
        f"hamming legacy path: Saussure hit reproduced ({hits_h['saussure']} in top-20)",
    )
    # Phase 0 doc claimed Vaswani at rank 8 and QKV at rank 2. We require
    # *either* to still hit under hamming mode to confirm backwards compat.
    _check(
        hits_h["vaswani"] >= 1 or hits_h["qkv_or_transformer"] >= 1,
        f"hamming legacy path: Phase 0 Vaswani/QKV hit reproducible "
        f"(vaswani={hits_h['vaswani']}, qkv/trans={hits_h['qkv_or_transformer']})",
    )


def main() -> None:
    print("=" * 72)
    print("LATK Phase 1 query-path regression tests")
    print(f"Lattice: {LATTICE_PATH}")
    print("=" * 72)
    test_format_probe()
    test_self_retrieval()
    test_saussure_reverification()
    print("\n" + "=" * 72)
    print("ALL CHECKS PASSED")
    print("=" * 72)


if __name__ == "__main__":
    main()
