# LatentOcean — business framing

*Three-layer architecture, protocol distribution, no client-services framing.
Internal-strategy document.*

---

## The three layers

```
                         Layer 3 — Hardware compound
                         ┌─────────────────────────┐
                         │   SPU chiplet            │
                         │   90× energy efficiency  │
                         │   compounds Layers 1+2   │
                         └─────────────────────────┘
                                      ▲
                                      │ accelerates every call below
                                      │
        ┌─────────────────────────────────────────────────────────────┐
        │   Layer 2 — System buildout                                  │
        │   ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐│
        │   │ Universal    │  │ Bespoke contract │  │ Individual     ││
        │   │ extension    │  │ buildouts for    │  │ system-builders││
        │   │ (HTTP/SDKs/  │  │ massive systems  │  │ using OCEAN as ││
        │   │  CLI)        │  │ (our stack only) │  │ their substrate││
        │   └──────────────┘  └──────────────────┘  └────────────────┘│
        └─────────────────────────────────────────────────────────────┘
                                      ▲
                                      │ all consume Layer 1 protocols
                                      │
        ┌─────────────────────────────────────────────────────────────┐
        │   Layer 1 — Protocol distribution                            │
        │   ┌──────────────────────┐    ┌────────────────────────────┐│
        │   │ MCP server           │    │ Postgres extension         ││
        │   │ Anthropic's protocol │    │ PL/Python in any Postgres- ││
        │   │ for AI agent stacks  │    │ compatible database        ││
        │   └──────────────────────┘    └────────────────────────────┘│
        └─────────────────────────────────────────────────────────────┘
```

Each layer multiplies the layers below.
Each layer reaches a different audience without LatentOcean operating customer-facing services.

---

## Layer 1 — Protocol distribution

The minimum viable channels. Anything that wants OCEAN as infrastructure
implements one or both of these and they get full access.

| Channel | Built? | Reaches |
|---|---|---|
| **MCP server** (`scripts/operators/ocean/mcp.py`) | ✅ shipping, 9 smoke tests passing | Every Claude / Cursor / Goose / Continue.dev / hyperscaler agent runtime / internal AI tooling |
| **Postgres extension** (`scripts/integrations/postgres/ocean_pg.sql`) | ✅ shipping (PL/Python) | Postgres + Aurora + AlloyDB + CockroachDB + Yugabyte + Supabase + Neon + TimescaleDB |

Both speak the same operator catalog. Both are open-source-installable.
Both convert to paid usage when premium operators (BTUT, TCD-JEPA,
content_fp48, dispersion) are invoked — that's the metering hook.

## Layer 2 — System buildout

Three sub-channels for actually consuming the protocols. They all read/write
the same OCEAN programs and call the same operators; they differ in *who*
is doing the integration and *how* customized it gets.

### 2a — Universal extension (HTTP / SDKs / CLI)

`scripts/integrations/http/ocean_api.py` — full FastAPI service speaking
OpenAPI 3.1 with auto-discovery at `/docs`. Endpoints for compile,
validate, run, format, lint, operator catalog, stdlib browsing.

Reach: any HTTP-speaking caller. OpenAI Custom GPTs / Gemini tools /
Mistral function-calling / generic webhooks / `curl` from a shell.

Auth: API key via Bearer header. Free tier for free-tier operators,
premium key required for proprietary operators.

This is the "extension focused for all of it" surface — the universal
interface anyone writes to, regardless of their existing stack.

### 2b — Bespoke contract buildouts (massive systems only)

The ONLY engagement-style work LatentOcean does. Strict rules:

| Rule | Why |
|---|---|
| Only for massive systems | Below ~$10M ARR / ~10 PB-scale data, customers should self-serve via Layer 1 |
| Only using OCEAN + operators + (eventually) SPU as the backend | We don't write generic software. We write integrations of our stack. |
| Contract basis with defined deliverable | Not ongoing managed services. Build it, hand it over, exit. |
| Customer takes ownership of operations | We don't run their pipelines. They run them on our protocols. |
| Output is reusable infrastructure | Each contract widens the moat; nothing is throwaway-bespoke |

Comparable: Palantir's Foundry deployments — but with a much narrower
scope (just the substrate-clustering layer, not the whole data platform).

Customer profile: hyperscalers, sovereign AI builds, large intel/defense
agencies, top-10 banks, top-50 research institutions. Few accounts, large
contracts, well-defined integration scope.

### 2c — Individual system-building

Devs and analysts use OCEAN as their substrate when they build their own
products. We don't sell them anything beyond the language; the language
is free. They generate revenue when they upgrade to premium operators
via the API key gating in Layer 1.

This is the **PostgreSQL adoption pattern**: the database is free, the
hosted service / extensions / commercial support generate revenue.

## Layer 3 — Hardware compound

The SPU chiplet (`docs/SPU_ARCHITECTURE.md` + `scripts/spu/simulator.py`).
80 mm² TSMC N5 chiplet, 20 W TDP, 90× energy efficiency over H100 on the
substrate-clustering workload class.

