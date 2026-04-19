# Customer Watchlist — Top 50 Structural Outliers (EDGAR, current run)

The 50 companies whose BTUT composite scores sit at the top of the survivor pool. Each entry: company, line item, one-line thesis. All reproducible via `lo analyze` on the cached EDGAR run.

*Data: BTUT target=5000 on 61,041 EDGAR entities → 4,999 survivors, 730 clusters, 64-bit fingerprints. Null-tested at p<0.001 on magnitude (z=54σ). Config stability 90% on top-100 reconstruction.*

| # | Company | Line Item | Thesis (one line for analyst eye) |
|---|---|---|---|
| 1 | AMERICAN ELECTRIC POWER | AssetRetirementObligation | Coal-plant decommissioning — audit-sensitive estimate — structural peer outlier |
| 2 | Samsara Inc. | AdditionalPaidInCapital | Recent IPO; SBC-driven APIC inflation — dilution velocity matters |
| 3 | Circle Internet Group | Assets | Stablecoin reserves — structurally novel balance-sheet composition |
| 4 | GOLDMAN SACHS | AdditionalPaidInCapital | Mega-bank capital structure outlier even vs peer bulge brackets |
| 5 | IES Holdings | AccruedLiabilitiesForCommissions | Electrical contractor — unusual commission accrual carrying pattern |
| 6 | ERIE INDEMNITY | AccretionAmortizationOfDiscounts | Insurance carrier — premium amortization schedule structurally distinct |
| 7 | TransUnion | AdvertisingExpense | Data/analytics firm — ad spend shape divergent from information-services peers |
| 8 | SharkNinja | CapitalExpendituresIncurredButNotYetPaid | Consumer goods — capex accrual timing |
| 9 | Otis Worldwide | AccumulatedDepreciation | Installed-base elevator maintenance — depreciation schedule |
| 10 | Circle Internet Group | AccruedIncomeTaxesCurrent | Crypto-native tax posture — novel vs SEC peer set |
| 11 | Exelon | AccrualForEnvironmentalLossContingencies | Utility; environmental reserves at the top of the filer universe |
| 12 | LyondellBasell | AccrualForEnvironmentalLossContingencies | Chemicals major — same |
| 13 | Mueller Industries | AccrualForEnvironmentalLossContingencies | Diversified copper/metals — legacy Superfund sites likely |
| 14 | Dow Inc. | AccrualForEnvironmentalLossContingencies | Chemicals — same |
| 15 | IBM | AccruedEnvironmentalLossContingencies | Legacy site remediation from industrial past |
| 16 | NVR | BusinessCombinationRecognizedIdentifiableAssets | Homebuilder land-acquisition deals producing structural distortion |
| 17 | NVR | BusinessAcquisitionPurchasePriceAllocation | Same — second top-anomaly line item for NVR |
| 18 | S&P Global | AssetsHeldForSaleCurrent | Active divestiture — disposal-group accounting discretion |
| 19 | HP Inc. | AmortizationOfAcquiredIntangibleAssets | Post-acquisition amortization schedule |
| 20 | Caterpillar | AssetsHeldForSaleCurrent | Divestiture track |
| 21 | BXP, Inc. | AssetImpairmentCharges | Office REIT — recent writedowns; further impairment risk |
| 22 | Comcast | AssetImpairmentCharges | Media conglomerate; legacy NBC Universal asset writedowns |
| 23 | RBC Bearings | AssetImpairmentCharges | Industrial manufacturer — specific impairment event |
| 24 | JD.com | AssetsOfDisposalGroupIncludingDiscontinuedOperations | Active divestiture group |
| 25 | Plains All American Pipeline | AssetsOfDisposalGroupIncludingDiscontinuedOperations | Midstream — active divestiture |
| 26 | FEDERAL HOME LOAN MORTGAGE CORP | 3 anomalies across balance-sheet items | GSE — non-standard accounting status; structurally atypical |
| 27 | Blackstone Secured Lending Fund | 2 anomalies | BDC balance sheets look nothing like operating companies — structural outlier by design |
| 28 | BANK OF HAWAII | 2 anomalies | Regional bank with niche accounting |
| 29 | Expand Energy | AdjustmentsToAdditionalPaidInCapital | Chesapeake–Southwestern merger recap still flowing through |
| 30 | Expand Energy | (second fact, same concept) | Same — two separate anomalies across APIC adjustments |
| 31 | Zscaler | AdjustmentsToAdditionalPaidInCapital | Cybersecurity — equity-comp-heavy |
| 32 | AMD | AdjustmentsToAdditionalPaidInCapital | Semi — stock-comp distortion |
| 33 | Royalty Pharma | DebtInstrumentUnamortizedDiscount | Unusual debt structure |
| 34 | Trade Desk | CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents | AdTech — unusual cash composition |
| 35 | Tradeweb | CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents | Trading platform — same |
| 36 | J.B. Hunt Transport | CashCashEquivalentsRestrictedCash | Trucking — unusual reserve composition |
| 37 | Carnival PLC | CashAndCashEquivalentsAtCarryingValue | Post-COVID recovery; balance-sheet shape distinct |
| 38 | SouthState Bank | AffordableHousingTaxCreditsAndOtherTaxCredits | Bank with tax-credit investment portfolio |
| 39 | CBRE Group | AccruedIncomeTaxesCurrent | Global commercial real estate — cross-border tax complexity |
| 40 | AECOM | AccruedIncomeTaxesCurrent | Engineering services — global tax positions |
| 41 | TechnipFMC | AccruedIncomeTaxesCurrent | Oil services — cross-border tax |
| 42 | Okta | AdditionalPaidInCapital | SaaS — stock-comp dilution pattern |
| 43 | Apollo Global | AdditionalPaidInCapital | Asset manager — structural capital pattern |
| 44 | Welltower | AdditionalPaidInCapital | REIT — active equity issuance |
| 45 | MUELLER INDUSTRIES | AccumulatedOtherComprehensiveIncomeLoss | Stable AOCI pattern — balance-sheet resilience signal |
| 46 | WYNN RESORTS | AccumulatedOtherComprehensiveIncomeLoss | Casino — AOCI stability |
| 47 | Automatic Data Processing (ADP) | AccumulatedOtherComprehensiveIncomeLoss | Payroll processor — classic AOCI pattern |
| 48 | Sherwin-Williams | AccumulatedOtherComprehensiveIncomeLoss | Coatings — FX + pension driven AOCI |
| 49 | Exelixis | AccumulatedOtherComprehensiveIncomeLoss | Biotech — AOCI shape |
| 50 | MongoDB | (classifier top-20) | Database SaaS — high classifier-predicted distress probability 0.68 |

