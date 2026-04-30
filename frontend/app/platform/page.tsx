import Link from "next/link";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

// Deep-dive on the primitive itself. Not a product page; a data-type page.
// Every statement here should be true of the primitive regardless of what
// corpus it's applied to.

export default function PlatformPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Nav />
      <main className="pt-28 pb-32">
        <div className="max-w-[1100px] mx-auto px-6">
          {/* Hero */}
          <header className="mb-20 text-center">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/45 mb-4">
              The primitive · a data type, not a product
            </p>
            <h1 className="font-display font-medium text-5xl md:text-7xl tracking-[-0.035em] text-white leading-[0.95]">
              Structural fingerprints.<br />
              <span className="text-white/40">A first-class column.</span>
            </h1>
            <p className="mt-8 text-lg md:text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
              Every row that passes through Latent Ocean acquires two
              deterministic columns: a <span className="text-li-cyan">48-bit structural
              fingerprint</span> and a <span className="text-li-cyan">4-dimensional score
              vector</span>. The fingerprint locates the row in a compressed
              representation of its universe. The score vector reports how
              structurally unusual that location is. Both are reproducible at
              bit level under a fixed seed.
            </p>
          </header>

          {/* What it is */}
          <section className="mb-20">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-white mb-6">
              What it is
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-3">
                  The fingerprint
                </div>
                <p className="text-sm text-white/80 leading-relaxed mb-4">
                  48 bits. Deterministic rotation-ensemble hash of the row's
                  structured attributes. Two rows whose signatures are close in
                  Hamming distance are structurally similar. Two rows whose
                  signatures are far apart are structurally divergent.
                </p>
                <pre className="text-xs font-mono text-white/60 bg-black/40 p-3 rounded whitespace-pre-wrap break-all">
