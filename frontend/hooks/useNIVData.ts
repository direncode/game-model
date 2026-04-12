"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────
export interface NIVComponents {
  thrust: number; efficiency: number; efficiency_squared: number;
  slack: number; drag_total: number; drag_spread: number;
  drag_real_rate: number; drag_vol: number;
}
export interface Alert {
  level: "normal" | "elevated" | "warning" | "critical";
  action: string; dollar_stakes: number; invalidation_prob: number;
}
export interface NIVLatest {
  date: string; niv_score: number; recession_probability: number;
  components: NIVComponents; alert: Alert; smoothed_niv?: number;
}
export interface HistoryFullItem {
  date: string; niv_score: number; recession_probability: number;
  smoothed_niv?: number; thrust: number; efficiency_squared: number;
  slack: number; drag_total: number; drag_spread: number;
  drag_real_rate: number; drag_vol: number;
  alert_level: string; dollar_stakes: number;
}
export interface HistoryFullResponse {
  data: HistoryFullItem[]; count: number; nber_recessions: string[][];
}
export interface EnsembleExplain {
  date: string; per_learner: Record<string, number>;
  combined: number; lr_coefficients: Record<string, number>;
  feature_names: string[]; disagreement: number;
}
export interface WFSeriesItem {
  date: string; prob: number; lower: number; upper: number; retrained: boolean;
}
export interface WFSeriesResponse {
  predictions: WFSeriesItem[]; horizons: number[];
  auc_by_horizon: Record<string, number>; brier_by_horizon: Record<string, number>;
  f1_by_horizon: Record<string, number>; n_folds: number;
}
export interface WalkForwardResult {
  horizons: number[]; auc_by_horizon: Record<string, number>;
  brier_by_horizon: Record<string, number>; f1_by_horizon: Record<string, number>;
  n_folds: number; n_skipped: number; warnings: string[];
}
export interface OrthogonalResult {
  fraction: number; ci_95: number[]; betas: Record<string, number>;
  benchmark_series: string; n_obs: number;
}
export interface ProtocolDResult {
  freeze_date: string; auc_by_horizon: Record<string, number>;
  brier_by_horizon: Record<string, number>;
  n_forward_months: number; n_retrain: number;
}
export interface NIVHealth {
  status: string; fred_api_key_set: boolean; vintage: string;
}

// ── Hook ───────────────────────────────────────────────────────────────
export function useNIVData() {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const latest = useQuery<NIVLatest>({
    queryKey: ["niv-latest"],
    queryFn: () => api.get("/api/v1/niv/latest"),
    refetchInterval: 60_000,
  });

  const historyFull = useQuery<HistoryFullResponse>({
    queryKey: ["niv-history-full"],
    queryFn: () => api.get("/api/v1/niv/history/full"),
    staleTime: 5 * 60_000,
  });

  const health = useQuery<NIVHealth>({
    queryKey: ["niv-health"],
    queryFn: () => api.get("/api/v1/niv/health"),
    staleTime: 30_000,
  });

  const ensembleExplain = useQuery<EnsembleExplain>({
    queryKey: ["niv-ensemble-explain"],
    queryFn: () => api.get("/api/v1/niv/ensemble/explain"),
    staleTime: 5 * 60_000,
  });

  const walkforward = useMutation<WalkForwardResult>({
    mutationFn: () => api.post("/api/v1/niv/walkforward", { horizons: [3, 6, 12, 18], combiner: "log_odds" }),
  });

  const walkforwardSeries = useQuery<WFSeriesResponse>({
    queryKey: ["niv-wf-series"],
    queryFn: () => api.get("/api/v1/niv/walkforward/series"),
    staleTime: 10 * 60_000,
    enabled: false,
  });

  const protocolD = useMutation<ProtocolDResult>({
    mutationFn: () => api.post("/api/v1/niv/protocol-d", { freeze_date: "2022-12-01", horizons: [3, 6, 12, 18] }),
  });

  const orthogonal = useMutation<OrthogonalResult>({
    mutationFn: () => api.post("/api/v1/niv/orthogonal-variance", { benchmark_series: "T10Y3M", lags: 6 }),
  });

  const focusedMonth = focusedIndex !== null && historyFull.data
    ? historyFull.data.data[focusedIndex] ?? null
    : null;

  return {
    latest, historyFull, health, ensembleExplain,
    walkforward, walkforwardSeries, protocolD, orthogonal,
    focusedIndex, setFocusedIndex, focusedMonth,
  };
}
