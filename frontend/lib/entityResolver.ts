/**
 * Universal entity resolver — raw fingerprint names → English.
 *
 * Every BTUT corpus emits entities in domain-specific conventions:
 *   CIK-based          fact_320193_Revenue              (EDGAR XBRL)
 *   MeSH codes         mesh_D000081082                  (PubMed)
 *   HS codes           commodity_02                     (UN Comtrade)
 *   NOAA regions       region_AZ                        (climate)
 *   Patent assignees   assignee_siemens_ag              (USPTO)
 *   Patent chunks      tesla_patent_1914_xxx            (inventor corpora)
 *   Biography events   newton_alchemy__event__keynes_…  (polymath)
 *
 * This module resolves all of them through deterministic codebooks —
 * no LLM, no external API. If the code isn't in the codebook, the
 * raw name is returned (graceful degradation) with a hint.
 */

// ─── CIK registry (subset; repo has a larger dynamic map in edgar_cache) ───
const CIK_REGISTRY: Record<string, string> = {
  "320193": "Apple Inc.",
  "1045810": "NVIDIA CORP",
  "789019": "MICROSOFT CORP",
  "1018724": "AMAZON COM INC",
  "1652044": "Alphabet Inc.",
  "1326801": "Meta Platforms Inc.",
  "1318605": "Tesla Inc.",
  "4904": "AMERICAN ELECTRIC POWER CO INC",
  "886982": "GOLDMAN SACHS GROUP INC",
  "906163": "NVR Inc.",
  "922621": "ERIE INDEMNITY CO",
  "1876042": "Circle Internet Group, Inc.",
  "1642896": "Samsara Inc.",
  "1048268": "IES Holdings, Inc.",
  "19617": "JPMORGAN CHASE & CO",
  "70858": "BANK OF AMERICA CORP",
  "51143": "INTERNATIONAL BUSINESS MACHINES CORP",
  "1751788": "Dow Inc.",
  "1489393": "LyondellBasell Industries N.V.",
  "1109357": "Exelon Corporation",
  "876437": "Mueller Industries Inc.",
  "1037540": "BXP, Inc.",
  "1166691": "Comcast Corporation",
  "1441816": "MongoDB, Inc.",
};

// ─── HS (Harmonized System) commodity codes — public WCO table, HS-2 level ───
const HS2_CODES: Record<string, string> = {
  "01": "Live animals", "02": "Meat and edible meat offal",
  "03": "Fish, crustaceans, molluscs", "04": "Dairy; eggs; honey",
  "05": "Animal products not elsewhere specified", "06": "Live trees & plants",
  "07": "Edible vegetables", "08": "Edible fruit & nuts",
  "09": "Coffee, tea, spices", "10": "Cereals",
  "11": "Products of the milling industry", "12": "Oilseeds & oleaginous fruits",
  "13": "Lac; gums; resins", "14": "Vegetable plaiting materials",
  "15": "Animal & vegetable fats & oils", "16": "Prep. of meat, fish",
  "17": "Sugars & sugar confectionery", "18": "Cocoa & cocoa prep.",
  "19": "Prep. of cereals, flour, starch", "20": "Prep. of vegetables, fruit",
  "21": "Misc. edible preparations", "22": "Beverages, spirits, vinegar",
  "23": "Residues from food industries; animal feed", "24": "Tobacco",
  "25": "Salt; sulphur; earths & stone", "26": "Ores, slag, ash",
  "27": "Mineral fuels, oils", "28": "Inorganic chemicals",
  "29": "Organic chemicals", "30": "Pharmaceutical products",
  "31": "Fertilisers", "32": "Tanning/dyeing extracts",
  "33": "Essential oils; perfumery", "34": "Soap; waxes",
  "35": "Albuminoidal substances", "36": "Explosives; pyrotechnics",
  "37": "Photographic or cinematographic goods", "38": "Misc. chemical products",
  "39": "Plastics & articles thereof", "40": "Rubber & articles thereof",
  "41": "Raw hides & skins, leather", "42": "Articles of leather",
  "43": "Furskins", "44": "Wood & articles of wood",
  "45": "Cork", "46": "Straw, esparto, plaiting materials",
  "47": "Pulp of wood", "48": "Paper & paperboard",
  "49": "Printed books; newspapers", "50": "Silk",
  "61": "Knitted apparel", "62": "Woven apparel",
  "71": "Pearls, precious stones, metals", "72": "Iron and steel",
  "73": "Articles of iron or steel", "74": "Copper & articles thereof",
  "84": "Machinery, mechanical appliances", "85": "Electrical machinery",
  "87": "Vehicles other than railway", "88": "Aircraft, spacecraft",
  "89": "Ships, boats", "90": "Optical, photo, medical instruments",
  "94": "Furniture; lamps; prefab buildings", "95": "Toys, games, sports",
  "98": "Special transactions", "99": "Special transactions / unclassified",
};

