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
    """Identify findings that look like analytical gaps.

    Heuristics:
      - confidence = LOW on any finding (always a gap)
      - confidence = MEDIUM on watchboard items (those need promote/demote signals)
      - dissents (always indicate competing reads worth resolving)
      - findings whose citations field has fewer than 2 distinct entries
    """
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
        LIMIT 30
        """
    )
    out: list[dict[str, str]] = []
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
