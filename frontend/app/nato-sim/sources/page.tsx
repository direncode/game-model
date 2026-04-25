/**
 * /nato-sim/sources — corpus browser.
 *
 * Lists every document ingested into the knowledge graph — the briefing
 * book, Friday deck, and every starter-corpus harvest — with a title,
 * origin tag, and a preview. Click a row to expand the full text.
 */

import { ProductChrome, EmptyProduct } from "../_components/inr/ProductChrome";

export const dynamic = "force-dynamic";

interface CorpusRow {
  id: string;
  url: string | null;
  origin: string;
  title: string | null;
  text: string | null;
  source_tier: number | null;
  fetched_at: string;
}

async function listCorpus(): Promise<CorpusRow[]> {
  const base =
    typeof window === "undefined"
      ? process.env.NATO_SIM_BACKEND_URL ?? "http://localhost:8000"
      : "";
  try {
    // We don't have a dedicated /corpus list endpoint yet; the messages
    // endpoint serves for Traffic. Until /corpus is added, surface the
    // relevant distinct origins via a small inline query.
    const res = await fetch(`${base}/api/v1/nato_sim/messages?limit=1`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    // Shim: the sources page prefers corpus_docs; for now return [].
    return [];
  } catch {
    return [];
  }
}

export default async function SourcesPage() {
  const rows = await listCorpus();
  return (
    <main className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <ProductChrome
          eyebrow="State/INR · Source Index"
          title="Sources"
          subtitle="Every document ingested into the knowledge graph. Citations referenced by INR products trace back here."
        />
        {rows.length === 0 ? (
          <EmptyProduct
            title="Corpus browser placeholder."
            hint="The /corpus endpoint is a post-MVP addition. Citations in Daily Read and Actor cards already reference back by paragraph or URL."
          />
        ) : (
          <ul className="divide-y divide-li-border border border-li-border rounded">
            {rows.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex items-baseline justify-between">
                  <div className="font-display text-lg text-li-text-primary">
                    {r.title ?? r.origin}
                  </div>
                  <span className="text-[10px] text-li-text-muted font-mono tracking-widest uppercase">
                    {r.origin}
                  </span>
                </div>
                <p className="text-xs text-li-text-secondary mt-2 line-clamp-3">
                  {r.text?.slice(0, 400)}
                </p>
                {r.url && (
                  <a
                    href={r.url}
                    className="inline-block mt-2 text-[10px] text-li-cyan font-mono tracking-wider uppercase"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    open source →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
