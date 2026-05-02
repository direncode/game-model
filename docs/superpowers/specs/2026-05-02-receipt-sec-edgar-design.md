# Receipt — SEC EDGAR 10-K AI Summarization Audit Trail — Design Spec

**Date:** 2026-05-02
**Owner:** Latent Ocean (lsx)
**Status:** approved for implementation
**Reference artifacts:** `/docsouth`, `/atlas/arxiv`, `/pulse/uspto-inventors` (the substrate Receipt extends)

## Purpose

Public, citable artifact at `/receipt/sec-edgar` (and tenant `receipt_showcase`) demonstrating that Latent Ocean produces tamper-proof receipts for AI-driven document summarization at scale. Headline claim: **1,000 SEC EDGAR 10-K filings summarized once via Claude Sonnet 4.6, every summary carries a permanent receipt, the chain head is anchored to the Bitcoin timechain via OpenTimeStamps, anyone can re-derive any receipt's hash and verify the chain end-to-end.** Receipt extends the substrate into the buyer category of compliance officers, AI governance leads, and regulators (especially under SEC's 2024 AI-disclosure guidance).

Receipt is the third of three new public showcases (DocSouth shipped 2026-05-01; Atlas + Pulse shipped 2026-05-02). Across the four showcases (humanities, science, IP, compliance), every major buyer category gets a public reference deployment in their own field.

## What makes Receipt different from DocSouth / Atlas / Pulse

The first three showcases are **structural-formation** showcases: harvest a corpus, run BTUT, produce a public artifact with cluster purity + decade trajectory + rare records. Receipt is an **audit-trail** showcase: harvest a corpus, run a fixed prompt against an LLM, mint a tamper-proof receipt per call, anchor the chain head externally. No BTUT. No cluster purity. No decade trajectory. The entire artifact is *per-receipt verifiability*.

This is intentional — the four showcases together demonstrate that Latent Ocean's substrate produces both shapes of artifact, not just one.

## Out of scope

- BTUT formation. Receipt does not pass the corpus through the structural fingerprinting pipeline. (This is a deliberate scope choice; running BTUT on 10-Ks would be a *fifth* showcase, not part of Receipt v1.)
- Multi-section prompts (4-call-per-filing). Single prompt per filing per Q2.
- Backend FastAPI changes. All new code is operator scripts + frontend pages. Per Q5.
- Pre-2018 filings. SEC EDGAR has 10-Ks since 1993, but the compliance-relevance window is recent.
- Non-10-K forms (10-Q, 8-K, S-1). Future Receipt-2 could expand.
- Per-section structured extraction (named-entity extraction within the JSON output). The JSON schema captures the compliance-relevant summary; deeper extraction is downstream.

## Decisions locked in (clarifying questions)

| Q | Decision | Reason |
|---|---|---|
| Q1 corpus scope | 1,000 10-K filings stratified across (industry × year, 2018-2025) | Matches original spec. Feasible in one operator session. Stratification matches the compliance-officer mental model (audits across industry + year). |
| Q2 prompt structure | Single fixed prompt + structured JSON output schema. Both committed to git. | The receipt claim depends on prompt+schema being immutable. JSON output is downstream-ingestible by compliance systems. |
| Q3 chain shape | Linked-list (`prev_receipt_hash`) + OpenTimeStamps anchor of chain head | Tamper-proofing via hash chain. Bitcoin timechain anchor proves the chain head existed at the run timestamp. Maps to the company's IP framing (trade secrets + OTS, not patents). |
| Q4 page shape | Browseable list with collapsible cards at `/receipt/sec-edgar` + dedicated `/receipt/verify` route | List-with-cards handles browsability. Dedicated verify route is the buyer-grabbing artifact (compliance officers can paste any receipt and confirm hash). |
| Q5 architecture | Two operator scripts (`scripts/receipt_harvest.py` + `scripts/receipt_run.py`) + small TS client-side verifier in frontend | No new backend code. Mirrors Atlas/Pulse operator-script pattern. Receipt verification is a pure hash function, runs in browser. |

## Constraints

