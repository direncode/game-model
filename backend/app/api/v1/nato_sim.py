"""NATO Simulation API router — mounted at ``/api/v1/nato_sim``.

All endpoints for the /nato-sim vertical. Route protection:

    - ``/nato_sim/ingest`` and ``/nato_sim/ingest/discord`` require a bearer
      token matching ``NATO_SIM_INGEST_SECRET``.
    - ``/nato_sim/discord/interactions`` requires a valid ed25519 signature
      from Discord (verified against ``DISCORD_PUBLIC_KEY``).
    - Everything else is open to the backend; the frontend middleware gates
      browser access to the whole vertical with the access code cookie.

Subprocess IP: specific analytical craft (prompts, heuristics) lives in
``app.services.nato_sim``. This file is plumbing only.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, AsyncIterator, Literal

from fastapi import APIRouter, Body, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.services.nato_sim import db
from app.services.nato_sim.connection_finder import (
    find_hidden_connections,
    summarize_path,
)
from app.services.nato_sim.graph import (
    edges_among,
    get_entity_by_name,
    top_entities_by_degree,
)
from app.services.nato_sim.ingest.pipeline import ingest_message
from app.services.nato_sim.gap_scanner import (
    list_gaps,
    mark_resolved,
    scan_gaps,
)
from app.services.nato_sim.synthesizer import (
    EvidenceItem,
    SynthesizeInput,
    synthesize,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nato_sim", tags=["nato_sim"])


# ─────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────


class IngestIn(BaseModel):
    content: str = Field(..., min_length=1)
    source: str = "webhook"
    channel: str | None = None
    author: str | None = None
    raw: dict[str, Any] | None = None


class DiscordIngestIn(BaseModel):
    channel: str | None = None
    author: str | None = None
    content: str = Field(..., min_length=1)
    raw: dict[str, Any] | None = None


class PasteIn(BaseModel):
    content: str = Field(..., min_length=1)


class QueryIn(BaseModel):
    q: str = Field(..., min_length=1)


class ApprovalResolveIn(BaseModel):
    status: Literal["approved", "rejected", "deferred"]


# ─────────────────────────────────────────────────────────────────
# Auth helpers
# ─────────────────────────────────────────────────────────────────


def _require_ingest_bearer(request: Request) -> None:
    secret = os.environ.get("NATO_SIM_INGEST_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="NATO_SIM_INGEST_SECRET not configured")
    auth = request.headers.get("authorization") or ""
    if auth != f"Bearer {secret}":
        raise HTTPException(status_code=401, detail="bad bearer")


# ─────────────────────────────────────────────────────────────────
# Health + findings (read paths)
# ─────────────────────────────────────────────────────────────────


@router.get("/health")
async def health() -> dict[str, Any]:
    db.get_db()
    return {"status": "ok", "vertical": "nato_sim"}


@router.get("/findings")
async def list_findings(
    kind: str | None = Query(None),
    topic: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    where = ["superseded_by IS NULL"]
    params: list[Any] = []
    if kind:
        where.append("kind = ?")
        params.append(kind)
    if topic:
        where.append("topic = ?")
        params.append(topic)
    rows = db.query(
        f"SELECT * FROM findings WHERE {' AND '.join(where)} ORDER BY generated_at DESC LIMIT ?",
        *params,
        limit,
    )
    return {"items": [db.row_to_dict(r) for r in rows]}


@router.get("/findings/{finding_id}")
async def get_finding(finding_id: str) -> dict[str, Any]:
    row = db.query_one("SELECT * FROM findings WHERE id = ?", finding_id)
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"finding": db.row_to_dict(row)}


@router.get("/prep-status")
async def prep_status() -> dict[str, Any]:
    """System-pulse counters — used to show prep progress in the UI.

    Returns counts from the live DB so the operator can see resolution +
    synthesis progressing without reading the sidecar log directly.
    Cheap (a handful of COUNT queries) so safe to poll every few seconds.
    """
    def n(sql: str, *params: Any) -> int:
        row = db.query_one(sql, *params)
        return int(row["c"]) if row else 0

    findings_by_kind: dict[str, int] = {}
    rows = db.query(
        "SELECT kind, COUNT(*) AS c FROM findings WHERE superseded_by IS NULL GROUP BY kind"
    )
    for r in rows:
        findings_by_kind[r["kind"]] = int(r["c"])

    last_event = db.query_one(
        "SELECT kind, ts, payload FROM events_log ORDER BY ts DESC LIMIT 1"
    )
    recent_events = db.query(
        "SELECT kind, ts FROM events_log ORDER BY ts DESC LIMIT 10"
    )

    return {
        "corpus": {
            "docs": n("SELECT COUNT(*) AS c FROM corpus_docs"),
            "briefing_chars": n(
                "SELECT COALESCE(SUM(length(text)),0) AS c FROM corpus_docs WHERE origin = 'briefing'"
            ),
            "friday_chars": n(
                "SELECT COALESCE(SUM(length(text)),0) AS c FROM corpus_docs WHERE origin = 'friday-deck'"
            ),
        },
        "graph": {
            "entities": n("SELECT COUNT(*) AS c FROM entities"),
            "claims": n("SELECT COUNT(*) AS c FROM claims"),
            "edges": n("SELECT COUNT(*) AS c FROM edges"),
        },
        "findings": findings_by_kind,
        "messages": {
            "total": n("SELECT COUNT(*) AS c FROM messages"),
            "outliers": n(
                "SELECT COUNT(*) AS c FROM messages WHERE outlier_score >= 0.4"
            ),
        },
        "last_event": db.row_to_dict(last_event) if last_event else None,
        "recent_events": [db.row_to_dict(r) for r in recent_events],
    }


@router.get("/corpus")
async def list_corpus(limit: int = Query(200, ge=1, le=500)) -> dict[str, Any]:
    """List every ingested corpus document, newest first."""
    rows = db.query(
        """
        SELECT id, url, origin, fetched_at, title,
               substr(text, 1, 800) AS text, source_tier
        FROM corpus_docs
        ORDER BY source_tier ASC NULLS LAST, fetched_at DESC
        LIMIT ?
        """,
        limit,
    )
    return {"items": [db.row_to_dict(r) for r in rows]}


@router.get("/messages")
async def list_messages(
    limit: int = Query(30, ge=1, le=200),
    source: str | None = Query(None),
) -> dict[str, Any]:
    where = ["1=1"]
    params: list[Any] = []
    if source:
        where.append("source = ?")
        params.append(source)
    rows = db.query(
        f"SELECT * FROM messages WHERE {' AND '.join(where)} ORDER BY ts DESC LIMIT ?",
        *params,
        limit,
    )
    return {"items": [db.row_to_dict(r) for r in rows]}


# ─────────────────────────────────────────────────────────────────
# Ingest (write paths)
# ─────────────────────────────────────────────────────────────────


@router.post("/ingest")
async def ingest_generic(request: Request, body: IngestIn) -> dict[str, Any]:
    _require_ingest_bearer(request)
    msg_id = await ingest_message(
        source=body.source,
        content=body.content,
        channel=body.channel,
        author=body.author,
        raw_json=body.raw,
    )
    return {"id": msg_id}


@router.post("/ingest/discord")
async def ingest_discord_route(request: Request, body: DiscordIngestIn) -> dict[str, Any]:
    _require_ingest_bearer(request)
    msg_id = await ingest_message(
        source="discord",
        content=body.content,
        channel=body.channel,
        author=body.author,
        raw_json=body.raw,
    )
    return {"id": msg_id}


@router.post("/ingest/paste")
async def ingest_paste_route(body: PasteIn) -> dict[str, Any]:
    """Paste-box ingest — gated by the frontend access-code cookie, not bearer.

    The frontend middleware ensures only authenticated browsers can hit this.
    """
    msg_id = await ingest_message(
        source="paste",
        content=body.content,
        author="operator",
    )
    return {"id": msg_id}


class BatchIngestIn(BaseModel):
    content: str = Field(..., min_length=20)


@router.post("/ingest/batch")
async def ingest_batch_route(body: BatchIngestIn) -> dict[str, Any]:
    """Parse a multi-INTEL-INJECT paste, ingest each block, return parsed metadata.

    The Quiver bot in #comms emits structured cables (FROM / TO / SUBJECT /
    DTG / classification / body). The operator pastes a chunk of channel
    history; this endpoint splits it on the INTEL INJECT marker, dedupes,
    parses each, ingests them through the normal pipeline (entity
    resolution, priority + outlier scoring, edges), and returns the
    structured metadata for UI rendering.
    """
    from app.services.nato_sim.ingest.intel_inject_parser import (
        classify_level,
        parse_paste,
        source_kind,
    )

    parsed = parse_paste(body.content)
    items: list[dict[str, Any]] = []
    for p in parsed:
        # Compose the message content the resolver sees: subject + body.
        msg_text = f"SUBJECT: {p.subject}\n\n{p.body}".strip() or p.raw
        msg_id = await ingest_message(
            source="intel-inject",
            channel=p.subject[:120] if p.subject else None,
            author=p.source_from[:200] if p.source_from else None,
            content=msg_text,
            raw_json={
                "classification": p.classification,
                "level": classify_level(p.classification),
                "kind": source_kind(p.classification, p.source_from),
                "from": p.source_from,
                "recipients": p.recipients,
                "subject": p.subject,
                "dtg": p.dtg,
            },
        )
        items.append(
            {
                "id": msg_id,
                "classification": p.classification,
                "level": classify_level(p.classification),
                "kind": source_kind(p.classification, p.source_from),
                "from": p.source_from,
                "recipients": p.recipients,
                "subject": p.subject,
                "dtg": p.dtg,
                "body": p.body,
            }
        )
    return {"count": len(items), "items": items}


# ─────────────────────────────────────────────────────────────────
# Live query (RAG over the corpus)
# ─────────────────────────────────────────────────────────────────


def _keyword_search_corpus(q: str, limit: int = 6) -> list[dict[str, Any]]:
    """Lexical retrieval over ``corpus_docs`` for RAG context.

    Uses LIKE-based scoring — fast, no embedding dependency. Token-level
    match count is approximated by counting distinct query word hits.

    TODO(post-sim): swap to pgvector cosine retrieval once we migrate the
    vertical off SQLite.
    """
    tokens = [t for t in q.lower().split() if len(t) > 2]
    if not tokens:
        return []
    like_clauses = " + ".join(
        "(CASE WHEN lower(text) LIKE ? THEN 1 ELSE 0 END)" for _ in tokens
    )
    params = [f"%{t}%" for t in tokens]
    rows = db.query(
        f"""
        SELECT id, title, origin, url, text, ({like_clauses}) AS score
        FROM corpus_docs
        WHERE text IS NOT NULL
        ORDER BY score DESC, fetched_at DESC
        LIMIT ?
        """,
        *params,
        limit,
    )
    return [dict(r) for r in rows if dict(r).get("score", 0) > 0]


def _keyword_search_messages(q: str, limit: int = 8) -> list[dict[str, Any]]:
    """Lexical retrieval over ingested cable traffic.

    Searches ``messages`` for keyword-density matches against ``content``
    AND the cable subject embedded in ``raw_json``. Restricted to
    operator-curated traffic (intel-inject + paste + webhook + discord
    sources — not the corpus chunks loaded during prep).
    """
    tokens = [t for t in q.lower().split() if len(t) > 2]
    if not tokens:
        return []
    like_clauses = " + ".join(
        "((CASE WHEN lower(content) LIKE ? THEN 1 ELSE 0 END) "
        "+ (CASE WHEN lower(COALESCE(raw_json,'')) LIKE ? THEN 1 ELSE 0 END))"
        for _ in tokens
    )
    params: list[Any] = []
    for t in tokens:
        params.append(f"%{t}%")
        params.append(f"%{t}%")
    rows = db.query(
        f"""
        SELECT id, source, channel, author, content, ts, raw_json,
               outlier_score, outlier_signals, priority,
               ({like_clauses}) AS score
        FROM messages
        WHERE source IN ('intel-inject','paste','webhook','discord')
          AND content IS NOT NULL
        ORDER BY score DESC, ts DESC
        LIMIT ?
        """,
        *params,
        limit,
    )
    return [dict(r) for r in rows if int(dict(r).get("score", 0) or 0) > 0]


@router.post("/query")
async def live_query(body: QueryIn) -> dict[str, Any]:
    """Live analytical query — retrieves evidence from BOTH the briefing
    corpus AND the live cable traffic, then synthesizes an INR-voice
    answer.

    Cable traffic gets priority weight in the evidence stack: cables are
    operationally fresher than the briefing book, and queries from the
    operator are usually about *current* posture.

    Every successful query is appended to ``query_history``.
    """
    import json as _json

    cable_hits = _keyword_search_messages(body.q, limit=8)
    corpus_hits = _keyword_search_corpus(body.q, limit=4)

    evidence: list[EvidenceItem] = []

    # Cable traffic first — cables are fresh and operationally relevant.
    for h in cable_hits:
        raw = h.get("raw_json") or "{}"
        try:
            meta = _json.loads(raw) if isinstance(raw, str) else (raw or {})
        except Exception:
            meta = {}
        subject = meta.get("subject") or h.get("channel") or "cable"
        dtg = meta.get("dtg") or ""
        src_from = meta.get("from") or h.get("author") or ""
        label = f"cable·{subject}"
        if dtg:
            label += f"·{dtg}"
        elif src_from:
            label += f"·{src_from}"
        evidence.append(
            EvidenceItem(
                text=(h.get("content") or "")[:1400],
                source=label[:120],
            )
        )

    # Then briefing corpus chunks for deep context.
    for h in corpus_hits:
        evidence.append(
            EvidenceItem(
                text=(h.get("text") or "")[:1200],
                source=h.get("title") or h.get("origin") or "corpus",
            )
        )

    if not evidence:
        # Fallback: pull a slice of the briefing so we always have something.
        row = db.query_one(
            "SELECT text FROM corpus_docs WHERE origin = 'briefing' LIMIT 1"
        )
        text = (row["text"] if row else "") or ""
        evidence = [EvidenceItem(text=text[:3000], source="briefing")]

    answer = await synthesize(
        SynthesizeInput(
            kind="assessment",
            topic=body.q,
            evidence=evidence,
            confidence="MEDIUM",
            use_deep_model=True,
            extra_instructions=(
                "Answer the operator's specific question. Use cable traffic "
                "evidence (sources prefixed 'cable·…') as the primary basis "
                "when current cables address the question; use briefing-corpus "
                "evidence for historical/baseline context. Cite each substantive "
                "claim back to a specific source label. If evidence is "
                "insufficient, say so explicitly in the BLUF and name the "
                "specific gap."
            ),
        )
    )

    cable_sources = [
        {
            "id": h.get("id"),
            "subject": (
                _json.loads(h.get("raw_json") or "{}").get("subject")
                if isinstance(h.get("raw_json"), str)
                else None
            ),
            "from": (
                _json.loads(h.get("raw_json") or "{}").get("from")
                if isinstance(h.get("raw_json"), str)
                else h.get("author")
            ),
            "dtg": (
                _json.loads(h.get("raw_json") or "{}").get("dtg")
                if isinstance(h.get("raw_json"), str)
                else None
            ),
            "ts": h.get("ts"),
            "outlier_score": h.get("outlier_score"),
        }
        for h in cable_hits
    ]
    corpus_sources = [
        {"title": h.get("title"), "origin": h.get("origin"), "url": h.get("url")}
        for h in corpus_hits
    ]

    sources = corpus_sources + [
        {"title": s.get("subject"), "origin": "cable", "url": None}
        for s in cable_sources
    ]

    qid = db.insert(
        "query_history",
        q=body.q,
        answer=answer,
        sources=sources,
    )
    return {
        "id": qid,
        "answer": answer,
        "sources": sources,
        "cable_sources": cable_sources,
        "corpus_sources": corpus_sources,
        "evidence_counts": {
            "cables": len(cable_hits),
            "corpus": len(corpus_hits),
        },
    }


@router.get("/queries")
async def list_queries(limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    """Server-side query history. Newest first."""
    rows = db.query(
        "SELECT * FROM query_history ORDER BY ts DESC LIMIT ?",
        limit,
    )
    return {"items": [db.row_to_dict(r) for r in rows]}


@router.post("/queries/{query_id}/pin")
async def pin_query(query_id: str, body: dict[str, Any] = Body(default_factory=dict)) -> dict[str, Any]:
    """Pin or unpin a query. Optional ``note`` text."""
    pinned = 1 if body.get("pinned", True) else 0
    note = body.get("note") or None
    db.execute(
        "UPDATE query_history SET pinned = ?, note = COALESCE(?, note) WHERE id = ?",
        pinned, note, query_id,
    )
    row = db.query_one("SELECT * FROM query_history WHERE id = ?", query_id)
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"item": db.row_to_dict(row)}


@router.delete("/queries/{query_id}")
async def delete_query(query_id: str) -> dict[str, Any]:
    db.execute("DELETE FROM query_history WHERE id = ?", query_id)
    return {"ok": True}


class OperationalizeIn(BaseModel):
    content: str = Field(..., min_length=10)
    source: str | None = "tasking-memo"


@router.post("/operationalize")
async def operationalize(body: OperationalizeIn) -> dict[str, Any]:
    """Process a tasking memo — extract discrete tasks, RAG-answer each,
    surface gaps with IC tasking recommendations.

    For each tasking line in the input:
      1. Synthesize an INR-voice answer using current corpus + findings.
      2. Identify the residual evidence gap.
      3. Recommend agencies + specific collection ask to fill it.

    Persists each result as a finding (kind='task-response') and a
    gap_analyses row. Returns the structured response for inline render.

    Cost: ~8 LLM calls per typical 5-task memo (1 extract + ~7 combined
    synthesis+gap calls). Roughly $2-4 in xAI credits per memo.
    """
    import json as _json
    import re as _re

    from app.services.nato_sim.judgment import (
        get_inr_voice,
        render_agency_directory,
    )
    from app.services.nato_sim.llm import llm_call

    # ── 1. Extract discrete tasking lines via grok-3 ──────────────────
    extract_system = """You are parsing a U.S. intelligence tasking memo. Extract each discrete tasking question, action, or order as a separate JSON string in an array. Preserve specificity — do NOT summarize or merge. Each array element should be a single action item or question.

