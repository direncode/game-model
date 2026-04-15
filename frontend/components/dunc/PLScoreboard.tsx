"use client";

// PLScoreboard — Premier League broadcast-style scoreboard overlay.
// Mimics the real PL match-day graphic: team colors, PL lion, score, clock.

import { useDuncStore } from "@/lib/dunc/store";

export function PLScoreboard() {
  const matchInfo = useDuncStore((s) => s.matchInfo);
  const clockSec = useDuncStore((s) => s.clockSec);

  if (!matchInfo) return null;

  const minute = Math.floor(clockSec / 60);
  const homeColor = matchInfo.home_color || "#EF0107";
  const awayColor = matchInfo.away_color || "#6CABDD";

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      {/* Main scoreboard bar */}
      <div className="flex items-stretch rounded-sm overflow-hidden shadow-lg text-white font-sans">
        {/* Home team */}
        <div
          className="flex items-center gap-2 px-4 py-1.5 min-w-[100px] justify-end"
          style={{ backgroundColor: homeColor }}
        >
          <span className="text-sm font-bold tracking-wider uppercase">
            {matchInfo.home_short}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-center bg-[#37003c] px-3 gap-2">
          <span className="text-2xl font-bold tabular-nums text-white min-w-[20px] text-center">
            {matchInfo.home_score}
          </span>
          {/* PL Lion placeholder — purple crown icon */}
          <div className="w-6 h-6 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <circle cx="12" cy="12" r="10" fill="#37003c" stroke="#ffffff" strokeWidth="1.5" />
              <text x="12" y="16" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">⚽</text>
            </svg>
          </div>
          <span className="text-2xl font-bold tabular-nums text-white min-w-[20px] text-center">
            {matchInfo.away_score}
          </span>
        </div>

        {/* Away team */}
        <div
          className="flex items-center gap-2 px-4 py-1.5 min-w-[100px]"
          style={{ backgroundColor: awayColor }}
        >
          <span className="text-sm font-bold tracking-wider uppercase">
            {matchInfo.away_short}
          </span>
        </div>
      </div>

      {/* Clock bar */}
      <div className="bg-[#37003c] text-white px-3 py-0.5 rounded-sm text-xs font-bold tabular-nums">
        {minute}&apos;
      </div>

      {/* xG bar */}
      <div className="flex items-center gap-3 text-[10px] font-mono text-li-text-muted">
        <span>xG: {matchInfo.home_xg.toFixed(2)}</span>
        <span className="text-li-text-muted">|</span>
        <span>xG: {matchInfo.away_xg.toFixed(2)}</span>
      </div>

      {/* Latest event */}
      {matchInfo.events.length > 0 && (
        <LatestEvent event={matchInfo.events[matchInfo.events.length - 1]} matchInfo={matchInfo} />
      )}
    </div>
  );
}

function LatestEvent({ event, matchInfo }: { event: any; matchInfo: any }) {
  const isGoal = event.type === "goal";
  const isCard = event.type === "yellow_card";
  const teamName = event.team === "home" ? matchInfo.home_short : matchInfo.away_short;

  if (isGoal) {
    return (
      <div className="bg-[#37003c] text-white px-4 py-1 rounded-sm text-xs font-bold animate-pulse motion-reduce:animate-none">
        ⚽ GOAL! {teamName} #{event.player_number} ({event.minute}&apos;)
      </div>
    );
  }
  if (isCard) {
    return (
      <div className="bg-yellow-600 text-black px-3 py-0.5 rounded-sm text-[10px] font-bold">
        🟨 {teamName} #{event.player_number} ({event.minute}&apos;)
      </div>
    );
  }
  if (event.type === "shot_on_target" || event.type === "shot") {
    return (
      <div className="text-[10px] font-mono text-li-text-muted">
        Shot by {teamName} #{event.player_number} (xG {event.xg}) — {event.minute}&apos;
      </div>
    );
  }
  return null;
}
