# LatentOcean — business framing

*Honest survey of what we have and what business it actually is. Not a pitch deck.
Internal-strategy document.*

## What we have

| Asset | Role | Defensibility |
|---|---|---|
| BTUT engine | Structural-anomaly fingerprinting → 48-bit codes | Trade secret |
| TCD-JEPA recursive loop | System-2 Langevin + System-3 PH crystallization | Trade secret + ongoing R&D |
| Operator catalog | embed.tfidf_jl, embed.content_fp48, cluster.tcd_recursive_loop, align.module, align.dispersion, reduce.btut, … | Implementation moat |
| OCEAN language v1.1 | Full DSL — lexer, parser, type checker, compiler, REPL, formatter, linter, doc-gen, LSP, FFI, macros, conformance suite | Customer-facing surface |
| SPU architecture | 80 mm² chiplet, 20 W, 90× energy efficiency over H100 on workload class | Long-term hardware moat |
| Five corpus showcases | Atlas / Bombe / Pulse / Receipt / DocSouth | Demonstration substrate, not products |
| One real finding | TNA HW 1 dispersion replicated across 5 seeds + prose-pattern check | Proof the substrate finds non-trivial structure |

## What this is NOT

- **Not a SaaS.** SaaS implies customers have accounts and dashboards.
- **Not enterprise software.** Enterprise software implies long sales cycles, customer success teams, and per-engagement margins.
- **Not a consultancy.** Consulting implies bespoke per-client work with delivery-team headcount as the bottleneck.
- **Not a research lab.** A lab publishes; we build infrastructure.
- **Not a findings-business.** Selling findings means we run the engine for others, which makes us their analyst, not their infrastructure.

## What this IS

**An infrastructure protocol with proprietary operators and optimal hardware.**

The right historical comparisons:

| Company | Sold | Did NOT sell |
|---|---|---|
| Stripe | The payments primitive | Payments consulting |
| Snowflake | The data warehouse engine | Data analyses |
| Postgres / EnterpriseDB | The database | Database admin |
| Confluent / Kafka | The streaming primitive | Stream-processing services |
| **LatentOcean** | **The substrate-clustering primitive** | **Substrate-clustering analyses** |

## Distribution model — protocol-level, not service-level

Two integration channels, no customer-facing products:

| Channel | What it is | Reaches |
|---|---|---|
| **MCP server** (`ocean-mcp`) | JSON-RPC stdio per Anthropic's Model Context Protocol | Every Claude / Cursor / Goose / Continue.dev / hyperscaler agent runtime / internal AI tooling |
| **Postgres extension** (`ocean.run(...)`) | PL/Python functions installable in any Postgres-compatible database | Postgres + Aurora + AlloyDB + CockroachDB + Yugabyte + Supabase + Neon + TimescaleDB. Effectively every modern data warehouse outside Snowflake/BigQuery. |

The two channels together hit:
- Every AI agent stack (via MCP)
- Every data warehouse stack (via Postgres extension)
- Every internal tooling team that already has either of those (most of them)

Neither channel requires LatentOcean to operate a customer-facing service.
Neither requires accounts, dashboards, or support contracts. Both look like
*adopting a protocol*, not *purchasing a product*.

## Open core split

| Free / open | Premium / paid |
|---|---|
| OCEAN language (lexer, parser, type checker, compiler) | Premium operators: `embed.content_fp48`, `cluster.tcd_recursive_loop`, `reduce.btut` |
| Reference operators: `embed.tfidf_jl`, `cluster.kmeans`, `align.module` | OCEAN cloud runtime (per-call billing) |
| Stdlib functions, REPL, formatter, linter, docgen, LSP | SPU silicon (sale or hosted-as-a-service) |
| MCP server framework | Premium MCP server image bundled with proprietary operators |
| Postgres extension framework | Per-call licensing for proprietary operators in extension |

The language is the API. Open it. The operators are the moat. Charge for them.

This is the **PostgreSQL/EnterpriseDB pattern**, the **Confluent/Kafka pattern**,
the **MongoDB/Atlas pattern**. Open core where the language/protocol is free
and the premium implementations + hosted runtime + hardware are paid.

## Revenue mechanics

Three coordinated revenue lines, each protocol-driven:

| Line | Pricing | Margin profile |
|---|---|---|
| **Hosted runtime** (cloud-side execution of premium operators) | Per-pipeline-call ($0.01–$1 per call depending on corpus size) | High-margin, marginal-cost-of-compute |
| **Self-hosted licensing** (premium operators installed on customer infrastructure via MCP/Postgres extension) | Annual license per environment | Highest-margin, near-zero marginal cost |
| **SPU silicon** (eventually) | Per-chip sale to hyperscalers + chiplet integrators | High-revenue per unit, lower margin until volume |

No engagements. No client services. No "we'll run your corpus for you."
Customers integrate the protocols themselves; their use generates calls;
calls generate revenue.

## What to drop from the current shape

- Five separate showcase pages on the public website → consolidate into one *gallery* of OCEAN examples
- The "we run your corpus for you" pitch → never offer this; let the protocols handle it
- Per-client engagement framing in any external-facing doc
- The frontend's product-product-product layout → replace with: language docs, gallery, MCP integration page, Postgres integration page, SPU spec page

## What to keep emphasizing

- **OCEAN as the lingua franca.** The goal is for `.ocean` to be the substrate-clustering equivalent of `.sql`. Adoption-driven, not sales-driven.
- **The operators as the moat.** BTUT and TCD-JEPA are the proprietary research that nobody else has. Defended by trade secret + OpenTimeStamps, per the IP strategy.
- **The SPU as the hardware story.** Not a near-term revenue driver, but the long-term differentiation.
- **The five showcases as evidence.** Atlas/Bombe/Pulse/Receipt/DocSouth prove the substrate works on heterogeneous corpora; that proof is sales collateral, not products.

## 90-day milestones under this framing

| Month | Goal |
|---|---|
| 1 | OCEAN language repo open-sourced; MCP server published to npm/PyPI; Postgres extension packaged |
| 2 | First external developer ships an `.ocean` program that calls our hosted premium operators (Claude Desktop / Cursor / Continue integration) |
| 2-3 | First Postgres-extension installation in a customer's data warehouse |
| 3 | FPGA-prototype SPU running first OCEAN program, demo for hyperscaler conversations |
| 4-6 | Hosted runtime out of beta, per-call billing live; chiplet tape-out initiated via TSMC MPW |

## The honest punchline

The mistake to avoid: framing OCEAN/SPU/operators as "things we sell directly to companies." The mistake the right thing avoids: any per-customer engagement above the call/license tier.

We are an **infrastructure protocol company.** OCEAN is the protocol. The operators are the moat. The SPU is the optimal silicon. Distribution is via MCP and Postgres-style extensions. Revenue is per-call + license + (eventually) silicon.

Snowflake didn't run other people's analytics. Stripe doesn't process payments for merchants — it lets merchants process payments. Kafka doesn't move data for you — it moves data, period. **LatentOcean doesn't analyze corpora for clients — it lets every AI agent and every data system do substrate clustering as a primitive.**
