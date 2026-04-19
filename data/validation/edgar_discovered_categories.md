# EDGAR Discovered Categories — Zero Hand-Tuning

Method: **every category is discovered from data**.

- Tokenizer: deterministic CamelCase split
- Vectorizer: sklearn TF-IDF (default params)
- Clusterer: k-means with K=40 chosen via silhouette score over K ∈ {4..40}
- Silhouette: **0.1608**
- Scoring: BTUT pipeline's own `composite` score (not chosen by operator)
- Null test: 500 random-permutation iterations per cluster

Input: **1806 fact survivors**, **314 unique XBRL concepts**.
Discovered categories: **29** (clusters with ≥ 10 survivors).

## 1. assets+held+noncurrent  [null]

- Token centroid: `assets / held / noncurrent`
- Concepts in cluster: 11
- Survivors in cluster: 242
- Top-10 mean composite: **0.7943** (null mean 0.7931, null p95 0.8049, null p99.9 0.814)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Circle Internet Group, Inc. | `Assets` | 0.8276 | 0.7931 | 0.6984 | 1.0 |
| 2 | AMERICAN FINANCIAL GROUP INC | `Assets` | 0.7999 | 0.7024 | 0.6857 | 1.0 |
| 3 | Baker Hughes Co | `Assets` | 0.7951 | 0.7917 | 0.6181 | 1.0 |
| 4 | INCYTE CORP | `Assets` | 0.7947 | 0.8001 | 0.6117 | 1.0 |
| 5 | COMCAST CORP | `Assets` | 0.7905 | 0.7725 | 0.6184 | 1.0 |
| 6 | Figma, Inc. | `Assets` | 0.7902 | 0.7885 | 0.6076 | 1.0 |
| 7 | Mondelez International, Inc. | `AssetsNoncurrent` | 0.79 | 0.7676 | 0.6202 | 1.0 |
| 8 | MARRIOTT INTERNATIONAL INC /MD/ | `Assets` | 0.7875 | 0.7515 | 0.6241 | 1.0 |
| 9 | Veralto Corp | `Assets` | 0.7839 | 0.6924 | 0.6521 | 1.0 |
| 10 | Palantir Technologies Inc. | `Assets` | 0.7835 | 0.7485 | 0.616 | 1.0 |

**Cluster concept distribution:** `Assets` (162), `AssetsCurrent` (54), `AssetsNoncurrent` (7), `AssetsHeldForSaleCurrent` (5), `AssetsHeldInTrust` (4)

## 2. accrued+liabilities+current  [null]

- Token centroid: `accrued / liabilities / current`
- Concepts in cluster: 25
- Survivors in cluster: 192
- Top-10 mean composite: **0.7862** (null mean 0.7893, null p95 0.8016, null p99.9 0.8112)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Block, Inc. | `AccruedMarketingCostsCurrent` | 0.806 | 0.6064 | 0.7609 | 1.0 |
| 2 | AXON ENTERPRISE, INC. | `AccruedLiabilitiesCurrentAndNoncurrent` | 0.8016 | 0.7524 | 0.6589 | 1.0 |
| 3 | TEVA PHARMACEUTICAL INDUSTRIES LTD | `AccountsPayableAndAccruedLiabilitiesCurrent` | 0.7959 | 0.546 | 0.7735 | 1.0 |
| 4 | W.W. GRAINGER, INC. | `AccruedLiabilitiesCurrentAndNoncurrent` | 0.7925 | 0.7944 | 0.6098 | 1.0 |
| 5 | American Homes 4 Rent | `AccruedLiabilitiesCurrentAndNoncurrent` | 0.7842 | 0.638 | 0.6867 | 1.0 |
| 6 | CrowdStrike Holdings, Inc. | `AccruedSalesCommissionCurrent` | 0.7797 | 0.445 | 0.7961 | 1.0 |
| 7 | Okta, Inc. | `AccruedRentNoncurrent` | 0.7789 | 0.5306 | 0.7407 | 1.0 |
| 8 | SCHWAB CHARLES CORP | `AccruedLiabilities` | 0.7755 | 0.5757 | 0.704 | 1.0 |
| 9 | RB GLOBAL INC. | `AccruedLiabilitiesCurrent` | 0.775 | 0.6544 | 0.6535 | 1.0 |
| 10 | NIKE, Inc. | `AccruedLiabilitiesCurrent` | 0.7725 | 0.5154 | 0.7341 | 1.0 |

**Cluster concept distribution:** `AccruedLiabilitiesCurrent` (91), `AccountsPayableAndAccruedLiabilitiesCurrent` (17), `AccountsPayableAndAccruedLiabilitiesCurrentAndNoncurrent` (13), `AccruedMarketingCostsCurrent` (11), `AccruedLiabilitiesCurrentAndNoncurrent` (10)

## 3. paid+additional+capital  [PASS p<0.05]

- Token centroid: `paid / additional / capital`
- Concepts in cluster: 13
- Survivors in cluster: 184
- Top-10 mean composite: **0.8028** (null mean 0.7879, null p95 0.7994, null p99.9 0.8093)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Samsara Inc. | `AdditionalPaidInCapital` | 0.8285 | 0.5159 | 0.8739 | 1.0 |
| 2 | GOLDMAN SACHS GROUP INC | `AdditionalPaidInCapital` | 0.8261 | 0.7057 | 0.7491 | 1.0 |
| 3 | SharkNinja, Inc. | `CapitalExpendituresIncurredButNotYetPaid` | 0.8191 | 0.8151 | 0.6633 | 1.0 |
| 4 | Okta, Inc. | `AdditionalPaidInCapital` | 0.8105 | 0.5775 | 0.7904 | 1.0 |
| 5 | AST SpaceMobile, Inc. | `AdjustmentsToAdditionalPaidInCapitalWarrantIssued` | 0.8071 | 0.8233 | 0.6283 | 1.0 |
| 6 | Astera Labs, Inc. | `AdjustmentsToAdditionalPaidInCapitalWarrantIssued` | 0.7965 | 0.8101 | 0.61 | 1.0 |
| 7 | Trade Desk, Inc. | `AdjustmentsToAdditionalPaidInCapitalWarrantIssued` | 0.7959 | 0.7435 | 0.6501 | 1.0 |
| 8 | Apollo Global Management, Inc. | `AdditionalPaidInCapital` | 0.7897 | 0.765 | 0.621 | 1.0 |
| 9 | EXPAND ENERGY Corp | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` | 0.7778 | 0.7873 | 0.5776 | 1.0 |
| 10 | Zscaler, Inc. | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` | 0.7767 | 0.5521 | 0.7218 | 1.0 |

**Cluster concept distribution:** `AdditionalPaidInCapital` (38), `AdjustmentsToAdditionalPaidInCapitalSharebasedCompensationRequisiteServicePeriodRecognitionValue` (38), `AdjustmentsToAdditionalPaidInCapitalWarrantIssued` (29), `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` (20), `CapitalExpendituresIncurredButNotYetPaid` (18)

## 4. tax+comprehensive+income  [null]

- Token centroid: `tax / comprehensive / income`
- Concepts in cluster: 12
- Survivors in cluster: 162
- Top-10 mean composite: **0.7761** (null mean 0.7859, null p95 0.7979, null p99.9 0.8059)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Otis Worldwide Corp | `AociLossCashFlowHedgeCumulativeGainLossAfterTax` | 0.8102 | 0.7707 | 0.6687 | 1.0 |
| 2 | TransUnion | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.7966 | 0.8112 | 0.6096 | 1.0 |
| 3 | FISERV INC | `AccumulatedOtherComprehensiveIncomeLossCumulativeChangesInNetGainLossFromCashFlowHedgesEffectNetOfTax` | 0.7835 | 0.5873 | 0.7167 | 1.0 |
| 4 | MID AMERICA APARTMENT COMMUNITIES INC. | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.7821 | 0.7583 | 0.6063 | 1.0 |
| 5 | Autodesk, Inc. | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.771 | 0.6036 | 0.6753 | 1.0 |
| 6 | CARNIVAL PLC | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.7702 | 0.6601 | 0.6379 | 1.0 |
| 7 | Samsara Inc. | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.7687 | 0.6166 | 0.6613 | 1.0 |
| 8 | METTLER TOLEDO INTERNATIONAL INC/ | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.7684 | 0.7178 | 0.5974 | 1.0 |
| 9 | Ally Financial Inc. | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.7553 | 0.6812 | 0.5874 | 1.0 |
| 10 | ABBOTT LABORATORIES | `AccumulatedOtherComprehensiveIncomeLossCumulativeChangesInNetGainLossFromCashFlowHedgesEffectNetOfTax` | 0.755 | 0.5433 | 0.673 | 1.0 |

