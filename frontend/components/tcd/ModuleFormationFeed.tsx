"use client";

import { useTCDStore } from "@/lib/tcd/store";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  attractor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  cycle: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  boundary: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export default function ModuleFormationFeed() {
  const modules = useTCDStore((s) => s.modules);
  const status = useTCDStore((s) => s.status);

  if (modules.length === 0 && status !== "running") {
    return (
      <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg p-4 text-center text-sm text-li-text-muted">
        Modules will appear here as they crystallize
      </div>
    );
  }

  return (
    <div className="bg-li-gray-900/40 border border-li-gray-800 rounded-lg overflow-hidden">
      <h3 className="px-4 py-2 text-[10px] uppercase tracking-widest text-li-text-muted border-b border-li-gray-800">
        Crystallized Modules ({modules.length})
      </h3>
      <div className="max-h-72 overflow-y-auto divide-y divide-li-gray-800/30">
        {modules.map((m) => (
          <div key={m.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
            <span className={cn("px-1.5 py-0.5 text-[9px] uppercase rounded border font-mono", TYPE_COLORS[m.module_type] || "")}>
              {m.module_type}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-mono text-white">{m.id}</span>
              <span className="text-[10px] text-li-text-muted ml-2">{m.members.length} members</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-1.5 bg-li-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${m.purity * 100}%` }} />
              </div>
              <span className="text-[9px] font-mono text-li-text-muted w-8 text-right">{(m.purity * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
