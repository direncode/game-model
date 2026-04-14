const BASE = "/api/v1/flow-engine";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Flow engine API error: ${res.status}`);
  return res.json();
}

export interface WellHealth {
  well_id: string;
  label: string;
  state: string;
  saturation: number;
  conversion: number;
  impulse: number;
  staleness: number;
  alert_level: string;
}

export interface WireInfo {
  source: string;
  sink: string;
  state: string;
  liquidity: number;
  friction: number;
}

export interface SystemMetrics {
  resilience: number;
  circulation_rate: number;
  saturation_pressure: number;
  friction_index: number;
}

export interface GraphState {
  wells: WellHealth[];
  wires: WireInfo[];
  metrics: SystemMetrics;
}

export const flowEngineApi = {
  graphState: () => request<GraphState>("/graph"),
  wells: () => request<WellHealth[]>("/wells"),
  metrics: () => request<SystemMetrics>("/metrics"),
};