**Cluster concept distribution:** `AccumulatedOtherComprehensiveIncomeLossNetOfTax` (105), `AccumulatedOtherComprehensiveIncomeLossCumulativeChangesInNetGainLossFromCashFlowHedgesEffectNetOfTax` (33), `AccumulatedOtherComprehensiveIncomeLossForeignCurrencyTranslationAdjustmentNetOfTax` (7), `ComprehensiveIncomeNetOfTax` (4), `AccumulatedOtherComprehensiveIncomeLossAvailableForSaleSecuritiesAdjustmentNetOfTax` (3)

## 5. disposal+group+operation  [null]

- Token centroid: `disposal / group / operation`
- Concepts in cluster: 4
- Survivors in cluster: 106
- Top-10 mean composite: **0.7794** (null mean 0.7784, null p95 0.7924, null p99.9 0.8005)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | MOODYS CORP /DE/ | `AssetsOfDisposalGroupIncludingDiscontinuedOperation` | 0.7912 | 0.6178 | 0.7169 | 1.0 |
| 2 | ENSIGN GROUP, INC | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.7858 | 0.6272 | 0.6975 | 1.0 |
| 3 | GENUINE PARTS CO | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.7822 | 0.5889 | 0.7124 | 1.0 |
| 4 | PLAINS ALL AMERICAN PIPELINE LP | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.7793 | 0.6835 | 0.646 | 1.0 |
| 5 | Strategy Inc | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.7791 | 0.4831 | 0.7708 | 1.0 |
| 6 | TARGET CORP | `AssetsOfDisposalGroupIncludingDiscontinuedOperation` | 0.7787 | 0.5334 | 0.7384 | 1.0 |
| 7 | ABBOTT LABORATORIES | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.7776 | 0.5572 | 0.7207 | 1.0 |
| 8 | BROWN FORMAN CORP | `AssetsOfDisposalGroupIncludingDiscontinuedOperation` | 0.7766 | 0.5853 | 0.7008 | 1.0 |
| 9 | JD.com, Inc. | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.7724 | 0.7044 | 0.6157 | 1.0 |
| 10 | Fortive Corp | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.771 | 0.6577 | 0.6413 | 1.0 |

**Cluster concept distribution:** `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` (54), `AssetsOfDisposalGroupIncludingDiscontinuedOperation` (39), `AssetsOfDisposalGroupIncludingDiscontinuedOperationNoncurrent` (7), `AssetsHeldForSaleNotPartOfDisposalGroupCurrent` (6)

## 6. property+and+plant  [null]

