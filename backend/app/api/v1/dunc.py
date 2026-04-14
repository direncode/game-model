"""D-U-N-C REST + WebSocket endpoints.

All routes are additive and self-contained. No existing router or service
is modified. The only edit outside this vertical is a single line appended
to `app/api/v1/__init__.py` that registers this router on the v1 aggregator.
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.schemas.dunc import (
    AgentQueryRequest,
    AgentReplyOut,
    InsightOut,
    MatchCreateRequest,
    MatchStateOut,
    MatchSummaryOut,
    ScenarioTriggerRequest,
)
from app.services.dunc import (
    DuncAgent,
    MatchPreset,
    MatchRuntime,
    get_registry,
)
from app.services.ingestion.dunc_adapter import (
    DuncIngestionConfig,
    build_graph as build_dunc_graph,
    describe as describe_dunc_adapter,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dunc", tags=["dunc"])
_agent = DuncAgent()


# ── meta ──────────────────────────────────────────────────────────────
@router.get("/health")
async def dunc_health() -> dict:
    return {"status": "ok", "vertical": "dunc", "version": "0.1.0"}


@router.get("/adapter")
async def dunc_adapter_manifest() -> dict:
    """Return the D-U-N-C ingestion adapter manifest.

    This is what the frontend adapter catalog (main latentocean.com nav)
    calls to advertise D-U-N-C as a live data source alongside CSV, JSON,
    FSD, and Hugging Face Hub. Pure read-only metadata.
    """
    return describe_dunc_adapter()


@router.post("/adapter/snapshot")
async def dunc_adapter_snapshot(
    preset: str = "demo",
    seed: int = 1337,
    window_seconds: float = 15.0,
) -> dict:
    """Build a one-shot ParsedGraph snapshot from a fresh simulated window.

    Downstream this is the exact input shape the awakening pipeline expects,
    so a Latent Ocean user can click "Ingest D-U-N-C" in the adapter catalog
    and push the graph into BTUT → TCD-JEPA like any other source.
    """
    cfg = DuncIngestionConfig(
        preset_name=preset,
        seed=seed,
        window_seconds=window_seconds,
    )
    result = build_dunc_graph(cfg)
    return {
        "metadata": result.metadata,
        "entities": [
            {
                "name": e.name,
                "entity_type": e.entity_type,
                "attributes": e.attributes,
            }
            for e in result.graph.entities
        ],
        "relationships": [
            {
                "source": r.source,
                "target": r.target,
                "relationship_type": r.relationship_type,
                "weight": r.weight,
                "attributes": r.attributes,
            }
            for r in result.graph.relationships
        ],
    }


# ── match lifecycle ───────────────────────────────────────────────────
@router.post("/matches", response_model=MatchSummaryOut)
async def create_match(req: MatchCreateRequest) -> MatchSummaryOut:
    preset = MatchPreset(
        name=req.preset,
        seed=req.seed or 1337,
        hz=req.hz,
        pl_preset_key=req.pl_preset,
    )
    runtime = MatchRuntime(preset=preset)
    get_registry().put(runtime.id, runtime)
    await runtime.start()
    return _summary_to_out(runtime.summary())


@router.get("/matches", response_model=list[MatchSummaryOut])
async def list_matches() -> list[MatchSummaryOut]:
    registry = get_registry()
    out: list[MatchSummaryOut] = []
    for match_id in registry.all_ids():
        rt = registry.get(match_id)
        if rt is not None:
            out.append(_summary_to_out(rt.summary()))
    return out


@router.get("/matches/{match_id}", response_model=MatchStateOut)
async def get_match_state(match_id: str) -> MatchStateOut:
    rt = _get_or_404(match_id)
    return MatchStateOut(
        summary=_summary_to_out(rt.summary()),
        recent_insights=[InsightOut(**i.as_dict()) for i in rt.insights.recent(50)],
    )


@router.post("/matches/{match_id}/start")
async def start_match(match_id: str) -> dict:
    rt = _get_or_404(match_id)
    await rt.start()
    return {"ok": True, "match_id": match_id, "status": rt.summary().status}


@router.post("/matches/{match_id}/pause")
async def pause_match(match_id: str) -> dict:
    rt = _get_or_404(match_id)
    rt.pause()
    return {"ok": True, "match_id": match_id, "status": rt.summary().status}


@router.post("/matches/{match_id}/resume")
async def resume_match(match_id: str) -> dict:
    rt = _get_or_404(match_id)
    rt.resume()
    return {"ok": True, "match_id": match_id, "status": rt.summary().status}


@router.post("/matches/{match_id}/stop")
async def stop_match(match_id: str) -> dict:
    rt = _get_or_404(match_id)
    await rt.stop()
    get_registry().drop(match_id)
    return {"ok": True, "match_id": match_id, "status": "finished"}


@router.post("/matches/{match_id}/trigger")
async def trigger_scenario(match_id: str, req: ScenarioTriggerRequest) -> dict:
    rt = _get_or_404(match_id)
    rt.trigger(req.scenario)
    return {"ok": True, "match_id": match_id, "scenario": req.scenario}


# ── agent ─────────────────────────────────────────────────────────────
@router.post("/agent/query", response_model=AgentReplyOut)
async def agent_query(req: AgentQueryRequest) -> AgentReplyOut:
    rt = _get_or_404(req.match_id)
    reply = _agent.generate_reply(
        role=req.role,
        question=req.question,
        twins=rt.twins.all(),
        recent_insights=rt.insights.recent(50),
        ball_xy=(rt.simulator.ball.x, rt.simulator.ball.y),
    )
    return AgentReplyOut(**reply.as_dict())


# ── websocket stream ──────────────────────────────────────────────────
@router.websocket("/ws/dunc/matches/{match_id}")
async def ws_match_stream(websocket: WebSocket, match_id: str) -> None:
    """Stream per-tick match frames.

    Protocol: server pushes JSON DuncTick frames; client may send pings or
    simple control messages (ignored in v0).
    """
    await websocket.accept()
    rt = get_registry().get(match_id)
    if rt is None:
        await websocket.send_text(json.dumps({"error": "match_not_found", "match_id": match_id}))
        await websocket.close()
        return

    q = await rt.subscribe()
    try:
        # Send a prelude snapshot of recent insights so a late joiner has
        # immediate context instead of a blank board.
        await websocket.send_text(
            json.dumps(
                {
                    "type": "prelude",
                    "match_id": match_id,
                    "recent_insights": [i.as_dict() for i in rt.insights.recent(20)],
                }
            )
        )
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=5.0)
            except asyncio.TimeoutError:
                # Keep-alive ping. Also doubles as a liveness check on the client.
                await websocket.send_text(json.dumps({"type": "ping"}))
                continue
            await websocket.send_text(json.dumps({"type": "tick", **payload}))
    except WebSocketDisconnect:
        logger.info("dunc: ws disconnect match=%s", match_id)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("dunc: ws error match=%s err=%s", match_id, exc)
    finally:
        await rt.unsubscribe(q)


# Also expose the ws route at a second path that sits on the /api/v1/dunc
# prefix, for deployments that strip /ws/* rewrites. FastAPI allows
# registering the same handler under a second decorator.
@router.websocket("/matches/{match_id}/ws")
async def ws_match_stream_alt(websocket: WebSocket, match_id: str) -> None:
    await ws_match_stream(websocket, match_id)


# ── helpers ───────────────────────────────────────────────────────────
def _get_or_404(match_id: str) -> MatchRuntime:
    rt = get_registry().get(match_id)
    if rt is None:
        raise HTTPException(status_code=404, detail=f"match {match_id} not found")
    return rt


def _summary_to_out(summary) -> MatchSummaryOut:
    return MatchSummaryOut(
        id=summary.id,
        name=summary.name,
        status=summary.status,
        clock_sec=summary.clock_sec,
        hz=summary.hz,
        subscribers=summary.subscribers,
        created_at=summary.created_at,
    )
