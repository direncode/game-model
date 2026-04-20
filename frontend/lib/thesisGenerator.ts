/**
 * Per-finding thesis generator.
 *
 * Deterministic, seed-free (pure input→output), no LLM, no external API.
 * Given a resolved entity + score vector + corpus context, emits one
 * sentence of buyer-legible narrative explaining why a finding sits where
 * it does in the rankings.
 *
 * The composition is rule-based but multi-branch: tier of composite score,
 * which dimension dominates, how high vs p90, what the concept *means* in
 * the domain (EDGAR XBRL glossary, MeSH domain buckets, HS chapter
 * summaries, NOAA climate bands, patent CPC classes). The output is
 * identical given identical input — so a finding's narrative is as
 * reproducible as its score.
 *
 * When the richer NLP stack comes online, its generator should preserve
 * this interface; this file becomes the fallback and the reference
 * implementation.
 */

import type { ResolvedEntity } from "./entityResolver";

// ─── Domain glossaries ───────────────────────────────────────────────────

// EDGAR XBRL concept → buyer-legible domain note.
// Kept deliberately small; grows as the vertical matures.
const XBRL_GLOSS: Record<string, string> = {
  AssetRetirementObligation:
    "decommissioning-estimate line — audit-sensitive and prone to material revision",
  AdditionalPaidInCapital:
    "equity-capital structure line — reflects stock-comp / issuance / M&A activity",
  Assets:
    "top-level balance-sheet line — outliers indicate unusual composition vs peers",
  AccretionAmortizationOfDiscountsAndPremiums:
    "premium-amortization schedule on invested assets — insurance/fixed-income sensitive",
  AccruedLiabilitiesForCommissionsExpenses:
    "commission-accrual line — commercial-contractor booking pattern",
  AccretionAmortizationOfDiscounts:
    "discount-accretion on invested assets — insurance carrier pattern",
  AdvertisingExpense:
    "marketing-spend line — outlier vs sector shape flags capital-allocation shift",
  CapitalExpendituresIncurredButNotYetPaid:
    "capex accrual timing line — surfaces project-pipeline cadence",
  AccumulatedDepreciation:
    "fleet/installed-base depreciation line — reveals useful-life assumptions",
  AccrualForEnvironmentalLossContingencies:
    "environmental-reserve line — Superfund / remediation exposure",
  AccruedEnvironmentalLossContingencies:
    "legacy-site environmental liability — multi-decade accrual pattern",
  BusinessCombinationRecognizedIdentifiableAssets:
    "post-acquisition PPA line — material when deal flow is active",
  BusinessAcquisitionPurchasePriceAllocation:
    "purchase-price allocation — companion PPA flag",
  AssetsHeldForSaleCurrent:
    "divestiture / disposal-group line — discretionary classification",
  AmortizationOfAcquiredIntangibleAssets:
    "post-deal intangible amortization — M&A-driven earnings overhang",
  AssetImpairmentCharges:
    "discretionary writedown — management-estimate line, audit-sensitive",
  AssetsOfDisposalGroupIncludingDiscontinuedOperations:
    "disposal-group asset pool — presentation can materially shift reported metrics",
  AccumulatedOtherComprehensiveIncomeLoss:
    "OCI-residual line — FX / pension / derivative exposure surface",
  AccruedIncomeTaxesCurrent:
    "current tax-accrual line — cross-border posture flag",
  DebtInstrumentUnamortizedDiscount:
    "unamortized debt discount — unusual capital structure indicator",
  CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents:
    "restricted-cash composition — working-capital / regulatory-capital pattern",
  CashAndCashEquivalentsAtCarryingValue:
    "nominal cash line — shape vs sector flags treasury posture",
  AdjustmentsToAdditionalPaidInCapital:
    "APIC-adjustment line — recap / SBC / deal-residual flow",
  AffordableHousingTaxCreditsAndOtherTaxCredits:
    "tax-credit investment portfolio — unusual among non-bank filers",
  CashCashEquivalentsRestrictedCash:
    "cash composition line — restricted vs unrestricted breakout",
  AcceleratedShareRepurchaseProgramAdjustment:
    "ASR settlement adjustment — forward-contract reconciliation",
  // ─── Added in v2 (richer glossary) ───────────────────────────────
  Revenues:
    "top-line revenue — outlier vs sector-normalized size suggests channel concentration",
  CostOfRevenue:
    "COGS line — outlier shape implies unusual input-mix or gross-margin regime",
  OperatingIncomeLoss:
    "operating leverage — divergence from peer distribution often a capex-cycle marker",
  NetIncomeLoss:
    "bottom-line net income — divergence from operating-income shape flags tax/one-time items",
  EarningsPerShareBasic:
    "EPS line — shape distance from peers flags buyback or dilution intensity",
  CommonStockSharesAuthorized:
    "authorized-shares capacity — outlier signals pending recap or dual-class redesign",
  PropertyPlantAndEquipmentNet:
    "PP&E net — outlier vs sector centroid marks unusual asset intensity",
  Goodwill:
    "carrying goodwill — material outlier is a leading indicator for impairment review",
  IntangibleAssetsNetExcludingGoodwill:
    "identifiable intangibles — acquisition-footprint signal",
  Liabilities:
    "aggregate liabilities — unusual composition vs sector norms",
  LongTermDebt:
    "LT-debt balance — covenant-risk adjacency when outlier vs interest-coverage band",
  ShareBasedCompensation:
    "SBC expense — outlier shape marks equity-comp-heavy compensation regime",
  StockholdersEquity:
    "book equity — buyback-intensity and retained-earnings shape marker",
  RetainedEarningsAccumulatedDeficit:
    "retained earnings — long-run profitability trace",
  NetCashProvidedByUsedInOperatingActivities:
    "operating cash flow — divergence from NI shape flags accrual-quality concern",
  NetCashProvidedByUsedInInvestingActivities:
    "investing CF — outlier ties to capex / M&A cadence",
  NetCashProvidedByUsedInFinancingActivities:
    "financing CF — debt/buyback/dividend regime indicator",
  DepreciationDepletionAndAmortization:
    "DD&A line — asset-base consumption rate",
  Depreciation:
    "depreciation schedule — useful-life assumption marker",
  AccountsReceivableNetCurrent:
    "AR net — DSO-adjacent signal when outlier vs sector",
  InventoryNet:
    "inventory net — turnover/obsolescence-risk signal",
  AccountsPayableCurrent:
    "AP current — DPO / working-capital-financing signal",
  DeferredRevenue:
    "deferred revenue — subscription / long-contract booking pattern",
  ContractWithCustomerLiability:
    "contract liability — ASC-606 deferred-performance-obligation shape",
  ResearchAndDevelopmentExpense:
    "R&D expense — intensity outlier is innovation-cycle marker",
  SellingGeneralAndAdministrativeExpense:
    "SG&A line — scale-economics signal when outlier vs revenue shape",
  IncomeTaxesPaidNet:
    "cash taxes paid — effective-tax cash conversion",
  ProceedsFromIssuanceOfLongTermDebt:
    "LT-debt issuance — leverage-regime change signal",
  RepaymentsOfLongTermDebt:
    "LT-debt repayment — deleveraging cadence",
  PaymentsForRepurchaseOfCommonStock:
    "buyback cash — capital-return regime marker",
  PaymentsOfDividends:
    "dividend cash — capital-return regime marker",
  Cash:
    "cash balance — treasury-posture line",
  CashAndCashEquivalents:
    "cash & equivalents — cross-period liquidity baseline",
  MarketableSecurities:
    "marketable securities — non-operating capital-allocation signal",
  OperatingLeaseRightOfUseAsset:
    "ASC-842 RoU asset — lease-intensity marker",
  OperatingLeaseLiability:
    "ASC-842 lease liability — lease-intensity on the liability side",
  FairValueInputsLevel3:
    "Level-3 fair-value inputs — unobservable-input intensity (audit-sensitive)",
  AllowanceForDoubtfulAccountsReceivable:
    "AR allowance — credit-quality management-estimate line",
  ValuationAllowance:
    "deferred-tax valuation allowance — recoverability judgement line (audit-sensitive)",
  UnrecognizedTaxBenefits:
    "uncertain-tax-position reserve — FIN-48 exposure marker",
  PensionAndOtherPostretirementBenefitContributionsByEmployer:
    "pension + OPEB contribution cadence — legacy-obligation marker",
  DefinedBenefitPlanAssets:
    "DB plan assets — pension-funding-status marker",
  DefinedBenefitPlanBenefitObligation:
    "DB plan obligation — pension-liability marker",
  StockRepurchasedAndRetiredDuringPeriodValue:
    "shares retired — buyback-aggressiveness marker",
  PreferredStockValue:
    "preferred equity outstanding — capital-structure seniority signal",
  RestructuringCharges:
    "restructuring line — transformation-cycle cost marker",
  LitigationSettlement:
    "litigation-settlement expense — legal-exposure crystallization",
  RegulatoryAssets:
    "regulated-utility recoverables — rate-case-pending marker",
  DerivativeLiabilities:
    "derivative liabilities — hedge-ineffectiveness / counterparty signal",
};

