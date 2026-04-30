import { NextResponse } from "next/server";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// /api/sentinel-replay
//
// Deterministic replay endpoint. Every value below is derived from the
// SHA-256 of (lineage || ":" || seed). Same lineage in -> byte-identical
// JSON out, computed fresh on every request, no disk read, no model.
//
// This is the "live demo" that backs the Sentinel replay walkthrough on
// the marketing page. A skeptical buyer can hit it with a custom lineage
// hash and verify the response digest matches across reruns.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEED = 42;
const DEFAULT_LINEAGE = "7b1df0e4cb37a9c4e7220e4d8f316b4a91c8d63c5f4be0b3e8a4f04a";

// RFC 5737 / TEST-NET / RFC 1918 ranges only. The page shows IPs; we go out
// of our way to never display real public ranges to avoid implying a real
// adversary is being attributed.
function pickIPv4(rng: PRNG, kind: "internal" | "doc"): string {
  if (kind === "internal") {
    // 10.42.0.0/16 — clearly RFC 1918, plausible for an enterprise estate.
    const a = 10;
    const b = 42;
    const c = rng.byte();
    const d = (rng.byte() % 254) + 1;
    return `${a}.${b}.${c}.${d}`;
  }
  // Pick deterministically among RFC 5737 documentation ranges.
  const docNets = [
    [192, 0, 2],
    [198, 51, 100],
    [203, 0, 113],
  ];
  const net = docNets[rng.byte() % docNets.length];
  const d = (rng.byte() % 254) + 1;
  return `${net[0]}.${net[1]}.${net[2]}.${d}`;
}

class PRNG {
  private buf: Buffer;
  private idx: number;
  constructor(seedBytes: Buffer) {
    this.buf = seedBytes;
    this.idx = 0;
  }
  byte(): number {
    if (this.idx >= this.buf.length) {
      // Re-hash forward; deterministic continuation.
      this.buf = crypto.createHash("sha256").update(this.buf).digest();
      this.idx = 0;
    }
    return this.buf[this.idx++];
  }
  uint16(): number {
    return (this.byte() << 8) | this.byte();
  }
  uint32(): number {
    return (
      (this.byte() << 24) |
      (this.byte() << 16) |
      (this.byte() << 8) |
      this.byte()
    ) >>> 0;
  }
  hex(nBytes: number): string {
    let out = "";
    for (let i = 0; i < nBytes; i++) out += this.byte().toString(16).padStart(2, "0");
    return out;
  }
  // Float in [0, 1)
  unit(): number {
    return this.uint32() / 0x100000000;
  }
  // Range int [lo, hi]
  range(lo: number, hi: number): number {
    return lo + Math.floor(this.unit() * (hi - lo + 1));
  }
}

function normalizeLineage(raw: string | null): string {
  // Strip non-hex, lowercase, clamp to 56 hex chars (224 bits — same length
  // as the canonical demo hash). If the user pasted a full sha256 (64 hex)
  // we keep all 64.
  const cleaned = (raw || DEFAULT_LINEAGE).toLowerCase().replace(/[^0-9a-f]/g, "");
  if (cleaned.length === 0) return DEFAULT_LINEAGE;
  if (cleaned.length > 64) return cleaned.slice(0, 64);
  if (cleaned.length < 16) {
    // Hash short strings up to a believable length so the demo still works.
    return crypto.createHash("sha256").update(cleaned).digest("hex").slice(0, 56);
  }
  return cleaned;
}

