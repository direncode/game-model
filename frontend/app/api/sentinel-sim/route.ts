import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// /api/sentinel-sim
//
// Server-Sent Events stream that drives the SentinelSimulation component.
// Emits a deterministic timeline for OPERATION HALCYON-7: telemetry ingest,
// pipeline progression, taxonomy crystallization, detection, lineage anchor.
//
// Determinism: every value is derived from sha256(scenario || seed=42 || tick).
// The stream paces itself with await-sleeps so the client sees real packet
// arrivals, not a precomputed JSON dump.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEED = 42;
const SCENARIO_DEFAULT = "halcyon-7";
const TICK_MS_DEFAULT = 230; // ~110 events over ~25s

type SimEvent =
  | { kind: "phase"; idx: number; name: string; blurb: string; t: number }
  | { kind: "log"; t: number; source: string; host: string; line: string; rare: boolean }
  | { kind: "pipeline"; t: number; stage: "L0" | "L1" | "L2" | "L3" | "L4"; count: number }
  | { kind: "metric"; t: number; name: string; value: number; unit?: string }
  | {
      kind: "detection";
      t: number;
      lineage: string;
      family: string;
      z: number;
      host: string;
      ts: string;
      novel: boolean;
    }
  | { kind: "done"; t: number; lineage: string; response_digest: string; wall_ms: number };

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
  range(lo: number, hi: number): number {
    return lo + (this.byte() % (hi - lo + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.byte() % arr.length];
  }
  hex(n: number): string {
    let s = "";
    for (let i = 0; i < n; i++) s += this.byte().toString(16).padStart(2, "0");
    return s;
  }
  unit(): number {
    return this.byte() / 256;
  }
}

// Doc IPs only — RFC 5737 + RFC 1918. Never emit real public ranges.
const DOC_NETS = [
  [192, 0, 2],
  [198, 51, 100],
  [203, 0, 113],
];
function docIP(rng: PRNG): string {
  const n = rng.pick(DOC_NETS);
  return `${n[0]}.${n[1]}.${n[2]}.${rng.range(1, 254)}`;
}
function lanIP(rng: PRNG): string {
  return `10.42.${rng.range(0, 7)}.${rng.range(1, 254)}`;
}

const HOSTS_BASELINE = [
  "DCDA-WS-0102",
  "DCDA-WS-0207",
  "DCDA-WS-0314",
  "DCDA-WS-0415",
  "DCDA-WS-0419",
  "DCDA-WS-0521",
  "DCDA-WS-0612",
  "DCDA-FILE-01",
  "DCDA-DC-01",
  "DCDA-PRINT-04",
];
const TARGET_HOST = "DCDA-WS-0419";

const SOURCES = ["zeek", "sysmon", "netflow", "edr"] as const;

function buildLogLine(rng: PRNG, source: string, host: string, anomalous: boolean): string {
  const ts = `T+${(rng.unit() * 28).toFixed(2)}s`;
  if (source === "zeek") {
    const sip = lanIP(rng);
    const dip = anomalous ? docIP(rng) : lanIP(rng);
    const port = anomalous
      ? rng.pick([8443, 4433, 9443])
      : rng.pick([443, 53, 88, 445, 3389]);
    const proto = "tcp";
    const svc = anomalous ? "ssl" : rng.pick(["ssl", "dns", "krb", "smb", "rdp"]);
    const dur = (anomalous ? 0.04 + rng.unit() * 0.06 : 0.1 + rng.unit() * 5).toFixed(3);
    const ob = anomalous ? rng.range(1800000, 4400000) : rng.range(120, 18000);
    const ib = rng.range(200, 12000);
    return `${ts}  ${proto}  ${sip}:${rng.range(40000, 65000)} -> ${dip}:${port}  ${svc}  dur=${dur}  ob=${ob}  ib=${ib}`;
  }
  if (source === "sysmon") {
    const eid = anomalous ? 3 : rng.pick([1, 3, 7, 11, 13]);
    const img = anomalous
      ? "C:\\Windows\\System32\\svchost.exe"
      : rng.pick([
          "C:\\Windows\\System32\\lsass.exe",
          "C:\\Windows\\System32\\services.exe",
          "C:\\Program Files\\App\\agent.exe",
          "C:\\Windows\\explorer.exe",
        ]);
    const note = anomalous ? "OutboundConnection [TLS-keepalive]" : "Image=normal";
    return `${ts}  EID=${eid}  ${host}  ${img}  ${note}`;
  }
  if (source === "netflow") {
    const sip = lanIP(rng);
    const dip = anomalous ? docIP(rng) : lanIP(rng);
    const pkts = anomalous ? rng.range(280, 720) : rng.range(20, 600);
    const bytes = anomalous ? rng.range(1900000, 4200000) : rng.range(2400, 60000);
    return `${ts}  ${sip} -> ${dip}  pkts=${pkts}  bytes=${bytes.toLocaleString()}`;
  }
  // edr
  const verdict = anomalous ? "BENIGN_BY_ML" : rng.pick(["BENIGN", "ALLOWED"]);
  return `${ts}  edr  ${host}  verdict=${verdict}  rule=baseline.tls`;
}