// ─── US state / NOAA region abbreviations ───
const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

// ─── MeSH term registry (top common biomedical codes; extend via CSV at runtime) ───
const MESH_REGISTRY: Record<string, string> = {
  D000081082: "SARS-CoV-2 Infection",
  D000086382: "Post-Acute COVID-19 Syndrome",
  D012140: "Respiratory Tract Diseases",
  D009369: "Neoplasms (Cancer)",
  D003924: "Diabetes Mellitus",
  D006973: "Hypertension",
  D015179: "Colorectal Neoplasms",
  D001943: "Breast Neoplasms",
  D008113: "Liver Diseases",
  D002318: "Cardiovascular Diseases",
  D015212: "Inflammatory Bowel Diseases",
  D003141: "Communicable Diseases",
  D000082623: "Artificial Intelligence",
  D015796: "Meta-Analysis as Topic",
  D016453: "Sensitivity and Specificity",
};

// ─── Common assignee slug normalization ───
const ASSIGNEE_OVERRIDES: Record<string, string> = {
  siemens_ag: "Siemens AG",
  general_electric: "General Electric Company",
  ibm_corp: "International Business Machines Corp.",
  samsung_electronics: "Samsung Electronics Co., Ltd.",
  huawei_tech: "Huawei Technologies Co., Ltd.",
  qualcomm_inc: "Qualcomm Inc.",
  intel_corp: "Intel Corporation",
  apple_inc: "Apple Inc.",
  sony_corp: "Sony Corporation",
  hitachi_ltd: "Hitachi, Ltd.",
  toyota_jidosha: "Toyota Jidosha Kabushiki Kaisha",
  honda_motor: "Honda Motor Co., Ltd.",
  lg_electronics: "LG Electronics Inc.",
  panasonic_corp: "Panasonic Corporation",
  microsoft_corp: "Microsoft Corporation",
};

// ─── Resolvers ────────────────────────────────────────────────────────────