- Token centroid: `property / and / plant`
- Concepts in cluster: 6
- Survivors in cluster: 100
- Top-10 mean composite: **0.7782** (null mean 0.7768, null p95 0.7902, null p99.9 0.7972)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Otis Worldwide Corp | `AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | 0.8185 | 0.8167 | 0.6609 | 1.0 |
| 2 | EMERSON ELECTRIC CO | `AssetsNoncurrentOtherThanNoncurrentInvestmentsAndPropertyPlantAndEquipment` | 0.8052 | 0.7497 | 0.6694 | 1.0 |
| 3 | United Airlines Holdings, Inc. | `AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | 0.7904 | 0.7552 | 0.6291 | 1.0 |
| 4 | CARRIER GLOBAL Corp | `AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | 0.7754 | 0.7295 | 0.6076 | 1.0 |
| 5 | CITIZENS FINANCIAL GROUP INC/RI | `AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | 0.7698 | 0.705 | 0.6088 | 1.0 |
| 6 | CURTISS WRIGHT CORP | `AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | 0.7683 | 0.698 | 0.6095 | 1.0 |
| 7 | BERKSHIRE HATHAWAY INC | `AssumedPremiumsEarnedPropertyAndCasualty` | 0.7653 | 0.4638 | 0.7484 | 1.0 |
| 8 | UNITEDHEALTH GROUP INC | `AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | 0.7642 | 0.692 | 0.6031 | 1.0 |
| 9 | SYSCO CORP | `AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | 0.7641 | 0.5891 | 0.667 | 1.0 |
| 10 | EMERSON ELECTRIC CO | `AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` | 0.7607 | 0.5212 | 0.7009 | 1.0 |

**Cluster concept distribution:** `AccumulatedDepreciationDepletionAndAmortizationPropertyPlantAndEquipment` (92), `AssetsNoncurrentOtherThanNoncurrentInvestmentsAndPropertyPlantAndEquipment` (2), `AssumedPremiumsEarnedPropertyAndCasualty` (2), `AssumedPremiumsWrittenPropertyAndCasualty` (2), `AccumulatedDepreciationDepletionAndAmortizationExpensePropertyPlantAndEquipmentCurrentCharge` (1)

## 7. taxes+accrued+income  [null]

- Token centroid: `taxes / accrued / income`
- Concepts in cluster: 9
- Survivors in cluster: 91
- Top-10 mean composite: **0.7768** (null mean 0.7752, null p95 0.7885, null p99.9 0.7961)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | IES Holdings, Inc. | `AccruedLiabilitiesForCommissionsExpenseAndTaxes` | 0.8233 | 0.739 | 0.7215 | 1.0 |
| 2 | Circle Internet Group, Inc. | `AccruedIncomeTaxesCurrent` | 0.8183 | 0.5351 | 0.8363 | 1.0 |
| 3 | Otis Worldwide Corp | `AccrualForTaxesOtherThanIncomeTaxesCurrent` | 0.7789 | 0.5059 | 0.7562 | 1.0 |
| 4 | ASSURANT, INC. | `AccruedIncomeTaxesPayable` | 0.7706 | 0.4895 | 0.7456 | 1.0 |
| 5 | MASIMO CORP | `AccruedIncomeTaxesCurrent` | 0.7684 | 0.5724 | 0.6884 | 1.0 |
| 6 | AECOM | `AccruedIncomeTaxesCurrent` | 0.7675 | 0.6145 | 0.6597 | 1.0 |
| 7 | CBRE GROUP, INC. | `AccruedIncomeTaxesCurrent` | 0.7666 | 0.7341 | 0.5827 | 1.0 |
| 8 | American Homes 4 Rent | `AccrualForTaxesOtherThanIncomeTaxesCurrentAndNoncurrent` | 0.76 | 0.6772 | 0.6019 | 1.0 |
| 9 | DYCOM INDUSTRIES INC | `AccruedPayrollTaxesCurrent` | 0.7589 | 0.429 | 0.754 | 1.0 |
| 10 | Otis Worldwide Corp | `AccruedIncomeTaxesCurrent` | 0.7558 | 0.5292 | 0.6838 | 1.0 |

**Cluster concept distribution:** `AccruedIncomeTaxesCurrent` (49), `AccrualForTaxesOtherThanIncomeTaxesCurrent` (17), `AccrualForTaxesOtherThanIncomeTaxesCurrentAndNoncurrent` (7), `AccruedIncomeTaxesNoncurrent` (7), `AccruedPayrollTaxesCurrentAndNoncurrent` (5)

## 8. expense+charges+advertising  [PASS p<0.05]

- Token centroid: `expense / charges / advertising`
- Concepts in cluster: 5
- Survivors in cluster: 81
- Top-10 mean composite: **0.7901** (null mean 0.7725, null p95 0.7857, null p99.9 0.7993)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | TransUnion | `AdvertisingExpense` | 0.82 | 0.7946 | 0.6784 | 1.0 |
| 2 | Salesforce, Inc. | `AdvertisingExpense` | 0.8113 | 0.6105 | 0.7717 | 1.0 |
| 3 | TOYOTA MOTOR CORP/ | `AdvertisingExpense` | 0.8033 | 0.5152 | 0.8113 | 1.0 |
| 4 | EXPAND ENERGY Corp | `AccretionExpense` | 0.8025 | 0.7204 | 0.6811 | 1.0 |
| 5 | PFIZER INC | `AdvertisingExpense` | 0.7956 | 0.5045 | 0.7986 | 1.0 |
| 6 | COMCAST CORP | `AssetImpairmentCharges` | 0.7817 | 0.7051 | 0.6385 | 1.0 |
| 7 | BXP, Inc. | `AssetImpairmentCharges` | 0.7776 | 0.7259 | 0.6154 | 1.0 |
| 8 | RBC Bearings INC | `AssetImpairmentCharges` | 0.7776 | 0.7003 | 0.6314 | 1.0 |
| 9 | SUN COMMUNITIES INC | `AdvertisingExpense` | 0.7674 | 0.493 | 0.7354 | 1.0 |
| 10 | Brookfield Asset Management Ltd. | `GeneralAndAdministrativeExpense` | 0.7642 | 0.5705 | 0.679 | 1.0 |

**Cluster concept distribution:** `AdvertisingExpense` (40), `AssetImpairmentCharges` (31), `AccretionExpense` (6), `GeneralAndAdministrativeExpense` (3), `AccrualForEnvironmentalLossContingenciesChargesToExpenseForNewLosses` (1)

## 9. intangible+lived+amortization  [null]

- Token centroid: `intangible / lived / amortization`
- Concepts in cluster: 6
- Survivors in cluster: 77
- Top-10 mean composite: **0.7702** (null mean 0.7716, null p95 0.7831, null p99.9 0.7923)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | SYNOPSYS INC | `AmortizationOfIntangibleAssets` | 0.7913 | 0.6561 | 0.6932 | 1.0 |
| 2 | AGNC Investment Corp. | `AmortizationOfIntangibleAssets` | 0.7909 | 0.5562 | 0.7546 | 1.0 |
| 3 | CMS ENERGY CORP | `AmortizationOfIntangibleAssets` | 0.7709 | 0.6079 | 0.6722 | 1.0 |
| 4 | HP INC | `AmortizationOfAcquiredIntangibleAssets` | 0.7694 | 0.5916 | 0.6787 | 1.0 |
| 5 | COMCAST CORP | `AmortizationOfIntangibleAssets` | 0.7676 | 0.6973 | 0.6081 | 1.0 |
| 6 | METTLER TOLEDO INTERNATIONAL INC/ | `AmortizationOfIntangibleAssets` | 0.7668 | 0.6879 | 0.612 | 1.0 |
| 7 | Nextpower Inc. | `FiniteLivedIntangibleAssetsAmortizationExpenseYearFour` | 0.7662 | 0.6312 | 0.6459 | 1.0 |
| 8 | Ventas, Inc. | `AcquiredIndefiniteLivedIntangibleAssetAmount` | 0.7656 | 0.6824 | 0.6124 | 1.0 |
| 9 | XPO, Inc. | `AmortizationOfIntangibleAssets` | 0.7624 | 0.5938 | 0.6599 | 1.0 |
| 10 | CrowdStrike Holdings, Inc. | `AmortizationOfIntangibleAssets` | 0.7504 | 0.5997 | 0.6261 | 1.0 |

**Cluster concept distribution:** `AmortizationOfIntangibleAssets` (62), `AcquiredFiniteLivedIntangibleAssetAmount` (7), `AmortizationOfAcquiredIntangibleAssets` (5), `FiniteLivedIntangibleAssetsAmortizationExpenseYearFour` (1), `AcquiredIndefiniteLivedIntangibleAssetAmount` (1)

## 10. costs+of+amortization  [null]

- Token centroid: `costs / of / amortization`
- Concepts in cluster: 22
- Survivors in cluster: 71
- Top-10 mean composite: **0.7681** (null mean 0.7705, null p95 0.7843, null p99.9 0.7975)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | ERIE INDEMNITY CO | `AccretionAmortizationOfDiscountsAndPremiumsInvestments` | 0.8222 | 0.7072 | 0.7384 | 1.0 |
| 2 | MONOLITHIC POWER SYSTEMS INC | `AccretionAmortizationOfDiscountsAndPremiumsInvestments` | 0.7809 | 0.615 | 0.6929 | 1.0 |
| 3 | Ovintiv Inc. | `AcquisitionCostsCumulative` | 0.7736 | 0.7313 | 0.6019 | 1.0 |
| 4 | ARES CAPITAL CORP | `AccretionAmortizationOfDiscountsAndPremiumsInvestments` | 0.7642 | 0.6801 | 0.6105 | 1.0 |
| 5 | CENTERPOINT ENERGY INC | `AdvancesToAffiliate` | 0.7638 | 0.6389 | 0.6351 | 1.0 |
| 6 | United Airlines Holdings, Inc. | `AircraftRental` | 0.7632 | 0.6547 | 0.6237 | 1.0 |
| 7 | EXPAND ENERGY Corp | `AcquisitionCostsCumulative` | 0.7613 | 0.6878 | 0.5983 | 1.0 |
| 8 | Chubb Ltd | `AmortizationOfFinancingCostsAndDiscounts` | 0.7541 | 0.6408 | 0.6097 | 1.0 |
| 9 | Warner Bros. Discovery, Inc. | `AdvancesToAffiliate` | 0.7508 | 0.5607 | 0.6514 | 1.0 |
| 10 | Cheniere Energy Partners, L.P. | `AffiliateCosts` | 0.7473 | 0.6292 | 0.6 | 1.0 |

**Cluster concept distribution:** `AccretionAmortizationOfDiscountsAndPremiumsInvestments` (17), `AmortizationOfFinancingCostsAndDiscounts` (14), `AdvancesToAffiliate` (7), `AmortizationOfFinancingCosts` (4), `BuildingsAndImprovementsGross` (4)

## 11. obligation+retirement+asset  [null]

- Token centroid: `obligation / retirement / asset`
- Concepts in cluster: 9
- Survivors in cluster: 57
- Top-10 mean composite: **0.7655** (null mean 0.7655, null p95 0.7795, null p99.9 0.7961)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | AMERICAN ELECTRIC POWER CO INC | `AssetRetirementObligation` | 0.8588 | 1.0 | 0.6471 | 1.0 |
| 2 | WILLIAMS COMPANIES, INC. | `AssetRetirementObligationAccretionExpense` | 0.7729 | 0.6765 | 0.6344 | 1.0 |
| 3 | Targa Resources Corp. | `AssetRetirementObligationAccretionExpense` | 0.764 | 0.7214 | 0.584 | 1.0 |
| 4 | BROWN & BROWN, INC. | `AssetRetirementObligationAccretionExpense` | 0.7578 | 0.7058 | 0.5784 | 1.0 |
| 5 | Targa Resources Corp. | `AssetRetirementObligationCashPaidToSettle` | 0.7528 | 0.4642 | 0.717 | 1.0 |
| 6 | Talen Energy Corp | `AssetRetirementObligationAccretionExpense` | 0.7523 | 0.582 | 0.6419 | 1.0 |
| 7 | Ovintiv Inc. | `AssetRetirementObligationLiabilitiesSettled` | 0.7515 | 0.6295 | 0.6103 | 1.0 |
| 8 | Avery Dennison Corp | `AssetRetirementObligation` | 0.7505 | 0.4448 | 0.7234 | 1.0 |
| 9 | Ovintiv Inc. | `AssetRetirementObligationCurrent` | 0.75 | 0.6448 | 0.5971 | 1.0 |
| 10 | SOUTHERN COPPER CORP/ | `AssetRetirementObligationAccretionExpense` | 0.7447 | 0.5124 | 0.6666 | 1.0 |

**Cluster concept distribution:** `AssetRetirementObligationAccretionExpense` (22), `AssetRetirementObligation` (16), `AssetRetirementObligationLiabilitiesSettled` (5), `AssetRetirementObligationLiabilitiesIncurred` (5), `AssetRetirementObligationCurrent` (4)

## 12. cash+equivalents+restricted  [null]

- Token centroid: `cash / equivalents / restricted`
- Concepts in cluster: 11
- Survivors in cluster: 45
- Top-10 mean composite: **0.7412** (null mean 0.7603, null p95 0.7743, null p99.9 0.7851)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Trade Desk, Inc. | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` | 0.7776 | 0.6603 | 0.6563 | 1.0 |
| 2 | Tradeweb Markets Inc. | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect` | 0.7555 | 0.606 | 0.6349 | 1.0 |
| 3 | HUNT J B TRANSPORT SERVICES INC | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect` | 0.7459 | 0.6187 | 0.6031 | 1.0 |
| 4 | CARNIVAL PLC | `CashAndCashEquivalentsAtCarryingValue` | 0.7453 | 0.6101 | 0.607 | 1.0 |
| 5 | Circle Internet Group, Inc. | `CashAndCashEquivalentsAtCarryingValue` | 0.7424 | 0.6063 | 0.602 | 1.0 |
| 6 | Solventum Corp | `EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` | 0.7337 | 0.5268 | 0.6299 | 1.0 |
| 7 | DOLLAR GENERAL CORP | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect` | 0.7308 | 0.4676 | 0.6598 | 1.0 |
| 8 | Otis Worldwide Corp | `CashAndCashEquivalentsAtCarryingValue` | 0.7296 | 0.5398 | 0.6116 | 1.0 |
| 9 | HF Sinclair Corp | `CashAndCashEquivalentsAtCarryingValue` | 0.7269 | 0.5487 | 0.5994 | 1.0 |
| 10 | United States Oil Fund, LP | `Cash` | 0.7248 | 0.3973 | 0.6886 | 1.0 |

**Cluster concept distribution:** `CashAndCashEquivalentsAtCarryingValue` (16), `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect` (13), `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` (3), `CashAndCashEquivalentsPeriodIncreaseDecrease` (3), `Cash` (2)

## 13. payable+accounts+current  [null]

- Token centroid: `payable / accounts / current`
- Concepts in cluster: 8
- Survivors in cluster: 42
- Top-10 mean composite: **0.7657** (null mean 0.7586, null p95 0.7726, null p99.9 0.7817)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Veralto Corp | `AccountsPayableTradeCurrent` | 0.8093 | 0.7021 | 0.7095 | 1.0 |
| 2 | DuPont de Nemours, Inc. | `AccountsPayableOtherCurrent` | 0.7928 | 0.5445 | 0.7666 | 1.0 |
| 3 | TEVA PHARMACEUTICAL INDUSTRIES LTD | `AccountsPayableTradeCurrent` | 0.761 | 0.4299 | 0.7589 | 1.0 |
| 4 | United States Oil Fund, LP | `AccountsPayableOtherCurrentAndNoncurrent` | 0.761 | 0.477 | 0.7293 | 1.0 |
| 5 | RB GLOBAL INC. | `AccountsPayableOtherCurrent` | 0.7604 | 0.5989 | 0.6517 | 1.0 |
| 6 | CHEVRON CORP | `AccountsPayable` | 0.759 | 0.4441 | 0.745 | 1.0 |
| 7 | MARRIOTT INTERNATIONAL INC /MD/ | `AccountsPayableTradeCurrent` | 0.7589 | 0.5854 | 0.6563 | 1.0 |
| 8 | Brookfield Asset Management Ltd. | `AccountsPayableCurrentAndNoncurrent` | 0.7569 | 0.5125 | 0.697 | 1.0 |
| 9 | IDEX CORP /DE/ | `AccountsPayableTradeCurrent` | 0.7528 | 0.5814 | 0.6437 | 1.0 |
| 10 | NETFLIX INC | `AccountsPayable` | 0.7453 | 0.5051 | 0.6725 | 1.0 |

**Cluster concept distribution:** `AccountsPayableCurrent` (12), `AccountsPayableTradeCurrent` (8), `AccountsPayableOtherCurrent` (8), `AccountsPayable` (6), `AccountsPayableOtherCurrentAndNoncurrent` (3)

## 14. based+share+compensation  [null]

- Token centroid: `based / share / compensation`
- Concepts in cluster: 9
- Survivors in cluster: 37
- Top-10 mean composite: **0.7441** (null mean 0.7574, null p95 0.7717, null p99.9 0.7897)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Otis Worldwide Corp | `AllocatedShareBasedCompensationExpenseNetOfTax` | 0.7616 | 0.6481 | 0.6239 | 1.0 |
| 2 | Murphy USA Inc. | `AllocatedShareBasedCompensationExpenseNetOfTax` | 0.7616 | 0.5477 | 0.6866 | 1.0 |
| 3 | EBAY INC | `AociTaxAttributableToParent` | 0.7534 | 0.628 | 0.616 | 1.0 |
| 4 | BridgeBio Pharma, Inc. | `AdjustmentsToAdditionalPaidInCapitalShareBasedCompensationEmployeeStockPurchaseProgramRequisiteServicePeriodRecognition` | 0.7491 | 0.6592 | 0.5857 | 1.0 |
| 5 | SBA COMMUNICATIONS CORP | `AllocatedShareBasedCompensationExpenseNetOfTax` | 0.7477 | 0.6615 | 0.5808 | 1.0 |
| 6 | REPUBLIC SERVICES, INC. | `AllocatedShareBasedCompensationExpense` | 0.7396 | 0.5246 | 0.6461 | 1.0 |
| 7 | IRON MOUNTAIN INC | `AdjustmentsToAdditionalPaidInCapitalTaxEffectFromShareBasedCompensation` | 0.7382 | 0.4322 | 0.7005 | 1.0 |
| 8 | Everpure, Inc. | `AdjustmentsRelatedToTaxWithholdingForShareBasedCompensation` | 0.7327 | 0.5403 | 0.6192 | 1.0 |
| 9 | MICROCHIP TECHNOLOGY INC | `AdjustmentsToAdditionalPaidInCapitalTaxEffectFromShareBasedCompensation` | 0.7318 | 0.4134 | 0.6961 | 1.0 |
| 10 | NETFLIX INC | `AllocatedShareBasedCompensationExpenseNetOfTax` | 0.7254 | 0.504 | 0.6234 | 1.0 |

**Cluster concept distribution:** `AllocatedShareBasedCompensationExpenseNetOfTax` (12), `AllocatedShareBasedCompensationExpense` (8), `AdjustmentsToAdditionalPaidInCapitalTaxEffectFromShareBasedCompensation` (7), `AdjustmentToAdditionalPaidInCapitalIncomeTaxEffectFromShareBasedCompensationNet` (3), `AociTaxAttributableToParent` (2)

## 15. value+fair+disclosure  [null]

- Token centroid: `value / fair / disclosure`
- Concepts in cluster: 14
- Survivors in cluster: 26
- Top-10 mean composite: **0.7336** (null mean 0.7478, null p95 0.7609, null p99.9 0.7711)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | ORIX CORP | `AlternativeInvestmentsFairValueDisclosure` | 0.7616 | 0.5421 | 0.6901 | 1.0 |
| 2 | Chewy, Inc. | `CommonStockValue` | 0.749 | 0.6172 | 0.6117 | 1.0 |
| 3 | iShares Silver Trust | `FairValueOfAssetsAcquired` | 0.738 | 0.5082 | 0.6524 | 1.0 |
| 4 | Veralto Corp | `CommonStockValue` | 0.7349 | 0.6155 | 0.5776 | 1.0 |
| 5 | BERKLEY W R CORP | `AssetsFairValueDisclosureRecurring` | 0.7312 | 0.4802 | 0.6529 | 1.0 |
| 6 | Trade Desk, Inc. | `CommonStockValue` | 0.7281 | 0.5701 | 0.5889 | 1.0 |
| 7 | United States Oil Fund, LP | `FairValueAssetsLevel2ToLevel1TransfersAmount` | 0.7252 | 0.4279 | 0.6706 | 1.0 |
| 8 | MCKESSON CORP | `AssetsFairValueAdjustment` | 0.7232 | 0.4756 | 0.6357 | 1.0 |
| 9 | Strategy Inc | `AssetsFairValueDisclosureNonrecurring` | 0.7227 | 0.5323 | 0.5991 | 1.0 |
| 10 | Super Micro Computer, Inc. | `AccruedLiabilitiesFairValueDisclosure` | 0.7222 | 0.3858 | 0.6895 | 1.0 |

**Cluster concept distribution:** `CommonStockValue` (4), `AssetsFairValueDisclosureNonrecurring` (4), `AdditionalCollateralAggregateFairValue` (3), `AssetsFairValueDisclosure` (3), `AlternativeInvestmentsFairValueDisclosure` (2)

## 16. receivable+accounts+net  [null]

- Token centroid: `receivable / accounts / net`
- Concepts in cluster: 7
- Survivors in cluster: 23
- Top-10 mean composite: **0.7298** (null mean 0.7457, null p95 0.7604, null p99.9 0.7745)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Parker-Hannifin Corp | `AccountsReceivableGrossCurrent` | 0.75 | 0.4845 | 0.6973 | 1.0 |
| 2 | Sunoco LP | `AccountsReceivableGrossCurrent` | 0.7464 | 0.4626 | 0.7018 | 1.0 |
| 3 | Johnson Controls International plc | `AccountsReceivableSale` | 0.7376 | 0.3861 | 0.7277 | 1.0 |
| 4 | SCHWAB CHARLES CORP | `AlternativeExcessNetCapital` | 0.7341 | 0.6173 | 0.5744 | 1.0 |
| 5 | INSULET CORP | `AccountsReceivableGrossCurrent` | 0.7287 | 0.3972 | 0.6985 | 1.0 |
| 6 | Apple Inc. | `AccountsReceivableNetCurrent` | 0.7252 | 0.444 | 0.6605 | 1.0 |
| 7 | LATTICE SEMICONDUCTOR CORP | `AccountsReceivableNetCurrent` | 0.7218 | 0.3718 | 0.6972 | 1.0 |
| 8 | Otis Worldwide Corp | `AccountsReceivableNetCurrent` | 0.721 | 0.421 | 0.6645 | 1.0 |
| 9 | VALERO ENERGY CORP/TX | `AccountsReceivableNetCurrent` | 0.7168 | 0.4634 | 0.6274 | 1.0 |
| 10 | FRANKLIN RESOURCES INC | `AccountsReceivableNet` | 0.7165 | 0.4567 | 0.6307 | 1.0 |

**Cluster concept distribution:** `AccountsReceivableNetCurrent` (12), `AccountsReceivableGrossCurrent` (3), `AccountsReceivableNet` (3), `AccountsReceivableSale` (2), `AlternativeExcessNetCapital` (1)

## 17. minimum+future+leases  [PASS p<0.05]

- Token centroid: `minimum / future / leases`
- Concepts in cluster: 4
- Survivors in cluster: 22
- Top-10 mean composite: **0.7616** (null mean 0.7453, null p95 0.759, null p99.9 0.7733)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | CHARTER COMMUNICATIONS, INC. /MO/ | `CapitalLeasesFutureMinimumPaymentsDue` | 0.7862 | 0.7595 | 0.6158 | 1.0 |
| 2 | HOME DEPOT, INC. | `CapitalLeasesFutureMinimumPaymentsDueCurrent` | 0.7834 | 0.5858 | 0.7173 | 1.0 |
| 3 | MADRIGAL PHARMACEUTICALS, INC. | `CapitalLeasesFutureMinimumPaymentsDue` | 0.7758 | 0.6512 | 0.6576 | 1.0 |
| 4 | HOME DEPOT, INC. | `CapitalLeasesFutureMinimumPaymentsDue` | 0.7711 | 0.5708 | 0.6961 | 1.0 |
| 5 | KROGER CO | `CapitalLeasesFutureMinimumPaymentsDue` | 0.758 | 0.5687 | 0.6646 | 1.0 |
| 6 | Medpace Holdings, Inc. | `CapitalLeasesFutureMinimumPaymentsDueInFourYears` | 0.756 | 0.5683 | 0.6599 | 1.0 |
| 7 | CHARTER COMMUNICATIONS, INC. /MO/ | `CapitalLeasesFutureMinimumPaymentsDueInFiveYears` | 0.7488 | 0.5985 | 0.6228 | 1.0 |
| 8 | HORMEL FOODS CORP /DE/ | `CapitalLeasesFutureMinimumPaymentsDueInFourYears` | 0.7472 | 0.5936 | 0.6219 | 1.0 |
| 9 | AVALONBAY COMMUNITIES INC | `CapitalLeasesFutureMinimumPaymentsDueInFourYears` | 0.7467 | 0.5949 | 0.62 | 1.0 |
| 10 | CARVANA CO. | `CapitalLeasesFutureMinimumPaymentsDue` | 0.7425 | 0.5973 | 0.608 | 1.0 |

**Cluster concept distribution:** `CapitalLeasesFutureMinimumPaymentsDue` (8), `CapitalLeasesFutureMinimumPaymentsDueInFourYears` (8), `CapitalLeasesFutureMinimumPaymentsDueCurrent` (3), `CapitalLeasesFutureMinimumPaymentsDueInFiveYears` (3)

## 18. securities+available+sale  [null]

- Token centroid: `securities / available / sale`
- Concepts in cluster: 13
- Survivors in cluster: 20
- Top-10 mean composite: **0.7341** (null mean 0.7426, null p95 0.7573, null p99.9 0.7719)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | OLD REPUBLIC INTERNATIONAL CORP | `AvailableForSaleSecuritiesContinuousUnrealizedLossPositionLessThan12MonthsAggregateLosses` | 0.7702 | 0.7 | 0.6131 | 1.0 |
| 2 | Viatris Inc | `AvailableForSaleSecuritiesCurrent` | 0.7655 | 0.5623 | 0.6873 | 1.0 |
| 3 | UNITED PARCEL SERVICE INC | `AvailableForSaleEquitySecuritiesAmortizedCostBasis` | 0.7417 | 0.4897 | 0.6732 | 1.0 |
| 4 | INTUIT INC. | `AvailableForSaleSecurities` | 0.7355 | 0.4409 | 0.6883 | 1.0 |
| 5 | CINTAS CORP | `AvailableForSaleSecuritiesDebtSecuritiesCurrent` | 0.7328 | 0.5012 | 0.6437 | 1.0 |
| 6 | GOLDMAN SACHS GROUP INC | `AvailableForSaleSecuritiesDebtSecurities` | 0.7273 | 0.4931 | 0.635 | 1.0 |
| 7 | CENTENE CORP | `AvailableForSaleSecuritiesAmortizedCost` | 0.7201 | 0.54 | 0.5878 | 1.0 |
| 8 | NIKE, Inc. | `AvailableForSaleSecurities` | 0.7176 | 0.4237 | 0.6543 | 1.0 |
| 9 | NEWS CORP | `AvailableForSaleSecuritiesEquitySecuritiesNoncurrent` | 0.7171 | 0.4082 | 0.6625 | 1.0 |
| 10 | HALLIBURTON CO | `AvailableForSaleSecuritiesNoncurrent` | 0.7136 | 0.433 | 0.6383 | 1.0 |

**Cluster concept distribution:** `AvailableForSaleSecurities` (3), `AvailableForSaleSecuritiesDebtSecurities` (3), `AvailableForSaleSecuritiesCurrent` (2), `AvailableForSaleSecuritiesDebtSecuritiesCurrent` (2), `AvailableForSaleSecuritiesAmortizedCost` (2)

## 19. unrealized+gross+available  [null]

- Token centroid: `unrealized / gross / available`
- Concepts in cluster: 8
- Survivors in cluster: 19
- Top-10 mean composite: **0.7267** (null mean 0.7416, null p95 0.7557, null p99.9 0.7698)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | GOLDMAN SACHS GROUP INC | `AvailableForSaleDebtSecuritiesGrossUnrealizedGain` | 0.7447 | 0.6126 | 0.6037 | 1.0 |
| 2 | F5, INC. | `AvailableForSaleSecuritiesContinuousUnrealizedLossPositionAccumulatedLoss` | 0.7361 | 0.4832 | 0.6633 | 1.0 |
| 3 | FASTENAL CO | `AvailableForSaleSecuritiesGrossUnrealizedLoss` | 0.7304 | 0.4324 | 0.6807 | 1.0 |
| 4 | EVEREST GROUP, LTD. | `AvailableForSaleSecuritiesAccumulatedGrossUnrealizedLossBeforeTax` | 0.7272 | 0.5307 | 0.6114 | 1.0 |
| 5 | Zoetis Inc. | `AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedGainBeforeTax` | 0.7271 | 0.5565 | 0.5949 | 1.0 |
| 6 | DAVITA INC. | `AvailableForSaleSecuritiesAccumulatedGrossUnrealizedGainLossBeforeTax` | 0.7269 | 0.5552 | 0.5952 | 1.0 |
| 7 | Rubrik, Inc. | `AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedLossBeforeTax` | 0.7217 | 0.4791 | 0.6298 | 1.0 |
| 8 | BERKSHIRE HATHAWAY INC | `AvailableForSaleSecuritiesGrossUnrealizedLosses1` | 0.721 | 0.517 | 0.6043 | 1.0 |
| 9 | GLOBE LIFE INC. | `AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedGainBeforeTax` | 0.7162 | 0.4963 | 0.6053 | 1.0 |
| 10 | Medtronic plc | `AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedGainBeforeTax` | 0.7159 | 0.4805 | 0.6144 | 1.0 |

**Cluster concept distribution:** `AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedGainBeforeTax` (9), `AvailableForSaleSecuritiesAccumulatedGrossUnrealizedLossBeforeTax` (3), `AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedLossBeforeTax` (2), `AvailableForSaleDebtSecuritiesGrossUnrealizedGain` (1), `AvailableForSaleSecuritiesContinuousUnrealizedLossPositionAccumulatedLoss` (1)

## 20. maturities+debt+available  [null]

- Token centroid: `maturities / debt / available`
- Concepts in cluster: 8
- Survivors in cluster: 19
- Top-10 mean composite: **0.7206** (null mean 0.7416, null p95 0.7557, null p99.9 0.7651)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | SYSCO CORP | `AvailableForSaleSecuritiesDebtMaturitiesWithinOneYearAmortizedCost` | 0.7328 | 0.4085 | 0.7017 | 1.0 |
| 2 | Bank of New York Mellon Corp | `AvailableForSaleSecuritiesDebtMaturitiesAfterFiveThroughTenYearsFairValue` | 0.7302 | 0.4773 | 0.6523 | 1.0 |
| 3 | KKR & Co. Inc. | `AvailableForSaleSecuritiesDebtMaturitiesAfterFiveThroughTenYearsAmortizedCost` | 0.7294 | 0.442 | 0.6722 | 1.0 |
| 4 | GOLDMAN SACHS GROUP INC | `AvailableForSaleDebtSecuritiesAmortizedCostBasis` | 0.7256 | 0.5571 | 0.5909 | 1.0 |
| 5 | ALNYLAM PHARMACEUTICALS, INC. | `AvailableForSaleSecuritiesDebtMaturitiesWithinOneYearAmortizedCost` | 0.7229 | 0.4066 | 0.678 | 1.0 |
| 6 | Arista Networks, Inc. | `AvailableForSaleSecuritiesDebtMaturitiesNextRollingTwelveMonthsAmortizedCostBasis` | 0.7181 | 0.367 | 0.6908 | 1.0 |
| 7 | COSTCO WHOLESALE CORP /NEW | `AvailableForSaleSecuritiesDebtMaturitiesAfterFiveThroughTenYearsFairValue` | 0.7161 | 0.4247 | 0.6498 | 1.0 |
| 8 | BERKSHIRE HATHAWAY INC | `AvailableForSaleSecuritiesDebtMaturitiesNextRollingTwelveMonthsAmortizedCostBasis` | 0.7131 | 0.5068 | 0.5911 | 1.0 |
| 9 | BERKSHIRE HATHAWAY INC | `AvailableForSaleSecuritiesDebtMaturitiesRollingYearTwoThroughFiveFairValue` | 0.7102 | 0.368 | 0.6704 | 1.0 |
| 10 | AMERICAN FINANCIAL GROUP INC | `AvailableForSaleSecuritiesDebtMaturitiesAfterFiveThroughTenYearsAmortizedCost` | 0.7078 | 0.45 | 0.6133 | 1.0 |

**Cluster concept distribution:** `AvailableForSaleDebtSecuritiesAmortizedCostBasis` (5), `AvailableForSaleSecuritiesDebtMaturitiesWithinOneYearAmortizedCost` (3), `AvailableForSaleSecuritiesDebtMaturitiesAfterFiveThroughTenYearsFairValue` (3), `AvailableForSaleSecuritiesDebtMaturitiesAfterFiveThroughTenYearsAmortizedCost` (3), `AvailableForSaleSecuritiesDebtMaturitiesNextRollingTwelveMonthsAmortizedCostBasis` (2)

## 21. depreciation+amortization+and  [null]

- Token centroid: `depreciation / amortization / and`
- Concepts in cluster: 6
- Survivors in cluster: 17
- Top-10 mean composite: **0.7305** (null mean 0.7385, null p95 0.7529, null p99.9 0.7664)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | BlackRock, Inc. | `DepreciationAmortizationAndAccretionNet` | 0.7503 | 0.6032 | 0.6237 | 1.0 |
| 2 | Live Nation Entertainment, Inc. | `AdjustmentForAmortization` | 0.7417 | 0.4439 | 0.7018 | 1.0 |
| 3 | United Airlines Holdings, Inc. | `AircraftMaintenanceMaterialsAndRepairs` | 0.7399 | 0.6369 | 0.5768 | 1.0 |
| 4 | Merck & Co., Inc. | `AdjustmentForAmortization` | 0.7333 | 0.5765 | 0.598 | 1.0 |
| 5 | CrowdStrike Holdings, Inc. | `AdjustmentForAmortization` | 0.7333 | 0.4371 | 0.6851 | 1.0 |
| 6 | M&T BANK CORP | `AdjustmentForAmortization` | 0.7319 | 0.5062 | 0.6383 | 1.0 |
| 7 | CARNIVAL PLC | `DepreciationAndAmortization` | 0.7225 | 0.4307 | 0.6621 | 1.0 |
| 8 | TERADYNE, INC | `AdjustmentForAmortization` | 0.7216 | 0.4851 | 0.6257 | 1.0 |
| 9 | Allegion plc | `AdjustmentForAmortization` | 0.7156 | 0.4552 | 0.6295 | 1.0 |
| 10 | Pinnacle Financial Partners, Inc. | `AdjustmentForAmortization` | 0.7152 | 0.4295 | 0.6445 | 1.0 |

**Cluster concept distribution:** `AdjustmentForAmortization` (11), `DepreciationAndAmortization` (2), `DepreciationAmortizationAndAccretionNet` (1), `AircraftMaintenanceMaterialsAndRepairs` (1), `DepreciationDepletionAndAmortization` (1)

## 22. environmental+contingencies+loss  [null]

- Token centroid: `environmental / contingencies / loss`
- Concepts in cluster: 8
- Survivors in cluster: 17
- Top-10 mean composite: **0.7178** (null mean 0.7393, null p95 0.7546, null p99.9 0.7685)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | EXELON CORP | `AccrualForEnvironmentalLossContingencies` | 0.751 | 0.5543 | 0.656 | 1.0 |
| 2 | Sandisk Corp | `GoodwillImpairmentLoss` | 0.7236 | 0.4577 | 0.6479 | 1.0 |
| 3 | DOW INC. | `AccrualForEnvironmentalLossContingenciesIncreaseDecreaseForRevisionInEstimates` | 0.7173 | 0.5241 | 0.5908 | 1.0 |
| 4 | MUELLER INDUSTRIES INC | `AccrualForEnvironmentalLossContingenciesUndiscountedDueInThirdYear` | 0.7146 | 0.5392 | 0.5744 | 1.0 |
| 5 | FREEPORT-MCMORAN INC | `AccrualForEnvironmentalLossContingenciesPayments` | 0.7128 | 0.4597 | 0.6196 | 1.0 |
| 6 | Howmet Aerospace Inc. | `AccrualForEnvironmentalLossContingenciesPayments` | 0.7123 | 0.3605 | 0.6805 | 1.0 |
| 7 | STANLEY BLACK & DECKER, INC. | `AccrualForEnvironmentalLossContingenciesUndiscountedDueInThirdYear` | 0.7122 | 0.3969 | 0.6574 | 1.0 |
| 8 | INTERNATIONAL BUSINESS MACHINES CORP | `AccruedEnvironmentalLossContingenciesNoncurrent` | 0.7119 | 0.5262 | 0.5758 | 1.0 |
| 9 | NORTHROP GRUMMAN CORP /DE/ | `AccruedEnvironmentalLossContingenciesNoncurrent` | 0.7111 | 0.4859 | 0.5991 | 1.0 |
| 10 | Tesla, Inc. | `AccrualForEnvironmentalLossContingenciesPayments` | 0.7108 | 0.427 | 0.6351 | 1.0 |

**Cluster concept distribution:** `AccrualForEnvironmentalLossContingenciesPayments` (4), `AccruedEnvironmentalLossContingenciesNoncurrent` (4), `AccrualForEnvironmentalLossContingencies` (3), `AccrualForEnvironmentalLossContingenciesUndiscountedDueInThirdYear` (2), `GoodwillImpairmentLoss` (1)

## 23. related+parties+accounts  [null]

- Token centroid: `related / parties / accounts`
- Concepts in cluster: 5
- Survivors in cluster: 14
- Top-10 mean composite: **0.7321** (null mean 0.7345, null p95 0.7492, null p99.9 0.7607)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Solventum Corp | `EmployeeRelatedLiabilitiesCurrent` | 0.7693 | 0.5721 | 0.6907 | 1.0 |
| 2 | MICRON TECHNOLOGY INC | `AccountsPayableRelatedPartiesCurrent` | 0.7541 | 0.4308 | 0.7409 | 1.0 |
| 3 | KINDER MORGAN, INC. | `AccountsReceivableRelatedPartiesCurrent` | 0.7423 | 0.589 | 0.6127 | 1.0 |
| 4 | ADVANCED MICRO DEVICES INC | `AccountsPayableRelatedPartiesCurrent` | 0.7415 | 0.5831 | 0.6143 | 1.0 |
| 5 | IRON MOUNTAIN INC | `AccountsPayableRelatedPartiesCurrent` | 0.7399 | 0.5151 | 0.6529 | 1.0 |
| 6 | Grayscale Bitcoin Trust ETF | `AccountsPayableRelatedPartiesCurrentAndNoncurrent` | 0.725 | 0.3807 | 0.6996 | 1.0 |
| 7 | WESTLAKE CORP | `AccountsReceivableRelatedPartiesCurrent` | 0.7154 | 0.4907 | 0.6068 | 1.0 |
| 8 | EXELON CORP | `AccountsPayableRelatedPartiesCurrent` | 0.7134 | 0.4217 | 0.6449 | 1.0 |
| 9 | Antero Midstream Corp | `AccountsPayableRelatedPartiesCurrent` | 0.711 | 0.4409 | 0.627 | 1.0 |
| 10 | Elanco Animal Health Inc | `AccountsPayableRelatedPartiesCurrent` | 0.7091 | 0.4526 | 0.6148 | 1.0 |

**Cluster concept distribution:** `AccountsPayableRelatedPartiesCurrent` (9), `AccountsReceivableRelatedPartiesCurrent` (2), `EmployeeRelatedLiabilitiesCurrent` (1), `AccountsPayableRelatedPartiesCurrentAndNoncurrent` (1), `IncreaseDecreaseInAccountsPayableRelatedParties` (1)

## 24. used+activities+provided  [null]

- Token centroid: `used / activities / provided`
- Concepts in cluster: 5
- Survivors in cluster: 14
- Top-10 mean composite: **0.7306** (null mean 0.7347, null p95 0.7486, null p99.9 0.7578)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | CENTENE CORP | `AdjustmentsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivities` | 0.7629 | 0.6863 | 0.6034 | 1.0 |
| 2 | HP INC | `AdjustmentsNoncashItemsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivitiesOther` | 0.7323 | 0.5521 | 0.6108 | 1.0 |
| 3 | CUMMINS INC | `AdjustmentsNoncashItemsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivities` | 0.7319 | 0.5784 | 0.5932 | 1.0 |
| 4 | Li Auto Inc. | `CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations` | 0.731 | 0.4405 | 0.6772 | 1.0 |
| 5 | PRINCIPAL FINANCIAL GROUP INC | `AdjustmentsNoncashItemsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivitiesOther` | 0.7308 | 0.4175 | 0.6911 | 1.0 |
| 6 | Paramount Skydance Corp | `NetCashProvidedByUsedInFinancingActivities` | 0.73 | 0.4117 | 0.6928 | 1.0 |
| 7 | FIRST SOLAR, INC. | `AdjustmentsNoncashItemsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivitiesOther` | 0.7244 | 0.5918 | 0.5661 | 1.0 |
| 8 | JONES LANG LASALLE INC | `AdjustmentsNoncashItemsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivities` | 0.7234 | 0.5728 | 0.5755 | 1.0 |
| 9 | SPX Technologies, Inc. | `AdjustmentsNoncashItemsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivitiesOther` | 0.7206 | 0.5355 | 0.5918 | 1.0 |
| 10 | Rocket Companies, Inc. | `AdjustmentsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivities` | 0.7191 | 0.4287 | 0.6549 | 1.0 |

**Cluster concept distribution:** `AdjustmentsNoncashItemsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivitiesOther` (7), `AdjustmentsNoncashItemsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivities` (3), `AdjustmentsToReconcileNetIncomeLossToCashProvidedByUsedInOperatingActivities` (2), `CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations` (1), `NetCashProvidedByUsedInFinancingActivities` (1)

## 25. price+purchase+allocation  [null]

- Token centroid: `price / purchase / allocation`
- Concepts in cluster: 9
- Survivors in cluster: 14
- Top-10 mean composite: **0.7283** (null mean 0.7338, null p95 0.7485, null p99.9 0.7594)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | NVR INC | `BusinessAcquisitionPurchasePriceAllocationAssetsAcquired` | 0.7842 | 0.6987 | 0.649 | 1.0 |
| 2 | TransUnion | `BusinessAcquisitionPurchasePriceAllocationAmortizableIntangibleAssets` | 0.7346 | 0.4259 | 0.6952 | 1.0 |
| 3 | Carlyle Group Inc. | `BusinessAcquisitionPurchasePriceAllocationCurrentAssetsMarketableSecurities` | 0.7329 | 0.4284 | 0.6894 | 1.0 |
| 4 | ENSIGN GROUP, INC | `BusinessAcquisitionCostOfAcquiredEntityPurchasePrice` | 0.7322 | 0.3884 | 0.7127 | 1.0 |
| 5 | Carlyle Group Inc. | `BusinessAcquisitionPurchasePriceAllocationCurrentAssetsCashAndCashEquivalents` | 0.7284 | 0.4197 | 0.6836 | 1.0 |
| 6 | RBC Bearings INC | `BusinessAcquisitionPurchasePriceAllocationAssetsAcquired` | 0.7215 | 0.4348 | 0.6571 | 1.0 |
| 7 | Arthur J. Gallagher & Co. | `BusinessAcquisitionPurchasePriceAllocationCurrentLiabilities` | 0.7153 | 0.3921 | 0.6682 | 1.0 |
| 8 | CASEYS GENERAL STORES INC | `BusinessAcquisitionPurchasePriceAllocationNetTangibleAssets` | 0.7146 | 0.5302 | 0.5802 | 1.0 |
| 9 | Arthur J. Gallagher & Co. | `BusinessAcquisitionPurchasePriceAllocationCurrentLiabilitiesAccruedLiabilities` | 0.7099 | 0.4085 | 0.6444 | 1.0 |
| 10 | ALTRIA GROUP, INC. | `BusinessAcquisitionCostOfAcquiredEntityPurchasePrice` | 0.7096 | 0.3932 | 0.6531 | 1.0 |

**Cluster concept distribution:** `BusinessAcquisitionPurchasePriceAllocationAmortizableIntangibleAssets` (3), `BusinessAcquisitionCostOfAcquiredEntityPurchasePrice` (3), `BusinessAcquisitionPurchasePriceAllocationAssetsAcquired` (2), `BusinessAcquisitionPurchasePriceAllocationCurrentAssetsMarketableSecurities` (1), `BusinessAcquisitionPurchasePriceAllocationCurrentAssetsCashAndCashEquivalents` (1)

## 26. allowance+receivables+doubtful  [null]

- Token centroid: `allowance / receivables / doubtful`
- Concepts in cluster: 6
- Survivors in cluster: 14
- Top-10 mean composite: **0.7241** (null mean 0.7339, null p95 0.7484, null p99.9 0.759)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | IES Holdings, Inc. | `AccountsAndOtherReceivablesNetCurrent` | 0.7412 | 0.5746 | 0.6189 | 1.0 |
| 2 | SOUTHWEST AIRLINES CO | `AccountsAndOtherReceivablesNetCurrent` | 0.7347 | 0.5417 | 0.6232 | 1.0 |
| 3 | MARTIN MARIETTA MATERIALS INC | `AccountsAndOtherReceivablesNetCurrent` | 0.7309 | 0.534 | 0.6184 | 1.0 |
| 4 | WEYERHAEUSER CO | `AllowanceForDoubtfulAccountsReceivableCurrent` | 0.7268 | 0.3852 | 0.7013 | 1.0 |
| 5 | INSULET CORP | `AllowanceForDoubtfulOtherReceivablesCurrent` | 0.7265 | 0.5403 | 0.6036 | 1.0 |
| 6 | Ally Financial Inc. | `AccountsAndOtherReceivablesNetCurrent` | 0.7248 | 0.5026 | 0.6228 | 1.0 |
| 7 | SOUTHERN COPPER CORP/ | `AllowanceForDoubtfulAccountsReceivableCurrent` | 0.7185 | 0.3935 | 0.6754 | 1.0 |
| 8 | Cigna Group | `AllowanceForDoubtfulAccountsReceivable` | 0.7153 | 0.3996 | 0.6636 | 1.0 |
| 9 | AbbVie Inc. | `AccountsAndOtherReceivablesNetCurrent` | 0.7119 | 0.4662 | 0.6134 | 1.0 |
| 10 | Booz Allen Hamilton Holding Corp | `BilledContractReceivables` | 0.7104 | 0.5043 | 0.5858 | 1.0 |

**Cluster concept distribution:** `AccountsAndOtherReceivablesNetCurrent` (6), `AllowanceForDoubtfulAccountsReceivableCurrent` (3), `AllowanceForDoubtfulOtherReceivablesCurrent` (2), `AllowanceForDoubtfulAccountsReceivable` (1), `BilledContractReceivables` (1)

## 27. capitalized+contract+cost  [null]

- Token centroid: `capitalized / contract / cost`
- Concepts in cluster: 10
- Survivors in cluster: 12
- Top-10 mean composite: **0.7248** (null mean 0.731, null p95 0.7446, null p99.9 0.7549)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Dynatrace, Inc. | `CapitalizedContractCostNetCurrent` | 0.756 | 0.6151 | 0.6306 | 1.0 |
| 2 | Samsara Inc. | `ContractWithCustomerLiabilityCurrent` | 0.7433 | 0.4805 | 0.683 | 1.0 |
| 3 | MongoDB, Inc. | `CapitalizedContractCostNet` | 0.7296 | 0.4356 | 0.6768 | 1.0 |
| 4 | Ovintiv Inc. | `CapitalizedCostsMineralInterestsInProvedProperties` | 0.7284 | 0.5302 | 0.6146 | 1.0 |
| 5 | Interactive Brokers Group, Inc. | `CapitalizedComputerSoftwareGross` | 0.7232 | 0.4998 | 0.6206 | 1.0 |
| 6 | AECOM | `BillingsInExcessOfCost` | 0.7176 | 0.5253 | 0.5908 | 1.0 |
| 7 | Crane Co | `ContractWithCustomerLiabilityCurrent` | 0.7167 | 0.4916 | 0.6095 | 1.0 |
| 8 | Unity Software Inc. | `CapitalizedContractCostAmortization` | 0.714 | 0.4793 | 0.6105 | 1.0 |
| 9 | Qnity Electronics, Inc. | `DefinedBenefitPlanNetPeriodicBenefitCost` | 0.7122 | 0.3676 | 0.6758 | 1.0 |
| 10 | Karman Holdings Inc. | `ContractWithCustomerAssetReclassifiedToReceivable` | 0.7065 | 0.3919 | 0.6464 | 1.0 |

**Cluster concept distribution:** `CapitalizedContractCostNetCurrent` (2), `ContractWithCustomerLiabilityCurrent` (2), `CapitalizedContractCostNet` (1), `CapitalizedCostsMineralInterestsInProvedProperties` (1), `CapitalizedComputerSoftwareGross` (1)

## 28. loan+allowance+losses  [null]

- Token centroid: `loan / allowance / losses`
- Concepts in cluster: 8
- Survivors in cluster: 11
- Top-10 mean composite: **0.7257** (null mean 0.7285, null p95 0.7413, null p99.9 0.7507)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | EAST WEST BANCORP INC | `AdvancesFromFederalHomeLoanBanks` | 0.7547 | 0.6148 | 0.6275 | 1.0 |
| 2 | HARTFORD INSURANCE GROUP, INC. | `AdvancesFromFederalHomeLoanBanks` | 0.7318 | 0.5791 | 0.5926 | 1.0 |
| 3 | REGIONS FINANCIAL CORP | `AllowanceForLoanAndLeaseLossesPeriodIncreaseDecrease` | 0.7316 | 0.4777 | 0.6555 | 1.0 |
| 4 | Pinnacle Financial Partners, Inc. | `AdvancesFromFederalHomeLoanBanks` | 0.7314 | 0.5326 | 0.6205 | 1.0 |
| 5 | Eaton Corp plc | `BridgeLoan` | 0.7299 | 0.4283 | 0.6822 | 1.0 |
| 6 | BERKLEY W R CORP | `AllowanceForLoanAndLeaseLossesPeriodIncreaseDecrease` | 0.7218 | 0.4652 | 0.6386 | 1.0 |
| 7 | SBA COMMUNICATIONS CORP | `AllowanceForLoanAndLeaseLossesForeignCurrencyTranslation` | 0.7187 | 0.4416 | 0.6457 | 1.0 |
| 8 | SCHWAB CHARLES CORP | `AllowanceForLoanAndLeaseLossRecoveryOfBadDebts` | 0.7141 | 0.4059 | 0.6566 | 1.0 |
| 9 | NVR INC | `AllowanceForLoanAndLeaseLossesRealEstate` | 0.7131 | 0.4147 | 0.6486 | 1.0 |
| 10 | REINSURANCE GROUP OF AMERICA INC | `AllowanceForLoanAndLeaseLossesRecoveriesOfBadDebts` | 0.7103 | 0.4168 | 0.6401 | 1.0 |

**Cluster concept distribution:** `AdvancesFromFederalHomeLoanBanks` (3), `AllowanceForLoanAndLeaseLossesPeriodIncreaseDecrease` (2), `BridgeLoan` (1), `AllowanceForLoanAndLeaseLossesForeignCurrencyTranslation` (1), `AllowanceForLoanAndLeaseLossRecoveryOfBadDebts` (1)

## 29. method+housing+affordable  [PASS p<0.05]

- Token centroid: `method / housing / affordable`
- Concepts in cluster: 4
- Survivors in cluster: 10
- Top-10 mean composite: **0.7383** (null mean 0.7267, null p95 0.7381, null p99.9 0.7495)

### Top-10 named signals

| # | Company | Concept | composite | anom | recon | div |
|---|---|---|---|---|---|---|
| 1 | Ally Financial Inc. | `AmortizationMethodQualifiedAffordableHousingProjectInvestmentsAmortization` | 0.7938 | 0.7667 | 0.6303 | 1.0 |
| 2 | BANK OF AMERICA CORP /DE/ | `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` | 0.7813 | 0.5062 | 0.7618 | 1.0 |
| 3 | SouthState Bank Corp | `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` | 0.7808 | 0.6992 | 0.64 | 1.0 |
| 4 | AMERICAN EXPRESS CO | `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` | 0.7356 | 0.5171 | 0.6408 | 1.0 |
| 5 | PRUDENTIAL FINANCIAL INC | `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` | 0.7348 | 0.4167 | 0.7015 | 1.0 |
| 6 | Brookfield Asset Management Ltd. | `IncomeLossFromEquityMethodInvestments` | 0.7265 | 0.5337 | 0.6078 | 1.0 |
| 7 | Ally Financial Inc. | `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` | 0.717 | 0.5033 | 0.603 | 1.0 |
| 8 | Bank of New York Mellon Corp | `AmortizationMethodQualifiedAffordableHousingProjectInvestments` | 0.7094 | 0.3937 | 0.6525 | 1.0 |
| 9 | Bank of New York Mellon Corp | `AmortizationMethodQualifiedAffordableHousingProjectInvestmentsAmortization` | 0.7026 | 0.3513 | 0.6618 | 1.0 |
| 10 | M&T BANK CORP | `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` | 0.7015 | 0.3667 | 0.6496 | 1.0 |

**Cluster concept distribution:** `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` (6), `AmortizationMethodQualifiedAffordableHousingProjectInvestmentsAmortization` (2), `IncomeLossFromEquityMethodInvestments` (1), `AmortizationMethodQualifiedAffordableHousingProjectInvestments` (1)
