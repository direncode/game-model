"""Gap scanner — identifies analytical gaps and recommends IC tasking.

Looks at current findings (Daily Read judgments, Country Cards, Watchboard
items, Dissents) and identifies where the analyst's confidence is low or
the evidence is single-source. For each candidate gap, calls the LLM with
the IC agency-capability reference (``judgment/agency_capabilities``) to
recommend:

  - which agencies are best-positioned to fill the gap
  - what specific collection to ask for
  - priority (HIGH / MEDIUM / LOW)

Persists each gap to ``gap_analyses``. Idempotent on (topic, related_finding_id).
"""

from __future__ import annotations

import json
import logging
import re

from app.services.nato_sim import db
from app.services.nato_sim.judgment import (
    IC_AGENCIES,
    get_inr_voice,
    render_agency_directory,
)
from app.services.nato_sim.llm import llm_call

logger = logging.getLogger(__name__)


_AGENCY_KEYS = list(IC_AGENCIES.keys())


def _gap_candidates() -> list[dict[str, str]]:
    """Identify gap candidates from BOTH findings and outlier messages.

    The outlier system is the primary driver — anomalous traffic IS the
    operationally-actionable signal that something is happening we can't
    yet explain. Findings-based candidates supplement it with the
    analyst's own confidence calibration.

    Heuristics:
      A) FINDING-DRIVEN
         - confidence = LOW on any finding (always a gap)
         - confidence = MEDIUM on watchboard items (need promote/demote signals)
         - dissents (always indicate competing reads worth resolving)
      B) OUTLIER-DRIVEN
         - messages with outlier_score >= 0.5 AND signal in
           {novel_entity, contradicts_kj, rare_co_occurrence, sparse_topic}
         - duplicates collapsed by topic key derived from message content
    """
    out: list[dict[str, str]] = []

    # A) Finding-driven candidates ─────────────────────────────────────
    rows = db.query(
        """
        SELECT id, topic, kind, text, confidence, citations
        FROM findings
        WHERE superseded_by IS NULL
        AND (
            confidence = 'LOW'
            OR (confidence = 'MEDIUM' AND kind = 'watchboard-item')
            OR kind = 'dissent'
        )
        ORDER BY generated_at DESC
        LIMIT 20
        """
    )
    for r in rows:
        d = db.row_to_dict(r) or {}
        out.append(
            {
                "finding_id": d["id"],
                "topic": d["topic"] or "",
                "kind": d["kind"] or "",
                "text": d["text"] or "",
                "confidence": d.get("confidence") or "LOW",
                "citations": d.get("citations") or [],
                "driver": "finding",
            }
        )

    # B) Outlier-driven candidates ─────────────────────────────────────
    # The outlier_signals column is comma-separated; we want messages
    # whose signals indicate the message itself can't yet be explained
    # by the standing assessment.
    outlier_rows = db.query(
        """
        SELECT id, content, source, channel, author, ts,
               outlier_score, outlier_signals
        FROM messages
        WHERE outlier_score >= 0.5
        AND (
            outlier_signals LIKE '%novel_entity%'
            OR outlier_signals LIKE '%contradicts_kj%'
            OR outlier_signals LIKE '%rare_co_occurrence%'
            OR outlier_signals LIKE '%sparse_topic%'
        )
        ORDER BY outlier_score DESC, ts DESC
        LIMIT 15
        """
    )
    seen_topics: set[str] = set()
    for r in outlier_rows:
        d = db.row_to_dict(r) or {}
        # Dedupe by first ~60 chars of content as a coarse topic key.
        content = d.get("content") or ""
        topic_key = content[:60].strip().lower()
        if topic_key in seen_topics:
            continue
        seen_topics.add(topic_key)

        title = (content[:80].split("\n")[0]).strip() or "anomalous traffic"
        signals = d.get("outlier_signals") or ""
        score_pct = int((d.get("outlier_score") or 0) * 100)
        out.append(
            {
                "finding_id": d["id"],  # we link gap → message id here
                "topic": f"Outlier: {title}",
                "kind": "outlier-message",
                "text": (
                    f"OUTLIER MESSAGE (score {score_pct}, signals: {signals})\n"
                    f"Source: {d.get('source')}"
                    f"{' / ' + d['channel'] if d.get('channel') else ''}"
                    f"{' / ' + d['author'] if d.get('author') else ''}\n\n"
                    f"{content[:1800]}"
                ),
                "confidence": "LOW",
                "citations": [],
                "driver": "outlier",
            }
        )

    return out


