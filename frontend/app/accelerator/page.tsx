import { Nav } from "@/components/landing/Nav";
import Link from "next/link";

/**
 * /accelerator — the 12-layer particle-accelerator architecture page.
 *
 * Sourced from the architecture document in chat/strategy synthesis. The
 * substrate runs on commodity GPU pools today; hardware slots in cleanly
 * at Layer 5 when LSU and ASIC ship.
 */

export const metadata = {
  title: "Accelerator · Latent Ocean",
  description:
    "Twelve-layer substrate accelerator architecture. Cloud GPU pool today. LSU and custom silicon compound onto the same stack.",
};

type Layer = {
  n: number;
  title: string;
  role: string;
  status: "LIVE" | "PARTIAL" | "SCAFFOLD" | "SPEC";
  contents: string[];
};

const LAYERS: Layer[] = [
  {
    n: 1,
    title: "Customer surface",
    role: "Injection point. Where data and intent enter the machine.",
    status: "PARTIAL",
    contents: [
      "Public API (REST, GraphQL, MCP, gRPC)",
      "Web app — system-builder UX",
      "CLI for power users",
      "SDKs (Python, JavaScript, Go, Rust)",
      "Documentation portal at docs.latentocean.com",
    ],
  },
  {
    n: 2,
    title: "System-builder runtime",
    role: "Orchestration layer. Turns customer workflows into executable substrate operations.",
    status: "SCAFFOLD",
    contents: [
      "Visual workflow composer (drag-drop + YAML)",
      "DAG execution engine for substrate workflows",
      "Template marketplace",
      "Operator catalog interface",
      "Lineage tracker and module catalog viewer",
      "Regime card validator",
    ],
  },
  {
    n: 3,
    title: "Substrate execution",
    role: "The actual computation. BTUT cascade plus TCD-JEPA topology plus module formation.",
    status: "LIVE",
    contents: [
      "BTUT cascade orchestrator (8-tier reduction)",
      "TCD-JEPA training orchestrator",
      "Dispersion measurement",
      "Module formation and persistence",
      "Operator runtime (uniform interface for first-party and third-party operators)",
    ],
  },
  {
    n: 4,
    title: "Compute abstraction",
    role: "The cooling system. Routes jobs to whichever GPU is cheapest and available right now.",
    status: "PARTIAL",
    contents: [
      "Multi-cloud GPU pool manager",
      "Cost-aware scheduler with spot-price arbitrage",
      "Job queue with priority tiers",
      "Cold-start mitigation via warm-pool maintenance",
      "Per-customer per-workflow budget guards",
    ],
  },
  {
    n: 5,
    title: "Backend providers",
    role: "The actual GPU procurement layer. Each adapter is a thin wrapper that knows one provider.",
    status: "PARTIAL",
    contents: [
      "RunPod adapter (live)",
      "Lambda Labs adapter",
      "Vast.ai adapter",
      "Crusoe Cloud adapter",
      "CoreWeave adapter",
      "AWS Bedrock, Azure ML, GCP Vertex adapters (for enterprise customers)",
      "On-prem LSU adapter (hardware slots in here when shipped)",
    ],
  },
  {
    n: 6,
    title: "Data plane",
    role: "How customer data flows through the machine without leaking, lingering, or violating residency.",
    status: "PARTIAL",
    contents: [
      "Customer data ingestion (encrypted in transit, schema-validated)",
      "Result delivery (modules and lineage)",
      "S3-compatible storage abstraction with customer-controlled keys",
      "Redis for hot caching of module catalogs",
      "Postgres for metadata, ClickHouse for analytics",
    ],
  },
  {
    n: 7,
    title: "Identity and auth",
    role: "The shielding. Who is allowed to do what, with what data.",
    status: "SCAFFOLD",
    contents: [
      "API key management with rotation and scope restriction",
      "OAuth 2.1 + OIDC for enterprise SSO",
      "RBAC for multi-user organizations",
      "Audit log, immutable and exportable",
      "Compliance attestations: SOC 2, FedRAMP, IL5, IL6, HIPAA, ITAR",
    ],
  },
  {
    n: 8,
    title: "Billing and metering",
    role: "The beam intensity meter. Every operation measured, attributed, billed.",
    status: "SCAFFOLD",
    contents: [
      "Stripe integration for self-serve tiers",
      "Per-job metering with cost transparency",
      "Tier-based quota enforcement",
      "Premium operator marketplace billing",
      "Enterprise contract billing with custom invoicing",
      "Multi-cloud cost reconciliation",
    ],
  },
  {
    n: 9,
    title: "Observability",
    role: "The diagnostics. Without these the machine cannot be operated.",
    status: "PARTIAL",
    contents: [
      "End-to-end job tracing",
      "Substrate metrics (purity, throughput, AUC, regime card compliance)",
      "Cost analytics per customer per workflow per backend",
      "SLA monitoring with latency percentiles",
      "Customer-facing status page",
    ],
  },
  {
    n: 10,
    title: "FDE and customer success",
    role: "Interface to the contracting motion that wraps around the machine.",
    status: "SPEC",
    contents: [
      "CRM integration tracking engagements alongside self-serve activity",
      "FDE engagement workspace for staged workflows and operators",
      "Custom operator deployment pipeline",
      "White-glove escalation routes for tier-1 customers",
    ],
  },
  {
    n: 11,
    title: "Governance",
    role: "The safety system. Without it the contracting motion cannot serve regulated customers.",
    status: "SCAFFOLD",
    contents: [
      "Budget caps at every level",
      "Regulatory boundaries: data residency, encryption at rest, GDPR, HIPAA, ITAR",
      "Operator allow / deny lists per tier",
      "Anomaly detection on the substrate itself",
      "Disaster recovery and cryptographic data lineage proofs",
    ],
  },
  {
    n: 12,
    title: "Hardware bridge",
    role: "Lets the machine extend onto LSU hardware tomorrow without rewriting layers 1-11.",
    status: "SPEC",
    contents: [
      "LSU registration protocol (customer-owned hardware joins their tenant)",
      "Hybrid execution router (some workflows in LSC cloud, others on customer LSU)",
      "Hardware health monitoring in the standard observability stack",
      "Fleet management for multi-LSU deployments",
      "ASIC compatibility layer (custom silicon presents the same operator runtime interface)",
    ],
  },
];

