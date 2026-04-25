/**
 * Network — entity + outlier table view.
 *
 * Replaces the d3 force-directed graph. Real INR analysts work in
 * tables, not animations. Two stacked panels:
 *   1. Entities sorted by degree (most-connected first), with type,
 *      first/last seen, claim count. Clickable to drill into Country
 *      File when the entity is a major actor.
 *   2. Outlier Messages — every message whose outlier_score >= 0.4,
 *      with priority, signal explanations, source, time.
 *
 * No animation. Sortable columns. CSV-table flavor.
 */
import { Letterhead } from "../_components/Letterhead";
import { NetworkTable } from "./NetworkTable";

export const dynamic = "force-dynamic";

export default function NetworkPage() {
  return (
    <main>
      <div className="max-w-5xl mx-auto px-10 py-10">
        <Letterhead cableNumber="INR-NATO-NETWORK-001" />

        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Entity Network · Outlier Surface
        </div>
        <h1 className="font-display text-[34px] leading-tight text-li-text-primary tracking-tight">
          Resolved Knowledge Graph
        </h1>
        <div className="mt-2 text-[13px] text-li-text-secondary leading-relaxed max-w-3xl">
          Every entity the resolver has extracted from the corpus and
          live traffic. Sortable by degree (incoming + outgoing edges),
          first/last seen, type. Below: every message whose outlier
          score crossed the 0.40 threshold, with the fired signals
          explained.
        </div>

        <div className="my-8 h-px bg-li-border" />

        <NetworkTable />
      </div>
    </main>
  );
}
