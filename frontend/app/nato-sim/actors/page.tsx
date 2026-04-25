/**
 * /nato-sim/actors — list of pre-generated Country/Actor cards.
 */

import Link from "next/link";
import { getActorCards } from "../_lib/api";
import {
  ProductChrome,
  EmptyProduct,
} from "../_components/inr/ProductChrome";

export const dynamic = "force-dynamic";

export default async function ActorsIndexPage() {
  const cards = await getActorCards();

  return (
    <main className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <ProductChrome
          eyebrow="State/INR · Country Cards"
          title="Country & Actor Cards"
          subtitle="Pre-synthesized positions, intent, capabilities, and red lines for the major actors in the NATO Eastern Flank scenario."
        />

        {cards.length === 0 ? (
          <EmptyProduct
            title="No actor cards yet."
            hint="Run `python -m backend.scripts.prep_nato_corpus` to generate."
          />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/nato-sim/actors/${encodeURIComponent(c.topic)}`}
                  className="block border border-li-border rounded hover:border-li-cyan/40 hover:bg-li-surface-hover transition-colors p-4 h-full"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-display text-lg text-li-text-primary">
                      {c.topic}
                    </div>
                    {c.confidence && (
                      <span
                        className={
                          "text-[9px] px-2 py-0.5 font-mono tracking-widest uppercase rounded " +
                          (c.confidence === "HIGH"
                            ? "bg-li-green/15 text-li-green"
                            : c.confidence === "MEDIUM"
                              ? "bg-li-yellow/15 text-li-yellow"
                              : "bg-li-red/15 text-li-red")
                        }
                      >
                        {c.confidence}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-li-text-muted mt-3 font-mono line-clamp-3">
                    {c.text.split("\n").find((l) => l.trim().startsWith("BLUF")) ??
                      c.text.slice(0, 200)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
