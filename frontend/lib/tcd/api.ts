import type {
  ModuleEntry,
  IntelligenceEngine,
  MarketplaceModule,
  AgentResponse,
} from "./types";

const API = "/api/v1/tcd";

export async function fetchLatestSession(): Promise<{
  session_id: string;
  preset: string;
  created_at: string;
  intelligence_engines_cached: number;
} | null> {
  const res = await fetch(`${API}/verticals/latest`);
  if (!res.ok) return null;
  return res.json();
}

export async function startDemo(): Promise<{
  session_id: string;
  job_id: string;
  ws_url: string;
}> {
  const res = await fetch(`${API}/verticals/demo`, { method: "POST" });
  if (!res.ok) throw new Error(`Demo start failed: ${res.status}`);
  return res.json();
}

export async function fetchModules(
  sessionId: string
): Promise<{ modules: ModuleEntry[]; total: number }> {
  const res = await fetch(`${API}/verticals/${sessionId}/modules`);
  if (!res.ok) return { modules: [], total: 0 };
  return res.json();
}

export async function fetchIntelligence(
  sessionId: string,
  engine?: string
): Promise<any> {
  const path = engine
    ? `${API}/verticals/${sessionId}/intelligence/${engine}`
    : `${API}/verticals/${sessionId}/intelligence`;
  const res = await fetch(path);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchConvergenceHistory(
  sessionId: string
): Promise<any[]> {
  const res = await fetch(
    `${API}/verticals/${sessionId}/intelligence/convergence-history`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export async function fetchMarketplace(
  sessionId: string
): Promise<{ modules: MarketplaceModule[]; total: number }> {
  const res = await fetch(`${API}/verticals/${sessionId}/marketplace`);
  if (!res.ok) return { modules: [], total: 0 };
  return res.json();
}

export async function queryAgent(
  sessionId: string,
  question: string
): Promise<AgentResponse> {
  const res = await fetch(`${API}/verticals/${sessionId}/agent/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`Agent query failed: ${res.status}`);
  return res.json();
}

export async function exportModule(
  moduleId: string,
  format: "json" | "pt"
): Promise<Blob> {
  const res = await fetch(`${API}/modules/${moduleId}/export?format=${format}`);
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}

export async function licenseModule(
  moduleId: string
): Promise<{ license_key: string }> {
  const res = await fetch(`${API}/modules/${moduleId}/license`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`License failed: ${res.status}`);
  return res.json();
}

export function wsUrl(jobId: string): string {
  const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:8000";
  return `${proto}//${host}/ws/crystallization/${jobId}`;
}
