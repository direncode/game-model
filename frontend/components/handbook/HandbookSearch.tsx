"use client";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import NextLink from "next/link";

type Entry = {
  slug: string;
  title: string;
  outline: { id: string; text: string }[];
};

type FlatEntry = {
  slug: string;
  title: string;
  heading: string | null;
  anchor: string | null;
};

type Props = { dataset: Entry[] };

export function HandbookSearch({ dataset }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const flatDataset = useMemo<FlatEntry[]>(() => {
    const out: FlatEntry[] = [];
    for (const entry of dataset) {
      out.push({ slug: entry.slug, title: entry.title, heading: null, anchor: null });
      for (const h of entry.outline) {
        out.push({ slug: entry.slug, title: entry.title, heading: h.text, anchor: h.id });
      }
    }
    return out;
  }, [dataset]);

  const fuse = useMemo(
    () => new Fuse(flatDataset, { keys: ["title", "heading"], threshold: 0.4 }),
    [flatDataset],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isModK) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const results = query.trim() ? fuse.search(query).slice(0, 20) : [];

  return (
    <div className="handbook-search fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/30">
      <div className="bg-white dark:bg-zinc-950 w-[600px] max-w-[90vw] rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the handbook…"
          className="w-full px-4 py-3 bg-transparent text-base outline-none border-b border-zinc-200 dark:border-zinc-800"
        />
        <ul className="max-h-96 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <NextLink
                href={`/handbook/${r.item.slug}${r.item.anchor ? `#${r.item.anchor}` : ""}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="text-sm font-medium">{r.item.title}</div>
                {r.item.heading && (
                  <div className="text-xs text-zinc-500 mt-0.5">› {r.item.heading}</div>
                )}
              </NextLink>
            </li>
          ))}
          {query.trim() && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-zinc-500">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}
