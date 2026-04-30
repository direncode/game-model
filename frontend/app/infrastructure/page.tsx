import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "Infrastructure · Latent Ocean",
  description: "The Latent Ocean appliance: an air-gap-capable single-binary that ingests any corpus and forms a deterministic private model. Workgroup, departmental, and sovereign-cluster postures with concrete hardware envelopes.",
};

const PROFILES = [
  {
    name: "Workgroup",
    sub: "single team · departmental corpus",
    cpu: "16 vCPU",
    ram: "64 GB",
    disk: "2 TB NVMe",
    gpu: "optional · CPU sufficient",
    corpora: "≤ 10 GB",
    formed_models: "up to 50",
    qps: "≈ 120 deterministic q/s",
  },
  {
    name: "Departmental",
    sub: "division · multi-team",
    cpu: "32 vCPU",
    ram: "256 GB",
    disk: "12 TB NVMe",
    gpu: "1× A6000 / H100 · RunPod-bridge",
    corpora: "≤ 200 GB",
    formed_models: "up to 500",
    qps: "≈ 600 deterministic q/s",
  },
  {
    name: "Sovereign",
    sub: "enterprise · multi-site replicated",
    cpu: "128+ vCPU per node",
    ram: "1 TB+ per node",
    disk: "100 TB+ NVMe per node",
    gpu: "8× H100 / B200 per node",
    corpora: "petabyte-class",
    formed_models: "unbounded",
    qps: "≈ 10,000+ deterministic q/s",
  },
];

const POSTURE = [
  { k: "external network calls during formation", v: "0", strong: true },
  { k: "external network calls during query", v: "0", strong: true },
  { k: "telemetry / phone-home", v: "none", strong: true },
  { k: "license check-in", v: "offline-first; no call required", strong: true },
  { k: "updates", v: "signed bundles · sneakernet only", strong: false },
  { k: "audit log", v: "append-only · cryptographic", strong: false },
  { k: "key custody", v: "appliance-local TPM 2.0 / KMS", strong: false },
  { k: "physical attestation", v: "secure boot · measured launch", strong: false },
  { k: "encryption at rest", v: "AES-256-GCM · per-appliance master key", strong: false },
  { k: "tenant isolation", v: "per-tenant directory + tenant-scoped HMAC", strong: false },
];

const DEPLOY = [
  { kind: "Helm chart", brief: "helm install range latentocean/range-appliance", note: "k8s-native, multi-replica with Redis-backed store, ingress + cert-manager wiring." },
  { kind: "Terraform module", brief: "module \"range\" { source = \"latentocean/range/aws\" }", note: "EKS / GKE / AKS / on-prem k8s; KMS encryption key, OIDC issuer, ingress hostname all module inputs." },
  { kind: "Docker Compose", brief: "docker compose -f range.compose.yml up -d", note: "Single-node footprint for a workgroup deployment. Survives container restarts via writable volumes." },
  { kind: "Static binary", brief: "curl -sL https://get.latentocean.com/range | sh", note: "Single Go binary for ops paths. Wraps the API; no runtime dependencies." },
  { kind: "Air-gapped install", brief: "range install --offline range-1.0.tar.zst", note: "Sealed bundle delivered via approved physical media. Every layer signed; verifies on-host before any process starts." },
];