// MeSH top-level cluster heuristics (by prefix)
function meshDomain(code: string): string {
  if (!code) return "biomedical concept";
  const c = code.toUpperCase();
  if (c.startsWith("D000")) return "meta-science / methodology";
  if (c.startsWith("D01")) return "chemicals / drugs";
  if (c.startsWith("D02")) return "organic chemistry";
  if (c.startsWith("D03")) return "heterocyclic compounds";
  if (c.startsWith("D04")) return "polycyclic compounds";
  if (c.startsWith("D09")) return "carbohydrates";
  if (c.startsWith("D12")) return "amino acids / peptides / proteins";
  if (c.startsWith("D13")) return "nucleic acids";
  if (c.startsWith("D23")) return "biological factors";
  if (c.startsWith("D24")) return "immunologic factors";
  if (c.startsWith("D27")) return "chemical actions / uses";
  return "biomedical concept";
}

// HS2 commodity chapter → domain note
const HS_NOTE: Record<string, string> = {
  "01": "live-animals flow — tracks livestock corridors",
  "02": "meat / edible offal flow — trade-corridor sensitive to disease embargoes",
  "03": "fish / crustacean flow — seasonal and fleet-based",
  "09": "coffee / tea / spices — weather and tariff exposed",
  "10": "cereals flow — food-security sensitive",
  "15": "fats / oils flow — biofuel-policy exposed",
  "22": "beverages / spirits — excise-tax posture",
  "27": "mineral fuels / oils — sanctions and OPEC+ linked",
  "28": "inorganic chemicals — industrial input",
  "29": "organic chemicals — petrochemical / pharma input",
  "30": "pharmaceuticals flow — regulatory-entry posture",
  "39": "plastics flow — petrochemical downstream",
  "72": "iron / steel flow — safeguard / anti-dumping exposed",
  "84": "machinery flow — capex-cycle proxy",
  "85": "electrical machinery — tech-cycle proxy",
  "87": "vehicles flow — tariff-regime sensitive",
  "88": "aircraft / spacecraft — export-control heavy",
  "90": "optical / medical instruments — high value-density",
};

