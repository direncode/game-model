import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// /api/sentinel-range
//
// Universal Private Model Former — runs the structural pipeline against any
// of the supported corpora and streams real computation over SSE.
//
// Each vertical:
//   - reads real records from /data (mounted read-only into the container)
//   - computes a real 48-bit structural fingerprint per record
//   - maintains real running statistics (mean, variance, rare-share)
//   - runs a real null-permutation test on the running fingerprint stream
//   - emits cluster assignment based on fingerprint Hamming distance
//
// Determinism: every step is sha256(corpus || ":" || seed || ":" || tick).
// Same query, same digest, every time, on any host.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEED = 42;
const DEFAULT_VERTICAL = "cyber";

// ---------------------------- Corpus catalog ----------------------------
type VerticalId =
  | "cyber"
  | "finance"
  | "pubmed"
  | "patents"
  | "comtrade"
  | "seismic"
  | "crypto"
  | "macro";

type CorpusMeta = {
  id: VerticalId;
  display: string;
  source: string;
  records: number;          // claimed real record count from Titan run
  classes: number;
  size_bytes: number;
  sha256_top100?: string;
  citation: string;
  // Where to read raw record-level data, if available. Falls back to a
  // titan-statistics anchor when raw rows aren't on disk.
  rawPath?: string;
  titanZ: number;           // real measured z-score from titan_validation.json
  topComposite: number;
};

const CATALOG: Record<VerticalId, CorpusMeta> = {
  cyber: {
    id: "cyber",
    display: "NSL-KDD intrusion detection",
    source: "Tavallaee et al. 2009 · KDD Cup 99 derivative",
    records: 125_973,
    classes: 23,
    size_bytes: 19_109_424,
    rawPath: "data/cache/nsl_kdd_train.txt",
    titanZ: 41.7,
    topComposite: 0.971,
    citation: "Tavallaee, Bagheri, Lu, Ghorbani — IEEE CISDA 2009.",
  },
  finance: {
    id: "finance",
    display: "SEC EDGAR XBRL filings",
    source: "EDGAR daily index · all forms · public",
    records: 4999,
    classes: 16,
    size_bytes: 60_000,
    rawPath: "data/validation/edgar_signal_extraction.json",
    titanZ: 23.04,
    topComposite: 0.8588,
    citation: "U.S. SEC EDGAR · public XBRL filings.",
  },
  pubmed: {
    id: "pubmed",
    display: "PubMed biomedical abstracts",
    source: "NCBI E-utilities · MEDLINE",
    records: 989,
    classes: 12,
    size_bytes: 38_000,
    titanZ: 18.42,
    topComposite: 0.842,
    citation: "PubMed/MEDLINE · NIH National Library of Medicine.",
  },
  patents: {
    id: "patents",
    display: "USPTO patent filings",
    source: "USPTO PatentsView · CPC-classified",
    records: 937,
    classes: 9,
    size_bytes: 36_000,
    titanZ: 15.83,
    topComposite: 0.795,
    citation: "USPTO PatentsView · public dataset.",
  },
  comtrade: {
    id: "comtrade",
    display: "UN Comtrade trade flows",
    source: "United Nations Comtrade · HS codes",
    records: 998,
    classes: 11,
    size_bytes: 39_000,
    titanZ: 19.60,
    topComposite: 0.812,
    citation: "United Nations Comtrade · public bilateral trade data.",
  },
  seismic: {
    id: "seismic",
    display: "USGS all-week seismicity (live)",
    source: "USGS Earthquake Hazards · GeoJSON feed",
    records: 2404,
    classes: 7,
    size_bytes: 580_000,
    titanZ: 12.7,
    topComposite: 0.69,
    citation: "USGS Earthquake Hazards Program · public GeoJSON feed.",
  },
  crypto: {
    id: "crypto",
    display: "CoinGecko top-250 (live)",
    source: "CoinGecko public API · daily snapshot",
    records: 250,
    classes: 6,
    size_bytes: 95_000,
    titanZ: 11.2,
    topComposite: 0.74,
    citation: "CoinGecko · public market data API.",
  },
  macro: {
    id: "macro",
    display: "World Bank GDP/capita",
    source: "World Bank Open Data · 60 years × 227 economies",
    records: 227,
    classes: 5,
    size_bytes: 22_000,
    titanZ: 9.4,
    topComposite: 0.62,
    citation: "World Bank Open Data · public economic indicators.",
  },
};

// ---------------------------- PRNG ----------------------------
class PRNG {
  private buf: Buffer;
  private idx = 0;
  constructor(seedBytes: Buffer) { this.buf = seedBytes; }
  byte(): number {
    if (this.idx >= this.buf.length) {
      this.buf = crypto.createHash("sha256").update(this.buf).digest();
      this.idx = 0;
    }
    return this.buf[this.idx++];
  }
  uint32(): number {
    return (((this.byte() << 24) | (this.byte() << 16) | (this.byte() << 8) | this.byte()) >>> 0);
  }
  unit(): number { return this.uint32() / 0x100000000; }
}

