// D-U-N-C REST helpers.
//
// These are thin fetch wrappers hand-rolled instead of routed through the
// legacy `lib/api.ts` ApiClient — that client is tightly coupled to the
// auth token lifecycle and we want the dunc vertical to work for anonymous
// demo users on `thebigdunc.com` embeds.

import type {
  DuncAgentReply,
  DuncInsight,
  DuncMatchSummary,
  DuncRole,
  DuncScenario,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://latentocean.com";

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  return (await res.json()) as T;
}

export const duncApi = {
  health() {
    return j<{ status: string; vertical: string; version: string }>(
      "/api/v1/dunc/health",
    );
  },

  listMatches() {
    return j<DuncMatchSummary[]>("/api/v1/dunc/matches");
  },

  createMatch(preset = "demo", seed: number | null = null, hz: number = 10) {
    return j<DuncMatchSummary>("/api/v1/dunc/matches", {
      method: "POST",
      body: JSON.stringify({ preset, seed, hz }),
    });
  },

  getMatch(id: string) {
    return j<{
      summary: DuncMatchSummary;
      recent_insights: DuncInsight[];
    }>(`/api/v1/dunc/matches/${id}`);
  },

  start(id: string) {
    return j(`/api/v1/dunc/matches/${id}/start`, { method: "POST" });
  },

  pause(id: string) {
    return j(`/api/v1/dunc/matches/${id}/pause`, { method: "POST" });
  },

  resume(id: string) {
    return j(`/api/v1/dunc/matches/${id}/resume`, { method: "POST" });
  },

  stop(id: string) {
    return j(`/api/v1/dunc/matches/${id}/stop`, { method: "POST" });
  },

  trigger(id: string, scenario: DuncScenario) {
    return j(`/api/v1/dunc/matches/${id}/trigger`, {
      method: "POST",
      body: JSON.stringify({ scenario }),
    });
  },

  agentQuery(match_id: string, role: DuncRole, question: string) {
    return j<DuncAgentReply>("/api/v1/dunc/agent/query", {
      method: "POST",
      body: JSON.stringify({ match_id, role, question }),
    });
  },
};

// Compute the matching WebSocket URL for a match stream.
// Uses the alt WS route at /api/v1/dunc/matches/{id}/ws so it goes through
// the same /api/ nginx proxy as REST calls — no separate WS proxy needed.
export function duncWsUrl(matchId: string): string {
  // Always derive from window.location so it works through any proxy/domain.
  // Falls back to localhost only on SSR (which never actually connects a WS).
  if (typeof window === "undefined") {
    return `ws://localhost:8000/api/v1/dunc/matches/${matchId}/ws`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/v1/dunc/matches/${matchId}/ws`;
}