export default function InfrastructurePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-24">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Infrastructure · the appliance
            </p>
            <h1 className="font-display font-medium text-[clamp(56px,9vw,128px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl">
              One binary.<br />
              <span className="text-white/45">Your network. Your rules.</span>
            </h1>
            <p className="mt-8 text-lg text-white/65 max-w-3xl leading-snug">
              Latent Ocean ships as a single coherent appliance that mounts
              into the infrastructure you already run — Kubernetes,
              Terraform, bare metal, or sealed in an offline cabinet for
              SCIF-class environments. The corpus stays where it already
              lives. The formed model is written to local storage. The
              query interface listens on an internal address. Nothing
              leaves the rack.
            </p>
          </div>
        </section>

        {/* Topology engraving */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Topology · all internal · no egress
            </p>
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-10">
              The whole story <span className="text-white/45">on one rack.</span>
            </h2>
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
              <pre className="p-7 md:p-10 text-[12.5px] md:text-[13.5px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{`     ┌──────────────────────────┐
     │ enterprise data lake      │
     │  (postgres / S3 / on-prem)│
     └────────────┬──────────────┘
                  │  read-only mount
                  ▼
     ┌──────────────────────────┐    ┌──────────────────┐
     │  Range appliance          │◄──►│ analysts / SOC   │
     │   ├─ ingest (L0)          │    │  (internal LAN)  │
     │   ├─ BTUT (L1)            │    └──────────────────┘
     │   ├─ TCD-JEPA (L2)        │
     │   ├─ lineage ledger (L3)  │    ┌──────────────────┐
     │   ├─ replay (L4)          │◄──►│ audit / IG team  │
     │   └─ RangeQL (L5)         │    │  (read-only API) │
     │                           │    └──────────────────┘
     │  formed_models/*.range    │
     └────────────┬──────────────┘
                  │  signed updates only
                  ▼
            ╳   no internet   ╳
            ╳   no telemetry  ╳
            ╳   no phone-home ╳`}
              </pre>
            </div>
          </div>
        </section>

        {/* Network posture */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Network posture · default-deny
            </p>
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-10">
              Ten settings <span className="text-white/45">that don't move.</span>
            </h2>
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
              {POSTURE.map((p, i) => (
                <div key={p.k} className={`grid grid-cols-[1.4fr_1fr] px-6 py-4 ${i < POSTURE.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                  <span className="font-mono text-[12.5px] text-white/55">{p.k}</span>
                  <span className={`font-mono text-[12.5px] tabular-nums text-right ${p.strong ? "text-white" : "text-white/85"}`}>
                    {p.v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Hardware profiles */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Hardware envelopes
            </p>
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-10">
              Three sizes. <span className="text-white/45">Same binary.</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PROFILES.map((p) => (
                <div key={p.name} className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-7">
                  <div className="font-display font-medium text-3xl tracking-[-0.02em] text-white mb-1">{p.name}</div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40 mb-6">{p.sub}</div>
                  <Spec k="cpu" v={p.cpu} />
                  <Spec k="ram" v={p.ram} />
                  <Spec k="disk" v={p.disk} />
                  <Spec k="gpu" v={p.gpu} />
                  <div className="my-3 h-px bg-white/[0.06]" />
                  <Spec k="corpora" v={p.corpora} />
                  <Spec k="formed models" v={p.formed_models} />
                  <Spec k="query rate" v={p.qps} highlight />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Deployment paths */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Deployment paths
            </p>
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-10">
              Five ways in. <span className="text-white/45">All offline-first.</span>
            </h2>
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
              {DEPLOY.map((d, i) => (
                <div key={d.kind} className={`p-6 md:p-8 ${i < DEPLOY.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                  <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-3">
                    <div>
                      <div className="font-display font-medium text-2xl tracking-[-0.02em] text-white mb-1">{d.kind}</div>
                      <div className="font-mono text-[12px] text-white/55">{d.note}</div>
                    </div>
                    <code className="font-mono text-[12px] text-white/85 px-3 py-2 rounded-lg border border-white/10 bg-black/60 shrink-0">
                      {d.brief}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative px-6 py-32">
          <div className="max-w-[1080px] mx-auto text-center">
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-6">
              Mount it.
            </h2>
            <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-snug">
              Tell engineering your environment and primary use case.
              We respond same business day with a fitted appliance
              specification and the install path appropriate to your posture.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href="mailto:engineering@latentocean.com" className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
                engineering@latentocean.com
              </a>
              <Link href="/api-docs" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                API surface
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Spec({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40 shrink-0">{k}</span>
      <span className={`font-mono text-[12.5px] tabular-nums text-right ${highlight ? "text-white" : "text-white/85"}`}>{v}</span>
    </div>
  );
}
