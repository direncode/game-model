/**
 * /nato-sim/watchboard — Indicators & Warning board.
 */

import { getWatchboardItems } from "../_lib/api";
import {
  ProductChrome,
  EmptyProduct,
} from "../_components/inr/ProductChrome";

export const dynamic = "force-dynamic";

function statusLight(confidence: string | null | undefined): string {
  if (confidence === "HIGH") return "bg-li-red";
  if (confidence === "MEDIUM") return "bg-li-yellow";
  if (confidence === "LOW") return "bg-li-green";
  return "bg-li-gray-700";
}

export default async function WatchboardPage() {
  const items = await getWatchboardItems();

  return (
    <main className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <ProductChrome
          eyebrow="State/INR · Indicators & Warning"
          title="Watchboard"
          subtitle="Red-Amber-Green indicators against scenario-specific red lines. Promote status when the specified observable is met."
        />
        {items.length === 0 ? (
          <EmptyProduct
            title="No Watchboard items populated."
            hint="Generate via the /assessment slash command or the corpus prep script."
          />
        ) : (
          <ul className="divide-y divide-li-border border border-li-border rounded">
            {items.map((it) => (
              <li key={it.id} className="p-4 flex items-start gap-4">
                <span
                  className={`w-3 h-3 mt-1.5 rounded-full flex-shrink-0 ${statusLight(it.confidence)}`}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg text-li-text-primary">
                    {it.topic}
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-li-text-secondary mt-2 font-sans">
                    {it.text}
                  </pre>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