function StatusPill({ status }: { status: Layer["status"] }) {
  const colors = {
    LIVE:      "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    PARTIAL:   "bg-amber-400/15 text-amber-200 border-amber-400/30",
    SCAFFOLD:  "bg-sky-400/15 text-sky-200 border-sky-400/30",
    SPEC:      "bg-white/[0.05] text-white/55 border-white/15",
  } as const;
  return (
    <span className={`inline-flex items-center font-mono text-[10px] uppercase tracking-[0.18em] border rounded-full px-2.5 py-1 ${colors[status]}`}>
      {status}
    </span>
  );
}

export default function AcceleratorPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />

      {/* Header */}
      <header className="relative px-6 md:px-10 pt-32 md:pt-40 pb-12 max-w-[1280px] mx-auto">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-white/50">
          The substrate accelerator
        </div>
        <h1 className="mt-3 font-display text-[56px] md:text-[88px] leading-[0.95] tracking-[-0.035em] text-white">
          Particle accelerator architecture
        </h1>
        <p className="mt-6 max-w-[820px] text-[17px] md:text-[19px] leading-relaxed text-white/70">
          Twelve specialized layers coordinated into one coherent machine. The cloud GPU pool
          runs the substrate today. The on-prem LSU and the eventual custom silicon slot in
          cleanly at Layer 5, with zero migration friction for customers who built on the
          cloud tier.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/benchmarks"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors px-5 py-2.5"
          >
            Benchmarks
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/builder"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 text-white/85 text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:text-white hover:border-white/35 transition-colors px-5 py-2.5"
          >
            System Builder
            <span aria-hidden>→</span>
          </Link>
        </div>
      </header>

      {/* Metaphor */}
      <section className="px-6 md:px-10 py-12 md:py-16 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.03] to-transparent p-7 md:p-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
            The accelerator metaphor
          </div>
          <p className="text-[15px] md:text-[16.5px] leading-relaxed text-white/80 max-w-[920px]">
            A particle accelerator is many specialized subsystems coordinated into one coherent
            machine. Beam line, magnets, RF cavities, detectors, data acquisition, control,
            cooling, vacuum, safety — none of them work alone, all of them must work together.
            Substrate infrastructure follows the same architecture. The customer submits data;
            the machine focuses, accelerates, and detects structure; the substrate&apos;s
            regime card guarantees the output. Each layer is a specialty; together they form
            the machine.
          </p>
        </div>
      </section>

      {/* Layers */}
      <section className="px-6 md:px-10 py-8 max-w-[1280px] mx-auto">
        <div className="space-y-4">
          {LAYERS.map((layer) => (
            <article
              key={layer.n}
              className="rounded-2xl border border-white/12 bg-white/[0.015] hover:bg-white/[0.025] transition-colors p-6 md:p-7"
            >
              <header className="flex items-start gap-5">
                <div className="shrink-0">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/40">Layer</div>
                  <div className="font-mono text-[32px] tabular-nums text-white tracking-[-0.02em] leading-none mt-1">
                    {layer.n.toString().padStart(2, "0")}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-[22px] md:text-[26px] tracking-[-0.02em] text-white leading-tight">
                      {layer.title}
                    </h2>
                    <StatusPill status={layer.status} />
                  </div>
                  <p className="mt-2 text-[14.5px] text-white/65 leading-relaxed max-w-[920px]">
                    {layer.role}
                  </p>
                </div>
              </header>
              <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[14px] text-white/75 pl-1">
                {layer.contents.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span className="mt-2 inline-block w-1 h-1 rounded-full bg-white/40 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Status legend */}
      <section className="px-6 md:px-10 py-12 max-w-[1280px] mx-auto">
        <div className="rounded-2xl border border-white/12 bg-white/[0.015] p-6">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/50 mb-4">
            Status legend
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[13px] text-white/70">
            <div><StatusPill status="LIVE" /> <span className="ml-2">In production, measured by the regime card.</span></div>
            <div><StatusPill status="PARTIAL" /> <span className="ml-2">Working today, partial coverage of the layer.</span></div>
            <div><StatusPill status="SCAFFOLD" /> <span className="ml-2">Architecture defined, implementation underway.</span></div>
            <div><StatusPill status="SPEC" /> <span className="ml-2">Specified in this document, build follows the contracting motion.</span></div>
          </div>
        </div>
      </section>

      {/* Hardware compound */}
      <section className="px-6 md:px-10 py-16 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.03] to-transparent p-7 md:p-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
            How hardware compounds
          </div>
          <h2 className="font-display text-[32px] md:text-[40px] leading-tight tracking-[-0.025em] text-white">
            Same accelerator. New beam source.
          </h2>
          <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-white/75 max-w-[920px]">
            The on-prem Latent Stretcher Unit registers as another backend provider at Layer 5.
            The customer&apos;s workflows, operators, regime-card guarantees, identity surfaces,
            billing, observability, and governance keep running unchanged. From every layer&apos;s
            perspective above Layer 5, an LSU is just a faster, cheaper, customer-controlled
            backend. When custom silicon ships, the ASIC presents the same operator runtime
            interface as the LSU, and the change is again invisible to every layer above.
          </p>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="border-t border-white/10 px-6 md:px-10 py-16 max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-[640px]">
            <h3 className="font-display text-[28px] md:text-[36px] leading-tight tracking-[-0.02em] text-white">
              Build on the accelerator.
            </h3>
            <p className="mt-3 text-[15px] text-white/70 leading-relaxed">
              Open a workflow in the System Builder. Submit jobs to the public API. Engage
              Forward Deployed Engineers for custom integration. Deploy an LSU when the time
              comes. The same accelerator runs every tier.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors px-5 py-2.5"
            >
              Open Builder
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/contracting"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors px-5 py-2.5"
            >
              Contracting model
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
