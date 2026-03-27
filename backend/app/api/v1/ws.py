"""WebSocket endpoints for real-time streaming."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.auth import decode_token
from app.core.exceptions import UnauthorizedError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


# ── Crystallization metrics stream ───────────────────────────────


@router.websocket("/ws/crystallization/{job_id}")
async def ws_crystallization_metrics(websocket: WebSocket, job_id: uuid.UUID):
    """Stream training metrics for a crystallization job via Redis pub/sub.

    On connect, subscribes to the Redis channel ``crystallization:{job_id}``
    and forwards JSON messages containing epoch, loss, link_auc,
    knn_accuracy, gpu_utilization, module_count, and estimated_time.
    """
    await websocket.accept()
    channel_name = f"crystallization:{job_id}"

    try:
        import redis.asyncio as aioredis
        from app.config import settings

        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        try:
            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message and message["type"] == "message":
                    data = message["data"]
                    # Forward raw JSON string to client
                    if isinstance(data, str):
                        await websocket.send_text(data)
                    else:
                        await websocket.send_text(json.dumps(data))

                # Also check for client disconnect
                try:
                    text = await asyncio.wait_for(
                        websocket.receive_text(), timeout=0.01
                    )
                    # Client sent something — could be a ping or close
                    if text == "close":
                        break
                except asyncio.TimeoutError:
                    pass

        except WebSocketDisconnect:
            logger.info("Client disconnected from crystallization WS %s", job_id)
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()
            await redis.close()

    except ImportError:
        # redis.asyncio not installed — fall back to polling placeholder
        logger.warning("redis.asyncio not available; WS will not stream real metrics")
        try:
            while True:
                await asyncio.sleep(2)
                await websocket.send_json(
                    {
                        "status": "waiting",
                        "message": "Redis pub/sub not configured",
                        "job_id": str(job_id),
                    }
                )
        except WebSocketDisconnect:
            pass
    except Exception as exc:
        logger.exception("WebSocket error for job %s: %s", job_id, exc)
        await websocket.close(code=1011, reason="Internal server error")


# ── Real-time alerts stream ──────────────────────────────────────


@router.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket, token: str = Query(...)):
    """Stream real-time alerts to authenticated users.

    Requires an auth token passed as a query parameter.
    Subscribes to the Redis channel ``alerts:{user_id}``.
    """
    # Authenticate via query-param token
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid token type")
            return
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Token missing subject")
            return
    except Exception:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    await websocket.accept()
    channel_name = f"alerts:{user_id}"

    try:
        import redis.asyncio as aioredis
        from app.config import settings

        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)

        try:
            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message and message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, str):
                        await websocket.send_text(data)
                    else:
                        await websocket.send_text(json.dumps(data))

                try:
                    text = await asyncio.wait_for(
                        websocket.receive_text(), timeout=0.01
                    )
                    if text == "close":
                        break
                except asyncio.TimeoutError:
                    pass

        except WebSocketDisconnect:
            logger.info("Client disconnected from alerts WS (user %s)", user_id)
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.close()
            await redis.close()

    except ImportError:
        logger.warning("redis.asyncio not available; alerts WS will not stream")
        try:
            while True:
                await asyncio.sleep(5)
                await websocket.send_json(
                    {
                        "status": "waiting",
                        "message": "Redis pub/sub not configured",
                    }
                )
        except WebSocketDisconnect:
            pass
    except Exception as exc:
        logger.exception("Alerts WebSocket error: %s", exc)
        await websocket.close(code=1011, reason="Internal server error")
