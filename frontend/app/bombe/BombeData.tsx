"use client";

import { useEffect, useState } from "react";

// BombeData
//
// Fetches the public artifact at /api/range-public/showcase/bombe and renders
// the actual findings from the Bletchley reanalysis run. Same shape as the
// Atlas / Pulse data components — different corpus, same engine output.

type BombeArtifact = {
  showcase: string;
  kaggle_snapshot_date: string;
  corpus_input_sha256: string;
  corpus_sha256: string;
  corpus_records: number;
  model_id: string;
  formed_at: string;
  response_digest: string;
  taxonomy_summary?: { classes: number };
  n_survivors?: number;
  purity?: {
    coarse_8_archive?: number;
    fine_subcategory?: number;
    rows?: { cluster: number; size: number; dominant: string; dominant_share: number; breakdown: Record<string, number> }[];
  };
  rare_records?: {
    paper_id: string;
    title: string;
    primary_category: string;
    archive: string;
    min_hamming: number;
    arxiv_url: string;  // wikipedia_url under the hood for this corpus
  }[];
};

const ARCHIVE_PALETTE: Record<string, string> = {
  people:       "#7DD3FC",
  place:        "#A78BFA",
  machine:      "#FCD34D",
  operation:    "#34D399",
  organization: "#F472B6",
  concept:      "#FB923C",
};

function colorFor(archive: string): string {
  return ARCHIVE_PALETTE[archive] ?? "rgba(255,255,255,0.45)";
}

function pct(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function BombeData() {
  const [data, setData] = useState<BombeArtifact | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/range-public/showcase/bombe", { cache: "force-cache" })
      .then(async (r) => {
        if (r.status === 503) {
          throw new Error("Bombe artifact has not been generated yet on this environment.");
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
          findings not yet generated on this environment
        </p>
        <p className="text-white/70 text-sm leading-relaxed">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="my-12 text-white/40 text-sm">Loading findings…</div>;
  }

  const purity = data.purity;
  const rare = data.rare_records ?? [];

  return (
    <div className="space-y-12">
      {/* Run summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
        <Stat label="Wikipedia articles" value={(data.corpus_records ?? 0).toLocaleString()} />
        <Stat label="signed by the engine" value={(data.n_survivors ?? 0).toLocaleString()} />
        <Stat label="run date" value={data.formed_at?.slice(0, 10) ?? "—"} />
        <Stat label="answer fingerprint" value={(data.response_digest || "—").slice(0, 12) + "…"} />
      </div>

      {/* Cluster purity */}
      {purity?.rows?.length ? (
        <div>
          <h3 className="font-display text-2xl text-white mb-2">
            Engine groups match my archive labels:{" "}
            <span className="text-cyan-300">{pct(purity.coarse_8_archive)}</span> of the time
          </h3>
          <p className="text-white/55 text-sm mb-4">
            Each Wikipedia article was tagged with one of six categories
            (people, place, machine, operation, organization, concept)
            based on which Wikipedia category it came from. The engine
            never saw these tags. It grouped the articles purely on
            structural similarity. Below: each group&apos;s composition
            by category. The dominant category is colored solid; the
            mix on each row is what the engine could not reduce to a
            single category.
          </p>
          <div className="space-y-2">
            {purity.rows.map((row) => (
              <div key={row.cluster} className="flex items-center gap-3 text-xs">
                <span className="font-mono w-12 text-white/45">#{row.cluster}</span>
                <div className="flex-1 flex h-6 rounded overflow-hidden bg-white/5">
                  {Object.entries(row.breakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([archive, n]) => {
                      const share = n / row.size;
                      return (
                        <div
                          key={archive}
                          title={`${archive}: ${n} (${(share * 100).toFixed(1)}%)`}
                          style={{ width: `${share * 100}%`, backgroundColor: colorFor(archive) }}
                        />
                      );
                    })}
                </div>
                <span className="font-mono w-12 text-right text-white/55 tabular-nums">{row.size}</span>
                <span className="font-mono w-14 text-right text-white/70 tabular-nums">
                  {(row.dominant_share * 100).toFixed(0)}%
                </span>
                <span className="font-mono w-24 text-white/45">{row.dominant}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-mono uppercase tracking-[0.14em]">
            {Object.entries(ARCHIVE_PALETTE).map(([k, c]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                <span className="text-white/55">{k}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Rare records */}
      {rare.length > 0 && (
        <div>
          <h3 className="font-display text-2xl text-white mb-2">
            The {rare.length} most structurally unusual Wikipedia articles in this corpus
          </h3>
          <p className="text-white/55 text-sm mb-4">
            Articles whose engine signature stands the furthest apart
            from every other article. These are the entries the engine
            flagged as &ldquo;unlike anything else.&rdquo; Each row links
            to the Wikipedia article so you can read it and decide
            whether the verdict is useful.
          </p>
          <div className="space-y-1 font-mono text-xs">
            {rare.map((r, i) => (
              <a
                key={`${r.paper_id}-${i}`}
                href={r.arxiv_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-colors"
              >
                <span className="w-6 text-right text-white/40 tabular-nums">{i + 1}</span>
                <span className="w-12 text-cyan-300/80 tabular-nums">{r.min_hamming}</span>
                <span className="w-24 text-white/55 truncate">{r.archive}</span>
                <span className="flex-1 text-white/85 truncate">{r.title || "[untitled]"}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Verification fields */}
      <div>
        <h3 className="font-display text-2xl text-white mb-2">Verify it yourself</h3>
        <p className="text-white/55 text-sm mb-4">
          Every claim above is a function of the published fingerprints
          below. Anyone can re-run scripts/bombe_harvest.py against the
          live Wikipedia API and confirm the corpus fingerprint matches
          ours, then re-run the analyze step against the same model and
          confirm the answer fingerprint matches too.
        </p>
        <div className="space-y-1 font-mono text-xs">
          {[
            ["snapshot date",              data.kaggle_snapshot_date],
            ["articles in the run",        (data.corpus_records ?? 0).toLocaleString()],
            ["processed-data fingerprint", data.corpus_sha256],
            ["run identifier",             data.model_id],
            ["run completed at",           data.formed_at],
            ["answer fingerprint",         data.response_digest],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-start gap-3 py-1">
              <span className="w-44 text-white/45">{label}</span>
              <span className="flex-1 text-white/85 break-all">{(value as string) || "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 rounded p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-1 text-white text-sm font-mono break-all">{value}</div>
    </div>
  );
}
