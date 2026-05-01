"use client";

import { useEffect, useState } from "react";

// CorpusVerificationWidget
//
// The DocSouth deployment claims a deterministic, reproducible artifact.
// This widget surfaces the two hashes a third party can independently
// verify: the corpus sha256 (re-derivable from the public DocSouth ZIPs)
// and the formed-model response_digest (returned by every query against
// the model). Plus a one-line copy-able command for each verification.

type ShowcaseData = {
  showcase: string;
  model_id: string;
  corpus_sha256: string;
  corpus_records: number;
  corpus_bytes: number;
  response_digest: string;
  formation_ms: number;
  formed_at: string;
  fingerprinter_mode: string;
  effective_strategy: string;
  encrypted: boolean;
  source?: { url: string; license: string; publisher: string; collections: string[]; source_texts: number };
  verification?: { instructions: string };
  persistence?: { counts: { H0: number; H1: number; H2: number }; n_points: number; library: string };
  runpod?: { status: string; output_summary?: { device?: string; modules?: number; final_auc?: number } };
};

type Props = {
  showcase?: string;
  compact?: boolean;
};

export function CorpusVerificationWidget({ showcase = "docsouth", compact = false }: Props) {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/range-public/showcase/${showcase}`, { cache: "force-cache" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setErr(String(e)); });
    return () => { cancelled = true; };
  }, [showcase]);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    }).catch(() => { /* ignore */ });
  }

  if (err) return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.04] p-5 font-mono text-[11px] text-rose-300">{err}</div>;
  if (!data) return <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 font-mono text-[11px] text-white/35">Loading verification artifact …</div>;

  const corpusGB = (data.corpus_bytes / (1024 * 1024)).toFixed(1);
  const formationS = (data.formation_ms / 1000).toFixed(1);

  return (
    <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[1.4fr_1fr]"} gap-6 lg:gap-10`}>
      {/* Hashes + commands */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
        <div className="flex items-baseline justify-between px-5 py-3 border-b border-white/10">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
            Two hashes anyone can verify
          </span>
          <span className="font-mono text-[10px] text-white/35 tabular-nums">
            model · {data.model_id}
          </span>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {/* Corpus sha256 */}
          <div className="px-5 py-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">
              corpus_sha256 — derivable from the public DocSouth ZIPs
            </div>
            <button
              type="button"
              onClick={() => copy(data.corpus_sha256, "corpus")}
              title="click to copy"
              className="block text-left w-full font-mono text-[11.5px] text-white/85 break-all hover:text-white transition-colors"
            >
              sha256:{data.corpus_sha256}
            </button>
            <div className="mt-2 font-mono text-[10px] text-white/45">
              {data.corpus_records.toLocaleString()} records · {corpusGB} MB ·{" "}
              {data.source?.source_texts ?? 711} source texts ·{" "}
              {data.source?.collections?.length ?? 4} DocSouth collections
            </div>
            {copied === "corpus" && <div className="mt-1 font-mono text-[9.5px] text-emerald-300">copied</div>}
          </div>

          {/* Response digest */}
          <div className="px-5 py-4">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">
              response_digest — invariant under (corpus, model_id, seed=42)
            </div>
            <button
              type="button"
              onClick={() => copy(data.response_digest, "digest")}
              title="click to copy"
              className="block text-left w-full font-mono text-[11.5px] text-white/85 break-all hover:text-white transition-colors"
            >
              sha256:{data.response_digest}
            </button>
            <div className="mt-2 font-mono text-[10px] text-white/45">
              formed in {formationS}s · fingerprinter={data.fingerprinter_mode} · effective={data.effective_strategy}
              {data.encrypted && " · AES-256-GCM at rest"}
            </div>
            {copied === "digest" && <div className="mt-1 font-mono text-[9.5px] text-emerald-300">copied</div>}
          </div>

          {/* Verification commands */}
          <div className="px-5 py-4 bg-white/[0.01]">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/40 mb-2">
              How to verify on your own machine
            </div>
            <pre className="font-mono text-[10.5px] text-white/85 leading-relaxed whitespace-pre overflow-x-auto bg-black rounded-lg p-3 border border-white/[0.06]">
{`# 1. Re-derive the corpus
mkdir docsouth && cd docsouth
for f in church-southern-black-community first-person-narratives-american-south library-southern-literature na-slave-narratives; do
  curl -O https://docsouth.unc.edu/full-text/$f.zip
  unzip -o $f.zip
done
python3 docsouth_harvest.py            # in this repo, scripts/
sha256sum docsouth.ndjson
# expect: ${data.corpus_sha256.slice(0, 16)}...

# 2. Pull this showcase artifact
curl https://www.latentocean.com/api/range-public/showcase/docsouth \\
  | jq '.response_digest'
# expect: "${data.response_digest.slice(0, 16)}..."`}
            </pre>
            <div className="mt-2 font-mono text-[10px] text-white/45 leading-relaxed">
              The corpus sha256 is third-party-checkable from the public DocSouth ZIPs
              alone. The response_digest is reproducible internally under the
              determinism contract — see{" "}
              <a href="/method#section-3" className="text-white/85 hover:text-white border-b border-white/30 hover:border-white">/method · query</a>{" "}
              to verify against the live model.
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
            What's published, what isn't
          </div>
          <p className="text-[13px] text-white/75 leading-snug">
            Public: corpus_sha256, response_digest, persistence bar
            counts (H0/H1/H2), cluster purity, decade trajectory, named
            rare records, RunPod output summary.
          </p>
          <p className="text-[13px] text-white/75 leading-snug mt-3">
            Held back: the 2,400 BTUT survivor fingerprint hex strings
            themselves, the per-record contributing-field set, the BTUT
            pipeline internals. Trade-secret protected.
          </p>
        </div>

        {data.persistence && (
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
              Topology summary
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-[10.5px] text-white/85 tabular-nums">
              <div className="text-center"><div className="text-[20px] text-white">{data.persistence.counts.H0}</div><div className="text-white/45 mt-1">H0 components</div></div>
              <div className="text-center"><div className="text-[20px] text-white">{data.persistence.counts.H1}</div><div className="text-white/45 mt-1">H1 cycles</div></div>
              <div className="text-center"><div className="text-[20px] text-white">{data.persistence.counts.H2}</div><div className="text-white/45 mt-1">H2 voids</div></div>
            </div>
            <div className="mt-3 font-mono text-[9.5px] text-white/45 text-center">
              {data.persistence.library} · n_points = {data.persistence.n_points}
            </div>
          </div>
        )}

        {data.runpod?.output_summary && (
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55 mb-3">
              GPU summary
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-[10.5px] text-white/85 tabular-nums">
              <div className="text-center"><div className="text-[20px] text-white">{data.runpod.output_summary.modules ?? "—"}</div><div className="text-white/45 mt-1">modules</div></div>
              <div className="text-center"><div className="text-[20px] text-white">{data.runpod.output_summary.final_auc?.toFixed(2) ?? "—"}</div><div className="text-white/45 mt-1">final AUC</div></div>
              <div className="text-center"><div className="text-[20px] text-white">{data.runpod.output_summary.device ?? "—"}</div><div className="text-white/45 mt-1">device</div></div>
            </div>
            <div className="mt-3 font-mono text-[9.5px] text-white/45 text-center">
              RunPod async · {data.runpod.status}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
