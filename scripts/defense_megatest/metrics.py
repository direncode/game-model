"""Predictive validity metrics for the megatest.

All metrics here measure detection of *injected ground-truth anomalies*
in the survivor / top-k output of a ranker (BTUT or a baseline). They are
external-validity metrics, not internal-consistency metrics.
"""
from __future__ import annotations

from typing import Any


def precision_recall_f1(
    ranked_names: list[str],
    anomaly_names: set[str],
    k: int,
) -> dict[str, Any]:
    """Compute precision@k, recall@k, F1@k against an injected anomaly set.

    Args:
        ranked_names: list of entity names in rank order (most anomalous first)
        anomaly_names: set of names that are ground-truth anomalies
        k: cutoff rank (typically equal to len(anomaly_names))

    Returns:
        dict with precision, recall, f1, true_positives, false_positives,
        false_negatives, k, n_anomalies, n_ranked.
    """
    if k < 1:
        k = 1
    top_k = set(ranked_names[:k])
    tp = len(top_k & anomaly_names)
    fp = len(top_k - anomaly_names)
    fn = len(anomaly_names - top_k)

    precision = tp / max(1, len(top_k))
    recall = tp / max(1, len(anomaly_names))
    f1 = (2 * precision * recall) / max(1e-12, precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "k": k,
        "n_anomalies": len(anomaly_names),
        "n_ranked": len(ranked_names),
    }


def lift_vs_random(
    n_anomalies: int,
    n_total: int,
    n_recovered_in_top_k: int,
    k: int,
) -> float:
    """Multiplicative lift over random selection.

    A random ranker returns (k * n_anomalies / n_total) anomalies in expectation
    in its top-k. Observed recovery / expectation = lift.

    Lift of 1.0 = no better than random. Lift of 10.0 = 10x random.
    """
    if n_total <= 0 or k <= 0 or n_anomalies <= 0:
        return 0.0
    expected_random = (k * n_anomalies) / n_total
    if expected_random <= 0:
        return 0.0
    return round(n_recovered_in_top_k / expected_random, 3)


def recall_in_set(
    set_names: set[str],
    anomaly_names: set[str],
) -> dict[str, Any]:
    """Recall-in-set: how many anomalies are present in `set_names`.

    Models the analyst triage workflow: BTUT surfaces a survivor set, the
    analyst reviews each survivor. Did the anomaly make it to the analyst?
    """
    tp = len(set_names & anomaly_names)
    n_anom = len(anomaly_names)
    n_set = len(set_names)
    return {
        "in_set_count": tp,
        "n_anomalies": n_anom,
        "n_set": n_set,
        "recall_in_set": round(tp / max(1, n_anom), 4),
    }


def lift_in_set(
    n_anomalies: int,
    n_total: int,
    n_recovered_in_set: int,
    n_set: int,
) -> float:
    """Lift over random selection for the set-membership metric.

    Random selection of n_set entities from n_total expects
    (n_set * n_anomalies / n_total) anomalies in the set. Lift = observed/expected.
    """
    if n_total <= 0 or n_set <= 0 or n_anomalies <= 0:
        return 0.0
    expected = (n_set * n_anomalies) / n_total
    if expected <= 0:
        return 0.0
    return round(n_recovered_in_set / expected, 3)


def auroc(scores: list[float], labels: list[int]) -> float:
    """Area under ROC curve via the rank-sum (Mann-Whitney U) shortcut.

    AUROC = P(score(positive) > score(negative)) for randomly drawn pairs.
    Pure-Python, no sklearn dependency. Ties handled by averaging ranks.
    """
    if not scores or len(scores) != len(labels):
        return 0.5
    n_pos = sum(1 for x in labels if x == 1)
    n_neg = len(labels) - n_pos
    if n_pos == 0 or n_neg == 0:
        return 0.5

    indexed = sorted(enumerate(scores), key=lambda kv: kv[1])
    ranks = [0.0] * len(scores)
    i = 0
    while i < len(indexed):
        j = i
        while j + 1 < len(indexed) and indexed[j + 1][1] == indexed[i][1]:
            j += 1
        avg_rank = (i + j) / 2.0 + 1
        for m in range(i, j + 1):
            ranks[indexed[m][0]] = avg_rank
        i = j + 1

    sum_pos_ranks = sum(ranks[i] for i in range(len(labels)) if labels[i] == 1)
    u = sum_pos_ranks - n_pos * (n_pos + 1) / 2.0
    return round(u / (n_pos * n_neg), 4)


def summarize(
    btut_result: dict[str, Any],
    baseline_results: dict[str, dict[str, Any]],
    n_total: int,
    n_anomalies: int,
) -> dict[str, Any]:
    """Compose a comparison summary across BTUT and baselines.

    btut_result and each baseline_result must have 'precision', 'recall',
    'f1', 'true_positives' keys.
    """
    out = {
        "btut": btut_result,
        "baselines": baseline_results,
        "n_total": n_total,
        "n_anomalies": n_anomalies,
    }
    btut_recall = btut_result.get("recall", 0.0)
    out["btut_beats_all_baselines"] = all(
        btut_recall >= b.get("recall", 0.0) for b in baseline_results.values()
    ) if baseline_results else None
    return out
