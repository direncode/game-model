// WS client hook for D-U-N-C live match streams.
//
// Design notes:
// - We do NOT use socket.io because the backend speaks raw FastAPI WebSocket.
//   The repo has socket.io-client in package.json for other verticals, but
//   wrapping a raw WS in a small hook is simpler and has zero bridging cost.
// - The hook owns a single WebSocket per matchId and tears it down on unmount.
// - Messages are dispatched into the Zustand store; components are
//   subscribed via selectors and re-render at the frame rate.
// - Reconnect is a simple exponential backoff. v0 only — we'll replace
//   with a real retry policy once this is load-tested.

"use client";

import { useEffect, useRef } from "react";
import { duncWsUrl } from "./api";
import { useDuncStore } from "./store";
import type { DuncFrame } from "./types";

export function useDuncMatchStream(matchId: string | null) {
  const applyTick = useDuncStore((s) => s.applyTick);
  const applyPrelude = useDuncStore((s) => s.applyPrelude);
  const reset = useDuncStore((s) => s.reset);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!matchId) return;
    reset();

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const url = duncWsUrl(matchId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
      };
      ws.onmessage = (ev) => {
        try {
          const frame = JSON.parse(ev.data) as DuncFrame;
          if (frame.type === "tick") {
            applyTick({
              t: frame.t,
              clock_sec: frame.clock_sec,
              ball: frame.ball,
              players: frame.players,
              insights: frame.insights,
              active_scenarios: (frame as any).active_scenarios,
              match_info: (frame as any).match_info,
            });
          } else if (frame.type === "prelude") {
            applyPrelude(frame.recent_insights);
          } else if (frame.type === "ping") {
            // No-op — keepalive from server
          }
        } catch {
          // Malformed frame — drop it
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        // Exponential backoff up to 5s.
        retryRef.current = Math.min(retryRef.current + 1, 5);
        const delay = Math.min(250 * 2 ** retryRef.current, 5000);
        timeoutRef.current = setTimeout(connect, delay);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* noop */
        }
      }
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);
}
