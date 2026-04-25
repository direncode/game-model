/**
 * /nato-sim/actors/[name] — single actor card.
 */

import { notFound } from "next/navigation";
import { getActorCard } from "../../_lib/api";
import {
  ProductChrome,
  ProductBody,
} from "../../_components/inr/ProductChrome";

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
    <main className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <ProductChrome
          eyebrow="State/INR · Country Card"
          title={card.topic}
          confidence={card.confidence}
          generatedAt={card.generated_at}
        />
        <ProductBody text={card.text} />
        {card.citations && card.citations.length > 0 && (
          <footer className="mt-8 pt-4 border-t border-li-border">
            <div className="text-[10px] text-li-text-muted tracking-widest uppercase font-mono mb-2">
              Citations
            </div>
            <ul className="text-xs text-li-text-secondary font-mono space-y-1">
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