Output STRICT JSON: an array of strings. Example:
["Identify the positions of NATO government decision makers on commitment to Article 5 responses.", "Ensure NATO NIFC is apprised of cleared intelligence in light of the Riga cyberattack."]

Output ONLY the JSON array. No prose."""
    extract_res = await llm_call(
        body.content,
        system=extract_system,
        model="routine",
        temperature=0.0,
        max_tokens=1200,
    )
    try:
        m = _re.search(r"\[[\s\S]*\]", extract_res.text)
        if not m:
            raise ValueError("no JSON array")
        tasks: list[str] = _json.loads(m.group(0))
        tasks = [t.strip() for t in tasks if isinstance(t, str) and t.strip()][:8]
    except Exception as exc:
        return {"error": f"could not parse tasking: {exc}", "raw": extract_res.text[:500]}

    if not tasks:
        return {"error": "no tasks extracted from memo", "raw": extract_res.text[:500]}

    # ── 2. Combined synthesis+gap per task — single LLM call each ─────
    combined_system = (
        get_inr_voice()
        + "\n\n"
        + render_agency_directory()
        + "\n\n"
        + """# Tasking Response

You are responding to a single intelligence tasking question. Output STRICT JSON (no prose, no markdown fences) matching this schema:

{
  "what_we_know": "INR-voice answer in plain prose: BLUF first sentence, then 1-3 short paragraphs with [citations] and (U)(C)(S) portion markers. ~120-200 words.",
  "what_we_dont_know": "one or two sentences naming the residual gap.",
  "recommended_agencies": ["CIA", "DIA", ...],   # 1-3 keys from the IC directory above
  "specific_collection": "concrete collection ask — name place, actor, indicator.",
  "priority": "HIGH" | "MEDIUM" | "LOW"
}

