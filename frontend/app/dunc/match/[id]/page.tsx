"use client";

// /dunc/match/[id] — live match dashboard.
//
// Layout (desktop):
//   ┌──────────────────────────────────────────────┬───────────────────┐
//   │ header  · role · scenario controls           │ AIAgentDrawer     │
//   ├─────────────────┬────────────────────────────┤ (fixed right)     │
//   │ PitchView       │ Approach window            │                   │
//   │                 │ InsightFeed                │                   │
//   ├─────────────────┴────────────────────────────┤                   │
//   │ TwinCard rail (home · away)                  │                   │
//   └──────────────────────────────────────────────┴───────────────────┘

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { duncApi } from "@/lib/dunc/api";
import { useDuncStore } from "@/lib/dunc/store";
import { useDuncMatchStream } from "@/lib/dunc/ws";
import { ActiveScenarioBanner } from "@/components/dunc/ActiveScenarioBanner";
import { AIAgentDrawer } from "@/components/dunc/AIAgentDrawer";
import { ManagerBackchannel, StaffBackchannel } from "@/components/dunc/Backchannel";
import { ManagerTerminal } from "@/components/dunc/ManagerTerminal";
import { OverlayToggles } from "@/components/dunc/OverlayToggles";
import { PLScoreboard } from "@/components/dunc/PLScoreboard";
import { GameApproachWindow } from "@/components/dunc/GameApproachWindow";
import { InsightFeed } from "@/components/dunc/InsightFeed";
import { PitchView } from "@/components/dunc/PitchView";
import { PressingTriggers } from "@/components/dunc/PressingTriggers";
import { RoleSwitcher } from "@/components/dunc/RoleSwitcher";
import { ScenarioControls } from "@/components/dunc/ScenarioControls";
import { ScreenSwitcher } from "@/components/dunc/ScreenSwitcher";
import { TwinCard } from "@/components/dunc/TwinCard";

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;

  const players = useDuncStore((s) => s.players);
  const clockSec = useDuncStore((s) => s.clockSec);

  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matchMeta, setMatchMeta] = useState<{ status: string } | null>(null);

  useDuncMatchStream(matchId);

  useEffect(() => {
    if (!matchId) return;
    duncApi
      .getMatch(matchId)
      .then((r) => setMatchMeta({ status: r.summary.status }))
      .catch(() => setMatchMeta({ status: "unknown" }));
  }, [matchId]);

  const home = useMemo(
    () =>
      players
        .filter((p) => p.team === "home")
        .sort((a, b) => a.number - b.number),
    [players],
  );
  const away = useMemo(
    () =>
      players
        .filter((p) => p.team === "away")
        .sort((a, b) => a.number - b.number),
    [players],
  );

  return (
    <div className="flex-1 flex flex-col pr-[340px]">
      {/* Header bar */}
      <header className="h-14 border-b border-li-border px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dunc"
            className="font-display text-lg tracking-tight hover:text-li-cyan"
          >
            D-U-N-C
          </Link>
          <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            {matchId} · manager
          </span>
          <span className="font-mono text-sm text-li-cyan">
            {formatClock(clockSec)}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
            {matchMeta?.status ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ScreenSwitcher matchId={matchId} />
          <RoleSwitcher />
        </div>
      </header>

      <ActiveScenarioBanner />

      {/* Main body */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-3 p-3 overflow-auto">
        {/* Left column: pitch + twin rail */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="border border-li-border bg-li-black-surface rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <PLScoreboard />
              <div className="text-[10px] font-mono text-li-text-muted">
                {players.length} twins
              </div>
            </div>
            <PitchView highlightedIds={highlighted} />
          </div>

          {/* Manager Terminal — ABOVE twin cards */}
          <ManagerTerminal matchId={matchId} />

          {/* Twin rail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
            <TwinRail title="Home" players={home} selected={selected} onSelect={setSelected} />
            <TwinRail title="Away" players={away} selected={selected} onSelect={setSelected} />
          </div>

          {/* Analytics overlay toggles — technical staff only */}
          <OverlayToggles />
        </div>

        {/* Right column: triggers + approach + backchannel + feed */}
        <div className="flex flex-col gap-3 min-w-0">
          {/* Manager: received messages from staff + approach window */}
          <ManagerBackchannel />
          <PressingTriggers matchId={matchId} />
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
              Legacy scenarios:
            </span>
            <ScenarioControls matchId={matchId} />
          </div>
          {/* Staff: send channel to manager */}
          <StaffBackchannel />
          <GameApproachWindow />
          <div className="border border-li-border bg-li-black-surface rounded-md flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-li-border flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
                  Tactical feed
                </div>
                <div className="text-sm font-display text-li-white leading-none mt-0.5">
                  Insights
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 max-h-[60vh]">
              <InsightFeed onFocus={(actors) => setHighlighted(actors)} />
            </div>
          </div>
        </div>
      </div>

      <AIAgentDrawer matchId={matchId} />
    </div>
  );
}

function TwinRail({
  title,
  players,
  selected,
  onSelect,
}: {
  title: string;
  players: ReturnType<typeof useDuncStore.getState>["players"];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border border-li-border bg-li-black-surface rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
          {title}
        </div>
        <div className="text-[10px] font-mono text-li-text-muted">
          {players.length}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => (
          <TwinCard
            key={p.id}
            player={p}
            selected={selected === p.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
