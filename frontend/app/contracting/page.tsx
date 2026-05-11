import { Nav } from "@/components/landing/Nav";
import Link from "next/link";

/**
 * /contracting — the contracting motion + tier model.
 *
 * This is the page that frames Latent Ocean as an infrastructure-contracting
 * company, not a SaaS startup. Comparables are Bechtel / Booz Allen / Leidos
 * with horizontal substrate technology underneath.
 */

export const metadata = {
  title: "Contracting · Latent Ocean",
  description:
    "Infrastructure contracting model. Substrate stays horizontal. Customer-specific systems built by Forward Deployed Engineers. Lock-in through integration depth, not vendor capture.",
};

const TIERS = [
  {
    name: "Self-serve",
    profile: "Developers, small teams, researchers, journalists, civil society",
    hardware: "Cloud API access on the pooled-compute backend (LSC)",
    surface: "Public API · System Builder web app · CLI · SDKs",
    support: "Documentation and community",
    horizontal: "Open-core substrate, metered premium operators",
    moat_for_customer: "Substrate access at marginal cost",
  },
  {
    name: "Professional",
    profile: "Mid-market enterprises with substantial structure-discovery workloads",
    hardware: "Cloud API access with reserved capacity",
    surface: "Same as self-serve, plus organization-level SSO and RBAC",
    support: "Email and chat support, response-time SLA",
    horizontal: "Open-core substrate, metered premium operators, custom workflow templates",
    moat_for_customer: "Workflow templates accumulate across the organization",
  },
  {
    name: "Enterprise",
    profile: "Large enterprises with multi-team substrate adoption",
    hardware: "Cloud API + optional on-prem LSU cluster",
    surface: "All previous, plus FDE engagement workspace, custom operators, audit log",
    support: "Forward Deployed Engineer hours bundled, escalation paths, named technical contact",
    horizontal: "Full substrate plus customer-specific operator catalog plus integration code",
    moat_for_customer: "Substrate becomes structural to the customer's data pipeline",
  },
  {
    name: "Strategic",
    profile: "Sovereign, defense, intelligence, financial, healthcare, FAANG-class",
    hardware: "Dedicated LSU clusters, air-gapped or sovereign deployment available",
    surface: "All previous, plus co-developed operators, joint regime extensions",
    support: "Direct HQ channel, dedicated FDE team, quarterly architecture reviews",
    horizontal: "Substrate plus joint IP plus jointly-developed regime card extensions",
    moat_for_customer: "Substrate becomes critical infrastructure operated jointly",
  },
];

const LOCK_IN = [
  {
    name: "Integration depth",
    body: "After an FDE engagement integrates the substrate with a customer's data sources, identity systems, regulatory boundaries, alert routing, and operations runbooks, no competitor can match that without years of similar engagement. The customer's workflows are wired into hundreds of touchpoints. Migrating means rebuilding hundreds of touchpoints.",
  },
  {
    name: "Operator catalog co-development",
    body: "Each contract produces operators. Some become public open-core. Some stay proprietary to the customer. Some get licensed back into the metered marketplace. Either way, the catalog grows with every engagement, and the next engagement starts from a richer baseline.",
  },
  {
    name: "Operations institutional knowledge",
    body: "Knowing the customer's failure modes, edge cases, seasonal patterns, regulatory blind spots, and incident history is non-transferable. The operations team that has run a customer's substrate for years cannot be replicated by a competitor's onboarding deck.",
  },
  {
    name: "Trust and clearances",
    body: "For sovereign, defense, intelligence, financial, and healthcare customers, the contractor with existing trust relationships and active clearances has near-infinite advantage. New entrants cannot bid on classified work without years of clearance processing.",
  },
  {
    name: "Hardware footprint",
    body: "Once a customer has deployed an LSU cluster on-prem, sized to their workload, integrated into their infrastructure, with a multi-year operations contract, the switching cost is not just software migration. It is physical hardware replacement plus integration redo plus operations rehiring plus regulatory revalidation.",
  },
  {
    name: "Co-developed IP",
    body: "Strategic customers co-develop substrate operators and regime extensions. Joint trade secrets. Joint OpenTimeStamps. The customer cannot take this IP elsewhere because part of it belongs to Latent Ocean. The relationship is structurally bound.",
  },
];

const COMPARABLES = [
  { name: "Bechtel", role: "Engineering and construction infrastructure" },
  { name: "Fluor", role: "Industrial integration" },
  { name: "Booz Allen Hamilton", role: "Deep government and intelligence integration" },
  { name: "Leidos", role: "Defense and intelligence systems integration" },
  { name: "KBR", role: "Engineering services and operations" },
  { name: "Lockheed Martin Mission Systems", role: "Defense systems integration and operations" },
];

