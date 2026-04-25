/**
 * Watchboard — INR Indicators & Warning. Restrained, dense.
 * One row per indicator: status light + topic + first sentence + confidence.
 */

import { getWatchboardItems } from "../_lib/api";
import { Letterhead } from "../_components/Letterhead";
import { InrProse } from "../_components/inr/InrProse";

export const dynamic = "force-dynamic";

function statusLight(confidence: string | null | undefined): {
  cls: string;
  label: string;
} {
  // INR Watchboard convention: HIGH confidence in escalation → RED;
  // MEDIUM → AMBER; LOW → GREEN. Tracks "how worried should we be?"
  if (confidence === "HIGH") return { cls: "bg-li-red", label: "RED" };
  if (confidence === "MEDIUM") return { cls: "bg-li-yellow", label: "AMBER" };
  if (confidence === "LOW") return { cls: "bg-li-green", label: "GREEN" };
  return { cls: "bg-li-gray-700", label: "—" };
}

export default async function WatchboardPage() {
  const items = await getWatchboardItems();

  return (
    <main>
      <div className="max-w-4xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-IW-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Indicators &amp; Warning Board
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Watchboard — Eastern Flank
        </h1>
        <div className="mt-2 text-[12px] text-li-text-secondary leading-relaxed">
          Status mapping: <span className="text-li-red">RED</span> high
          confidence in escalation indicator; <span className="text-li-yellow">AMBER</span> medium; <span className="text-li-green">GREEN</span> low / baseline. Promote/demote criteria
          embedded in each line.
        </div>

        <div className="my-8 h-px bg-li-border" />

        {items.length === 0 ? (
          <div className="border-l-2 border-li-text-muted pl-4 py-2 text-[13px] text-li-text-secondary leading-relaxed">
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-li-text-muted">
              draft pending
            </span>
            <p className="mt-1">
              Watchboard items are generated when corpus prep completes
              its first pass.
            </p>
          </div>
        ) : (
          <ol className="space-y-7">
            {items.map((it, idx) => {
              const s = statusLight(it.confidence);
              return (
                <li key={it.id} className="flex gap-5">
                  <div className="flex-shrink-0 w-12 pt-2 flex flex-col items-center">
                    <span className="font-mono text-[10px] text-li-text-muted">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`mt-1 w-2.5 h-2.5 rounded-full ${s.cls}`}
                      aria-label={s.label}
                    />
                    <span className="mt-1 font-mono text-[9px] tracking-[0.2em] uppercase text-li-text-muted">
                      {s.label}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-[19px] text-li-text-primary leading-tight">
                      {it.topic}
                    </h2>
                    <div className="mt-2">
                      <InrProse text={it.text} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
