"""Outlier scoring for inbound message traffic.

Applies the same shape of analytical move LO uses on CSV rows
(structural fingerprint + peer-rank against a baseline) to free-text
intelligence message traffic. The output is a single ``outlier_score``
in [0.0, 1.0] plus the list of fired signals.

The signals are deliberately interpretable rather than learned —
during a live sim the operator must be able to look at a flagged
message and immediately understand WHY it was flagged. Every signal
maps to a one-line explanation in the UI.

Signals (each contributes 0.0-0.2 to the score):
    novel_entity        — message names entities that have not been
                          seen before in the corpus + history
    rare_co_occurrence  — co-mentions a pair of entities that have not
                          been linked before, or are linked weakly
    sparse_topic        — touches an entity-type underrepresented in
                          recent traffic
    contradicts_kj      — directly contradicts a standing Key Judgment
                          (cheap heuristic: shared entity + opposing
                          confidence direction)
    length_anomaly      — message is unusually short or long relative
                          to the recent rolling baseline
    burst               — many messages in a short window from the
                          same source / channel
"""

from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass
from typing import Any

from app.services.nato_sim import db

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutlierScore:
    score: float          # in [0.0, 1.0]
    signals: list[str]    # short tags fired
    explanation: str      # human-readable one-liner


# Each signal contributes up to this much to the final score.
_SIGNAL_WEIGHT = {
    "novel_entity": 0.25,
    "rare_co_occurrence": 0.20,
    "sparse_topic": 0.10,
    "contradicts_kj": 0.25,
    "length_anomaly": 0.10,
    "burst": 0.10,
}


def _is_novel_entity(canonical_name: str) -> bool:
    row = db.query_one(
        "SELECT 1 FROM entities WHERE canonical_name = ? LIMIT 1",
        canonical_name,
    )
    return row is None


def _co_occurrence_weight(name_a: str, name_b: str) -> float:
    """Return the existing edge weight between two entities, 0 if none."""
    row = db.query_one(
        """
        SELECT MAX(weight) AS w FROM edges
        WHERE (from_entity = (SELECT id FROM entities WHERE canonical_name = ? LIMIT 1)
               AND to_entity = (SELECT id FROM entities WHERE canonical_name = ? LIMIT 1))
           OR (from_entity = (SELECT id FROM entities WHERE canonical_name = ? LIMIT 1)
               AND to_entity = (SELECT id FROM entities WHERE canonical_name = ? LIMIT 1))
        """,
        name_a, name_b, name_b, name_a,
    )
    return float(row["w"] or 0.0) if row and row["w"] is not None else 0.0


def _recent_message_lengths(limit: int = 50) -> list[int]:
    rows = db.query(
        "SELECT length(content) AS n FROM messages ORDER BY ts DESC LIMIT ?",
        limit,
    )
    return [int(r["n"]) for r in rows]


def _recent_burst(channel: str | None, window_seconds: int = 120) -> int:
    if not channel:
        return 0
    row = db.query_one(
        f"""
        SELECT COUNT(*) AS n FROM messages
        WHERE channel = ?
          AND ts > datetime('now', '-{window_seconds} seconds')
        """,
        channel,
    )
    return int(row["n"]) if row else 0


def _contradicts_standing_kj(canonical_names: list[str], content: str) -> bool:
    """Cheap contradiction detector.

    Looks at recent Key Judgments / Daily Read findings that mention any
    of the entities in this message. If a finding contains an INR
    "we assess" assertion and the message contains a polar opposite
    keyword pattern (deny, refute, contradicts, withdraw, halt vs
    advance, etc.), flag it. Crude but useful.
    """
    if not canonical_names:
        return False
    placeholders = ",".join("?" * len(canonical_names))
    rows = db.query(
        f"""
        SELECT text FROM findings
        WHERE kind IN ('daily-read', 'key-judgment', 'actor-card')
          AND superseded_by IS NULL
          AND ({"OR ".join(["text LIKE ?"] * len(canonical_names))})
        ORDER BY generated_at DESC LIMIT 5
        """,
        *[f"%{name}%" for name in canonical_names],
    )
    if not rows:
        return False
    content_lower = content.lower()
    contradiction_pairs = [
        ("advance", "withdraw"), ("withdraw", "advance"),
        ("escalate", "de-escalate"), ("de-escalate", "escalate"),
        ("invade", "halt"), ("denies", "confirms"),
        ("ceasefire", "resumed hostilities"), ("hold", "broken"),
        ("approves", "refuses"), ("refuses", "approves"),
    ]
    for r in rows:
        finding_lower = (r["text"] or "").lower()
        for a, b in contradiction_pairs:
            if a in finding_lower and b in content_lower:
                return True
    return False