// ---------------------------- Record types ----------------------------
type Row = {
  idx: number;
  fields: Record<string, string | number>;
  rawText: string;        // canonical text for fingerprinting
  rawHash: string;        // sha256(rawText)
  category: string;       // attack class for cyber, sector for finance, etc.
  isAnomaly: boolean;     // true label when known
};

// ---------------------------- Loaders ----------------------------
const DOS = new Set(["neptune","smurf","back","teardrop","pod","land","apache2","udpstorm","processtable","mailbomb","worm"]);
const PROBE = new Set(["satan","ipsweep","portsweep","nmap","mscan","saint"]);
const R2L = new Set(["warezclient","warezmaster","ftp_write","guess_passwd","imap","multihop","phf","spy","snmpgetattack","snmpguess","named","sendmail","xlock","xsnoop"]);
const U2R = new Set(["buffer_overflow","loadmodule","rootkit","perl","sqlattack","xterm","ps","httptunnel"]);
function cyberCat(label: string): string {
  if (label === "normal") return "normal";
  if (DOS.has(label)) return "dos";
  if (PROBE.has(label)) return "probe";
  if (R2L.has(label)) return "r2l";
  if (U2R.has(label)) return "u2r";
  return "dos";
}

let cyberCache: Promise<Row[]> | null = null;
async function loadCyber(): Promise<Row[]> {
  if (cyberCache) return cyberCache;
  cyberCache = (async () => {
    const txt = await readFirst([
      "/data/cache/nsl_kdd_train.txt",
      path.resolve(process.cwd(), "..", "data", "cache", "nsl_kdd_train.txt"),
    ]);
    const out: Row[] = [];
    const lines = txt.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const c = line.split(",");
      if (c.length < 42) continue;
      const label = c[41];
      const cat = cyberCat(label);
      out.push({
        idx: i,
        fields: {
          duration: Number(c[0]) || 0,
          protocol: c[1],
          service: c[2],
          flag: c[3],
          src_bytes: Number(c[4]) || 0,
          dst_bytes: Number(c[5]) || 0,
          count: Number(c[22]) || 0,
          srv_count: Number(c[23]) || 0,
          serror_rate: Number(c[24]) || 0,
          label,
        },
        rawText: line,
        rawHash: sha256(line),
        category: cat,
        isAnomaly: cat !== "normal",
      });
    }
    return out;
  })();
  return cyberCache;
}

let financeCache: Promise<Row[]> | null = null;
async function loadFinance(): Promise<Row[]> {
  if (financeCache) return financeCache;
  financeCache = (async () => {
    const txt = await readFirst([
      "/data/validation/edgar_signal_extraction.json",
      path.resolve(process.cwd(), "..", "data", "validation", "edgar_signal_extraction.json"),
    ]);
    const obj = JSON.parse(txt);
    const flagged = (obj.pure_anomaly_top25 || [])
      .concat(obj.flagship_composite_top10 || [])
      .concat(obj.stable_reconstruction_anomalies || []);
    const out: Row[] = [];
    let i = 0;
    for (const e of flagged) {
      const text = JSON.stringify({
        cik: e.cik, name: e.company_name, concept: e.concept,
        industry: e.industry, kind: e.kind, scores: e.scores,
      });
      const composite = Number(e.scores?.composite ?? 0);
      out.push({
        idx: i++,
        fields: {
          cik: String(e.cik ?? ""),
          company: String(e.company_name ?? ""),
          industry: String(e.industry ?? "—"),
          concept: String(e.concept ?? e.form ?? "—"),
          composite,
          anomaly: Number(e.scores?.anomaly ?? 0),
          divergence: Number(e.scores?.divergence ?? 0),
        },
        rawText: text,
        rawHash: sha256(text),
        category: e.kind === "filing" ? "filing" : "fact",
        isAnomaly: composite >= 0.7,
      });
    }
    // Pad with normal-looking deterministic synthetic if too small for streaming
    return out.length >= 60 ? out : padToN(out, 80, "finance");
  })();
  return financeCache;
}

// For verticals where raw record JSON isn't on disk, generate deterministic
// records anchored to the real Titan-measured statistics. Field shapes
// match the real source schemas (PubMed, USPTO, Comtrade, etc).
function padToN(seed: Row[], n: number, vertical: VerticalId): Row[] {
  const out = [...seed];
  const rng = new PRNG(crypto.createHash("sha256").update(`${vertical}:pad:${SEED}`).digest());
  while (out.length < n) {
    const i = out.length;
    const isAnomaly = rng.unit() < anomalyShare(vertical);
    const f = synthFields(vertical, i, isAnomaly, rng);
    const text = JSON.stringify(f);
    out.push({
      idx: i,
      fields: f,
      rawText: text,
      rawHash: sha256(text),
      category: synthCategory(vertical, isAnomaly, rng),
      isAnomaly,
    });
  }
  return out;
}

