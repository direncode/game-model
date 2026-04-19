# EDGAR Categorical Signal Probes

Source: **BTUT 4,999-survivor run** on full 61,041 EDGAR entities.  
Probes: **10** categorical lenses. Each probe filters survivors whose XBRL concept matches the category, then ranks by a category-specific weighting of the 4 BTUT score dimensions.

## Accounting Discrepancies

**Soft-estimate accounts prone to management discretion: ARO, goodwill, impairment, valuation allowance, intangibles amortization.**  
Hits matching category: **142**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | AMERICAN ELECTRIC POWER CO INC | `AssetRetirementObligation` | 0.8941 | 1.0 | 0.6471 | 1.0 | Electric Services |
| 2 | SYNOPSYS INC | `AmortizationOfIntangibleAssets` | 0.736 | 0.6561 | 0.6932 | 1.0 | Prepackaged Software |
| 3 | Targa Resources Corp. | `AssetRetirementObligationAccretionExpense` | 0.7359 | 0.7214 | 0.584 | 1.0 |  |
| 4 | COMCAST CORP | `AmortizationOfIntangibleAssets` | 0.7311 | 0.6973 | 0.6081 | 1.0 |  |
| 5 | WILLIAMS COMPANIES, INC. | `AssetRetirementObligationAccretionExpense` | 0.7286 | 0.6765 | 0.6344 | 1.0 |  |
| 6 | METTLER TOLEDO INTERNATIONAL INC/ | `AmortizationOfIntangibleAssets` | 0.7275 | 0.6879 | 0.612 | 1.0 |  |
| 7 | BROWN & BROWN, INC. | `AssetRetirementObligationAccretionExpense` | 0.7264 | 0.7058 | 0.5784 | 1.0 |  |
| 8 | Ventas, Inc. | `AcquiredIndefiniteLivedIntangibleAssetAmount` | 0.7249 | 0.6824 | 0.6124 | 1.0 | REITs |
| 9 | Nextpower Inc. | `FiniteLivedIntangibleAssetsAmortizationExpenseYearFour` | 0.7094 | 0.6312 | 0.6459 | 1.0 | Semiconductors |
| 10 | CMS ENERGY CORP | `AmortizationOfIntangibleAssets` | 0.7056 | 0.6079 | 0.6722 | 1.0 | Electric & Other Services |

**Industry concentration:** Electric Services (15), Prepackaged Software (10), Crude Petroleum & Natural Gas (9), 4922 (8), Electric & Other Services (8)

**Concept breakdown:** `AmortizationOfIntangibleAssets` (62), `AssetRetirementObligationAccretionExpense` (22), `AssetRetirementObligation` (16), `AcquiredFiniteLivedIntangibleAssetAmount` (7), `AmortizationOfAcquiredIntangibleAssets` (5), `AssetRetirementObligationLiabilitiesSettled` (5), `AssetRetirementObligationLiabilitiesIncurred` (5), `AssetRetirementObligationCurrent` (4)

## Emerging Liabilities

**Contingent, legal, environmental, restructuring, and warranty obligations — liabilities growing outside the normal operating cycle.**  
Hits matching category: **16**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | EXELON CORP | `AccrualForEnvironmentalLossContingencies` | 0.7306 | 0.5543 | 0.656 | 1.0 | Electric & Other Services |
| 2 | LyondellBasell Industries N.V. | `AccrualForEnvironmentalLossContingenciesChargesToExpenseForNewLosses` | 0.7115 | 0.5164 | 0.6455 | 1.0 |  |
| 3 | MUELLER INDUSTRIES INC | `AccrualForEnvironmentalLossContingenciesUndiscountedDueInThirdYear` | 0.7075 | 0.5392 | 0.5744 | 1.0 |  |
| 4 | DOW INC. | `AccrualForEnvironmentalLossContingenciesIncreaseDecreaseForRevisionInEstimates` | 0.704 | 0.5241 | 0.5908 | 1.0 |  |
| 5 | INTERNATIONAL BUSINESS MACHINES CORP | `AccruedEnvironmentalLossContingenciesNoncurrent` | 0.7019 | 0.5262 | 0.5758 | 1.0 |  |
| 6 | Tesla, Inc. | `AccruedEnvironmentalLossContingenciesNoncurrent` | 0.6951 | 0.5183 | 0.5595 | 1.0 | Motor Vehicles |
| 7 | NORTHROP GRUMMAN CORP /DE/ | `AccruedEnvironmentalLossContingenciesNoncurrent` | 0.6885 | 0.4859 | 0.5991 | 1.0 |  |
| 8 | FREEPORT-MCMORAN INC | `AccrualForEnvironmentalLossContingenciesPayments` | 0.6808 | 0.4597 | 0.6196 | 1.0 |  |
| 9 | Tesla, Inc. | `AccrualForEnvironmentalLossContingenciesPayments` | 0.6692 | 0.427 | 0.6351 | 1.0 | Motor Vehicles |
| 10 | Energy Transfer LP | `AccruedEnvironmentalLossContingenciesNoncurrent` | 0.6628 | 0.4129 | 0.6351 | 1.0 |  |

