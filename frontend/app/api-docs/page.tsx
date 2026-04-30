import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "API · Latent Ocean",
  description: "Programmatic access to the Console. Form a private model from any corpus, query it deterministically, export audit logs in CEF or OCSF — all over a versioned HTTP surface.",
};

const ENDPOINTS = [
  { method: "POST", path: "/api/range-form", purpose: "Form a private model from a corpus path or inline text" },
  { method: "GET",  path: "/api/range-form", purpose: "List all formed models in your tenant" },
  { method: "GET",  path: "/api/range-form/[id]", purpose: "Retrieve the full formed-model artifact" },
  { method: "DELETE", path: "/api/range-form/[id]", purpose: "Revoke a formed model from the registry" },
  { method: "GET",  path: "/api/range-query", purpose: "Inquire of a formed model; deterministic answer with citations" },
  { method: "GET",  path: "/api/range-corpora", purpose: "List built-in corpora available on the appliance" },
  { method: "POST", path: "/api/range-integrate", purpose: "Run an integration emulation against a representative payload" },
  { method: "GET",  path: "/api/range-audit", purpose: "Retrieve audit log entries; CEF / OCSF / JSON formats" },
  { method: "GET",  path: "/api/range-identity", purpose: "Probe the current caller identity + crypto posture" },
  { method: "POST", path: "/api/range-auth/issue", purpose: "Mint a tenant-scoped bearer token (admin only)" },
  { method: "GET",  path: "/api/range-auth/verify", purpose: "Probe a bearer token's validity and claims" },
];

