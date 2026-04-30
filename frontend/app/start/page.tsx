"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { parseCSV, scoreRows, type Scored } from "@/lib/csvClientFingerprint";

// /start — non-technical onboarding.
// Drag a CSV. Get structural outliers. Nothing leaves your browser.
// No upload, no account, no server round-trip. The 48-bit primitive
// runs locally in Web Crypto under seed=42, same math as the server.

export default function StartPage() {
  const [rows, setRows] = useState<Scored[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setErr(null);
    setBusy(true);
    setProgress(0);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length < 5) {
        setErr("Need at least 5 rows to run a structural analysis.");
        setBusy(false);
        return;
      }
      if (parsed.length > 2000) {
        setErr(
          `Browser mode caps at 2,000 rows. You sent ${parsed.length.toLocaleString()}. For bigger runs, install on your database.`,
        );
        setBusy(false);
        return;
      }
      const scored = await scoreRows(parsed, (p) => setProgress(p));
      scored.sort((a, b) => b._composite - a._composite);
      setRows(scored);
    } catch (e) {
      setErr(String(e));
    }
    setBusy(false);
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (!/\.csv$/i.test(file.name)) {
        setErr("Drop a .csv file.");
        return;
      }
      await handleFile(file);
    },
    [handleFile],
  );

  const onChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await handleFile(file);
    },
    [handleFile],
  );

  const loadSample = useCallback(async () => {
    const demo = [
      "ticker,sector,revenue,ebitda_margin,debt_to_equity,net_margin,dividend_yield",
      "AAPL,tech,383000,0.31,1.9,0.25,0.005",
      "MSFT,tech,211900,0.48,0.4,0.36,0.007",
      "GOOG,tech,307400,0.30,0.1,0.24,0.000",
      "AMZN,tech,574800,0.11,0.8,0.06,0.000",
      "META,tech,134900,0.43,0.2,0.29,0.000",
      "NVDA,tech,60900,0.60,0.3,0.49,0.002",
      "TSLA,auto,96770,0.15,0.2,0.15,0.000",
      "F,auto,176190,0.06,2.2,0.02,0.044",
      "GM,auto,171840,0.08,1.9,0.06,0.011",
      "JPM,financial,158100,0.41,1.4,0.33,0.024",
      "GS,financial,50310,0.28,5.6,0.15,0.028",
      "BAC,financial,98580,0.30,1.5,0.22,0.029",
      "XOM,energy,344600,0.26,0.3,0.10,0.039",
      "CVX,energy,196910,0.25,0.2,0.10,0.042",
      "PFE,pharma,58500,0.20,0.8,0.04,0.063",
      "JNJ,pharma,85160,0.32,0.5,0.15,0.029",
      "MRK,pharma,60100,0.42,0.9,0.26,0.024",
      "PG,consumer,82010,0.24,0.8,0.18,0.024",
      "KO,consumer,45750,0.33,1.8,0.23,0.031",
      "WMT,retail,648100,0.05,0.9,0.03,0.011",
      "COST,retail,242300,0.04,0.4,0.03,0.005",
      "ERIE,insurance,4110,0.12,0.1,0.15,0.013",
      "AEP,utility,19070,0.28,2.1,0.11,0.036",
      "EXC,utility,21730,0.30,1.9,0.11,0.039",
    ].join("\n");
    const blob = new Blob([demo], { type: "text/csv" });
    const f = new File([blob], "sample-portfolio.csv", { type: "text/csv" });
    await handleFile(f);
  }, [handleFile]);

  const topColumns = rows && rows.length > 0
    ? Object.keys(rows[0]).filter((k) => !k.startsWith("_")).slice(0, 5)
    : [];

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="mb-12">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/45 mb-4">
              Drop a CSV. Get structural outliers. Your file never leaves this page.
            </p>
            <h1 className="font-display font-medium text-5xl md:text-7xl tracking-[-0.035em] text-white leading-[0.95]">
              Structural outliers<br />
              <span className="text-white/50">from your spreadsheet in 60 seconds.</span>
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-2xl">
              Every row of your CSV gets a deterministic 48-bit structural
              signature and a score. Rows that don't look like their peers
              float to the top. No account, no upload, no terminology. The
              engine runs here in your browser — your file never leaves this
              device.
            </p>
          </div>

          {!rows && !busy && (
            <div
              className="rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.02] p-12 text-center hover:border-li-cyan/40 hover:bg-white/[0.04] transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              style={{ cursor: "pointer" }}
            >
              <input
                type="file"
                ref={inputRef}
                accept=".csv,text/csv"
                onChange={onChange}
                className="hidden"
              />
              <div className="font-display text-2xl text-white mb-2">
                Drop a CSV here
              </div>
              <div className="text-sm text-white/50 mb-6">
                or click to choose one · up to 2,000 rows in browser mode
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  loadSample();
                }}
                className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-white/20 text-white/80 text-sm hover:text-white hover:border-white/40 transition-colors"
              >
                Or try with a sample 24-ticker portfolio
              </button>
              <p className="mt-6 text-[11px] font-mono text-white/30">
                Runs locally via Web Crypto · seed=42 deterministic · nothing uploaded
              </p>
            </div>
          )}

          {busy && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12">
              <div className="font-mono text-sm text-white/70 mb-4">
                Fingerprinting {fileName ?? "your rows"}…
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-li-cyan to-li-green transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3 text-xs font-mono text-white/40 tabular-nums">
                {progress}%
              </div>
            </div>
          )}

          {err && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">
              {err}
            </div>
          )}

          {rows && !busy && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">Rows analyzed</div>
                  <div className="mt-2 font-display text-3xl tabular-nums">{rows.length}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">Top composite</div>
                  <div className="mt-2 font-display text-3xl text-li-cyan tabular-nums">{rows[0]._composite.toFixed(3)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40">Stayed local</div>
                  <div className="mt-2 font-display text-3xl text-li-green">Yes</div>
                </div>
              </div>

              <p className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-3">
                Top 10 structural outliers (from your file, right now, in this browser)
              </p>
              <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0a0a10]">
                <div
                  className="grid items-center px-5 py-3 border-b border-white/10 text-[10px] font-mono uppercase tracking-widest text-white/40"
                  style={{ gridTemplateColumns: `40px repeat(${Math.min(topColumns.length, 5)}, minmax(0, 1fr)) 90px 90px` }}
                >
                  <div>#</div>
                  {topColumns.map((k) => (
                    <div key={k} className="truncate">{k}</div>
                  ))}
                  <div className="text-right">Composite</div>
                  <div className="text-right">Anomaly</div>
                </div>
                {rows.slice(0, 10).map((r, i) => (
                  <div
                    key={i}
                    className="grid items-center px-5 py-3 border-b border-white/[0.04] text-sm hover:bg-white/[0.02]"
                    style={{ gridTemplateColumns: `40px repeat(${Math.min(topColumns.length, 5)}, minmax(0, 1fr)) 90px 90px` }}
                  >
                    <div className="font-mono text-xs text-white/40">#{i + 1}</div>
                    {topColumns.map((k) => (
                      <div key={k} className="truncate">{String(r[k] ?? "—")}</div>
                    ))}
                    <div className="text-right font-mono text-sm text-li-cyan tabular-nums">
                      {r._composite.toFixed(3)}
                    </div>
                    <div className="text-right font-mono text-xs text-white/70 tabular-nums">
                      {r._anomaly.toFixed(3)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setRows(null);
                    setFileName(null);
                    setErr(null);
                  }}
                  className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
                >
                  Upload another file
                </button>
                <a
                  href="mailto:sales@latentocean.com?subject=Install%20at%20my%20scale&body=Rows%3A%20%0ASource%3A%20%0AAir-gap%3F%20"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
                >
                  Install on your database for real scale
                </a>
                <Link
                  href="/platform"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
                >
                  Read the primitive spec
                </Link>
              </div>
            </>
          )}

          <div className="mt-16 rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-3">
              What's happening
            </p>
            <p className="text-sm text-white/70 leading-relaxed">
              Every row in your file gets hashed into a 48-bit structural
              fingerprint (SHA-256 rotation ensemble, seed = 42). Each
              fingerprint gets a 4-dimensional score against the others:
              isolation (anomaly), information density (reconstruction),
              per-bit entropy (diversity), and a weighted composite. Rows
              that sit far from their peers in fingerprint space rank at
              the top. The math is identical to the server pipeline —
              browser mode just caps size so your laptop fan doesn't spin.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
