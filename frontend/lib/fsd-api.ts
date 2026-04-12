/**
 * Franklin Street Data API client
 * Calls franklin-street-data.fly.dev directly from browser (CORS *)
 */

const FSD_BASE = "https://franklin-street-data.fly.dev";

// ── Types ──────────────────────────────────────────────────

export interface FSDSignals {
  time_profile: string;
  weather: string;
  events: string;
  news?: string;
  search_convergence?: string;
  day_of_week?: string;
  status: string;
}

export interface FSDSpot {
  rank: number;
  name: string;
  lat: number;
  lon: number;
  amenity_type: string;
  busyness: number;
  composite_score: number;
  cuisine: string;
  opening_hours: string;
  phone: string;
  website: string;
  address: string;
  outdoor_seating: string;
  brand: string;
  category: string;
  closed: boolean;
  signals: FSDSignals;
}

export type FSDHeatmapPoint = [number, number, number]; // [lat, lon, weight]

export interface FSDDensity {
  engine: string;
  algorithm: string;
  equation: string;
  hour: number;
  day_of_week: number;
  grid_size: number;
  nash_gap: number;
  iterations: number;
  converged: boolean;
  venue_busyness: Record<string, {
    busyness: number;
    closed?: boolean;
    signals: FSDSignals;
  }>;
}

export interface FSDLocalTopic {
  source: string;
  topic: string;
  score: number;
}

export interface FSDTrends {
  has_data: boolean;
  geo: string;
  geo_description: string;
  type_interest: Record<string, number>;
  local_topics: FSDLocalTopic[];
  suggestions: string[];
  trending_now: string[];
  locally_relevant: string[];
  timestamp: string;
}

export interface FSDStatus {
  status: string;
  version: string;
  engine: string;
  timestamp: string;
  data_feeds: Record<string, string>;
  surveillance_area: {
    center: [number, number];
    radius_meters: number;
    venue_source: string;
    busyness_source: string;
  };
}

// ── Fetch helpers ──────────────────────────────────────────

async function fsdFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FSD_BASE}${path}`);
  if (!res.ok) throw new Error(`FSD API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export function fetchSpots(hour: number) {
  return fsdFetch<{ spots: FSDSpot[] }>(`/spots?hour=${hour}`);
}

export function fetchHeatmap(hour: number) {
  return fsdFetch<{ heatmap: FSDHeatmapPoint[] }>(`/heatmap?hour=${hour}`);
}

export function fetchDensity(hour: number) {
  return fsdFetch<FSDDensity>(`/density?hour=${hour}`);
}

export function fetchTrends() {
  return fsdFetch<FSDTrends>(`/trends?live=true`);
}

export function fetchStatus() {
  return fsdFetch<FSDStatus>(`/status`);
}

export interface FSDWeather {
  conditions: string;
  temperature_f: number;
  wind_mph?: number;
  humidity_pct?: number;
  outdoor_friendly: boolean;
  source?: string;
}

export interface FSDEvent {
  name: string;
  date?: string;
  event_type?: string;
  location?: string;
  url?: string;
}

export interface FSDIntel {
  weather?: FSDWeather;
  demographics?: {
    total_population?: number;
    college_age_pct?: number;
    median_income?: number;
    source?: string;
  };
  events?: {
    count: number;
    events: FSDEvent[];
    source?: string;
  };
  timestamp?: string;
}

export function fetchIntel() {
  return fsdFetch<FSDIntel>(`/intel`);
}

export interface FSDConvergenceItem {
  venue_name: string;
  venue_type: string;
  convergence_score: number;
  matching_keywords: string[];
  lat?: number;
  lon?: number;
}

export interface FSDConvergence {
  converging_venues: FSDConvergenceItem[];
  top_keywords: string[];
  timestamp: string;
}

export function fetchConvergence() {
  return fsdFetch<FSDConvergence>(`/convergence`);
}

// ── Backend API (crystallized modules) ────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://latentocean.com";

export interface FSDModuleSummary {
  id: string;
  name: string;
  module_index: number;
  entity_count: number;
  dominant_type: string | null;
  purity_score: number | null;
}

export interface FSDModulesResponse {
  status: string;
  timestamp: string | null;
  dataset_id: string | null;
  job_id: string | null;
  module_count: number;
  modules: FSDModuleSummary[];
  error: string | null;
}

export async function fetchFSDModules(token: string): Promise<FSDModulesResponse> {
  const res = await fetch(`${API_BASE}/api/v1/fsd/modules`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`FSD modules API error: ${res.status}`);
  return res.json();
}

export async function triggerFSDCrystallization(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/fsd/crystallize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`FSD trigger error: ${res.status}`);
  return res.json();
}