export default function ApiPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-32 pb-32">
        {/* Hero */}
        <section className="relative px-6 border-b border-white/5 pb-24">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-5">
              API · v1
            </p>
            <h1 className="font-display font-medium text-[clamp(56px,9vw,128px)] leading-[0.92] tracking-[-0.045em] text-white max-w-5xl">
              The Console,<br />
              <span className="text-white/45">over HTTP.</span>
            </h1>
            <p className="mt-8 text-lg text-white/65 max-w-3xl leading-snug">
              Every action a human takes from the workbench is also an HTTP
              call. Form a model. Query a model. Export an audit log. Mint
              a token. Stream a registry. The surface is intentionally
              thin, deterministic, and tenant-scoped.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/console" className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
                Open the workbench
              </Link>
              <a href="#quickstart" className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/20 text-white/85 text-[13px] hover:text-white hover:border-white/35 transition-colors">
                Read the quickstart
              </a>
            </div>
          </div>
        </section>

        {/* Quickstart */}
        <section id="quickstart" className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Quickstart · 60 seconds
            </p>
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-10">
              Three calls.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CodeCard
                index="01"
                label="form"
                code={`curl -X POST https://latentocean.com/api/range-form \\
  -H "Content-Type: application/json" \\
  -d '{
    "corpus_path": "/data/cache/nsl_kdd_train.txt",
    "name": "Q4 telemetry"
  }'

# -> { "id": "rng_3572af11e67a...", "fingerprinter_mode": "btut", ... }`}
              />
              <CodeCard
                index="02"
                label="query"
                code={`curl "https://latentocean.com/api/range-query\\
?model_id=rng_3572af11e67a...\\
&q=what+is+the+most+rare"

# -> { "answer": "...", "citations": [...], "response_digest": "sha256:..." }`}
              />
              <CodeCard
                index="03"
                label="audit"
                code={`curl "https://latentocean.com/api/range-audit?format=cef" \\
  -H "Authorization: Bearer rng.eyJ..." \\
  > range-audit.cef

# -> CEF stream ready for ArcSight / QRadar / Splunk ingest`}
              />
            </div>
          </div>
        </section>

        {/* Authentication */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1280px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-16">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
                  Authentication
                </p>
                <h2 className="font-display font-medium text-4xl md:text-5xl tracking-[-0.035em] text-white mb-6">
                  Internal HMAC.
                </h2>
                <p className="text-[15.5px] text-white/65 leading-snug max-w-md">
                  No third-party SDK, no external IdP dependency. Tokens are
                  signed by the appliance's own master secret. Pass the
                  bearer on every call.
                </p>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Token shape</span>
                    <span className="font-mono text-[10px] text-white/35">rng.&lt;b64url(payload)&gt;.&lt;b64url(hmac)&gt;</span>
                  </div>
                  <pre className="p-5 text-[12.5px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{`{
  "v":         1,
  "user_id":   "jane@acme",
  "tenant_id": "tenant_acme",
  "role":      "operator",   // viewer | operator | admin
  "iat":       1777600000000,
  "exp":       1780192000000,
  "kid":       "f9e96c7f8aa7"
}`}
                  </pre>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">Authorization header</span>
                  </div>
                  <pre className="p-5 text-[12.5px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{`Authorization: Bearer rng.eyJ2IjoxLCJ1c2VyX2lkIjoiamFu...`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Endpoint catalog */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1280px] mx-auto">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
              Endpoints · v1
            </p>
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-10">
              The full surface.
            </h2>
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0a0a0a]">
              <div className="grid grid-cols-[80px_1fr_1.4fr] px-5 py-3 border-b border-white/10 bg-white/[0.02] font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
                <div>Method</div>
                <div>Path</div>
                <div>Purpose</div>
              </div>
              {ENDPOINTS.map((e) => (
                <div key={e.method + e.path} className="grid grid-cols-[80px_1fr_1.4fr] px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <div className={`font-mono text-[11px] uppercase tracking-[0.18em] ${
                    e.method === "POST" ? "text-white" : e.method === "DELETE" ? "text-white/55" : "text-white/65"
                  }`}>{e.method}</div>
                  <div className="font-mono text-[12.5px] text-white/85 truncate">{e.path}</div>
                  <div className="text-[13px] text-white/55 leading-snug">{e.purpose}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 font-mono text-[11px] text-white/35 leading-relaxed">
              All endpoints are tenant-scoped. The same call from two different
              tenants returns two different result sets, with two different
              <span className="text-white/55"> response_digest</span>s.
            </p>
          </div>
        </section>

        {/* Determinism contract */}
        <section className="relative px-6 py-24 border-b border-white/5">
          <div className="max-w-[1280px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45 mb-4">
                  Determinism contract
                </p>
                <h2 className="font-display font-medium text-4xl md:text-5xl tracking-[-0.035em] text-white mb-6">
                  Same input, byte-identical output. Forever.
                </h2>
                <p className="text-[15.5px] text-white/65 leading-snug">
                  Every response carries a sha256-canonicalized
                  <span className="text-white/85"> response_digest</span>. Re-issue
                  the same call against the same model and the digest is byte-
                  identical, on any appliance, in any decade. The contract is
                  enforced by CI on every commit; it is the single load-
                  bearing claim of the platform.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">verify</span>
                </div>
                <pre className="p-5 text-[12.5px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{`# inquire twice; verify byte-identical digest
A=$(curl -s "$URL/api/range-query?model_id=$M&q=$Q" \\
    | jq -r .response_digest)
B=$(curl -s "$URL/api/range-query?model_id=$M&q=$Q" \\
    | jq -r .response_digest)
[ "$A" = "$B" ] && echo "deterministic ok"

# observable on the wire:
#   x-range-digest: sha256:8571c974391da627...
#   x-range-seed:   42`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="relative px-6 py-24">
          <div className="max-w-[1280px] mx-auto text-center">
            <h2 className="font-display font-medium text-4xl md:text-6xl tracking-[-0.035em] text-white mb-6">
              Form a model.
            </h2>
            <p className="text-lg text-white/55 max-w-2xl mx-auto mb-8 leading-snug">
              The full API is exercised on every workbench page. Open it,
              watch the network panel, copy the calls into your stack.
            </p>
            <Link href="/console" className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
              Open the workbench
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function CodeCard({ index, label, code }: { index: string; label: string; code: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
          {index} · {label}
        </span>
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
        </div>
      </div>
      <pre className="p-5 text-[12px] font-mono text-white/85 overflow-x-auto leading-relaxed whitespace-pre">
{code}
      </pre>
    </div>
  );
}
