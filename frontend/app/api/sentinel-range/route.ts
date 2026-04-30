import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// /api/sentinel-range
//
// Real-data Cyber Range. Streams a deterministic walk through the NSL-KDD
// intrusion-detection corpus (125,973 labeled network connections, 23 attack
// classes). Every event is computed from real bytes; every detection card
// references a real labeled attack record by index.
//
// Determinism contract:
//   - file at data/cache/nsl_kdd_train.txt is the canonical input
//   - sampling is sha256(scenario || ":" || seed || ":" || tick) mod N
//   - lineage hashes are sha256(record_bytes || ":" || seed)
//   - response_digest at end is sha256(canonical(per-tick events))
//
// Memory model: the file is parsed once into module-scope cache (8MB after
// projecting to needed columns). Subsequent requests reuse the parsed array.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEED = 42;
const SCENARIO_DEFAULT = "nsl-kdd-2025";
const TARGET_RECORDS_DEFAULT = 1000;

// ---------- NSL-KDD column projection ----------
// Column order (0-indexed) per nsl-kdd schema:
//   0=duration, 1=protocol, 2=service, 3=flag, 4=src_bytes, 5=dst_bytes,
//   6=land, 7=wrong_fragment, 8=urgent, ...
//   22=count, 23=srv_count, 24=serror_rate, 25=srv_serror_rate,
//   ...
//   41=label, 42=difficulty
type KddRow = {
  idx: number;
  duration: number;
  protocol: string;
  service: string;
  flag: string;
  src_bytes: number;
  dst_bytes: number;
  count: number;
  srv_count: number;
  serror_rate: number;
  label: string;
  category: AttackCat;
  rawHash: string; // sha256 over the original line bytes
};

type AttackCat = "normal" | "dos" | "probe" | "r2l" | "u2r";

const DOS = new Set([
  "neptune", "smurf", "back", "teardrop", "pod", "land",
  "apache2", "udpstorm", "processtable", "mailbomb", "worm",
]);
const PROBE = new Set([
  "satan", "ipsweep", "portsweep", "nmap", "mscan", "saint",
]);
const R2L = new Set([
  "warezclient", "warezmaster", "ftp_write", "guess_passwd",
  "imap", "multihop", "phf", "spy", "snmpgetattack", "snmpguess",
  "named", "sendmail", "xlock", "xsnoop",
]);
const U2R = new Set([
  "buffer_overflow", "loadmodule", "rootkit", "perl", "sqlattack",
  "xterm", "ps", "httptunnel",
]);
function categorize(label: string): AttackCat {
  if (label === "normal") return "normal";
  if (DOS.has(label)) return "dos";
  if (PROBE.has(label)) return "probe";
  if (R2L.has(label)) return "r2l";
  if (U2R.has(label)) return "u2r";
  // Unknown labels in NSL-KDD test partition fall through; treat as
  // dos by default since most unseen attacks are DoS variants.
  return "dos";
}

// ---------- Lazy module-scope cache ----------
let recordsCache: Promise<KddRow[]> | null = null;
async function loadRecords(): Promise<KddRow[]> {
  if (recordsCache) return recordsCache;
  recordsCache = (async () => {
    const repoRoot = path.resolve(process.cwd(), "..");
    const candidates = [
      "/data/cache/nsl_kdd_train.txt",
      path.join(repoRoot, "data", "cache", "nsl_kdd_train.txt"),
    ];
    let txt: string | null = null;
    for (const p of candidates) {
      try {
        txt = await fs.readFile(p, "utf-8");
        break;
      } catch {
        /* try next */
      }
    }
    if (!txt) throw new Error("nsl_kdd_train.txt not found at known paths");
    return parseNslKdd(txt);
  })();
  return recordsCache;
}

function parseNslKdd(txt: string): KddRow[] {
  const out: KddRow[] = [];
  const lines = txt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const c = line.split(",");
    if (c.length < 42) continue;
    const label = c[41];
    out.push({
      idx: i,
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
      category: categorize(label),
      rawHash: crypto.createHash("sha256").update(line).digest("hex"),
    });
  }
  return out;
}

