/**
 * NATO Simulation — Daily Read (landing page of the /nato-sim vertical).
 *
 * Renders the most recent "daily-read" finding through the InrProse
 * structured parser (BLUF block, numbered Key Judgments, portion-marker
 * pills, citation chips, alt-view aside, confidence band).
 *
 * IP boundary: this component is deliberately thin. It fetches structured
 * findings from the backend and renders them. No prompts, no scoring logic,
 * no judgment heuristics live in the client.
 */
import { InrProse } from "./_components/inr/InrProse";
import { StateDeptSeal } from "./_components/StateDeptSeal";
import { PasteIngest } from "./_components/PasteIngest";

export const dynamic = "force-dynamic";

interface Finding {
  id: string;
  topic: string;
  kind: string;
  text: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  generated_at: string;
}

async function getDailyRead(): Promise<Finding | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      (typeof window === "undefined" ? "http://localhost:8000" : "");
    const res = await fetch(
      `${base}/api/v1/nato_sim/findings?kind=daily-read&limit=1`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { items: Finding[] };
    return data.items[0] ?? null;
  } catch {
    return null;
  }
}

export default async function NatoSimDailyReadPage() {
  const daily = await getDailyRead();

  return (
    <main className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <header className="border-b border-li-border pb-6 mb-10">
          <div className="flex items-start gap-5">
            <StateDeptSeal size={68} className="text-li-cyan flex-shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] tracking-[0.3em] text-li-text-muted font-mono uppercase">
                U.S. Department of State · Bureau of Intelligence and Research
              </div>
              <h1 className="font-display text-4xl text-li-text-primary mt-1">
                Daily Read
              </h1>
              <p className="text-sm text-li-text-secondary mt-2 max-w-2xl">
                NATO Eastern Flank · 1 April 2030 posture · All-source warning
                intelligence synthesis · Audience: DNI / POTUS via DNI.
                Generated{" "}
                {daily?.generated_at
                  ? new Date(daily.generated_at).toLocaleString()
                  : "—"}
                .
              </p>
            </div>
            {daily?.confidence && (
              <span
                className={
                  "flex-shrink-0 inline-block px-3 py-1 text-[10px] tracking-[0.2em] font-mono uppercase rounded border " +
                  (daily.confidence === "HIGH"
                    ? "bg-li-green/15 text-li-green border-li-green/30"
                    : daily.confidence === "MEDIUM"
                      ? "bg-li-yellow/15 text-li-yellow border-li-yellow/30"
                      : "bg-li-red/15 text-li-red border-li-red/30")
                }
              >
                Confidence · {daily.confidence}
              </span>
            )}
          </div>
        </header>

        <PasteIngest />

        {daily ? (
          <InrProse text={daily.text} />
        ) : (
          <div className="border border-dashed border-li-border rounded p-8 text-center">
            <div className="text-li-text-secondary text-sm font-mono">
              No Daily Read generated yet.
            </div>
            <div className="text-li-text-muted text-xs mt-2 font-mono">
              Corpus prep populates this on first run.
            </div>
          </div>
        )}

        <nav className="mt-12 pt-6 border-t border-li-border">
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {[
              { href: "/nato-sim/actors", label: "Country / Actor Cards" },
              { href: "/nato-sim/watchboard", label: "Watchboard (I&W)" },
              { href: "/nato-sim/network", label: "Network Map" },
              { href: "/nato-sim/dissents", label: "Alternative Views" },
              { href: "/nato-sim/sources", label: "Sources" },
            ].map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="block px-4 py-3 border border-li-border rounded hover:border-li-cyan/40 hover:bg-li-surface-hover transition-colors text-li-text-primary font-mono text-xs tracking-wider uppercase"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