**Industry concentration:** 3350 (2), 2821 (2), Motor Vehicles (2), 3812 (2), Electric & Other Services (1)

**Concept breakdown:** `AccruedEnvironmentalLossContingenciesNoncurrent` (4), `AccrualForEnvironmentalLossContingenciesPayments` (4), `AccrualForEnvironmentalLossContingencies` (3), `AccrualForEnvironmentalLossContingenciesUndiscountedDueInThirdYear` (2), `AccrualForEnvironmentalLossContingenciesChargesToExpenseForNewLosses` (1), `AccrualForEnvironmentalLossContingenciesIncreaseDecreaseForRevisionInEstimates` (1), `AccruedEnvironmentalLossContingenciesCurrent` (1)

## Strong Revenue Signal

**Revenue and sales line items with unusually high structural uniqueness — candidates for breakout revenue growth or unique business-model revenue patterns.**  
Hits matching category: **3**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | Samsara Inc. | `ContractWithCustomerLiabilityCurrent` | 0.7376 | 0.4805 | 0.683 | 1.0 |  |
| 2 | Crane Co | `ContractWithCustomerLiabilityCurrent` | 0.7031 | 0.4916 | 0.6095 | 1.0 |  |
| 3 | Karman Holdings Inc. | `ContractWithCustomerAssetReclassifiedToReceivable` | 0.7016 | 0.3919 | 0.6464 | 1.0 |  |

**Industry concentration:** 7373 (1), 3490 (1), 3728 (1)

**Concept breakdown:** `ContractWithCustomerLiabilityCurrent` (2), `ContractWithCustomerAssetReclassifiedToReceivable` (1)

## Resilient Balance Sheet

**Equity-side accounts that are structurally coherent with peers — strong retained earnings + stable equity = balance-sheet resilience.**  
Hits matching category: **157**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | MUELLER INDUSTRIES INC | `AccumulatedOtherComprehensiveIncomeLossDefinedBenefitPensionAndOtherPostretirementPlansNetOfTax` | 0.4953 | 0.3431 | 0.7209 | 1.0 |  |
| 2 | WYNN RESORTS LTD | `AccumulatedOtherComprehensiveIncomeLossForeignCurrencyTranslationAdjustmentNetOfTax` | 0.4831 | 0.4064 | 0.7427 | 1.0 |  |
| 3 | AUTOMATIC DATA PROCESSING INC | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.4816 | 0.3311 | 0.69 | 1.0 |  |
| 4 | SHERWIN WILLIAMS CO | `AccumulatedOtherComprehensiveIncomeLossCumulativeChangesInNetGainLossFromCashFlowHedgesEffectNetOfTax` | 0.4742 | 0.334 | 0.6797 | 1.0 |  |
| 5 | EXELIXIS, INC. | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.4702 | 0.335 | 0.6736 | 1.0 | Biological Products |
| 6 | APPLIED INDUSTRIAL TECHNOLOGIES INC | `AccumulatedOtherComprehensiveIncomeLossDefinedBenefitPensionAndOtherPostretirementPlansNetOfTax` | 0.4699 | 0.3419 | 0.6778 | 1.0 |  |
| 7 | MODINE MANUFACTURING CO | `AccumulatedOtherComprehensiveIncomeLossCumulativeChangesInNetGainLossFromCashFlowHedgesEffectNetOfTax` | 0.4651 | 0.3426 | 0.6703 | 1.0 |  |
| 8 | Energy Transfer LP | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.4497 | 0.3727 | 0.6647 | 1.0 |  |
| 9 | PLAINS ALL AMERICAN PIPELINE LP | `AccumulatedOtherComprehensiveIncomeLossCumulativeChangesInNetGainLossFromCashFlowHedgesEffectNetOfTax` | 0.4473 | 0.3874 | 0.6705 | 1.0 |  |
| 10 | Paramount Skydance Corp | `AccumulatedOtherComprehensiveIncomeLossNetOfTax` | 0.447 | 0.4414 | 0.706 | 1.0 |  |

