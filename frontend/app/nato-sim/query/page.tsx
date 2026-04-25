/**
 * Query — dedicated direct-query workstation.
 *
 * Full-canvas Live Query interface. Replaces the cramped one-line dock
 * at the bottom of the canvas. Big input, query history, citations
 * rendered properly, easy to do multi-shot probing.
 */
import { Letterhead } from "../_components/Letterhead";
import { QueryClient } from "./QueryClient";

export const dynamic = "force-dynamic";

export default function QueryPage() {
  return (
    <main>
      <div className="max-w-4xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-QUERY-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Direct Query · Ad-hoc RFI Workstation
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Ask the Corpus
        </h1>
        <div className="mt-2 text-[13px] text-li-text-secondary leading-relaxed max-w-3xl">
          Direct question to the analytical substrate. Each query runs
          RAG retrieval over the briefing book + Friday deck + ingested
          traffic, then synthesizes a response in INR voice with inline
          citations. Use the deep model (Grok-4) for analytic depth;
          history is kept for the session.
        </div>

        <div className="my-8 h-px bg-li-border" />

        <QueryClient />
      </div>
    </main>
  );
}