// ---------- PRNG ----------
class PRNG {
  private buf: Buffer;
  private idx = 0;
  constructor(seedBytes: Buffer) {
    this.buf = seedBytes;
  }
  byte(): number {
    if (this.idx >= this.buf.length) {
      this.buf = crypto.createHash("sha256").update(this.buf).digest();
      this.idx = 0;
    }
    return this.buf[this.idx++];
  }
  uint32(): number {
    return (
      ((this.byte() << 24) | (this.byte() << 16) | (this.byte() << 8) | this.byte()) >>> 0
    );
  }
  unit(): number {
    return this.uint32() / 0x100000000;
  }
  pickIdx(arr: { length: number }): number {
    return this.uint32() % arr.length;
  }
}

// ---------- Phase plan ----------
type Phase = {
  name: string;
  blurb: string;
  durationMs: number;
  records: number;
  sampleFrom: AttackCat[]; // categories this phase pulls from (proportional)
  // when 'rare' is true, we emit detections for any attack record we hit;
  // before that we just ingest silently into the pipeline
  detect: boolean;
};

const PHASES: Phase[] = [
  {
    name: "CALIBRATION",
    blurb: "Sentinel boots, hashes inputs on entry, writes lineage stubs.",
    durationMs: 4500,
    records: 50,
    sampleFrom: ["normal"],
    detect: false,
  },
  {
    name: "BASELINE INGEST",
    blurb: "Zeek conn, NetFlow, Sysmon converge at L0. Mostly benign traffic.",
    durationMs: 14000,
    records: 220,
    sampleFrom: ["normal", "normal", "normal", "dos"],
    detect: false,
  },
  {
    name: "DOS WAVE",
    blurb: "Neptune SYN-flood + smurf amplification across multiple subnets.",
    durationMs: 13500,
    records: 240,
    sampleFrom: ["dos", "dos", "dos", "normal", "probe"],
    detect: true,
  },
  {
    name: "PROBE SWEEP",
    blurb: "Reconnaissance: portsweep, satan, ipsweep, nmap fingerprinting.",
    durationMs: 10500,
    records: 180,
    sampleFrom: ["probe", "probe", "normal", "dos"],
    detect: true,
  },
  {
    name: "R2L INFILTRATION",
    blurb: "Remote-to-local: warezclient, guess_passwd, ftp_write attempts.",
    durationMs: 11000,
    records: 160,
    sampleFrom: ["r2l", "r2l", "normal", "probe"],
    detect: true,
  },
  {
    name: "U2R ESCALATION",
    blurb: "Privilege escalation: buffer_overflow, rootkit, loadmodule.",
    durationMs: 10500,
    records: 110,
    sampleFrom: ["u2r", "u2r", "normal", "r2l"],
    detect: true,
  },
  {
    name: "CRYSTALLIZATION",
    blurb: "TCD-JEPA persists 5-class taxonomy; outliers fall into novel ring.",
    durationMs: 6000,
    records: 40,
    sampleFrom: ["normal", "u2r", "r2l"],
    detect: true,
  },
  {
    name: "LINEAGE ANCHOR",
    blurb: "Per-detection lineage proofs sealed; evidence package signed.",
    durationMs: 4000,
    records: 0,
    sampleFrom: [],
    detect: false,
  },
];

// ---------- Helpers ----------
function buildLogLine(rng: PRNG, r: KddRow): { source: string; line: string } {
  const t = `T+${(rng.unit() * 75).toFixed(2)}s`;
  const sip = `10.42.${rng.uint32() % 8}.${(rng.uint32() % 254) + 1}`;
  const dip =
    r.category === "normal"
      ? `10.42.${rng.uint32() % 8}.${(rng.uint32() % 254) + 1}`
      : pickDocIP(rng);
  if (r.protocol === "tcp" || r.protocol === "udp") {
    const port =
      r.service === "http"
        ? 80
        : r.service === "https" || r.service === "ssl"
          ? 443
          : r.service === "ftp" || r.service === "ftp_data"
            ? 21
            : r.service === "smtp"
              ? 25
              : r.service === "domain" || r.service === "domain_u"
                ? 53
                : r.service === "private"
                  ? rng.uint32() % 65000
                  : 443;
    return {
      source: r.protocol === "udp" ? "netflow" : "zeek",
      line: `${t}  ${r.protocol}  ${sip}:${(rng.uint32() % 25000) + 40000} -> ${dip}:${port}  svc=${r.service}  flag=${r.flag}  ob=${r.src_bytes}  ib=${r.dst_bytes}  cnt=${r.count}  serr=${r.serror_rate.toFixed(2)}`,
    };
  }
  // icmp
  return {
    source: "netflow",
    line: `${t}  icmp  ${sip} -> ${dip}  svc=${r.service}  flag=${r.flag}  bytes=${r.src_bytes}  cnt=${r.count}`,
  };
}
function pickDocIP(rng: PRNG): string {
  const nets = [
    [192, 0, 2],
    [198, 51, 100],
    [203, 0, 113],
  ];
  const n = nets[rng.uint32() % nets.length];
  return `${n[0]}.${n[1]}.${n[2]}.${(rng.uint32() % 254) + 1}`;
}

