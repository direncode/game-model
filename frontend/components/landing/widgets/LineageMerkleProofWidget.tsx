"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Lineage Merkle Proof Widget.
//
// What it does:
//   1. Renders a generic, deterministic 8-leaf lineage chain
//      (corpus → formation → query → replay → re-query → export → audit → verify).
//   2. Builds a real Merkle tree over those 8 leaves using Web Crypto
//      SHA-256 in the browser. Pads to 8 leaves; concatenates left||right
//      and hashes to derive each parent.
//   3. Lets the visitor click any leaf and renders the inclusion proof
//      to the root: a column of sibling hashes, each step showing
//      H(L || R) → parent. The final hash is the root, which is also
//      shown at the top — visitor sees the proof terminate.
//   4. Lets the visitor flip a single hex digit on any leaf hash to
//      tamper with it; the proof immediately re-runs and turns red.
//
// Why this matters:
//   Merkle trees are 1979 cryptography (R. C. Merkle). They are the
//   standard way to prove that a leaf is in a set without trusting
//   the prover. The platform uses them to make every formed-model
//   artifact's lineage independently verifiable from outside the
//   appliance — without ever revealing the corpus.

type Leaf = {
  id: string;
  action: string;
  detail: string;
  preimage: string;   // canonical bytes that hash to the leaf
};

const LEAVES: Leaf[] = [
  { id: "L0", action: "corpus", detail: "ingest · 50,000 records, 14 MB",                preimage: "lo:corpus:50000:14MB:csv:seed=42" },
  { id: "L1", action: "form",   detail: "BTUT bridge · 26 chunks, full corpus",          preimage: "lo:form:rng_demo01:btut:chunks=26" },
  { id: "L2", action: "query",  detail: "what is rare? · top-3 by min-Hamming",          preimage: "lo:query:rng_demo01:what_is_rare:k=3" },
  { id: "L3", action: "replay", detail: "deterministic re-run · digest matches",         preimage: "lo:replay:rng_demo01:digest=ok" },
  { id: "L4", action: "query",  detail: "show taxonomy · 8 classes returned",            preimage: "lo:query:rng_demo01:show_taxonomy:k=8" },
  { id: "L5", action: "export", detail: "OCSF audit pull · 200 events",                  preimage: "lo:export:audit:ocsf:n=200" },
  { id: "L6", action: "audit",  detail: "append-only · CEF.0 line written",              preimage: "lo:audit:append:cef0:event#7" },
  { id: "L7", action: "verify", detail: "Merkle root computed · ready for off-rack proof", preimage: "lo:verify:root:t=2026-04-30T00:00:00Z" },
];

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Hash two child hex strings concatenated as bytes.
async function pairHash(left: string, right: string): Promise<string> {
  return sha256Hex(`${left}||${right}`);
}

// Build the full Merkle tree level-by-level. Returns levels[0] = leaves,
// levels[levels.length - 1] = [root].
async function buildTree(leafHashes: string[]): Promise<string[][]> {
  const levels: string[][] = [leafHashes];
  let cur = leafHashes;
  while (cur.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      const left = cur[i];
      const right = i + 1 < cur.length ? cur[i + 1] : cur[i];   // duplicate last if odd
      next.push(await pairHash(left, right));
    }
    levels.push(next);
    cur = next;
  }
  return levels;
}

// Inclusion proof for index `idx` — the sibling at each level the path traverses.
type ProofStep = { level: number; siblingIdx: number; sibling: string; parentIdx: number; side: "L" | "R" };

function inclusionPath(levels: string[][], idx: number): ProofStep[] {
  const steps: ProofStep[] = [];
  let i = idx;
  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    const isLeftChild = i % 2 === 0;
    const siblingIdx = isLeftChild ? Math.min(i + 1, levels[lvl].length - 1) : i - 1;
    steps.push({
      level: lvl,
      siblingIdx,
      sibling: levels[lvl][siblingIdx],
      parentIdx: Math.floor(i / 2),
      side: isLeftChild ? "R" : "L",
    });
    i = Math.floor(i / 2);
  }
  return steps;
}

type Props = { compact?: boolean };

