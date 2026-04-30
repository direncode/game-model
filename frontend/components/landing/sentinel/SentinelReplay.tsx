"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fadeUp, viewportOnce } from "@/lib/motion";

// Live, deterministic replay backed by /api/sentinel-replay. Buyer can:
//   1. watch the auto-advancing walkthrough,
//   2. paste any lineage hash and re-run,
//   3. verify the response_digest is byte-identical across runs.

type Replay = {
  lineage: string;
  seed: number;
  wall_ms: number;
  request: { issued_by: string; cmd: string; received_at: string };
  resolve: {
    merkle_hops: { level: number; hash: string; verified: boolean }[];
    ots: { block: number; anchor_hash: string; authority: string; verified: boolean };
  };
  rebuild: {
    host: string;
    ts: string;
    src: string;
    dst: string;
    service: string;
    bytes_out: number;
    bytes_in: number;
    sha256_raw: string;
    bytes_match: boolean;
    note: string;
  };
  prove: {
    seed: number;
    n_iterations: number;
    z_score: number;
    p_value: string;
    deterministic: boolean;
    dimensions: string[];
  };
  close: { evidence_package: string; signed_by: string; status: string };
  response_digest: string;
  determinism_contract: string;
};

const STEP_META = [
  { label: "REQUEST", title: "Analyst issues a replay", glow: "#00d4ff" },
  { label: "RESOLVE", title: "Lineage chain resolves", glow: "#3fb950" },
  { label: "REBUILD", title: "Inputs reconstructed bit-identically", glow: "#a371f7" },
  { label: "PROVE", title: "Null test confirms structural rarity", glow: "#d29922" },
  { label: "CLOSE", title: "Audit finding clears", glow: "#f85149" },
];

const STEP_BLURB = [
  "An IG auditor asks the SOC: 'show the bytes behind this detection.' The analyst pastes the lineage hash into Sentinel.",
  "Sentinel walks the Merkle chain: detection → fingerprint → ingest record → originating bytes. Every hop verified against an OpenTimeStamps anchor stored in the appliance.",
  "The original Zeek conn record + the upstream Sysmon event chain materializes. Same bytes that triggered the detection. Same hash on the way out.",
  "The same null-permutation that justified the original alert reruns under seed=42. Same z-score. Same p-value. Forever.",
  "Lineage proof, originating bytes, and null test export to a NIST 800-53 evidence package signed by the appliance key.",
];

