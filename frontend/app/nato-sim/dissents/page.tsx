/**
 * Alternative Views — INR's signature dissent track, listed as
 * standalone cables. One per topic.
 */

import { getDissents } from "../_lib/api";
import { Letterhead } from "../_components/Letterhead";
import { InrProse } from "../_components/inr/InrProse";

export const dynamic = "force-dynamic";

export default async function DissentsPage() {
  const items = await getDissents();
  return (
    <main>
      <div className="max-w-3xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-DISSENT-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Alternative Views — INR Dissent Track
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Where Our Reading Diverges
        </h1>
        <div className="mt-2 text-[12px] text-li-text-secondary leading-relaxed">
          INR's institutional voice has historically dissented when the IC
          consensus and our reading of the evidence parted ways (Iraq WMD
          2002, Afghan reconstruction, Iran enrichment timelines). The
          notes below mark where the available evidence supports a
          competing interpretation worth recording even when the baseline
          assessment holds.
        </div>

        <div className="my-8 h-px bg-li-border" />

        {items.length === 0 ? (
          <div className="border-l-2 border-li-text-muted pl-4 py-2 text-[13px] text-li-text-secondary leading-relaxed">
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-li-text-muted">
              draft pending
            </span>
            <p className="mt-1">
              Alternative View blocks are produced when the dissent
              trigger fires (single-source key claim, low confidence on
              consequential assertions, material source conflict).
            </p>
          </div>
        ) : (
          <ol className="space-y-10">
            {items.map((d, i) => (
              <li key={d.id} className="border-l-2 border-li-yellow/60 pl-5">
                <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-yellow/80 mb-1.5">
                  Alt View · {String(i + 1).padStart(2, "0")}
                </div>
                <h2 className="font-display text-[19px] text-li-text-primary leading-tight">
                  {d.topic}
                </h2>
                <div className="mt-3">
                  <InrProse text={d.text} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