**Industry concentration:** Business Services NEC (9), REITs (8), Prepackaged Software (6), Motor Vehicles (5), Pharmaceutical Preparations (5)

**Concept breakdown:** `AccumulatedOtherComprehensiveIncomeLossNetOfTax` (105), `AccumulatedOtherComprehensiveIncomeLossCumulativeChangesInNetGainLossFromCashFlowHedgesEffectNetOfTax` (33), `AccumulatedOtherComprehensiveIncomeLossForeignCurrencyTranslationAdjustmentNetOfTax` (7), `CommonStockValue` (4), `AccumulatedOtherComprehensiveIncomeLossDefinedBenefitPensionAndOtherPostretirementPlansNetOfTax` (3), `AccumulatedOtherComprehensiveIncomeLossAvailableForSaleSecuritiesAdjustmentNetOfTax` (3), `AccumulatedOtherComprehensiveIncomeLossBeforeTax1` (1), `StockholdersEquity` (1)

## Debt Stress

**Leverage and debt-service line items showing structural deviation — candidates for elevated refinancing risk or covenant pressure.**  
Hits matching category: **37**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | EXPAND ENERGY Corp | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` | 0.7669 | 0.7873 | 0.5776 | 1.0 | Crude Petroleum & Natural Gas |
| 2 | EXPAND ENERGY Corp | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebtSubsequentAdjustments` | 0.7201 | 0.6587 | 0.6359 | 1.0 | Crude Petroleum & Natural Gas |
| 3 | Zscaler, Inc. | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` | 0.6926 | 0.5521 | 0.7218 | 1.0 |  |
| 4 | ADVANCED MICRO DEVICES INC | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebtSubsequentAdjustments` | 0.6667 | 0.5936 | 0.5665 | 1.0 | Semiconductors |
| 5 | Royalty Pharma plc | `DebtInstrumentUnamortizedDiscount` | 0.6663 | 0.5763 | 0.5938 | 1.0 | Pharmaceutical Preparations |
| 6 | O REILLY AUTOMOTIVE INC | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` | 0.6659 | 0.5858 | 0.5767 | 1.0 |  |
| 7 | DEXCOM INC | `AdjustmentsToAdditionalPaidInCapitalConvertibleDebtWithConversionFeature` | 0.6611 | 0.5655 | 0.5946 | 1.0 | Surgical & Medical Instruments |
| 8 | Salesforce, Inc. | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` | 0.6605 | 0.4972 | 0.7062 | 1.0 | Prepackaged Software |
| 9 | Live Nation Entertainment, Inc. | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` | 0.6549 | 0.5215 | 0.6472 | 1.0 |  |
| 10 | DEXCOM INC | `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` | 0.6516 | 0.5445 | 0.5977 | 1.0 | Surgical & Medical Instruments |

**Industry concentration:** Prepackaged Software (7), Crude Petroleum & Natural Gas (4), Pharmaceutical Preparations (4), Semiconductors (3), Surgical & Medical Instruments (2)

**Concept breakdown:** `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebt` (20), `AdjustmentsToAdditionalPaidInCapitalEquityComponentOfConvertibleDebtSubsequentAdjustments` (7), `AdjustmentsToAdditionalPaidInCapitalConvertibleDebtWithConversionFeature` (4), `DebtInstrumentUnamortizedDiscount` (3), `ConvertibleNotesPayableCurrent` (1), `LineOfCreditFacilityMaximumBorrowingCapacity` (1), `DebtInstrumentUnamortizedDiscountPremiumAndDebtIssuanceCostsNet` (1)

## Cash Quality

**Cash, equivalents, and short-term-investment accounts with unusual structure — could indicate treasury-strategy outliers or unusual reserve composition.**  
Hits matching category: **43**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | Trade Desk, Inc. | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` | 0.7946 | 0.6603 | 0.6563 | 1.0 | Computer Services |
| 2 | Tradeweb Markets Inc. | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect` | 0.7752 | 0.606 | 0.6349 | 1.0 |  |
| 3 | HUNT J B TRANSPORT SERVICES INC | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect` | 0.765 | 0.6187 | 0.6031 | 1.0 |  |
| 4 | CARNIVAL PLC | `CashAndCashEquivalentsAtCarryingValue` | 0.7648 | 0.6101 | 0.607 | 1.0 |  |
| 5 | Circle Internet Group, Inc. | `CashAndCashEquivalentsAtCarryingValue` | 0.7621 | 0.6063 | 0.602 | 1.0 | Finance Services |
| 6 | DOLLAR GENERAL CORP | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect` | 0.7574 | 0.4676 | 0.6598 | 1.0 |  |
| 7 | Solventum Corp | `EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` | 0.7573 | 0.5268 | 0.6299 | 1.0 | Surgical & Medical Instruments |
| 8 | Paramount Skydance Corp | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` | 0.7549 | 0.3793 | 0.6976 | 1.0 |  |
| 9 | Grayscale Bitcoin Trust ETF | `InvestmentOwnedAtCost` | 0.7541 | 0.3867 | 0.6918 | 1.0 |  |
| 10 | Otis Worldwide Corp | `CashAndCashEquivalentsAtCarryingValue` | 0.7526 | 0.5398 | 0.6116 | 1.0 |  |

