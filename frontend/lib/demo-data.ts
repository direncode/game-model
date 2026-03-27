/**
 * Pre-baked demo data for landing page simulations.
 * Based on real TCD-JEPA results across three datasets.
 */

// ─── Simulation Node Types ───
export interface SimNode {
  id: string;
  label: string;
  type: string;
  moduleId?: number;
  // Positions at each stage
  positions: {
    idle: [number, number];
    encoded: [number, number];
    exploring: [number, number];
    crystallized: [number, number];
  };
}

export interface SimEdge {
  source: string;
  target: string;
  weight: number;
  appearsAt: "encoded" | "exploring" | "crystallized";
}

export interface SimMetricFrame {
  time: number; // 0-1 normalized
  stage: "encoding" | "exploring" | "crystallizing" | "converged";
  loss: number;
  linkAuc: number;
  moduleCount: number;
  purity: number;
}

// ─── Module Colors ───
export const MODULE_COLORS: Record<number, string> = {
  0: "#00d4ff", // cyan — CMP Pipeline
  1: "#3fb950", // green — Netherlands Hub
  2: "#a371f7", // purple — Singapore ATP
  3: "#d29922", // yellow — Design-to-Fab
  4: "#f85149", // red — China Packaging
  5: "#388bfd", // blue — Lithography
  6: "#c9a96e", // warm — Equipment Suppliers
  7: "#2b5e49", // science — Materials
};

// ─── Semiconductor Demo Nodes (50 node subset) ───
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateNodes(): SimNode[] {
  const rng = seededRandom(42);
  const modules = [
    { id: 0, name: "CMP Pipeline", type: "product", entities: ["CMP Materials", "Etching Tools", "Deposition Eq.", "Polishing Slurry", "Planarization", "Oxide CMP", "Metal CMP"] },
    { id: 1, name: "Netherlands Hub", type: "location", entities: ["NLD", "ASML", "Die Attach NL", "Wet Etch NL", "Philips", "NXP Semi"] },
    { id: 2, name: "Singapore ATP", type: "location", entities: ["SGP", "Assembly Tools SG", "Test Eq. SG", "Packaging SG", "GlobalFoundries SG", "UMC SG"] },
    { id: 3, name: "Design-to-Fab", type: "organization", entities: ["AMD", "Intel", "Inspection Eq.", "Etching Control", "Design Verify", "TSMC", "Samsung Foundry"] },
    { id: 4, name: "China Packaging", type: "organization", entities: ["Shenzhen Axxon", "Die Attach CN", "Lead Frames CN", "Wire Bond CN", "JCET Group", "ASE Tech"] },
    { id: 5, name: "Lithography", type: "product", entities: ["EUV Litho", "DUV Litho", "Mask Align", "Photoresist", "Lens Systems", "Reticle"] },
    { id: 6, name: "Equipment Suppliers", type: "organization", entities: ["Applied Materials", "Lam Research", "Tokyo Electron", "KLA Corp", "Hitachi HiTech"] },
    { id: 7, name: "Materials", type: "product", entities: ["Silicon Wafers", "Rare Earth", "Chemical Precursors", "Target Materials", "Specialty Gases"] },
  ];

  const nodes: SimNode[] = [];
  const centerX = 400;
  const centerY = 300;

  modules.forEach((mod) => {
    const modAngle = (mod.id / modules.length) * Math.PI * 2;
    const modRadius = 180;
    const cx = centerX + Math.cos(modAngle) * modRadius;
    const cy = centerY + Math.sin(modAngle) * modRadius;

    mod.entities.forEach((name, ei) => {
      const entityAngle = (ei / mod.entities.length) * Math.PI * 2;
      const entityRadius = 30 + rng() * 20;

      nodes.push({
        id: `${mod.id}-${ei}`,
        label: name,
        type: mod.type,
        moduleId: mod.id,
        positions: {
          idle: [
            centerX + (rng() - 0.5) * 700,
            centerY + (rng() - 0.5) * 500,
          ],
          encoded: [
            centerX + (rng() - 0.5) * 500,
            centerY + (rng() - 0.5) * 400,
          ],
          exploring: [
            cx + Math.cos(entityAngle + rng() * 0.5) * (entityRadius + 40),
            cy + Math.sin(entityAngle + rng() * 0.5) * (entityRadius + 40),
          ],
          crystallized: [
            cx + Math.cos(entityAngle) * entityRadius,
            cy + Math.sin(entityAngle) * entityRadius,
          ],
        },
      });
    });
  });

  return nodes;
}

