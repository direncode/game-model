"use client";

import { useState, useMemo, useEffect } from "react";

/**
 * OceanWorkbench — the primary /console experience.
 *
 * One editor, one program, three protocols. Write OCEAN, run it, and the
 * same program is shown rendered as an MCP tool call, a Postgres
 * function call, and an HTTP curl. The point of the page is to make
 * the architectural pitch tangible: same language, three distribution
 * channels, identical semantics.
 *
 * Editor is a textarea (no Monaco dependency) — we want zero blocker
 * to landing this. Validation/format/run hit the local API when the
 * service is reachable; otherwise show a mocked structural response so
 * the page is useful even without the backend wired up.
 */

const EXAMPLES = [
  {
    name: "basic_run",
    label: "Basic pipeline",
    description: "Six lines. Load → embed → cluster → align → find dispersion → save.",
    source: `load tmp/bombe_tna_full.ndjson take 500 records balanced by archive
embed text into 128 dimensions using tf-idf
cluster for 16 rounds max 24 modules energy = corpus mean
align modules using 50 nearest records
find dispersion of each label
save to data/validation/run.json`,
  },
  {
    name: "seed_sweep",
    label: "Multi-seed stability",
    description: "Sweep 4 seeds in parallel branches. Reproducible across runs.",
    source: `seed 42

sweep s from 42 to 45 do
    load tmp/bombe_tna.ndjson take 500 records balanced by archive
    embed text into 128 dimensions
    cluster for 16 rounds max 24 modules energy = corpus mean
    align modules using 50 nearest records
    find dispersion of each label
    save to data/validation/seed_\${s}.json
end`,
  },
  {
    name: "anomaly_focused",
    label: "Anomaly-anchored",
    description: "Energy function pinned to a 'normal' label — for corpora with a privileged class.",
    source: `load data/cache/nsl_kdd.csv take 8000 records balanced by type label field is type
embed text into 64 dimensions using one-hot numeric
cluster for 16 rounds max 24 modules energy = normal anchored on normal
align modules using 50 nearest records
find dispersion of each label
save to data/validation/anomaly.json`,
  },
  {
    name: "compare",
    label: "Methodology compare",
    description: "Run two embedders on the same corpus, diff the results.",
    source: `load tmp/corpus.ndjson take 500 records balanced by archive as raw

compare
    embed text from raw into 128 dimensions using tf-idf
against
    embed text from raw into 128 dimensions using content fingerprint
on dispersion of directorate_to_pm`,
  },
  {
    name: "stdlib_call",
    label: "Stdlib invocation",
    description: "One-line call to a stdlib preset function with kwargs.",
    source: `import "stdlib/substrate.ocean" as substrate

substrate.basic_run(
    corpus = "tmp/corpus.ndjson",
    target = 500,
    embed_dim = 128,
)`,
  },
];

const PROTOCOLS = [
  { id: "mcp",      label: "MCP",      colorClass: "text-cyan-300" },
  { id: "postgres", label: "Postgres", colorClass: "text-amber-300" },
  { id: "http",     label: "HTTP",     colorClass: "text-emerald-300" },
] as const;

type ProtocolId = (typeof PROTOCOLS)[number]["id"];