- No new backend code. Reuse existing audit infrastructure ([frontend/lib/range/audit.ts](frontend/lib/range/audit.ts), [frontend/app/api/range-audit/route.ts](frontend/app/api/range-audit/route.ts)) for JSON/CEF/OCSF export.
- Existing `/receipt` route (if any) preserved — showcase goes at `/receipt/sec-edgar`; verifier at `/receipt/verify`.
- Tenant: `receipt_showcase`, minted via existing `/api/range-demo-token` flow.
- All 1,000 filing texts are hash-pinned via `corpus_sha256` per filing; the total run hash chain is anchored externally.
- IP framing: trade secret plus OpenTimeStamps. Never claim "patents filed."
- Atlas's 23 tests, the showcase_lib's 25 tests, Pulse's 23 tests must all continue passing.

## Architecture

```
scripts/
  receipt_prompt.txt           # NEW - single fixed prompt, ~200 words, committed
  receipt_schema.json          # NEW - JSON output schema, committed
  receipt_harvest.py           # NEW - SEC EDGAR -> /data/formed_models/_inputs/sec_edgar_filings/
                               # (one .txt per filing + filings_index.json)
  receipt_run.py               # NEW - reads filings_index, calls Anthropic per filing,
                               # mints receipts, writes to receipts.ndjson, anchors chain
                               # head with OpenTimeStamps
  receipt_verify.sh            # NEW - audit log retrieval + chain integrity check

showcases/
  receipt.json                 # NEW - local committed snapshot of public artifact
  receipt.chainhead.ots        # NEW - OpenTimeStamps proof of the chain head

frontend/lib/receipt/
  verify.ts                    # NEW - TS implementation of receipt hash derivation
                               # (reused by both server and client)

frontend/app/receipt/sec-edgar/
  page.tsx                     # NEW - browseable list page
  ReceiptList.tsx              # NEW - client component, fetches /api/range-public/showcase/receipt

frontend/app/receipt/verify/
  page.tsx                     # NEW - dedicated verifier page
  Verifier.tsx                 # NEW - client component, paste-receipt-and-verify UX
```

Allowlist extension in `frontend/app/api/range-public/showcase/[slug]/route.ts`:
```ts
receipt:           "sec_edgar.json",
"receipt-chain":   "sec_edgar_chain.json",
```

## Components

### `scripts/receipt_prompt.txt` (committed)

Fixed prompt, ~200 words. Imperative voice. Instructs the model to read a 10-K filing text and output a JSON object matching `receipt_schema.json`. Examples of fields: executive_summary, business_description, risk_factors[], material_changes[], financial_highlights, management_changes[]. The prompt has a stable sha256 that is included in every receipt.

### `scripts/receipt_schema.json` (committed)

JSON Schema (Draft 2020-12) for the model's structured output. Includes constraints (string max-lengths, array max-counts) so the schema-conformant output is predictable in size. Committed to git so any reader can compare against the published schema_hash.

### `scripts/receipt_harvest.py`