function generateEdges(nodes: SimNode[]): SimEdge[] {
  const rng = seededRandom(123);
  const edges: SimEdge[] = [];

  // Intra-module edges (appear during encoding)
  nodes.forEach((n1, i) => {
    nodes.forEach((n2, j) => {
      if (j <= i) return;
      if (n1.moduleId === n2.moduleId && rng() < 0.4) {
        edges.push({
          source: n1.id,
          target: n2.id,
          weight: 0.5 + rng() * 0.5,
          appearsAt: "encoded",
        });
      }
    });
  });

  // Cross-module edges (appear during exploration — hidden connections)
  const crossModulePairs = [
    ["5-0", "0-0"], // EUV Litho ↔ CMP Materials
    ["6-4", "3-0"], // Hitachi ↔ AMD
    ["5-0", "0-1"], // EUV Litho ↔ Etching Tools
    ["1-1", "6-0"], // ASML ↔ Applied Materials
    ["7-0", "0-3"], // Silicon Wafers ↔ Polishing Slurry
    ["4-0", "2-0"], // Shenzhen Axxon ↔ SGP
  ];

  crossModulePairs.forEach(([s, t]) => {
    edges.push({
      source: s,
      target: t,
      weight: 0.3 + rng() * 0.3,
      appearsAt: "exploring",
    });
  });

  return edges;
}

export const DEMO_NODES = generateNodes();
export const DEMO_EDGES = generateEdges(DEMO_NODES);

// ─── Metric Timeline (60 frames for ~15s animation) ───
export const DEMO_METRICS: SimMetricFrame[] = Array.from({ length: 60 }, (_, i) => {
  const t = i / 59;
  let stage: SimMetricFrame["stage"];
  if (t < 0.2) stage = "encoding";
  else if (t < 0.5) stage = "exploring";
  else if (t < 0.85) stage = "crystallizing";
  else stage = "converged";

  return {
    time: t,
    stage,
    loss: Math.max(0.05, 2.5 * Math.exp(-4 * t) + 0.05 * Math.sin(t * 20)),
    linkAuc: Math.min(0.827, 0.45 + 0.377 * (1 - Math.exp(-3 * t))),
    moduleCount: Math.min(16, Math.floor(t < 0.3 ? 0 : (t - 0.3) * 22.8)),
    purity: Math.min(1, t < 0.4 ? 0 : (t - 0.4) * 1.67),
  };
});

// ─── Methodology Stage Data ───
export interface MethodologyStage {
  num: string;
  title: string;
  color: string;
  description: string;
  detail: string;
  stats: { label: string; value: string }[];
}

