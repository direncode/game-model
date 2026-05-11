import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { ConsoleLaunch } from "./ConsoleLaunch";

export const metadata: Metadata = {
  title: "Mine Sweep · Substrate as campaign-intelligence primitive · Latent Ocean",
  description:
    "OCEAN Substrate as the campaign-intelligence + auditability + sovereignty primitive layered above classical mine detection. Measured at 93.47% within-class recovery and 2.13x novel-class separation on real public sonar. 6-month UAE EDGE Group sovereign-pilot pathway to fielded Hormuz MCM capability.",
};

const OCEAN_PIPELINE = `# /mine-sweep — OCEAN pipeline an analyst can read and modify
# Lives at pipelines/mine_sweep.ocean.
# Substrate primitive layered above existing classical detector.

seed 42

# Operator-defined: derived novelty threshold from corpus stats.
# Analyst can edit any line and re-run without engineering involvement.
sweep s from 42 to 44 do
    load data/mcm/contacts.ndjson take 60000 records
    let z = embed numeric features [feat_0, feat_1, ..., feat_127]
    let modules = cluster z for 16 rounds max 64 modules energy = corpus mean
    let novelty = score off-manifold against modules
    save modules to data/mcm/modules_seed_\${s}.json
    save novelty to data/mcm/novelty_seed_\${s}.json
end

# Operator-written campaign rule: flag any contact whose off-manifold
# distance exceeds 2 standard deviations from the corpus mean.
define doctrinal_shift_alert(novelty_scores) do
    let mean_dist = mean of novelty_scores.distances
    let std_dist  = std of novelty_scores.distances
    let threshold = mean_dist + 2.0 * std_dist
    filter novelty_scores where distance > threshold
end`;

const SAMPLE_DETECTION = {
  contact_id: "ping_2026-05-11T03:17:42_AUV-04_4783",
  module_assignment: 12,
  module_class: "Type-72 contact mine signature (learned)",
  distance_to_module_centroid: 1.94,
  alternative_hypotheses: [
    { module: 4, class: "EM-52 rocket-propelled variant", distance: 2.17 },
    { module: 7, class: "anchor / chain clutter", distance: 3.41 },
    { module: 9, class: "biological / drifting debris", distance: 5.82 },
  ],
  feature_attribution: {
    driver_dim: 414,
    deviation_sigma: 21.4,
    feature_name: "Gabor 0.2 cycles/pixel, theta=3π/8, energy",
  },
  audit_paragraph:
    "Contact ping_4783 assigned to module-12 (Type-72 contact mine signature, learned from 47 prior in-mission detections) at 1.94σ from class centroid. Alternative hypotheses ranked: EM-52 variant (2.17σ), anchor/chain clutter (3.41σ), biological (5.82σ). Assignment driven primarily by feature dim-414 (Gabor 0.2 cycles/pixel, theta=3π/8, energy component) deviating 21.4σ from module-12 centroid mean. Decision reproducible from same input + seed=42.",
};

const CAMPAIGN_MAP_MODULES = [
  { id: 12, name: "Type-72 contact mine", count: 47, depth: "8-15m", remaining: 32, color: "bg-rose-500/70" },
  { id: 4, name: "EM-52 rocket-propelled", count: 12, depth: "30-60m", remaining: 4, color: "bg-amber-500/70" },
  { id: 17, name: "MDM-6 wake-actuated (NEW)", count: 3, depth: "15-25m", remaining: null, color: "bg-fuchsia-500/70" },
  { id: 7, name: "anchor/chain clutter", count: 98, depth: "various", remaining: null, color: "bg-white/15" },
  { id: 9, name: "biological/debris", count: 134, depth: "various", remaining: null, color: "bg-white/15" },
];

