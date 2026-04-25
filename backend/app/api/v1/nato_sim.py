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
    # Build a SQL expression that ranks rows by keyword density.
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


@router.post("/query")
async def live_query(body: QueryIn) -> dict[str, Any]:
    """Live analytical query — retrieves corpus context, synthesizes an INR-voice answer.

    Every successful query is appended to ``query_history`` so the
    operator's session survives reloads, container restarts, and
    multiple-tab use.
    """
    hits = _keyword_search_corpus(body.q, limit=6)
    if hits:
        evidence = [
            EvidenceItem(
                text=(h["text"] or "")[:1200],
                source=h.get("title") or h.get("origin") or "corpus",
            )
            for h in hits
        ]
    else:
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
                "Answer the operator's specific question. Do not re-dump general "
                "background unless it is directly relevant. If the evidence is "
                "insufficient, say so explicitly in the BLUF."
            ),
        )
    )
    sources = [
        {"title": h.get("title"), "origin": h.get("origin"), "url": h.get("url")}
        for h in hits
    ]
    # Persist to query_history so the session survives.
    qid = db.insert(
        "query_history",
        q=body.q,
        answer=answer,
        sources=sources,
    )
    return {"id": qid, "answer": answer, "sources": sources}


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


@router.get("/entities")
async def list_entities(
    limit: int = Query(200, ge=1, le=500),
    type: str | None = Query(None),
) -> dict[str, Any]:
    """Sorted entity list with degree + first/last seen — backs the
    Network tab's CSV-style table view.
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
    return {"items": [db.row_to_dict(r) for r in rows]}


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
