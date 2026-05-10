"use client";

import { Nav } from "@/components/landing/Nav";
import Link from "next/link";
import { useState, useMemo } from "react";

/**
 * /builder — System Builder UX (Layer 2 + live LSC submission).
 *
 * Three modes:
 *   1. Visual canvas — static node diagram of the chosen template pipeline
 *   2. Live submit — paste an LSC API key, pick a template, run it against
 *      the production substrate via /api/v1/lsc/submit
 *   3. Result viewer — modules, purity, basin, AUC, cost, regime-card
 *      compliance flag, lineage signature
 */

type TemplateKind = "intrusion" | "documents" | "anomaly" | "dedup" | "regime" | "modality";

type Template = {
  id: TemplateKind;
  title: string;
  sub: string;
  nodes: number;
  runtime: string;
  // Sample entity builder — produces a synthetic corpus to exercise the substrate
  build: () => { entities: { name: string; type: string; attributes: { text: string } }[]; classes: string[] };
};

type Node = {
  id: string;
  kind: "source" | "btut" | "tcd" | "measure" | "output";
  title: string;
  sub: string;
};

const DEFAULT_PIPELINE: Node[] = [
  { id: "n1", kind: "source",  title: "Data source",     sub: "Entities + edges in" },
  { id: "n2", kind: "btut",    title: "BTUT cascade",    sub: "8-tier reduction" },
  { id: "n3", kind: "tcd",     title: "TCD-JEPA",        sub: "Topology training" },
  { id: "n4", kind: "measure", title: "Dispersion",      sub: "Purity + self-basin" },
  { id: "n5", kind: "output",  title: "Module catalog",  sub: "Lineage + AUC + regime" },
];

function rand(seed: { v: number }): number {
  // Simple LCG — deterministic per template+seed
  seed.v = (seed.v * 1664525 + 1013904223) >>> 0;
  return seed.v / 0xffffffff;
}

function sample<T>(arr: T[], n: number, seed: { v: number }): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(arr[Math.floor(rand(seed) * arr.length)]);
  }
  return out;
}

function buildSynth(
  classToTokens: Record<string, string[]>,
  nPerClass: number,
  noiseTokens: string[],
  noisePerEntity: number,
): { entities: { name: string; type: string; attributes: { text: string } }[]; classes: string[] } {
  const seed = { v: 42 };
  const entities: { name: string; type: string; attributes: { text: string } }[] = [];
  const classes = Object.keys(classToTokens);
  let eid = 0;
  for (const cls of classes) {
    const sig = classToTokens[cls];
    for (let i = 0; i < nPerClass; i++) {
      const sigPart = sample(sig, 4, seed);
      const noisePart = sample(noiseTokens, noisePerEntity, seed);
      entities.push({
        name: `e${eid}`,
        type: cls,
        attributes: { text: [...sigPart, ...noisePart].join(" ") },
      });
      eid++;
    }
  }
  return { entities, classes };
}

