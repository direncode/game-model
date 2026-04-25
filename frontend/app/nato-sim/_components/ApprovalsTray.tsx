"use client";

/**
 * Approvals tray — pending human-in-the-loop decisions.
 *
 * Lists every approval with status="pending" from
 * /api/v1/nato_sim/approvals and provides ✓ / ✗ / ⏸ buttons that POST
 * back to the API. Polls every 5s; this is enough for the sim cadence
 * and avoids the complexity of a second SSE channel.
 */

import { useEffect, useState } from "react";

interface Approval {
  id: string;
  trigger: string;
  proposed_action: string;
  payload: unknown;
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
      // ignore
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
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="border-t border-li-border bg-li-yellow/5 p-3">
      <div className="text-[10px] tracking-[0.3em] text-li-yellow uppercase font-mono mb-2">
        Approvals · {items.length}
      </div>
      <ul className="space-y-2">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-3 bg-li-black-surface/50 border border-li-border rounded p-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs text-li-text-primary">
                {a.proposed_action}
              </div>
              <div className="text-[10px] text-li-text-muted font-mono mt-0.5">
                trigger: {a.trigger}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => resolve(a.id, "approved")}
                className="px-2 py-1 text-xs bg-li-green/20 border border-li-green/40 text-li-green rounded"
                title="Approve"
              >
                ✓
              </button>
              <button
                onClick={() => resolve(a.id, "rejected")}
                className="px-2 py-1 text-xs bg-li-red/20 border border-li-red/40 text-li-red rounded"
                title="Reject"
              >
                ✗
              </button>
              <button
                onClick={() => resolve(a.id, "deferred")}
                className="px-2 py-1 text-xs bg-li-gray-800 border border-li-border text-li-text-secondary rounded"
                title="Defer"
              >
                ⏸
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
