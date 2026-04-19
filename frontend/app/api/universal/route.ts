import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { resolveEntity } from "@/lib/entityResolver";

// Universality endpoint: reads data/validation/universal_validation.json
// emitted by scripts/universal_validation.py. Every corpus is processed
// with identical primitives — no corpus-specific knobs anywhere.
// Resolved display names are attached on the fly via the universal resolver.
export const dynamic = "force-dynamic";

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const target = path.join(repoRoot, "data", "validation", "universal_validation.json");
  try {
    const raw = await fs.readFile(target, "utf-8");
    const data = JSON.parse(raw);

    // Try to load edgar_cache for CIK→name coverage beyond the embedded registry.
    const cikMap = new Map<string, string>();
    const cachePath = path.join(repoRoot, "scripts", "edgar_cache.json");
    try {
      const cacheRaw = await fs.readFile(cachePath, "utf-8");
      const cache = JSON.parse(cacheRaw);
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

    // Decorate each corpus's top_entity with a resolved display name.
    if (Array.isArray(data.corpora)) {
      data.corpora = data.corpora.map((c: any) => {
        if (c.top_entity_name) {
          const r = resolveEntity(c.top_entity_name, cikMap);
          c.top_entity_resolved = r;
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