export function LineageMerkleProofWidget({ compact = false }: Props) {
  const [leafHashes, setLeafHashes] = useState<string[] | null>(null);
  const [tree, setTree] = useState<string[][] | null>(null);
  const [selected, setSelected] = useState<number | null>(0);
  const [tamperedIdx, setTamperedIdx] = useState<number | null>(null);
  const [tamperedHex, setTamperedHex] = useState<string>("");

  // Build leaves + tree on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hashes = await Promise.all(LEAVES.map((l) => sha256Hex(l.preimage)));
      if (cancelled) return;
      const t = await buildTree(hashes);
      if (cancelled) return;
      setLeafHashes(hashes);
      setTree(t);
    })();
    return () => { cancelled = true; };
  }, []);

  // The hashes used for verification — possibly tampered
  const verifyHashes = useMemo(() => {
    if (!leafHashes) return null;
    if (tamperedIdx === null) return leafHashes;
    const out = leafHashes.slice();
    out[tamperedIdx] = tamperedHex;
    return out;
  }, [leafHashes, tamperedIdx, tamperedHex]);

  const [verifyTree, setVerifyTree] = useState<string[][] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!verifyHashes) return;
      const t = await buildTree(verifyHashes);
      if (cancelled) return;
      setVerifyTree(t);
    })();
    return () => { cancelled = true; };
  }, [verifyHashes]);

  const trueRoot = tree?.[tree.length - 1]?.[0] ?? null;
  const verifyRoot = verifyTree?.[verifyTree.length - 1]?.[0] ?? null;
  const verified = trueRoot && verifyRoot && trueRoot === verifyRoot;

  const proof = useMemo(() => {
    if (!verifyTree || selected === null) return null;
    return inclusionPath(verifyTree, selected);
  }, [verifyTree, selected]);

  const tamper = useCallback(() => {
    if (selected === null || !leafHashes) return;
    const orig = leafHashes[selected];
    // flip the first hex digit
    const c = orig[0];
    const flipped = c === "0" ? "f" : c === "f" ? "0" : (parseInt(c, 16) ^ 0xf).toString(16);
    setTamperedIdx(selected);
    setTamperedHex(flipped + orig.slice(1));
  }, [leafHashes, selected]);

  const restore = useCallback(() => {
    setTamperedIdx(null);
    setTamperedHex("");
  }, []);

  if (!leafHashes || !tree || !verifyTree || !proof || selected === null || !trueRoot || !verifyRoot) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">
        Computing Merkle tree …
      </div>
    );
  }

  const selectedLeaf = LEAVES[selected];
  const selectedHash = verifyHashes![selected];

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.1fr_1fr]"} gap-6 lg:gap-10`}>
      {/* Left — leaf list and root */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Lineage chain · 8 events
          </span>
          <span className="font-mono text-[10px] text-white/35">
            click any leaf to verify
          </span>
        </div>

        {/* Root readout */}
        <div className="px-5 py-4 border-b border-white/[0.06] bg-white/[0.01]">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-1.5">
            Merkle root
          </div>
          <code className="block font-mono text-[10.5px] text-white/85 break-all">
            {trueRoot}
          </code>
        </div>

        {/* Leaves */}
        <div className="divide-y divide-white/[0.04]">
          {LEAVES.map((l, i) => {
            const active = i === selected;
            const tampered = i === tamperedIdx;
            const h = verifyHashes![i];
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelected(i)}
                className={`w-full text-left px-5 py-3.5 transition-colors flex items-baseline gap-3 ${
                  active ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                }`}
              >
                <span className={`font-mono text-[9.5px] tabular-nums ${active ? "text-white/85" : "text-white/35"}`}>
                  {l.id}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-mono text-[11px] text-white/85 mr-2">{l.action}</span>
                  <span className="font-mono text-[10.5px] text-white/45">{l.detail}</span>
                  <code className={`block font-mono text-[10px] truncate mt-1 ${tampered ? "text-rose-400" : "text-white/35"}`}>
                    {h.slice(0, 24)}…{h.slice(-6)}
                  </code>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right — proof + verification */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              Inclusion proof for {selectedLeaf.id}
            </span>
            <span className={`font-mono text-[10px] tabular-nums ${verified ? "text-emerald-400" : "text-rose-400"}`}>
              {verified ? "verified ✓" : "tampered ✗"}
            </span>
          </div>

          <div className="px-5 py-4 border-b border-white/[0.06] space-y-1">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40">leaf · {selectedLeaf.action}</div>
            <div className="font-mono text-[10.5px] text-white/65">{selectedLeaf.detail}</div>
            <code className={`block font-mono text-[10.5px] break-all ${tamperedIdx === selected ? "text-rose-400" : "text-white/85"}`}>
              {selectedHash}
            </code>
          </div>

          <div className="px-5 py-4 space-y-3">
            {proof.map((step, i) => (
              <div key={i} className="space-y-1">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 flex items-center gap-2">
                  <span>step {i + 1}</span>
                  <span className="text-white/25">·</span>
                  <span>level {step.level} → {step.level + 1}</span>
                  <span className="text-white/25">·</span>
                  <span>sibling on the {step.side === "L" ? "left" : "right"}</span>
                </div>
                <code className="block font-mono text-[10.5px] text-white/55 break-all">
                  H({step.side === "L" ? "sibling" : "current"} ‖ {step.side === "L" ? "current" : "sibling"})
                </code>
                <code className="block font-mono text-[10.5px] text-white/45 break-all">
                  sibling: {step.sibling}
                </code>
              </div>
            ))}
          </div>

          <div className={`px-5 py-4 border-t border-white/[0.06] ${verified ? "bg-emerald-500/[0.04]" : "bg-rose-500/[0.04]"}`}>
            <div className={`font-mono text-[9.5px] uppercase tracking-[0.22em] mb-1.5 ${verified ? "text-emerald-400" : "text-rose-400"}`}>
              recomputed root
            </div>
            <code className={`block font-mono text-[10.5px] break-all ${verified ? "text-emerald-300" : "text-rose-300"}`}>
              {verifyRoot}
            </code>
            <div className="mt-2 font-mono text-[10px] text-white/45">
              {verified
                ? "Matches the original root. The leaf was in the set."
                : "Does not match. Tampering detected."}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={tamper}
            disabled={tamperedIdx !== null}
            className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-rose-400/40 text-rose-300 text-[11px] font-mono tracking-wide hover:bg-rose-500/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Tamper with selected leaf
          </button>
          <button
            type="button"
            onClick={restore}
            disabled={tamperedIdx === null}
            className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-white/20 text-white/70 text-[11px] font-mono tracking-wide hover:bg-white/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Restore
          </button>
          <span className="font-mono text-[10px] text-white/35 ml-auto">
            Web Crypto · SHA-256 · in your browser
          </span>
        </div>
      </div>
    </div>
  );
}
