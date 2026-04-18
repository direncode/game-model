// D-U-N-C Predictions REST helpers.

import type { MatchPrediction, ModelStatus } from "./types";

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

export const predictionsApi = {
  health() {
    return j<{ status: string }>("/api/v1/dunc/predictions/health");
  },

  modelStatus() {
    return j<ModelStatus>("/api/v1/dunc/predictions/model/status");
  },

  analyze(home_team: string, away_team: string, league = "Premier League") {
    return j<MatchPrediction>("/api/v1/dunc/predictions/analyze", {
      method: "POST",
      body: JSON.stringify({ home_team, away_team, league }),
    });
  },

  refreshModel() {
    return j<ModelStatus>("/api/v1/dunc/predictions/model/refresh", {
      method: "POST",
    });
  },
};
