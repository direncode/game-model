# Landing page copy

## Hero

### Catch the 10-K/A before it files.

Latent Ocean flags the specific line items on the specific companies whose financial-statement structure is drifting from peer norms. Today we flagged American Electric Power's Asset Retirement Obligation at anomaly 1.00, Circle Internet Group's Assets at 0.83, BXP's impairment charges as a continuing risk. Every flag is auditable against the 10-K. Every flag is falsifiable on demand.

**[ Try with your 10 tickers → ]**  **[ Watch 60-second demo ]**

*Used by analysts at hedge funds, audit committees, corporate risk desks, and federal examiners.*

---

## Section 1: What you get

### A watchlist that tells you what to read this week.

Upload your tickers. Get a weekly structural-anomaly digest. Each finding is a specific company + specific line item + one-line analyst thesis.

**Named, not abstract.**
- *AMERICAN ELECTRIC POWER — AssetRetirementObligation — coal-plant decommissioning at audit-sensitive peak*
- *Goldman Sachs — AdditionalPaidInCapital — structural outlier even vs bulge-bracket peers*
- *NVR Inc. — BusinessCombinationRecognizedIdentifiableAssets — active land-acquisition deals distorting post-deal accounting*

Not sentiment. Not consensus. Not an LLM hallucination. Structural geometry of the 10-K's XBRL-tagged numbers, benchmarked against the entire SEC filer universe.

**[ See last week's top-50 flags → ]**

---

## Section 2: Why it works

### We don't chase news. We find the drift before it's news.

Traditional tools rank on earnings surprises, consensus estimates, analyst sentiment — all of them trailing indicators that move after the market knows.

Latent Ocean ranks on **structural geometry of the balance sheet and income statement**. When a company's line-item values drift from peer norms in a specific pattern — the kind of drift that precedes a 10-K/A, a going-concern disclosure, or a short-seller thesis — BTUT catches it months early.

**In numbers:** On the full 61,041-entity EDGAR corpus, BTUT's top-100 structural anomalies pass null-permutation testing at **p<0.001** with **90% reproducibility** across pipeline configurations. Every finding carries a "Prove It" badge you can click.

**[ How the math works (60 seconds, plain English) → ]**

---

## Section 3: What it replaces

### One Pro subscription replaces ~40 analyst-hours per month.

At a typical $150/hour fully-loaded analyst cost, that's $6,000/month of screening work automated. Pro is $499/month. You do the math.

**Pro vs analyst screening:**

| Task | Analyst | Latent Ocean Pro |
|---|---|---|
| Screen 500 tickers for structural anomalies | 40 hrs / month | 0 hours (daily email) |
| Rank by "worth reading this week" | Subjective | Ranked by composite score with null-test evidence |
| Catch a new 10-K/A in the watchlist | Hope they check in time | 15-minute alert |
| Explain the flag to a PM / CFO | "I had a hunch" | Specific line item + peer distance + lineage link |
| Archive for audit trail | Manual folder | Immutable per-finding record |

**[ ROI calculator → ]**

---

## Section 4: Who uses it

### Short-sellers, audit committees, CROs, examiners.

**Hedge fund short desk (Pro + Excel add-in):** Pre-earnings structural screen on 300 tickers. Position against the outliers before the print. `=LO.SCORE(ticker)` in your screen workbook.

**Public company audit committee (Enterprise):** Quarterly report of your 5 companies' top-10 line-item deviations from sector peers. Argue with your external auditor using data, not vibes.

**Bank corporate risk officer (Enterprise):** Alert when any of your 500 commercial-lending counterparties files a 10-K/A, NT 10-K, or triggers a structural anomaly ≥ p99. Early warning before the covenant conversation.

**SEC examiner / PCAOB staff (Enterprise, on-prem):** Rank the filer universe by multi-dimensional structural outlierness. Focus your limited exam resources where the geometry actually shifts.

**Corporate treasurer at a registrant (Pro or Enterprise):** Self-audit your own filings. See which of your line items look most structurally divergent from peer norms. Fix it before your auditor finds it.

---

## Section 5: How it deploys

### Your environment, your data boundary.

**SaaS (standard):** api.latentocean.com. Data never stored beyond the request window unless you opt in.

**Dedicated-tenant:** Your own docker-compose stack on your VPC. Same API, your isolation. Fork-template model: separate network, separate Postgres, separate key material.

**Air-gapped / classified:** FIPS 140-2 primitives, no outbound traffic, offline signed updates. Deployable into environments no LLM vendor can enter. `docs/compliance/FEDRAMP_IL6.md` has the readiness matrix.

**On-prem with your own hardware:** Install the `lo_core` package (`pip install lo-core`). Deterministic, offline, zero external GenAI dependency. Runs on your boxes.

---

## Section 6: Proof and defensibility

### We publish the null tests.

Every competitive LLM-analytics vendor makes claims and hides the math. We publish:

- **`lo validate` CLI** — run the null permutation on any claim yourself
- **"Prove It" button** in the UI — one-click null-test view per finding
- **Full source for the analysis engine** at `lo_core/` (open installable package)
- **Reproducibility spec**: 90% top-100 reconstruction overlap across independent pipeline configurations. Number is in `data/validation/edgar_extreme_validation.json`.

**Numbers, not vibes.**
- 28 of 28 rank tests significant at p<0.05 on the whole EDGAR survivor pool
- 26 of 28 at p<0.001
- z-score up to 54σ on score magnitude
- 90% reproducibility across BTUT configurations
- 4,999 survivors extracted from 61,041 entities in 74 seconds on a single CPU

**[ Read the validation report → ]**

---

## Section 7: Pricing

### Three tiers. Predictable cost. No usage surprise bills.

| Free | Pro | Enterprise |
|---|---|---|
| **$0** | **$499/mo** | **$50k/yr** |
| 10 tickers | 500 tickers | unlimited |
| Daily digest | Real-time alerts | + on-prem, SOC 2, Bloomberg integration |
| 100 API calls/day | Unlimited API | + custom categorical probes, fine-tuning plane |
| Community Slack | Slack + webhook + email | Dedicated slack + on-call SLA |

**[ Start free → ]**  **[ See Pro details ]**  **[ Book an enterprise demo ]**

---

## Final CTA

### Send us 10 tickers. Get a pilot report within 48 hours.

No card. No meeting. Just email `sales@latentocean.com` with 10 ticker symbols. We return a report showing which of them are structural outliers today, on which line items, and why.

If the report has nothing actionable for your desk, we buy you a coffee. We've never had to.

**[ Request pilot report → ]**

---

*Zero external GenAI on the critical path. Every claim falsifiable on demand. Built for buyers who still audit their math.*
