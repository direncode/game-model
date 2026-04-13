"use client";

// InsightFeed — scrollable list of tactical events the engine has emitted.
//
// Audience filtering happens here so both the main dashboard and the embed
// can reuse this component. Manager sees only manager-audience insights;
// technical staff sees both (the brief gave the staff deeper access).

import { useDuncStore } from "@/lib/dunc/store";
import type { DuncInsight, DuncRole } from "@/lib/dunc/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  under_run: "Under-run",
  pressing_shift: "Press shift",
  convergence: "Convergence",
  transition: "Transition",
  info: "Info",
};

const SEVERITY_STYLE: Record<string, string> = {
  info: "border-li-border text-li-text-secondary",
  notable: "border-li-cyan/50 text-li-cyan",
  critical: "border-li-red/60 text-li-red",
};

function filterForRole(insights: DuncInsight[], role: DuncRole): DuncInsight[] {
  // Technical staff sees everything; manager only sees their own audience.
  if (role === "technical_staff") return insights;
  return insights.filter((i) => i.audience.includes("manager"));
}

export function InsightFeed({
  onFocus,
  maxItems = 40,
}: {
  onFocus?: (actors: string[]) => void;
  maxItems?: number;
}) {
  const insights = useDuncStore((s) => s.insights);
  const role = useDuncStore((s) => s.role);

  const visible = filterForRole(insights, role).slice(-maxItems).reverse();

  if (visible.length === 0) {
    return (
      <div className="text-xs text-li-text-muted font-mono px-3 py-6 text-center">
        Waiting for tactical signals…
      </div>
    );
  }

  return (
    <ul className="space-y-1.5 pr-1">
      {visible.map((i) => (
        <li
          key={i.id}
          className={cn(
            "group border-l-2 pl-2.5 pr-2 py-1.5 bg-li-black-surface/60 rounded-sm",
            "hover:bg-li-black-surface transition-colors cursor-pointer",
            SEVERITY_STYLE[i.severity],
          )}
          onClick={() => onFocus?.(i.actors)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest font-mono">
              {KIND_LABEL[i.kind] ?? i.kind}
            </span>
            <span className="text-[10px] font-mono text-li-text-muted">
              {formatClock(i.t)}
            </span>
          </div>
          <div className="text-[13px] text-li-white font-medium mt-0.5">
            {i.title}
          </div>
          <div className="text-[11px] text-li-text-secondary mt-0.5 leading-snug">
            {i.summary}
          </div>
          {i.actors.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-mono text-li-text-muted">
              {i.actors.slice(0, 6).map((a) => (
                <span
                  key={a}
                  className="px-1 py-[1px] border border-li-border rounded-sm"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function formatClock(t: number): string {
  // t here is *match seconds*, not unix time
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
