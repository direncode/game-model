import type {
  DuncAgentReply,
  DuncInsight,
  DuncMatchSummary,
  DuncRole,
  DuncScenario,
} from "./types";

const API_BASE = "https://latentocean.com";

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
    return j<{ status: string; vertical: string; version: string }>("/api/v1/dunc/health");
  },
  listMatches() {
    return j<DuncMatchSummary[]>("/api/v1/dunc/matches");
  },
  createMatch(preset = "demo", seed: number | null = null, hz: number = 10, pl_preset: string | null = null) {
    return j<DuncMatchSummary>("/api/v1/dunc/matches", {
      method: "POST",
      body: JSON.stringify({ preset, seed, hz, pl_preset }),
    });
  },
  getMatch(id: string) {
    return j<{ summary: DuncMatchSummary; recent_insights: DuncInsight[] }>(`/api/v1/dunc/matches/${id}`);
  },
  start(id: string) { return j(`/api/v1/dunc/matches/${id}/start`, { method: "POST" }); },
  pause(id: string) { return j(`/api/v1/dunc/matches/${id}/pause`, { method: "POST" }); },
  resume(id: string) { return j(`/api/v1/dunc/matches/${id}/resume`, { method: "POST" }); },
  stop(id: string) { return j(`/api/v1/dunc/matches/${id}/stop`, { method: "POST" }); },
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

export function duncWsUrl(matchId: string): string {
  if (typeof window === "undefined") {
    return `ws://localhost:8000/api/v1/dunc/matches/${matchId}/ws`;
  }
  return `wss://latentocean.com/api/v1/dunc/matches/${matchId}/ws`;
}
