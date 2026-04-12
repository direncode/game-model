import { useEffect, useRef } from "react";
import { useTCDStore } from "./store";
import { wsUrl } from "./api";
import type { StreamEvent } from "./types";

export function useTCDStream(jobId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const applyStreamEvent = useTCDStore((s) => s.applyStreamEvent);
  const fetchModules = useTCDStore((s) => s.fetchModules);
  const fetchIntelligence = useTCDStore((s) => s.fetchIntelligence);
  const fetchConvergence = useTCDStore((s) => s.fetchConvergence);
  const fetchMarketplace = useTCDStore((s) => s.fetchMarketplace);

  useEffect(() => {
    if (!jobId) return;

    const url = wsUrl(jobId);
    let reconnectDelay = 1000;
    let closed = false;

    function connect() {
      if (closed) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const event: StreamEvent = JSON.parse(e.data);
          applyStreamEvent(event);

          // When complete, fetch all data
          if (event.stage === "complete") {
            setTimeout(() => {
              fetchModules();
              fetchIntelligence();
              fetchConvergence();
              fetchMarketplace();
            }, 500);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!closed) {
          setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 5000);
        }
      };

      ws.onerror = () => ws.close();
      ws.onopen = () => { reconnectDelay = 1000; };
    }

    connect();

    return () => {
      closed = true;
      wsRef.current?.close();
    };
  }, [jobId, applyStreamEvent, fetchModules, fetchIntelligence, fetchConvergence, fetchMarketplace]);
}