**Industry concentration:** 4213 (4), 6221 (3), 5331 (2), Surgical & Medical Instruments (2), 4833 (2)

**Concept breakdown:** `CashAndCashEquivalentsAtCarryingValue` (16), `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect` (13), `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` (3), `CashAndCashEquivalentsPeriodIncreaseDecrease` (3), `CashAndCashEquivalentsFairValueDisclosure` (2), `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents` (2), `EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` (1), `InvestmentOwnedAtCost` (1)

## Ma Activity

**Business-combination, goodwill, and intangible-asset anomalies — companies with recent or complex M&A activity.**  
Hits matching category: **51**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | NVR INC | `BusinessCombinationRecognizedIdentifiableAssetsAcquiredAndLiabilitiesAssumedLiabilities` | 0.7591 | 0.7524 | 0.5948 | 1.0 |  |
| 2 | NVR INC | `BusinessAcquisitionPurchasePriceAllocationAssetsAcquired` | 0.7566 | 0.6987 | 0.649 | 1.0 |  |
| 3 | S&P Global Inc. | `AssetsHeldForSaleCurrent` | 0.7321 | 0.6068 | 0.684 | 1.0 |  |
| 4 | HP INC | `AmortizationOfAcquiredIntangibleAssets` | 0.7242 | 0.5916 | 0.6787 | 1.0 |  |
| 5 | CATERPILLAR INC | `AssetsHeldForSaleCurrent` | 0.6901 | 0.51 | 0.6746 | 1.0 |  |
| 6 | MID AMERICA APARTMENT COMMUNITIES INC. | `BusinessCombinationAcquisitionRelatedCosts` | 0.6835 | 0.4661 | 0.706 | 1.0 | REITs |
| 7 | NVIDIA CORP | `AmortizationOfAcquiredIntangibleAssets` | 0.6819 | 0.5336 | 0.6241 | 1.0 | Semiconductors |
| 8 | ENSIGN GROUP, INC | `AssetsHeldForSaleNotPartOfDisposalGroupCurrent` | 0.6789 | 0.5227 | 0.628 | 1.0 |  |
| 9 | RAMBUS INC | `AssetsHeldForSaleNotPartOfDisposalGroupCurrent` | 0.6776 | 0.4776 | 0.676 | 1.0 | Semiconductors |
| 10 | Celsius Holdings, Inc. | `BusinessCombinationRecognizedIdentifiableAssetsAcquiredAndLiabilitiesAssumedCashAndEquivalents` | 0.6755 | 0.4303 | 0.724 | 1.0 |  |