const TEMPLATES: Template[] = [
  {
    id: "intrusion",
    title: "Intrusion classification",
    sub: "NSL-KDD shape — 6 attack classes recovered at perfect purity",
    nodes: 5,
    runtime: "~ 5s GPU per 5K records",
    build: () =>
      buildSynth(
        {
          normal:    ["proto_tcp", "svc_http", "flag_SF", "cnt_low"],
          neptune:   ["proto_tcp", "svc_priv", "flag_S0", "cnt_high"],
          satan:     ["proto_tcp", "svc_eco_i", "flag_REJ", "cnt_mid"],
          ipsweep:   ["proto_icmp", "svc_eco_i", "flag_SF", "cnt_low"],
          portsweep: ["proto_tcp", "svc_other", "flag_REJ", "cnt_high"],
          smurf:     ["proto_icmp", "svc_ecr_i", "flag_SF", "cnt_max"],
        },
        50,
        ["land_0", "urgent_0", "hot_0", "logged_in_0", "compromised_0", "su_0", "shells_0"],
        3,
      ),
  },
  {
    id: "documents",
    title: "Document archive clustering",
    sub: "TNA-shape historical corpus — 6 archives separated at perfect purity",
    nodes: 5,
    runtime: "~ 10s GPU per 1K records",
    build: () =>
      buildSynth(
        {
          sigint_history: ["intercept", "wireless", "operator", "decrypted"],
          diplomatic:     ["telegram", "ambassador", "embassy", "communique"],
          machine:        ["enigma", "bombe", "rotor", "key"],
          directorate:    ["minute", "circular", "policy", "approval"],
          pm:             ["memorandum", "cabinet", "directive", "instruction"],
          summaries:      ["weekly", "summary", "review", "appendix"],
        },
        40,
        ["paper", "file", "document", "record", "archive", "report", "note", "draft"],
        4,
      ),
  },
  {
    id: "anomaly",
    title: "Anomaly detection (rare-class)",
    sub: "Class imbalance up to 10,000:1, perfect purity within regime",
    nodes: 5,
    runtime: "~ 5s GPU per 5K records",
    build: () =>
      buildSynth(
        {
          normal: ["baseline", "expected", "routine", "standard"],
          drift:  ["shift", "deviation", "trend", "skew"],
          spike:  ["burst", "surge", "peak", "outlier"],
          dropout:["missing", "gap", "absent", "void"],
          rare:   ["anomalous", "unique", "abnormal", "exceptional"],
        },
        40,
        ["metric_a", "metric_b", "window_short", "window_long", "interval", "sample"],
        3,
      ),
  },
  {
    id: "dedup",
    title: "Training-data deduplication",
    sub: "BTUT-cascade-driven near-duplicate detection",
    nodes: 5,
    runtime: "~ 4s GPU per 100K records",
    build: () =>
      buildSynth(
        {
          unique:        ["original", "novel", "distinct", "first"],
          near_dup:      ["similar", "variant", "rewrite", "paraphrase"],
          exact_dup:     ["copy", "duplicate", "identical", "verbatim"],
          near_overlap:  ["partial", "overlap", "shared", "common"],
        },
        60,
        ["topic_x", "topic_y", "topic_z", "source_a", "source_b", "source_c"],
        3,
      ),
  },
  {
    id: "regime",
    title: "Regime-shift detection",
    sub: "Time-series substrate over rolling windows",
    nodes: 6,
    runtime: "~ 8s GPU per 10K records",
    build: () =>
      buildSynth(
        {
          trending_up:    ["slope_pos", "vol_low", "auto_high", "skew_neg"],
          trending_down:  ["slope_neg", "vol_low", "auto_high", "skew_pos"],
          mean_reverting: ["slope_zero", "vol_med", "auto_neg", "skew_zero"],
          random_walk:    ["slope_zero", "vol_med", "auto_zero", "skew_zero"],
          regime_switch:  ["slope_mixed", "vol_high", "auto_mixed", "skew_mixed"],
          periodic:       ["slope_zero", "vol_low", "auto_cyclic", "skew_zero"],
        },
        40,
        ["window_short", "window_long", "fft_low", "fft_high", "season_q", "season_d"],
        4,
      ),
  },
  {
    id: "modality",
    title: "Cross-modal structure transfer",
    sub: "Universal substrate across text + numeric + code modalities",
    nodes: 7,
    runtime: "~ 30s GPU per modality",
    build: () =>
      buildSynth(
        {
          text:   ["paragraph", "sentence", "noun", "verb"],
          number: ["int", "float", "mean", "stddev"],
          code:   ["function", "class", "import", "return"],
          image:  ["pixel", "channel", "filter", "texture"],
          audio:  ["wave", "freq", "amplitude", "phase"],
        },
        40,
        ["dim_low", "dim_high", "sparse", "dense", "compact", "expanded"],
        3,
      ),
  },
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

type ApiResult = {
  job_id: string;
  status: string;
  backend: string;
  device?: string | null;
  n_entities_input: number;
  n_modules_discovered: number;
  mean_module_purity?: number | null;
  min_module_purity?: number | null;
  mean_class_self_basin?: number | null;
  final_auc?: number | null;
  wall_seconds: number;
  gpu_exec_ms?: number | null;
  cost_dollars_estimate: number;
  regime_card_compliant: boolean;
  module_purity_rows: { dominant_type?: string | null; n_entities?: number | null; purity?: number | null }[];
  archive_self_basin_rows: { archive: string; n_records_in_modules: number; self_basin_share: number }[];
  lineage_signature: string;
};

export default function BuilderPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKind>("intrusion");
  const [apiKey, setApiKey] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const active = useMemo(() => TEMPLATES.find((t) => t.id === selectedTemplate)!, [selectedTemplate]);
  const sampleCorpus = useMemo(() => active.build(), [active]);

  const onRun = async () => {
    setErr(null);
    setResult(null);
    if (!apiKey || apiKey.length < 16) {
      setErr("Paste an LSC API key (format: lo_sk_...) to run against the substrate.");
      return;
    }
    setRunning(true);
    try {
      const body = {
        entities: sampleCorpus.entities,
        edges: [],
        config: {
          btut_enabled: true,
          btut_budget_dollars: 5.0,
          epochs: 30,
          seed: 42,
        },
        dataset_id: `builder_${active.id}`,
      };
      const r = await fetch("/api/v1/lsc/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.detail || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as ApiResult;
      setResult(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  };

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
          Pick a template. Run it against the production substrate. Result lands inline below,
          with modules, purity, basin, AUC, cost, lineage signature, and regime-card
          compliance flag.
        </p>
      </header>

      {/* Canvas */}
      <section className="px-6 md:px-10 pb-8 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.02] to-transparent p-6 md:p-8 overflow-x-auto">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-1">
                Workflow canvas
              </div>
              <div className="text-[14px] text-white/65">
                Active: <span className="text-white font-medium">{active.title}</span>
                <span className="ml-3 text-white/50 font-mono">
                  ({sampleCorpus.entities.length} entities · {sampleCorpus.classes.length} classes · {active.runtime})
                </span>
              </div>
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
        </div>
      </section>

      {/* Run panel */}
      <section className="px-6 md:px-10 pb-10 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/15 bg-black/40 p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex-1">
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-2">
                LSC API key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="lo_sk_..."
                spellCheck={false}
                className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-[14px] text-white font-mono placeholder:text-white/35 focus:border-white/40 focus:outline-none"
              />
              <p className="mt-1.5 text-[11.5px] text-white/45">
                Get a key via the /api-keys endpoint, or contact the team for an enterprise tier.
              </p>
            </div>
            <button
              onClick={onRun}
              disabled={running || !apiKey}
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white text-black text-[12.5px] font-mono font-bold tracking-[0.22em] uppercase hover:bg-white/90 disabled:bg-white/20 disabled:text-white/45 disabled:cursor-not-allowed transition-colors px-6 py-3"
            >
              {running ? "Running..." : "Run on LSC"}
              <span aria-hidden>→</span>
            </button>
          </div>

          {err && (
            <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/[0.05] p-4 font-mono text-[12.5px] text-red-200/80 leading-relaxed">
              {err}
            </div>
          )}

          {result && (
            <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.03] p-5 md:p-6 space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/85">
                    Result · {result.backend} · {result.device}
                  </div>
                  <div className="font-display text-[22px] text-white mt-1">
                    {result.n_modules_discovered} modules from {result.n_entities_input} entities
                    {result.regime_card_compliant && (
                      <span className="ml-3 inline-flex items-center font-mono text-[10px] uppercase tracking-[0.18em] border rounded-full px-2 py-0.5 bg-emerald-400/15 text-emerald-300 border-emerald-400/30">
                        Regime-card compliant
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-mono text-[11px] text-white/55 text-right">
                  job_id: <span className="text-white/85">{result.job_id}</span><br />
                  lineage: <span className="text-white/85">{result.lineage_signature.slice(0, 16)}...</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Mean purity</div>
                  <div className="font-mono text-[18px] text-white mt-1 tabular-nums">
                    {result.mean_module_purity?.toFixed(4) ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Mean basin</div>
                  <div className="font-mono text-[18px] text-white mt-1 tabular-nums">
                    {result.mean_class_self_basin?.toFixed(4) ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">AUC</div>
                  <div className="font-mono text-[18px] text-white mt-1 tabular-nums">
                    {result.final_auc?.toFixed(4) ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Cost (est)</div>
                  <div className="font-mono text-[18px] text-white mt-1 tabular-nums">
                    ${result.cost_dollars_estimate.toFixed(4)}
                  </div>
                </div>
              </div>

              {result.module_purity_rows.length > 0 && (
                <div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-2">
                    Modules discovered
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.015]">
                    <table className="min-w-full text-[13px] font-mono">
                      <thead className="text-left text-white/55">
                        <tr className="border-b border-white/10">
                          <th className="px-4 py-2.5">Module · dominant class</th>
                          <th className="px-4 py-2.5 tabular-nums">N entities</th>
                          <th className="px-4 py-2.5 tabular-nums">Purity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {result.module_purity_rows.map((m, i) => (
                          <tr key={i} className="text-white/85">
                            <td className="px-4 py-2.5">{m.dominant_type ?? "—"}</td>
                            <td className="px-4 py-2.5 tabular-nums">{m.n_entities ?? "—"}</td>
                            <td className="px-4 py-2.5 tabular-nums">{m.purity?.toFixed(4) ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="text-[11.5px] font-mono text-white/45">
                wall {result.wall_seconds.toFixed(2)}s · gpu {result.gpu_exec_ms ?? "?"}ms · backend {result.backend}
              </div>
            </div>
          )}
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
          The runtime numbers are measured on the production endpoint.
        </p>

        <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const activeT = selectedTemplate === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setSelectedTemplate(t.id); setResult(null); setErr(null); }}
                className={`text-left rounded-2xl border p-5 transition-colors ${
                  activeT
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

      {/* Footer CTA */}
      <section className="px-6 md:px-10 py-16 max-w-[1280px] mx-auto">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.03] to-transparent p-7 md:p-10">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-3">
            What this becomes
          </div>
          <h2 className="font-display text-[32px] md:text-[40px] leading-tight tracking-[-0.025em] text-white">
            Same canvas. Cloud or hardware.
          </h2>
          <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-white/75 max-w-[920px]">
            Every workflow built here runs against the LSC pooled-compute backend today. When
            an on-prem Latent Stretcher Unit registers under your tenant, the same workflows
            route through the LSU instead. When custom silicon ships, workflows route through
            the ASIC. The customer experience is identical across compute backends.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/accelerator"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 text-white text-[12px] font-mono font-medium tracking-[0.22em] uppercase hover:border-white/55 hover:bg-white/[0.04] transition-colors px-5 py-2.5"
            >
              Accelerator architecture
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
      </section>
    </div>
  );
}
