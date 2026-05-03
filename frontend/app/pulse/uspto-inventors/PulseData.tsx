"use client";

import { useEffect, useState } from "react";

// PulseData
//
// Single client component that fetches /api/range-public/showcase/pulse and
// renders the live data sections of the artifact page: multi-baseline
// disambiguation panel, decade productivity trajectory, polymath bleed,
// singular inventor candidates, top-25 structurally rare inventor-records,
// and the verification block.

type BaselineDisambiguators = {
  engine: number;
  patentsview: number;
  naive_name: number;
  chance: number;
  note?: string;
};

type DecadeRow = {
  decade: string;
  n_records: number;
  n_inventors: number;
  ipc_share: Record<string, number>;
};

type BleedRow = {
  class_id: number;
  size: number;
  dominant: string;
  dominant_share: number;
  bleed_share: number;
  bleed_breakdown: Record<string, number>;
};

type ClusterMeta = {
  cluster_id: number;
  size: number;
  patent_count: number;
  ipc_entropy: number;
  career_span: number;
  solo_share: number;
  median_year: number;
};

type RareRecord = {
  patent_id: string;
  title: string;
  canonical_name: string;
  year: number;
  primary_ipc: string;
  city: string;
  state: string;
  min_hamming: number;
  uspto_url: string;
};

type PulseArtifact = {
  showcase: string;
  patentsview_snapshot_date: string;
  corpus_input_sha256: string;
  corpus_sha256: string;
  corpus_records: number;
  model_id: string;
  formed_at: string;
  fingerprinter_mode?: string;
  coverage_pct?: number;
  response_digest: string;
  encrypted?: boolean;
  taxonomy_summary?: { classes: number; silhouette?: number };
  n_survivors?: number;
  baseline_disambiguators?: BaselineDisambiguators;
  decade_trajectory?: DecadeRow[];
  polymath_bleed?: BleedRow[];
  rare_records?: RareRecord[];
  cluster_meta?: ClusterMeta[];
  singular_inventor_candidates?: ClusterMeta[];
};

function pct(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function PulseData() {
  const [data, setData] = useState<PulseArtifact | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/range-public/showcase/pulse", { cache: "force-cache" })
      .then(async (r) => {
        if (r.status === 503) {
          throw new Error("Pulse artifact has not been generated yet. Run the harvester + analyze pipeline on EC2 against a pinned PatentsView snapshot.");
        }
        if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
        return r.json();
      })
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setErr(String(e.message ?? e)); });
    return () => { cancelled = true; };
  }, []);

  if (err) {
    return (
      <div className="my-12 p-6 border border-amber-500/30 bg-amber-500/5 rounded-lg">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300/80 mb-2">
          findings not yet generated
        </p>
        <p className="text-white/70 text-sm leading-relaxed">{err}</p>
        <p className="text-white/50 text-xs mt-3 leading-relaxed">
          The page is set up; the run that produces the numbers
          (downloading the PatentsView snapshot, signing each
          inventor-record, comparing the groups against PatentsView&apos;s
          gold inventor IDs) hasn&apos;t been executed yet. When it has,
          the numbers will appear here automatically.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="my-12 text-white/40 text-sm">Loading Pulse artifact…</div>;
  }

  return (
    <div className="space-y-16">
      <CorpusBlock data={data} />
      <BaselinesBlock data={data} />
      <DecadeBlock data={data} />
      <PolymathBlock data={data} />
      <SingularInventorsBlock data={data} />
      <RareBlock data={data} />
      <VerificationBlock data={data} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-white/10 rounded p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-1 text-white text-lg">{value}</div>
    </div>
  );
}

function CorpusBlock({ data }: { data: PulseArtifact }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
      <Stat label="records" value={data.corpus_records?.toLocaleString() ?? "—"} />
      <Stat label="survivors" value={data.n_survivors?.toLocaleString() ?? "—"} />
      <Stat label="snapshot" value={data.patentsview_snapshot_date} />
      <Stat label="formed" value={data.formed_at?.slice(0, 10) ?? "—"} />
    </div>
  );
}