// Patent assignee sectoral note (rough)
function assigneeNote(slug: string): string {
  const s = slug.toLowerCase();
  if (/ibm|microsoft|google|meta|amazon|apple|samsung|sony|nvidia/.test(s))
    return "bellwether tech filer — shifts flag strategy pivots";
  if (/siemens|hitachi|mitsubishi|honeywell|ge_|general_electric/.test(s))
    return "industrial conglomerate — cross-sector signal";
  if (/qualcomm|broadcom|intel|amd|arm|tsmc/.test(s))
    return "semiconductor filer — architecture-roadmap indicator";
  if (/pfizer|merck|novartis|roche|astrazeneca/.test(s))
    return "pharma filer — pipeline-strategy signal";
  return "assignee filing concentration";
}

// NOAA / climate region note
function regionNote(state: string): string {
  const s = state.toUpperCase();
  if (["AZ", "NM", "NV", "CA", "UT", "TX"].includes(s))
    return "arid / semi-arid band — drought-cycle sensitive";
  if (["FL", "LA", "MS", "AL", "GA", "SC", "NC"].includes(s))
    return "Gulf / Atlantic coastal — hurricane-exposed";
  if (["AK"].includes(s))
    return "Arctic / sub-Arctic — permafrost and Arctic-amplification sensitive";
  if (["HI"].includes(s))
    return "Pacific oceanic — Kilauea / trade-wind regime";
  return "regional climate station cluster";
}

