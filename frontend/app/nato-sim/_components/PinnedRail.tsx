"use client";

/**
 * Pinned rail — right-edge column showing findings the operator has
 * pinned during the sim. MVP: read-only view fetched from the `pinned`
 * table; operator pins/unpins via slash command or direct DB edit.
 *
 * Post-sim: add inline "pin" buttons on every product so the rail fills
 * organically.
 */

import { useEffect, useState } from "react";

interface PinnedItem {
  id: string;
  finding_id: string;
  note: string | null;
  pinned_at: string;
}

export function PinnedRail() {
  const [items, setItems] = useState<PinnedItem[]>([]);

  useEffect(() => {
    // Placeholder: no dedicated /pinned endpoint yet. Wire post-MVP.
    setItems([]);
  }, []);

  return (
    <aside className="w-60 border-l border-li-border bg-li-black-surface/70 flex-shrink-0 overflow-auto">
      <div className="sticky top-0 bg-li-black-surface/90 backdrop-blur px-3 py-2 border-b border-li-border">
        <div className="text-[10px] tracking-[0.3em] text-li-text-muted uppercase font-mono">
          Pinned
        </div>
      </div>
      {items.length === 0 ? (
        <div className="p-3 text-xs text-li-text-muted font-mono">
          No pinned findings.
        </div>
      ) : (
        <ul className="divide-y divide-li-border/60">
          {items.map((p) => (
            <li key={p.id} className="p-3">
              <div className="text-xs text-li-text-primary">
                {p.note ?? p.finding_id}
              </div>
              <div className="text-[10px] text-li-text-muted mt-1 font-mono">
                {new Date(p.pinned_at).toLocaleTimeString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
