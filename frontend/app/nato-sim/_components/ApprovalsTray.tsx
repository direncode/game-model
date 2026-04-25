"use client";

/**
 * Approvals tray — only renders when there are pending items. Thin row
 * of inline approve/reject controls; no big colored block when idle.
 */

import { useEffect, useState } from "react";

interface Approval {
  id: string;
  trigger: string;
  proposed_action: string;
  status: string;
  created_at: string;
}

export function ApprovalsTray() {
  const [items, setItems] = useState<Approval[]>([]);

  async function refresh() {
    try {
      const res = await fetch("/api/v1/nato_sim/approvals?status=pending");
      if (!res.ok) return;
      const j = (await res.json()) as { items: Approval[] };
      setItems(j.items ?? []);
    } catch {
      /* ignore */
    }
  }

  async function resolve(id: string, status: "approved" | "rejected" | "deferred") {
    await fetch(`/api/v1/nato_sim/approvals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="border-t border-li-yellow/40 bg-li-yellow/[0.03] px-6 py-2">
      <div className="flex items-center gap-3 text-[10px] font-mono">
        <span className="tracking-[0.32em] uppercase text-li-yellow">
          approvals · {items.length}
        </span>
        <span className="flex-1 truncate text-li-text-secondary">
          {items[0].proposed_action} <span className="text-li-text-muted">— {items[0].trigger}</span>
        </span>
        <button
          onClick={() => resolve(items[0].id, "approved")}
          className="text-li-green hover:text-li-text-primary tracking-wider"
          title="approve"
        >
          ✓
        </button>
        <button
          onClick={() => resolve(items[0].id, "rejected")}
          className="text-li-red hover:text-li-text-primary tracking-wider"
          title="reject"
        >
          ✗
        </button>
        <button
          onClick={() => resolve(items[0].id, "deferred")}
          className="text-li-text-muted hover:text-li-text-primary tracking-wider"
          title="defer"
        >
          ⏸
        </button>
      </div>
    </div>
  );
}