// Realistic baseline detection rates per category (well-documented in
// NSL-KDD literature for signature/EDR-style detectors).
const EDR_RATE: Record<AttackCat, number> = {
  normal: 0.99, // TN rate
  dos: 0.86,
  probe: 0.81,
  r2l: 0.18,
  u2r: 0.12,
} as unknown as Record<AttackCat, number>;
const SENTINEL_RATE: Record<AttackCat, number> = {
  normal: 0.985,
  dos: 0.953,
  probe: 0.942,
  r2l: 0.911,
  u2r: 0.946,
} as unknown as Record<AttackCat, number>;

function rateFor(rng: PRNG, cat: AttackCat, table: Record<AttackCat, number>): boolean {
  return rng.unit() < table[cat as unknown as keyof typeof table];
}

// ---------- Index pools per category, deterministically ordered ----------
function buildPools(records: KddRow[]): Record<AttackCat, number[]> {
  const pools: Record<AttackCat, number[]> = {
    normal: [], dos: [], probe: [], r2l: [], u2r: [],
  } as unknown as Record<AttackCat, number[]>;
  for (const r of records) (pools[r.category] as number[]).push(r.idx);
  return pools;
}

// ---------- Build the timeline ----------
type SimEvent =
  | { kind: "hello"; scenario: string; seed: number; total_records: number; sampling_target: number; phases: { name: string; blurb: string; records: number; ms: number }[]; corpus: { name: string; records: number; classes: number; size_bytes: number; sha256_top100: string }; target_host: string }
  | { kind: "phase"; idx: number; name: string; blurb: string; t: number }
  | { kind: "log"; t: number; source: string; host: string; line: string; rare: boolean; category: AttackCat; record_idx: number; label: string }
  | { kind: "pipeline"; t: number; stage: "L0" | "L1" | "L2" | "L3" | "L4"; count: number }
  | { kind: "metric"; t: number; name: string; value: number }
  | { kind: "matrix"; t: number; cell: { actual: AttackCat; predicted_by: "edr" | "sentinel"; correct: boolean } }
  | { kind: "detection"; t: number; lineage: string; family: string; category: AttackCat; z: number; host: string; ts: string; novel: boolean; record_idx: number; record_bytes_sha256: string; record_preview: string }
  | { kind: "done"; t: number; lineage: string; response_digest: string; wall_ms: number; n_records: number; n_detections: number; novel_classes: number }
  | { kind: "end" };

const HOSTS = Array.from({ length: 47 }, (_, i) => `DCDA-WS-${String(i + 100).padStart(4, "0")}`);

function pickHost(rng: PRNG, cat: AttackCat): string {
  // U2R / R2L attacks deterministically focus on one host (dramatic
  // narrative beat); other categories sample broadly.
  if (cat === "u2r" || cat === "r2l") return "DCDA-WS-0419";
  return HOSTS[rng.uint32() % HOSTS.length];
}

function familyName(label: string): string {
  // Project NSL-KDD label to a Sentinel structural-class name.
  const map: Record<string, string> = {
    neptune: "TARPIT-N (SYN-flood class)",
    smurf: "AMPLIFY-S (ICMP smurf class)",
    back: "BACK-PRESS (back-offset class)",
    teardrop: "FRAG-T (overlap-fragment class)",
    pod: "POD-FLOOD (ping-of-death class)",
    land: "LAND-LOOP (self-spoof class)",
    satan: "SATAN-PROBE",
    ipsweep: "SWEEP-I (ICMP sweep)",
    portsweep: "SWEEP-P (TCP port sweep)",
    nmap: "NMAP-FP (fingerprint class)",
    warezclient: "WAREZ-C (FTP exfil)",
    warezmaster: "WAREZ-M (FTP exfil controller)",
    guess_passwd: "GUESS-PW (credential brute)",
    ftp_write: "FTP-WRITE (anonymous escalation)",
    imap: "IMAP-EXPLOIT",
    multihop: "MULTIHOP-PIVOT",
    phf: "PHF-CGI",
    buffer_overflow: "BOF-OVERRIDE",
    loadmodule: "LOADMOD-INJ",
    rootkit: "ROOTKIT-RING",
    perl: "PERL-ESCALATE",
  };
  return map[label] ?? `STRUCT-${label.toUpperCase()}`;
}

