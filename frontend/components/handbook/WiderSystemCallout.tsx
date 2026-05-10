import type { ReactNode } from "react";

export function WiderSystemCallout({ children }: { children: ReactNode }) {
  return (
    <aside className="handbook-wider-system my-8 rounded-lg border-l-4 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 px-5 py-4">
      <div className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
        Wider system
      </div>
      <div className="prose-sm dark:prose-invert">{children}</div>
    </aside>
  );
}