// ─── Thesis rendering ────────────────────────────────────────────────────

export type ScoreSet = {
  composite: number;
  anomaly: number;
  reconstruction: number;
  diversity: number;
};

function scoreTier(composite: number): string {
  if (composite >= 0.90) return "extreme structural outlier";
  if (composite >= 0.80) return "strong structural outlier";
  if (composite >= 0.70) return "notable structural outlier";
  if (composite >= 0.60) return "above-peer structural divergence";
  if (composite >= 0.50) return "moderate structural divergence";
  return "mild structural divergence";
}

function dominantDim(s: ScoreSet): { key: keyof ScoreSet; note: string; followUp: string } {
  const entries: [keyof ScoreSet, number, string, string][] = [
    ["anomaly", s.anomaly,
      "driven by isolation from peer fingerprint space (sparse neighborhood)",
      "check whether the entity's peer set is correctly defined or whether it's cross-class"],
    ["reconstruction", s.reconstruction,
      "driven by information density (informative bit-pattern)",
      "likely to reflect unusual attribute combinations not present in the typical row"],
    ["diversity", s.diversity,
      "driven by per-bit entropy across recent history (unusual combination)",
      "worth examining how many other entities exhibit this specific combination; small clusters of high-diversity rows often mark an emerging regime"],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return { key: entries[0][0], note: entries[0][2], followUp: entries[0][3] };
}

function conceptNote(concept: string, kind: ResolvedEntity["kind"]): string {
  if (kind === "cik-fact") {
    const normalized = concept.replace(/\s+/g, "");
    for (const key of Object.keys(XBRL_GLOSS)) {
      if (normalized.toLowerCase().startsWith(key.toLowerCase()))
        return XBRL_GLOSS[key];
    }
    return "XBRL-tagged line item — structural geometry vs full filer universe";
  }
  return "";
}

export type ThesisInput = {
  resolved: ResolvedEntity | null;
  composite: number;
  anomaly: number;
  reconstruction: number;
  diversity: number;
  peerRank?: number;
  universeSize?: number;
  clusterRank?: number;
  clusterSize?: number;
  corpusDomain?: string;
};

/** One-sentence deterministic thesis for a finding. */
export function generateThesis(input: ThesisInput): string {
  const resolved = input.resolved;
  const scores: ScoreSet = {
    composite: input.composite,
    anomaly: input.anomaly,
    reconstruction: input.reconstruction,
    diversity: input.diversity,
  };
  const tier = scoreTier(scores.composite);
  const dom = dominantDim(scores);
  const kind = resolved?.kind ?? "unknown";

  // Kind-specific domain sentence
  let domainSentence = "";
  if (kind === "cik-fact" && resolved) {
    const concept = resolved.display.split(" · ").slice(-1)[0] || "";
    const raw = resolved.raw.replace(/^fact_\d+_/, "");
    const note = conceptNote(raw, kind);
    domainSentence = note ? ` ${note}.` : "";
  } else if (kind === "mesh" && resolved) {
    const match = resolved.raw.match(/D\d+/);
    const code = match ? match[0] : "";
    domainSentence = ` Cluster: ${meshDomain(code)}.`;
  } else if (kind === "hs-commodity" && resolved) {
    const match = resolved.raw.match(/commodity_(\d{2,4})/);
    const hs2 = match ? match[1].slice(0, 2) : "";
    const note = HS_NOTE[hs2];
    if (note) domainSentence = ` ${note}.`;
  } else if (kind === "patent-assignee" && resolved) {
    const slug = resolved.raw.replace(/^assignee_/, "");
    domainSentence = ` ${assigneeNote(slug)}.`;
  } else if (kind === "region" && resolved) {
    const st = resolved.raw.replace(/^region_/, "");
    domainSentence = ` ${regionNote(st)}.`;
  }

  // Rank sentence (if provided)
  let rankSentence = "";
  if (input.peerRank && input.universeSize) {
    const pct = Math.max(1, Math.round((input.peerRank / input.universeSize) * 1000) / 10);
    rankSentence = ` Peer rank ${input.peerRank.toLocaleString()} / ${input.universeSize.toLocaleString()} (top ${pct}%).`;
  }
  if (input.clusterRank && input.clusterSize && input.clusterSize > 1) {
    rankSentence += ` Cluster rank ${input.clusterRank} of ${input.clusterSize}.`;
  }

  const head = resolved?.display ?? "Entity";
  const comp = scores.composite.toFixed(3);

  // Build a secondary reasoning sentence: which dimensions co-confirm the
  // primary driver, or which diverge from it (worth flagging).
  const secondary: string[] = [];
  const maxVal = Math.max(scores.anomaly, scores.reconstruction, scores.diversity);
  if (scores.anomaly > 0.7 && dom.key !== "anomaly") secondary.push("also highly isolated");
  if (scores.reconstruction > 0.7 && dom.key !== "reconstruction") secondary.push("information-dense fingerprint");
  if (scores.diversity > 0.5 && dom.key !== "diversity") secondary.push("unusual bit-entropy profile");
  // If a dimension is very low despite high composite, that's a signal too.
  if (maxVal > 0.7 && scores.anomaly < 0.3 && dom.key !== "anomaly") secondary.push("NOT isolated — clustered with peers despite rank");
  const secondarySentence = secondary.length ? ` Co-signal: ${secondary.join("; ")}.` : "";

  const followUp = ` Next check: ${dom.followUp}.`;

  return (
    `${head} — ${tier} at composite ${comp}, ${dom.note}.${domainSentence}${rankSentence}${secondarySentence}${followUp}`.trim()
  );
}

/** Alternative form: structured rather than sentence. */
export type ThesisStruct = {
  headline: string;
  dominant_dimension: keyof ScoreSet;
  tier: string;
  domain_note: string;
  rank_note: string;
};

export function generateThesisStruct(input: ThesisInput): ThesisStruct {
  const scores: ScoreSet = {
    composite: input.composite,
    anomaly: input.anomaly,
    reconstruction: input.reconstruction,
    diversity: input.diversity,
  };
  const tier = scoreTier(scores.composite);
  const dom = dominantDim(scores);
  const kind = input.resolved?.kind ?? "unknown";

  let domain_note = "";
  if (kind === "cik-fact" && input.resolved) {
    const raw = input.resolved.raw.replace(/^fact_\d+_/, "");
    domain_note = conceptNote(raw, kind);
  } else if (kind === "mesh" && input.resolved) {
    const m = input.resolved.raw.match(/D\d+/);
    domain_note = m ? `MeSH cluster: ${meshDomain(m[0])}` : "";
  } else if (kind === "hs-commodity" && input.resolved) {
    const m = input.resolved.raw.match(/commodity_(\d{2,4})/);
    domain_note = m ? HS_NOTE[m[1].slice(0, 2)] ?? "" : "";
  } else if (kind === "patent-assignee" && input.resolved) {
    domain_note = assigneeNote(input.resolved.raw.replace(/^assignee_/, ""));
  } else if (kind === "region" && input.resolved) {
    domain_note = regionNote(input.resolved.raw.replace(/^region_/, ""));
  }

  let rank_note = "";
  if (input.peerRank && input.universeSize) {
    const pct = Math.max(1, Math.round((input.peerRank / input.universeSize) * 1000) / 10);
    rank_note = `peer rank ${input.peerRank} / ${input.universeSize} (top ${pct}%)`;
  }
  if (input.clusterRank && input.clusterSize && input.clusterSize > 1) {
    rank_note = rank_note
      ? `${rank_note}; cluster ${input.clusterRank}/${input.clusterSize}`
      : `cluster ${input.clusterRank}/${input.clusterSize}`;
  }

  return {
    headline: generateThesis(input),
    dominant_dimension: dom.key,
    tier,
    domain_note,
    rank_note,
  };
}
