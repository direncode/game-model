"use client";
import { useEffect, useState } from "react";
import type { HandbookOutlineItem } from "@/lib/handbook-types";

type Props = { outline: HandbookOutlineItem[] };

export function OnThisPage({ outline }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveId(e.target.id);
            return;
          }
        }
      },
      { rootMargin: "-100px 0px -66% 0px" },
    );
    for (const item of outline) {
      const el = document.getElementById(item.id);
      if (el !== null) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [outline]);

  if (outline.length === 0) return null;

  return (
    <aside className="handbook-on-this-page hidden lg:block w-56 shrink-0 pl-6 py-6 text-sm">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">On this page</div>
      <ul className="space-y-1">
        {outline.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-3" : ""}>
            <a
              href={`#${item.id}`}
              className={
                activeId === item.id
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
              }
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