_GAP_SYSTEM = (
    get_inr_voice()
    + "\n\n"
    + render_agency_directory()
    + "\n\n"
    + """# Gap Analysis Task

You are evaluating a single analytical finding for unresolved evidence
gaps. Output STRICT JSON (no prose, no markdown fences) matching this
schema:

{
  "why_a_gap": "one or two sentences naming the specific evidence gap",
  "recommended_agencies": ["CIA", "DIA", ...],   # subset of allowed keys
  "specific_collection": "concrete collection ask for those agencies",
  "priority": "HIGH" | "MEDIUM" | "LOW"
}

Rules:
- ``recommended_agencies`` must be 1-3 keys from the IC Agency Capability
  Reference above. Keys must match exactly: CIA, DIA, NSA, NGA, NRO, FBI,
  Treasury, Energy, EUCOM-J2, NATO-NIFC, INR-internal.
- ``specific_collection`` is a single tasking ask in plain English. Be
  concrete: name the place, the actor, the indicator. Example:
    "NGA — 6-hour revisit imagery on Brest, Belarus armor staging.
     DIA — JIPOE update on Russian armor disposition within 80 km
     of the Suwałki corridor."
- ``priority`` reflects how much the gap matters relative to the
  scenario stakes: HIGH if filling the gap could promote/demote a
  watchboard line or change a Key Judgment; MEDIUM if it sharpens an
  ongoing assessment; LOW if it's housekeeping.
- ``why_a_gap`` is one or two sentences naming the specific evidence
  shortfall. Avoid generic statements. Reference the finding's topic.

Output ONLY the JSON object."""
)


def _extract_json(text: str) -> str:
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        return text
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("no JSON object")
    return m.group(0)


async def _generate_recommendation(cand: dict[str, str]) -> dict[str, object] | None:
    user = (
        f"Finding kind: {cand['kind']}\n"
        f"Topic: {cand['topic']}\n"
        f"Confidence: {cand['confidence']}\n"
        f"Sourcing: {len(cand['citations']) if isinstance(cand['citations'], list) else 'unknown'} citations\n\n"
        f"Finding text:\n{cand['text'][:2400]}\n\n"
        "Identify the gap, recommend agencies, and propose specific collection."
    )
    res = await llm_call(
        user,
        system=_GAP_SYSTEM,
        model="deep",
        temperature=0.2,
        max_tokens=600,
    )
    try:
        parsed = json.loads(_extract_json(res.text))
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("gap parse failed for %s: %s", cand["topic"][:60], exc)
        return None
    # Validate agency keys
    agencies = parsed.get("recommended_agencies") or []
    if not isinstance(agencies, list):
        agencies = []
    agencies = [a for a in agencies if a in _AGENCY_KEYS][:3]
    if not agencies:
        return None
    return {
        "why_a_gap": str(parsed.get("why_a_gap") or "")[:600],
        "recommended_agencies": agencies,
        "specific_collection": str(parsed.get("specific_collection") or "")[:800],
        "priority": str(parsed.get("priority") or "MEDIUM").upper(),
    }


async def scan_gaps(limit: int = 12) -> list[dict[str, object]]:
    """Scan for gaps and persist recommendations. Returns the new entries."""
    candidates = _gap_candidates()[:limit]
    out: list[dict[str, object]] = []
    for cand in candidates:
        try:
            rec = await _generate_recommendation(cand)
            if rec is None:
                continue
            # Skip if we already have a gap for this finding (idempotent).
            existing = db.query_one(
                "SELECT id FROM gap_analyses WHERE related_finding_id = ?",
                cand["finding_id"],
            )
            if existing:
                # Update in place rather than duplicate.
                db.execute(
                    """
                    UPDATE gap_analyses SET
                      why_a_gap = ?,
                      recommended_agencies = ?,
                      specific_collection = ?,
                      priority = ?,
                      generated_at = datetime('now')
                    WHERE id = ?
                    """,
                    rec["why_a_gap"],
                    json.dumps(rec["recommended_agencies"]),
                    rec["specific_collection"],
                    rec["priority"],
                    existing["id"],
                )
                gid = existing["id"]
            else:
                gid = db.insert(
                    "gap_analyses",
                    topic=cand["topic"],
                    why_a_gap=rec["why_a_gap"],
                    recommended_agencies=rec["recommended_agencies"],  # JSON-encoded by db.insert
                    specific_collection=rec["specific_collection"],
                    priority=rec["priority"],
                    related_finding_id=cand["finding_id"],
                )
            out.append({"id": gid, "topic": cand["topic"], **rec})
            logger.info("gap: %s → %s", cand["topic"][:60], rec["recommended_agencies"])
        except Exception as exc:  # noqa: BLE001
            logger.warning("gap scan failed for %s: %s", cand["topic"][:60], exc)
    return out


def list_gaps(only_unresolved: bool = True, limit: int = 100) -> list[dict[str, object]]:
    """Return current gap analyses for UI consumption."""
    where = "WHERE resolved = 0" if only_unresolved else ""
    rows = db.query(
        f"""
        SELECT * FROM gap_analyses
        {where}
        ORDER BY
          CASE priority
            WHEN 'HIGH' THEN 0
            WHEN 'MEDIUM' THEN 1
            WHEN 'LOW' THEN 2
            ELSE 3
          END,
          generated_at DESC
        LIMIT ?
        """,
        limit,
    )
    return [db.row_to_dict(r) for r in rows]


def mark_resolved(gap_id: str, resolved: bool = True) -> None:
    db.execute(
        "UPDATE gap_analyses SET resolved = ? WHERE id = ?",
        1 if resolved else 0,
        gap_id,
    )