lo_fp: bit(48) = &apos;111011100110110011010101000111011101011010011101&apos;</pre>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-3">
                  The score vector
                </div>
                <p className="text-sm text-white/80 leading-relaxed mb-4">
                  Four dimensions. Each is a normalized [0, 1] measurement
                  against the rolling universe. The composite is a fixed
                  weighted combination: 0.40·reconstruction + 0.35·diversity +
                  0.25·anomaly.
                </p>
                <pre className="text-xs font-mono text-white/60 bg-black/40 p-3 rounded">
{`lo_score: {
  composite:      0.859,
  anomaly:        1.000,
  reconstruction: 0.804,
  diversity:      0.815
}`}</pre>
              </div>
            </div>
          </section>

          {/* What it replaces */}
          <section className="mb-20">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-white mb-6">
              What it replaces
            </h2>
            <div className="rounded-xl border border-li-cyan/20 bg-li-cyan/[0.03] p-8">
              <p className="text-lg text-white/85 leading-relaxed">
                The bespoke "anomaly detection project" that every data team
                runs quarterly: weeks of feature engineering, a handwritten
                classifier, one-off dashboards, no null test, no reproducibility
                across runs, no survival across team handovers, no answer when
                compliance asks "prove this isn't noise."
              </p>
              <p className="mt-4 text-sm text-white/60 font-mono">
                That project collapses into two generated columns and one
                function call.
              </p>
            </div>
          </section>

          {/* Operations */}
          <section className="mb-20">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-white mb-6">
              Operations on the primitive
            </h2>
            <div className="space-y-4">
              <Op
                title="Rank"
                code="SELECT id FROM rows ORDER BY (lo_score -> 'composite')::float DESC LIMIT 100;"
                explain="Top-100 structural outliers. No model training, no labelled data."
              />
              <Op
                title="Filter"
                code="SELECT * FROM rows WHERE (lo_score -> 'composite')::float > 0.85;"
                explain="Structural anomalies above p85 become a WHERE clause."
              />
              <Op
                title="Peer-rank"
                code="SELECT id, percent_rank() OVER (PARTITION BY peer_group ORDER BY composite) FROM rows;"
                explain="Every row knows where it sits in its peer window, as a SQL column."
              />
              <Op
                title="Drift"
                code="SELECT hamming(lo_fp, lag(lo_fp) OVER (PARTITION BY id ORDER BY t)) AS shift FROM rows;"
                explain="Fingerprint drift over time — compliance-grade structural change detection."
              />
              <Op
                title="Null-test"
                code="SELECT lo_null_test('rows', dims => ARRAY['composite'], iterations => 500);"
                explain="Returns {z_score, p_value, seed}. The entire universe's rankings become falsifiable on demand."
              />
              <Op
                title="Cross-universe bridge"
                code="SELECT a.id, b.id FROM rows_a a JOIN rows_b b ON hamming(a.lo_fp, b.lo_fp) < 8;"
                explain="Entities from unrelated universes share a structural neighborhood — the basis for cross-domain discovery."
              />
            </div>
          </section>

          {/* Why a primitive */}
          <section className="mb-20">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-white mb-6">
              Why call it a primitive
            </h2>
            <p className="text-white/70 leading-relaxed mb-6">
              A data primitive is a type the rest of the data platform learns to
              treat as first-class: it gets its own column type, its own
              operators, its own indexes, its own ecosystem of queries. Vector
              embeddings became one between 2020 and 2023 — `pgvector`,
              Pinecone, Weaviate, Milvus, Qdrant all exist because a
              vector-of-floats became a default.
            </p>
            <p className="text-white/70 leading-relaxed mb-6">
              Structural fingerprints have properties that embeddings do not
              and that regulated / high-stakes data buyers specifically ask for:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Property
                left="Embeddings"
                right="Structural fingerprint"
                row={[
                  ["Non-deterministic (GPU + fp16)", "Deterministic (seed=42, SHA-256 identical)"],
                  ["Hundreds to thousands of floats", "48 bits"],
                  ["Similarity is real-valued, not auditable", "Hamming distance is an integer anyone can recompute"],
                  ["No native null test", "Null permutation ships with the primitive"],
                  ["Requires an embedding model runtime", "Pure arithmetic; runs offline"],
                  ["Drifts when the model is retrained", "Identical output forever under the same seed"],
                ]}
              />
            </div>
          </section>

          {/* Full-spectrum engine */}
          <section className="mb-20">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-white mb-6">
              The full-spectrum engine
            </h2>
            <p className="text-white/70 leading-relaxed mb-8">
              The primitive is the tip. The full system is two engines
              operating on the same deterministic pipeline: the fingerprint
              substrate below, the research layer above. Both ship. Both are
              air-gap capable. Both are seed-42 reproducible.
            </p>
            <div className="space-y-4">
              <div className="rounded-xl border border-li-cyan/25 bg-li-cyan/[0.03] p-6">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-display text-2xl text-white">BTUT</div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-li-cyan">
                    Substrate layer · the primitive
                  </div>
                </div>
                <div className="text-sm text-white/80 leading-relaxed mb-3">
                  Bit-True Unit Tuner. Rotation-ensemble lattice fingerprinting
                  with stratified survivor selection and cluster-cap
                  enforcement. 48-bit fingerprint + 4-dim score vector per row.
                  Deterministic. Reproducible at SHA-256 bit level. Offline.
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono">
                  <Chip label="Input" value="any row-shape" />
                  <Chip label="Output" value="bit(48) + ScoreVec" />
                  <Chip label="Determinism" value="seed=42" />
                  <Chip label="Ops / entity" value="~0.15 ms on c6i.4xlarge" />
                </div>
              </div>

              <div className="rounded-xl border border-li-green/25 bg-li-green/[0.03] p-6">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-display text-2xl text-white">lo_core</div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-li-green">
                    Query layer · analyzers
                  </div>
                </div>
                <div className="text-sm text-white/80 leading-relaxed mb-3">
                  The deterministic query surface that sits on top of BTUT:
                  cross-dimensional convergence, cross-era bridges, null-test
                  orchestration, paradigm distribution, narrative templates.
                  Shipped as `pip install lo-core` and as SQL UDFs per database.
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono">
                  <Chip label="CLI" value="lo analyze / validate / narrate" />
                  <Chip label="API" value="/api/v1/lo/*" />
                  <Chip label="Null test" value="N=500+ permutations" />
                  <Chip label="Narratives" value="deterministic templates" />
                </div>
              </div>

              <div className="rounded-xl border border-white/25 bg-white/[0.03] p-6">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-display text-2xl text-white">TCD-JEPA</div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-white/70">
                    Research layer · module crystallization
                  </div>
                </div>
                <div className="text-sm text-white/80 leading-relaxed mb-3">
                  Three-system architecture on top of the BTUT survivor space:
                  Stream Encoder instruments information flow, Energy Explorer
                  runs Langevin dynamics over the energy landscape, Module
                  Crystallizer applies <em>persistent homology</em> to
                  exploration trajectories — identifying stable topological
                  features and instantiating them as reusable predictor
                  modules. This is where new predictive capabilities
                  <em> emerge</em> from the system exploring what it does not
                  yet know.
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono">
                  <Chip label="System 1" value="Stream Encoder (ViT + EMA)" />
                  <Chip label="System 2" value="Energy Explorer (Langevin)" />
                  <Chip label="System 3" value="Crystallizer (H₀, H₁, H₂)" />
                  <Chip label="Loop" value="recursive capability growth" />
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-lg border border-white/10 bg-[#0a0a10] p-5">
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-2">
                What the three tiers do together
              </div>
              <div className="text-sm text-white/70 leading-relaxed">
                BTUT compresses any corpus into a fingerprint lattice.
                lo_core asks the first-class questions (rank, filter, null,
                bridge, drift). TCD-JEPA asks what lo_core hasn't learned to
                ask yet — and when its topology stabilizes, that new question
                becomes a new lo_core operator. The pipeline grows its own
                query surface. That's the full spectrum.
              </div>
            </div>
          </section>

          {/* Where it runs */}
          <section className="mb-20">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-white mb-6">
              Where it runs
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                ["Postgres", "pg_latentocean extension"],
                ["Snowflake", "external function (lo_score)"],
                ["MongoDB Atlas", "$lo aggregation stage"],
                ["BigQuery", "SQL UDF (lo_fingerprint)"],
                ["Databricks", "Unity-Catalog UDF"],
                ["Kafka / Kinesis / Pulsar", "streaming fingerprint per message"],
                ["S3 / GCS / Azure Blob", "parquet batch mode"],
                ["Air-gap / FedRAMP IL6", "on-prem Python CLI + REST API"],
                ["Excel", "=LO.SCORE(ticker)"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="font-mono text-sm text-white">{k}</div>
                  <div className="text-[11px] font-mono text-white/50 mt-1">{v}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Proof */}
          <section className="mb-20">
            <h2 className="font-display text-3xl md:text-4xl tracking-tight text-white mb-6">
              Validated across 15 unrelated data types
            </h2>
            <p className="text-white/70 leading-relaxed mb-6">
              If the primitive only worked because of a tuned constant for any
              one data type, it would fail on the others. It does not. See{" "}
              <Link href="/universal" className="text-li-cyan hover:text-li-cyan/80">
                /universal
              </Link>{" "}
              for the live grid, and{" "}
              <Link href="/validation" className="text-li-cyan hover:text-li-cyan/80">
                /validation
              </Link>{" "}
              for the commercial 7/7 proof run in 16.5 seconds.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["SEC XBRL filings", "z=23.04σ"],
                ["Physics patents", "z=30.37σ"],
                ["NOAA climate series", "z=27.77σ"],
                ["UN Comtrade flows", "z=25.95σ"],
                ["PubMed biomedical", "z=21.30σ"],
                ["USPTO patent abstracts", "z=20.99σ"],
                ["Polymath biographies", "z=29.94σ"],
                ["Historical language", "z=29.72σ"],
              ].map(([dom, z]) => (
                <div
                  key={dom}
                  className="rounded-lg border border-li-green/25 bg-li-green/[0.03] p-3 text-center"
                >
                  <div className="text-xs font-mono text-white/90">{dom}</div>
                  <div className="text-li-green font-mono text-sm tabular-nums mt-1">{z}</div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="mailto:sales@latentocean.com?subject=Platform%20install"
                className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
              >
                Install the primitive on your database
              </a>
              <Link
                href="/live"
                className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 text-sm transition-colors"
              >
                Watch it run on public feeds
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Op({ title, code, explain }: { title: string; code: string; explain: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a10] p-5">
      <div className="flex items-baseline justify-between mb-2">
        <div className="font-mono text-sm text-li-cyan">{title}</div>
        <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
          Primitive operation
        </div>
      </div>
      <pre className="text-[12px] font-mono text-white/85 overflow-x-auto mb-3 whitespace-pre">
{code}
      </pre>
      <div className="text-xs text-white/60">{explain}</div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white/40">{label}</div>
      <div className="text-white/90 truncate">{value}</div>
    </div>
  );
}

function Property({
  left,
  right,
  row,
}: {
  left: string;
  right: string;
  row: [string, string][];
}) {
  return (
    <div className="col-span-full rounded-xl border border-white/10 overflow-hidden">
      <div className="grid grid-cols-2 bg-white/[0.03] border-b border-white/10">
        <div className="p-4 font-mono text-sm text-white/60 border-r border-white/10">{left}</div>
        <div className="p-4 font-mono text-sm text-li-cyan">{right}</div>
      </div>
      {row.map(([l, r], i) => (
        <div key={i} className="grid grid-cols-2 border-b border-white/[0.04] last:border-b-0">
          <div className="p-4 text-sm text-white/60 border-r border-white/[0.06]">{l}</div>
          <div className="p-4 text-sm text-white/85">{r}</div>
        </div>
      ))}
    </div>
  );
}
