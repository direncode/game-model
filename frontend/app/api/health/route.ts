import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * Health endpoint for monitoring.
 *
 * Exercises the critical paths the commercial surface depends on:
 *   1. Can we read the universal validation artifact?
 *   2. Can we read the commercial validation artifact?
 *   3. Can we read the BTUT survivor set?
 *
 * Returns 200 only when all three are readable and non-empty. Returns 503
 * otherwise with a per-check status map. Prometheus can scrape the latency
 * and success from this endpoint directly; a simple uptime monitor (Uptime
 * Kuma / UptimeRobot / Cloudflare health-check) only needs the status code.
 */
export const dynamic = "force-dynamic";

const REPO_ROOT_FROM_FRONTEND = path.resolve(process.cwd(), "..");
const DATA_ROOT = "/data"; // set by docker-compose bind mount; falls back below
const SCRIPTS_ROOT = "/scripts";

async function readJsonSize(p: string): Promise<{ ok: boolean; bytes: number; error?: string }> {
  try {
    const stat = await fs.stat(p);
    if (!stat.isFile()) return { ok: false, bytes: 0, error: "not a file" };
    const content = await fs.readFile(p, "utf-8");
    // cheap sanity: non-empty JSON root
    const parsed = JSON.parse(content);
    const bytes = Buffer.byteLength(content, "utf-8");
    const keys = parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0;
    if (bytes === 0 || keys === 0) return { ok: false, bytes, error: "empty" };
    return { ok: true, bytes };
  } catch (e) {
    return { ok: false, bytes: 0, error: String(e) };
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function resolveArtifact(relative: string[]): string {
  const mounted = path.join(DATA_ROOT, ...relative);
  const local = path.join(REPO_ROOT_FROM_FRONTEND, "data", ...relative);
  return mounted; // tried first; if missing, the read itself will fail and fall to local below
}

function resolveScript(relative: string[]): string {
  return path.join(SCRIPTS_ROOT, ...relative);
}

export async function GET() {
  const t0 = Date.now();

  const universalArtifactA = await pathExists(path.join(DATA_ROOT, "validation", "universal_validation.json"))
    ? path.join(DATA_ROOT, "validation", "universal_validation.json")
    : path.join(REPO_ROOT_FROM_FRONTEND, "data", "validation", "universal_validation.json");

  const commercialArtifactA = await pathExists(path.join(DATA_ROOT, "validation", "commercial_validation.json"))
    ? path.join(DATA_ROOT, "validation", "commercial_validation.json")
    : path.join(REPO_ROOT_FROM_FRONTEND, "data", "validation", "commercial_validation.json");

  const btutCacheA = await pathExists(path.join(SCRIPTS_ROOT, "edgar_btut_result_5000.json"))
    ? path.join(SCRIPTS_ROOT, "edgar_btut_result_5000.json")
    : path.join(REPO_ROOT_FROM_FRONTEND, "scripts", "edgar_btut_result_5000.json");

  const [universal, commercial, btut] = await Promise.all([
    readJsonSize(universalArtifactA),
    readJsonSize(commercialArtifactA),
    readJsonSize(btutCacheA),
  ]);

  const checks = {
    universal_validation: { ...universal, path: universalArtifactA },
    commercial_validation: { ...commercial, path: commercialArtifactA },
    btut_survivor_set: { ...btut, path: btutCacheA },
  };
  const overallOk = Object.values(checks).every((c) => c.ok);

  const body = {
    status: overallOk ? "healthy" : "degraded",
    elapsed_ms: Date.now() - t0,
    checks,
    version: "0.2.0",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: overallOk ? 200 : 503 });
}
