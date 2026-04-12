"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────
interface NIVComponents {
  thrust: number;
  efficiency: number;
  efficiency_squared: number;
  slack: number;
  drag_total: number;
  drag_spread: number;
  drag_real_rate: number;
  drag_vol: number;
}

interface Alert {
  level: "normal" | "elevated" | "warning" | "critical";
  action: string;
  dollar_stakes: number;
  invalidation_prob: number;
}

interface NIVLatest {
  date: string;
  niv_score: number;
  recession_probability: number;
  components: NIVComponents;
  alert: Alert;
  smoothed_niv?: number;
}

interface NIVHistoryItem {
  date: string;
  niv_score: number;
  recession_probability: number;
  smoothed_niv?: number;
}

interface WalkForwardResult {
  horizons: number[];
  auc_by_horizon: Record<string, number>;
  brier_by_horizon: Record<string, number>;
  f1_by_horizon: Record<string, number>;
  n_folds: number;
  n_skipped: number;
  warnings: string[];
}

interface OrthogonalResult {
  fraction: number;
  ci_95: number[];
  betas: Record<string, number>;
  benchmark_series: string;
  n_obs: number;
}

// ── Alert color mapping ────────────────────────────────────────────────
const alertColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  normal:   { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", glow: "shadow-emerald-500/20" },
  elevated: { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/30",   glow: "shadow-amber-500/20" },
  warning:  { bg: "bg-orange-500/10",  text: "text-orange-400",  border: "border-orange-500/30",  glow: "shadow-orange-500/20" },
  critical: { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/30",     glow: "shadow-red-500/20" },
};

// ── Gauge SVG ──────────────────────────────────────────────────────────
function RecessionGauge({ probability, alert }: { probability: number; alert: string }) {
  const pct = Math.min(probability, 1);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * 0.75;
  const offset = dash * (1 - pct);
  const colors = alertColors[alert] || alertColors.normal;

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="90" viewBox="0 0 140 90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#1a1a1a" strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset="0"
          transform="rotate(135 70 70)" strokeLinecap="round" />
        <circle cx="70" cy="70" r={r} fill="none"
          stroke={alert === "critical" ? "#ef4444" : alert === "warning" ? "#f97316" : alert === "elevated" ? "#eab308" : "#10b981"}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={offset}
          transform="rotate(135 70 70)" strokeLinecap="round"
          className="transition-all duration-1000" />
        <text x="70" y="62" textAnchor="middle" fill="white" fontSize="22"
          fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          {(probability * 100).toFixed(0)}%
        </text>
        <text x="70" y="78" textAnchor="middle" fill="#666" fontSize="9"
          fontFamily="JetBrains Mono, monospace" textTransform="uppercase">
          P(recession)
        </text>
      </svg>
    </div>
  );
}

// ── Component bar ──────────────────────────────────────────────────────
function ComponentBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(Math.abs(value) / max, 1) * 100;
  const isNeg = value < 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-li-text-muted w-20 text-right font-mono">{label}</span>
      <div className="flex-1 h-2 bg-li-gray-900 rounded-full overflow-hidden relative">
        {isNeg ? (
          <div className={cn("absolute right-1/2 h-full rounded-full", color)}
            style={{ width: `${pct / 2}%` }} />
        ) : (
          <div className={cn("absolute left-1/2 h-full rounded-full", color)}
            style={{ width: `${pct / 2}%` }} />
        )}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-li-gray-700" />
      </div>
      <span className="text-xs font-mono text-li-text-secondary w-16 text-right">
        {value >= 0 ? "+" : ""}{value.toFixed(4)}
      </span>
    </div>
  );
}