function renderInvocation(protocol: ProtocolId, source: string): string {
  // Render the same OCEAN program as it would be invoked through each protocol.
  const escaped = source.replace(/`/g, "\\`");
  if (protocol === "mcp") {
    return `// MCP tool call (Claude Desktop / Cursor / Goose)
{
  "method": "tools/call",
  "params": {
    "name": "ocean_run",
    "arguments": {
      "source": ${JSON.stringify(source)}
    }
  }
}`;
  }
  if (protocol === "postgres") {
    return `-- Postgres / Aurora / AlloyDB / Cockroach / Yugabyte
SELECT ocean.run($$
${source.split("\n").map(l => "  " + l).join("\n")}
$$) AS run_result;`;
  }
  // HTTP
  return `# any HTTP-speaking caller — OpenAI Custom GPT, Gemini, n8n, curl
curl -X POST https://api.latentocean.com/v1/run \\
  -H 'Authorization: Bearer lo_pk_...' \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify({ source }).replace(/'/g, "\\'")}'`;
}

type RunResult = {
  ok:          boolean;
  error?:      string;
  timings?:    Array<{ step: string; kind: string; wall_s: number; sig: string }>;
  artifact_path?: string;
  artifact?:   any;
};

type ValidateResult = {
  ok:          boolean;
  diagnostics: Array<{ severity: string; line: number; col: number; message: string; suggestion?: string }>;
};

export function OceanWorkbench() {
  const [source, setSource] = useState(EXAMPLES[0].source);
  const [protocol, setProtocol] = useState<ProtocolId>("mcp");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [running, setRunning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [activeExample, setActiveExample] = useState(EXAMPLES[0].name);

  // Persisted API key — Bearer token used for premium operators.
  // Stored in localStorage so users don't have to paste it every session.
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = window.localStorage.getItem("ocean_api_key") || "";
    setApiKey(k);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (apiKey) window.localStorage.setItem("ocean_api_key", apiKey);
    else window.localStorage.removeItem("ocean_api_key");
  }, [apiKey]);

  // Probe the API once on mount
  useEffect(() => {
    fetch("/api/ocean/health", { cache: "no-store" })
      .then(r => setApiAvailable(r.ok))
      .catch(() => setApiAvailable(false));
  }, []);

  const invocation = useMemo(() => renderInvocation(protocol, source), [protocol, source]);

  const lineCount = source.split("\n").length;
  const charCount = source.length;

  const onValidate = async () => {
    setValidating(true);
    setValidateResult(null);
    try {
      if (apiAvailable) {
        const r = await fetch("/api/ocean/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ source }),
        });
        const data = await r.json();
        setValidateResult(data);
      } else {
        // Mocked structural response
        setValidateResult({
          ok: true,
          diagnostics: [],
        });
      }
    } catch (e) {
      setValidateResult({
        ok: false,
        diagnostics: [{ severity: "error", line: 1, col: 1, message: String(e) }],
      });
    } finally {
      setValidating(false);
    }
  };

  const onRun = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      if (apiAvailable) {
        const r = await fetch("/api/ocean/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ source }),
        });
        const data = await r.json();
        setRunResult(data);
      } else {
        // Mock: synthesize a plausible structural response
        await new Promise(res => setTimeout(res, 600));
        const lines = source.split("\n").filter(l => l.trim() && !l.trim().startsWith("#"));
        const stepCount = lines.length;
        setRunResult({
          ok: true,
          timings: [
            { step: "source",    kind: "source.ndjson",              wall_s: 0.04,  sig: "18cbaccb02f9230c" },
            { step: "embed",     kind: "embed.tfidf_jl",             wall_s: 1.79,  sig: "011011e78c772e45" },
            { step: "cluster",   kind: "cluster.tcd_recursive_loop", wall_s: 113.20, sig: "0c8f39083afed797" },
            { step: "align",     kind: "align.module",               wall_s: 0.01,  sig: "8adbd804f432cf84" },
            { step: "disperse",  kind: "align.dispersion",           wall_s: 0.01,  sig: "b7e108a8460703fa" },
            { step: "persist",   kind: "persist.json",               wall_s: 0.02,  sig: "dc977eb50a626d1c" },
          ].slice(0, Math.min(stepCount, 6)),
          artifact_path: "data/validation/run.json",
          artifact: { _mocked: true, modules_formed: 14, "_meta": { "note": "API unreachable; structural mock" } },
        });
      }
    } catch (e) {
      setRunResult({ ok: false, error: String(e) });
    } finally {
      setRunning(false);
    }
  };

  const totalWall = useMemo(
    () => runResult?.timings?.reduce((s, t) => s + t.wall_s, 0) ?? 0,
    [runResult]
  );

  return (
    <section className="relative px-6 py-12 border-t border-white/5">
      <div className="max-w-[1480px] mx-auto">
        {/* API status pill + key entry */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${
              apiAvailable === null ? "bg-white/30 animate-pulse" :
              apiAvailable          ? "bg-emerald-400" :
                                      "bg-amber-400"
            }`} />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">
              {apiAvailable === null
                ? "checking ocean api…"
                : apiAvailable
                  ? `ocean api · live${apiKey ? " · key configured" : " · free tier"}`
                  : "ocean api · unreachable · structural mock active"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
              API key
            </span>
            <input
              type={keyVisible ? "text" : "password"}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="lo_pk_…"
              className="font-mono text-[12px] bg-black border border-white/15 hover:border-white/30 focus:border-white/50 rounded px-3 py-1.5 text-white placeholder:text-white/25 focus:outline-none w-[200px]"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setKeyVisible(v => !v)}
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 hover:text-white border border-white/15 hover:border-white/30 rounded-full px-3 py-1.5 transition-colors"
              title={keyVisible ? "Hide" : "Show"}
            >
              {keyVisible ? "Hide" : "Show"}
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={() => setApiKey("")}
                className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 hover:text-rose-300 transition-colors"
                title="Clear key"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Editor + Examples */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Examples sidebar */}
          <aside className="lg:col-span-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              EXAMPLES · STDLIB
            </p>
            <div className="space-y-2">
              {EXAMPLES.map(ex => {
                const active = ex.name === activeExample;
                return (
                  <button
                    key={ex.name}
                    type="button"
                    onClick={() => { setSource(ex.source); setActiveExample(ex.name); setRunResult(null); setValidateResult(null); }}
                    className={`w-full text-left p-4 rounded-md border transition-colors ${
                      active
                        ? "border-white/30 bg-white/[0.06]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <p className={`font-mono text-[10px] uppercase tracking-[0.22em] mb-1 ${
                      active ? "text-emerald-300/80" : "text-white/45"
                    }`}>
                      {ex.name}
                    </p>
                    <p className="text-[13.5px] font-medium text-white/85 mb-1">{ex.label}</p>
                    <p className="text-[11.5px] leading-[1.45] text-white/45">{ex.description}</p>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Editor */}
          <div className="lg:col-span-9">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
                EDITOR · YOUR_PROGRAM.OCEAN
              </p>
              <p className="font-mono text-[10.5px] text-white/35 tabular-nums">
                {lineCount} lines · {charCount} chars
              </p>
            </div>
            <div className="border border-white/10 bg-black rounded-md overflow-hidden">
              <textarea
                value={source}
                onChange={e => setSource(e.target.value)}
                spellCheck={false}
                rows={Math.max(14, Math.min(28, lineCount + 2))}
                className="w-full bg-black text-emerald-200/95 font-mono text-[13px] leading-[1.55] px-5 py-4 focus:outline-none resize-y"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={onRun}
                disabled={running}
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-black bg-white hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-5 py-2.5 transition-colors"
              >
                {running ? "Running…" : "Run →"}
              </button>
              <button
                onClick={onValidate}
                disabled={validating}
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-white border border-white/30 hover:border-white/60 hover:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-5 py-2.5 transition-colors"
              >
                {validating ? "Validating…" : "Validate"}
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(source)}
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/65 hover:text-white border border-white/15 hover:border-white/40 rounded-full px-5 py-2.5 transition-colors"
              >
                Copy source
              </button>
            </div>
          </div>
        </div>

        {/* Validate result */}
        {validateResult && (
          <div className="mb-6 border border-white/10 bg-white/[0.02] rounded-md p-5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 mb-3">
              VALIDATE · {validateResult.diagnostics.length === 0 ? "CLEAN" : `${validateResult.diagnostics.length} DIAGNOSTIC(S)`}
            </p>
            {validateResult.diagnostics.length === 0 ? (
              <p className="font-mono text-[12.5px] text-emerald-300/85">✓ Type-checks. Compiles. Ready to run.</p>
            ) : (
              <ul className="space-y-2">
                {validateResult.diagnostics.map((d, i) => (
                  <li key={i} className="font-mono text-[12px]">
                    <span className="text-rose-300/85">{d.severity}</span>
                    <span className="text-white/45"> at line {d.line}, col {d.col}: </span>
                    <span className="text-white/85">{d.message}</span>
                    {d.suggestion && (
                      <div className="text-white/45 ml-4">→ {d.suggestion}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Run result */}
        {runResult && (
          <div className="mb-6 border border-white/10 bg-white/[0.02] rounded-md overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">
                RUN · {runResult.ok ? "COMPLETED" : "ERROR"}
              </p>
              {runResult.ok && (
                <p className="font-mono text-[10.5px] text-white/45 tabular-nums">
                  total: {totalWall.toFixed(2)} s
                </p>
              )}
            </div>
            {runResult.error ? (
              <pre className="p-5 font-mono text-[12px] text-rose-300/85 whitespace-pre-wrap">{runResult.error}</pre>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-white/45 uppercase tracking-[0.18em] text-[10px]">
                      <th className="text-left px-5 py-2 font-normal">Step</th>
                      <th className="text-left px-3 py-2 font-normal">Kind</th>
                      <th className="text-right px-3 py-2 font-normal">Wall (s)</th>
                      <th className="text-right px-5 py-2 font-normal">Sig</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runResult.timings?.map((t, i) => (
                      <tr key={i} className="border-b border-white/[0.06] last:border-0">
                        <td className="px-5 py-2 text-white/80">{t.step}</td>
                        <td className="px-3 py-2 text-white/55">{t.kind}</td>
                        <td className="px-3 py-2 text-right text-white/75 tabular-nums">{t.wall_s.toFixed(2)}</td>
                        <td className="px-5 py-2 text-right text-white/35 tabular-nums">{t.sig.slice(0, 12)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {runResult.artifact_path && (
                  <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
                    <p className="font-mono text-[11px] text-white/65">
                      artifact → <span className="text-emerald-300/85">{runResult.artifact_path}</span>
                    </p>
                    {runResult.artifact?._mocked && (
                      <p className="font-mono text-[10.5px] text-amber-300/80">structural mock</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Protocol invocation */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
              SAME PROGRAM · THREE PROTOCOLS
            </p>
            <div className="flex items-center gap-2">
              {PROTOCOLS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setProtocol(p.id)}
                  className={`font-mono text-[10.5px] uppercase tracking-[0.22em] px-4 py-2 rounded-full transition-colors ${
                    protocol === p.id
                      ? `${p.colorClass} bg-white/[0.08] border border-white/30`
                      : "text-white/55 border border-white/10 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <pre className="border border-white/10 bg-black rounded-md p-5 font-mono text-[12.5px] leading-[1.55] text-white/85 overflow-x-auto whitespace-pre">
{invocation}
          </pre>
          <p className="mt-3 font-mono text-[11px] text-white/45 leading-[1.5] max-w-[80ch]">
            Identical semantics across all three protocols. Same compiler. Same operator catalog. Same determinism contract — same seed + same input file = byte-identical output regardless of which protocol invoked it.
          </p>
        </div>
      </div>
    </section>
  );
}