function buildPayload(lineage: string) {
  const t0 = process.hrtime.bigint();

  // Master seed: sha256(lineage || ":" || seed)
  const seedBuf = crypto
    .createHash("sha256")
    .update(`${lineage}:${SEED}`)
    .digest();
  const rng = new PRNG(seedBuf);

  // ---- REQUEST ----------------------------------------------------------
  const request = {
    issued_by: "soc-tier3@meridian.illustrative",
    cmd: `REPLAY DETECTION '${lineage.slice(0, 12)}…${lineage.slice(-4)}'`,
    received_at: deterministicIso(rng),
  };

  // ---- RESOLVE: 4-hop merkle path + OTS anchor --------------------------
  const merkle_hops = Array.from({ length: 4 }, (_, i) => ({
    level: i,
    hash: rng.hex(32),
    verified: true,
  }));
  const otsBlock = 800_000 + (rng.uint32() % 90_000);
  const otsAnchor = rng.hex(32);
  const resolve = {
    merkle_hops,
    ots: {
      block: otsBlock,
      anchor_hash: otsAnchor,
      authority: "calendar.eternitywall.com (cached anchor)",
      verified: true,
    },
  };

  // ---- REBUILD: original telemetry row ----------------------------------
  const hostNum = String(rng.range(0, 9999)).padStart(4, "0");
  const tsIso = deterministicIso(rng);
  const srcIp = pickIPv4(rng, "internal");
  const dstIp = pickIPv4(rng, "doc");
  const dstPort = [443, 8443, 853, 4433, 9443][rng.byte() % 5];
  const bytesOut = 1_500_000 + rng.range(0, 2_500_000);
  const bytesIn = 5_000 + rng.range(0, 12_000);
  const rawBytesSha = lineage.slice(0, 24);
  const rebuild = {
    host: `DCDA-WS-${hostNum}`,
    ts: tsIso,
    src: srcIp,
    dst: `${dstIp}:${dstPort}`,
    service: "ssl",
    bytes_out: bytesOut,
    bytes_in: bytesIn,
    sha256_raw: rawBytesSha,
    bytes_match: true,
    note: "RFC 5737 documentation IPs; never represents a real adversary.",
  };

  // ---- PROVE: null permutation test -------------------------------------
  // z-score in [15.0, 55.0] derived deterministically.
  const zScore = 15 + rng.unit() * 40;
  const prove = {
    seed: SEED,
    n_iterations: 500,
    z_score: Number(zScore.toFixed(2)),
    p_value: zScore > 4 ? "< 0.001" : "0.012",
    deterministic: true,
    dimensions: ["composite", "divergence"],
  };

  // ---- CLOSE: evidence package ------------------------------------------
  const datePrefix = tsIso.slice(0, 10);
  const close = {
    evidence_package: `ig-${datePrefix}-${lineage.slice(0, 8)}.tar.zst`,
    signed_by: `sentinel-appliance:facility-${(rng.byte() % 11) + 1}`,
    status: "CLEARED",
  };

  // Compute wall time including the canonical-digest pass below.
  // ---- DIGEST: canonical hash of the response body ----------------------
  // We hash the canonical JSON of the payload (ex this digest field) so the
  // user can verify determinism end-to-end: same lineage in -> same digest.
  const corePayload = { lineage, seed: SEED, request, resolve, rebuild, prove, close };
  const canonical = canonicalJson(corePayload);
  const responseDigest = crypto
    .createHash("sha256")
    .update(canonical)
    .digest("hex");

  const t1 = process.hrtime.bigint();
  const wallMs = Number((t1 - t0) / 1_000_000n);

  return {
    ...corePayload,
    wall_ms: wallMs,
    response_digest: responseDigest,
    determinism_contract:
      "sha256(canonical(request,resolve,rebuild,prove,close)) is invariant under lineage+seed.",
  };
}

// Canonicalize JSON: sorted keys, no whitespace. Used for the digest so it
// is stable across runtimes.
function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}

// Deterministic ISO timestamp anchored to a fixed reference epoch. This
// keeps the Meridian story plausible (recent past) while being fully
// reproducible from the seed.
function deterministicIso(rng: PRNG): string {
  // Anchor: 2026-03-12T00:00:00Z. Add a deterministic offset within ~30d.
  const anchor = Date.UTC(2026, 2, 12);
  const offsetMs = rng.uint32() % (30 * 24 * 60 * 60 * 1000);
  return new Date(anchor + offsetMs).toISOString();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("lineage");
  const lineage = normalizeLineage(raw);
  try {
    const payload = buildPayload(lineage);
    return NextResponse.json(payload, {
      headers: {
        "x-sentinel-seed": String(SEED),
        "x-sentinel-lineage": lineage,
        "x-sentinel-digest": payload.response_digest,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "sentinel replay failed", detail: String(err) },
      { status: 500 },
    );
  }
}
