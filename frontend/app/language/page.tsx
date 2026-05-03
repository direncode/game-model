import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "OCEAN Language · Latent Ocean",
  description:
    "OCEAN — typed, declarative, deterministic programming language for substrate-clustering pipelines. Lexer, parser, type checker, compiler, REPL, formatter, linter, doc-gen, LSP, FFI, macros. 45 conformance tests, all passing.",
};

export default function LanguagePage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32">
        <section className="px-6 pb-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-6">
              THE OCEAN LANGUAGE · v1.1
            </p>
            <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold tracking-[-0.025em] leading-[1.05] mb-8 max-w-[20ch]">
              A small typed language for substrate-clustering pipelines.
            </h1>
            <p className="text-[17px] leading-[1.65] text-white/65 max-w-[60ch] mb-6">
              OCEAN is a domain-specific programming language. Same family as SQL, HCL, dbt — declarative, statically typed, formally specified, deterministic. Programs always terminate. Programs always type-check. Programs at the same seed against the same input file contents produce byte-identical artifacts.
            </p>
            <p className="text-[15.5px] leading-[1.65] text-white/55 max-w-[60ch]">
              English-flavored grammar so non-engineers can read it. Hand-written lexer, recursive-descent parser, type system with inference, compiler that emits an operator-DAG, runner that executes deterministically. Plus REPL, formatter, linter, doc-gen, LSP, FFI, macros, conformance suite.
            </p>
          </div>
        </section>

        {/* Code sample */}
        <section className="px-6 py-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/80 mb-4">
                A FULL PIPELINE · 6 LINES
              </p>
              <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-6">
                English in. DAG out. The compiler does the rest.
              </h2>
              <p className="text-[15.5px] leading-[1.65] text-white/65 mb-6">
                Each verb invokes a registered operator. The compiler resolves the implicit data flow: <code className="font-mono text-[13.5px] text-emerald-200">load</code> produces <code className="font-mono text-[13.5px] text-emerald-200">Records</code>, <code className="font-mono text-[13.5px] text-emerald-200">embed</code> consumes them and produces <code className="font-mono text-[13.5px] text-emerald-200">Z</code>, <code className="font-mono text-[13.5px] text-emerald-200">cluster</code> consumes <code className="font-mono text-[13.5px] text-emerald-200">Z</code> and produces <code className="font-mono text-[13.5px] text-emerald-200">Modules</code>, and so on. Type errors at compile time, with file:line:col + a caret + a suggestion.
              </p>
              <p className="text-[15px] leading-[1.55] text-white/45">
                The same six lines compile to the same DAG that runs through the MCP server, the Postgres extension, and the HTTP API. One language, three protocols.
              </p>
            </div>
            <div className="lg:col-span-7 font-mono text-[12.5px] leading-[1.7] text-white/85 bg-white/[0.03] border border-white/10 rounded-md p-7 overflow-x-auto">
              <p className="text-white/40 mb-2"># tna.ocean</p>
              <pre className="whitespace-pre-wrap text-emerald-200/90">{`require ocean 1.0
seed 42

load tmp/bombe_tna_full.ndjson take 500 records balanced by archive
embed text into 128 dimensions using tf-idf
cluster for 16 rounds max 24 modules energy = corpus mean
align modules using 50 nearest records
find dispersion of each label
save to data/validation/tna_run.json`}</pre>
              <p className="text-white/40 mt-7 mb-2"># with stdlib</p>
              <pre className="whitespace-pre-wrap text-emerald-200/90">{`import "stdlib/substrate.ocean" as substrate

substrate.basic_run(
    corpus = "tmp/corpus.ndjson",
    target = 500,
    embed_dim = 128,
)`}</pre>
            </div>
          </div>
        </section>

        {/* Feature inventory */}
        <section className="px-6 py-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              FEATURE INVENTORY · v1.1
            </p>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-12 max-w-[28ch]">
              Everything a real language has. Nothing it doesn&apos;t need.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[1200px]">
              {[
                {
                  cat: "Syntax",
                  items: [
                    "8 verbs (load, embed, reduce, cluster, align, find, narrate, save)",
                    "Let-bindings with optional type annotation",
                    "Sweep blocks (parametric expansion)",
                    "If / elif / else (constant-folded)",
                    "Match / case / when with guards",
                    "Try / catch / throw",
                    "Spawn / join (DAG-native concurrency)",
                    "Define functions with default args",
                  ],
                },
                {
                  cat: "Type system",
                  items: [
                    "12 primitive types incl. Records, Z, Modules, Aligned, Dispersion",
                    "Subtyping (Aligned <: Modules)",
                    "Generics (T<U> in annotations)",
                    "Constructor patterns: ok(x), err(msg), some(v), none",
                    "Static inference",
                    "Type errors with caret + suggestion",
                  ],
                },
                {
                  cat: "Tooling",
                  items: [
                    "Compiler + runner (CLI)",
                    "REPL with :compile, :run, :type",
                    "Formatter (canonical pretty-print)",
                    "Linter (style + dead-code)",
                    "Doc-gen (Markdown reference from ## comments)",
                    "LSP server (JSON-RPC stdio)",
                    "FFI (extern fn name(...) -> T impl python:mod.func)",
                    "Macros (quote / unquote AST manipulation)",
                  ],
                },
                {
                  cat: "Stdlib",
                  items: [
                    "basic_run — simplest end-to-end pipeline",
                    "seed_sweep — multi-seed stability study",
                    "anomaly_focused — for label-anchored corpora",
                    "content_vs_structural — methodology comparison",
                  ],
                },
                {
                  cat: "Determinism",
                  items: [
                    "File content sha256 baked into source signatures",
                    "Compile-time constant folding",
                    "Deterministic sweep expansion",
                    "Operators are pure functions (input + seed → output)",
                    "Two runs at same seed + same file = byte-identical artifact",
                  ],
                },
                {
                  cat: "Conformance",
                  items: [
                    "45 tests passing — 36 language conformance + 9 MCP smoke tests",
                    "Lex / parse / typecheck / compile / error coverage",
                    "Runs in 0.6 sec on a laptop",
                  ],
                },
              ].map(g => (
                <div key={g.cat} className="border border-white/10 bg-white/[0.02] p-6 rounded-md">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-emerald-300/80 mb-4">{g.cat}</p>
                  <ul className="space-y-2 text-[13.5px] leading-[1.55] text-white/65">
                    {g.items.map(it => <li key={it}>• {it}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Where it sits */}
        <section className="px-6 py-24 border-b border-white/5">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              WHERE IT SITS
            </p>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-[-0.02em] leading-[1.1] mb-10 max-w-[28ch]">
              Same family as SQL. Different domain.
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[14px] text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/15">
                    <th className="py-3 pr-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 font-medium">Language</th>
                    <th className="py-3 px-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 font-medium">Domain</th>
                    <th className="py-3 px-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 font-medium">Typed?</th>
                    <th className="py-3 px-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 font-medium">Determinism</th>
                    <th className="py-3 pl-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55 font-medium">Turing-complete</th>
                  </tr>
                </thead>
                <tbody className="text-white/75">
                  {[
                    ["SQL",     "Relational queries",          "Yes",    "Mostly",     "No"],
                    ["HCL",     "Infrastructure-as-code",      "Yes",    "Yes",        "No"],
                    ["dbt",     "Analytics engineering",       "Partial","Yes",        "No"],
                    ["Python",  "General-purpose",             "Optional","No",        "Yes"],
                    ["Rust",    "Systems programming",         "Yes",    "No",         "Yes"],
                    ["OCEAN",   "Substrate clustering",        "Yes",    "Strict (file-content-pinned)",  "No (intentional)"],
                  ].map((r, i) => (
                    <tr key={i} className={`border-b border-white/[0.06] ${r[0] === "OCEAN" ? "bg-white/[0.03] text-white" : ""}`}>
                      <td className="py-3 pr-6 font-mono text-[13.5px]">{r[0]}</td>
                      <td className="py-3 px-6">{r[1]}</td>
                      <td className="py-3 px-6">{r[2]}</td>
                      <td className="py-3 px-6">{r[3]}</td>
                      <td className="py-3 pl-6">{r[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Climb */}
        <section className="px-6 py-24">
          <div className="max-w-[1400px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              KEEP GOING
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/protocols" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                Layer 1 — Protocols →
              </Link>
              <Link href="/build" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                Layer 2 — Build →
              </Link>
              <Link href="/silicon" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                Layer 3 — Silicon →
              </Link>
              <Link href="/gallery" className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 hover:text-white border border-white/30 hover:border-white px-5 py-3 rounded-full">
                Gallery of Programs →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
