"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

type TestDetail = Record<string, any>;
type ValidationTest = {
  name: string;
  description: string;
  passed: boolean;
  headline: string;
  detail: TestDetail;
};
type ValidationReport = {
  generated_at: string;
  wall_seconds: number;
  tests_run: number;
  tests_passed: number;
  commercial_readiness_score: number;
  tests: ValidationTest[];
  meta: {
    sdk_version: string;
    python: string;
    seed: number;
    btut_path: string;
    iterations_requested: number;
  };
};

const TEST_ORDER = [
  "watchlist_hit_rate",
  "null_test_falsifiability",
  "sdk_throughput",
  "reproducibility",
  "cost_per_finding",
  "multi_tenant_concurrency",
  "air_gap",
];

const TEST_TITLES: Record<string, string> = {
  watchlist_hit_rate: "Named-watchlist hit-rate",
  null_test_falsifiability: "Null-test falsifiability",
  sdk_throughput: "SDK throughput",
  reproducibility: "Reproducibility",
  cost_per_finding: "Cost economics",
  multi_tenant_concurrency: "Multi-tenant concurrency",
  air_gap: "Air-gap proof",
};

const TEST_BUYER_OBJECTION: Record<string, string> = {
  watchlist_hit_rate: "Does it work?",
  null_test_falsifiability: "Can you prove the signal isn't noise?",
  sdk_throughput: "Is it fast enough?",
  reproducibility: "Will my audit reproduce?",
  cost_per_finding: "Is it cheaper than an analyst?",
  multi_tenant_concurrency: "Will it scale to multiple tenants?",
  air_gap: "Can we run it on-prem / FedRAMP?",
};

export default function ValidationPage() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/validation", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => { if (!cancelled) setReport(data as ValidationReport); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, []);

  const tests = (report?.tests ?? [])
    .slice()
    .sort((a, b) => TEST_ORDER.indexOf(a.name) - TEST_ORDER.indexOf(b.name));

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="mb-12">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-li-cyan mb-4">
              Commercial validation · reproducible on demand
            </p>
            <h1 className="font-display text-5xl md:text-7xl tracking-[-0.03em] text-white leading-[0.95]">
              Every number, falsifiable.
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-3xl">
              Seven dimensions of proof, re-derived in under twenty seconds from the
              repository's cached BTUT run. If a number here diverges from your re-run,
              file an issue — we retract the claim.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300">
              Could not load validation artifact: {error}. Regenerate with{" "}
              <code className="font-mono">python scripts/commercial_validation.py</code>.
            </div>
          )}

          {!report && !error && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-12 text-center text-white/50">
              Loading latest validation run…
            </div>
          )}

          {report && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-16">
                <SummaryStat
                  label="Readiness score"
                  value={`${report.commercial_readiness_score}/100`}
                  tone={report.commercial_readiness_score >= 90 ? "good" : "warn"}
                />
                <SummaryStat
                  label="Tests passed"
                  value={`${report.tests_passed}/${report.tests_run}`}
                  tone={report.tests_passed === report.tests_run ? "good" : "warn"}
                />
                <SummaryStat
                  label="Wall-clock"
                  value={`${report.wall_seconds.toFixed(1)} s`}
                />
                <SummaryStat
                  label="SDK version · seed"
                  value={`${report.meta.sdk_version} · ${report.meta.seed}`}
                />
              </div>

              <div className="space-y-4">
                {tests.map((t) => (
                  <ProofRow key={t.name} test={t} />
                ))}
              </div>

              <div className="mt-16 rounded-xl border border-white/10 bg-white/[0.02] p-8">
                <p className="font-mono text-xs uppercase tracking-widest text-white/50 mb-3">
                  Reproduce locally
                </p>
                <pre className="text-sm text-white/80 font-mono overflow-x-auto">
{`pip install -e lo_core/ -e sdk/
python scripts/commercial_validation.py --iterations ${report.meta.iterations_requested}
cat data/validation/commercial_validation.json | jq .tests[].headline`}
                </pre>
                <p className="mt-4 text-xs text-white/40 font-mono">
                  source: {report.meta.btut_path} · generated {report.generated_at}
                </p>
              </div>

              <div className="mt-12 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/watchlist"
                  className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
                >
                  See today's top-50 flags
                </Link>
                <a
                  href="mailto:sales@latentocean.com?subject=Pilot%20report%20request"
                  className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
                >
                  Request a 48h pilot report →
                </a>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const accent =
    tone === "good" ? "text-li-green" : tone === "warn" ? "text-li-cyan" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <div className="text-xs font-mono uppercase tracking-widest text-white/50 mb-2">
        {label}
      </div>
      <div className={`font-display text-3xl tracking-tight tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  );
}

function ProofRow({ test }: { test: ValidationTest }) {
  const title = TEST_TITLES[test.name] ?? test.name;
  const objection = TEST_BUYER_OBJECTION[test.name];
  return (
    <div
      className={`rounded-xl border p-6 ${
        test.passed
          ? "border-white/10 bg-white/[0.02]"
          : "border-red-500/30 bg-red-500/5"
      }`}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-mono uppercase tracking-widest ${
                test.passed
                  ? "bg-li-green/15 text-li-green"
                  : "bg-red-500/20 text-red-300"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  test.passed ? "bg-li-green animate-pulse" : "bg-red-400"
                }`}
              />
              {test.passed ? "Pass" : "Fail"}
            </div>
            {objection && (
              <span className="text-xs font-mono text-white/40 italic">
                "{objection}"
              </span>
            )}
          </div>
          <h3 className="font-display text-2xl text-white tracking-tight mb-2">
            {title}
          </h3>
          <p className="text-sm text-white/60 mb-3 leading-relaxed">{test.description}</p>
          <div className="text-sm text-li-cyan font-mono tabular-nums">
            {test.headline}
          </div>
        </div>
      </div>
    </div>
  );
}
