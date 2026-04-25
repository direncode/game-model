/**
 * Sources — corpus index, dense table.
 *
 * Lists every document in `corpus_docs` as a row: title, origin tag,
 * tier badge, fetched-at timestamp, character count. Click a row to
 * expand the full text inline (post-MVP). For now click → external URL
 * if available.
 */

import { Letterhead } from "../_components/Letterhead";

export const dynamic = "force-dynamic";

interface CorpusDoc {
  id: string;
  url: string | null;
  origin: string;
  title: string | null;
  text: string | null;
  source_tier: number | null;
  fetched_at: string;
}

async function listCorpus(): Promise<CorpusDoc[]> {
  const base =
    typeof window === "undefined"
      ? process.env.NATO_SIM_BACKEND_URL ?? "http://localhost:8000"
      : "";
  try {
    const res = await fetch(`${base}/api/v1/nato_sim/corpus?limit=200`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items: CorpusDoc[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

function tierLabel(t: number | null | undefined): string {
  if (t === 1) return "T1";
  if (t === 2) return "T2";
  if (t === 3) return "T3";
  return "—";
}

export default async function SourcesPage() {
  const rows = await listCorpus();

  return (
    <main>
      <div className="max-w-4xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-SOURCES-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Source Index
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Corpus
        </h1>
        <div className="mt-2 text-[12px] text-li-text-secondary leading-relaxed">
          Every document in the analytical substrate. Tier 1 = institutional
          / government primary; Tier 2 = major think tank; Tier 3 = news.
          Citations elsewhere in the workstation reference rows here.
        </div>

        <div className="my-8 h-px bg-li-border" />

        {rows.length === 0 ? (
          <div className="border-l-2 border-li-text-muted pl-4 py-2 text-[13px] text-li-text-secondary leading-relaxed">
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-li-text-muted">
              empty
            </span>
            <p className="mt-1">
              No corpus documents loaded yet. The briefing book + Friday
              deck land here once corpus prep runs.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-li-border border-y border-li-border">
            {rows.map((r) => (
              <li key={r.id} className="px-1 py-3 flex items-baseline gap-4">
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-li-text-muted w-10 flex-shrink-0">
                  {tierLabel(r.source_tier)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[15px] text-li-text-primary truncate">
                    {r.title ?? r.origin}
                  </div>
                  <div className="text-[11px] text-li-text-muted font-mono mt-0.5 truncate">
                    {r.origin} · {r.text?.length ?? 0} chars
                  </div>
                </div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-li-cyan/85 hover:text-li-text-primary tracking-[0.2em] uppercase flex-shrink-0"
                  >
                    open ↗
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