**Industry concentration:** 7373 (4), 1531 (3), REITs (3), Semiconductors (3), 6282 (3)

**Concept breakdown:** `AssetsHeldForSaleNotPartOfDisposalGroupCurrent` (6), `AssetsHeldForSaleCurrent` (5), `AmortizationOfAcquiredIntangibleAssets` (5), `BusinessCombinationAcquisitionRelatedCosts` (3), `BusinessAcquisitionPurchasePriceAllocationAmortizableIntangibleAssets` (3), `BusinessAcquisitionCostOfAcquiredEntityPurchasePrice` (3), `BusinessAcquisitionPurchasePriceAllocationAssetsAcquired` (2), `BusinessCombinationConsiderationTransferredEquityInterestsIssuedAndIssuable` (2)

## Distress Going Concern

**Going-concern, discontinued operations, restructuring, and impairment concentrations — distress candidates.**  
Hits matching category: **138**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | BXP, Inc. | `AssetImpairmentCharges` | 0.7723 | 0.7259 | 0.6154 | 1.0 | REITs |
| 2 | COMCAST CORP | `AssetImpairmentCharges` | 0.7655 | 0.7051 | 0.6385 | 1.0 |  |
| 3 | RBC Bearings INC | `AssetImpairmentCharges` | 0.7614 | 0.7003 | 0.6314 | 1.0 |  |
| 4 | JD.com, Inc. | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.7606 | 0.7044 | 0.6157 | 1.0 |  |
| 5 | PLAINS ALL AMERICAN PIPELINE LP | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.7551 | 0.6835 | 0.646 | 1.0 |  |
| 6 | EMCOR Group, Inc. | `AssetsOfDisposalGroupIncludingDiscontinuedOperationNoncurrent` | 0.7523 | 0.6983 | 0.5912 | 1.0 |  |
| 7 | Trade Desk, Inc. | `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` | 0.7444 | 0.6603 | 0.6563 | 1.0 | Computer Services |
| 8 | WELLTOWER INC. | `AssetImpairmentCharges` | 0.7433 | 0.6773 | 0.6037 | 1.0 | REITs |
| 9 | DuPont de Nemours, Inc. | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.7423 | 0.6719 | 0.6139 | 1.0 |  |
| 10 | Fortive Corp | `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` | 0.74 | 0.6577 | 0.6413 | 1.0 |  |

**Industry concentration:** REITs (15), Pharmaceutical Preparations (5), Electric Services (5), 2821 (4), 1731 (3)

**Concept breakdown:** `AssetsOfDisposalGroupIncludingDiscontinuedOperationCurrent` (54), `AssetsOfDisposalGroupIncludingDiscontinuedOperation` (39), `AssetImpairmentCharges` (31), `AssetsOfDisposalGroupIncludingDiscontinuedOperationNoncurrent` (7), `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` (3), `EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations` (1), `GoodwillImpairmentLoss` (1), `CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations` (1)

## Tax Complexity