function BaselinesBlock({ data }: { data: PulseArtifact }) {
  const b = data.baseline_disambiguators;
  if (!b) return null;
  const rows: { label: string; purity: number; note: string }[] = [
    { label: "random guessing",       purity: b.chance,      note: "what you'd get by assigning labels at random" },
    { label: "match by name only",    purity: b.naive_name,  note: "collapse every record with identical name into one inventor" },
    { label: "the engine",            purity: b.engine,      note: "Latent Ocean's signatures, sorted into groups" },
    { label: "PatentsView (gold)",    purity: b.patentsview, note: "PatentsView's own answer, used as the comparison point" },
  ];
  const max = Math.max(...rows.map((r) => r.purity || 0));
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">
        Engine matches PatentsView <span className="text-cyan-300">{pct(b.engine)}</span> of the time;
        match-by-name alone gets {pct(b.naive_name)}
      </h3>
      <p className="text-white/55 text-sm mb-4">
        Four ways to figure out which patent records belong to the same
        inventor. All four are scored by how often they match
        PatentsView&apos;s gold answer. The naive baseline (just collapse
        identical names) is the failure mode the engine has to beat —
        because &ldquo;John Smith&rdquo; on two different patents is
        often two different people. The engine&apos;s lift over the naive
        baseline is the real measure of how much it understands.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-xs">
            <span className="font-mono w-32 text-white/55">{r.label}</span>
            <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
              <div
                className="h-full bg-cyan-300/70"
                style={{ width: `${(r.purity / Math.max(0.001, max)) * 100}%` }}
              />
            </div>
            <span className="font-mono w-16 text-right text-white tabular-nums">
              {(r.purity * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      {b.note && <p className="text-white/40 text-xs mt-4 italic">{b.note}</p>}
    </div>
  );
}

function DecadeBlock({ data }: { data: PulseArtifact }) {
  const decades = data.decade_trajectory;
  if (!decades?.length) return null;
  const maxN = Math.max(...decades.map((d) => d.n_records || 0));
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">Fifty years of US innovation, decade by decade</h3>
      <p className="text-white/55 text-sm mb-4">
        How many patent records came from each decade, how many distinct
        inventors PatentsView counts in each, and the top three technology
        classes per decade. Read across the rows to see US innovation
        shift across technology domains over fifty years.
      </p>
      <div className="space-y-3">
        {decades.map((d) => {
          const top = Object.entries(d.ipc_share || {}).sort(([, a], [, b]) => b - a).slice(0, 3);
          return (
            <div key={d.decade} className="border border-white/10 rounded p-3 text-xs">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono w-16 text-white/55">{d.decade}</span>
                <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-cyan-300/70"
                    style={{ width: `${(d.n_records / Math.max(1, maxN)) * 100}%` }}
                  />
                </div>
                <span className="font-mono w-24 text-right text-white tabular-nums">
                  {d.n_records.toLocaleString()} recs
                </span>
                <span className="font-mono w-24 text-right text-white/55 tabular-nums">
                  {d.n_inventors.toLocaleString()} inv
                </span>
              </div>
              {top.length > 0 && (
                <div className="text-[10px] font-mono text-white/45 ml-19">
                  IPC top-3: {top.map(([ipc, share]) => `${ipc} ${Math.round(share * 100)}%`).join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PolymathBlock({ data }: { data: PulseArtifact }) {
  const bleed = data.polymath_bleed;
  if (!bleed?.length) return null;
  const sorted = [...bleed].sort((a, b) => b.bleed_share - a.bleed_share).slice(0, 8);
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">Inventors who span multiple technology domains</h3>
      <p className="text-white/55 text-sm mb-4">
        Groups where the inventor&apos;s patents fall across several
        different technology classes — the polymath signal. High
        cross-domain share means the inventor&apos;s career runs across
        technology boundaries, not within them.
      </p>
      <div className="space-y-2">
        {sorted.map((row) => (
          <div key={row.class_id} className="border border-white/10 rounded p-3 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-white/55">cluster #{row.class_id} ({row.size} survivors)</span>
              <span className="font-mono text-white/70">
                dominant <span className="text-white">IPC {row.dominant}</span> {Math.round(row.dominant_share * 100)}%
              </span>
              <span className="font-mono text-amber-300/80">bleed {Math.round(row.bleed_share * 100)}%</span>
            </div>
            {Object.keys(row.bleed_breakdown).length > 0 && (
              <div className="text-white/45 mt-1">
                bleed-out:{" "}
                {Object.entries(row.bleed_breakdown).sort(([, a], [, b]) => b - a)
                  .map(([ipc, n]) => `IPC ${ipc} (${n})`).join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SingularInventorsBlock({ data }: { data: PulseArtifact }) {
  const candidates = data.singular_inventor_candidates ?? [];
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">
        Possibly-singular inventors: {candidates.length} group{candidates.length === 1 ? "" : "s"}
      </h3>
      <p className="text-white/55 text-sm mb-4">
        Inventor groups that score high on all four signals at once: lots
        of patents, work spread across many technology classes, a long
        career, and a high share of solo or small-team work. Together
        these signals look like a singularly-prolific independent
        inventor. Pulse does not name them. Look at the example records
        and decide for yourself.
      </p>
      {candidates.length === 0 ? (
        <p className="text-white/40 text-sm italic">
          No groups meet the four-signal threshold in this run. Honest
          disclosure: there&apos;s no signal here.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {candidates.map((c) => (
            <div key={c.cluster_id} className="border border-white/10 rounded p-3 text-xs">
              <div className="font-mono text-white/55 mb-2">
                group #{c.cluster_id} · {c.size} records
              </div>
              <div className="grid grid-cols-2 gap-2 text-white/70">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">patents</div>
                  <div className="text-white">{c.patent_count}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">domain spread</div>
                  <div className="text-white">{c.ipc_entropy.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">career length</div>
                  <div className="text-white">{c.career_span} yrs</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/40">solo share</div>
                  <div className="text-white">{Math.round(c.solo_share * 100)}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RareBlock({ data }: { data: PulseArtifact }) {
  const rare = data.rare_records;
  if (!rare?.length) return null;
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">The 25 most unusual inventor-records</h3>
      <p className="text-white/55 text-sm mb-4">
        Records whose name + co-inventor + assignee + location combination
        stands the furthest apart from every other record in the corpus.
        Each row links to the original patent on USPTO so you can read it
        and decide whether the &ldquo;unusual&rdquo; verdict is useful.
      </p>
      <div className="space-y-1 font-mono text-xs">
        {rare.map((r, i) => (
          <a
            key={`${r.patent_id}-${i}`}
            href={r.uspto_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-colors"
          >
            <span className="w-6 text-right text-white/40 tabular-nums">{i + 1}</span>
            <span className="w-12 text-cyan-300/80 tabular-nums">{r.min_hamming}/48</span>
            <span className="w-16 text-white/45 tabular-nums">{r.year || "—"}</span>
            <span className="w-32 text-white/55 truncate">{r.canonical_name}</span>
            <span className="flex-1 text-white/85 truncate">{r.title || "[untitled]"}</span>
            <span className="text-white/40 hidden md:inline">{r.patent_id}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function VerificationBlock({ data }: { data: PulseArtifact }) {
  const fields: { label: string; value: string }[] = [
    { label: "snapshot date",              value: data.patentsview_snapshot_date },
    { label: "input file fingerprint",     value: data.corpus_input_sha256 },
    { label: "records in the run",         value: (data.corpus_records ?? 0).toLocaleString() },
    { label: "processed-data fingerprint", value: data.corpus_sha256 },
    { label: "run identifier",             value: data.model_id },
    { label: "run completed at",           value: data.formed_at },
    { label: "answer fingerprint",         value: data.response_digest },
  ];
  return (
    <div>
      <h3 className="font-display text-2xl text-white mb-2">Verify it yourself</h3>
      <p className="text-white/55 text-sm mb-4">
        Every claim above is a function of these seven values. Anyone can
        re-download the same PatentsView snapshot, run the same code, and
        produce the same fingerprints byte for byte. If our fingerprints
        match yours, the answer is reproducible. If they don&apos;t,
        we&apos;re lying.
      </p>
      <div className="space-y-1 font-mono text-xs">
        {fields.map((f) => (
          <div key={f.label} className="flex items-start gap-3 py-1">
            <span className="w-44 text-white/45">{f.label}</span>
            <span className="flex-1 text-white/85 break-all">{f.value || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
