# Latent Ocean — Provisional Patent Portfolio

This folder contains three DIY-drafted US provisional patent
applications covering the crown-jewel inventive concepts of the
Latent Ocean stack: the **Universal Structural Adapter**, the
**Five Operational Primitives + Convergence Hand-Back Loop**,
and **Crystara** (the post-transformer training paradigm,
publicly known under the working designation TCD-JEPA).

> **Not legal advice.** These documents were drafted by the
> applicant with assistance from a coding assistant. They have
> **not been reviewed by registered patent counsel.** Before
> filing, have an attorney spot-check the claims and abstract
> for each application — a single one-hour consult ($300–500)
> is cheap insurance.

---

## Strategic context

These three provisionals are filed in support of the broader
**UAE Sovereign Structural Intelligence Stack** strategy, in
which Latent Ocean serves as the universal structural substrate
mountable on any sovereign data source, Crystara serves as the
differentiated training paradigm running on sovereign compute
(Cerebras WSE on Stargate UAE), and the convergence hand-back
loop establishes a self-improving national capability that
strengthens as more national data flows through it.

The three filings are strategically chosen so each maps directly
to one element of the Stack:

| Provisional | Stack role |
|---|---|
| **#01 Universal Structural Adapter** | The mountable substrate — installed on any data source (relational, document, streaming, edge, MCP-agent) including in fully air-gapped sovereign deployments |
| **#02 Five Operational Primitives + Hand-Back Loop** | The platform-level interface (MOUNT, SCORE, FALSIFY, DIGEST, HAND-BACK) and the architectural feedback loop by which the substrate continuously enriches itself from sovereign-corpus operation |
| **#03 Crystara** | The differentiated training paradigm consuming hand-back artifacts to grow topology-aware modules — the sovereign-AI capability that competitors offering pure scaling cannot match |

Together these three patents establish a coherent IP wedge that
maps the entire Stack onto defensible inventive priority.

The **BTUT data-reduction engine** is intentionally not patented
and will be released as open-source under a permissive license,
serving the community-adoption layer of the open-core strategy.

---

## The three provisionals

| # | File | Working title |
|---|------|---------|
| 01 | [provisional_01_latent_ocean_universal_adapter.md](provisional_01_latent_ocean_universal_adapter.md) | Universal Structural Adapter for Heterogeneous Data Sources, with PostgreSQL extension, Snowflake external function, MongoDB aggregation stage, edge-installable binary, and Model Context Protocol embodiments |
| 02 | [provisional_02_operational_primitives_handback.md](provisional_02_operational_primitives_handback.md) | Five Operational Primitives (MOUNT, SCORE, FALSIFY, DIGEST, HAND-BACK) and a Convergence Hand-Back Loop for a Self-Improving Structural Substrate, with Cryptographic Cross-Deployment Equivalence Verification across SaaS / on-premises / air-gapped / edge environments |
| 03 | [provisional_03_crystara.md](provisional_03_crystara.md) | Crystara: A Post-Transformer Training Paradigm for Self-Organizing, Topology-Aware Predictor Module Discovery via Persistent-Homology Crystallization of Fisher-Information-Preconditioned Langevin Trajectories in JEPA |

---

## Filing each provisional with the USPTO

Per-provisional filing fee at time of writing:

| Entity status | USPTO fee |
|---|---|
| **Micro entity** (gross income < ~$220k, ≤ 4 prior US apps) | **$75** |
| **Small entity** (most early-stage solo or small-team applicants) | **$150** |
| Large entity | $300 |

**Total for all three at micro-entity status: ~$225.**

### Per-application checklist

For each of the three provisionals:

1. **Specification PDF** — convert the corresponding `.md` to PDF
   (Pandoc: `pandoc provisional_NN.md -o provisional_NN.pdf`).
   Strip the trailing italic "not legal advice" disclaimer.
2. **Drawings PDF** — render at minimum Figure 1 of each
   application as an actual diagram. Mermaid → PNG via
   mermaid.live works fine; informal drawings are acceptable for
   provisional filings under MPEP § 601.05.
3. **USPTO Form SB/16** (Provisional Application for Patent
   Cover Sheet) — inventor name, residence, correspondence
   address, title (copy from the `.md`).
4. **USPTO Form AIA/14** (Application Data Sheet) — strongly
   recommended; lists each inventor and the title.
5. **USPTO Form SB/15A** (Micro Entity Status Certification —
   gross income basis) OR **SB/15B** (institution of higher
   education basis), as appropriate.
6. **Fee** — $75 / $150 / $300 via USPTO Patent Center at
   filing time.