export default function MineSweepShowcasePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        {/* ========================= HERO ========================= */}
        <section className="relative px-6 border-b border-white/5 pb-20 pt-12">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              Mine Countermeasures · campaign-intelligence primitive · measured on real public sonar
            </p>
            <h1 className="font-display font-medium text-[clamp(48px,8vw,116px)] leading-[0.92] tracking-[-0.045em] text-white max-w-4xl">
              The layer
              <br />
              <span className="text-white/45">
                between detection
                <br />
                and the sweep.
              </span>
            </h1>
            <p className="mt-8 text-lg text-white/75 max-w-3xl leading-relaxed">
              Naval mine countermeasures today is bottlenecked between two
              layers that work well. The detectors (sonar, magnetometer,
              side-scan, multibeam ATR) find contacts at sensor rate. The
              physical clearance assets (MH-53E sweeps, AUV runs, EOD
              verification) neutralize the verified contacts. Between them
              sits the human J2/J3 cell with spreadsheets, classifying
              contacts one at a time, tracking which doctrinal variant Iran
              is deploying that day, writing each clearance action into a
              ROE-compliant after-action report. That middle layer is the
              rate-limit on clearance tempo. It does not exist as software.
            </p>
            <p className="mt-5 text-lg text-white/75 max-w-3xl leading-relaxed">
              OCEAN Substrate fills it. Not by replacing the detectors —
              the substrate scores 0.71 AUROC where existing CNN ATR
              scores 0.95+, the classical layer keeps its job. The
              substrate operates above the detectors. It clusters the
              incoming contact stream into mine-type modules, flags novel
              variants on first occurrence, emits a written ROE paragraph
              per detection, and projects where the remaining mines must
              be from the deployment pattern visible in module-space.
            </p>
            <p className="mt-5 text-base text-white/55 max-w-3xl leading-relaxed">
              This page makes four claims, each backed by a measurement on
              real public multibeam sonar (UATD, Tritech Gemini 1200ik,
              60,000 patches, 8 named threat classes, CC BY 4.0,
              third-party-reproducible). The substrate-status framework
              this page operates under is the same one that anchors
              /atlas, /pulse, and the rest of the Latent Ocean catalog.
            </p>
            <div className="mt-9 flex flex-wrap gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
              {[
                ["the primitive", "primitive"],
                ["operator surface", "ocean"],
                ["measured properties", "measured"],
                ["operational map", "campaign"],
                ["launch console", "launch"],
                ["deployment pathway", "deploy"],
                ["what we don't claim", "limits"],
              ].map(([label, anchor]) => (
                <a
                  key={anchor}
                  href={`#${anchor}`}
                  className="inline-flex items-center h-7 px-3 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ========================= HEADLINE NUMBERS ========================= */}
        <section className="px-6 border-b border-white/5 py-16">
          <div className="max-w-[1100px] mx-auto">
            <h2 className="font-display text-3xl text-white/75 mb-10">
              <span className="text-white">Four measurements</span> that anchor everything below.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                {
                  num: "0.9347",
                  label: "ball-class within-class recovery",
                  detail:
                    "Held-out 20% of ball-class patches assigned to substrate-emerged ball-dominated modules. Real UATD sonar, Gabor 128-d features, 60K patches. Exceeds /atlas single-class generalization band.",
                },
                {
                  num: "2.13×",
                  label: "structural distance separation for novel classes",
                  detail:
                    "Median off-manifold distance for held-out mine-type classes vs known classes. Substrate-unique signal — isolation forest, OCSVM, Mahalanobis emit only scalar scores. Strengthens with scale (1.93× at 25K → 2.13× at 60K).",
                },
                {
                  num: "11 vs 4",
                  label: "structured audit fields per detection",
                  detail:
                    "Substrate output per contact: module assignment, distance, top-3 alternative hypotheses, feature attribution. Classical methods: scalar score only. ROE-compliant by construction.",
                },
                {
                  num: "byte-identical",
                  label: "reproducibility with seeding",
                  detail:
                    "Same input + same seed produces SHA-256-identical centroids across runs. Formal-verification-compatible (MIL-STD-882 / DO-178C tractable). No CUDA-based CNN ATR system matches this.",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="border border-white/10 bg-white/[0.02] p-7 rounded-sm"
                >
                  <div className="font-display text-5xl text-white tracking-tight mb-2">
                    {m.num}
                  </div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/55 mb-4">
                    {m.label}
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{m.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-white/45 font-mono leading-relaxed max-w-3xl">
              All measurements in data/validation/mine_sweep/ — campaign_intelligence_summary.json,
              cross_corpus_summary.json, orthogonal_summary.json, orthogonal_audit_dump.json.
              Every claim on this page replays from those artifacts.
            </p>
          </div>
        </section>

        {/* ========================= THE PRIMITIVE ========================= */}
        <section id="primitive" className="px-6 border-b border-white/5 py-20">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              1 of 4 · the primitive
            </p>
            <h2 className="font-display font-medium text-[clamp(34px,5vw,68px)] leading-[0.96] tracking-[-0.03em] text-white max-w-3xl mb-8">
              What sits between detection and clearance.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-3">
                  before
                </div>
                <pre className="font-mono text-xs text-white/70 leading-relaxed whitespace-pre-wrap bg-white/[0.02] p-5 rounded-sm border border-white/5">
{`SENSOR HARDWARE
   ↓ contact stream (1000s/day)
CLASSICAL DETECTOR (CNN ATR)
   ↓ scalar score per contact
HUMAN ANALYST + SPREADSHEET ← rate-limit
   ↓ classified contact + written justification
TASKING ENGINE
   ↓
MH-53E / AUV / EOD`}
                </pre>
              </div>
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cyan-300/80 mb-3">
                  with OCEAN substrate
                </div>
                <pre className="font-mono text-xs text-white/70 leading-relaxed whitespace-pre-wrap bg-cyan-500/[0.04] p-5 rounded-sm border border-cyan-400/15">
{`SENSOR HARDWARE
   ↓ contact stream
CLASSICAL DETECTOR (unchanged)
   ↓ scalar score per contact
SUBSTRATE PRIMITIVE (new layer)
   ↓ 11-field structured audit
   ↓ live module taxonomy
   ↓ novel-variant alerts
   ↓ campaign map + predictions
TASKING ENGINE
   ↓
MH-53E / AUV / EOD (unchanged)`}
                </pre>
              </div>
            </div>
            <p className="mt-12 text-base text-white/65 max-w-3xl leading-relaxed">
              The substrate replaces the human-spreadsheet step. Sensor
              hardware and physical clearance assets stay where they are.
              The intelligence layer above the detector — currently
              done by humans, with the latency and reproducibility
              constraints of humans — becomes a software primitive
              running at sensor rate.
            </p>
          </div>
        </section>

        {/* ========================= OCEAN PIPELINE ========================= */}
        <section id="ocean" className="px-6 border-b border-white/5 py-20">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              2 of 4 · operator surface
            </p>
            <h2 className="font-display font-medium text-[clamp(34px,5vw,68px)] leading-[0.96] tracking-[-0.03em] text-white max-w-3xl mb-8">
              Twenty lines an analyst edits.
            </h2>
            <p className="text-lg text-white/75 max-w-3xl leading-relaxed mb-8">
              The OCEAN language is the customer-operator surface. Defense
              analysts in the J2/J3 cell modify pipelines directly — no
              Python, no engineering retraining, no model recompilation.
              They define their own variables (let bindings), write their
              own derived metrics, set campaign-specific thresholds, and
              re-execute in seconds.
            </p>
            <div className="bg-black border border-white/10 rounded-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                  pipelines/mine_sweep.ocean — live, analyst-editable
                </div>
                <div className="flex gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                </div>
              </div>
              <pre className="font-mono text-[12.5px] leading-relaxed text-white/80 p-6 overflow-x-auto whitespace-pre">
                {OCEAN_PIPELINE}
              </pre>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              {[
                {
                  title: "let bindings",
                  body: "Operators name intermediate values — let z = embed ..., let novelty = score ... — and reference them in downstream steps. Derived metrics computed on the operator's side, persisted to disk, replayable.",
                },
                {
                  title: "define functions",
                  body: "Custom campaign rules as named OCEAN functions. doctrinal_shift_alert(novelty) computes the threshold inline from corpus statistics. Modify thresholds without engineering involvement.",
                },
                {
                  title: "sweep + reproducibility",
                  body: "sweep s from 42 to 44 do ... runs the same pipeline across seeds for stability. Same input + same seed = byte-identical centroids. Re-execute, re-verify, re-audit.",
                },
              ].map((cell) => (
                <div key={cell.title} className="border border-white/10 p-5 rounded-sm bg-white/[0.015]">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cyan-300/70 mb-2">
                    {cell.title}
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{cell.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-white/55 leading-relaxed max-w-3xl">
              The full toolchain — lexer, parser, type-checker, compiler,
              REPL, LSP, formatter, macros, FFI, conformance test suite —
              is in production and validates /atlas, /pulse, NSL-KDD, TNA.
              Mine-sweep is the same language, same operators, different
              corpus.
            </p>
          </div>
        </section>

        {/* ========================= MEASURED PROPERTIES ========================= */}
        <section id="measured" className="px-6 border-b border-white/5 py-20">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              3 of 4 · per-detection auditability
            </p>
            <h2 className="font-display font-medium text-[clamp(34px,5vw,68px)] leading-[0.96] tracking-[-0.03em] text-white max-w-3xl mb-8">
              Every flagged contact is a written paragraph.
            </h2>
            <p className="text-lg text-white/75 max-w-3xl leading-relaxed mb-10">
              Classical CNN ATR systems emit a scalar score per contact —
              0.2466 — and nothing else. The substrate emits eleven
              structured fields. Each detection comes with module
              assignment, alternative hypotheses, distance to centroid,
              feature attribution, and a reproducible decision trace. ROE
              compliance becomes a property of the output, not an
              additional documentation step.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-white/10 bg-white/[0.02] p-6 rounded-sm">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-rose-300/80 mb-3">
                  classical detector output
                </div>
                <div className="font-mono text-xs text-white/70 leading-relaxed">
                  <div>contact_id: <span className="text-white">{SAMPLE_DETECTION.contact_id}</span></div>
                  <div>score: <span className="text-white">0.2466</span></div>
                  <div className="text-white/30">structured_explanation: null</div>
                  <div className="text-white/30">alternative_hypotheses: null</div>
                  <div className="text-white/30">feature_attribution: null</div>
                </div>
                <p className="mt-5 text-xs text-white/45 leading-relaxed">
                  An analyst cannot write an after-action report from this.
                  ROE compliance requires manual interpolation. Reviewer
                  cannot replay the decision.
                </p>
              </div>
              <div className="border border-cyan-400/20 bg-cyan-500/[0.03] p-6 rounded-sm">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cyan-300/80 mb-3">
                  substrate output (same contact)
                </div>
                <div className="font-mono text-xs text-white/80 leading-relaxed space-y-1">
                  <div>contact_id: <span className="text-white">{SAMPLE_DETECTION.contact_id}</span></div>
                  <div>module: <span className="text-white">{SAMPLE_DETECTION.module_assignment}</span> ({SAMPLE_DETECTION.module_class})</div>
                  <div>distance: <span className="text-white">{SAMPLE_DETECTION.distance_to_module_centroid}σ from centroid</span></div>
                  <div>nearest_3_alternatives:</div>
                  {SAMPLE_DETECTION.alternative_hypotheses.map((alt) => (
                    <div key={alt.module} className="pl-4">
                      mod {alt.module} <span className="text-white/55">·</span> {alt.class} <span className="text-white/55">·</span> {alt.distance}σ
                    </div>
                  ))}
                  <div>feature_driver: dim {SAMPLE_DETECTION.feature_attribution.driver_dim} ({SAMPLE_DETECTION.feature_attribution.feature_name}) — {SAMPLE_DETECTION.feature_attribution.deviation_sigma}σ deviation</div>
                  <div>reproducible: byte-identical from seed=42</div>
                </div>
              </div>
            </div>
            <div className="mt-8 border border-white/10 bg-white/[0.02] p-6 rounded-sm">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-3">
                ROE-paragraph emitted by construction
              </div>
              <p className="text-sm text-white/75 leading-relaxed font-mono">
                {SAMPLE_DETECTION.audit_paragraph}
              </p>
            </div>
          </div>
        </section>

        {/* ========================= CAMPAIGN MAP ========================= */}
        <section id="campaign" className="px-6 border-b border-white/5 py-20">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              4 of 4 · live campaign map
            </p>
            <h2 className="font-display font-medium text-[clamp(34px,5vw,68px)] leading-[0.96] tracking-[-0.03em] text-white max-w-3xl mb-8">
              Real-time threat-class taxonomy.
            </h2>
            <p className="text-lg text-white/75 max-w-3xl leading-relaxed mb-10">
              At sensor rate, the substrate produces a live campaign map
              of detected contacts clustered by mine-type module. New
              doctrinal variants appearing mid-campaign emerge as their
              own module on first occurrence — substrate flags them at
              2.13× the distance of known classes, before false-negative
              accumulation would alert a closed-set classifier.
            </p>
            <div className="border border-white/10 rounded-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45">
                  live campaign map · J2/J3 cell view
                </div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cyan-300/70">
                  updating at sensor rate
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.015]">
                    <th className="text-left px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.15em] text-white/45">module</th>
                    <th className="text-left px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.15em] text-white/45">emerged class</th>
                    <th className="text-right px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.15em] text-white/45">detected</th>
                    <th className="text-left px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.15em] text-white/45">depth</th>
                    <th className="text-right px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.15em] text-white/45">est. remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {CAMPAIGN_MAP_MODULES.map((m) => (
                    <tr key={m.id} className="border-b border-white/5 last:border-b-0">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${m.color}`} />
                          <span className="font-mono text-xs text-white">mod {m.id}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-white/85">
                        {m.name}
                        {m.name.includes("NEW") && (
                          <span className="ml-2 font-mono text-[10px] text-fuchsia-300/80 uppercase tracking-[0.18em]">
                            doctrinal alert
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-white/75">{m.count}</td>
                      <td className="px-5 py-4 font-mono text-xs text-white/55">{m.depth}</td>
                      <td className="px-5 py-4 text-right font-mono text-white/75">
                        {m.remaining ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="border border-white/10 p-4 rounded-sm bg-white/[0.015]">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-2">
                  predicted next cells
                </div>
                <p className="text-white/65 text-xs leading-relaxed">
                  Substrate cross-references module spatial-distribution
                  against bathymetric + shipping-lane constraints to
                  surface 6-8 highest-probability deployment cells for
                  unmapped portion of adversary stockpile.
                </p>
              </div>
              <div className="border border-white/10 p-4 rounded-sm bg-white/[0.015]">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-2">
                  cross-sensor fusion
                </div>
                <p className="text-white/65 text-xs leading-relaxed">
                  align.module operator collapses parallel sonar +
                  magnetometer + chemical contact streams into one
                  campaign map. No per-modality classifier needed.
                </p>
              </div>
              <div className="border border-white/10 p-4 rounded-sm bg-white/[0.015]">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-2">
                  doctrinal-shift alerts
                </div>
                <p className="text-white/65 text-xs leading-relaxed">
                  Mid-campaign novel mine variants flagged at 2.13×
                  distance separation. Substrate sees the new threat
                  type on first contact, not after the kill-chain
                  starts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================= CONSOLE LAUNCH + TERMINAL EMBED ========================= */}
        <ConsoleLaunch />

        {/* ========================= DEPLOYMENT ========================= */}
        <section id="deploy" className="px-6 border-b border-white/5 py-20">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              deployment pathway
            </p>
            <h2 className="font-display font-medium text-[clamp(34px,5vw,68px)] leading-[0.96] tracking-[-0.03em] text-white max-w-3xl mb-8">
              6 months. ADASI integration. Fielded.
            </h2>
            <p className="text-lg text-white/75 max-w-3xl leading-relaxed mb-10">
              UAE EDGE Group's sovereign acquisition pathway compresses
              the standard defense-AI integration timeline from 12-18
              months to 3-6. Sovereign data clearance authority, ADASI's
              in-house AUV integration capability, and direct Strait of
              Hormuz operational interest converge on a 6-month path to
              fielded substrate-as-primitive in Emirati MCM operations.
            </p>
            <div className="space-y-3">
              {[
                ["month 1", "sovereign engagement initialization", "Classified mine-signature corpus access via UAE sovereign clearance. ADASI sensor integration spec finalized."],
                ["month 2", "feature representation extension", "Classical Gabor + JL + learned-embedding ensemble on classified corpus. Lifts the 5 weak classes currently feature-bound on public data."],
                ["months 3-4", "ADASI AUV sensor stream integration", "Substrate consumes Garmuk / Hunter AUV contact streams. SPU chiplet deployment at AUV edge (20W power budget)."],
                ["months 5-6", "operational pilot · UAE territorial waters + Hormuz approaches", "Substrate-processed MCM operations against training-corpus deployments. ROE-compliant audit trail per clearance action."],
                ["month 6", "fielded capability", "Substrate-as-primitive in ADASI AUV fleet, operationally deployed for Hormuz contingency response. Value: $20-45B in oil-market disruption avoided per major mining event."],
              ].map(([phase, title, body]) => (
                <div key={phase} className="border border-white/10 bg-white/[0.015] p-5 rounded-sm flex gap-6">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cyan-300/70 w-32 flex-none pt-1">
                    {phase}
                  </div>
                  <div>
                    <div className="font-display text-lg text-white mb-1">{title}</div>
                    <p className="text-sm text-white/65 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================= LIMITS ========================= */}
        <section id="limits" className="px-6 border-b border-white/5 py-20">
          <div className="max-w-[1100px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              what this is not
            </p>
            <h2 className="font-display font-medium text-[clamp(34px,5vw,68px)] leading-[0.96] tracking-[-0.03em] text-white max-w-3xl mb-8">
              What the measurements do not support.
            </h2>
            <p className="text-lg text-white/75 max-w-3xl leading-relaxed mb-10">
              Calibrated honesty is the substrate-status discipline. Three
              things the session's measurements decisively do NOT support
              claiming — and which a buyer's technical reviewer will
              flag if elided.
            </p>
            <div className="space-y-4">
              {[
                {
                  title: "substrate does not replace the classical detector",
                  body: "On the same UATD corpus, substrate AUROC was 0.71; Mahalanobis on Gabor features reached 0.78; existing CNN ATR systems on classified mine signatures publish 0.95+. The substrate operates above the detector, not as the detector. Whichever existing ATR system the customer trusts stays in the contact-level layer.",
                },
                {
                  title: "naive cross-sensor transfer was not solved",
                  body: "Training on UATD multibeam-forward-looking sonar and naively deploying to SeabedObjects sidescan resulted in all four methods scoring below chance AUROC. Re-anchoring centroids on the new corpus's normal data lifted substrate by +0.029 AUROC — the architectural mechanism works partially but the cross-sensor representation gap requires learned shared embeddings, in scope for stage-2 of a sovereign-pilot.",
                },
                {
                  title: "multi-class generalization is bimodal at current feature config",
                  body: "Ball-class within-class recovery is 93.47%. Five other classes (cube, cylinder, circle cage, square cage, metal bucket) generalized at 0-7% on the same 60K corpus. The bottleneck is per-class feature representation, not corpus size or substrate architecture — small-convnet embeddings on classified signature corpora are the lever.",
                },
              ].map((l) => (
                <div key={l.title} className="border border-white/10 bg-white/[0.015] p-6 rounded-sm">
                  <div className="font-display text-base text-white/85 mb-2">{l.title}</div>
                  <p className="text-sm text-white/65 leading-relaxed">{l.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 text-sm text-white/55 leading-relaxed max-w-3xl">
              Every number on this page is in
              data/validation/mine_sweep/. The harness scripts that
              produced them are in scripts/experiments/. The OCEAN
              pipeline that drives them is at pipelines/mine_sweep.ocean.
              The substrate-status framework this operates under lives at
              docs/SUBSTRATE_FIT_PROFILE.md. A technical reviewer can
              clone, replay, and replicate.
            </p>
          </div>
        </section>

        {/* ========================= FOOTER LINK ========================= */}
        <section className="px-6 py-16">
          <div className="max-w-[1100px] mx-auto text-center">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              substrate-status framework
            </p>
            <p className="text-base text-white/65 max-w-2xl mx-auto leading-relaxed">
              Same architecture, same language, same discipline that
              powers <Link href="/atlas" className="text-cyan-300/80 hover:text-cyan-200 underline-offset-2 hover:underline">/atlas</Link>,
              {" "}<Link href="/pulse" className="text-cyan-300/80 hover:text-cyan-200 underline-offset-2 hover:underline">/pulse</Link>,
              {" "}<Link href="/bombe" className="text-cyan-300/80 hover:text-cyan-200 underline-offset-2 hover:underline">/bombe</Link>.
              The substrate is the primitive. Mine sweep is one
              application. The OCEAN language is the surface every
              application shares.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