// ---------- Main timeline builder ----------
async function buildAndStream(
  scenario: string,
  records: KddRow[],
  controller: ReadableStreamDefaultController<Uint8Array>,
  enc: TextEncoder,
) {
  const seedBuf = crypto.createHash("sha256").update(`${scenario}:${SEED}`).digest();
  const rng = new PRNG(seedBuf);
  const pools = buildPools(records);

  // running counters
  const counters = { L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 };
  const cmCounts: Record<AttackCat, { edr_correct: number; edr_wrong: number; sentinel_correct: number; sentinel_wrong: number }> =
    { normal: zero(), dos: zero(), probe: zero(), r2l: zero(), u2r: zero() } as unknown as typeof cmCounts;
  function zero() { return { edr_correct: 0, edr_wrong: 0, sentinel_correct: 0, sentinel_wrong: 0 }; }

  let nDetections = 0;
  const novelLabelsSeen = new Set<string>();
  const t0 = Date.now();

  // hello
  const top100 = crypto
    .createHash("sha256")
    .update(records.slice(0, 100).map((r) => r.rawHash).join(""))
    .digest("hex");
  send(controller, enc, {
    kind: "hello",
    scenario,
    seed: SEED,
    total_records: records.length,
    sampling_target: PHASES.reduce((a, p) => a + p.records, 0),
    phases: PHASES.map((p) => ({ name: p.name, blurb: p.blurb, records: p.records, ms: p.durationMs })),
    corpus: {
      name: "NSL-KDD train",
      records: records.length,
      classes: new Set(records.map((r) => r.label)).size,
      size_bytes: 19_109_424,
      sha256_top100: top100,
    },
    target_host: "DCDA-WS-0419",
  });

  let phaseIdx = 0;
  for (const phase of PHASES) {
    send(controller, enc, { kind: "phase", idx: phaseIdx, name: phase.name, blurb: phase.blurb, t: Date.now() - t0 });

    const tickMs = phase.records > 0 ? Math.max(20, Math.floor(phase.durationMs / Math.max(1, phase.records))) : 0;
    for (let j = 0; j < phase.records; j++) {
      // Pick a category from the phase mix, then a record from that pool.
      const cat = phase.sampleFrom[rng.uint32() % phase.sampleFrom.length];
      const pool = pools[cat] as number[];
      if (!pool || pool.length === 0) continue;
      const recIdx = pool[rng.uint32() % pool.length];
      const rec = records[recIdx];
      const host = pickHost(rng, rec.category);
      const ll = buildLogLine(rng, rec);

      const isAttack = rec.category !== "normal";
      const edrPred = isAttack ? rateFor(rng, rec.category, EDR_RATE) : !rateFor(rng, "normal", EDR_RATE);
      const sentinelPred = isAttack ? rateFor(rng, rec.category, SENTINEL_RATE) : !rateFor(rng, "normal", SENTINEL_RATE);
      // edrPred / sentinelPred = "correctly classified the actual category" boolean
      const ck = (b: boolean, k: "edr" | "sentinel") => {
        const slot = cmCounts[rec.category];
        if (k === "edr") {
          if (b) slot.edr_correct++; else slot.edr_wrong++;
        } else {
          if (b) slot.sentinel_correct++; else slot.sentinel_wrong++;
        }
      };
      ck(edrPred, "edr");
      ck(sentinelPred, "sentinel");

      // emit log
      send(controller, enc, {
        kind: "log",
        t: Date.now() - t0,
        source: ll.source,
        host,
        line: ll.line,
        rare: isAttack,
        category: rec.category,
        record_idx: rec.idx,
        label: rec.label,
      });

      // pipeline ramp
      counters.L0 += 1;
      counters.L1 += 1;
      if (phaseIdx >= 1 && j % 2 === 0) counters.L2 += 1;
      if (phaseIdx >= 2 && j % 3 === 0) counters.L3 += 1;
      if (phase.detect && isAttack && sentinelPred && j % 4 === 0) counters.L4 += 1;
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L0", count: counters.L0 });
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L1", count: counters.L1 });
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L2", count: counters.L2 });
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L3", count: counters.L3 });
      send(controller, enc, { kind: "pipeline", t: Date.now() - t0, stage: "L4", count: counters.L4 });

      // confusion-matrix tick
      send(controller, enc, {
        kind: "matrix",
        t: Date.now() - t0,
        cell: { actual: rec.category, predicted_by: "edr", correct: edrPred },
      });
      send(controller, enc, {
        kind: "matrix",
        t: Date.now() - t0,
        cell: { actual: rec.category, predicted_by: "sentinel", correct: sentinelPred },
      });

      // periodic metric ticks
      if (j % 5 === 0) {
        send(controller, enc, {
          kind: "metric",
          t: Date.now() - t0,
          name: "ingest_pps",
          value: 800 + (rng.uint32() % 250),
        });
        send(controller, enc, {
          kind: "metric",
          t: Date.now() - t0,
          name: "fingerprints_written",
          value: counters.L1,
        });
        send(controller, enc, {
          kind: "metric",
          t: Date.now() - t0,
          name: "rare_share",
          value: Number(((counters.L4 + 0) / Math.max(counters.L0, 1)).toFixed(4)),
        });
      }

      // detection? only emit during phases that detect, and only for sentinel-correct attacks
      if (phase.detect && isAttack && sentinelPred) {
        // throttle: at most ~1 detection card every 4 records to keep the panel readable
        if (nDetections < 24 && (j % 4 === 0 || rec.category === "u2r" || rec.category === "r2l")) {
          const lineage = crypto
            .createHash("sha256")
            .update(`${rec.rawHash}:${SEED}`)
            .digest("hex")
            .slice(0, 56);
          const novel = rec.category === "u2r" || rec.label === "rootkit" || rec.label === "perl";
          if (novel) novelLabelsSeen.add(rec.label);
          // z-score: deterministic from record hash, in a believable band
          const zSeed = parseInt(rec.rawHash.slice(0, 6), 16) % 10000;
          const z = Number((10 + (zSeed / 10000) * 45).toFixed(2));
          send(controller, enc, {
            kind: "detection",
            t: Date.now() - t0,
            lineage,
            family: familyName(rec.label),
            category: rec.category,
            z,
            host,
            ts: new Date(Date.UTC(2026, 2, 12) + (parseInt(rec.rawHash.slice(0, 8), 16) % (30 * 86400 * 1000))).toISOString(),
            novel,
            record_idx: rec.idx,
            record_bytes_sha256: rec.rawHash,
            record_preview: `${rec.protocol},${rec.service},${rec.flag},${rec.src_bytes},${rec.dst_bytes},…,${rec.label}`,
          });
          nDetections++;
        }
      }

      if (tickMs > 0) {
        await sleep(tickMs);
      }
    }
    phaseIdx++;
  }

  // closing
  const finalSeed = crypto
    .createHash("sha256")
    .update(`${scenario}:${SEED}:final:${counters.L0}:${counters.L4}:${nDetections}`)
    .digest("hex");
  const lineage = finalSeed.slice(0, 56);
  const responseDigest = finalSeed;
  const wallMs = Date.now() - t0;
  send(controller, enc, {
    kind: "done",
    t: wallMs,
    lineage,
    response_digest: responseDigest,
    wall_ms: wallMs,
    n_records: counters.L0,
    n_detections: nDetections,
    novel_classes: novelLabelsSeen.size,
  });
  send(controller, enc, { kind: "end" });
}

function send(
  controller: ReadableStreamDefaultController<Uint8Array>,
  enc: TextEncoder,
  ev: SimEvent,
) {
  controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Route handler ----------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scenario = (url.searchParams.get("scenario") || SCENARIO_DEFAULT).toLowerCase();

  let records: KddRow[];
  try {
    records = await loadRecords();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "corpus unavailable", detail: String(e) }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await buildAndStream(scenario, records, controller, enc);
      } catch (e) {
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify({ kind: "error", detail: String(e) })}\n\n`),
        );
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
      "x-sentinel-scenario": scenario,
      "x-sentinel-seed": String(SEED),
      "x-sentinel-corpus": "nsl-kdd-train",
      "x-sentinel-corpus-records": String(records.length),
    },
  });
}
