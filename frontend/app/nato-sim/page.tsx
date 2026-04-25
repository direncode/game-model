/**
 * Daily Read — the landing page of the /nato-sim vertical.
 *
 * Real-cable-look: letterhead, double-rule beneath, BLUF block, numbered
 * paragraphs, alt-view aside, confidence strip, classification footer
 * already in the layout chrome. Restrained palette, serif body, mono
 * metadata.
 */
import Link from "next/link";
import { Letterhead } from "./_components/Letterhead";
import { InrProse } from "./_components/inr/InrProse";

export const dynamic = "force-dynamic";

interface Finding {
  id: string;
  topic: string;
  kind: string;
  text: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  generated_at: string;
}

async function getDailyRead(): Promise<Finding | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      (typeof window === "undefined"
        ? process.env.NATO_SIM_BACKEND_URL ?? "http://localhost:8000"
        : "");
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
    <main>
      <div className="max-w-3xl mx-auto px-10 py-10">
        <Letterhead
          cableNumber="INR-NATO-001"
          generatedAt={daily?.generated_at}
        />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Information Memo · Daily Read
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          NATO Eastern Flank — Posture as of 1 April 2030
        </h1>
        <div className="mt-2 text-[12px] text-li-text-secondary leading-relaxed">
          Audience: <span className="text-li-text-primary">DNI</span> · Drafted by State/INR Office of Analysis for Europe ·
          Distribution: ODNI, NSC, Sec State staff
        </div>

        <div className="my-8 h-px bg-li-border" />

        <div className="mb-6 text-[11px] font-mono text-li-text-muted">
          Inbound traffic: <Link href="/nato-sim/inbound" className="text-li-cyan hover:text-li-text-primary">paste &amp; score →</Link>
        </div>

        {daily ? (
          <InrProse text={daily.text} />
        ) : (
          <div className="border-l-2 border-li-text-muted pl-4 py-2 text-[13px] text-li-text-secondary leading-relaxed">
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-li-text-muted">
              draft pending
            </span>
            <p className="mt-1">
              The Daily Read is regenerated when corpus prep completes its first
              pass over the briefing book and starter sources.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