export const METHODOLOGY_STAGES: MethodologyStage[] = [
  {
    num: "01",
    title: "Data Awakening",
    color: "#00d4ff",
    description: "Ingest entity-relationship data from any source. Auto-detect types, validate, and profile.",
    detail: "The platform ingests raw CSV or graph data and automatically detects entity types, relationship patterns, and data quality metrics. No schema required.",
    stats: [
      { label: "Entities", value: "519" },
      { label: "Edges", value: "2,847" },
      { label: "Types Detected", value: "5" },
      { label: "Density", value: "0.021" },
    ],
  },
  {
    num: "02",
    title: "Crystallization",
    color: "#3fb950",
    description: "Run TCD-JEPA to discover latent structure through persistent homology and crystallize typed modules.",
    detail: "System 1 encodes the graph, System 2 explores the energy landscape via Langevin dynamics, and System 3 crystallizes topological modules using persistent homology.",
    stats: [
      { label: "Modules Found", value: "16" },
      { label: "Link AUC", value: "82.7%" },
      { label: "vs Baseline", value: "+36.6%" },
      { label: "Convergence", value: "200 epochs" },
    ],
  },
  {
    num: "03",
    title: "Interpretation",
    color: "#a371f7",
    description: "Generate human-readable module descriptions, purity scores, and hidden connection analysis.",
    detail: "Each crystallized module receives a semantic name, purity score, and entity composition analysis. Hidden cross-module connections are surfaced with similarity scores.",
    stats: [
      { label: "GOV Purity", value: "100%" },
      { label: "JUD Purity", value: "100%" },
      { label: "Hidden Connections", value: "4" },
      { label: "kNN Accuracy", value: "97.8%" },
    ],
  },
  {
    num: "04",
    title: "Contestation",
    color: "#d29922",
    description: "Challenge, refine, and improve discoveries through structured human-in-the-loop workflows.",
    detail: "Domain experts can challenge module assignments, validate hidden connections, and refine cluster boundaries. Every challenge is tracked with full provenance.",
    stats: [
      { label: "Challenges", value: "12" },
      { label: "Validated", value: "9" },
      { label: "Invalidated", value: "3" },
      { label: "Refinement", value: "+2.1% purity" },
    ],
  },
  {
    num: "05",
    title: "Governance",
    color: "#388bfd",
    description: "Full W3C PROV-compatible lineage tracking. Every output traceable to source data.",
    detail: "Complete audit trail from source data through every transformation. W3C PROV-compatible lineage ensures regulatory compliance and reproducibility.",
    stats: [
      { label: "Lineage Events", value: "847" },
      { label: "PROV Entities", value: "1,366" },
      { label: "Audit Trail", value: "Complete" },
      { label: "SOC 2", value: "Compliant" },
    ],
  },
  {
    num: "06",
    title: "Intelligence Delivery",
    color: "#f85149",
    description: "Reports, alerts, APIs, and embedding search. Transform modules into actionable products.",
    detail: "Export crystallized intelligence as reports, API endpoints, or real-time alerts. Hidden connections surface supply chain risks and strategic opportunities.",
    stats: [
      { label: "Report Types", value: "4" },
      { label: "API Endpoints", value: "12" },
      { label: "Alert Rules", value: "Active" },
      { label: "Embedding Dim", value: "128" },
    ],
  },
];

// ─── Results Tables (Real data from TCD-JEPA paper) ───
export const RESULTS_TCD_VS_BASELINE = [
  { dataset: "ETO Semiconductor", domain: "Supply Chain", entities: 519, tcdAuc: 82.7, baselineAuc: 46.1, improvement: 36.6 },
  { dataset: "GDELT Events", domain: "Geopolitics", entities: 380, tcdAuc: 69.1, baselineAuc: 47.0, improvement: 22.1 },
  { dataset: "SEC EDGAR 10-K", domain: "Finance", entities: 9725, tcdAuc: 66.4, baselineAuc: 46.4, improvement: 20.0 },
];

export const RESULTS_TCD_VS_GNN = [
  { method: "GCN (3-layer)", training: "Supervised", semi: 63.9, gdelt: 85.2, sec: 90.8 },
  { method: "GAT (3-layer)", training: "Supervised", semi: 70.3, gdelt: 92.1, sec: null },
  { method: "GraphSAGE", training: "Supervised", semi: 33.8, gdelt: 59.9, sec: null },
  { method: "JEPA Baseline", training: "Self-supervised", semi: 46.1, gdelt: 47.0, sec: 46.4 },
  { method: "TCD-JEPA", training: "Self-supervised", semi: 82.7, gdelt: 69.1, sec: 66.4 },
];

export const INTERPRETABLE_MODULES = [
  { name: "CMP Pipeline", description: "materials \u2194 etching \u2194 deposition", type: "product", purity: 95 },
  { name: "Netherlands Hub", description: "NLD \u2194 die attach \u2194 wet etch", type: "location", purity: 100 },
  { name: "Singapore ATP", description: "SGP \u2194 assembly tools", type: "location", purity: 92 },
  { name: "Design-to-Fab", description: "AMD, Intel \u2194 inspection \u2194 etching", type: "organization", purity: 88 },
  { name: "China Packaging", description: "Shenzhen Axxon \u2194 die attach \u2194 lead frames", type: "organization", purity: 90 },
];

export const HIDDEN_CONNECTIONS = [
  { source: "Lithography tools", target: "CMP materials", reason: "Sequential fab dependency" },
  { source: "AI ASICs", target: "Hitachi", reason: "Hidden equipment supplier" },
  { source: "EUV lithography", target: "Etch and clean", reason: "Post-litho process flow" },
  { source: "Netherlands", target: "Applied Materials", reason: "Equipment ecosystem" },
];
