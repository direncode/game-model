import { NextResponse } from "next/server";
import path from "path";
import { readCachedJson } from "@/lib/artifactCache";

// Single-ticker score: the Excel `=LO.SCORE("AAPL")` surface as a web call.
// Routes query through the universal ticker map + BTUT output. No hardcoded
// answers — every response is re-derived from the cached survivor set.
export const dynamic = "force-dynamic";

const FACT_RE = /^fact_(\d+)_(.+)$/;

const TICKER_MAP: Record<string, string> = {
  AAPL: "320193", MSFT: "789019", NVDA: "1045810",
  GOOG: "1652044", GOOGL: "1652044", AMZN: "1018724",
  META: "1326801", TSLA: "1318605",
  AEP: "4904", GS: "886982", JPM: "19617", BAC: "70858",
  ERIE: "922621", CRCL: "1876042", NVR: "906163",
  OTIS: "1781335", HPQ: "47217", CAT: "18230",
  DOW: "1751788", IBM: "51143", LYB: "1489393",
  EXC: "1109357", SPGI: "64040", BXP: "1037540",
  CMCSA: "1166691", JD: "1549802", FMCC: "1026214",
  BOH: "46195", ZS: "1713683", AMD: "2488",
  TTD: "1671933", JBHT: "728535", CCL: "815097",
  CBRE: "1364742", ACM: "868857", OKTA: "1660134",
  APO: "1858681", WELL: "766704", WYNN: "1174922",
  ADP: "8670", SHW: "89800", MDB: "1441816",
};

function resolveCik(q: string, cikToName: Map<string, string>): string | null {
  const u = q.trim().toUpperCase();
  if (TICKER_MAP[u]) return TICKER_MAP[u];
  if (/^\d+$/.test(u)) return String(parseInt(u, 10));
  const entries = Array.from(cikToName.entries());
  for (const [cik, name] of entries) {
    const n = name.toUpperCase();
    if (n.includes(u) || n.startsWith(u)) return cik;
  }
  return null;
}

function parseAttrs(a: any): Record<string, any> {
  if (!a) return {};
  if (typeof a === "string") { try { return JSON.parse(a); } catch { return {}; } }
  return a;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker") ?? "";
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const repoRoot = path.resolve(process.cwd(), "..");
  const btutPath = path.join(repoRoot, "scripts", "edgar_btut_result_5000.json");
  const cachePath = path.join(repoRoot, "scripts", "edgar_cache.json");

  try {
    const [btut, cache] = await Promise.all([
      readCachedJson<any>(btutPath, 120_000),
      readCachedJson<any>(cachePath, 120_000),
    ]);

    const cikToName = new Map<string, string>();
    for (const e of cache.entities ?? []) {
      if (e.type !== "filing") continue;
      const a = parseAttrs(e.attributes);
      const cik = String(a.company_cik ?? "");
      const name = String(a.company_name ?? "");
      if (cik && name) cikToName.set(cik, name);
    }

    const cik = resolveCik(ticker, cikToName);
    if (!cik) return NextResponse.json({ error: "ticker not resolvable", ticker }, { status: 404 });

    const findings: any[] = [];
    for (const s of btut.survivors ?? []) {
      const name = s.entity?.name ?? "";
      const m = name.match(FACT_RE);
      if (!m || m[1] !== cik) continue;
      findings.push({
        concept: m[2],
        composite: Number(s.scores?.composite ?? 0),
        anomaly: Number(s.scores?.anomaly ?? 0),
        reconstruction: Number(s.scores?.reconstruction ?? 0),
        diversity: Number(s.scores?.diversity ?? 0),
        cluster: s.cluster ?? null,
      });
    }
    findings.sort((a, b) => b.composite - a.composite);

    const top = findings[0];
    if (!top) {
      return NextResponse.json({
        ticker: ticker.toUpperCase(),
        cik,
        company: cikToName.get(cik) || `CIK ${cik}`,
        composite: 0,
        anomaly: 0,
        top_line: null,
        alert_status: "quiet",
        findings: [],
      });
    }

    const alert = top.composite >= 0.80 ? "triggered"
      : top.composite >= 0.60 ? "watching" : "quiet";

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      cik,
      company: cikToName.get(cik) || `CIK ${cik}`,
      composite: top.composite,
      anomaly: top.anomaly,
      top_line: top.concept,
      alert_status: alert,
      findings: findings.slice(0, 10),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
