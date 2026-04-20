import { NextResponse } from "next/server";
import path from "path";
import { resolveEntity } from "@/lib/entityResolver";
import { generateThesis } from "@/lib/thesisGenerator";
import { readCachedJson } from "@/lib/artifactCache";

// Universality endpoint: reads data/validation/universal_validation.json
// emitted by scripts/universal_validation.py. Every corpus is processed
// with identical primitives — no corpus-specific knobs anywhere.
// Resolved display names are attached on the fly via the universal resolver.
export const dynamic = "force-dynamic";

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const target = path.join(repoRoot, "data", "validation", "universal_validation.json");
  try {
    const data = await readCachedJson<any>(target, 120_000);

    // Try to load edgar_cache for CIK→name coverage beyond the embedded registry.
    const cikMap = new Map<string, string>();
    const cachePath = path.join(repoRoot, "scripts", "edgar_cache.json");
    try {
      const cache = await readCachedJson<{ entities?: Array<{ type?: string; attributes?: any }> }>(cachePath, 120_000);
      for (const e of cache.entities ?? []) {
        if (e.type !== "filing") continue;
        const a = typeof e.attributes === "string"
          ? JSON.parse(e.attributes)
          : e.attributes;
        const cik = String(a?.company_cik ?? "");
        const name = String(a?.company_name ?? "");
        if (cik && name && !cikMap.has(cik)) cikMap.set(cik, name);
      }
    } catch {
      // cache missing is fine; resolver falls back to registry
    }

    // Decorate each corpus's top_entity with a resolved display name + thesis.
    if (Array.isArray(data.corpora)) {
      data.corpora = data.corpora.map((c: any) => {
        if (c.top_entity_name) {
          const r = resolveEntity(c.top_entity_name, cikMap);
          c.top_entity_resolved = r;
          const topMetric = (c.null_test?.per_metric || []).find(
            (m: any) => m.dim === "composite",
          );
          c.top_entity_thesis = generateThesis({
            resolved: r,
            composite: c.top_composite ?? topMetric?.true_mean ?? 0,
            anomaly: topMetric?.true_mean ?? 0,
            reconstruction: 0,
            diversity: 0,
            corpusDomain: c.corpus_id,
          });
        }
        return c;
      });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "universal validation artifact missing", path: target, detail: String(err) },
      { status: 503 },
    );
  }
}
