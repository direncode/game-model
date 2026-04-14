"use client";

// /dunc/match/[id]/backend — Technical (Backend) screen.
//
// The raw engine view. Intended for a technical staffer who needs to see
// what the pipeline is doing under the hood: tick rate, pipeline phases,
// insight frequencies, per-kind counts, active subscribers, and a dump of
// recent raw tracking frames. No tactical interpretation here — that's
// the Analytics and Manager screens.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useDuncStore } from "@/lib/dunc/store";
import {
  Activity,
  Cpu,
  Database,
  Gauge,
  Radio,
  Terminal,
  Zap,
} from "lucide-react";
import { duncApi } from "@/lib/dunc/api";
import { useDuncStore } from "@/lib/dunc/store";
import { useDuncMatchStream } from "@/lib/dunc/ws";
import { ScreenSwitcher } from "@/components/dunc/ScreenSwitcher";
import type { DuncInsight, DuncMatchSummary } from "@/lib/dunc/types";

export default function BackendScreen() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;
  const router = useRouter();
  const role = useDuncStore((s) => s.role);

  // Manager cannot access backend screen — redirect
  useEffect(() => {
    if (role === "manager") {
      router.replace(`/dunc/match/${matchId}`);
    }
  }, [role, matchId, router]);

  useDuncMatchStream(matchId);

  const clockSec = useDuncStore((s) => s.clockSec);
  const players = useDuncStore((s) => s.players);
  const ball = useDuncStore((s) => s.ball);
  const insights = useDuncStore((s) => s.insights);
  const lastTick = useDuncStore((s) => s.lastTick);

  const [summary, setSummary] = useState<DuncMatchSummary | null>(null);

  useEffect(() => {
    if (!matchId) return;
    let mounted = true;
    const load = () =>
      duncApi
        .getMatch(matchId)
        .then((r) => mounted && setSummary(r.summary))
        .catch(() => {});
    load();
    const h = setInterval(load, 4000);
    return () => {
      mounted = false;
      clearInterval(h);
    };
  }, [matchId]);

  const insightCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of insights) m[i.kind] = (m[i.kind] ?? 0) + 1;
    return m;
  }, [insights]);

  const lastInsights = insights.slice(-8).reverse();

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-li-border px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dunc" className="font-display text-lg tracking-tight hover:text-li-cyan">
            D-U-N-C
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            {matchId} · backend
          </span>
          <span className="font-mono text-sm text-li-cyan">
            {formatClock(clockSec)}
          </span>
        </div>
        <ScreenSwitcher matchId={matchId} />
      </header>

      <main className="flex-1 overflow-auto p-3 space-y-3">
        {/* Top stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DiagTile icon={Gauge} label="Tick rate" value={`${summary?.hz ?? 10} Hz`} sub="target" />
          <DiagTile icon={Radio} label="Subscribers" value={`${summary?.subscribers ?? 0}`} sub="live ws" />
          <DiagTile icon={Activity} label="Last tick" value={`#${lastTick}`} sub="frame id" />
          <DiagTile
            icon={Zap}
            label="Engine status"
            value={summary?.status ?? "—"}
            sub="runtime"
          />
        </div>

        {/* Pipeline phases */}
        <section className="border border-li-border bg-li-black-surface rounded-md">
          <SectionHeader icon={Cpu} title="Pipeline phases" />
          <div className="divide-y divide-li-border">
            <PhaseRow name="TrackingAdapter" detail="synthetic @ 10 Hz" healthy />
            <PhaseRow name="DigitalTwinRegistry" detail={`${players.length} twins ingested`} healthy={players.length > 0} />
            <PhaseRow name="TacticalEngine" detail="heuristic detectors + windowed BTUT pass" healthy />
            <PhaseRow name="InsightStream" detail={`${insights.length} insights cached`} healthy />
            <PhaseRow name="WebSocket broadcast" detail={`${summary?.subscribers ?? 0} sinks`} healthy />
          </div>
        </section>

        {/* Insight kind breakdown */}
        <section className="border border-li-border bg-li-black-surface rounded-md">
          <SectionHeader icon={Database} title="Insight kind breakdown" />
          <div className="p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            {["under_run", "pressing_shift", "convergence", "transition", "info"].map((k) => (
              <div
                key={k}
                className="border border-li-border bg-li-black-elevated rounded-sm px-2 py-1.5"
              >
                <div className="text-[9px] font-mono uppercase tracking-widest text-li-text-muted">
                  {k}
                </div>
                <div className="text-xl font-mono text-li-white tabular-nums">
                  {insightCounts[k] ?? 0}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Raw frame dump */}
        <section className="border border-li-border bg-li-black-surface rounded-md">
          <SectionHeader icon={Terminal} title="Raw frame (last tick)" />
          <pre className="p-3 text-[10px] font-mono text-li-text-secondary overflow-x-auto max-h-64">
            {JSON.stringify(
              {
                t: lastTick,
                clock_sec: clockSec,
                ball,
                players_sample: players.slice(0, 6),
                players_total: players.length,
              },
              null,
              2,
            )}
          </pre>
        </section>

        {/* Recent insights — raw */}
        <section className="border border-li-border bg-li-black-surface rounded-md">
          <SectionHeader icon={Activity} title="Recent insights (raw)" />
          <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
            {lastInsights.length === 0 && (
              <div className="text-[11px] font-mono text-li-text-muted">
                No insights in the current window.
              </div>
            )}
            {lastInsights.map((i) => (
              <RawInsightRow key={i.id} insight={i} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function DiagTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="border border-li-border bg-li-black-surface rounded-md p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-li-text-muted">
          {label}
        </span>
        <Icon className="w-3.5 h-3.5 text-li-cyan" />
      </div>
      <div className="text-2xl font-mono text-li-white tabular-nums mt-1">
        {value}
      </div>
      <div className="text-[10px] font-mono text-li-text-muted mt-0.5">
        {sub}
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-li-border">
      <Icon className="w-3.5 h-3.5 text-li-cyan" />
      <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
        {title}
      </div>
    </div>
  );
}

function PhaseRow({
  name,
  detail,
  healthy,
}: {
  name: string;
  detail: string;
  healthy: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div>
        <div className="text-[12px] text-li-white">{name}</div>
        <div className="text-[10px] font-mono text-li-text-muted">{detail}</div>
      </div>
      <span
        className={
          healthy
            ? "text-[10px] font-mono text-li-green"
            : "text-[10px] font-mono text-li-red"
        }
      >
        {healthy ? "● OK" : "● WARN"}
      </span>
    </div>
  );
}

function RawInsightRow({ insight }: { insight: DuncInsight }) {
  return (
    <div className="text-[10px] font-mono text-li-text-secondary">
      <span className="text-li-cyan">[{insight.kind}]</span>{" "}
      <span className="text-li-white">t={insight.t.toFixed(1)}</span>{" "}
      <span className="text-li-text-muted">{insight.id}</span>{" "}
      {insight.actors.slice(0, 4).join(",")}
    </div>
  );
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
