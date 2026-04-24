# Latent Ocean — Provisional Patent Portfolio

This folder contains four DIY-drafted US provisional patent
applications covering the inventive concepts in the Latent Ocean
platform.

> **Not legal advice.** These documents were drafted by the applicant
> with assistance from a coding assistant. They have **not been
> reviewed by a registered patent attorney or agent**. Before filing,
> have an attorney spot-check at least the claims and the abstract
> for each application. The single most important question to answer
> first is **disclosure timing** — see the section "Disclosure clock
> audit" below.

---

## The four provisionals

| # | File | Subject |
|---|------|---------|
| 01 | [provisional_01_btut_primitive.md](provisional_01_btut_primitive.md) | The 48-bit deterministic structural fingerprint, 4-D score vector, null-test falsifiability operation, cross-data-type universality, reproducibility digest |
| 02 | [provisional_02_tcd_jepa.md](provisional_02_tcd_jepa.md) | Self-organizing predictor modules in JEPA via persistent-homology crystallization of latent-space exploration trajectories — TCD-JEPA |
| 03 | [provisional_03_two_engine_composition.md](provisional_03_two_engine_composition.md) | Composition of #1 and #2 into a single deterministic-by-construction pipeline with byte-identity guarantees across SaaS / on-premises / air-gap deployments, exposed as Postgres / Snowflake / MongoDB embodiments |
| 04 | [provisional_04_llm_safety_entity_resolution.md](provisional_04_llm_safety_entity_resolution.md) | Bundle-grounded LLM output validation with deterministic-template fallback, plus layered entity-resolution cascade with deterministic family-priority tie-breaking |

Each file contains: title, cross-references, field, background,
summary, drawings (textual), detailed description, illustrative
claims, and abstract. All are written in standard US-provisional
format and may be filed substantially as-is, modulo attorney review.

---

## Filing each provisional with the USPTO

Per-provisional filing fee at time of writing:

| Entity status | USPTO fee |
|---|---|
| Micro entity (gross income < ~$220k, ≤ 4 prior US apps) | **$75** |
| Small entity (most early-stage solo or small-team applicants) | **$150** |
| Large entity | **$300** |

Total for all four at micro-entity status: **~$300**.

### Per-application checklist

For each of the four provisionals, you will file:

1. **The specification** — copy the corresponding `.md` file's
   content into a `.docx` or `.pdf`. Strip the trailing italic
   "not legal advice" disclaimer.
2. **Drawings** — the drawings are described textually in
   Section V of each application. For provisional filing, formal
   drawings are not strictly required, but informal sketches
   (hand-drawn or mermaid → PNG) substantially strengthen the
   priority claim. At minimum: render Figure 1 of each application.
3. **Cover sheet** — USPTO Form **SB/16** (Provisional Application
   for Patent Cover Sheet). Fill in inventor name(s), residence,
   correspondence address, title (copy from the `.md`).
4. **Entity-status form** —
   - Micro entity: USPTO Form **SB/15A** (certification) or
     **SB/15B** (gross-income basis), as appropriate.
   - Small entity: no separate form — assertion is on Form SB/16.
5. **Application Data Sheet** — USPTO Form **AIA/14**
   (Application Data Sheet). Strongly recommended; lists each
   inventor and the title.
6. **Fee** — pay $75 / $150 / $300 via USPTO EFS-Web or
   Patent Center at filing time.

### Filing electronically (recommended)

