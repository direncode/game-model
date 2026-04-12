/**
 * Frontend client + types for the Latent Ocean Data Layer REST API.
 *
 * Mirrors backend/app/api/v1/data_layer.py exactly. If you change the
 * Pydantic models there, update this file to match — both sides are
 * hand-written because the project doesn't run an OpenAPI codegen step.
 *
 * Usage:
 *   import { dataLayerClient } from "@/lib/data-layer";
 *   const res = await dataLayerClient.run({ source: "edgar", limit: 500 });
 *   console.log(res.quality.coverage_at_1_0);
 */

const API_BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) ||
  "https://latentocean.com";

// ── Type mirrors for REST request/response schemas ────────────────────

export interface SourceInfo {
  id: string;
  name: string;
  description: string;
  lookup_field: string;
  lookup_label: string;
}

export interface CostBreakdown {
  adapter_usd: number;
  compute_usd: number;
  storage_usd: number;
  total_usd: number;
}

export interface QualityMetrics {
  n_input: number;
  n_survivors: number;
  reduction_ratio: number;
  /**
   * var(survivors) / var(full_population) in 8D space. Values > 1.0
   * mean BTUT deliberately over-sampled outliers, which is the intended
   * behavior of anomaly-weighted selection. Not a preservation fraction.
   */
  variance_ratio: number;
  /** Fraction of input points whose nearest survivor is within d<=1.0. */
  coverage_at_1_0: number;
  reconstruction_median_nn: number;
  n_clusters: number;
  unique_fingerprints: number;
  wall_seconds: number;
  estimated_cost_usd: number;
  cost_breakdown: CostBreakdown;
}

export type VerticalName = "niv" | "tcd_jepa" | "data";

export interface RunRequest {
  source: string;
  limit?: number;
  target_survivors?: number;
  budget_dollars?: number;
  compute_3d_display?: boolean;
  vertical?: VerticalName;
}

export interface RunResponse {
  dataset_id: string;
  quality: QualityMetrics;
  vertical: VerticalName | null;
  payload: Record<string, unknown> | null;
}

export type LinkSignal =
  | "cosine"
  | "foreign_key"
  | "semantic_field"
  | "url_hierarchy";

export interface CausalLink {
  source_a: string;
  source_b: string;
  signal: LinkSignal;
  strength: number;
}

export interface LinkRequest {
  source_a: string;
  source_b: string;
  limit?: number;
  target_survivors?: number;
  budget_dollars?: number;
  cosine_threshold?: number;
}

export interface LinkResponse {
  dataset_a: string;
  dataset_b: string;
  quality_a: QualityMetrics;
  quality_b: QualityMetrics;
  n_links: number;
  links_by_signal: Record<string, number>;
  links: CausalLink[];
  max_links_returned: number;
}

// Vertical export payload shapes (for when the frontend consumes
// exports directly rather than going through /data-layer/run).

export interface SurvivorNivPayload {
  entity: Record<string, unknown>;
  coord_8d: number[];
  scores: Record<string, number>;
  cluster: number;
}

export interface NivExport {
  vertical: "niv";
  dataset_id: string;
  n_survivors: number;
  survivors: SurvivorNivPayload[];
  quality: QualityMetrics;
}

export interface TcdJepaExport {
  vertical: "tcd_jepa";
  dataset_id: string;
  embeddings_8d: number[][];
  entity_ids: string[];
  entity_types: string[];
  clusters: number[];
}

// ── Client ──────────────────────────────────────────────────────────────

async function dlFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`data-layer ${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const dataLayerClient = {
  /**
   * GET /api/v1/data-layer/sources
   * List registered dataset adapters.
   */
  async listSources(): Promise<SourceInfo[]> {
    return dlFetch<SourceInfo[]>("/data-layer/sources");
  },

  /**
   * POST /api/v1/data-layer/run
   * Run the full pipeline on a single source.
   *
   * This is synchronous on the backend. For large ingests (limit >
   * 5000) set a generous client timeout — the backend default is the
   * FastAPI default of no timeout, but browsers may time out around
   * 60–120s. Consider chunking the request on the backend side.
   */
  async run(req: RunRequest): Promise<RunResponse> {
    return dlFetch<RunResponse>("/data-layer/run", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * POST /api/v1/data-layer/link
   * Cross-source causal linking. Runs the pipeline on two sources
   * and returns all four-signal links between their survivors.
   */
  async link(req: LinkRequest): Promise<LinkResponse> {
    return dlFetch<LinkResponse>("/data-layer/link", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  async buildOcean(req: OceanBuildRequest): Promise<OceanManifestResponse> {
    return dlFetch<OceanManifestResponse>("/data-layer/ocean/build", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  async buildOceanAsync(req: OceanBuildRequest): Promise<{ job_id: string; status: string }> {
    return dlFetch<{ job_id: string; status: string }>("/data-layer/ocean/build-async", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
};

// ── Formatting helpers ──────────────────────────────────────────────────

// ── Ocean types ────────────────────────────────────────────────────────

export interface OceanBuildRequest {
  sources?: string[];
  limits?: Record<string, number>;
  default_limit?: number;
  target_survivors?: number;
  budget_dollars?: number;
  cosine_threshold?: number;
}

export interface OceanSourceSummary {
  source_id: string;
  n_input: number;
  n_survivors: number;
  reduction_ratio: number;
  coverage_at_1_0: number;
  variance_ratio: number;
  wall_seconds: number;
  cost_usd: number;
}

export interface OceanCrossLink {
  source_a: string;
  source_b: string;
  n_links: number;
  links_by_signal: Record<string, number>;
}

export interface OceanSurvivorOut {
  name: string;
  type: string;
  source_id: string;
  display_name: string;
  cluster: number;
  composite_score: number;
  coord_3d: [number, number, number] | null;
}

export interface OceanManifestResponse {
  sources: OceanSourceSummary[];
  n_total_survivors: number;
  survivors: OceanSurvivorOut[];
  cross_links: OceanCrossLink[];
  link_matrix: Record<string, Record<string, number>>;
  total_cost_usd: number;
  total_wall_seconds: number;
  benchmark: Record<string, unknown>[];
}

export const SOURCE_COLORS: Record<string, string> = {
  edgar: "#00d4ff",
  pubmed: "#3fb950",
  patents: "#a371f7",
  comtrade: "#d29922",
  climate: "#388bfd",
  tesla: "#f85149",
};

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

export function formatReduction(ratio: number): string {
  return `${ratio}×`;
}

export function describeCoverage(coverage: number): string {
  if (coverage >= 0.95) return "excellent";
  if (coverage >= 0.85) return "good";
  if (coverage >= 0.70) return "acceptable";
  return "poor";
}