function splitCamelCase(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

function titleizeSlug(s: string): string {
  return s
    .split(/[_\-]/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export type ResolvedEntity = {
  display: string;
  raw: string;
  kind:
    | "cik-fact"
    | "cik"
    | "mesh"
    | "hs-commodity"
    | "region"
    | "patent-assignee"
    | "patent-chunk"
    | "biography-event"
    | "paper"
    | "trade-flow"
    | "country"
    | "station"
    | "concept"
    | "chunk"
    | "event"
    | "location"
    | "unknown";
  subtitle?: string;
  externalUrl?: string;
};

/**
 * Resolve an entity name produced by any BTUT run.
 * Optionally accepts a cikRegistry for cases where the caller has a fuller
 * CIK→name map (e.g., from `edgar_cache.json`) than the embedded registry.
 */
export function resolveEntity(
  name: string,
  cikRegistry?: Map<string, string> | Record<string, string>,
): ResolvedEntity {
  if (!name) return { display: "—", raw: name, kind: "unknown" };

  const cikMap: Map<string, string> = cikRegistry instanceof Map
    ? cikRegistry
    : new Map(Object.entries({ ...CIK_REGISTRY, ...(cikRegistry ?? {}) }));

  // EDGAR-style fact: fact_<CIK>_<ConceptCamelCase>
  const factM = name.match(/^fact_(\d+)_(.+)$/);
  if (factM) {
    const cik = factM[1];
    const concept = factM[2];
    const company = cikMap.get(cik) ?? CIK_REGISTRY[cik] ?? `CIK ${cik}`;
    return {
      display: `${company} · ${splitCamelCase(concept)}`,
      raw: name,
      kind: "cik-fact",
      subtitle: `CIK ${cik}`,
      externalUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
    };
  }

  // PubMed MeSH term: mesh_<MeSH UI>
  const meshM = name.match(/^mesh_(D\d+)$/i);
  if (meshM) {
    const code = meshM[1].toUpperCase();
    const term = MESH_REGISTRY[code];
    return {
      display: term ? `${term} (MeSH ${code})` : `MeSH ${code}`,
      raw: name,
      kind: "mesh",
      subtitle: "PubMed biomedical",
      externalUrl: `https://www.ncbi.nlm.nih.gov/mesh/?term=${code}`,
    };
  }

  // UN Comtrade HS commodity code: commodity_<HS2>
  const hsM = name.match(/^commodity_(\d{2,4})$/);
  if (hsM) {
    const code = hsM[1];
    const hs2 = code.slice(0, 2);
    const desc = HS2_CODES[hs2];
    return {
      display: desc ? `${desc} (HS-${hs2})` : `HS-${code}`,
      raw: name,
      kind: "hs-commodity",
      subtitle: "UN Comtrade",
    };
  }

  // NOAA region / US state
  const regionM = name.match(/^region_([A-Z]{2})$/i);
  if (regionM) {
    const st = regionM[1].toUpperCase();
    const full = US_STATES[st];
    return {
      display: full ? `${full} stations` : `${st} region`,
      raw: name,
      kind: "region",
      subtitle: full ? `NOAA · ${st}` : "NOAA region",
    };
  }

  // Patent assignee: assignee_<slug>
  const assM = name.match(/^assignee_(.+)$/);
  if (assM) {
    const slug = assM[1].toLowerCase();
    const override = ASSIGNEE_OVERRIDES[slug];
    return {
      display: override ?? titleizeSlug(slug),
      raw: name,
      kind: "patent-assignee",
      subtitle: "USPTO assignee",
    };
  }

  // Patent chunk: <corpus>_patent_<year>_<id>_chunk_<n>  or  tesla_crossera_<...>
  if (/patent_chunk/.test(name) || /_patent_\d{4}/.test(name)) {
    // Extract any year + id fragment
    const yearM = name.match(/(\d{4})/);
    const year = yearM ? yearM[1] : null;
    return {
      display: year ? `Patent fragment · ${year}` : "Patent fragment",
      raw: name,
      kind: "patent-chunk",
      subtitle: name,
    };
  }

  // Biography event: <person>_<topic>__event__<slug>
  const bioM = name.match(/^([a-z]+)_([a-z]+)__event__(.+)$/i);
  if (bioM) {
    const person = bioM[1][0].toUpperCase() + bioM[1].slice(1);
    const topic = splitCamelCase(bioM[2]);
    const rest = titleizeSlug(bioM[3]).replace(/\s+/g, " ");
    return {
      display: `${person} · ${topic} · ${rest}`,
      raw: name,
      kind: "biography-event",
      subtitle: "Polymath corpus",
    };
  }

  // Biography concept: <person>_<topic>__concept__<slug>
  const conceptM = name.match(/^([a-z]+)_([a-z]+)__concept__(.+)$/i);
  if (conceptM) {
    const person = conceptM[1][0].toUpperCase() + conceptM[1].slice(1);
    const topic = splitCamelCase(conceptM[2]);
    const concept = titleizeSlug(conceptM[3]);
    return {
      display: `${person} · ${topic} · ${concept}`,
      raw: name,
      kind: "concept",
      subtitle: "Concept",
    };
  }

  // Biography location
  const locM = name.match(/^([a-z]+)_([a-z]+)__location__(.+)$/i);
  if (locM) {
    return {
      display: `${titleizeSlug(locM[1])} · ${titleizeSlug(locM[3])}`,
      raw: name,
      kind: "location",
      subtitle: "Location",
    };
  }

  // Paper: paper_<id> / pmid_<id>
  const paperM = name.match(/^(paper|pmid)_(.+)$/);
  if (paperM) {
    return {
      display: `Paper ${paperM[2]}`,
      raw: name,
      kind: "paper",
      subtitle: "PubMed paper",
    };
  }

  // Country: country_<code>
  const ctryM = name.match(/^country_(\w+)$/);
  if (ctryM) {
    return {
      display: `Country ${ctryM[1].toUpperCase()}`,
      raw: name,
      kind: "country",
      subtitle: "UN Comtrade reporter",
    };
  }

  // Trade flow: trade_flow_<descr>
  const tfM = name.match(/^trade_flow_(.+)$/);
  if (tfM) {
    return {
      display: `Trade flow · ${titleizeSlug(tfM[1])}`,
      raw: name,
      kind: "trade-flow",
      subtitle: "UN Comtrade",
    };
  }

  // Station: station_<id>
  const stM = name.match(/^station_(.+)$/);
  if (stM) {
    return {
      display: `Station ${stM[1]}`,
      raw: name,
      kind: "station",
      subtitle: "NOAA",
    };
  }

  // Filing: filing_<accession>
  const filM = name.match(/^filing_(\d{18})$/);
  if (filM) {
    const acc = filM[1];
    return {
      display: `SEC filing ${acc}`,
      raw: name,
      kind: "cik",
      subtitle: "EDGAR accession",
    };
  }

  // Fallback: split underscores, title-case
  return {
    display: titleizeSlug(name),
    raw: name,
    kind: "unknown",
  };
}
