import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { readCachedJson } from "@/lib/artifactCache";
import { resolveEntity } from "@/lib/entityResolver";

// Entity resolution endpoint.
//
// Resolution cascade:
//   1. frontend/lib/entityResolver.ts hand-curated codebook (fast)
//   2. bundled lo_nlp/data/*.json ontologies (~380 entries, deterministic lexical matcher)
//   3. nothing — return raw input with resolved:false
//
// The TypeScript stage-1 handles the 90% case for patterns the frontend
// sees in its demos. The stage-2 handles the long tail — any HS code,
// any MeSH term in the top-2000, any CPC class, any SIC code, any
// ISO-3166 country, any US state, any fuzzy string that matches one
// of the above.
//
// Both stages are deterministic. No LLM. Works air-gap.
export const dynamic = "force-dynamic";

type OntologyEntry = {
  code: string;
  name: string;
  family?: string;
  aliases?: string[];
  parent?: string | null;
  description?: string | null;
};

// ── stage 2 — bundled ontology, loaded once per worker ──────────────
// Keep FAMILY_PRIORITY in lock-step with lo_nlp/resolve.py.
// Cross-validated by scripts/parity_check.py.
const FAMILY_PRIORITY = ["country", "us_state", "mesh", "sic", "cpc", "hs"];
function familyRank(family: string | undefined): number {
  const idx = FAMILY_PRIORITY.indexOf(family ?? "");
  return idx >= 0 ? idx : 99;
}

let _cache: OntologyEntry[] | null = null;
let _codeIndex: Map<string, OntologyEntry> | null = null;
let _aliasIndex: Map<string, OntologyEntry> | null = null;

async function loadOntology(): Promise<OntologyEntry[]> {
  if (_cache) return _cache;
  // Ontology data is bundled inside the frontend image at
  // frontend/data/ontology/*.json (copied from lo_nlp/data/ at build).
  // Fallback path covers local dev where frontend runs from the repo
  // root with the lo_nlp/ sibling tree available.
  const candidates = [
    path.join(process.cwd(), "data", "ontology"),
    path.resolve(process.cwd(), "..", "lo_nlp", "data"),
  ];
  let dataDir = candidates[0];
  for (const c of candidates) {
    try {
      await fs.access(c);
      dataDir = c;
      break;
    } catch {
      // try next
    }
  }
  try {
    // Sort so iteration order is identical across OSes. Skip fixture files.
    const files = (await fs.readdir(dataDir))
      .filter((f) => f.endsWith(".json") && !f.startsWith("eval_"))
      .sort();
    const rows: OntologyEntry[] = [];
    for (const f of files) {
      const p = path.join(dataDir, f);
      const family = f
        .replace(".json", "")
        .replace(/_top$|_codes$|_iso$|_classes$|_stations$/, "");
      try {
        const parsed = await readCachedJson<any[]>(p, 300_000);
        for (const r of parsed) {
          rows.push({
            code: String(r.code ?? r.id ?? ""),
            name: String(r.name ?? r.label ?? ""),
            family: r.family ?? family,
            aliases: Array.isArray(r.aliases) ? r.aliases : [],
            parent: r.parent ?? null,
            description: r.description ?? null,
          });
        }
      } catch {
        // skip unreadable file
      }
    }
    _cache = rows;
    _codeIndex = new Map();
    _aliasIndex = new Map();
    for (const e of rows) {
      if (e.code) _codeIndex.set(e.code.toLowerCase(), e);
      for (const a of e.aliases ?? []) {
        const key = a.toLowerCase();
        const existing = _aliasIndex.get(key);
        if (existing === undefined) {
          _aliasIndex.set(key, e);
        } else if (familyRank(e.family) < familyRank(existing.family)) {
          _aliasIndex.set(key, e);
        }
      }
    }
    return rows;
  } catch {
    _cache = [];
    return [];
  }
}

