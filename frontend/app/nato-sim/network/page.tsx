/**
 * /nato-sim/network — d3 force-directed entity graph.
 *
 * Shows the top-N entities by degree and every edge between them.
 * Node color by entity type; edge thickness by edge weight. Interactive
 * drag-to-rearrange.
 */

import NetworkGraphClient from "./NetworkGraphClient";
import { ProductChrome } from "../_components/inr/ProductChrome";
import { getNetworkSnapshot } from "../_lib/api";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const snapshot = await getNetworkSnapshot(60);
  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-6 py-6 flex flex-col flex-1 min-h-0">
        <ProductChrome
          eyebrow="State/INR · Network Map"
          title="Entity Network"
          subtitle={`${snapshot.nodes.length} top entities · ${snapshot.edges.length} edges. Drag to rearrange; colors by type.`}
        />
        <div className="flex-1 min-h-0 border border-li-border rounded overflow-hidden bg-li-black-surface/50">
          <NetworkGraphClient nodes={snapshot.nodes} edges={snapshot.edges} />
        </div>
      </div>
    </main>
  );
}