// ── AUC table ──────────────────────────────────────────────────────────
function AUCTable({ result }: { result: WalkForwardResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-li-gray-800">
            <th className="text-left py-2 px-3 text-li-text-muted font-medium text-xs uppercase tracking-wider">Horizon</th>
            <th className="text-right py-2 px-3 text-li-text-muted font-medium text-xs uppercase tracking-wider">AUC</th>
            <th className="text-right py-2 px-3 text-li-text-muted font-medium text-xs uppercase tracking-wider">Brier</th>
            <th className="text-right py-2 px-3 text-li-text-muted font-medium text-xs uppercase tracking-wider">F1@50%</th>
          </tr>
        </thead>
        <tbody>
          {result.horizons.map((h) => {
            const auc = result.auc_by_horizon[String(h)] ?? 0.5;
            const brier = result.brier_by_horizon[String(h)] ?? 0.25;
            const f1 = result.f1_by_horizon[String(h)] ?? 0;
            return (
              <tr key={h} className="border-b border-li-gray-900 hover:bg-white/[0.02]">
                <td className="py-2.5 px-3 font-mono text-white">{h}m</td>
                <td className={cn("py-2.5 px-3 text-right font-mono",
                  auc >= 0.75 ? "text-emerald-400" : auc >= 0.65 ? "text-amber-400" : "text-li-text-secondary"
                )}>{auc.toFixed(4)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-li-text-secondary">{brier.toFixed(4)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-li-text-secondary">{f1.toFixed(4)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 text-xs text-li-text-muted px-3">
        {result.n_folds} folds, {result.n_skipped} skipped
        {result.warnings.length > 0 && ` | ${result.warnings.length} warnings`}
      </div>
    </div>
  );
}

// ── History sparkline (ASCII for now, upgradeable to recharts) ────────
function HistorySparkline({ data }: { data: NIVHistoryItem[] }) {
  if (!data.length) return null;
  const scores = data.map(d => d.niv_score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  // Show last 60 months
  const recent = data.slice(-60);
  const barHeight = 40;

  return (
    <div className="flex items-end gap-px h-10">
      {recent.map((d, i) => {
        const h = ((d.niv_score - min) / range) * barHeight;
        const isNeg = d.niv_score < 0;
        return (
          <div
            key={i}
            className={cn("w-1 rounded-t-sm transition-all", isNeg ? "bg-red-500/60" : "bg-emerald-500/60")}
            style={{ height: `${Math.max(h, 1)}px` }}
            title={`${d.date}: NIV ${d.niv_score.toFixed(1)}`}
          />
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────
export default function NIVPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "walkforward" | "orthogonal">("overview");

  const { data: latest, isLoading: loadingLatest } = useQuery<NIVLatest>({
    queryKey: ["niv-latest"],
    queryFn: () => api.get("/api/v1/niv/latest"),
    refetchInterval: 60_000,
  });

  const { data: history } = useQuery<{ data: NIVHistoryItem[]; count: number }>({
    queryKey: ["niv-history"],
    queryFn: () => api.get("/api/v1/niv/history"),
  });

  const { data: health } = useQuery<{ status: string; fred_api_key_set: boolean; vintage: string }>({
    queryKey: ["niv-health"],
    queryFn: () => api.get("/api/v1/niv/health"),
  });

  const walkforwardMutation = useMutation<WalkForwardResult>({
    mutationFn: () => api.post("/api/v1/niv/walkforward", { horizons: [3, 6, 12, 18], combiner: "log_odds" }),
  });

  const orthogonalMutation = useMutation<OrthogonalResult>({
    mutationFn: () => api.post("/api/v1/niv/orthogonal-variance", { benchmark_series: "T10Y3M", lags: 6 }),
  });

  const alert = latest?.alert;
  const colors = alertColors[alert?.level || "normal"];

  return (
    <div className="flex min-h-screen bg-li-bg">
      <Sidebar />
      <div className="flex-1 ml-60">
        <Navbar />
        <main className="p-6 space-y-6">
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                National Impact Velocity
              </h1>
              <p className="text-sm text-li-text-muted mt-1">
                Macro liquidity circulation intelligence
                {health?.vintage && <span className="ml-2 text-xs bg-li-gray-900 px-2 py-0.5 rounded">
                  {health.vintage} vintage
                </span>}
                {health?.fred_api_key_set && <span className="ml-2 text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                  FRED live
                </span>}
              </p>
            </div>
            {alert && (
              <div className={cn("px-4 py-2 rounded-lg border", colors.bg, colors.border, "shadow-lg", colors.glow)}>
                <span className={cn("text-xs font-bold uppercase tracking-wider", colors.text)}>
                  {alert.level}
                </span>
              </div>
            )}
          </div>

          {/* ── Main grid ──────────────────────────────────────── */}
          {loadingLatest ? (
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="bg-li-gray-950 border border-li-gray-800 rounded-xl h-48 animate-pulse" />
              ))}
            </div>
          ) : latest ? (
            <div className="grid grid-cols-3 gap-4">
              {/* Recession gauge */}
              <div className={cn("bg-li-gray-950 border rounded-xl p-5", colors.border)}>
                <RecessionGauge probability={latest.recession_probability} alert={alert?.level || "normal"} />
                <div className="mt-3 text-center">
                  <span className="text-2xl font-mono font-bold text-white">
                    {latest.niv_score >= 0 ? "+" : ""}{latest.niv_score.toFixed(1)}
                  </span>
                  <span className="text-xs text-li-text-muted ml-2">NIV score</span>
                </div>
                <p className="text-xs text-li-text-muted text-center mt-2">{latest.date}</p>
              </div>

              {/* Components breakdown */}
              <div className="bg-li-gray-950 border border-li-gray-800 rounded-xl p-5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-li-text-muted mb-4">
                  Components
                </h3>
                <div className="space-y-2.5">
                  <ComponentBar label="Thrust" value={latest.components.thrust} max={1} color="bg-blue-500" />
                  <ComponentBar label="Eff." value={latest.components.efficiency_squared} max={0.1} color="bg-violet-500" />
                  <ComponentBar label="Slack" value={latest.components.slack} max={0.5} color="bg-teal-500" />
                  <ComponentBar label="Drag" value={-latest.components.drag_total} max={0.03} color="bg-red-500" />
                </div>
                <div className="mt-4 pt-3 border-t border-li-gray-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-li-text-muted">Drag breakdown</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-li-text-muted block">Spread</span>
                      <span className="text-red-400">{latest.components.drag_spread.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-li-text-muted block">Real rate</span>
                      <span className="text-orange-400">{latest.components.drag_real_rate.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-li-text-muted block">Vol</span>
                      <span className="text-amber-400">{latest.components.drag_vol.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alert + action */}
              <div className={cn("bg-li-gray-950 border rounded-xl p-5", colors.border)}>
                <h3 className="text-xs font-medium uppercase tracking-wider text-li-text-muted mb-3">
                  Position Guidance
                </h3>
                {alert && (
                  <>
                    <div className={cn("text-sm font-medium mb-3", colors.text)}>
                      {alert.action}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-li-text-muted">Equity allocation</span>
                        <span className="font-mono text-white">{(alert.dollar_stakes * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2 bg-li-gray-900 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500",
                            alert.dollar_stakes >= 0.7 ? "bg-emerald-500" : alert.dollar_stakes >= 0.3 ? "bg-amber-500" : "bg-red-500"
                          )}
                          style={{ width: `${alert.dollar_stakes * 100}%` }}
                        />
                      </div>
                      {alert.invalidation_prob > 0 && (
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-li-text-muted">Clears below</span>
                          <span className="font-mono text-li-text-secondary">
                            {(alert.invalidation_prob * 100).toFixed(0)}% P(rec)
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {/* History sparkline */}
                {history?.data && (
                  <div className="mt-4 pt-3 border-t border-li-gray-800">
                    <span className="text-[10px] uppercase tracking-wider text-li-text-muted">
                      Last 60 months
                    </span>
                    <div className="mt-2">
                      <HistorySparkline data={history.data} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-li-gray-950 border border-li-gray-800 rounded-xl p-8 text-center">
              <p className="text-li-text-muted">Configure FRED_API_KEY to enable live NIV data</p>
            </div>
          )}

          {/* ── Tabs ───────────────────────────────────────────── */}
          <div className="flex gap-1 bg-li-gray-950 rounded-lg p-1 w-fit">
            {(["overview", "walkforward", "orthogonal"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm transition-colors",
                  activeTab === tab
                    ? "bg-white/10 text-white"
                    : "text-li-text-muted hover:text-white hover:bg-white/5"
                )}
              >
                {tab === "overview" ? "Overview" : tab === "walkforward" ? "Walk-Forward OOS" : "Orthogonal Variance"}
              </button>
            ))}
          </div>

          {/* ── Tab content ────────────────────────────────────── */}
          {activeTab === "walkforward" && (
            <div className="bg-li-gray-950 border border-li-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-white">Walk-Forward Out-of-Sample</h3>
                  <p className="text-xs text-li-text-muted mt-0.5">
                    Expanding window, retrain every 5 months, LR+AdaBoost+MLP ensemble
                  </p>
                </div>
                <button
                  onClick={() => walkforwardMutation.mutate()}
                  disabled={walkforwardMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-50 transition-colors"
                >
                  {walkforwardMutation.isPending ? "Running..." : "Run Walk-Forward"}
                </button>
              </div>
              {walkforwardMutation.data && <AUCTable result={walkforwardMutation.data} />}
              {walkforwardMutation.error && (
                <p className="text-red-400 text-sm">{String(walkforwardMutation.error)}</p>
              )}
            </div>
          )}

          {activeTab === "orthogonal" && (
            <div className="bg-li-gray-950 border border-li-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-white">Orthogonal Variance vs. Fed Yield Curve</h3>
                  <p className="text-xs text-li-text-muted mt-0.5">
                    OLS decomposition with bootstrap 95% CI. Higher = more independent from T10Y3M.
                  </p>
                </div>
                <button
                  onClick={() => orthogonalMutation.mutate()}
                  disabled={orthogonalMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 disabled:opacity-50 transition-colors"
                >
                  {orthogonalMutation.isPending ? "Computing..." : "Compute"}
                </button>
              </div>
              {orthogonalMutation.data && (
                <div className="space-y-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-mono font-bold text-white">
                      {(orthogonalMutation.data.fraction * 100).toFixed(1)}%
                    </span>
                    <span className="text-sm text-li-text-muted">orthogonal</span>
                    <span className="text-xs text-li-text-muted font-mono">
                      95% CI: [{(orthogonalMutation.data.ci_95[0] * 100).toFixed(1)}, {(orthogonalMutation.data.ci_95[1] * 100).toFixed(1)}]%
                    </span>
                  </div>
                  <p className="text-xs text-li-text-secondary">
                    {orthogonalMutation.data.fraction > 0.5
                      ? "NIV captures substantially different information than the yield curve — a portfolio using both gets genuinely orthogonal macro signals."
                      : "NIV and the yield curve share significant variance — the incremental signal is smaller."}
                  </p>
                  <div className="text-xs text-li-text-muted">
                    {orthogonalMutation.data.n_obs} observations, benchmark: {orthogonalMutation.data.benchmark_series}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "overview" && history?.data && history.data.length > 0 && (
            <div className="bg-li-gray-950 border border-li-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-white mb-3">NIV History</h3>
              <p className="text-xs text-li-text-muted mb-4">
                {history.count} monthly observations
              </p>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-li-gray-950">
                    <tr className="border-b border-li-gray-800">
                      <th className="text-left py-2 px-2 text-li-text-muted">Date</th>
                      <th className="text-right py-2 px-2 text-li-text-muted">NIV</th>
                      <th className="text-right py-2 px-2 text-li-text-muted">P(rec)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history.data].reverse().slice(0, 60).map((d) => (
                      <tr key={d.date} className="border-b border-li-gray-900/50 hover:bg-white/[0.02]">
                        <td className="py-1.5 px-2 font-mono text-li-text-secondary">{d.date.slice(0, 7)}</td>
                        <td className={cn("py-1.5 px-2 text-right font-mono",
                          d.niv_score > 0 ? "text-emerald-400" : "text-red-400"
                        )}>{d.niv_score.toFixed(1)}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-li-text-secondary">
                          {(d.recession_probability * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
