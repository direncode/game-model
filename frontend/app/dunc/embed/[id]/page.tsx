"use client";

// /dunc/embed/[id] — minimal iframe-friendly match view.
//
// This is the surface that `thebigdunc.com` embeds via <iframe>. It renders
// the pitch and insight feed only — no nav, no header, no fixed AI drawer —
// so it looks native inside a host page. Role is forced to "manager" for
// embeds by default (override via `?role=technical_staff` query param).

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useDuncStore } from "@/lib/dunc/store";
import { useDuncMatchStream } from "@/lib/dunc/ws";
import { InsightFeed } from "@/components/dunc/InsightFeed";
import { PitchView } from "@/components/dunc/PitchView";

export default function EmbedMatchPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const setRole = useDuncStore((s) => s.setRole);

  const roleParam = search.get("role");
  useEffect(() => {
    setRole(roleParam === "technical_staff" ? "technical_staff" : "manager");
  }, [roleParam, setRole]);

  useDuncMatchStream(params.id);

  const clockSec = useDuncStore((s) => s.clockSec);
  const players = useDuncStore((s) => s.players);

  return (
    <div className="min-h-screen bg-li-black text-li-white p-3">
      <div className="max-w-full grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">
        <div className="border border-li-border bg-li-black-surface rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-li-cyan font-mono">
              D-U-N-C · live
            </div>
            <div className="text-[10px] font-mono text-li-text-muted">
              {formatClock(clockSec)} · {players.length} twins
            </div>
          </div>
          <PitchView compact />
        </div>
        <div className="border border-li-border bg-li-black-surface rounded-md p-3 min-h-[320px]">
          <div className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono mb-2">
            Tactical feed
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            <InsightFeed maxItems={25} />
          </div>
        </div>
      </div>
      <div className="mt-2 text-[10px] font-mono text-li-text-muted text-center">
        Powered by Latent Ocean · latentocean.com
      </div>
    </div>
  );
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