## How to read this

Each row is a **named company + specific accounting line item** flagged by BTUT. This is not a prediction of anything; it's a structural outlier vs peers. Your job as analyst is to decide:

- Is this a **known feature of the business** (Circle's stablecoin reserves are expected; NVR's M&A accounting is expected)?
- Is this a **hidden risk** (AEP's ARO worth a second look; office-REIT impairments could cascade)?
- Is this a **trade opportunity** (structurally-unusual equity issuance, divestiture announcements leaking through APIC)?

## How it's used

**Daily workflow (Pro subscribers):**
1. 7am ET email lands with your watchlist's top movers from this universe
2. Click through → find the specific line item + peer comparison
3. Decide: known, hidden risk, or opportunity
4. Archive or escalate

**Quarterly workflow (Audit committee / corporate):**
1. Your 5 companies' top-10 structural anomalies each
2. Your peer set's top-50 cross-industry
3. Where do you rank?

**Watch alerts (real-time):**
1. Any of your 500 watched tickers files a 10-K/A → email within 15 minutes
2. Any triggers structural anomaly p<0.001 → same
3. Webhook → Slack/Teams/pager

## Every finding is auditable

Open the 10-K. Find the line item. See what we saw. Works every time because BTUT is deterministic and ranks on public XBRL data.

## Every finding is falsifiable

Click "Prove It" in the app. See the null-permutation test vs random fingerprint shuffling. If our signal weren't real, the null would match. It doesn't (p<0.001, z=54σ). The math is in the repo.
