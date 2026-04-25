/**
 * Single Country File. Letterhead + Inr prose body.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { getActorCard } from "../../_lib/api";
import { Letterhead } from "../../_components/Letterhead";
import { InrProse } from "../../_components/inr/InrProse";

export const dynamic = "force-dynamic";

export default async function ActorCardPage({
  params,
}: {
  params: { name: string };
}) {
  const actor = decodeURIComponent(params.name);
  const card = await getActorCard(actor);
  if (!card) {
    notFound();
  }

  return (
    <main>
      <div className="max-w-3xl mx-auto px-10 py-10">
        <Letterhead
          cableNumber={`INR-NATO-${actor.toUpperCase().slice(0, 3)}-001`}
          generatedAt={card.generated_at}
        />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Country File · INR Office of Analysis for Europe
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          {card.topic}
        </h1>
        <div className="mt-2 text-[12px] text-li-text-secondary leading-relaxed">
          Audience: DNI · Distribution: ODNI, NSC, Sec State staff ·
          <Link
            href="/nato-sim/actors"
            className="ml-2 text-li-cyan hover:text-li-text-primary"
          >
            ← all files
          </Link>
        </div>

        <div className="my-8 h-px bg-li-border" />

        <InrProse text={card.text} />

        {card.citations && card.citations.length > 0 && (
          <footer className="mt-10 pt-4 border-t border-li-border">
            <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-li-text-muted mb-2">
              Sourcing
            </div>
            <ul className="text-[11px] text-li-text-secondary font-mono space-y-0.5">
              {card.citations.map((c, i) => (
                <li key={i}>[{c}]</li>
              ))}
            </ul>
          </footer>
        )}
      </div>
    </main>
  );
}
