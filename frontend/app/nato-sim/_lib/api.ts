/**
 * Typed fetch wrappers for the /api/v1/nato_sim endpoints.
 *
 * All reads use `{cache: "no-store"}` because analytical findings are
 * expected to change during the sim. Callers in server components can
 * await these directly.
 */

export interface Finding {
  id: string;
  topic: string;
  kind: string;
  text: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  citations?: string[] | null;
  generated_at: string;
  superseded_by: string | null;
}

export interface Message {
  id: string;
  source: string;
  channel: string | null;
  author: string | null;
  content: string;
  ts: string;
  priority: "FLASH" | "IMMEDIATE" | "PRIORITY" | "ROUTINE" | null;
  outlier_score?: number | null;
  outlier_signals?: string | null;
}

export interface NetworkSnapshot {
  nodes: { id: string; name: string; type: string; degree: number }[];
  edges: { from_entity: string; to_entity: string; kind: string; weight: number }[];
}

export interface QueryResult {
  answer: string;
  sources: { title: string | null; origin: string | null; url: string | null }[];
}

export interface CorpusDoc {
  id: string;
  origin: string;
  url: string | null;
  title: string;
  text: string;
  source_tier: number | null;
}

function apiBase(): string {
  // Server-side: talk to the backend directly (skips nginx rewrites during dev).
  if (typeof window === "undefined") {
    return process.env.NATO_SIM_BACKEND_URL ?? "http://localhost:8000";
  }
  // Client-side: use same-origin so access-code cookie travels.
  return "";
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase()}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getFindings(
  kind?: string,
  topic?: string,
  limit = 20,
): Promise<Finding[]> {
  const q = new URLSearchParams();
  if (kind) q.set("kind", kind);
  if (topic) q.set("topic", topic);
  q.set("limit", String(limit));
  const data = await getJson<{ items: Finding[] }>(
    `/api/v1/nato_sim/findings?${q.toString()}`,
  );
  return data?.items ?? [];
}

export async function getFinding(id: string): Promise<Finding | null> {
  const data = await getJson<{ finding: Finding }>(
    `/api/v1/nato_sim/findings/${id}`,
  );
  return data?.finding ?? null;
}

export async function getDailyRead(): Promise<Finding | null> {
  const items = await getFindings("daily-read", undefined, 1);
  return items[0] ?? null;
}

export async function getActorCards(): Promise<Finding[]> {
  return getFindings("actor-card", undefined, 50);
}

export async function getActorCard(actor: string): Promise<Finding | null> {
  const items = await getFindings("actor-card", actor, 1);
  return items[0] ?? null;
}

export async function getWatchboardItems(): Promise<Finding[]> {
  return getFindings("watchboard-item", undefined, 50);
}

export async function getDissents(): Promise<Finding[]> {
  return getFindings("dissent", undefined, 50);
}

export async function getNetworkSnapshot(limit = 50): Promise<NetworkSnapshot> {
  const data = await getJson<NetworkSnapshot>(
    `/api/v1/nato_sim/network?limit=${limit}`,
  );
  return data ?? { nodes: [], edges: [] };
}

export async function getCorpusDocs(limit = 50): Promise<CorpusDoc[]> {
  const data = await getJson<{ items: CorpusDoc[] }>(
    `/api/v1/nato_sim/messages?limit=${limit}`,
  );
  return data?.items ?? [];
}

export async function liveQuery(q: string): Promise<QueryResult | null> {
  try {
    const res = await fetch("/api/v1/nato_sim/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    });
    if (!res.ok) return null;
    return (await res.json()) as QueryResult;
  } catch {
    return null;
  }
}

export async function postPaste(content: string): Promise<{ id: string } | null> {
  try {
    const res = await fetch("/api/v1/nato_sim/ingest/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { id: string };
  } catch {
    return null;
  }
}
