"use client";

import { useEffect, useMemo, useState } from "react";
import { verifyReceipt, type Receipt } from "@/lib/receipt/verify";

type FilingRecord = Receipt & {
  accession_number: string;
  cik: string;
  year: number;
  form: string;
  edgar_url: string;
  filing_text_path?: string;
  summary?: Record<string, unknown>;
  tokens?: { input: number; output: number };
};

type Artifact = {
  showcase: string;
  ran_at: string;
  model_id: string;
  prompt_hash: string;
  schema_hash: string;
  n_filings: number;
  n_receipts: number;
  chain_head: string;
  ots_anchored: boolean;
  ots_file: string | null;
  filings: FilingRecord[];
};

export function ReceiptList() {
  const [data, setData] = useState<Artifact | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/range-public/showcase/receipt", { cache: "force-cache" })
      .then(async (r) => {
        if (r.status === 503) {
          throw new Error("Receipt artifact has not been generated yet. Run scripts/receipt_run.py against a pinned SEC EDGAR snapshot.");
        }
        if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
        return r.json();
      })
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setErr(String(e.message ?? e)); });
    return () => { cancelled = true; };
  }, []);

  const years = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.filings.map((f) => f.year))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filings.filter((f) => {
      if (yearFilter !== "all" && String(f.year) !== yearFilter) return false;
      if (!filter) return true;
      const q = filter.toLowerCase();
      return (
        f.filing_id?.toLowerCase().includes(q) ||
        f.cik?.toLowerCase().includes(q) ||
        f.accession_number?.toLowerCase().includes(q)
      );
    });
  }, [data, filter, yearFilter]);

  if (err) {
    return (
      <div className="my-12 p-6 border border-amber-500/30 bg-amber-500/5 rounded-lg">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300/80 mb-2">
          receipt artifact pending
        </p>
        <p className="text-white/70 text-sm leading-relaxed">{err}</p>
        <p className="text-white/50 text-xs mt-3 leading-relaxed">
          The page renders prose and structure now. The live receipts will
          appear once <code className="text-white/70">scripts/receipt_run.py</code>{" "}
          completes the 1,000-filing summarization run and writes{" "}
          <code className="text-white/70">/data/formed_models/_public/sec_edgar.json</code>.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="my-12 text-white/40 text-sm">Loading Receipt artifact…</div>;
  }

  return (
    <div>
      {/* Run summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs mb-8">
        <Stat label="filings" value={data.n_filings.toLocaleString()} />
        <Stat label="receipts" value={data.n_receipts.toLocaleString()} />
        <Stat label="model" value={data.model_id?.split("-").slice(0, 4).join("-") ?? "—"} />
        <Stat label="ran" value={data.ran_at?.slice(0, 10) ?? "—"} />
      </div>

      {/* Chain head + OTS */}
      <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-lg p-4 mb-8 font-mono text-xs">
        <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80 mb-1">chain head</div>
        <div className="text-white break-all mb-3">{data.chain_head}</div>
        <div className="flex flex-wrap items-center gap-3 text-white/55">
          <span>OTS anchored: <span className={data.ots_anchored ? "text-cyan-300" : "text-amber-300"}>{data.ots_anchored ? "yes" : "no"}</span></span>
          {data.ots_file && (
            <a href={"/" + data.ots_file} className="text-cyan-300/80 hover:text-cyan-200 underline">
              download .ots proof ↗
            </a>
          )}
          <a href="/receipt/verify" className="ml-auto text-cyan-300/80 hover:text-cyan-200 underline">
            verify a single receipt → /receipt/verify
          </a>
        </div>
      </div>

      {/* Filter UI */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="filter by filing_id, CIK, or accession…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-64 px-3 py-2 bg-white/5 border border-white/10 rounded font-mono text-xs text-white placeholder:text-white/30"
        />
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded font-mono text-xs text-white"
        >
          <option value="all">all years</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <span className="self-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          {filtered.length} / {data.filings.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {filtered.map((f) => (
          <FilingCard
            key={f.filing_id}
            filing={f}
            expanded={expandedId === f.filing_id}
            onToggle={() => setExpandedId(expandedId === f.filing_id ? null : (f.filing_id ?? null))}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 rounded p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-1 text-white text-sm font-mono">{value}</div>
    </div>
  );
}

function FilingCard({ filing, expanded, onToggle }: { filing: FilingRecord; expanded: boolean; onToggle: () => void }) {
  const [verifyState, setVerifyState] = useState<"idle" | "ok" | "fail" | "checking">("idle");
  const [verifyDetail, setVerifyDetail] = useState<string>("");

  async function runVerify() {
    setVerifyState("checking");
    try {
      const v = await verifyReceipt(filing as Receipt);
      if (v.ok) {
        setVerifyState("ok");
        setVerifyDetail(`derived ${v.derived.slice(0, 16)}… matches stored ${v.expected.slice(0, 16)}…`);
      } else {
        setVerifyState("fail");
        setVerifyDetail(`derived ${v.derived.slice(0, 16)}… does NOT match stored ${v.expected.slice(0, 16)}…`);
      }
    } catch (e) {
      setVerifyState("fail");
      setVerifyDetail(String(e));
    }
  }

  return (
    <article className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-white/45 w-4">{expanded ? "▾" : "▸"}</span>
          <span className="text-white">{filing.filing_id}</span>
          <span className="text-white/45">CIK {filing.cik}</span>
          <span className="text-white/45">{filing.year}</span>
          <span className="text-white/45">{filing.form}</span>
        </div>
        <div className="font-mono text-[10px] text-white/40">
          receipt {filing.receipt_hash?.slice(0, 16)}…
        </div>
      </button>
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap gap-3">
            <a
              href={filing.edgar_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-cyan-300/80 hover:text-cyan-200 underline"
            >
              SEC EDGAR ↗
            </a>
            <button
              onClick={runVerify}
              className="font-mono text-[10px] uppercase tracking-[0.18em] px-3 py-1 rounded border border-white/15 text-white/70 hover:text-white hover:border-white/30"
              disabled={verifyState === "checking"}
            >
              {verifyState === "checking" ? "checking…" : "verify this receipt"}
            </button>
            {verifyState === "ok" && (
              <span className="font-mono text-[10px] text-green-300">✓ {verifyDetail}</span>
            )}
            {verifyState === "fail" && (
              <span className="font-mono text-[10px] text-red-300">✗ {verifyDetail}</span>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 mb-1">summary</div>
            <pre className="font-mono text-[11px] text-white/85 bg-white/[0.02] border border-white/5 rounded p-3 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(filing.summary ?? {}, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 mb-1">receipt</div>
            <div className="font-mono text-[11px] space-y-1 text-white/75">
              <div><span className="text-white/40 w-44 inline-block">receipt_hash</span> <span className="break-all text-white/85">{filing.receipt_hash}</span></div>
              <div><span className="text-white/40 w-44 inline-block">prev_receipt_hash</span> <span className="break-all">{filing.prev_receipt_hash ?? "GENESIS"}</span></div>
              <div><span className="text-white/40 w-44 inline-block">prompt_hash</span> <span className="break-all">{filing.prompt_hash}</span></div>
              <div><span className="text-white/40 w-44 inline-block">schema_hash</span> <span className="break-all">{filing.schema_hash}</span></div>
              <div><span className="text-white/40 w-44 inline-block">corpus_sha256</span> <span className="break-all">{filing.corpus_sha256}</span></div>
              <div><span className="text-white/40 w-44 inline-block">output_sha256</span> <span className="break-all">{filing.output_sha256}</span></div>
              <div><span className="text-white/40 w-44 inline-block">model_id</span> <span>{filing.model_id}</span></div>
              <div><span className="text-white/40 w-44 inline-block">timestamp</span> <span>{filing.timestamp}</span></div>
              {filing.tokens && (
                <div><span className="text-white/40 w-44 inline-block">tokens</span> <span>{filing.tokens.input} in / {filing.tokens.output} out</span></div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
