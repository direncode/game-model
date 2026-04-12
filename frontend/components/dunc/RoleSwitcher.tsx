"use client";

// RoleSwitcher — two-state toggle between Manager and Technical Staff.
//
// Writes to the Zustand store; the store persists to localStorage. No
// backend involvement in v0. This is the seam where real RBAC claims will
// plug in once Clerk roles are wired up to the dunc vertical.

import { useDuncStore } from "@/lib/dunc/store";
import { cn } from "@/lib/utils";
import type { DuncRole } from "@/lib/dunc/types";

const OPTIONS: { key: DuncRole; label: string; hint: string }[] = [
  { key: "manager", label: "Manager", hint: "Concise, action-oriented" },
  {
    key: "technical_staff",
    label: "Technical Staff",
    hint: "Detailed, numeric, full evidence",
  },
];

export function RoleSwitcher() {
  const role = useDuncStore((s) => s.role);
  const setRole = useDuncStore((s) => s.setRole);

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-li-text-muted font-mono">
        View as
      </span>
      <div className="inline-flex rounded-md border border-li-border bg-li-black-surface p-0.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setRole(opt.key)}
            title={opt.hint}
            className={cn(
              "px-3 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors rounded-sm",
              role === opt.key
                ? "bg-li-white text-li-black"
                : "text-li-text-secondary hover:text-li-white",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
