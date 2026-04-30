/**
 * RunPod async client. Gated on RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID env.
 *
 * Submits TCD-JEPA crystallization jobs to a RunPod Serverless endpoint
 * that runs the Python handler under runpod/handler.py. The endpoint
 * receives entities + edges + config and returns discovered modules /
 * persistence diagram artifacts.
 *
 * If env isn't configured (e.g. local dev, smoke test), every call
 * returns { available: false, ... } and the caller falls back to
 * Node-side crystallization.
 */

const RUNPOD_BASE = "https://api.runpod.ai/v2";

export type RunPodSubmitResult =
  | { available: true; status: "submitted"; runpod_job_id: string; estimated_seconds?: number }
  | { available: false; reason: string };

export type RunPodPollResult =
  | { available: true; status: "in_queue" | "in_progress" | "completed" | "failed"; output?: unknown; error?: string }
  | { available: false; reason: string };

export type RunPodInput = {
  entities: { name: string; type: string; attributes?: Record<string, unknown> }[];
  edges?: { source: string; target: string; type?: string; weight?: number }[];
  config?: Record<string, unknown>;
  dataset_id?: string;
  job_id?: string;
};

function envConfig(): { key: string; endpoint: string } | null {
  const key = process.env.RUNPOD_API_KEY;
  const endpoint = process.env.RUNPOD_ENDPOINT_ID;
  if (!key || !endpoint) return null;
  return { key, endpoint };
}

export function isRunPodAvailable(): boolean {
  return envConfig() !== null;
}

export async function submitRunPodJob(input: RunPodInput): Promise<RunPodSubmitResult> {
  const cfg = envConfig();
  if (!cfg) return { available: false, reason: "RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID not set" };

  try {
    const res = await fetch(`${RUNPOD_BASE}/${cfg.endpoint}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { available: false, reason: `runpod /run -> HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string; status?: string };
    if (!data.id) return { available: false, reason: "runpod response missing job id" };
    return { available: true, status: "submitted", runpod_job_id: data.id };
  } catch (e) {
    return { available: false, reason: `runpod submit error: ${e}` };
  }
}

export async function pollRunPodJob(jobId: string): Promise<RunPodPollResult> {
  const cfg = envConfig();
  if (!cfg) return { available: false, reason: "RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID not set" };

  try {
    const res = await fetch(`${RUNPOD_BASE}/${cfg.endpoint}/status/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${cfg.key}` },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { available: false, reason: `runpod /status -> HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    const data = (await res.json()) as { status?: string; output?: unknown; error?: string };
    const s = (data.status || "").toUpperCase();
    const status: "in_queue" | "in_progress" | "completed" | "failed" =
      s === "IN_QUEUE" ? "in_queue" :
      s === "IN_PROGRESS" || s === "RUNNING" ? "in_progress" :
      s === "COMPLETED" ? "completed" :
      s === "FAILED" ? "failed" :
      "in_progress";
    return { available: true, status, output: data.output, error: data.error };
  } catch (e) {
    return { available: false, reason: `runpod poll error: ${e}` };
  }
}
