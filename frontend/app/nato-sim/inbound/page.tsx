/**
 * Inbound Message Traffic — dedicated paste interface.
 *
 * Full-canvas page for the operator to drop incoming traffic during
 * the sim: Discord messages, cables, news snippets, sim injects from
 * Control. Every paste runs through the same pipeline as live Discord
 * ingest would: resolver → entity graph diff → priority + outlier
 * scoring → Traffic column update.
 *
 * Components:
 *   - Source-tag input + quick-chip presets
 *   - Big resizable textarea
 *   - Cmd/Ctrl+Enter to submit
 *   - Recent-ingests list with priority dot + outlier flag + scored time
 */
import { Letterhead } from "../_components/Letterhead";
import { InboundTrafficClient } from "./InboundTrafficClient";

export const dynamic = "force-dynamic";

export default function InboundPage() {
  return (
    <main>
      <div className="max-w-4xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-INBOUND-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Inbound Message Traffic · Manual Ingest
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Paste &amp; Score
        </h1>
        <div className="mt-2 text-[13px] text-li-text-secondary leading-relaxed max-w-3xl">
          Drop Discord messages, foreign-press snippets, FSO cable
          excerpts, sim injects, or any free-text traffic. Each paste is
          run through the resolver (entities + claims), scored for
          priority and outlierness against the rolling baseline, and
          appended to the Traffic column. Apply a source tag so the
          citations downstream are traceable.
        </div>

        <div className="my-8 h-px bg-li-border" />

        <InboundTrafficClient />
      </div>
    </main>
  );
}
