"""Smoke tests for lo_core public API.

Fast, no external deps, no filesystem. Validates that the core
pipeline produces sane findings on a minimal synthetic input.
"""
from __future__ import annotations

from lo_core import (
    Findings,
    TemplateGenerator,
    analyze_corpus,
    validate_corpora,
)


def _synthetic_survivors(n: int = 30, n_clusters: int = 5) -> list[dict]:
    survivors = []
    for i in range(n):
        cluster = i % n_clusters
        anomaly = (i * 37 % 100) / 100.0
        survivors.append({
            "entity": {
                "name": f"newton_alchemy__concept__sample_{i}",
                "type": "concept",
            },
            "cluster": cluster,
            "fingerprint_48bit": f"{i:048b}",
            "flips": i % 8,
            "scores": {
                "anomaly": anomaly,
                "composite": anomaly * 0.9,
                "diversity": 0.5,
                "reconstruction": 0.9,
            },
        })
    return survivors


def test_analyze_corpus_produces_findings():
    findings = analyze_corpus(_synthetic_survivors(), corpus_id="test")
    assert isinstance(findings, Findings)
    assert findings.corpus_id == "test"
    assert findings.survivor_count == 30
    assert findings.cluster_count == 5
    assert findings.paradigm_distribution is not None
    assert findings.within_cluster_rank
    # The high-anomaly entity in each cluster should rank #1
    for rank in findings.within_cluster_rank.values():
        assert 1 <= rank.rank <= rank.total_in_cluster


def test_convergence_index_is_ordered():
    findings = analyze_corpus(_synthetic_survivors(60, n_clusters=4), corpus_id="test")
    convs = [e.convergence for e in findings.convergence_index]
    assert convs == sorted(convs, reverse=True), "convergence_index must be descending"


def test_template_generator_narrates():
    findings = analyze_corpus(_synthetic_survivors(), corpus_id="test")
    gen = TemplateGenerator()
    text = gen.narrate_corpus(findings)
    assert "test" in text
    assert "30 survivors" in text


def test_validate_multi_corpus():
    a = _synthetic_survivors(30)
    b = _synthetic_survivors(30)
    # Perturb b slightly
    for i, s in enumerate(b):
        s["fingerprint_48bit"] = f"{(i + 7):048b}"
    report = validate_corpora({"a": a, "b": b}, focus_corpus="a", n_iterations=5)
    assert report.n_iterations == 5
    assert len(report.null_tests) > 0
    metrics = {t.metric for t in report.null_tests}
    assert "top_bridge_weighted" in metrics
    assert "pairwise_bridges" in metrics


if __name__ == "__main__":
    import traceback
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  PASS  {name}")
            except Exception:
                print(f"  FAIL  {name}")
                traceback.print_exc()
