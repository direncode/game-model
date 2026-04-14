"use client";

// /dunc/match/[id]/analytics — Technical (Analytics) screen.
//
// The analyst's deep-numeric view. Shows team-level aggregates, per-player
// load tables, fatigue distribution, insight frequency histograms, and a
// compact pitch reference. Ports the reference repo's analytics screen
// but computes everything from our real backend data, not an in-browser
// game engine.

import { useMemo } from "react";
import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BarChart3, Flame, Gauge, TrendingUp, Users } from "lucide-react";
import { PitchView } from "@/components/dunc/PitchView";
import { ScreenSwitcher } from "@/components/dunc/ScreenSwitcher";
import { useDuncStore } from "@/lib/dunc/store";
import { useDuncMatchStream } from "@/lib/dunc/ws";
import type { DuncPlayerTick } from "@/lib/dunc/types";
import { cn } from "@/lib/utils";

export default function AnalyticsScreen() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;
  const router = useRouter();
  const role = useDuncStore((s) => s.role);

  useEffect(() => {
    if (role === "manager") {
      router.replace(`/dunc/match/${matchId}`);
    }
  }, [role, matchId, router]);

  useDuncMatchStream(matchId);

  const players = useDuncStore((s) => s.players);
  const clockSec = useDuncStore((s) => s.clockSec);
  const insights = useDuncStore((s) => s.insights);

  const teamStats = useMemo(() => buildTeamStats(players), [players]);
  const topLoad = useMemo(() => topBy(players, (p) => p.distance_m, 8), [players]);
  const topSpeed = useMemo(() => topBy(players, (p) => p.speed, 8), [players]);
  const topFatigue = useMemo(() => topBy(players, (p) => p.fatigue, 8), [players]);

  const insightHistogram = useMemo(() => {
    const buckets: Record<string, number> = {
      under_run: 0,
      pressing_shift: 0,
      convergence: 0,
      transition: 0,
      info: 0,
    };
    for (const i of insights) buckets[i.kind] = (buckets[i.kind] ?? 0) + 1;
    return buckets;
  }, [insights]);

  const cohProxy = useMemo(() => coherenceProxy(players), [players]);

  return (
    <div className="flex-1 flex flex-col">
      <header className="h-14 border-b border-li-border px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dunc"
            className="font-display text-lg tracking-tight hover:text-li-cyan"
          >
            D-U-N-C
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            {matchId} · analytics
          </span>
          <span className="font-mono text-sm text-li-cyan">
            {formatClock(clockSec)}
          </span>
        </div>
        <ScreenSwitcher matchId={matchId} />
      </header>

      <main className="flex-1 overflow-auto p-3 space-y-3">
        {/* Key aggregates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AggregateTile
            icon={Users}
            label="Twins"
            value={`${players.length}`}
            sub="live players"
          />
          <AggregateTile
            icon={TrendingUp}
            label="Coherence proxy"
            value={cohProxy.overall.toFixed(2)}
            sub="v-alignment"
          />
          <AggregateTile
            icon={Flame}
            label="Fatigue avg"
            value={`${Math.round(teamStats.homeFatigueAvg * 100)}%`}
            sub="home"
          />
          <AggregateTile
            icon={Gauge}
            label="Top speed"
            value={`${teamStats.topSpeed.toFixed(1)} m/s`}
            sub={teamStats.topSpeedPlayer ?? "—"}
          />
        </div>

        {/* Two-column: tables + pitch reference */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-3">
          {/* Tables column */}
          <div className="space-y-3 min-w-0">
            <LoadTable title="Top 8 distance covered" players={topLoad} valueLabel="km" format={(v) => (v / 1000).toFixed(2)} accessor={(p) => p.distance_m} />
            <LoadTable title="Top 8 current speed" players={topSpeed} valueLabel="m/s" format={(v) => v.toFixed(2)} accessor={(p) => p.speed} />
            <LoadTable title="Top 8 fatigue load" players={topFatigue} valueLabel="%" format={(v) => Math.round(v * 100).toString()} accessor={(p) => p.fatigue} />
          </div>
          {/* Pitch + histogram */}
          <div className="space-y-3 min-w-0">
            <div className="border border-li-border bg-li-black-surface rounded-md p-3">
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-2">
                Reference pitch
              </div>
              <PitchView compact />
            </div>
            <div className="border border-li-border bg-li-black-surface rounded-md p-3">
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-2">
                Insight frequency
              </div>
              <Histogram data={insightHistogram} />
            </div>
            <div className="border border-li-border bg-li-black-surface rounded-md p-3">
              <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-2">
                Team distribution
              </div>
              <TeamRow label="Home fatigue" value={teamStats.homeFatigueAvg} />
              <TeamRow label="Away fatigue" value={teamStats.awayFatigueAvg} />
              <TeamRow label="Home mean speed" value={teamStats.homeMeanSpeed / 10} />
              <TeamRow label="Away mean speed" value={teamStats.awayMeanSpeed / 10} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────
function buildTeamStats(players: DuncPlayerTick[]) {
  const home = players.filter((p) => p.team === "home");
  const away = players.filter((p) => p.team === "away");
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const top = players.reduce<DuncPlayerTick | null>(
    (acc, p) => (!acc || p.speed > acc.speed ? p : acc),
    null,
  );
  return {
    homeFatigueAvg: avg(home.map((p) => p.fatigue)),
    awayFatigueAvg: avg(away.map((p) => p.fatigue)),
    homeMeanSpeed: avg(home.map((p) => p.speed)),
    awayMeanSpeed: avg(away.map((p) => p.speed)),
    topSpeed: top?.speed ?? 0,
    topSpeedPlayer: top ? `#${top.number} ${top.role}` : null,
  };
}

function topBy(
  players: DuncPlayerTick[],
  key: (p: DuncPlayerTick) => number,
  n: number,
): DuncPlayerTick[] {
  return [...players].sort((a, b) => key(b) - key(a)).slice(0, n);
}

function coherenceProxy(players: DuncPlayerTick[]) {
  // Crude proxy: mean pairwise velocity cosine similarity within the home team.
  const home = players.filter((p) => p.team === "home");
  if (home.length < 2) return { overall: 0 };
  let acc = 0;
  let count = 0;
  for (let i = 0; i < home.length; i++) {
    for (let j = i + 1; j < home.length; j++) {
      const a = home[i];
      const b = home[j];
      const sa = Math.hypot(a.vx, a.vy);
      const sb = Math.hypot(b.vx, b.vy);
      if (sa < 0.2 || sb < 0.2) continue;
      const cos = (a.vx * b.vx + a.vy * b.vy) / (sa * sb);
      acc += cos;
      count += 1;
    }
  }
  return { overall: count ? acc / count : 0 };
}

function AggregateTile({
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

function LoadTable({
  title,
  players,
  valueLabel,
  format,
  accessor,
}: {
  title: string;
  players: DuncPlayerTick[];
  valueLabel: string;
  format: (v: number) => string;
  accessor: (p: DuncPlayerTick) => number;
}) {
  const max = players.reduce((m, p) => Math.max(m, accessor(p)), 0) || 1;
  return (
    <div className="border border-li-border bg-li-black-surface rounded-md">
      <div className="flex items-center justify-between px-3 py-2 border-b border-li-border">
        <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
          {title}
        </div>
        <div className="text-[10px] font-mono text-li-text-muted">
          {valueLabel}
        </div>
      </div>
      <div className="divide-y divide-li-border">
        {players.map((p) => {
          const v = accessor(p);
          const w = Math.max(0.05, v / max);
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3 py-1.5"
            >
              <span className="w-10 text-[10px] font-mono text-li-text-muted">
                {p.team.charAt(0).toUpperCase()}
                {p.team === "home" ? "" : ""}
                {" · #"}
                {p.number}
              </span>
              <span className="w-12 text-[10px] font-mono text-li-text-secondary">
                {p.role}
              </span>
              <div className="flex-1 h-1 bg-li-gray-900 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    p.team === "home" ? "bg-li-cyan" : "bg-li-warm",
                  )}
                  style={{ width: `${w * 100}%` }}
                />
              </div>
              <span className="w-14 text-right text-[11px] font-mono text-li-white tabular-nums">
                {format(v)}
              </span>
            </div>
          );
        })}
        {players.length === 0 && (
          <div className="px-3 py-4 text-[11px] font-mono text-li-text-muted">
            waiting for twin data…
          </div>
        )}
      </div>
    </div>
  );
}

function Histogram({ data }: { data: Record<string, number> }) {
  const keys = Object.keys(data);
  const max = Math.max(1, ...keys.map((k) => data[k]));
  return (
    <div className="space-y-1">
      {keys.map((k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-24 text-[9px] font-mono uppercase tracking-widest text-li-text-muted">
            {k}
          </span>
          <div className="flex-1 h-1.5 bg-li-gray-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-li-cyan"
              style={{ width: `${(data[k] / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-[10px] font-mono text-li-white tabular-nums">
            {data[k]}
          </span>
        </div>
      ))}
    </div>
  );
}

function TeamRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1 text-[11px]">
      <span className="font-mono text-li-text-secondary">{label}</span>
      <span className="font-mono text-li-white tabular-nums">
        {(value * 100).toFixed(1)}
      </span>
    </div>
  );
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