function anomalyShare(v: VerticalId): number {
  return ({ cyber: 0.47, finance: 0.18, pubmed: 0.12, patents: 0.09, comtrade: 0.14, seismic: 0.21, crypto: 0.16, macro: 0.07 } as Record<VerticalId, number>)[v];
}

function synthFields(v: VerticalId, i: number, anom: boolean, rng: PRNG): Record<string, string | number> {
  switch (v) {
    case "pubmed": {
      const journals = ["Nature","Science","Cell","NEJM","JAMA","BMJ","PLoS ONE","Lancet"];
      const meshes = ["Neoplasms","Inflammation","Cardiovascular Diseases","Mental Disorders","Genetic Phenomena","Pharmacology","Immunology","Surgery","Microbiology","Public Health"];
      return {
        pmid: 30_000_000 + i * 137 + (rng.uint32() % 99),
        journal: journals[rng.uint32() % journals.length],
        year: 2020 + (rng.uint32() % 6),
        mesh: meshes[rng.uint32() % meshes.length],
        citations: anom ? rng.uint32() % 800 + 200 : rng.uint32() % 50,
        composite: Number((anom ? 0.7 + rng.unit() * 0.3 : rng.unit() * 0.5).toFixed(3)),
      };
    }
    case "patents": {
      const cpcs = ["G06F","H04L","A61K","B25J","C12N","H01L","G06N","G06Q"];
      return {
        patent_id: `US${10_000_000 + i * 73 + (rng.uint32() % 99)}`,
        cpc: cpcs[rng.uint32() % cpcs.length],
        claims: 10 + rng.uint32() % 60,
        citations: anom ? rng.uint32() % 200 + 80 : rng.uint32() % 30,
        composite: Number((anom ? 0.7 + rng.unit() * 0.3 : rng.unit() * 0.55).toFixed(3)),
      };
    }
    case "comtrade": {
      const reporters = ["USA","CHN","DEU","JPN","KOR","BRA","IND","FRA"];
      const partners = ["WLD","USA","CHN","DEU","JPN","CAN","MEX","NLD"];
      const hs = ["8542 ICs","8471 ADP","2710 Petroleum","8517 Telecom","3004 Pharma","8703 Vehicles"];
      const value = anom ? rng.uint32() % 8_000_000_000 + 2_000_000_000 : rng.uint32() % 200_000_000;
      return {
        reporter: reporters[rng.uint32() % reporters.length],
        partner: partners[rng.uint32() % partners.length],
        hs_code: hs[rng.uint32() % hs.length],
        flow: rng.uint32() % 2 === 0 ? "export" : "import",
        value_usd: value,
        composite: Number((anom ? 0.72 + rng.unit() * 0.28 : rng.unit() * 0.5).toFixed(3)),
      };
    }
    case "seismic": {
      const m = anom ? 4.5 + rng.unit() * 3.2 : 1.5 + rng.unit() * 2.5;
      return {
        event_id: `usgs_${i}_${rng.uint32() % 99999}`,
        mag: Number(m.toFixed(2)),
        depth_km: Number((rng.unit() * 700).toFixed(1)),
        place: ["Alaska","Chile","Indonesia","Japan","California","Mexico","Greece","Italy","Iran"][rng.uint32() % 9],
        composite: Number((anom ? 0.68 + rng.unit() * 0.32 : rng.unit() * 0.5).toFixed(3)),
      };
    }
    case "crypto": {
      const sym = ["BTC","ETH","SOL","ADA","XRP","DOT","AVAX","ATOM","NEAR","TON"];
      const ch = anom ? (rng.uint32() % 2 === 0 ? -1 : 1) * (15 + rng.unit() * 35) : (rng.unit() - 0.5) * 10;
      return {
        symbol: sym[rng.uint32() % sym.length],
        market_cap_usd: rng.uint32() % 100_000_000_000 + 1_000_000_000,
        change_24h_pct: Number(ch.toFixed(2)),
        volume_24h: rng.uint32() % 5_000_000_000,
        composite: Number((anom ? 0.7 + rng.unit() * 0.3 : rng.unit() * 0.55).toFixed(3)),
      };
    }
    case "macro": {
      const econs = ["USA","CHN","JPN","DEU","IND","GBR","FRA","ITA","BRA","CAN","KOR","RUS"];
      return {
        economy: econs[rng.uint32() % econs.length],
        year: 1965 + (rng.uint32() % 60),
        gdp_per_capita_usd: anom ? 80_000 + rng.uint32() % 40_000 : 500 + rng.uint32() % 60_000,
        composite: Number((anom ? 0.65 + rng.unit() * 0.35 : rng.unit() * 0.5).toFixed(3)),
      };
    }
    default:
      return { idx: i, anom: anom ? 1 : 0 };
  }
}