Output ONLY the JSON object."""
    )

    sb = db.get_db()
    persisted_findings: list[str] = []
    persisted_gaps: list[str] = []
    out_tasks: list[dict[str, Any]] = []

    for task in tasks:
        # Pull a few corpus hits to ground the answer (lexical, no embed cost)
        hits = _keyword_search_corpus(task, limit=4)
        evidence_block = (
            "\n\n".join(
                f"[Ref {i+1}] {h.get('title') or h.get('origin') or 'corpus'}\n"
                f"{(h.get('text') or '')[:1000]}"
                for i, h in enumerate(hits)
            )
            if hits
            else "(no corpus hits — answer from graph state alone)"
        )
        user = f"Tasking: {task}\n\nCorpus context:\n{evidence_block}\n\nProduce the JSON response."
        try:
            res = await llm_call(
                user,
                system=combined_system,
                model="deep",
                temperature=0.2,
                max_tokens=900,
            )
            m2 = _re.search(r"\{[\s\S]*\}", res.text)
            if not m2:
                raise ValueError("no JSON object")
            parsed = _json.loads(m2.group(0))
        except Exception as exc:
            out_tasks.append({"task": task, "error": str(exc)})
            continue

        agencies = parsed.get("recommended_agencies") or []
        if isinstance(agencies, list):
            agencies = [a for a in agencies if isinstance(a, str)][:3]
        else:
            agencies = []

        what_we_know = str(parsed.get("what_we_know") or "")[:3000]
        what_we_dont_know = str(parsed.get("what_we_dont_know") or "")[:600]
        spec = str(parsed.get("specific_collection") or "")[:800]
        prio = str(parsed.get("priority") or "MEDIUM").upper()

        # Persist as a finding (task-response kind)
        finding_id = db.insert(
            "findings",
            topic=task[:160],
            kind="task-response",
            text=what_we_know,
            confidence="MEDIUM",
            citations=[h.get("title") or h.get("origin") for h in hits],
        )
        persisted_findings.append(finding_id)

        # Persist gap if there's a real one
        gap_id = None
        if what_we_dont_know and agencies:
            gap_id = db.insert(
                "gap_analyses",
                topic=task[:160],
                why_a_gap=what_we_dont_know,
                recommended_agencies=agencies,
                specific_collection=spec,
                priority=prio,
                related_finding_id=finding_id,
            )
            persisted_gaps.append(gap_id)

        out_tasks.append(
            {
                "task": task,
                "what_we_know": what_we_know,
                "what_we_dont_know": what_we_dont_know,
                "recommended_agencies": agencies,
                "specific_collection": spec,
                "priority": prio,
                "finding_id": finding_id,
                "gap_id": gap_id,
                "sources": [
                    {
                        "title": h.get("title"),
                        "origin": h.get("origin"),
                        "url": h.get("url"),
                    }
                    for h in hits
                ],
            }
        )

    return {
        "memo_source": body.source,
        "extracted_count": len(tasks),
        "tasks": out_tasks,
        "persisted_findings": persisted_findings,
        "persisted_gaps": persisted_gaps,
    }


@router.get("/gaps")
async def gaps_list(
    only_unresolved: bool = Query(True),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """List current intelligence gaps + their agency tasking recommendations."""
    return {"items": list_gaps(only_unresolved=only_unresolved, limit=limit)}


@router.post("/gaps/scan")
async def gaps_scan(limit: int = Query(12, ge=1, le=30)) -> dict[str, Any]:
    """Run a gap scan over current findings.

    Iterates over LOW-confidence + dissent + watchboard findings, asks
    Grok-deep for the gap + recommended agencies + specific collection,
    persists to gap_analyses. Returns the new/updated entries.
    """
    items = await scan_gaps(limit=limit)
    return {"generated": len(items), "items": items}


@router.post("/gaps/{gap_id}/resolve")
async def gaps_resolve(gap_id: str, body: dict[str, Any] = Body(default_factory=dict)) -> dict[str, Any]:
    """Mark a gap as resolved (or reopen)."""
    resolved = bool(body.get("resolved", True))
    mark_resolved(gap_id, resolved=resolved)
    return {"ok": True, "id": gap_id, "resolved": resolved}


@router.get("/agencies")
async def agencies_directory() -> dict[str, Any]:
    """Return the IC agency capability map. Used by the Gaps page UI."""
    from app.services.nato_sim.judgment import IC_AGENCIES
    return {"agencies": IC_AGENCIES}


@router.get("/entities")
async def list_entities(
    limit: int = Query(200, ge=1, le=500),
    type: str | None = Query(None),
) -> dict[str, Any]:
    """Sorted entity list with degree, first/last seen, and a 4D
    structural score vector — backs the Network tab's CSV-style table.

    Score axes (each in [0, 1] except where noted):

      novelty            How recently the entity first appeared,
                         relative to the oldest entity in the DB. New
                         entities trend high.
      centrality         Degree normalized to the most-connected entity.
      peer_rank_anomaly  abs(z-score) of this entity's degree within
                         its own type cohort. Capped at 5 sigma. High =
                         unusually-connected vs same-type peers.
      outlier_assoc      Fraction of this entity's evidence-messages
                         whose outlier_score >= 0.4. High = the entity
                         is riding anomalous traffic.

    Composite ``structural_score`` averages the four axes (equal weight)
    so the table can default to a sensible blended sort.
    """
    where = ""
    params: list[Any] = []
    if type:
        where = "WHERE e.type = ?"
        params.append(type)

    rows = db.query(
        f"""
        SELECT e.id, e.type, e.canonical_name,
               e.first_seen_at, e.last_seen_at,
               (SELECT COUNT(*) FROM edges
                WHERE from_entity = e.id OR to_entity = e.id) AS degree,
               (SELECT COUNT(*) FROM edges WHERE from_entity = e.id) AS out_degree,
               (SELECT COUNT(*) FROM claims WHERE about_entity = e.id) AS claim_count
        FROM entities e
        {where}
        ORDER BY degree DESC, e.canonical_name ASC
        LIMIT ?
        """,
        *params, limit,
    )
    items = [db.row_to_dict(r) for r in rows]
    if not items:
        return {"items": []}

    # ── 1. Centrality: degree / max_degree
    max_degree = max((it.get("degree") or 0) for it in items) or 1
    for it in items:
        it["centrality"] = round((it.get("degree") or 0) / max_degree, 4)

    # ── 2. Novelty: (max_age_seconds - this_age_seconds) / max_age_seconds
    # Use julianday() in SQL to get unix-ish ages.
    age_row = db.query_one(
        """
        SELECT
          MAX(julianday('now') - julianday(first_seen_at)) AS max_age,
          MIN(julianday('now') - julianday(first_seen_at)) AS min_age
        FROM entities
        WHERE first_seen_at IS NOT NULL
        """
    )
    max_age = float((age_row["max_age"] if age_row else 0) or 0) or 1.0
    for it in items:
        ts = it.get("first_seen_at")
        if not ts:
            it["novelty"] = 0.0
            continue
        age_row2 = db.query_one(
            "SELECT julianday('now') - julianday(?) AS age", ts
        )
        age = float((age_row2["age"] if age_row2 else 0) or 0)
        # Newer = higher. Bounded [0, 1].
        it["novelty"] = round(max(0.0, min(1.0, 1.0 - (age / max_age))), 4)

    # ── 3. Peer-rank anomaly: abs(z-score) within same-type, cap 5σ.
    # Compute mean + stdev of degree per type from the full entity table.
    type_stats: dict[str, tuple[float, float]] = {}
    type_rows = db.query(
        """
        SELECT type, COUNT(*) AS n,
               AVG(d) AS mean_d,
               -- SQLite has no STDEV; emulate as sqrt(E[X^2] - E[X]^2)
               AVG(d * d) AS mean_d2
        FROM (
            SELECT e.type AS type,
                   (SELECT COUNT(*) FROM edges
                    WHERE from_entity = e.id OR to_entity = e.id) AS d
            FROM entities e
        )
        GROUP BY type
        """
    )
    for r in type_rows:
        t = r["type"]
        n = int(r["n"] or 0)
        mean_d = float(r["mean_d"] or 0)
        mean_d2 = float(r["mean_d2"] or 0)
        var = max(0.0, mean_d2 - mean_d * mean_d)
        std = (var ** 0.5) if n >= 2 else 0.0
        type_stats[t] = (mean_d, std)

    for it in items:
        t = it.get("type")
        deg = float(it.get("degree") or 0)
        mean_d, std = type_stats.get(t, (0.0, 0.0))
        if std <= 0:
            z = 0.0
        else:
            z = abs((deg - mean_d) / std)
            z = min(z, 5.0)
        it["peer_rank_anomaly"] = round(z / 5.0, 4)  # normalize to [0,1]

    # ── 4. Outlier association: fraction of evidence-messages on edges
    # touching the entity that are outlier-flagged.
    # One pass over edges + messages, JSON-LIKE join.
    # Cheap because outliers are a small minority of messages.
    out_rows = db.query(
        """
        SELECT
          eid AS entity_id,
          COUNT(*) AS total_msgs,
          SUM(CASE WHEN m.outlier_score >= 0.4 THEN 1 ELSE 0 END) AS outlier_msgs
        FROM (
          SELECT e.id AS eid FROM entities e
        ) eids
        LEFT JOIN edges ed
          ON (ed.from_entity = eids.eid OR ed.to_entity = eids.eid)
        LEFT JOIN messages m
          ON ed.evidence IS NOT NULL
          AND ed.evidence LIKE '%' || m.id || '%'
        GROUP BY eids.eid
        """
    )
    outlier_assoc: dict[str, float] = {}
    for r in out_rows:
        eid = r["entity_id"]
        total = int(r["total_msgs"] or 0)
        out = int(r["outlier_msgs"] or 0)
        outlier_assoc[eid] = (out / total) if total > 0 else 0.0

    for it in items:
        it["outlier_assoc"] = round(outlier_assoc.get(it["id"], 0.0), 4)

    # ── Composite structural score: equal-weight mean of the 4 axes.
    for it in items:
        it["structural_score"] = round(
            (
                it["centrality"]
                + it["novelty"]
                + it["peer_rank_anomaly"]
                + it["outlier_assoc"]
            )
            / 4.0,
            4,
        )

    return {"items": items}


# ─────────────────────────────────────────────────────────────────
# Network (graph snapshot for d3)
# ─────────────────────────────────────────────────────────────────


@router.get("/network")
async def network_snapshot(limit: int = Query(50, ge=5, le=200)) -> dict[str, Any]:
    top = top_entities_by_degree(limit=limit)
    nodes = [
        {
            "id": ent.id,
            "name": ent.canonical_name,
            "type": ent.type,
            "degree": deg,
        }
        for ent, deg in top
    ]
    ids = [n["id"] for n in nodes]
    edges = edges_among(ids)
    return {"nodes": nodes, "edges": edges}


@router.get("/hidden-connections/{entity_name}")
async def hidden_connections(
    entity_name: str, type: str = Query("actor"), limit: int = Query(20, ge=1, le=50)
) -> dict[str, Any]:
    ent = get_entity_by_name(type=type, canonical_name=entity_name)  # type: ignore[arg-type]
    if not ent:
        raise HTTPException(status_code=404, detail="entity not found")
    paths = find_hidden_connections(start_id=ent.id, max_hops=3, limit=limit)
    return {
        "start": {"id": ent.id, "name": ent.canonical_name, "type": ent.type},
        "paths": [
            {
                "length": len(p),
                "summary": summarize_path(p),
                "endpoint": p[-1].entity.canonical_name if p else None,
            }
            for p in paths
        ],
    }


# ─────────────────────────────────────────────────────────────────
# Approvals queue
# ─────────────────────────────────────────────────────────────────


@router.get("/approvals")
async def list_approvals(
    status_filter: str = Query("pending", alias="status"),
) -> dict[str, Any]:
    rows = db.query(
        "SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC LIMIT 50",
        status_filter,
    )
    return {"items": [db.row_to_dict(r) for r in rows]}


@router.post("/approvals/{approval_id}")
async def resolve_approval(approval_id: str, body: ApprovalResolveIn) -> dict[str, Any]:
    db.execute(
        "UPDATE approvals SET status = ?, decided_at = datetime('now'), decided_by = ? WHERE id = ?",
        body.status,
        "operator",
        approval_id,
    )
    row = db.query_one("SELECT * FROM approvals WHERE id = ?", approval_id)
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"approval": db.row_to_dict(row)}


# ─────────────────────────────────────────────────────────────────
# Server-Sent Events (live UI updates)
# ─────────────────────────────────────────────────────────────────


async def _sse_generator() -> AsyncIterator[bytes]:
    """Poll the events_log and emit SSE frames for new rows.

    SQLite doesn't have LISTEN/NOTIFY, so we poll every 1.5s. That's fine
    for a single-operator workstation — the latency is invisible to humans.
    """
    last_ts = time.time()
    last_id: str | None = None
    yield b": stream-open\n\n"

    while True:
        try:
            rows = db.query(
                "SELECT * FROM events_log WHERE ts > datetime('now', '-5 seconds') ORDER BY ts ASC LIMIT 50"
            )
            for r in rows:
                d = db.row_to_dict(r) or {}
                if d.get("id") == last_id:
                    continue
                last_id = d.get("id")
                payload = json.dumps(d, default=str)
                yield f"event: {d.get('kind', 'event')}\ndata: {payload}\n\n".encode()

            # Heartbeat every ~15s to keep proxies from closing the connection.
            if time.time() - last_ts > 15:
                last_ts = time.time()
                yield b": heartbeat\n\n"

            await asyncio.sleep(1.5)
        except asyncio.CancelledError:
            return
        except Exception as exc:  # noqa: BLE001
            logger.warning("sse generator error: %s", exc)
            yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n".encode()
            await asyncio.sleep(3)


@router.get("/stream")
async def sse_stream() -> StreamingResponse:
    return StreamingResponse(
        _sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─────────────────────────────────────────────────────────────────
# Discord HTTP Interactions (slash commands)
# ─────────────────────────────────────────────────────────────────


def _verify_discord_signature(
    public_key_hex: str,
    signature_hex: str,
    timestamp: str,
    body: bytes,
) -> bool:
    try:
        from nacl.signing import VerifyKey
        from nacl.exceptions import BadSignatureError
    except ImportError:
        logger.error("pynacl not installed; install with `pip install pynacl`")
        return False
    try:
        vk = VerifyKey(bytes.fromhex(public_key_hex))
        vk.verify(timestamp.encode() + body, bytes.fromhex(signature_hex))
        return True
    except BadSignatureError:
        return False
    except Exception as exc:  # noqa: BLE001
        logger.warning("discord sig verify failed: %s", exc)
        return False


async def _dispatch_slash(name: str, options: dict[str, Any]) -> str:
    """Generate the reply text for a slash command.

    Only the minimum five commands are wired tonight. Templates can be
    extended in ``services/nato_sim/templates/``.
    """
    from app.services.nato_sim.synthesizer import (
        EvidenceItem,
        SynthesizeInput,
        synthesize,
    )

    if name == "rfi":
        target = options.get("target", "")
        body = await synthesize(
            SynthesizeInput(
                kind="assessment",
                topic=f"Request for Information: {target}",
                evidence=[EvidenceItem(text="Operator-initiated RFI", source="operator")],
                confidence="MEDIUM",
                extra_instructions=(
                    "Produce a formal RFI in this exact shape:\n"
                    "ORIGINATOR: State/INR\n"
                    "PRIORITY: [FLASH|IMMEDIATE|PRIORITY|ROUTINE]\n"
                    f"TARGET: {target}\n"
                    "SPECIFIC REQUIREMENT: ...\n"
                    "JUSTIFICATION: ...\n"
                    "DECISION DEADLINE: ...\n"
                    "PREFERRED SOURCES: ..."
                ),
            )
        )
        return f"```\n{body}\n```"

    if name == "sitrep":
        rows = db.query(
            "SELECT text FROM corpus_docs WHERE origin = 'briefing' LIMIT 1"
        )
        txt = (rows[0]["text"] if rows else "") or ""
        body = await synthesize(
            SynthesizeInput(
                kind="sitrep",
                topic="Current NATO Eastern Flank posture",
                evidence=[EvidenceItem(text=txt[:4000], source="briefing")],
                confidence="MEDIUM",
            )
        )
        return f"```\n{body[:1800]}\n```"

    if name == "brief-dni":
        topic = options.get("topic", "Current posture")
        body = await synthesize(
            SynthesizeInput(
                kind="brief-dni",
                topic=topic,
                evidence=[EvidenceItem(text="(synthesized from the running graph)", source="graph")],
                confidence="MEDIUM",
                use_deep_model=True,
            )
        )
        return f"```\n{body[:1800]}\n```"

    if name == "brief-potus":
        topic = options.get("topic", "Current posture")
        body = await synthesize(
            SynthesizeInput(
                kind="brief-potus",
                topic=topic,
                evidence=[EvidenceItem(text="(synthesized from the running graph)", source="graph")],
                confidence="MEDIUM",
                use_deep_model=True,
            )
        )
        return f"```\n{body[:1800]}\n```"

    if name == "watchboard":
        rows = db.query(
            "SELECT * FROM findings WHERE kind = 'watchboard-item' AND superseded_by IS NULL ORDER BY generated_at DESC LIMIT 10"
        )
        if not rows:
            return "_no Watchboard items populated yet_"
        lines = ["**Watchboard (latest 10 items):**"]
        for r in rows:
            d = db.row_to_dict(r) or {}
            lines.append(f"• **{d.get('topic')}** — {(d.get('text') or '')[:120]}")
        return "\n".join(lines)

    if name == "tasking":
        agency = options.get("agency", "CIA")
        target = options.get("target", "")
        body = await synthesize(
            SynthesizeInput(
                kind="assessment",
                topic=f"Collection Tasking: {agency} → {target}",
                evidence=[EvidenceItem(text=f"State/INR tasking request to {agency}", source="operator")],
                confidence="MEDIUM",
                extra_instructions=(
                    "Produce a formal collection tasking in this exact shape:\n"
                    "TASKING AGENCY: " + agency + "\n"
                    "ORIGINATOR: State/INR\n"
                    "TARGET: " + target + "\n"
                    "PRIORITY: [FLASH|IMMEDIATE|PRIORITY|ROUTINE]\n"
                    "DISCIPLINE: [HUMINT|SIGINT|GEOINT|MASINT|OSINT]\n"
                    "REQUIREMENT: ...\n"
                    "DEADLINE: ...\n"
                    "JUSTIFICATION: ...\n"
                ),
            )
        )
        return f"```\n{body[:1800]}\n```"

    if name == "assessment":
        topic = options.get("topic", "")
        # Pull recent corpus context relevant to the topic.
        hits = _keyword_search_corpus(topic, limit=4)
        evidence = [
            EvidenceItem(text=(h.get("text") or "")[:1200], source=h.get("title") or h.get("origin") or "corpus")
            for h in hits
        ] or [EvidenceItem(text="(no corpus hit — synthesizing from graph state)", source="graph")]
        body = await synthesize(
            SynthesizeInput(
                kind="assessment",
                topic=topic,
                evidence=evidence,
                confidence="MEDIUM",
                use_deep_model=True,
            )
        )
        return f"```\n{body[:1800]}\n```"

    if name == "sources":
        entity = options.get("entity", "")
        # Find briefing paragraphs that mention this entity by simple LIKE.
        rows = db.query(
            "SELECT id, title, text FROM corpus_docs WHERE text LIKE ? AND origin = 'briefing' LIMIT 1",
            f"%{entity}%",
        )
        if not rows:
            return f"_no briefing paragraphs found mentioning '{entity}'_"
        full = (rows[0]["text"] or "")
        lower = full.lower()
        needle = entity.lower()
        # Pull up to 5 windows of ±200 chars around each mention.
        excerpts: list[str] = []
        cursor = 0
        for _ in range(5):
            i = lower.find(needle, cursor)
            if i < 0:
                break
            start = max(0, i - 200)
            end = min(len(full), i + len(needle) + 200)
            excerpts.append(f"…{full[start:end].strip()}…")
            cursor = end
        if not excerpts:
            return f"_no excerpts produced for '{entity}'_"
        return f"**Briefing excerpts mentioning {entity}:**\n\n" + "\n\n---\n\n".join(excerpts)[:1800]

    if name == "ingest":
        url = options.get("url", "")
        if not url.startswith("http"):
            return f"_invalid URL: {url}_"
        # Inline fetch + ingest via the harvest adapter.
        from app.services.nato_sim.ingest.harvest import fetch_html  # type: ignore[attr-defined]
        try:
            from app.services.nato_sim.corpora_runtime import _ingest_url  # noqa: F401
        except Exception:
            pass
        # Fallback to a direct ingest_message of the fetched text.
        from app.services.nato_sim.ingest.pipeline import ingest_message
        from app.services.nato_sim.ingest.harvest import _extract_readable_text  # type: ignore[attr-defined]
        import httpx  # type: ignore[import-not-found]
        try:
            async with httpx.AsyncClient(headers={"User-Agent": "LatentOcean-NatoSim/0.1"}, timeout=15.0) as client:
                resp = await client.get(url, follow_redirects=True)
            if resp.status_code != 200:
                return f"_fetch failed: HTTP {resp.status_code}_"
            title, text = _extract_readable_text(resp.text)
            await ingest_message(source="webhook", content=(text or "")[:8000], channel=url, author=title or "ingested")
            return f"✓ ingested {title or url}\n_{len(text)} chars; resolver running async_"
        except Exception as exc:  # noqa: BLE001
            return f"_ingest error: {exc}_"

    return f"unknown command: /{name}"


@router.post("/discord/interactions")
async def discord_interactions(request: Request) -> JSONResponse:
    raw = await request.body()
    sig = request.headers.get("x-signature-ed25519", "")
    ts = request.headers.get("x-signature-timestamp", "")
    pub = os.environ.get("DISCORD_PUBLIC_KEY", "")
    if not pub or not _verify_discord_signature(pub, sig, ts, raw):
        raise HTTPException(status_code=401, detail="bad signature")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="bad json")

    interaction_type = payload.get("type")
    # 1 = PING
    if interaction_type == 1:
        return JSONResponse({"type": 1})
    # 2 = APPLICATION_COMMAND
    if interaction_type == 2:
        data = payload.get("data", {}) or {}
        name = data.get("name", "")
        options = {o["name"]: o.get("value") for o in (data.get("options") or [])}
        try:
            content = await _dispatch_slash(name, options)
        except Exception as exc:  # noqa: BLE001
            logger.exception("slash dispatch failed")
            content = f"error running /{name}: {exc}"
        # 4 = CHANNEL_MESSAGE_WITH_SOURCE; flag 64 = ephemeral
        return JSONResponse({"type": 4, "data": {"content": content[:1900], "flags": 64}})

    return JSONResponse(
        {"type": 4, "data": {"content": "unsupported interaction type", "flags": 64}}
    )