### Filing electronically

USPTO Patent Center (https://patentcenter.uspto.gov/) accepts
provisional filings. Account creation requires ID.me
verification; allow 1–2 business days for first-time setup.
Each submission takes 15–30 minutes once the account is active.

### What you receive on filing

- An **application number** in the form `63/XXX,XXX`.
- A **filing receipt** within 24–72 hours.
- A **priority date** equal to the timestamp of submission.

### The 12-month conversion deadline

Each provisional has a 12-month lifespan. Within that window,
you must file a non-provisional application claiming priority,
or the provisional expires with no recoverable priority.
Non-provisional drafting properly costs $5,000–$15,000 with
attorney involvement; budget for it now if you plan to convert.

You are not obliged to convert all three. After 12 months you can
let the weakest provisional(s) lapse and only convert the ones
that have shown commercial pull or strategic deal-flow value.

### USPTO Track One (recommended for #02 specifically)

When converting #02 to non-provisional, file under USPTO **Track
One Prioritized Examination** ($2,200 small entity / $4,400 large
entity). Track One commits the USPTO to a final disposition
within 12 months of the non-provisional filing — vs. 3–5 years
for ordinary examination. Materially improves the diligence
story and shortens the path to an issued patent that can be
cited in the UAE strategic conversation.

---

## Disclosure status — what's preserved vs. what's lost

| Provisional | US (1-yr grace) | Foreign (absolute novelty) |
|---|---|---|
| #01 Universal Adapter | ✅ Preserved (within grace from latentocean.com first publication) | ⚠️ Some core concepts (48-bit fingerprint + 4-D vector framing) shown publicly on the live site; specific embodiments (parity-XOR construction, edge binary, MCP tool) less disclosed and still foreign-patentable |
| #02 Operational Primitives + Hand-Back Loop | ✅ Preserved | ✅ **Foreign rights preserved** — the five-primitive interface and the hand-back loop architecture are not on the live site or in any public source repo |
| #03 Crystara | ✅ Preserved | ❌ Foreign rights largely lost — public GitHub repo (github.com/direncode/tcd-jepa) and paper directory have established prior public disclosure; US grace period applies for the inventor's own disclosure |

### Suggested filing order

1. **#03 Crystara first** — most disclosed, US clock running fastest
2. **#01 Universal Adapter second** — partly disclosed via website
3. **#02 Operational Primitives + Hand-Back Loop third** — least
   disclosed (foreign rights still fully alive); but there is no
   downside to filing all three in a single Patent Center session
   on the same day

### PCT (international) filing decision

Within 12 months of the US provisional filing, you may file a
PCT (Patent Cooperation Treaty) application to preserve the
filing-date claim across 150+ countries. Cost: ~$3–5k for the
PCT itself, then $3–15k per country at national-phase entry.

| Provisional | PCT recommendation |
|---|---|
| #01 | **Optional** — partial foreign coverage (specific embodiments still novel internationally; core concept is widely disclosed) |
| #02 | **Strongly recommended** — full foreign rights intact; the hand-back loop is the most internationally-defensible inventive concept and the one most aligned with sovereign-procurement framing |
| #03 | **Skip** — foreign rights largely foreclosed by public preprint and source repo; pursue UAE-only national filing within the 12-month window if needed |

For the UAE Stack strategy, **filing a UAE national-phase application on #02 within 12 months** is the highest-leverage international patent move. UAE patent (issued via Ministry of Economy / GCC Patent Office) on the operational primitives + hand-back loop directly underwrites the national-capability framing.

---

## Coordinated IP defense (beyond patents)

The three provisionals are 1 of 8 IP-defense layers for Latent
Ocean. Maximum defensibility in the strategic-deal-flow sense
requires all of:

| Layer | Action this quarter | Cost |
|---|---|---|
| **Patents** | File 3 provisionals (this folder) | $225 |
| **Trademark** | File "Latent Ocean" + "Crystara" via USPTO TEAS Plus, Class 9 + Class 42 | $500–$1,000 |
| **Copyright registration** | Register LSX core source code via copyright.gov | $65 |
| **Trade-secret discipline** | Keep LSX repo private; NDA template for any architecture disclosure outside payroll; access controls | $0 (operational) |
| **MSA / customer contract perimeter** | Lawyer-drafted master services agreement template with reverse-engineering prohibition + IP perimeter | $1,500–$3,000 |
| **Compliance certifications** | SOC 2 Type II via Vanta or Drata; FedRAMP planning for sovereign-customer roadmap | $10,000–$20,000 (annual) |
| **Source-available license** | When BTUT is open-sourced, use BSL (Business Source License) not Apache — blocks AWS/Azure-style cloning | $0 (template) |
| **Defensive publication** | arXiv / engineering-blog publication of secondary inventions you don't want competitors to patent (resolver tuning, evaluation methodology, etc.) | $0–$200 each |

Spend ~$15k over 6 months and you have maximum defensibility
across all eight layers. Patents are 1 of 8 — important for
priority and evidence, but not the dominant moat.

---

## Audit trail — what's in each spec

| Source material | Where it landed |
|---|---|
| `docs/PRIMITIVE_SPEC.md` (formal primitive spec) | Provisional #01 — Detailed Description sections A–C |
| `frontend/components/landing/PrimitiveInStack.tsx` (in-database SQL examples) | Provisional #01 — Detailed Description sections D–F (PostgreSQL / Snowflake / MongoDB embodiments) |
| `tcd-jepa/README.md` (architecture abstract + tripartite system diagram) | Provisional #03 — Summary + Sections A–C |
| `tcd-jepa/docs/architecture.md`, `mathematical_foundations.md` | Provisional #03 — Detailed Description (referenced; review and augment if filing) |
| `tcd-jepa/paper/` (preprint material) | Provisional #03 — supplemental support for novelty |

Provisional #02 (operational primitives + hand-back loop) is
substantially original work and is not derived from any single
source file in the repository; the convergence hand-back loop
architecture is novel to this provisional.

If a non-provisional is later filed, the corresponding source
files are the authoritative reference implementations and can
be cited as "Exhibit A" embodiments in the non-provisional
specification.

---

## What is NOT covered by these three provisionals

For completeness, the following Latent Ocean components are
either not patentable, not part of the crown-jewels strategy,
or are deferred to future filings:

- **The frontend UI / visualizations** — generally not patentable
- **The 15 vertical playbooks** — content / business documents,
  not technical inventions
- **The eval framework** (`lo_nlp/eval*.py`, parity test) —
  engineering scaffolding, not invention
- **The narrative validator + family-priority entity resolver** —
  AI-co-inventorship gray area; defer to defensive-publication
- **The Cerebras WSE adapter** — file separately if and only if
  the parallelization scheme itself is novel
- **The QR digital-identity lineage system** — file separately
  if it is bound to the structural fingerprint as the lineage
  anchor

---

## Pre-filing checklist

```
WEEK -1 (right now):
  ✓ Confirm "Crystara" is the official public name for #03
  ✓ Confirm 5 operational primitive names: MOUNT, SCORE, FALSIFY,
    DIGEST, HAND-BACK
  ✓ Document first-public-disclosure dates for each invention

WEEK 0 — file:
  ✓ Render Figure 1 of each application as a PNG diagram
  ✓ Convert each .md to PDF via Pandoc
  ✓ Fill USPTO Form SB/16, AIA/14, SB/15A
  ✓ File all three in one Patent Center session — ~$225 total
  ✓ Save filing receipts; record the three 63/XXX,XXX numbers

WEEK 0 + 1:
  ✓ File trademark "Latent Ocean" + "Crystara" via TEAS Plus
  ✓ Register copyright on LSX source code via copyright.gov
  ✓ Sign Vanta or Drata for SOC 2 Type II — start the 6-month clock

WEEK 0 + 2:
  ✓ Send Khaldoon Al Mubarak outreach email (with priority dates +
    application numbers in hand — strengthens the "we have IP" frame)

MONTH 6:
  ✓ Send draft non-provisional to attorney for review on #02
    (Track One eligible — 12 month grant timeline)

MONTH 11:
  ✓ Convert #02 to non-provisional via Track One ($2,200 small entity)
  ✓ File PCT on #02 to preserve foreign rights ($3–4k)
  ✓ File UAE national-phase application on #02 ($variable)
  ✓ Decision: convert #01 + #03 or let them lapse
```

---

## One-line summary

You hold three-quadrant crown-jewel IP coverage for ~$225 of
USPTO fees: **the substrate (Universal Adapter), the platform
(Five Primitives + Hand-Back Loop), and the differentiated training
paradigm (Crystara)**. Combined with trademark + trade-secret
discipline + SOC 2 + an open-source BTUT under BSL, this is the
defensibility stack for the UAE Sovereign Structural Intelligence
Stack play.

Get an attorney to spot-check before filing, then file all three
in one Patent Center session. The $225 spent this week is the
single most strategically-leveraged dollar in the entire UAE play.
