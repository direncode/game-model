"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { useNIVData } from "@/hooks/useNIVData";
import { NIVStatusBar } from "@/components/niv/NIVStatusBar";
import { NIVTimeSeriesChart } from "@/components/niv/NIVTimeSeriesChart";
import { ComponentHeatmapStrip } from "@/components/niv/ComponentHeatmapStrip";
import { EnsembleDisagreementPanel } from "@/components/niv/EnsembleDisagreementPanel";
import { FeatureImportancePanel } from "@/components/niv/FeatureImportancePanel";
import { OrthogonalVariancePanel } from "@/components/niv/OrthogonalVariancePanel";
import { WalkForwardPanel } from "@/components/niv/WalkForwardPanel";
import { DragWaterfallChart } from "@/components/niv/DragWaterfallChart";
import { AlertStateMachine } from "@/components/niv/AlertStateMachine";
import { ProtocolDStrip } from "@/components/niv/ProtocolDStrip";
import { NIVMonthDossier } from "@/components/niv/NIVMonthDossier";
import { cn } from "@/lib/utils";

// ── Compact Recession Gauge ────────────────────────────────────────────
function RecessionGaugeCompact({ probability, score, alert, date }: {
  probability: number; score: number; alert: string; date: string;
}) {
  const pct = Math.min(probability, 1);
  const r = 28; const circ = 2 * Math.PI * r; const dash = circ * 0.75;
  const offset = dash * (1 - pct);
  const color = alert === "critical" ? "#ef4444" : alert === "warning" ? "#f97316"
    : alert === "elevated" ? "#eab308" : "#10b981";
  return (
    <div className="border-b border-li-gray-900 px-3 py-2 flex items-center gap-3">
      <svg width="70" height="48" viewBox="0 0 70 48">
        <circle cx="35" cy="38" r={r} fill="none" stroke="#1a1a1a" strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset="0"
          transform="rotate(135 35 38)" strokeLinecap="round" />
        <circle cx="35" cy="38" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={offset}
          transform="rotate(135 35 38)" strokeLinecap="round"
          className="transition-all duration-700" />
        <text x="35" y="34" textAnchor="middle" fill="white" fontSize="12"
          fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          {(probability * 100).toFixed(0)}%
        </text>
        <text x="35" y="44" textAnchor="middle" fill="#555" fontSize="6"
          fontFamily="JetBrains Mono, monospace" style={{ textTransform: "uppercase" }}>
          P(rec)
        </text>
      </svg>
      <div>
        <div className={cn("text-lg font-mono font-bold", score >= 0 ? "text-emerald-400" : "text-red-400")}>
          {score >= 0 ? "+" : ""}{score.toFixed(1)}
        </div>
        <div className="text-[8px] text-li-text-muted font-mono">{date?.slice(0, 7) || ""}</div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function NIVCommandCenter() {
  const niv = useNIVData();
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const historyData = niv.historyFull.data?.data ?? [];
  const nberRecessions = niv.historyFull.data?.nber_recessions ?? [];

  // Playback controller
  const togglePlay = useCallback(() => {
    if (playing) {
      if (playRef.current) clearInterval(playRef.current);
      playRef.current = null;
      setPlaying(false);
    } else {
      const startIdx = niv.focusedIndex ?? 0;
      niv.setFocusedIndex(startIdx);
      setPlaying(true);
      playRef.current = setInterval(() => {
        niv.setFocusedIndex(prev => {
          const next = (prev ?? 0) + 1;
          if (next >= historyData.length) {
            if (playRef.current) clearInterval(playRef.current);
            playRef.current = null;
            setPlaying(false);
            return historyData.length - 1;
          }
          return next;
        });
      }, 150);
    }
  }, [playing, historyData.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      if (e.key === "ArrowRight") niv.setFocusedIndex(p => Math.min((p ?? 0) + 1, historyData.length - 1));
      if (e.key === "ArrowLeft") niv.setFocusedIndex(p => Math.max((p ?? 0) - 1, 0));
      if (e.key === "Escape") niv.setFocusedIndex(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, historyData.length]);

  // Cleanup on unmount
  useEffect(() => () => { if (playRef.current) clearInterval(playRef.current); }, []);

  // Display data: focused month or latest
  const displayData = niv.focusedMonth ?? (niv.latest.data ? {
    niv_score: niv.latest.data.niv_score,
    recession_probability: niv.latest.data.recession_probability,
    thrust: niv.latest.data.components.thrust,
    efficiency_squared: niv.latest.data.components.efficiency_squared,
    slack: niv.latest.data.components.slack,
    drag_total: niv.latest.data.components.drag_total,
    drag_spread: niv.latest.data.components.drag_spread,
    drag_real_rate: niv.latest.data.components.drag_real_rate,
    drag_vol: niv.latest.data.components.drag_vol,
    alert_level: niv.latest.data.alert.level,
    dollar_stakes: niv.latest.data.alert.dollar_stakes,
    date: niv.latest.data.date,
  } : null);

  return (
    <div className="flex min-h-screen bg-li-bg">
      <Sidebar />
      <main className="flex-1 ml-60">
        <Navbar />

        {/* Status Bar */}
        <NIVStatusBar
          latest={niv.latest.data}
          health={niv.health.data}
          playing={playing}
          onTogglePlay={togglePlay}
        />

        {/* Main 12-col grid — fixed viewport, no page scroll */}
        <div className="grid grid-cols-12 gap-0 h-[calc(100vh-3.5rem-2.5rem)]">

          {/* ── LEFT PANEL: Time Series + Heatmap ──────────────── */}
          <div className="col-span-7 border-r border-li-gray-900 flex flex-col overflow-hidden">
            <NIVTimeSeriesChart
              history={historyData}
              nberRecessions={nberRecessions}
              wfSeries={niv.walkforwardSeries.data?.predictions}
              focusedIndex={niv.focusedIndex}
              onFocusMonth={niv.setFocusedIndex}
            />
            <ComponentHeatmapStrip history={historyData} />
          </div>

          {/* ── RIGHT PANEL: Stacked widgets ────────────────────── */}
          <div className="col-span-5 overflow-y-auto">
            {/* Recession gauge */}
            {displayData && (
              <RecessionGaugeCompact
                probability={displayData.recession_probability}
                score={displayData.niv_score}
                alert={displayData.alert_level}
                date={displayData.date}
              />
            )}

            {/* Ensemble disagreement */}
            <EnsembleDisagreementPanel data={niv.ensembleExplain.data} />

            {/* Feature importance */}
            <FeatureImportancePanel data={niv.ensembleExplain.data} />

            {/* Walk-forward AUC gauges */}
            <WalkForwardPanel
              data={niv.walkforward.data}
              onRun={() => niv.walkforward.mutate()}
              loading={niv.walkforward.isPending}
            />

            {/* Orthogonal variance donut */}
            <OrthogonalVariancePanel
              data={niv.orthogonal.data}
              onCompute={() => niv.orthogonal.mutate()}
              loading={niv.orthogonal.isPending}
            />

            {/* Drag decomposition */}
            {displayData && (
              <DragWaterfallChart
                spread={displayData.drag_spread}
                realRate={displayData.drag_real_rate}
                vol={displayData.drag_vol}
                total={displayData.drag_total}
              />
            )}

            {/* Alert state machine */}
            <AlertStateMachine
              currentLevel={displayData?.alert_level || "normal"}
              history={historyData}
            />

            {/* Protocol D */}
            <ProtocolDStrip
              data={niv.protocolD.data}
              onRun={() => niv.protocolD.mutate()}
              loading={niv.protocolD.isPending}
            />
          </div>
        </div>

        {/* ── Month Dossier (slide-up on click) ──────────────── */}
        {niv.focusedMonth && (
          <NIVMonthDossier
            month={niv.focusedMonth}
            onClose={() => niv.setFocusedIndex(null)}
          />
        )}
      </main>
    </div>
  );
}