function Section({ id, title, kicker, children }: { id?: string; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="px-6 md:px-10 py-20 md:py-24 max-w-[1280px] mx-auto">
      {kicker && (
        <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-white/45 mb-3">{kicker}</div>
      )}
      <h2 className="font-display text-[40px] md:text-[56px] leading-[1.02] tracking-[-0.025em] text-white mb-6">
        {title}
      </h2>
      <div className="text-[15px] md:text-[16px] leading-relaxed text-white/72">{children}</div>
    </section>
  );
}

export default function ContractingPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />

      {/* Header */}
      <header className="relative px-6 md:px-10 pt-32 md:pt-40 pb-12 max-w-[1280px] mx-auto">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-white/50">
          Infrastructure contracting, not vendor SaaS
        </div>
        <h1 className="mt-3 font-display text-[56px] md:text-[88px] leading-[0.95] tracking-[-0.035em] text-white">
          The contracting model.
        </h1>
        <p className="mt-6 max-w-[820px] text-[17px] md:text-[19px] leading-relaxed text-white/70">
          Latent Ocean is the substrate. The customer is the buyer. The system in between is
          built by Forward Deployed Engineers, integrated into the customer&apos;s environment,
          and operated under multi-year contract. Bechtel-shape with substrate technology
          underneath that no comparable infrastructure contractor has access to.
        </p>
      </header>

      {/* Quote framing */}
      <section className="px-6 md:px-10 py-10 max-w-[1280px] mx-auto">
        <blockquote className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.03] to-transparent p-7 md:p-10 text-[17px] md:text-[19px] leading-relaxed text-white/85">
          Bechtel does not sell concrete to dam-builders. Bechtel builds the dam, on the
          customer&apos;s site, using Bechtel&apos;s standardized engineering methods, for the
          customer&apos;s outcome, and then Bechtel operates it.
          <br />
          <br />
          Latent Ocean does not sell substrate to customers and let them figure out what to do
          with it. Latent Ocean builds the customer&apos;s structure-discovery system, using
          the standardized substrate underneath, in the customer&apos;s environment, for the
          customer&apos;s outcome, and operates it.
        </blockquote>
      </section>

      {/* Tiers */}
      <Section id="tiers" kicker="Engagement tiers" title="Four ways in. Same substrate underneath.">
        <p className="mb-8 max-w-[860px]">
          Every customer engagement uses the identical BTUT cascade plus TCD-JEPA topology plus
          the regime card. What differs is the depth of integration, the operations model, and
          the level of HQ engagement. Customers enter at the tier that matches their structure
          and grow into deeper tiers as their substrate workload expands.
        </p>

        <div className="space-y-4">
          {TIERS.map((t) => (
            <article key={t.name} className="rounded-2xl border border-white/12 bg-white/[0.015] p-6 md:p-7">
              <header className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
                <h3 className="font-display text-[24px] md:text-[28px] tracking-[-0.02em] text-white">
                  {t.name}
                </h3>
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55 max-w-[60%] text-right">
                  {t.profile}
                </div>
              </header>
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-[14px]">
                <div>
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-1">Compute surface</dt>
                  <dd className="text-white/82">{t.hardware}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-1">Customer surface</dt>
                  <dd className="text-white/82">{t.surface}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-1">Support model</dt>
                  <dd className="text-white/82">{t.support}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-1">Horizontal substrate boundary</dt>
                  <dd className="text-white/82">{t.horizontal}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-1">What the customer accumulates</dt>
                  <dd className="text-white/82">{t.moat_for_customer}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Section>

      {/* Strategic-tier case studies */}
      <Section id="strategic-cases" kicker="Strategic-tier engagements" title="Operational primitives delivered.">
        <p className="mb-8 max-w-[860px]">
          The Strategic tier is the sovereign, defense, intelligence, financial, and
          healthcare end of the contracting model. The substrate deploys above the
          customer&apos;s existing detection or signal layer as a campaign-intelligence
          primitive — measured, reproducible, sovereign-owned, certifiable. Each
          engagement is a referenceable case study, evaluated by technical reviewers
          against on-disk artifacts.
        </p>
        <div className="grid md:grid-cols-1 gap-4">
          <Link
            href="/contracting/mine-sweep"
            className="group rounded-2xl border border-white/12 bg-white/[0.015] p-6 md:p-7 hover:border-cyan-400/30 hover:bg-cyan-500/[0.025] transition-colors"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-4 mb-3">
              <h3 className="font-display text-[24px] md:text-[28px] tracking-[-0.02em] text-white group-hover:text-cyan-100 transition-colors">
                Mine countermeasures · Strait of Hormuz
              </h3>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55">
                UAE EDGE Group · ADASI integration · 6 months to fielded
              </div>
            </div>
            <p className="text-[14px] text-white/72 leading-relaxed max-w-[860px]">
              OCEAN Substrate as the campaign-intelligence + auditability + sovereignty
              primitive layered above existing classical sonar ATR. Measured on real
              public multibeam sonar at 0.9347 within-class generalization on the
              dominant threat class, 2.13× novel-class structural separation (strengthens
              with scale), 11-field per-detection structured audit vs 4 from classical
              methods, byte-identical reproducibility. Native on-premise console binary
              + operator-modifiable OCEAN pipeline. Operational value $20-45B per
              Hormuz mining event in market-disruption avoided.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              <span className="inline-flex items-center h-7 px-3 rounded-full border border-white/10">measurement-anchored</span>
              <span className="inline-flex items-center h-7 px-3 rounded-full border border-white/10">on-prem TUI included</span>
              <span className="inline-flex items-center h-7 px-3 rounded-full border border-white/10">EDGE pathway documented</span>
              <span className="inline-flex items-center h-7 px-3 rounded-full border border-cyan-400/30 text-cyan-200/80 group-hover:bg-cyan-500/10">
                read case study →
              </span>
            </div>
          </Link>
        </div>
      </Section>

      {/* Lock-in */}
      <Section id="lockin" kicker="The moat is in the integration depth" title="Six compounding lock-in mechanisms.">
        <p className="mb-8 max-w-[860px]">
          Substrate code is reproducible by competitors over time. Integration depth is not.
          Each of these mechanisms compounds across engagements, and together they form the
          durable contracting moat.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {LOCK_IN.map((m, i) => (
            <div key={m.name} className="rounded-2xl border border-white/12 bg-white/[0.015] p-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-2">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="font-display text-[20px] tracking-[-0.015em] text-white">{m.name}</h3>
              <p className="mt-3 text-[14px] text-white/72 leading-relaxed">{m.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Not Palantir */}
      <Section id="not-palantir" kicker="Horizontal, not vertical" title="The Palantir distinction.">
        <p className="max-w-[860px]">
          Palantir&apos;s contracting motion is verticalization. Each Foundry deployment becomes a
          vertical product for a specific industry. The substrate underneath is invisible. The
          customer is locked into the vertical product line.
        </p>
        <p className="mt-4 max-w-[860px]">
          Latent Ocean&apos;s contracting motion is integration. The Forward Deployed Engineer
          helps a customer wire OCEAN into the customer&apos;s existing infrastructure, builds
          custom workflows in the standard System Builder, and delivers custom operators when
          needed. The substrate stays horizontal. The UX is the same for every customer. What
          differs is the data the customer routes through it.
        </p>
        <p className="mt-4 max-w-[860px] text-white/55">
          Stripe Solutions Engineers, Snowflake Architects, dbt Consultants, Databricks
          Solutions Architects all do Forward Deployed engagements without verticalizing the
          underlying product. That is the model.
        </p>
      </Section>

      {/* Comparables */}
      <Section id="comparables" kicker="Comparables" title="The shape, not the technology.">
        <p className="mb-6 max-w-[860px]">
          These are not aspirational comparisons. These are the company shapes that compound
          durably in critical infrastructure delivery. None of them have the substrate
          technology that Latent Ocean has; that is the differentiator inside the contracting
          motion. The contracting motion itself is the shape these institutions established.
        </p>
        <ul className="grid md:grid-cols-2 gap-3">
          {COMPARABLES.map((c) => (
            <li key={c.name} className="rounded-xl border border-white/12 bg-white/[0.015] px-5 py-4">
              <div className="font-display text-[18px] tracking-[-0.015em] text-white">{c.name}</div>
              <div className="mt-1 text-[13px] text-white/60">{c.role}</div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 md:px-10 py-16 max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-[640px]">
            <h3 className="font-display text-[28px] md:text-[36px] leading-tight tracking-[-0.02em] text-white">
              Engage the substrate.
            </h3>
            <p className="mt-3 text-[15px] text-white/70 leading-relaxed">
              Open a workflow self-serve. Engage Forward Deployed Engineers for custom
              integration. Move to dedicated LSU clusters under a multi-year operations
              contract. The substrate underneath stays the same. The depth of relationship
              compounds.
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
              href="/benchmarks"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors px-5 py-2.5"
            >
              Benchmarks
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/accelerator"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors px-5 py-2.5"
            >
              Architecture
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