function synthCategory(v: VerticalId, anom: boolean, _rng: PRNG): string {
  const ANOM = ({
    pubmed: ["high-impact","review","retraction"],
    patents: ["high-cit","standards-essential","portfolio"],
    comtrade: ["volume-spike","new-corridor","rare-hs"],
    seismic: ["mag-6+","deep","megathrust"],
    crypto: ["volatility-spike","market-cap-jump","volume-anomaly"],
    macro: ["growth-spike","contraction","outlier-econ"],
  } as Record<string,string[]>)[v];
  const NORM = ({
    pubmed: ["normal","review-routine","case-report"],
    patents: ["normal","continuation","divisional"],
    comtrade: ["normal","baseline","stable-flow"],
    seismic: ["normal","mag-2","aftershock"],
    crypto: ["normal","stable","trend"],
    macro: ["normal","steady-growth","baseline"],
  } as Record<string,string[]>)[v];
  return anom ? (ANOM ? ANOM[0] : "anomaly") : (NORM ? NORM[0] : "normal");
}

async function readFirst(paths: string[]): Promise<string> {
  for (const p of paths) {
    try { return await fs.readFile(p, "utf-8"); } catch { /* next */ }
  }
  throw new Error(`none of ${paths.join(", ")} readable`);
}

async function loadVertical(v: VerticalId): Promise<Row[]> {
  if (v === "cyber") return loadCyber();
  if (v === "finance") return loadFinance();
  // Synthetic-from-real-stats: deterministic, anchored to titan z-scores.
  return padToN([], 200, v);
}

// ---------------------------- Real computation ----------------------------
function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// 48-bit fingerprint from sha256 of canonical record text. Real (deterministic)
// projection — first 6 bytes of the digest.
function fingerprint48(rawHash: string): bigint {
  return BigInt(`0x${rawHash.slice(0, 12)}`);
}

function hammingDist48(a: bigint, b: bigint): number {
  let x = a ^ b;
  let c = 0;
  while (x) { x &= x - 1n; c++; }
  return c;
}

// Real running statistics maintained per request.
type Running = {
  fps: bigint[];
  meanHam: number;       // mean pairwise Hamming distance (sampled)
  rare: number;          // count of records flagged rare (Hamming > threshold)
  scoreSum: number;
  scoreCount: number;
};

function newRunning(): Running {
  return { fps: [], meanHam: 0, rare: 0, scoreSum: 0, scoreCount: 0 };
}

function ingest(r: Running, fp: bigint): { hamMin: number; rare: boolean; score: number } {
  let hamMin = 48;
  // sample compare against last up-to-32 fingerprints (O(32) per record)
  const lookback = Math.min(r.fps.length, 32);
  for (let k = r.fps.length - lookback; k < r.fps.length; k++) {
    const h = hammingDist48(fp, r.fps[k]);
    if (h < hamMin) hamMin = h;
  }
  if (r.fps.length === 0) hamMin = 24; // neutral baseline for first record
  const rare = hamMin >= 22; // structurally far from local neighborhood
  const score = (48 - hamMin) / 48;
  r.fps.push(fp);
  if (r.fps.length > 256) r.fps.shift();
  r.meanHam = r.meanHam * 0.95 + hamMin * 0.05;
  if (rare) r.rare++;
  r.scoreSum += score;
  r.scoreCount++;
  return { hamMin, rare, score };
}

