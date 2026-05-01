"use client";

import { useCallback, useState } from "react";

// MultiTenantSplitWidget
//
// Mints two short-lived demo tokens (POST /api/range-demo-token), one for
// "tenant α", one for "tenant β". Fires both formations *concurrently*
// against /api/range-form using each tenant's own bearer token. The two
// formations land in two distinct tenant directories with two distinct
// artifact IDs and two distinct response digests.
//
// To prove isolation: after both complete, we GET each tenant's artifact
// using THE OTHER tenant's bearer token. The route's getModel(id, tenant_id)
// returns null when the tenant doesn't own the model, and the route
// surfaces it as a 404. This 404 is the proof.

type DemoToken = { token: string; tenant_id: string; user_id: string; exp: string };
type FormResponse = { id: string; name: string; corpus_records: number; fingerprinter_mode: string; coverage_pct?: number; formation_ms?: number; response_digest?: string };

type Side = {
  color: "alpha" | "beta";
  label: string;
  status: "idle" | "issuing" | "forming" | "verifying" | "done" | "failed";
  token: DemoToken | null;
  model: FormResponse | null;
  cross_check: { status: number; ok: boolean; bodyHint: string } | null;
  error: string | null;
};

const COLORS = {
  alpha: { name: "tenant α", accent: "rgb(125, 211, 252)" }, // cyan-300
  beta:  { name: "tenant β", accent: "rgb(196, 181, 253)" }, // violet-300
};

function buildCorpus(seed: string): string {
  // Two distinct generic corpora — different content per tenant
  const rand = mulberry32(stringToSeed(seed));
  const rows: string[] = [];
  for (let i = 0; i < 200; i++) {
    rows.push(JSON.stringify({
      id: i,
      key: seed + "_" + i.toString(36),
      a: Math.floor(rand() * 1000),
      b: Math.floor(rand() * 100),
      c: ["x", "y", "z", "w"][Math.floor(rand() * 4)],
    }));
  }
  return rows.join("\n");
}

