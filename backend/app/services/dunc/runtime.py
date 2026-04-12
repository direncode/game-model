"""`MatchRuntime` — the live, long-running owner of a single match.

Responsibilities:
- Own a `MatchSimulator`, a `DigitalTwinRegistry`, a `TacticalEngine`, and
  an `InsightStream`.
- Run the async tick loop when `start()` is called.
- Broadcast per-tick frames to a set of subscribed `asyncio.Queue`s (one
  per connected WebSocket).
- Accept manual scenario triggers from the REST endpoints.

The tick loop is cooperative: it sleeps `1/hz` between ticks and respects
the paused flag. Multiple subscribers each get their own queue — we never
fan in, only fan out.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import Literal, Optional

from app.services.dunc.insights import InsightStream
from app.services.dunc.simulator import MatchPreset, MatchSimulator
from app.services.dunc.tactical_engine import TacticalEngine
from app.services.dunc.twins import DigitalTwinRegistry

logger = logging.getLogger(__name__)


@dataclass
class MatchSummary:
    id: str
    name: str
    status: Literal["idle", "running", "paused", "finished"]
    clock_sec: float
    hz: float
    subscribers: int
    created_at: float


class MatchRuntime:
    def __init__(self, match_id: Optional[str] = None, preset: Optional[MatchPreset] = None) -> None:
        self.id = match_id or uuid.uuid4().hex[:12]
        self.preset = preset or MatchPreset()
        self.name = self.preset.name
        self.simulator = MatchSimulator(self.preset)
        self.twins = DigitalTwinRegistry()
        self.engine = TacticalEngine()
        self.insights = InsightStream()

        self._task: Optional[asyncio.Task] = None
        self._running = False
        self._paused = False
        self._subscribers: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()
        import time
        self.created_at = time.time()

    # ── lifecycle ─────────────────────────────────────────────────────
    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._paused = False
        self._task = asyncio.create_task(self._run_loop(), name=f"dunc-{self.id}")

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=2.0)
            except asyncio.TimeoutError:
                self._task.cancel()
            self._task = None

    def pause(self) -> None:
        self._paused = True

    def resume(self) -> None:
        self._paused = False

    def trigger(self, scenario: str) -> None:
        self.simulator.trigger(scenario)

    # ── subscriber plumbing ───────────────────────────────────────────
    async def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        async with self._lock:
            self._subscribers.add(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue) -> None:
        async with self._lock:
            self._subscribers.discard(q)

    # ── summary ───────────────────────────────────────────────────────
    def summary(self) -> MatchSummary:
        status: Literal["idle", "running", "paused", "finished"]
        if not self._running:
            status = "idle"
        elif self._paused:
            status = "paused"
        else:
            status = "running"
        return MatchSummary(
            id=self.id,
            name=self.name,
            status=status,
            clock_sec=self.simulator.t,
            hz=self.preset.hz,
            subscribers=len(self._subscribers),
            created_at=self.created_at,
        )

    # ── the loop ──────────────────────────────────────────────────────
    async def _run_loop(self) -> None:
        logger.info("dunc: match %s loop starting at %.1f Hz", self.id, self.preset.hz)
        dt = 1.0 / max(self.preset.hz, 1e-6)
        try:
            while self._running:
                if self._paused:
                    await asyncio.sleep(dt)
                    continue

                frame = self.simulator.step()
                self.twins.ingest(frame)
                self.engine.tick(
                    t=frame.t,
                    twins=self.twins,
                    ball_xy=(frame.ball.x, frame.ball.y),
                    stream=self.insights,
                )

                payload = self._build_tick_payload(frame)
                await self._broadcast(payload)

                if frame.t >= self.preset.duration_seconds:
                    self._running = False
                    break
                await asyncio.sleep(dt)
        except asyncio.CancelledError:
            logger.info("dunc: match %s loop cancelled", self.id)
        finally:
            logger.info("dunc: match %s loop stopped", self.id)

    # ── frame serialization ───────────────────────────────────────────
    def _build_tick_payload(self, frame) -> dict:
        twins = {tw.player_id: tw for tw in self.twins.all()}
        players_out = []
        for sample in frame.players:
            tw = twins.get(sample.player_id)
            if tw is None:
                continue
            players_out.append(
                {
                    "id": tw.player_id,
                    "team": tw.team,
                    "number": tw.number,
                    "role": tw.role,
                    "x": round(tw.x, 2),
                    "y": round(tw.y, 2),
                    "vx": round(tw.vx, 2),
                    "vy": round(tw.vy, 2),
                    "speed": round(tw.speed, 2),
                    "distance_m": round(tw.distance_m, 1),
                    "fatigue": round(tw.fatigue, 3),
                    "zone": tw.zone,
                }
            )
        new_insights = [i.as_dict() for i in self.insights.drain_new()]
        return {
            "match_id": self.id,
            "t": int(frame.t * self.preset.hz),
            "clock_sec": round(frame.t, 2),
            "ball": {
                "x": round(frame.ball.x, 2),
                "y": round(frame.ball.y, 2),
                "vx": round(frame.ball.vx, 2),
                "vy": round(frame.ball.vy, 2),
            },
            "players": players_out,
            "insights": new_insights,
        }

    async def _broadcast(self, payload: dict) -> None:
        async with self._lock:
            queues = list(self._subscribers)
        for q in queues:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                # Slow subscriber — drop the oldest, keep up with real-time.
                try:
                    q.get_nowait()
                    q.put_nowait(payload)
                except Exception:
                    pass