function tokens(s: string): Set<string> {
  return new Set((s || "").toLowerCase().match(/[a-z0-9]+/g) ?? []);
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
function charNgrams(s: string, n = 3): Set<string> {
  const p = `  ${(s || "").toLowerCase()}  `;
  const out = new Set<string>();
  for (let i = 0; i <= p.length - n; i++) out.add(p.slice(i, i + n));
  return out;
}
function charSim(a: string, b: string): number {
  const na = charNgrams(a);
  const nb = charNgrams(b);
  if (na.size === 0 || nb.size === 0) return 0;
  let inter = 0;
  for (const t of na) if (nb.has(t)) inter++;
  return inter / (na.size + nb.size - inter);
}

function levenshtein(s: string, t: string): number {
  s = s.toLowerCase();
  t = t.toLowerCase();
  if (s === t) return 0;
  if (!s) return t.length;
  if (!t) return s.length;
  let prev: number[] = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur.push(Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost));
    }
    prev = cur;
  }
  return prev[t.length];
}
function levSim(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = Math.max(a.length, b.length);
  return 1.0 - levenshtein(a, b) / m;
}

function stripPrefix(q: string): string {
  return q.replace(
    /^(mesh|commodity|region|state|assignee|country|cpc|sic|noaa|station|hs|iso)[_\-]/i,
    "",
  );
}

async function ontologyResolve(query: string, topK = 3) {
  const rows = await loadOntology();
  const q = (query || "").trim();
  if (!q || rows.length === 0) {
    return { resolved: false, source: "none", candidates: [] as any[] };
  }

  // exact code
  const hit = _codeIndex?.get(q.toLowerCase());
  if (hit) return { resolved: true, source: "codebook", confidence: 1.0, ...hit };

  // prefix-stripped
  const stripped = stripPrefix(q);
  if (stripped !== q) {
    const hit2 = _codeIndex?.get(stripped.toLowerCase());
    if (hit2)
      return { resolved: true, source: "codebook", confidence: 0.95, ...hit2 };
  }
  // alias
  const hit3 = _aliasIndex?.get(stripped.toLowerCase());
  if (hit3) return { resolved: true, source: "codebook", confidence: 0.9, ...hit3 };

  // lexical — score query against canonical name AND each alias, take
  // the best per entry. Rescues typos of aliases where canonical-name
  // comparison alone would miss (e.g. "phaarma" vs SIC 2834's "pharma").
  const qTok = tokens(stripped);
  const scored: [number, OntologyEntry][] = [];
  for (const e of rows) {
    const targets = [e.name, ...(e.aliases ?? [])].filter(Boolean);
    let best = 0;
    for (const target of targets) {
      const j = jaccard(qTok, tokens(target));
      const c = charSim(stripped, target);
      const lev = levSim(stripped, target);
      // Sum of weights = 1.0. Keep in sync with lo_nlp/resolve.py.
      const s = 0.4 * j + 0.2 * c + 0.4 * lev;
      if (s > best) best = s;
    }
    if (best > 0.10) scored.push([best, e]);
  }
  // Descending score; break ties on family priority so lexical collisions
  // resolve deterministically to the preferred family.
  scored.sort((a, b) => (b[0] - a[0]) || (familyRank(a[1].family) - familyRank(b[1].family)));
  const top = scored.slice(0, topK);
  // Threshold 0.35 (was 0.4) rescues near-miss typos.
  if (top.length && top[0][0] > 0.35) {
    const [bestScore, best] = top[0];
    return {
      resolved: true,
      source: "lexical",
      confidence: Math.round(bestScore * 1000) / 1000,
      ...best,
      candidates: top.map(([s, e]) => ({ ...e, score: Math.round(s * 1000) / 1000 })),
    };
  }
  if (top.length) {
    return {
      resolved: false,
      source: "fuzzy",
      confidence: Math.round(top[0][0] * 1000) / 1000,
      candidates: top.map(([s, e]) => ({ ...e, score: Math.round(s * 1000) / 1000 })),
    };
  }
  return { resolved: false, source: "none", candidates: [] };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (!q) {
    return NextResponse.json({ error: "missing q parameter" }, { status: 400 });
  }

  // Stage 1 — hand-curated codebook in the frontend resolver.
  const stage1 = resolveEntity(q);
  if (stage1 && stage1.kind !== "unknown" && stage1.raw !== stage1.display) {
    return NextResponse.json({
      query: q,
      resolved: true,
      source: "frontend-codebook",
      stage: 1,
      ...stage1,
    });
  }

  // Stage 2 — bundled ontology lookup.
  const stage2 = await ontologyResolve(q);
  return NextResponse.json({
    query: q,
    stage: 2,
    ...stage2,
  });
}