const PHASES = [
  {
    name: "CALIBRATION",
    blurb: "Sentinel boots, hashes inputs on entry, writes lineage stubs.",
    duration: 8,
    anomalyRate: 0,
  },
  {
    name: "BASELINE INGEST",
    blurb: "Zeek, Sysmon, NetFlow, EDR streams converge at L0.",
    duration: 24,
    anomalyRate: 0,
  },
  {
    name: "ANOMALY EMERGES",
    blurb: "DCDA-WS-0419 opens a steady outbound TLS keepalive. EDR allows it.",
    duration: 22,
    anomalyRate: 0.55,
  },
  {
    name: "CRYSTALLIZATION",
    blurb: "TCD-JEPA detects a new structural class outside known taxonomy.",
    duration: 20,
    anomalyRate: 0.65,
  },
  {
    name: "DETECTION",
    blurb: "Null permutation confirms the class is structurally significant.",
    duration: 14,
    anomalyRate: 0.7,
  },
  {
    name: "LINEAGE ANCHOR",
    blurb: "Evidence package signed by appliance key. Replay artifact ready.",
    duration: 8,
    anomalyRate: 0,
  },
];

function buildTimeline(scenario: string): SimEvent[] {
  const seedBuf = crypto
    .createHash("sha256")
    .update(`${scenario}:${SEED}`)
    .digest();
  const rng = new PRNG(seedBuf);

  const out: SimEvent[] = [];
  let t = 0;
  const counters = { L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 };

  PHASES.forEach((phase, i) => {
    out.push({ kind: "phase", idx: i, name: phase.name, blurb: phase.blurb, t });
    for (let j = 0; j < phase.duration; j++) {
      const anomalous = phase.anomalyRate > 0 && rng.unit() < phase.anomalyRate;
      const source = anomalous ? rng.pick(["zeek", "sysmon", "netflow"] as const) : rng.pick(SOURCES);
      const host = anomalous ? TARGET_HOST : rng.pick(HOSTS_BASELINE);
      out.push({
        kind: "log",
        t,
        source,
        host,
        line: buildLogLine(rng, source, host, anomalous),
        rare: anomalous,
      });

      // pipeline progression
      counters.L0 += 1;
      if (j % 1 === 0) counters.L1 += 1;
      if (j % 2 === 0 && i >= 1) counters.L2 += 1;
      if (j % 3 === 0 && i >= 2) counters.L3 += 1;
      if (anomalous && i >= 3 && j % 5 === 0) counters.L4 += 1;
      out.push({ kind: "pipeline", t, stage: "L0", count: counters.L0 });
      out.push({ kind: "pipeline", t, stage: "L1", count: counters.L1 });
      out.push({ kind: "pipeline", t, stage: "L2", count: counters.L2 });
      out.push({ kind: "pipeline", t, stage: "L3", count: counters.L3 });
      out.push({ kind: "pipeline", t, stage: "L4", count: counters.L4 });

      // periodic metric ticks
      if (j % 4 === 0) {
        out.push({ kind: "metric", t, name: "fingerprints_written", value: counters.L1 });
        out.push({ kind: "metric", t, name: "ingest_pps", value: 480 + Math.floor(rng.unit() * 60) });
        out.push({
          kind: "metric",
          t,
          name: "rare_share",
          value: Number((counters.L4 / Math.max(counters.L0, 1)).toFixed(4)),
        });
      }

      t += 1;
    }

    if (phase.name === "DETECTION") {
      const lineage = rng.hex(28);
      out.push({
        kind: "detection",
        t,
        lineage,
        family: "HALCYON-7",
        z: 41.7,
        host: TARGET_HOST,
        ts: new Date(Date.UTC(2026, 2, 12) + Math.floor(rng.unit() * 30 * 86400 * 1000)).toISOString(),
        novel: true,
      });
    }
  });

  // closing
  const finalLineage = rng.hex(28);
  const responseDigest = crypto
    .createHash("sha256")
    .update(`${scenario}:${SEED}:${finalLineage}`)
    .digest("hex");
  out.push({
    kind: "done",
    t,
    lineage: finalLineage,
    response_digest: responseDigest,
    wall_ms: t * 18,
  });

  return out;
}

function sse(controller: ReadableStreamDefaultController<Uint8Array>, enc: TextEncoder, ev: unknown) {
  controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scenario = (url.searchParams.get("scenario") || SCENARIO_DEFAULT).toLowerCase();
  const tickMs = Math.max(60, Math.min(800, Number(url.searchParams.get("tick_ms")) || TICK_MS_DEFAULT));

  const events = buildTimeline(scenario);
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // initial hello with metadata so the client can size its panels
      sse(controller, enc, {
        kind: "hello",
        scenario,
        seed: SEED,
        tick_ms: tickMs,
        total_events: events.length,
        phases: PHASES.map((p) => ({ name: p.name, duration: p.duration, blurb: p.blurb })),
        target_host: TARGET_HOST,
      });

      for (const ev of events) {
        sse(controller, enc, ev);
        // Pace the stream — log/metric events trickle, pipeline ticks fast.
        const pace =
          ev.kind === "log"
            ? tickMs
            : ev.kind === "phase"
              ? Math.floor(tickMs * 0.4)
              : ev.kind === "detection"
                ? Math.floor(tickMs * 2.5)
                : 8;
        await new Promise((r) => setTimeout(r, pace));
      }

      sse(controller, enc, { kind: "end" });
      controller.close();
    },
    cancel() {
      // client disconnected; nothing to clean up
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // tell nginx not to buffer SSE
      "x-sentinel-scenario": scenario,
      "x-sentinel-seed": String(SEED),
    },
  });
}
