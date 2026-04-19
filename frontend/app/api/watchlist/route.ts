import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { resolveEntity } from "@/lib/entityResolver";

// Universal watchlist endpoint: reads the raw BTUT survivor set and returns
// the top-50 findings by composite score. No hand-curated ticker list — the
// watchlist IS the engine output. If the engine re-runs, the watchlist moves.
export const dynamic = "force-dynamic";

const FACT_RE = /^fact_(\d+)_(.+)$/;

type Survivor = {
  cluster?: number;
  entity?: { name?: string; attributes?: string | object; type?: string };
  fingerprint_48bit?: string;
  flips?: number;
  scores?: {
    composite?: number;
    anomaly?: number;
    reconstruction?: number;
    diversity?: number;
  };
};

type Finding = {
  rank: number;
  cik: string;
  company: string;
  concept: string;
  composite: number;
  anomaly: number;
  reconstruction: number;
  diversity: number;
  cluster: number | null;
  filing_form: string | null;
  filing_date: string | null;
  fingerprint_prefix: string | null;
};

function parseAttrs(attrs: string | object | undefined): Record<string, any> {
  if (!attrs) return {};
  if (typeof attrs === "string") {
    try { return JSON.parse(attrs); } catch { return {}; }
  }
  return attrs as Record<string, any>;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const k = Math.min(200, Math.max(5, parseInt(url.searchParams.get("k") || "50", 10)));

  const repoRoot = path.resolve(process.cwd(), "..");
  const btutPath = path.join(repoRoot, "scripts", "edgar_btut_result_5000.json");
  const cachePath = path.join(repoRoot, "scripts", "edgar_cache.json");

  try {
    const [btutRaw, cacheRaw] = await Promise.all([
      fs.readFile(btutPath, "utf-8"),
      fs.readFile(cachePath, "utf-8"),
    ]);
    const btut = JSON.parse(btutRaw) as { survivors?: Survivor[] };
    const cache = JSON.parse(cacheRaw) as { entities?: Array<{ type?: string; attributes?: any }> };

    const cikToName = new Map<string, string>();
    for (const e of cache.entities ?? []) {
      if (e.type !== "filing") continue;
      const a = parseAttrs(e.attributes as any);
      const cik = String(a.company_cik ?? "");
      const name = String(a.company_name ?? "");
      if (cik && name && !cikToName.has(cik)) cikToName.set(cik, name);
    }

    // Collapse per-CIK: pick the highest-composite finding for each company,
    // sort by composite descending, take top-k.
    const byCik = new Map<string, Finding>();
    for (const s of btut.survivors ?? []) {
      const name = s.entity?.name ?? "";
      const m = name.match(FACT_RE);
      if (!m) continue;
      const cik = m[1];
      const concept = m[2];
      const scores = s.scores ?? {};
      const attrs = parseAttrs(s.entity?.attributes);
      const finding: Finding = {
        rank: 0, // filled in after sorting
        cik,
        company: cikToName.get(cik) || `CIK ${cik}`,
        concept,
        composite: Number(scores.composite ?? 0),
        anomaly: Number(scores.anomaly ?? 0),
        reconstruction: Number(scores.reconstruction ?? 0),
        diversity: Number(scores.diversity ?? 0),
        cluster: s.cluster ?? null,
        filing_form: attrs.form ?? null,
        filing_date: attrs.filed ?? attrs.period_end ?? null,
        fingerprint_prefix: s.fingerprint_48bit ? s.fingerprint_48bit.slice(0, 16) : null,
      };
      const existing = byCik.get(cik);
      if (!existing || finding.composite > existing.composite) {
        byCik.set(cik, finding);
      }
    }

    const ranked = [...byCik.values()]
      .sort((a, b) => b.composite - a.composite)
      .slice(0, k)
      .map((f, i) => {
        const resolved = resolveEntity(`fact_${f.cik}_${f.concept}`, cikToName);
        return {
          ...f,
          rank: i + 1,
          concept_display: resolved.display.split(" · ").slice(-1)[0],
          entity_display: resolved.display,
          external_url: resolved.externalUrl,
        };
      });

    return NextResponse.json({
      universe_size: (btut.survivors ?? []).length,
      companies_with_findings: byCik.size,
      k,
      findings: ranked,
      source: "scripts/edgar_btut_result_5000.json",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "watchlist source data missing", detail: String(err) },
      { status: 503 },
    );
  }
}
