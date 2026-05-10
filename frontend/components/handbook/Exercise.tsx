"use client";
import { useState, type ReactNode } from "react";

type Props = {
  number: number;
  children: ReactNode;
  solution?: ReactNode;
};

export function Exercise({ number, children, solution }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="handbook-exercise my-4 rounded-md border border-zinc-200 dark:border-zinc-800 px-4 py-3">
      <div className="flex gap-3">
        <span className="font-semibold text-zinc-500">{number}.</span>
        <div className="flex-1">{children}</div>
      </div>
      {solution && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-xs text-emerald-600 hover:text-emerald-700"
          >
            {open ? "Hide solution" : "Show solution"}
          </button>
          {open && (
            <div className="mt-2 pl-6 border-l-2 border-emerald-300">{solution}</div>
          )}
        </div>
      )}
    </div>
  );
}