The chiplet doesn't *replace* anything in Layers 1 or 2. It **multiplies
their economics**:

| Without SPU | With SPU |
|---|---|
| Premium operators run on customer's CPU/GPU; slow + expensive | Premium operators run on SPU; 90× more energy-efficient |
| Per-call billing reflects compute cost | Per-call billing has 90× margin headroom |
| Bespoke buildouts are software-only | Bespoke buildouts include silicon, harder to displace |
| Individual users hit GPU $/hour ceiling | Individual users hit SPU pricing, much more accessible |

Path to silicon:
- FPGA prototype: 3-4 months, $20-100K
- TSMC MPW chiplet: 9-12 months, $1-3M
- Full custom 5nm: 18-24 months, $30M+

Critically, **the chiplet justifies the entire stack** at scale. Without
silicon advantage, we're a software company that loses on margin to
NVIDIA-hosted alternatives. With it, we're vertically integrated like
Apple Silicon — language, runtime, and silicon all designed for the
same workload class.

---

## Revenue mechanics — what gets paid

| Layer | Revenue type | Margin profile |
|---|---|---|
| Layer 1 — MCP | Per-call billing on premium operators (free language + free reference operators) | Cloud-margin |
| Layer 1 — Postgres extension | Same per-call model + self-hosted licensing for on-prem premium operators | Cloud-margin or enterprise-license-margin |
| Layer 2a — HTTP/SDK | Same per-call model | Cloud-margin |
| Layer 2b — Bespoke buildouts | Fixed-price contract + ongoing license for the integration's runtime | Project-margin (high) |
| Layer 2c — Individuals | Free language → paid hosted operators when they want to use BTUT/TCD | Conversion-margin |
| Layer 3 — SPU silicon | Per-chip sale or hosted-as-a-service | Hardware-margin (low at first, high at volume) |

No customer success teams. No managed services. No "we operate your
deployment." Only:
- Calls (metered, billed via API key)
- Licenses (annual, for self-hosted premium operators)
- Contracts (fixed-price, defined-deliverable, exit at handover)
- Hardware (per-unit, eventually hosted)

---

## What this is NOT

- Not a SaaS in the traditional sense — there are no per-seat dashboards
- Not enterprise software — no long sales cycles or customer success teams
- Not a consultancy — the only contract work is bespoke buildouts using
  our stack as backend, with handover at completion
- Not a research lab — the lab work outputs are operators, not papers
- Not a findings business — we don't analyze corpora for clients

## What this IS

**A protocol stack with proprietary operators and dedicated silicon.**

Closest historical comparisons:

| Company | What they sold | What they didn't sell |
|---|---|---|
| Stripe | Payments primitive + protocol | Payments consulting |
| Snowflake | Warehouse engine + per-query billing | Data analyses |
| Confluent | Kafka + streaming primitive | Stream-processing services |
| MongoDB | Document store + Atlas | Schema design |
| Apple Silicon (internal) | Vertically integrated chip + OS + apps | OS development consulting |
| **LatentOcean** | **Substrate-clustering primitive + protocols + silicon** | **Substrate analyses or per-client engagements (except buildouts of our stack into massive systems)** |

---

## 90-day milestones under this framing

| Month | Goal |
|---|---|
| 1 | OCEAN language repo open-sourced. MCP server published to npm/PyPI. Postgres extension packaged + dockerized. HTTP API live as `api.latentocean.com` |
| 2 | First external developer ships an `.ocean` program through MCP (Claude Desktop / Cursor integration). First Postgres-extension installation in customer's data warehouse. Free tier launched for HTTP API. |
| 2-3 | First bespoke buildout contract initiated (target: one hyperscaler or one sovereign customer). Premium operator key tier billing live. |
| 3 | FPGA-prototype SPU running first OCEAN program end-to-end. Architecture demo for hyperscaler conversations. |
| 4-6 | Hosted runtime out of beta with paid premium operators. SPU chiplet tape-out initiated via TSMC MPW. Layer 2b contract delivered + handed over. |

---

## The honest summary

LatentOcean has built the rare three-layer vertical:

- **Language + protocols** that make substrate clustering a primitive
- **Operator implementations** that are the moat (BTUT, TCD-JEPA, content_fp48)
- **Hardware (SPU)** that gives 90× energy efficiency at the same workload

The mistake to avoid: collapsing this into a single product line. The
trick is to keep all three layers in distinct distribution channels with
distinct economic models, and let them compound. Layer 1 reaches every
agent and every database. Layer 2a reaches every HTTP-speaking caller.
Layer 2b captures the few customers big enough to need bespoke
integration of our stack. Layer 2c is the long tail. Layer 3 is the
margin compound.

We are an **infrastructure protocol company with proprietary backend
operators and dedicated silicon**. Distribution is via standards (MCP,
Postgres extensions, HTTP). Revenue is per-call, per-license, per-contract,
per-chip. No customer-facing services. No engagement-based delivery
beyond the buildout tier.
