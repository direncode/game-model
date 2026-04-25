/**
 * /nato-sim/network — d3 force-directed entity graph.
 *
 * Shows the top-N entities by degree and every edge between them.
 * Node color by entity type; edge thickness by edge weight. Interactive
 * drag-to-rearrange.
 */

import NetworkGraphClient from "./NetworkGraphClient";
import { Letterhead } from "../_components/Letterhead";
import { getNetworkSnapshot } from "../_lib/api";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const snapshot = await getNetworkSnapshot(60);
  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-10 py-6 flex flex-col flex-1 min-h-0">
        <Letterhead cableNumber="INR-NATO-NETWORK-001" />
        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-li-text-muted mb-1">
          Entity Network
        </div>
        <h1 className="font-display text-[28px] leading-tight text-li-text-primary tracking-tight">
          Resolved Knowledge Graph — Top Entities
        </h1>
        <div className="mt-2 mb-5 text-[12px] text-li-text-secondary leading-relaxed">
          {snapshot.nodes.length} entities · {snapshot.edges.length} edges. Drag
          to rearrange. Color by type:
          <span className="text-li-cyan ml-2">actor</span>
          <span className="text-li-green ml-2">place</span>
          <span className="text-li-yellow ml-2">event</span>
          <span className="text-li-purple ml-2">system</span>
          <span className="text-li-blue ml-2">region</span>
        </div>
        <div className="flex-1 min-h-0 border border-li-border bg-li-black-surface/40">
          <NetworkGraphClient nodes={snapshot.nodes} edges={snapshot.edges} />
        </div>
      </div>
    </main>
  );
}
