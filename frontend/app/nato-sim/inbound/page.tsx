/**
 * Inbound Message Traffic — specialized intel-inject workstation.
 *
 * Designed for the AWIS #comms Discord channel format: structured
 * cables with FROM / TO / SUBJECT / DTG / classification / body. Bulk
 * paste, auto-parse each inject, ingest through the resolver + outlier
 * pipeline, render per-message cards with action controls.
 */
import { Letterhead } from "../_components/Letterhead";
import { TrafficWorkstation } from "./TrafficWorkstation";

export const dynamic = "force-dynamic";

export default function InboundPage() {
  return (
    <main>
      <div className="max-w-6xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-COMMS-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Message Traffic · Inbound from #comms
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Cable Traffic Workstation
        </h1>
        <div className="mt-2 text-[13px] text-li-text-secondary leading-relaxed max-w-3xl">
          Paste any block of #comms channel history — the parser splits
          on each INTEL INJECT marker, extracts FROM / TO / SUBJECT / DTG /
          classification / body, dedupes, and runs every inject through
          the entity resolver and outlier scorer. Each card below carries
          a classification banner, source-kind tag (HUMINT / SIGINT /
          OSINT / OFFICIAL / SOCIAL), priority dot, outlier flag, and a
          per-message Operationalize button to push it through the
          tasking pipeline.
        </div>

        <div className="my-8 h-px bg-li-border" />

        <TrafficWorkstation />
      </div>
    </main>
  );
}