**Deferred-tax, uncertain-tax-position, and tax-benefit items showing structural complexity — candidates for tax-audit exposure.**  
Hits matching category: **65**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | Circle Internet Group, Inc. | `AccruedIncomeTaxesCurrent` | 0.7567 | 0.5351 | 0.8363 | 1.0 | Finance Services |
| 2 | SouthState Bank Corp | `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` | 0.7537 | 0.6992 | 0.64 | 1.0 | State Commercial Banks (National) |
| 3 | CBRE GROUP, INC. | `AccruedIncomeTaxesCurrent` | 0.7476 | 0.7341 | 0.5827 | 1.0 |  |
| 4 | AECOM | `AccruedIncomeTaxesCurrent` | 0.7267 | 0.6145 | 0.6597 | 1.0 |  |
| 5 | TechnipFMC plc | `AccruedIncomeTaxesCurrent` | 0.7205 | 0.6728 | 0.5754 | 1.0 |  |
| 6 | MASIMO CORP | `AccruedIncomeTaxesCurrent` | 0.7199 | 0.5724 | 0.6884 | 1.0 | Electromedical Apparatus |
| 7 | BANK OF AMERICA CORP /DE/ | `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` | 0.7191 | 0.5062 | 0.7618 | 1.0 |  |
| 8 | ASSURANT, INC. | `AccruedIncomeTaxesPayable` | 0.7068 | 0.4895 | 0.7456 | 1.0 |  |
| 9 | ROYAL GOLD INC | `AccruedIncomeTaxesCurrent` | 0.7034 | 0.6239 | 0.5825 | 1.0 |  |
| 10 | ON SEMICONDUCTOR CORP | `AccruedIncomeTaxesCurrent` | 0.7026 | 0.5404 | 0.6756 | 1.0 | Semiconductors |

**Industry concentration:** State Commercial Banks (National) (3), Prepackaged Software (3), Finance Services (2), Electromedical Apparatus (2), Semiconductors (2)

**Concept breakdown:** `AccruedIncomeTaxesCurrent` (49), `AccruedIncomeTaxesNoncurrent` (7), `AffordableHousingTaxCreditsAndOtherTaxBenefitsAmount` (6), `AccruedIncomeTaxesPayable` (2), `AccruedIncomeTaxes` (1)

## Dilution Stock Comp

**Share-based-compensation, APIC, and dilutive-security accounts — dilution-risk signal for existing shareholders.**  
Hits matching category: **49**.  Direction: `high`.

### Top-10 named signals

| # | Company | Concept | Score | anom | recon | div | Industry |
|---|---|---|---|---|---|---|---|
| 1 | GOLDMAN SACHS GROUP INC | `AdditionalPaidInCapital` | 0.7966 | 0.7057 | 0.7491 | 1.0 |  |
| 2 | Samsara Inc. | `AdditionalPaidInCapital` | 0.7801 | 0.5159 | 0.8739 | 1.0 |  |
| 3 | Okta, Inc. | `AdditionalPaidInCapital` | 0.7683 | 0.5775 | 0.7904 | 1.0 | Prepackaged Software |
| 4 | Apollo Global Management, Inc. | `AdditionalPaidInCapital` | 0.7661 | 0.765 | 0.621 | 1.0 |  |
| 5 | WELLTOWER INC. | `AdditionalPaidInCapital` | 0.7354 | 0.7038 | 0.5978 | 1.0 | REITs |
| 6 | FIFTH THIRD BANCORP | `AdditionalPaidInCapital` | 0.735 | 0.6786 | 0.6188 | 1.0 | State Commercial Banks (National) |
| 7 | GLOBE LIFE INC. | `AdditionalPaidInCapital` | 0.7297 | 0.6945 | 0.5916 | 1.0 | Life Insurance |
| 8 | CARNIVAL CORP | `AdditionalPaidInCapital` | 0.7144 | 0.5445 | 0.6846 | 1.0 |  |
| 9 | SharkNinja, Inc. | `AdditionalPaidInCapital` | 0.7086 | 0.6014 | 0.6203 | 1.0 |  |
| 10 | Keurig Dr Pepper Inc. | `AdjustmentsToAdditionalPaidInCapitalSharebasedCompensationAndExerciseOfStockOptions` | 0.7047 | 0.6717 | 0.5489 | 1.0 |  |

**Industry concentration:** 6211 (3), 7373 (3), Prepackaged Software (2), 6282 (2), REITs (2)

**Concept breakdown:** `AdditionalPaidInCapital` (38), `AdjustmentsToAdditionalPaidInCapitalSharebasedCompensationAndExerciseOfStockOptions` (4), `AdditionalPaidInCapitalCommonStock` (4), `AmountOfDilutiveSecuritiesStockOptionsAndRestrictiveStockUnits` (2), `AdjustmentsToAdditionalPaidInCapitalShareBasedCompensationRestrictedStockUnitsRequisiteServicePeriodRecognition` (1)