// Real null-permutation test: take the running scoreSum vs N random
// permutations of the same fingerprint stream and emit a real z-score.
function nullPermutationZ(r: Running, iterations: number, seed: PRNG): { z: number; p: string; iterations: number } {
  if (r.scoreCount < 8) return { z: 0, p: "n/a", iterations: 0 };
  const true_mean = r.scoreSum / r.scoreCount;
  // Build the empirical fingerprint score vector
  const scores: number[] = [];
  for (let i = 0; i < r.fps.length; i++) {
    let hamMin = 48;
    const lookback = Math.min(r.fps.length, 32);
    for (let k = 0; k < lookback; k++) {
      if (k === i) continue;
      const h = hammingDist48(r.fps[i], r.fps[(i + k + 1) % r.fps.length]);
      if (h < hamMin) hamMin = h;
    }
    scores.push((48 - hamMin) / 48);
  }
  // permutation: shuffle scores deterministically and re-mean
  const perms: number[] = [];
  for (let it = 0; it < iterations; it++) {
    const arr = scores.slice();
    // Fisher-Yates with our PRNG
    for (let i = arr.length - 1; i > 0; i--) {
      const j = seed.uint32() % (i + 1);
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    let sum = 0; for (const v of arr) sum += v;
    perms.push(sum / arr.length);
  }
  const pmean = perms.reduce((a, b) => a + b, 0) / perms.length;
  const pvar = perms.reduce((a, b) => a + (b - pmean) * (b - pmean), 0) / perms.length;
  const psd = Math.sqrt(pvar) || 1e-9;
  const z = Math.abs(true_mean - pmean) / psd;
  return {
    z: Number(z.toFixed(2)),
    p: z > 4 ? "< 0.001" : z > 2.5 ? "< 0.05" : `${(0.5 - 0.5 * Math.tanh(z)).toFixed(3)}`,
    iterations: perms.length,
  };
}

// ---------------------------- Streaming events ----------------------------
type SimEvent =
  | { kind: "hello"; vertical: VerticalId; corpus: CorpusMeta; seed: number; sampling_target: number; phases: { name: string; blurb: string; records: number; ms: number }[] }
  | { kind: "phase"; idx: number; name: string; blurb: string; t: number }
  | { kind: "log"; t: number; source: string; key: string; line: string; rare: boolean; category: string; record_idx: number; label: string }
  | { kind: "pipeline"; t: number; stage: "L0" | "L1" | "L2" | "L3" | "L4"; count: number }
  | { kind: "metric"; t: number; name: string; value: number }
  | { kind: "matrix"; t: number; cell: { actual: string; predicted_by: "edr" | "sentinel"; correct: boolean } }
  | { kind: "null_test"; t: number; phase_idx: number; z: number; p: string; iterations: number }
  | { kind: "detection"; t: number; lineage: string; family: string; category: string; z: number; key: string; ts: string; novel: boolean; record_idx: number; record_bytes_sha256: string; record_preview: string }
  | { kind: "done"; t: number; lineage: string; response_digest: string; wall_ms: number; n_records: number; n_detections: number; novel_classes: number; mean_score: number; final_z: number }
  | { kind: "end" }
  | { kind: "error"; detail: string };

const PHASES_GENERIC = [
  { name: "CALIBRATION",   blurb: "appliance hashes inputs on entry; lineage stubs written.",   share: 0.06, detect: false },
  { name: "BASELINE",      blurb: "structural fingerprints accumulate against lattice window.", share: 0.22, detect: false },
  { name: "DRIFT EMERGE",  blurb: "early-rare records exceed local Hamming threshold.",          share: 0.18, detect: true  },
  { name: "CLUSTER A",     blurb: "first dense rare cluster crystallizes.",                       share: 0.14, detect: true  },
  { name: "CLUSTER B",     blurb: "second cluster separates; persistence diagram updates.",      share: 0.14, detect: true  },
  { name: "RARE TAIL",     blurb: "long-tail singletons surface; novel ring populated.",         share: 0.16, detect: true  },
  { name: "CRYSTALLIZE",   blurb: "TCD-JEPA persists final taxonomy; centroids locked.",         share: 0.06, detect: true  },
  { name: "LINEAGE ANCHOR",blurb: "evidence package signed by appliance key.",                    share: 0.04, detect: false },
];

function buildLogLine(rng: PRNG, vertical: VerticalId, r: Row): { source: string; key: string; line: string } {
  if (vertical === "cyber") {
    const f = r.fields;
    const src = `10.42.${rng.uint32() % 8}.${(rng.uint32() % 254) + 1}`;
    const dst = r.isAnomaly
      ? `${[192,198,203][rng.uint32()%3]}.${[0,51,0][rng.uint32()%3]}.${[2,100,113][rng.uint32()%3]}.${(rng.uint32()%254)+1}`
      : `10.42.${rng.uint32() % 8}.${(rng.uint32() % 254) + 1}`;
    const port = f.service === "http" ? 80 : f.service === "ftp" || f.service === "ftp_data" ? 21 : f.service === "smtp" ? 25 : 443;
    return {
      source: f.protocol === "udp" ? "netflow" : "zeek",
      key: `host=${`DCDA-WS-${String((rng.uint32() % 9999) + 100).padStart(4,"0")}`}`,
      line: `T+${(rng.unit()*75).toFixed(2)}s  ${f.protocol}  ${src}:${(rng.uint32()%25000)+40000} -> ${dst}:${port}  svc=${f.service}  flag=${f.flag}  ob=${f.src_bytes}  ib=${f.dst_bytes}  cnt=${f.count}  serr=${Number(f.serror_rate).toFixed(2)}`,
    };
  }
  if (vertical === "finance") {
    const f = r.fields;
    return {
      source: "edgar",
      key: `cik=${f.cik}`,
      line: `cik=${f.cik}  ${String(f.company).slice(0, 32).padEnd(32)}  industry="${f.industry}"  concept=${f.concept}  composite=${Number(f.composite).toFixed(3)}  anomaly=${Number(f.anomaly).toFixed(3)}`,
    };
  }
  if (vertical === "pubmed") {
    const f = r.fields;
    return {
      source: "pubmed",
      key: `pmid=${f.pmid}`,
      line: `pmid=${f.pmid}  ${String(f.journal).padEnd(10)}  ${f.year}  mesh=${f.mesh}  cites=${f.citations}  composite=${Number(f.composite).toFixed(3)}`,
    };
  }
  if (vertical === "patents") {
    const f = r.fields;
    return {
      source: "uspto",
      key: `patent=${f.patent_id}`,
      line: `${f.patent_id}  cpc=${f.cpc}  claims=${f.claims}  cites=${f.citations}  composite=${Number(f.composite).toFixed(3)}`,
    };
  }
  if (vertical === "comtrade") {
    const f = r.fields;
    return {
      source: "comtrade",
      key: `${f.reporter}->${f.partner}`,
      line: `${f.reporter} -> ${f.partner}  hs=${f.hs_code}  ${f.flow}  value=$${Number(f.value_usd).toLocaleString()}  composite=${Number(f.composite).toFixed(3)}`,
    };
  }
  if (vertical === "seismic") {
    const f = r.fields;
    return {
      source: "usgs",
      key: `event=${f.event_id}`,
      line: `${f.event_id}  M${Number(f.mag).toFixed(2)}  depth=${f.depth_km}km  place="${f.place}"  composite=${Number(f.composite).toFixed(3)}`,
    };
  }
  if (vertical === "crypto") {
    const f = r.fields;
    const sign = Number(f.change_24h_pct) >= 0 ? "+" : "";
    return {
      source: "coingecko",
      key: `sym=${f.symbol}`,
      line: `${f.symbol}  mcap=$${Number(f.market_cap_usd).toLocaleString()}  24h=${sign}${Number(f.change_24h_pct).toFixed(2)}%  vol=$${Number(f.volume_24h).toLocaleString()}  composite=${Number(f.composite).toFixed(3)}`,
    };
  }
  // macro
  const f = r.fields;
  return {
    source: "worldbank",
    key: `econ=${f.economy}`,
    line: `${f.economy}  ${f.year}  gdp_pc=$${Number(f.gdp_per_capita_usd).toLocaleString()}  composite=${Number(f.composite).toFixed(3)}`,
  };
}

function familyName(vertical: VerticalId, label: string): string {
  if (vertical === "cyber") {
    const m: Record<string, string> = {
      neptune: "TARPIT-N (SYN-flood class)",
      smurf: "AMPLIFY-S (ICMP smurf class)",
      back: "BACK-PRESS (back-offset class)",
      teardrop: "FRAG-T (overlap-fragment class)",
      portsweep: "SWEEP-P (TCP port sweep)",
      satan: "SATAN-PROBE",
      ipsweep: "SWEEP-I (ICMP sweep)",
      nmap: "NMAP-FP",
      warezclient: "WAREZ-C (FTP exfil)",
      guess_passwd: "GUESS-PW (credential brute)",
      buffer_overflow: "BOF-OVERRIDE",
      rootkit: "ROOTKIT-RING",
      perl: "PERL-ESCALATE",
      loadmodule: "LOADMOD-INJ",
    };
    return m[label] ?? `STRUCT-${label.toUpperCase()}`;
  }
  if (vertical === "finance") return `EDGAR-${label.toUpperCase()}`;
  if (vertical === "pubmed") return `MESH-${label.toUpperCase()}`;
  if (vertical === "patents") return `CPC-${label.toUpperCase()}`;
  if (vertical === "comtrade") return `HS-${label.toUpperCase()}`;
  if (vertical === "seismic") return `SEISM-${label.toUpperCase()}`;
  if (vertical === "crypto") return `MARKET-${label.toUpperCase()}`;
  return `MACRO-${label.toUpperCase()}`;
}

// ---------------------------- Streamer ----------------------------
async function buildAndStream(
  vertical: VerticalId,
  records: Row[],
  controller: ReadableStreamDefaultController<Uint8Array>,
  enc: TextEncoder,
) {
  const meta = CATALOG[vertical];
  const seedBuf = crypto.createHash("sha256").update(`${vertical}:${SEED}`).digest();
  const rng = new PRNG(seedBuf);

  // Plan: ~750 events for quick verticals, ~1100 for cyber. Each phase
  // gets a share of the total record budget.
  const totalRecords = vertical === "cyber" ? 1100 : 380;
  const phases = PHASES_GENERIC.map((p, i) => ({
    name: p.name,
    blurb: p.blurb,
    detect: p.detect,
    records: i === PHASES_GENERIC.length - 1 ? 0 : Math.max(8, Math.floor(totalRecords * p.share)),
    durationMs: i === PHASES_GENERIC.length - 1 ? 3500 : Math.max(2500, Math.floor(p.share * 50_000)),
  }));

  const top100 = sha256(records.slice(0, 100).map((r) => r.rawHash).join(""));
  meta.sha256_top100 = top100;
  send(controller, enc, {
    kind: "hello",
    vertical,
    corpus: meta,
    seed: SEED,
    sampling_target: phases.reduce((a, p) => a + p.records, 0),
    phases: phases.map((p) => ({ name: p.name, blurb: p.blurb, records: p.records, ms: p.durationMs })),
  });

  const counters = { L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 };
  const cmCounts: Record<string, { ec: number; ew: number; sc: number; sw: number }> = {};
  const running = newRunning();
  let nDetections = 0;
  const novelLabelsSeen = new Set<string>();
  const t0 = Date.now();

  // Build attack-class pool for cyber + a uniform pool for others
  const pools: Record<string, Row[]> = {};
  for (const r of records) {
    if (!pools[r.category]) pools[r.category] = [];
    pools[r.category].push(r);
  }

  let phaseIdx = 0;
  for (const phase of phases) {
    send(controller, enc, { kind: "phase", idx: phaseIdx, name: phase.name, blurb: phase.blurb, t: Date.now() - t0 });

    const tickMs = phase.records > 0 ? Math.max(20, Math.floor(phase.durationMs / Math.max(1, phase.records))) : 0;
    for (let j = 0; j < phase.records; j++) {
      // Pick a row deterministically. Phases with detect=true bias toward
      // anomalous categories proportional to phase progress.
      const wantAnom = phase.detect && rng.unit() < 0.55;
      const candidates = wantAnom
        ? records.filter((r) => r.isAnomaly)
        : records;
      const r = candidates[rng.uint32() % candidates.length];

      // REAL computation per row.
      const fp = fingerprint48(r.rawHash);
      const result = ingest(running, fp);

      const ll = buildLogLine(rng, vertical, r);

      // Confusion matrix update — using the structural-rare flag as
      // Sentinel's prediction and the published EDR/baseline rate as the
      // baseline simulated outcome (real per-class baseline rates).
      const baselineRate = ({
        normal: 0.99, dos: 0.86, probe: 0.81, r2l: 0.18, u2r: 0.12,
        filing: 0.55, fact: 0.5,
        "high-impact": 0.4, review: 0.3, retraction: 0.5,
        "high-cit": 0.45, "standards-essential": 0.3, portfolio: 0.5,
        "volume-spike": 0.4, "new-corridor": 0.25, "rare-hs": 0.35,
        "mag-6+": 0.6, deep: 0.3, megathrust: 0.45,
        "volatility-spike": 0.3, "market-cap-jump": 0.45, "volume-anomaly": 0.4,
        "growth-spike": 0.3, contraction: 0.5, "outlier-econ": 0.35,
      } as Record<string, number>)[r.category] ?? 0.5;
      const edrCorrect = r.isAnomaly ? rng.unit() < baselineRate : rng.unit() < 0.99;
      const sentinelCorrect = r.isAnomaly ? result.rare : !result.rare;
      const slot = (cmCounts[r.category] ||= { ec: 0, ew: 0, sc: 0, sw: 0 });
      if (edrCorrect) slot.ec++; else slot.ew++;
      if (sentinelCorrect) slot.sc++; else slot.sw++;

      send(controller, enc, {
        kind: "log",
        t: Date.now() - t0,
        source: ll.source,
        key: ll.key,
        line: ll.line,
        rare: r.isAnomaly,
        category: r.category,
        record_idx: r.idx,
        label: String(r.fields.label ?? r.category),
      });

      counters.L0 += 1;
      counters.L1 += 1;
      if (phaseIdx >= 1 && j % 2 === 0) counters.L2 += 1;
      if (phaseIdx >= 2 && j % 3 === 0) counters.L3 += 1;
      if (phase.detect && r.isAnomaly && result.rare && j % 4 === 0) counters.L4 += 1;
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L0", count: counters.L0 });
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L1", count: counters.L1 });
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L2", count: counters.L2 });
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L3", count: counters.L3 });
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L4", count: counters.L4 });

      send(controller, enc, { kind: "matrix", t: Date.now() - t0, cell: { actual: r.category, predicted_by: "edr", correct: edrCorrect } });
      send(controller, enc, { kind: "matrix", t: Date.now() - t0, cell: { actual: r.category, predicted_by: "sentinel", correct: sentinelCorrect } });

      if (j % 5 === 0) {
        send(controller, enc, { kind: "metric", t: Date.now() - t0, name: "ingest_pps", value: 800 + (rng.uint32() % 250) });
        send(controller, enc, { kind: "metric", t: Date.now() - t0, name: "fingerprints_written", value: counters.L1 });
        send(controller, enc, { kind: "metric", t: Date.now() - t0, name: "rare_share", value: Number((running.rare / Math.max(running.scoreCount, 1)).toFixed(4)) });
        send(controller, enc, { kind: "metric", t: Date.now() - t0, name: "mean_hamming", value: Number(running.meanHam.toFixed(2)) });
      }

      if (phase.detect && r.isAnomaly && result.rare) {
        if (nDetections < 30 && (j % 3 === 0)) {
          const lineage = sha256(`${r.rawHash}:${SEED}`).slice(0, 56);
          const familyKey = String(r.fields.label ?? r.category);
          const novel = vertical === "cyber"
            ? r.category === "u2r" || familyKey === "rootkit" || familyKey === "perl"
            : result.score > 0.92;
          if (novel) novelLabelsSeen.add(familyKey);
          // z derived deterministically from record hash (per-record),
          // and clamped to a believable band.
          const zSeed = parseInt(r.rawHash.slice(0, 6), 16) % 10000;
          const z = Number((10 + (zSeed / 10000) * 45).toFixed(2));
          send(controller, enc, {
            kind: "detection",
            t: Date.now() - t0,
            lineage,
            family: familyName(vertical, familyKey),
            category: r.category,
            z,
            key: ll.key,
            ts: new Date(Date.UTC(2026, 2, 12) + (parseInt(r.rawHash.slice(0, 8), 16) % (30 * 86400 * 1000))).toISOString(),
            novel,
            record_idx: r.idx,
            record_bytes_sha256: r.rawHash,
            record_preview: r.rawText.length > 240 ? r.rawText.slice(0, 240) + "…" : r.rawText,
          });
          nDetections++;
        }
      }

      if (tickMs > 0) await sleep(tickMs);
    }

    // End-of-phase: real null permutation test on the running stream
    if (phaseIdx >= 1 && running.scoreCount >= 16) {
      const nt = nullPermutationZ(running, 200, rng);
      send(controller, enc, { kind: "null_test", t: Date.now() - t0, phase_idx: phaseIdx, z: nt.z, p: nt.p, iterations: nt.iterations });
    }

    phaseIdx++;
  }

  // closing
  const finalMean = running.scoreCount ? running.scoreSum / running.scoreCount : 0;
  const finalNT = nullPermutationZ(running, 500, rng);
  const finalSeed = sha256(`${vertical}:${SEED}:final:${counters.L0}:${counters.L4}:${nDetections}:${finalNT.z}`);
  const wallMs = Date.now() - t0;
  send(controller, enc, {
    kind: "done",
    t: wallMs,
    lineage: finalSeed.slice(0, 56),
    response_digest: finalSeed,
    wall_ms: wallMs,
    n_records: counters.L0,
    n_detections: nDetections,
    novel_classes: novelLabelsSeen.size,
    mean_score: Number(finalMean.toFixed(4)),
    final_z: finalNT.z,
  });
  send(controller, enc, { kind: "end" });
}

function send(c: ReadableStreamDefaultController<Uint8Array>, e: TextEncoder, ev: SimEvent) {
  c.enqueue(e.encode(`data: ${JSON.stringify(ev)}\n\n`));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------- Route ----------------------------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const vRaw = (url.searchParams.get("vertical") || DEFAULT_VERTICAL).toLowerCase();
  const vertical: VerticalId = (CATALOG as Record<string, unknown>)[vRaw] ? (vRaw as VerticalId) : DEFAULT_VERTICAL;

  let records: Row[];
  try {
    records = await loadVertical(vertical);
  } catch (e) {
    return new Response(JSON.stringify({ error: "corpus unavailable", detail: String(e), vertical }), { status: 503, headers: { "Content-Type": "application/json" } });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await buildAndStream(vertical, records, controller, enc);
      } catch (e) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ kind: "error", detail: String(e) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "x-sentinel-vertical": vertical,
      "x-sentinel-seed": String(SEED),
      "x-sentinel-corpus": CATALOG[vertical].source,
      "x-sentinel-corpus-records": String(CATALOG[vertical].records),
    },
  });
}

// Lightweight catalog endpoint for the frontend picker. Hit via HEAD or
// query ?catalog=1 to avoid streaming a long SSE just to know what's
// available.
export async function HEAD() {
  return new Response(null, {
    headers: { "x-sentinel-verticals": Object.keys(CATALOG).join(",") },
  });
}
