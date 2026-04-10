"""Keyword discriminator for CET: classify documents into physics/math regimes.

This is the vocabulary-pattern analysis that achieved 96% classification accuracy
across wireless physics, cryptography, and information theory domains.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .corpus import CETConfig, DocumentEntry, load_document


@dataclass
class DocumentClassification:
    """Classification result for a single document."""
    doc_id: str
    title: str
    year: int | None
    expected_regime: str
    predicted_regime: str
    margin: float
    scores_by_regime: dict[str, float]
    word_count: int


def compute_regime_scores(
    text: str, config: CETConfig
) -> dict[str, float]:
    """Compute per-regime scores from keyword density.

    Score per regime = sum of all keyword group densities (per 1000 words),
    where a keyword group is a list of related terms describing one aspect
    of that regime's vocabulary.
    """
    text_lower = text.lower()
    word_count = max(len(text.split()), 1)

    regime_scores = {}
    for regime in config.regimes:
        total = 0
        for group_name, keywords in regime.keyword_groups.items():
            for kw in keywords:
                total += text_lower.count(kw.lower())
        regime_scores[regime.name] = round(total / word_count * 1000, 3)

    return regime_scores


def classify_document(
    doc: DocumentEntry, corpus_dir: Path, config: CETConfig
) -> DocumentClassification | None:
    """Classify a single document into its most likely regime."""
    try:
        text = load_document(doc, corpus_dir)
    except FileNotFoundError:
        return None

    scores = compute_regime_scores(text, config)
    if not scores:
        return None

    sorted_scores = sorted(scores.items(), key=lambda x: -x[1])
    predicted = sorted_scores[0][0]
    top = sorted_scores[0][1]
    second = sorted_scores[1][1] if len(sorted_scores) > 1 else 0.0

    margin = top / max(second, 0.001) if top > 0 else 0.0

    return DocumentClassification(
        doc_id=doc.id,
        title=doc.title,
        year=doc.year,
        expected_regime=doc.regime,
        predicted_regime=predicted,
        margin=margin,
        scores_by_regime=scores,
        word_count=len(text.split()),
    )


def classify_corpus(
    config: CETConfig, corpus_dir: Path
) -> list[DocumentClassification]:
    """Classify every document in the corpus."""
    results = []
    for doc in config.documents:
        result = classify_document(doc, corpus_dir, config)
        if result:
            results.append(result)
    return results


def classification_accuracy(
    classifications: list[DocumentClassification],
) -> tuple[int, int, float]:
    """Compute overall classification accuracy.

    Returns (correct_count, total_count, accuracy_percentage).
    """
    total = len(classifications)
    correct = sum(
        1 for c in classifications if c.predicted_regime == c.expected_regime
    )
    accuracy = (correct / total * 100) if total > 0 else 0.0
    return correct, total, accuracy
