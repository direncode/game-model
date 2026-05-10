"use client";

import { Nav } from "@/components/landing/Nav";
import Link from "next/link";
import { useState } from "react";

/**
 * /builder — the System Builder UX scaffold.
 *
 * A working draft of the drag-build-run workflow composer. Currently a
 * static node-based view of an example substrate pipeline; the interactive
 * canvas and live job submission wire into Layers 2 + 4 + 5 once those
 * land in the backend.
 */

type Node = {
  id: string;
  kind: "source" | "btut" | "tcd" | "measure" | "output";
  title: string;
  sub: string;
  status: "ready" | "running" | "done";
};

const TEMPLATES = [
  {
    id: "intrusion",
    title: "Intrusion classification",
    sub: "NSL-KDD shape — 6 attack classes recovered at perfect purity",
    nodes: 5,
    runtime: "≈ 5s GPU per 5K records",
  },
  {
    id: "documents",
    title: "Document archive clustering",
    sub: "TNA-shape historical corpus — 6 archives separated at perfect purity",
    nodes: 5,
    runtime: "≈ 10s GPU per 1K records",
  },
  {
    id: "anomaly",
    title: "Anomaly detection (rare-class)",
    sub: "Class imbalance up to 10,000:1, perfect purity within regime",
    nodes: 5,
    runtime: "≈ 5s GPU per 5K records",
  },
  {
    id: "dedup",
    title: "Training-data deduplication",
    sub: "BTUT-cascade-driven near-duplicate detection",
    nodes: 5,
    runtime: "≈ 4s GPU per 100K records",
  },
  {
    id: "regime",
    title: "Regime-shift detection",
    sub: "Time-series substrate over rolling windows",
    nodes: 6,
    runtime: "≈ 8s GPU per 10K records",
  },
  {
    id: "modality",
    title: "Cross-modal structure transfer",
    sub: "Universal substrate across text + numeric + code modalities",
    nodes: 7,
    runtime: "≈ 30s GPU per modality",
  },
];

const DEFAULT_PIPELINE: Node[] = [
  { id: "n1", kind: "source",  title: "Data source",     sub: "Entities + edges in",     status: "ready" },
  { id: "n2", kind: "btut",    title: "BTUT cascade",    sub: "8-tier reduction",        status: "ready" },
  { id: "n3", kind: "tcd",     title: "TCD-JEPA",        sub: "Topology training",       status: "ready" },
  { id: "n4", kind: "measure", title: "Dispersion",      sub: "Purity + self-basin",     status: "ready" },
  { id: "n5", kind: "output",  title: "Module catalog",  sub: "Lineage + AUC + regime",  status: "ready" },
];

function NodeBox({ node }: { node: Node }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-black/60 backdrop-blur-md px-5 py-4 min-w-[200px]">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 mb-1">
        {node.kind}
      </div>
      <div className="font-display text-[18px] tracking-[-0.015em] text-white leading-tight">
        {node.title}
      </div>
      <div className="mt-1 text-[12.5px] text-white/55 leading-snug">{node.sub}</div>
    </div>
  );
}

export default function BuilderPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("intrusion");

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />

      {/* Header */}
      <header className="relative px-6 md:px-10 pt-32 md:pt-40 pb-12 max-w-[1280px] mx-auto">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-white/50">
          Layer 2 · System Builder
        </div>
        <h1 className="mt-3 font-display text-[56px] md:text-[88px] leading-[0.95] tracking-[-0.035em] text-white">
          Build the system.
        </h1>
        <p className="mt-6 max-w-[820px] text-[17px] md:text-[19px] leading-relaxed text-white/70">
          Compose a substrate workflow. Drag a data source onto the canvas, wire it through
          BTUT then TCD-JEPA then dispersion, save the template, run the job. The output is
          guaranteed against the regime card. No code required.
        </p>
      </header>

      {/* Canvas */}
      <section className="px-6 md:px-10 pb-12 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.02] to-transparent p-6 md:p-8 overflow-x-auto">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-1">
                Workflow canvas
              </div>
              <div className="text-[14px] text-white/65">
                Active template: <span className="text-white font-medium">
                  {TEMPLATES.find((t) => t.id === selectedTemplate)?.title}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                disabled
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45 border border-white/10 rounded-full px-4 py-2 cursor-not-allowed"
              >
                Save template
              </button>
              <button
                disabled
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/85 border border-white/30 rounded-full px-4 py-2 hover:bg-white/[0.04] cursor-not-allowed"
              >
                Run on LSC
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-fit">
            {DEFAULT_PIPELINE.map((node, idx) => (
              <div key={node.id} className="flex items-center gap-3">
                <NodeBox node={node} />
                {idx < DEFAULT_PIPELINE.length - 1 && (
                  <svg width="24" height="14" viewBox="0 0 24 14" fill="none" className="shrink-0">
                    <path
                      d="M0 7h22m0 0L15 1m7 6L15 13"
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 text-[12px] text-white/40 font-mono">
            Interactive canvas, drag-drop authoring, and live job submission ship with Layer 2 v1.
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="px-6 md:px-10 py-12 max-w-[1280px] mx-auto">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-white/45 mb-3">
          Templates
        </div>
        <h2 className="font-display text-[32px] md:text-[44px] leading-tight tracking-[-0.025em] text-white">
          Start from a measured workflow.
        </h2>
        <p className="mt-3 text-[14.5px] text-white/65 max-w-[820px]">
          Each template corresponds to a workflow shape proven during the regime-card campaign.
          The runtime numbers below are measured on the production endpoint.
        </p>

        <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const active = selectedTemplate === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`text-left rounded-2xl border p-5 transition-colors ${
                  active
                    ? "border-white/35 bg-white/[0.04]"
                    : "border-white/12 bg-white/[0.015] hover:border-white/22 hover:bg-white/[0.025]"
                }`}
              >
                <div className="font-display text-[18px] tracking-[-0.015em] text-white">
                  {t.title}
                </div>
                <p className="mt-1.5 text-[13px] text-white/65 leading-relaxed">{t.sub}</p>
                <div className="mt-4 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                  <span>{t.nodes} nodes</span>
                  <span>{t.runtime}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* What this becomes */}
      <section className="px-6 md:px-10 py-16 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.03] to-transparent p-7 md:p-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
            What the Builder becomes
          </div>
          <h2 className="font-display text-[32px] md:text-[40px] leading-tight tracking-[-0.025em] text-white">
            Same canvas. Cloud or hardware.
          </h2>
          <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-white/75 max-w-[920px]">
            Every workflow built here runs against the LSC pooled-compute backend today. When
            an on-prem Latent Stretcher Unit registers under the customer&apos;s tenant, the
            same workflows route through the LSU instead with no migration. When custom silicon
            ships, the workflows route through the ASIC. The customer experience is identical
            across compute backends.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/api-docs"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors px-5 py-2.5"
            >
              API docs
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/accelerator"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors px-5 py-2.5"
            >
              Accelerator architecture
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
