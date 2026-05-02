"use client";

import { useState } from "react";
import { verifyReceipt, verifyChain, type Receipt } from "@/lib/receipt/verify";

type ChainArtifact = {
  showcase: string;
  chain_head: string;
  n_receipts: number;
  model_id: string;
  prompt_hash: string;
  schema_hash: string;
  receipts: Receipt[];
};

const SAMPLE = `{
  "filing_id": "<paste a receipt JSON here>",
  "prev_receipt_hash": null,
  "prompt_hash": "...",
  "schema_hash": "...",
  "corpus_sha256": "...",
  "model_id": "claude-sonnet-4-6-20250929",
  "timestamp": "2026-05-02T12:00:00.000Z",
  "output_sha256": "...",
  "receipt_hash": "..."
}`;

export function Verifier() {
  const [pasted, setPasted] = useState<string>(SAMPLE);
  const [singleResult, setSingleResult] = useState<{ ok: boolean; derived: string; expected: string; error?: string } | null>(null);
  const [chainResult, setChainResult] = useState<{ ok: boolean; n: number; failedAt: number | null; error: string | null } | null>(null);
  const [chainBusy, setChainBusy] = useState(false);

  async function checkSingle() {
    setSingleResult(null);
    let parsed: Receipt;
    try {
      parsed = JSON.parse(pasted);
    } catch (e) {
      setSingleResult({ ok: false, derived: "", expected: "", error: `JSON parse: ${String(e)}` });
      return;
    }
    try {
      const v = await verifyReceipt(parsed);
      setSingleResult(v);
    } catch (e) {
      setSingleResult({ ok: false, derived: "", expected: "", error: String(e) });
    }
  }

  async function checkChain() {
    setChainBusy(true);
    setChainResult(null);
    try {
      const r = await fetch("/api/range-public/showcase/receipt-chain", { cache: "force-cache" });
      if (r.status === 503) {
        setChainResult({ ok: false, n: 0, failedAt: null, error: "Receipt chain artifact has not been generated yet." });
        setChainBusy(false);
        return;
      }
      if (!r.ok) {
        setChainResult({ ok: false, n: 0, failedAt: null, error: `fetch failed: ${r.status}` });
        setChainBusy(false);
        return;
      }
      const data: ChainArtifact = await r.json();
      const v = await verifyChain(data.receipts);
      setChainResult({ ok: v.ok, n: data.receipts.length, failedAt: v.failedAt, error: v.error });
    } catch (e) {
      setChainResult({ ok: false, n: 0, failedAt: null, error: String(e) });
    }
    setChainBusy(false);
  }

  return (
    <div className="space-y-12">
      {/* Single-receipt verifier */}
      <div>
        <h3 className="font-display text-2xl text-white mb-2">Verify a single receipt</h3>
        <p className="text-white/55 text-sm mb-4">
          Paste a receipt JSON object below. The verifier will re-derive its
          hash and confirm it matches the published <code className="font-mono text-xs">receipt_hash</code>{" "}
          field. The hash function is{" "}
          <code className="font-mono text-xs">sha256(prev_receipt_hash || prompt_hash || schema_hash || corpus_sha256 || model_id || timestamp || output_sha256)</code>{" "}
          with pipe separators and the literal string &quot;GENESIS&quot;
          when prev is null. The implementation runs in your browser, no
          backend round-trip.
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          spellCheck={false}
          className="w-full h-72 px-3 py-2 bg-white/[0.02] border border-white/10 rounded font-mono text-[11px] text-white/85 placeholder:text-white/30"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={checkSingle}
            className="px-4 py-2 rounded bg-white text-black uppercase tracking-[0.18em] font-mono text-[10.5px] hover:bg-white/90"
          >
            Verify this receipt
          </button>
          {singleResult && singleResult.ok && (
            <span className="font-mono text-xs text-green-300">
              ✓ matches: derived {singleResult.derived.slice(0, 32)}…
            </span>
          )}
          {singleResult && !singleResult.ok && (
            <span className="font-mono text-xs text-red-300 break-all">
              ✗ {singleResult.error || `derived ${singleResult.derived.slice(0, 16)}… ≠ stored ${singleResult.expected.slice(0, 16)}…`}
            </span>
          )}
        </div>
      </div>

      {/* Chain verifier */}
      <div>
        <h3 className="font-display text-2xl text-white mb-2">Verify the whole chain</h3>
        <p className="text-white/55 text-sm mb-4">
          Fetch <code className="font-mono text-xs">/api/range-public/showcase/receipt-chain</code>{" "}
          (the chain-only artifact, ~30 KB) and replay it client-side. Each
          receipt&apos;s prev_hash must equal the previous receipt&apos;s hash;
          each receipt&apos;s hash must re-derive correctly. Tampering with
          any single byte breaks the chain at that index.
        </p>
        <button
          onClick={checkChain}
          disabled={chainBusy}
          className="px-4 py-2 rounded bg-white text-black uppercase tracking-[0.18em] font-mono text-[10.5px] hover:bg-white/90 disabled:opacity-50"
        >
          {chainBusy ? "Replaying chain…" : "Verify entire chain"}
        </button>
        {chainResult && chainResult.ok && (
          <p className="mt-4 font-mono text-xs text-green-300">
            ✓ chain valid. Replayed {chainResult.n} receipts; every prev_hash matches; every receipt re-derives correctly.
          </p>
        )}
        {chainResult && !chainResult.ok && (
          <p className="mt-4 font-mono text-xs text-red-300">
            ✗ chain INVALID at receipt index {chainResult.failedAt ?? "?"}: {chainResult.error}
          </p>
        )}
      </div>

      {/* OpenTimeStamps panel */}
      <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-lg p-5">
        <h3 className="font-display text-xl text-white mb-2">OpenTimeStamps anchor</h3>
        <p className="text-white/65 text-sm leading-relaxed mb-3">
          The chain head is anchored to the Bitcoin timechain via OpenTimeStamps.
          Download the{" "}
          <a href="/showcases/receipt.chainhead.ots" download className="text-cyan-300/80 hover:text-cyan-200 underline">
            receipt.chainhead.ots
          </a>{" "}
          proof and run <code className="font-mono text-xs text-white">ots verify receipt.chainhead.ots</code>{" "}
          locally to confirm the chain head existed at the published <code className="font-mono text-xs text-white">ran_at</code>{" "}
          timestamp. Initial OTS proofs are &quot;pending&quot; until the next Bitcoin
          block confirms; <code className="font-mono text-xs text-white">ots upgrade</code>{" "}
          fetches the confirmation when ready.
        </p>
        <p className="text-white/45 text-xs leading-relaxed">
          Install: <code className="font-mono text-white/65">pip install opentimestamps-client</code>.
          The OpenTimeStamps service is free and run by the Bitcoin community;
          no Latent Ocean infrastructure is required to verify.
        </p>
      </div>
    </div>
  );
}