- Pull SEC EDGAR submissions index, stratify-sample 1,000 10-K filings across (SIC industry × year, 2018-2025).
- Sampling: ~5 filings per (industry × year) bucket. Deterministic stride within each bucket sorted by accession_number.
- Per filing, fetch the full 10-K text (HTML → cleaned plain text; SEC EDGAR's HTML is reasonably structured).
- **Truncate each filing to ~50k tokens** (Items 1, 1A, 7, 8 — Business, Risk Factors, MD&A, Financial Statements). Truncation rationale: full 10-Ks are 100k-300k tokens; the most-compliance-relevant sections fit in 50k. This caps API cost without losing the summary fidelity.
- Output:
  - `/data/formed_models/_inputs/sec_edgar_filings/<filing_id>.txt` — one truncated text file per filing
  - `/data/formed_models/_inputs/sec_edgar_filings_index.json` — manifest with one record per filing: `{filing_id, cik, ticker, year, form, accession_number, edgar_url, sic_industry, corpus_sha256}`
- Determinism: stratification + stride sample produces the same 1,000 filings given the same EDGAR snapshot date.

### `scripts/receipt_run.py`

The operator-time, costs-money script. Steps:

1. Read `receipt_prompt.txt` → compute `prompt_hash = sha256(prompt_text)`.
2. Read `receipt_schema.json` → compute `schema_hash = sha256(schema_text)`.
3. Read `sec_edgar_filings_index.json` → for each filing, in deterministic order (sorted by filing_id):
   1. Read `<filing_id>.txt` → `corpus_sha256 = sha256(filing_text)` (already in the index from harvest, but verify).
   2. Call Anthropic API with `model="claude-sonnet-4-6"`, prompt + schema + filing_text.
   3. Capture output JSON → `output_sha256 = sha256(canonical_json(output))`.
   4. Compute receipt_hash:
      ```
      receipt_hash = sha256(
        (prev_receipt_hash or "GENESIS") || "|" ||
        prompt_hash || "|" ||
        schema_hash || "|" ||
        corpus_sha256 || "|" ||
        model_id || "|" ||
        timestamp || "|" ||
        output_sha256
      )
      ```
   5. Append receipt record to `/data/formed_models/_audit/receipts.ndjson`.
4. After all 1,000 receipts: `chain_head = receipt_hash of last receipt`.
5. **OpenTimeStamps anchor**: invoke `ots stamp` on a file containing chain_head, save the resulting `.ots` proof to `showcases/receipt.chainhead.ots`. Initial OTS proof is "pending" (Bitcoin not yet confirmed) but committed; readers run `ots upgrade` later to fetch the Bitcoin timechain proof. Note: this requires the `opentimestamps-client` Python package or the standalone CLI binary.
6. Compose public artifact at `/data/formed_models/_public/sec_edgar.json`:
   ```json
   {
     "showcase": "receipt",
     "ran_at": "2026-05-XX...",
     "model_id": "claude-sonnet-4-6-20250929",
     "prompt_hash": "...",
     "schema_hash": "...",
     "n_filings": 1000,
     "chain_head": "<final receipt_hash>",
     "chain_head_ots_file": "showcases/receipt.chainhead.ots",
     "stratification": {"industries": [...], "years": [2018, ..., 2025]},
     "filings": [
       {"filing_id": "AAPL-2024-10K", "cik": "...", "ticker": "AAPL", "year": 2024,
        "edgar_url": "https://www.sec.gov/...", "corpus_sha256": "...",
        "summary": {...JSON output...},
        "receipt_hash": "...", "prev_receipt_hash": "...",
        "timestamp": "...", "output_sha256": "...",
        "tokens": {"input": N, "output": N}},
       ...
     ]
   }
   ```
7. Compose chain-only artifact at `/data/formed_models/_public/sec_edgar_chain.json` (smaller, ~30 KB) with just the receipt hash chain — used by the dedicated `/receipt/verify` route to verify chain integrity without loading 1,000 summaries.
8. Write entries to the existing audit log via `lib/range/audit.ts` so the run shows up in `/api/range-audit?format=cef|ocsf` retrievals.

### `scripts/receipt_verify.sh`

Mirrors `scripts/atlas_verify.sh` but adapted for receipts:
- List models for `receipt_showcase` tenant (the run produces a model artifact for substrate consistency).
- Pull audit log in JSON, CEF, OCSF.
- Verify chain integrity: re-derive each receipt_hash in order; chain head must match the published value.
- Verify OpenTimeStamps proof: `ots verify showcases/receipt.chainhead.ots`.
- Cross-tenant probe.

### `frontend/lib/receipt/verify.ts`

Pure TypeScript implementation of the receipt hash derivation. Used by both `Verifier.tsx` (client-side, `crypto.subtle.digest`) and `ReceiptList.tsx` (inline per-card verify button).

```ts
export async function deriveReceiptHash(input: {
  prev_receipt_hash: string | null;
  prompt_hash: string;
  schema_hash: string;
  corpus_sha256: string;
  model_id: string;
  timestamp: string;
  output_sha256: string;
}): Promise<string> {
  const concat = [
    input.prev_receipt_hash ?? "GENESIS",
    input.prompt_hash,
    input.schema_hash,
    input.corpus_sha256,
    input.model_id,
    input.timestamp,
    input.output_sha256,
  ].join("|");
  const buf = new TextEncoder().encode(concat);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

### `frontend/app/receipt/sec-edgar/page.tsx` + `ReceiptList.tsx`

Index page. Hero, preface, corpus, **the list of 1,000 collapsible cards**, limits, acknowledgements. Each card shows (CIK, ticker, year, form, edgar_url) collapsed; expand → JSON summary preview, full receipt block with all hashes, and an inline "verify this receipt" button that calls `deriveReceiptHash()` and shows ✓ or ✗.

### `frontend/app/receipt/verify/page.tsx` + `Verifier.tsx`

Dedicated verify page. Renders:
- A textarea where someone pastes a receipt JSON object.
- A "verify" button that calls `deriveReceiptHash()`.
- Inline result: `✓ this receipt is internally consistent` or `✗ derived hash <X> does not match published <Y>`.
- Below: chain head + OpenTimeStamps panel. "Chain head: `<hex>`. Anchored to Bitcoin via OpenTimeStamps; download .ots file: [link]. Run `ots verify` against your local Bitcoin node to prove the chain head existed at the published timestamp."
- Below that: chain integrity verifier — fetches `/api/range-public/showcase/receipt-chain`, replays the chain, confirms head matches.

## Data flow

```
[1] Pin SEC EDGAR snapshot date (e.g., 2026-04-30)
[2] scripts/receipt_harvest.py --snapshot-date 2026-04-30 --output-dir /data/formed_models/_inputs/sec_edgar_filings/
    Output: 1000 filing .txt files + filings_index.json
[3] sha256 the filings_index.json -> corpus_input_sha256
[4] scripts/receipt_run.py --output /data/formed_models/_public/sec_edgar.json
    Reads receipt_prompt.txt + receipt_schema.json + filings_index.json,
    calls Anthropic API per filing, mints receipts, writes audit log,
    OTS-anchors chain head, composes public artifact.
[5] scripts/receipt_verify.sh
    Confirms chain integrity, OTS proof valid, audit log retrievable in
    JSON/CEF/OCSF.
[6] Copy showcases/receipt.json + showcases/receipt.chainhead.ots into repo
[7] Allowlist extension committed in route.ts
[8] Deploy
```

Steps [1]-[5] run on EC2 with `ANTHROPIC_API_KEY` env var. Steps [6]-[8] from dev box.

## Reproducibility recipe

> Verify any receipt yourself. Pick any filing on `/receipt/sec-edgar`. Click expand → copy the receipt JSON. Open `/receipt/verify`. Paste. Confirm `derived_hash == published receipt_hash`. Then verify the chain head: download `receipt.chainhead.ots`, run `ots verify` against the Bitcoin timechain. The chain head existed at the published `ran_at` timestamp; no receipts can be retroactively forged.

What the verifier proves:
- Each receipt is internally consistent (`derived_hash == receipt_hash`).
- The chain is unbroken (each receipt's `prev_receipt_hash` matches the previous receipt's hash).
- The chain head existed at the published `ran_at` timestamp (per OpenTimeStamps Bitcoin anchor).

What the verifier does NOT prove:
- That Claude's output text is correct/factual. The receipt attests to *what was returned*, not *whether it's right*.
- That re-running the same prompt against the same model produces the same output. LLMs are non-deterministic; a re-run produces a *different* receipt because the output bytes differ. This is honest: re-derivation creates a new receipt; the old receipt remains verifiable.
- That Anthropic's model_id is stable forever. If `claude-sonnet-4-6-20250929` is deprecated, future re-runs use a different model and produce different receipts. The published receipts remain valid records of what the original model returned.

## Failure modes and mitigations

### LLM-call risks

| Risk | Mitigation |
|---|---|
| Anthropic API rate limits during the 1,000-call run | Operator-script batches at 5 RPM with backoff. ~3-4 hours wall time at conservative rate. Run in `tmux`. |
| Anthropic API failure mid-run (network, quota, 5xx) | `receipt_run.py` writes receipts incrementally to receipts.ndjson. On restart, skip already-receipted filings (idempotent by filing_id + prev chain). |
| API cost overrun | 1,000 filings × ~50k input tokens × $3/MTok + ~1k output × $15/MTok ≈ $165 + $15 = $180 worst case. With prompt caching on the schema portion, drops to ~$60-80. Documented in runbook pre-flight. |
| Schema-noncompliant output (model returns malformed JSON) | The receipt is over `output_sha256` of whatever the model returned, malformed or not. The artifact stores both `summary` and a `schema_compliant: bool` flag. Honest disclosure if some filings have non-compliant outputs. |

### Receipt-chain risks

| Risk | Mitigation |
|---|---|
| Single missed receipt breaks the chain | Operator-script appends incrementally and tracks the last receipt_hash. If interrupted, the next receipt picks up from the last good hash. |
| Tampering with a receipt mid-chain | The whole point of the chain — tampering breaks the chain head. The verify script catches this. The OpenTimeStamps anchor catches retroactive tampering with the chain head itself. |
| OpenTimeStamps Bitcoin confirmation takes hours-days | The `.ots` file is "pending" at run completion. Readers running `ots verify` later upgrade the proof to a confirmed Bitcoin block. v1 ships with the pending proof; v2 may run a re-confirmation script. |
| `opentimestamps-client` not available on EC2 | Install via `pip install opentimestamps-client`. Documented in pre-flight. Alternative: use the OpenTimeStamps web service (calendar.eternitywall.com) directly. |

### Frontend / artifact risks

| Risk | Mitigation |
|---|---|
| Public JSON artifact is large (1,000 summaries × ~5 KB each = ~5 MB) | The full artifact (`sec_edgar.json`) is loaded only on `/receipt/sec-edgar`. The smaller `sec_edgar_chain.json` (~30 KB, just hashes) is loaded on `/receipt/verify`. |
| Browser-side `crypto.subtle.digest` not available in older browsers | Documented as Chrome/Firefox/Safari latest-2-versions only. Compliance buyers use modern browsers. |
| Chain verifier rebuilds the whole chain client-side | 1,000 sha256 ops complete in milliseconds. Acceptable. |

### Substrate-fit risks

| Risk | Mitigation |
|---|---|
| Existing audit log expects a specific event shape | Receipt events use `action: "summarize"` (new value in the union) and stash receipt-specific fields in `details`. Audit's `toCEF` and `toOCSF` already serialize `details` generically. |
| `/api/range-public/showcase/[slug]/route.ts` allowlist | Extended in Phase 1 with `receipt` and `receipt-chain` slugs. Same pattern as Atlas + Pulse. |

## Pre-implementation action items

None. The audit infrastructure exists, the EDGAR scripts exist, the Anthropic SDK is in the backend deps. Implementation is additive only.

## Acceptance criteria

The Receipt v1 artifact ships when:

- `/data/formed_models/_public/sec_edgar.json` exists on production with `chain_head`, `prompt_hash`, `schema_hash`, `n_filings`, and 1,000 filings each with summary + receipt block.
- `showcases/receipt.chainhead.ots` is committed to the repo with a valid (pending or confirmed) OpenTimeStamps proof.
- `scripts/receipt_verify.sh` confirms: chain integrity (1,000/1,000 receipts internally consistent), OTS proof valid, audit log retrievable in JSON/CEF/OCSF.
- `https://www.latentocean.com/receipt/sec-edgar` renders the index with 1,000 collapsible filing cards.
- `https://www.latentocean.com/receipt/verify` renders the dedicated verifier; paste-receipt-and-check works in the browser.
- Atlas's 23 + Pulse's 23 + showcase_lib's 25 tests still pass after this work lands.
- Verification recipe printed on both pages, executable by a third party.

## Compounding across the four showcases

Once Receipt v1 ships, the four showcases together (DocSouth, Atlas, Pulse, Receipt) form a complete public-reference deployment for every major buyer category Latent Ocean targets:

| Showcase | Buyer category | Substrate exercised |
|---|---|---|
| DocSouth | Research libraries, foundations, archives | Studio concierge, full BTUT pipeline, scholar-pace storytelling |
| Atlas | Scientific publishers, bibliometricians | Reproducibility, decade trajectory, cross-discipline bleed |
| Pulse | IP attorneys, M&A, innovation economists | Disambiguation, multi-baseline, polymath bleed |
| Receipt | Compliance officers, AI governance, regulators | Receipt-attested AI, chain attestation, OpenTimeStamps anchor |

That is the case for Vault: four public deployments in four buyer categories, all on the same substrate. Each deployment is byte-verifiable by a third party.
