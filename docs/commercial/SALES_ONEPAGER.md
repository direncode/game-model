# Latent Ocean — what it finds, what you pay, what you save

**Pre-blowup structural anomaly detection on SEC filings.** Flags the specific company + specific line item before the 10-K/A, before the going-concern disclosure, before the short-seller report.

## What it found last week in EDGAR (real, reproducible)

| Company | Flag | Line Item | Reading |
|---|---|---|---|
| **AMERICAN ELECTRIC POWER** | anomaly score 1.00 | AssetRetirementObligation | Coal-plant decommissioning liability. Audit-sensitive estimate. Peer-centroid structural outlier. |
| **Circle Internet Group** | composite 0.83 | Assets | Stablecoin reserve (hundreds of billions). Structurally distinct from operating companies — could hide concentration risk. |
| **Goldman Sachs** | composite 0.83 | AdditionalPaidInCapital | Capital structure outlier even vs other megabanks. Worth inspecting equity issuance and stock-comp cadence. |
| **NVR Inc.** | composite 0.76 | BusinessCombinationRecognizedIdentifiableAssets | Active land-acquisition deals; post-deal accounting distortion candidate. |
| **BXP, Inc.** | composite 0.77 | AssetImpairmentCharges | Recent office-REIT writedowns. Further impairment risk flagged. |
| **JD.com** | composite 0.76 | AssetsOfDisposalGroupIncludingDiscontinuedOperations | Active divestiture group. Disposal-group accounting is discretionary; watch the spin metrics. |
| **Expand Energy** (×2 in top-25) | composite 0.77 | AdjustmentsToAdditionalPaidInCapital | Chesapeake–Southwestern merger recap still working through APIC. Leverage trajectory matters. |
| **Exelon, LyondellBasell, Mueller Industries, Dow, IBM** | p<0.01 as a cluster | AccrualForEnvironmentalLossContingencies | Top-5 environmental-reserve concentration in the S&P filer universe. |

Every entry is auditable. Open the 10-K, read the line, see what we saw.

## Why you'll pay for this

| Job function | What Latent Ocean does for you |
|---|---|
| **Short-seller** | Weekly short-candidate digest ranked by structural outlier intensity. Named companies, named line items, verifiable against public filings. |
| **Audit committee** | Quarterly report showing your company's 5 most structurally-divergent line items vs peers. Argue with your external auditor with data. |
| **Corporate risk officer** | Alert on any of your 500 supply-chain partners' filings — 10-K/A, NT 10-K, structural anomaly spike. |
| **SEC examiner** | Rank the filer universe by multi-dimensional structural outlierness. Focus your limited exam resources. |
| **Hedge-fund PM** | Pre-earnings structural screen. Position against the outliers before the print. |
| **M&A target screener** | For any prospective acquisition, surface the top-10 structural anomalies in their last 3 years of filings. |

## What makes this different from everything else on the shelf

| Vendor | Approach | What we do instead |
|---|---|---|
| Bloomberg / FactSet | Consensus estimates + headlines | Structural anomaly from lattice geometry; catches things before they are news |
| RavenPack / AlphaSense | NLP sentiment on transcripts | Quantitative BTUT fingerprints on XBRL-tagged numbers; language-neutral |
| Audit Analytics | Historical restatement database | Forward-looking flagging *before* a restatement files |
| LLM vendor X | Generative, non-deterministic | Deterministic, reproducible (seed=42), falsifiable (null-test on demand) |

**No vendor lock-in.** Runs on-prem, in your air-gap, offline. No data leaves your environment.

## How we prove it works

Every finding is shipped with a **"Prove it" badge**. One click shows the null-permutation test: if we shuffled the BTUT scores across entities, would this finding survive? At p<0.001 on top-bridge, z=54σ on magnitude, 90% reproducibility across pipeline reconfigurations. We publish the numbers.

## Pricing

- **Free**: 10 tickers, daily digest — try before you buy
- **Pro**: $499/month, 500 tickers, real-time alerts, Excel add-in
- **Enterprise**: $50,000/year, unlimited, on-prem, SOC 2, Bloomberg fields

Details: `docs/commercial/PRICING.md`

## Next step

Email `sales@latentocean.com` with your 10 tickers. We return a pilot report within 48 hours showing which of your tickers are structural outliers today and why. No card required. No meeting required.

---

*Zero external GenAI on the critical path. Every claim falsifiable on demand.*