The USPTO Patent Center (https://patentcenter.uspto.gov/) accepts
provisional filings. Account creation requires verification; allow
1–2 days for first-time setup. Once registered, a single submission
takes 15–30 minutes per application.

### What you receive on filing

- An **application number** (typically `63/XXX,XXX` for
  provisionals).
- A **filing receipt** (typically within 24–72 hours).
- A **priority date** equal to the date of receipt.

### The 12-month conversion deadline

Each provisional has a **12-month** lifespan. Within that
window, you must file a non-provisional application claiming
priority to the provisional, or the provisional expires with no
recoverable priority. Non-provisional drafting properly costs
$5,000–$15,000 with attorney involvement; budget for it now if
you plan to convert any of the four.

You are not obliged to convert all four. After 12 months you can
let the weakest provisional(s) lapse and only convert the ones
that have shown commercial pull.

---

## Disclosure clock audit — DO THIS FIRST

A US patent application must be filed within **12 months** of any
public disclosure of the invention; otherwise the invention enters
the public domain in the US (and most other countries do not have
even a 12-month grace period — public disclosure may already have
killed foreign patentability).

Before filing any of the four provisionals, audit:

| Disclosure surface | Question to answer | Where to look |
|---|---|---|
| **arXiv preprint** | When was the TCD-JEPA preprint first posted? | `tcd-jepa/paper/` directory; `git -C tcd-jepa log --reverse --format="%ai %s" -- paper/` for first-commit dates |
| **GitHub repo (this one)** | Has this repository ever been public? If so, since when? | GitHub repo settings; `git log --reverse --format="%ai" \| head -1` for repo-age lower bound |
| **GitHub repo (tcd-jepa)** | Has the tcd-jepa repo ever been public? Since when? | Submodule remote `https://github.com/...`; ask GitHub repo settings |
| **Live website (latentocean.com)** | Since when has the public been able to read the sales one-pager, primitive spec, and the verticals docs? | EC2 deploy logs; nginx access-log retention; `git log` for the relevant docs |
| **Sales conversations** | Has any of this been pitched to a prospective customer or investor under non-NDA? | Personal recall + sent emails |
| **Academic conference / talk** | Has any of this been presented in a public talk? | Personal recall |

If any of the above is **older than 12 months from today**, US
patentability is already lost for that disclosed material.
**File ASAP.** If between 6 and 12 months, file this week. If less
than 6 months, you have time but should still file soon.

---

## Suggested filing order

1. **Provisional #02 (TCD-JEPA)** — file first if a preprint is
   already public. The TCD-JEPA preprint is the most disclosed of
   the four inventions and the clock is most likely already running.
2. **Provisional #01 (BTUT primitive)** — file second. Most of the
   public disclosure is in the live sales material; the formal
   primitive spec is in the repo as `docs/PRIMITIVE_SPEC.md`.
3. **Provisional #03 (composition)** — file third. The composition
   claim is partially disclosed by the live website's two-engine
   description but the deterministic-boundary specifics are
   substantially undisclosed.
4. **Provisional #04 (LLM safety + entity resolver)** — file
   fourth. Lowest disclosure surface; the validator chain
   internals and family-priority mechanism are largely
   implementation-internal.

You can file all four in a single Patent Center session.

---

## Audit trail — what's in each spec

| Source material | Where it landed |
|---|---|
| `docs/PRIMITIVE_SPEC.md` (formal primitive spec) | Provisional #01 — Detailed Description |
| `tcd-jepa/README.md` (architecture abstract + diagram) | Provisional #02 — Summary + Sections A–C |
| `tcd-jepa/docs/architecture.md`, `mathematical_foundations.md` | Provisional #02 — Detailed Description (referenced but not pulled in verbatim; review and augment if filing) |
| `frontend/components/landing/PrimitiveInStack.tsx` (in-database SQL examples) | Provisional #03 — Detailed Description (Postgres / Snowflake / MongoDB embodiments) |
| `frontend/lib/narrativeClient.ts` (validator + provider dispatcher) | Provisional #04 — Detailed Description (Bundle-Grounded Narrative Generator) |
| `lo_nlp/resolve.py` (resolver cascade) | Provisional #04 — Detailed Description (Family-Priority Cascade Resolver) |
| `lo_nlp/eval_narrative.py` (validator dimensions) | Provisional #04 — Detailed Description (validator chain) |

If a non-provisional is later filed, the corresponding source
files in this repository are the authoritative reference
implementations and can be cited as "Exhibit A" embodiments in
the non-provisional spec.

---

## What is NOT covered by these four provisionals

For completeness, the following Latent Ocean components are
either not patentable, or are deferred to a future filing:

- The frontend UI / visualizations — generally not patentable
  subject matter
- The 15 vertical playbooks — content / business documents, not
  technical inventions
- The eval framework (lo_nlp/eval*.py, parity test) — engineering
  scaffolding, not invention
- The Cerebras WSE adapter — file separately if and only if the
  parallelization scheme itself is novel; otherwise it is an
  application of provisional #01
- The QR digital-identity lineage system — file separately if it
  is bound to the fingerprint primitive as the lineage anchor;
  otherwise it is a standard QR-tracking system

---

## One-line summary

You hold four-quadrant IP coverage for ~$300 of USPTO fees:
**(1) the substrate**, **(2) the discovery layer**, **(3) the
composition**, and **(4) the safety harness**. Get an attorney to
spot-check before filing, run the disclosure-clock audit,
and file in the order suggested above.
