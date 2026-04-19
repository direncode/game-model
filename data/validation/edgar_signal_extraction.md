# EDGAR Signal Extraction — What the Anomalies Actually Say

Corpus: **61,041 EDGAR entities** (filings + XBRL facts).  
BTUT runs compared: target=2,000 and target=5,000 survivors.  
**Stable set: 90 of top 100 reconstruction anomalies appear in BOTH runs (90% reproducibility).**

These are the entities whose BTUT anomaly flag survives independent pipeline configurations — the structural signals most defensible against tuning artifacts.


## Top anomalous companies (stable set)

| Company (CIK) | Count of anomalous line-items | Industry |
|---|---|---|
| FEDERAL HOME LOAN MORTGAGE CORP | 3 |  |
| Blackstone Secured Lending Fund | 2 |  |
| BANK OF HAWAII CORP | 2 | State Commercial Banks (national) |
| REPLIGEN CORP | 1 | Biological Products (no diagnostics) |
| Regencell Bioscience Holdings Ltd | 1 |  |
| Artisan Partners Asset Management Inc. | 1 |  |
| CARRIER GLOBAL Corp | 1 |  |
| SunocoCorp LLC | 1 | Petroleum Refining |
| Samsara Inc. | 1 |  |
| Sandisk Corp | 1 |  |
| AMERICAN EXPRESS CO | 1 | Finance Services |
| Navan, Inc. | 1 | Prepackaged Software |

## Top anomalous XBRL concepts (stable set)

What accounting line items BTUT repeatedly flags as structurally unusual.

| XBRL concept | Count in stable top-100 |
|---|---|
| `AdditionalPaidInCapital` | 1 |

## Top flagged industries (stable set)

| Industry | Count |
|---|---|
| Pharmaceutical Preparations | 5 |
| Biological Products (no diagnostics) | 3 |
| Prepackaged Software | 3 |
| State Commercial Banks (national) | 3 |
| Surgical & Medical Instruments | 3 |
| Electric Services | 3 |
| Real Estate Investment Trusts | 3 |
| Petroleum Refining | 2 |

## Flagship top-10 composite anomalies

The BTUT pipeline's highest-composite survivors, enriched.