function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(s: string): number {
  let h = 0xcafebabe;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

type Props = { compact?: boolean };

export function MultiTenantSplitWidget({ compact = false }: Props) {
  const [alpha, setAlpha] = useState<Side>({ color: "alpha", label: COLORS.alpha.name, status: "idle", token: null, model: null, cross_check: null, error: null });
  const [beta,  setBeta]  = useState<Side>({ color: "beta",  label: COLORS.beta.name,  status: "idle", token: null, model: null, cross_check: null, error: null });
  const [crossProof, setCrossProof] = useState<{ alphaTryingBeta: number | null; betaTryingAlpha: number | null }>({ alphaTryingBeta: null, betaTryingAlpha: null });
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  const runOne = useCallback(async (color: "alpha" | "beta", setter: (s: Side) => void): Promise<{ token: DemoToken; model: FormResponse } | null> => {
    setter({ color, label: COLORS[color].name, status: "issuing", token: null, model: null, cross_check: null, error: null });
    try {
      // 1. Mint a demo token for this tenant
      const tokRes = await fetch("/api/range-demo-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (!tokRes.ok) throw new Error(`token status ${tokRes.status}`);
      const token = (await tokRes.json()) as DemoToken;

      setter({ color, label: COLORS[color].name, status: "forming", token, model: null, cross_check: null, error: null });

      // 2. Form against this tenant
      const formRes = await fetch("/api/range-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token.token}`,
        },
        body: JSON.stringify({
          name: `${color}-corpus-${Date.now().toString(36)}`,
          corpus_text: buildCorpus(color),
          corpus_filename_hint: "demo.ndjson",
        }),
      });
      if (!formRes.ok) {
        const j = await formRes.json().catch(() => ({} as Record<string, unknown>));
        throw new Error(typeof j.error === "string" ? j.error : `form status ${formRes.status}`);
      }
      const model = (await formRes.json()) as FormResponse;
      // Pull digest from header (it's also on the model meta in the body, but the route puts it on the meta — let's read it from the GET to be safe)
      const detail = await fetch(`/api/range-form/${model.id}`, {
        headers: { "Authorization": `Bearer ${token.token}` },
      });
      let digest = "";
      if (detail.ok) {
        const d = await detail.json();
        digest = (d.response_digest as string) ?? "";
      }
      const merged = { ...model, response_digest: digest || (model as FormResponse).response_digest };
      setter({ color, label: COLORS[color].name, status: "done", token, model: merged, cross_check: null, error: null });
      return { token, model: merged };
    } catch (e) {
      setter({ color, label: COLORS[color].name, status: "failed", token: null, model: null, cross_check: null, error: String(e) });
      return null;
    }
  }, []);

  const fireBoth = useCallback(async () => {
    setGlobalErr(null);
    setCrossProof({ alphaTryingBeta: null, betaTryingAlpha: null });
    setAlpha((s) => ({ ...s, model: null, cross_check: null }));
    setBeta((s) => ({ ...s, model: null, cross_check: null }));

    // Concurrent — two formations at the same time
    const [a, b] = await Promise.all([
      runOne("alpha", setAlpha),
      runOne("beta",  setBeta),
    ]);

    if (!a || !b) {
      setGlobalErr("one of the two formations failed; cannot run cross-tenant proof.");
      return;
    }

    // Cross-tenant proof: try to GET each model with the other tenant's token
    const [crossA, crossB] = await Promise.all([
      fetch(`/api/range-form/${b.model.id}`, { headers: { "Authorization": `Bearer ${a.token.token}` } }),
      fetch(`/api/range-form/${a.model.id}`, { headers: { "Authorization": `Bearer ${b.token.token}` } }),
    ]);
    setCrossProof({ alphaTryingBeta: crossA.status, betaTryingAlpha: crossB.status });
  }, [runOne]);

  const totalRunning = (alpha.status !== "idle" && alpha.status !== "done" && alpha.status !== "failed")
    || (beta.status !== "idle" && beta.status !== "done" && beta.status !== "failed");

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={fireBoth}
          disabled={totalRunning}
          className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-white text-black text-[12px] font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {totalRunning ? "running…" : alpha.model && beta.model ? "form both again" : "form both → simultaneously"}
        </button>
        <span className="font-mono text-[10.5px] text-white/45">
          two demo tokens · two tenants · one substrate · same wall clock
        </span>
        {globalErr && <span className="font-mono text-[10.5px] text-rose-400 ml-auto">{globalErr}</span>}
      </div>

      {/* Split panes */}
      <div className={`grid ${compact ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2"} gap-4 lg:gap-5`}>
        <SidePane side={alpha} cross={crossProof.alphaTryingBeta} crossLabel="against tenant β's model" />
        <SidePane side={beta}  cross={crossProof.betaTryingAlpha} crossLabel="against tenant α's model" />
      </div>

      {/* Bottom proof bar */}
      <div className={`rounded-2xl border p-5 ${
        crossProof.alphaTryingBeta === 404 && crossProof.betaTryingAlpha === 404
          ? "border-emerald-400/30 bg-emerald-500/[0.05]"
          : "border-white/10 bg-[#0a0a0a]"
      }`}>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-2">
          isolation proof
        </div>
        {crossProof.alphaTryingBeta === null && crossProof.betaTryingAlpha === null ? (
          <p className="text-[13px] text-white/55">
            Run both formations to fire the cross-tenant proof. After
            both complete, each tenant's bearer token is used to GET the
            other tenant's artifact ID. A 404 from both directions
            confirms hard isolation.
          </p>
        ) : (
          <div className="space-y-2 text-[13px]">
            <div className="font-mono text-[11.5px]">
              <span className="text-white/55">α → GET β's id:</span>{" "}
              <span className={crossProof.alphaTryingBeta === 404 ? "text-emerald-300" : "text-rose-300"}>
                {crossProof.alphaTryingBeta} {crossProof.alphaTryingBeta === 404 ? "Not Found ✓" : "leak ✗"}
              </span>
            </div>
            <div className="font-mono text-[11.5px]">
              <span className="text-white/55">β → GET α's id:</span>{" "}
              <span className={crossProof.betaTryingAlpha === 404 ? "text-emerald-300" : "text-rose-300"}>
                {crossProof.betaTryingAlpha} {crossProof.betaTryingAlpha === 404 ? "Not Found ✓" : "leak ✗"}
              </span>
            </div>
            {crossProof.alphaTryingBeta === 404 && crossProof.betaTryingAlpha === 404 && (
              <p className="text-emerald-300/85 font-mono text-[11px] leading-relaxed pt-2 border-t border-emerald-400/20">
                Tenant α cannot see tenant β's formed model. Two API
                keys, two artifact stores, zero crossover. The route's
                getModel(id, tenant_id) is the gate.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SidePane({ side, cross, crossLabel }: { side: Side; cross: number | null; crossLabel: string }) {
  const accent = COLORS[side.color].accent;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
      <div
        className="px-5 py-3 border-b border-white/10 flex items-center gap-2"
        style={{ background: `linear-gradient(90deg, ${accent}10, transparent)` }}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: accent }}>
          {side.label}
        </span>
        <span className="ml-auto font-mono text-[10px] text-white/45 tabular-nums">{side.status}</span>
      </div>

      <div className="p-5 space-y-3 min-h-[260px]">
        {side.status === "idle" && (
          <div className="font-mono text-[11px] text-white/35">awaiting form-both trigger…</div>
        )}
        {side.error && (
          <div className="font-mono text-[11px] text-rose-400">{side.error}</div>
        )}

        {side.token && (
          <div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-1">tenant_id</div>
            <code className="font-mono text-[11px] text-white/85">{side.token.tenant_id}</code>
          </div>
        )}

        {side.model && (
          <>
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-1">artifact id</div>
              <code className="font-mono text-[11px] text-white/85">{side.model.id}</code>
            </div>
            {side.model.response_digest && (
              <div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-1">response_digest</div>
                <code className="font-mono text-[10.5px] text-white/65 break-all">sha256:{side.model.response_digest.slice(0, 32)}…</code>
              </div>
            )}
            <div className="grid grid-cols-3 gap-px bg-white/[0.04] border border-white/10 rounded-lg overflow-hidden">
              <Tiny label="records" value={side.model.corpus_records.toLocaleString()} />
              <Tiny label="mode"    value={side.model.fingerprinter_mode} />
              <Tiny label="ms"      value={String(side.model.formation_ms ?? 0)} />
            </div>
          </>
        )}

        {cross !== null && (
          <div className={`rounded-xl border p-3 ${
            cross === 404 ? "border-emerald-400/30 bg-emerald-500/[0.04]" : "border-rose-400/30 bg-rose-500/[0.04]"
          }`}>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-1">cross-tenant probe</div>
            <div className={`font-mono text-[11px] ${cross === 404 ? "text-emerald-300" : "text-rose-300"}`}>
              GET {crossLabel} → <span className="font-bold">{cross}</span>{" "}
              {cross === 404 ? "Not Found · isolation holds" : "leak detected"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Tiny({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black p-2.5">
      <div className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/40 mb-1">{label}</div>
      <div className="font-mono text-[11px] text-white/85 truncate">{value}</div>
    </div>
  );
}