def score_outlier(
    *,
    content: str,
    canonical_names: list[str],
    channel: str | None = None,
) -> OutlierScore:
    """Compute the outlier score and fired signals for a message."""
    signals: list[str] = []
    score = 0.0

    # 1. Novel entities
    novel_count = sum(1 for n in canonical_names if _is_novel_entity(n))
    if novel_count > 0:
        signals.append("novel_entity")
        # Cap contribution: 1 novel = 0.10, 2+ = full weight
        score += min(_SIGNAL_WEIGHT["novel_entity"], 0.10 * novel_count + 0.05)

    # 2. Rare co-occurrence
    if len(canonical_names) >= 2:
        pairs = [
            (canonical_names[i], canonical_names[j])
            for i in range(len(canonical_names))
            for j in range(i + 1, len(canonical_names))
        ]
        rare_pairs = sum(
            1 for a, b in pairs
            if _co_occurrence_weight(a, b) < 0.5
        )
        if rare_pairs > 0:
            signals.append("rare_co_occurrence")
            score += min(_SIGNAL_WEIGHT["rare_co_occurrence"], 0.05 * rare_pairs)

    # 3. Length anomaly
    lengths = _recent_message_lengths(limit=50)
    msg_len = len(content)
    if len(lengths) >= 5:
        try:
            median = statistics.median(lengths)
            stdev = statistics.stdev(lengths) or 1.0
            z = abs((msg_len - median) / stdev)
            if z >= 2.0:
                signals.append("length_anomaly")
                score += _SIGNAL_WEIGHT["length_anomaly"]
        except statistics.StatisticsError:
            pass

    # 4. Burst from same channel
    burst = _recent_burst(channel, window_seconds=120)
    if burst >= 5:
        signals.append("burst")
        score += _SIGNAL_WEIGHT["burst"]

    # 5. Contradicts standing Key Judgment
    if _contradicts_standing_kj(canonical_names, content):
        signals.append("contradicts_kj")
        score += _SIGNAL_WEIGHT["contradicts_kj"]

    # 6. Sparse topic — does this message touch an entity type that
    # hasn't been mentioned in last 30 messages?
    if canonical_names:
        type_rows = db.query(
            "SELECT DISTINCT type FROM entities WHERE canonical_name IN ("
            + ",".join("?" * len(canonical_names))
            + ")",
            *canonical_names,
        )
        msg_types = {r["type"] for r in type_rows}
        recent_type_rows = db.query(
            """
            SELECT DISTINCT e.type FROM messages m
            JOIN edges ed ON ed.evidence LIKE '%' || m.id || '%'
            JOIN entities e ON e.id = ed.from_entity OR e.id = ed.to_entity
            WHERE m.ts > datetime('now', '-1 hour')
            """
        )
        recent_types = {r["type"] for r in recent_type_rows}
        sparse = msg_types - recent_types
        if sparse:
            signals.append("sparse_topic")
            score += _SIGNAL_WEIGHT["sparse_topic"]

    score = max(0.0, min(1.0, score))

    explanation = _build_explanation(signals, msg_len)
    return OutlierScore(score=score, signals=signals, explanation=explanation)


_SIGNAL_PHRASES = {
    "novel_entity": "names an entity not previously in the corpus",
    "rare_co_occurrence": "links entities that have not been associated before",
    "sparse_topic": "touches an entity type that has been absent from recent traffic",
    "contradicts_kj": "appears to contradict a standing INR Key Judgment",
    "length_anomaly": "unusually short or long compared to the rolling baseline",
    "burst": "part of a sudden burst from the same channel",
}


def _build_explanation(signals: list[str], msg_len: int) -> str:
    if not signals:
        return f"baseline traffic ({msg_len} chars)"
    phrases = [_SIGNAL_PHRASES.get(s, s) for s in signals]
    return "; ".join(phrases)
