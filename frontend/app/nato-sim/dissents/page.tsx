/**
 * /nato-sim/dissents — Alternative Views.
 */

import { getDissents } from "../_lib/api";
import {
  ProductChrome,
  EmptyProduct,
} from "../_components/inr/ProductChrome";

export const dynamic = "force-dynamic";

export default async function DissentsPage() {
  const items = await getDissents();
  return (
    <main className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <ProductChrome
          eyebrow="State/INR · Alternative Views"
          title="Dissents"
          subtitle="Competing interpretations attached to the community consensus. INR's footnoted dissent tradition — documenting where we part ways from the baseline."
        />
        {items.length === 0 ? (
          <EmptyProduct
            title="No dissent blocks generated."
            hint="The synthesizer produces these when `judgment/dissent.needs_dissent()` returns True."
          />
        ) : (
          <div className="space-y-6">
            {items.map((d) => (
              <article
                key={d.id}
                className="border border-li-border rounded p-5 bg-li-black-surface/50"
              >
                <div className="flex items-start justify-between">
                  <h2 className="font-display text-xl text-li-text-primary">
                    {d.topic}
                  </h2>
                  {d.confidence && (
                    <span className="text-[10px] px-2 py-0.5 font-mono tracking-widest uppercase rounded bg-li-yellow/15 text-li-yellow">
                      {d.confidence}
                    </span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap text-sm text-li-text-secondary mt-3 font-sans">
                  {d.text}
                </pre>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