function shorten(hash: string, head = 12, tail = 4) {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

function fmtCmd(step: number, r: Replay): string {
  if (step === 0) {
    return `sentinel> ${r.request.cmd}
issued by:    ${r.request.issued_by}
received_at:  ${r.request.received_at}`;
  }
  if (step === 1) {
    const hops = r.resolve.merkle_hops
      .map((h) => `  hop ${h.level}: ${h.hash}  ✓`)
      .join("\n");
    return `verifying merkle path …  ${r.resolve.merkle_hops.length} hops
${hops}
verifying ots anchor   …  block ${r.resolve.ots.block.toLocaleString()}  ✓
authority:               ${r.resolve.ots.authority}
anchor_hash:             ${r.resolve.ots.anchor_hash}`;
  }
  if (step === 2) {
    const b = r.rebuild;
    return `host:        ${b.host}
ts:          ${b.ts}
src→dst:     ${b.src} → ${b.dst}
service:     ${b.service}
bytes_out:   ${b.bytes_out.toLocaleString()}
bytes_in:    ${b.bytes_in.toLocaleString()}
sha256(raw): ${b.sha256_raw}…  ${b.bytes_match ? "✓ MATCHES" : "✗ MISMATCH"}
note:        ${b.note}`;
  }
  if (step === 3) {
    const p = r.prove;
    return `null_test(seed=${p.seed}, n=${p.n_iterations}, dims=${p.dimensions.join("+")})
  z-score:  ${p.z_score.toFixed(2)} σ
  p-value:  ${p.p_value}
  deterministic: ${p.deterministic ? "true" : "false"}
  result:   ${p.z_score > 4 ? "structurally significant" : "not significant"}`;
  }
  if (step === 4) {
    const c = r.close;
    return `evidence_package: ${c.evidence_package}
signed_by:        ${c.signed_by}
status:           ${c.status}  (${r.wall_ms} ms wall)
response_digest:  sha256:${r.response_digest}`;
  }
  return "";
}

export function SentinelReplay() {
  const [active, setActive] = useState(0);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lineageInput, setLineageInput] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [copied, setCopied] = useState(false);
  const lastCommittedLineage = useRef("");

  const fetchReplay = useCallback(async (lineage?: string) => {
    setLoading(true);
    setErr(null);
    const qs = lineage && lineage.trim() ? `?lineage=${encodeURIComponent(lineage.trim())}` : "";
    try {
      const r = await fetch(`/api/sentinel-replay${qs}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as Replay;
      setReplay(data);
      lastCommittedLineage.current = data.lineage;
      setActive(0);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReplay();
  }, [fetchReplay]);

  // Auto-advance only when we have data and the user hasn't disabled it.
  useEffect(() => {
    if (!replay || !autoAdvance) return;
    const t = setInterval(() => {
      setActive((a) => (a + 1) % STEP_META.length);
    }, 4200);
    return () => clearInterval(t);
  }, [replay, autoAdvance]);

  const cmdText = useMemo(() => (replay ? fmtCmd(active, replay) : ""), [active, replay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAutoAdvance(false);
    fetchReplay(lineageInput);
  };

  const handleVerify = async () => {
    if (!replay) return;
    setAutoAdvance(false);
    await fetchReplay(replay.lineage);
  };

  const handleCopy = async () => {
    if (!replay) return;
    try {
      await navigator.clipboard.writeText(replay.response_digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable; ignore
    }
  };

  return (
    <section className="relative py-32 border-t border-white/5">
      <div className="max-w-[1280px] mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeUp}>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
            Replay · live · deterministic
          </p>
          <h2 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95] mb-6 max-w-4xl">
            From hash<br />
            <span className="text-white/40">back to bytes.</span>
          </h2>
          <p className="text-lg text-white/60 max-w-3xl">
            This walkthrough is computed on demand by{" "}
            <code className="font-mono text-li-cyan">/api/sentinel-replay</code>{" "}
            from{" "}
            <span className="text-white/80">sha256(lineage ∥ seed=42)</span>.
            Paste any lineage hash; the response is byte-identical across
            reruns. Verify the digest below.
          </p>
        </motion.div>

        {/* Lineage controller */}
        <motion.form
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
          onSubmit={handleSubmit}
          className="mt-10 rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-li-cyan animate-pulse" />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-li-cyan">
              Lineage controller
            </span>
            <span className="font-mono text-[11px] text-white/30 ml-auto">
              GET /api/sentinel-replay
            </span>
          </div>
          <div className="p-5 flex flex-col md:flex-row gap-3 md:items-center">
            <label className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40 md:shrink-0">
              Lineage hash
            </label>
            <input
              value={lineageInput}
              onChange={(e) => setLineageInput(e.target.value)}
              placeholder={replay?.lineage ?? "7b1df0e4cb37…f04a (default)"}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              data-replay-input="true"
              className="flex-1 min-w-0 font-mono text-[12px] text-white/85 bg-black/60 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-li-cyan/60 placeholder:text-white/25"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center h-9 px-4 rounded-full bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors"
              >
                Replay
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={!replay}
                className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-white/15 text-white/80 text-xs hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
              >
                Verify (re-run)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLineageInput("");
                  setAutoAdvance(true);
                  fetchReplay();
                }}
                className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-white/10 text-white/60 text-xs hover:text-white hover:border-white/25 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </motion.form>

        {/* Loading / error */}
        {loading && !replay && (
          <div className="mt-6 rounded-xl border border-li-cyan/25 bg-li-cyan/[0.03] p-6 flex items-center gap-4">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-white/10" />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-li-cyan animate-spin"
                style={{ animationDuration: "1.1s" }}
              />
            </div>
            <span className="font-mono text-sm text-white/70">
              computing replay …
            </span>
          </div>
        )}

        {err && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-5 font-mono text-sm text-red-200">
            replay endpoint error: {err}
          </div>
        )}

        {/* Walkthrough */}
        {replay && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {STEP_META.map((s, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={s.label}
                    onClick={() => {
                      setAutoAdvance(false);
                      setActive(i);
                    }}
                    className={`shrink-0 lg:w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      isActive
                        ? "border-white/30 bg-white/[0.04]"
                        : "border-white/10 bg-[#0a0a10] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: s.glow,
                          boxShadow: isActive ? `0 0 10px ${s.glow}` : "none",
                        }}
                      />
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.2em]"
                        style={{ color: s.glow }}
                      >
                        {s.label}
                      </span>
                    </div>
                    <div className="text-sm text-white/85 leading-tight">
                      {s.title}
                    </div>
                  </button>
                );
              })}
            </div>

            <motion.div
              key={`${replay.response_digest}-${active}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-white/10 bg-[#0a0a10] overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: STEP_META[active].glow,
                      boxShadow: `0 0 10px ${STEP_META[active].glow}`,
                    }}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
                    Step {active + 1} / {STEP_META.length} · {STEP_META[active].label}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-white/30">
                  replay engine · L4 · {replay.wall_ms} ms
                </span>
              </div>
              <div className="p-7">
                <div className="font-display text-2xl md:text-3xl text-white tracking-tight mb-3">
                  {STEP_META[active].title}
                </div>
                <p className="text-sm text-white/65 leading-relaxed mb-6 max-w-2xl">
                  {STEP_BLURB[active]}
                </p>
                <pre className="rounded-xl border border-white/10 bg-black/60 p-5 text-[12.5px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{cmdText}
                </pre>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full transition-all duration-700 ease-out"
                      style={{
                        width: `${((active + 1) / STEP_META.length) * 100}%`,
                        backgroundColor: STEP_META[active].glow,
                        boxShadow: `0 0 10px ${STEP_META[active].glow}`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-white/40 tabular-nums">
                    {String(active + 1).padStart(2, "0")} /{" "}
                    {String(STEP_META.length).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Determinism receipt */}
        {replay && (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={fadeUp}
            className="mt-8 rounded-2xl border border-li-green/25 bg-li-green/[0.03] p-6 flex flex-col md:flex-row md:items-center gap-4"
          >
            <div className="flex items-center gap-2 md:shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-li-green animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-li-green">
                Determinism receipt
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11px] text-white/40 mb-1">
                lineage:{" "}
                <span className="text-white/80">{shorten(replay.lineage, 16, 8)}</span>
                {"  ·  seed: "}
                <span className="text-white/80">{replay.seed}</span>
              </div>
              <div className="font-mono text-xs text-white/85 truncate">
                response_digest =&nbsp;
                <span className="text-li-green">sha256:{replay.response_digest}</span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-white/40">
                {replay.determinism_contract}
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-white/15 text-white/80 text-xs font-mono hover:text-white hover:border-white/30 transition-colors md:shrink-0"
            >
              {copied ? "copied ✓" : "copy digest"}
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
