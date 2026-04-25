/**
 * /nato-sim/actors — Country File index. Letterhead + dense table.
 */

import Link from "next/link";
import { getActorCards } from "../_lib/api";
import { Letterhead } from "../_components/Letterhead";

export const dynamic = "force-dynamic";

function confColor(c: string | null | undefined): string {
  if (c === "HIGH") return "text-li-green";
  if (c === "MEDIUM") return "text-li-yellow";
  if (c === "LOW") return "text-li-red";
  return "text-li-text-muted";
}

function bluf(text: string): string {
  const m = text.match(/^\s*BLUF:\s*(.+?)(?:\n|$)/im);
  if (m) return m[1].trim();
  // fallback: first non-empty line
  return text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
}

export default async function ActorsIndexPage() {
  const cards = await getActorCards();

  return (
    <main>
      <div className="max-w-3xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-COUNTRY-FILES" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Country / Actor Files
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Active Files — NATO Eastern Flank
        </h1>
        <div className="mt-2 text-[12px] text-li-text-secondary leading-relaxed">
          One file per major actor. Each file carries six required
          sections: BLUF, positions, intent, capabilities, red lines,
          wildcards. Click a row to open.
        </div>

        <div className="my-8 h-px bg-li-border" />

        {cards.length === 0 ? (
          <div className="border-l-2 border-li-text-muted pl-4 py-2 text-[13px] text-li-text-secondary leading-relaxed">
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-li-text-muted">
              draft pending
            </span>
            <p className="mt-1">
              Country Files are generated when corpus prep completes its
              first pass.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-li-border border-y border-li-border">
            {cards.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/nato-sim/actors/${encodeURIComponent(c.topic)}`}
                  className="block px-1 py-3 hover:bg-li-surface-hover group"
                >
                  <div className="flex items-baseline gap-4">
                    <span className="font-display text-[18px] text-li-text-primary group-hover:text-li-cyan tracking-tight w-32 flex-shrink-0">
                      {c.topic}
                    </span>
                    <span className="flex-1 text-[12.5px] text-li-text-secondary truncate font-display leading-snug">
                      {bluf(c.text)}
                    </span>
                    <span
                      className={`font-mono text-[9.5px] tracking-[0.3em] uppercase ${confColor(c.confidence)} flex-shrink-0`}
                    >
                      {c.confidence ?? "—"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