| # | Entity | Kind | CIK | Company | Concept / Form | Industry | composite | anomaly |
|---|---|---|---|---|---|---|---|---|
| 1 | `fact_4904_AssetRetirementObligation` | fact | 4904 | AMERICAN ELECTRIC POWER CO INC | AssetRetirementObligation | Electric Services | 0.859 | 1.000 |
| 2 | `fact_1642896_AdditionalPaidInCapital` | fact | 1642896 | Samsara Inc. | AdditionalPaidInCapital |  | 0.829 | 0.516 |
| 3 | `fact_1876042_Assets` | fact | 1876042 | Circle Internet Group, Inc. | Assets | Finance Services | 0.828 | 0.793 |
| 4 | `fact_886982_AdditionalPaidInCapital` | fact | 886982 | GOLDMAN SACHS GROUP INC | AdditionalPaidInCapital |  | 0.826 | 0.706 |
| 5 | `fact_1048268_AccruedLiabilitiesForCommissionsExpenseAndTaxes` | fact | 1048268 | IES Holdings, Inc. | AccruedLiabilitiesForCommissionsExpenseAndTaxes |  | 0.823 | 0.739 |
| 6 | `fact_922621_AccretionAmortizationOfDiscountsAndPremiumsInvestments` | fact | 922621 | ERIE INDEMNITY CO | AccretionAmortizationOfDiscountsAndPremiumsInvestments |  | 0.822 | 0.707 |
| 7 | `fact_1552033_AdvertisingExpense` | fact | 1552033 | TransUnion | AdvertisingExpense |  | 0.820 | 0.795 |
| 8 | `fact_1957132_CapitalExpendituresIncurredButNotYetPaid` | fact | 1957132 | SharkNinja, Inc. | CapitalExpendituresIncurredButNotYetPaid |  | 0.819 | 0.815 |
| 9 | `fact_1781335_AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | fact | 1781335 | Otis Worldwide Corp | AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment |  | 0.819 | 0.817 |
| 10 | `fact_1876042_AccruedIncomeTaxesCurrent` | fact | 1876042 | Circle Internet Group, Inc. | AccruedIncomeTaxesCurrent | Finance Services | 0.818 | 0.535 |

## Pure anomaly-score top-25 (stratified-by-type deviation)

Entities furthest from their type-centroid in BTUT magnitude space.

| # | Entity | Kind | CIK | Company | Concept | Industry | anomaly |
|---|---|---|---|---|---|---|---|
| 1 | `filing_000195917326000758` | filing | 885550 | CREDIT ACCEPTANCE CORP |  |  | 1.000 |
| 2 | `fact_4904_AssetRetirementObligation` | fact | 4904 | AMERICAN ELECTRIC POWER CO INC | AssetRetirementObligation | Electric Services | 1.000 |
| 3 | `filing_000105079726000025` | filing | 1050797 | COLUMBIA SPORTSWEAR CO |  |  | 0.968 |
| 4 | `filing_000121465926004185` | filing | 1280452 | MONOLITHIC POWER SYSTEMS INC |  | Semiconductors & Related Devices | 0.933 |
| 5 | `filing_000203383426000008` | filing | 104169 | Walmart Inc. |  |  | 0.863 |
| 6 | `filing_000010577026000018` | filing | 105770 | WEST PHARMACEUTICAL SERVICES INC |  | Surgical & Medical Instruments | 0.824 |
| 7 | `fact_1780312_AdjustmentsToAdditionalPaidInCapitalWarrantIssued` | fact | 1780312 | AST SpaceMobile, Inc. | AdjustmentsToAdditionalPaidInCapitalWarrantIssued |  | 0.823 |
| 8 | `fact_1781335_AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | fact | 1781335 | Otis Worldwide Corp | AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment |  | 0.817 |
| 9 | `fact_1957132_CapitalExpendituresIncurredButNotYetPaid` | fact | 1957132 | SharkNinja, Inc. | CapitalExpendituresIncurredButNotYetPaid |  | 0.815 |
| 10 | `fact_1552033_AccumulatedOtherComprehensiveIncomeLossNetOfTax` | fact | 1552033 | TransUnion | AccumulatedOtherComprehensiveIncomeLossNetOfTax |  | 0.811 |
| 11 | `fact_1736297_AdjustmentsToAdditionalPaidInCapitalWarrantIssued` | fact | 1736297 | Astera Labs, Inc. | AdjustmentsToAdditionalPaidInCapitalWarrantIssued | Semiconductors & Related Devices | 0.810 |
| 12 | `fact_879169_Assets` | fact | 879169 | INCYTE CORP | Assets | Commercial Physical & Biological Research | 0.800 |
| 13 | `fact_1552033_AdvertisingExpense` | fact | 1552033 | TransUnion | AdvertisingExpense |  | 0.795 |
| 14 | `fact_277135_AccruedLiabilitiesCurrentAndNoncurrent` | fact | 277135 | W.W. GRAINGER, INC. | AccruedLiabilitiesCurrentAndNoncurrent |  | 0.794 |
| 15 | `fact_1876042_Assets` | fact | 1876042 | Circle Internet Group, Inc. | Assets | Finance Services | 0.793 |
| 16 | `fact_1701605_Assets` | fact | 1701605 | Baker Hughes Co | Assets |  | 0.792 |
| 17 | `fact_1579878_Assets` | fact | 1579878 | Figma, Inc. | Assets | Prepackaged Software | 0.788 |
| 18 | `fact_895126_AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` | fact | 895126 | EXPAND ENERGY Corp | AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt | Crude Petroleum & Natural Gas | 0.787 |
| 19 | `filing_000110465925099303` | filing | 1465128 | STARWOOD PROPERTY TRUST, INC. |  | Real Estate Investment Trusts | 0.777 |
| 20 | `fact_1166691_Assets` | fact | 1166691 | COMCAST CORP | Assets |  | 0.772 |
| 21 | `fact_1781335_AociLossCashFlowHedgeCumulativeGainLossAfterTax` | fact | 1781335 | Otis Worldwide Corp | AociLossCashFlowHedgeCumulativeGainLossAfterTax |  | 0.771 |
| 22 | `filing_000091957426001185` | filing | 1045450 | EPR PROPERTIES |  | Real Estate Investment Trusts | 0.768 |
| 23 | `fact_1103982_AssetsNoncurrent` | fact | 1103982 | Mondelez International, Inc. | AssetsNoncurrent |  | 0.768 |
| 24 | `fact_40729_AmortizationMethodQualifiedAffordableHousingProjectInvestmentsAmortization` | fact | 40729 | Ally Financial Inc. | AmortizationMethodQualifiedAffordableHousingProjectInvestmentsAmortization | State Commercial Banks (national) | 0.767 |
| 25 | `fact_1858681_AdditionalPaidInCapital` | fact | 1858681 | Apollo Global Management, Inc. | AdditionalPaidInCapital |  | 0.765 |