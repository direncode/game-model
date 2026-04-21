#!/usr/bin/env node
// Resolver parity CLI.
//
// Mirrors the resolver logic in frontend/app/api/resolve/route.ts exactly.
// Invoked by lo_nlp/test_parity.py to verify TS and Python implementations
// agree on the eval fixture.
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  KEEP IN LOCK-STEP WITH:
//   - frontend/app/api/resolve/route.ts  (production TS resolver)
//   - lo_nlp/resolve.py                   (production Python resolver)
//  If this file diverges from route.ts, scripts/parity_cli.mjs tests
//  the wrong thing. If it diverges from resolve.py, the parity test
//  fails and surfaces the drift loudly — which is the point.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Usage:
//   node scripts/parity_cli.mjs <fixture-path>
//
// Output (stdout, one JSON object per line):
//   {"query": "...", "resolved": bool, "code": "...", "family": "...",
//    "confidence": float, "source": "codebook|lexical|fuzzy|none",
//    "candidates": [...]}

import { readFileSync, readdirSync } from "node:fs";
import { resolve as pathResolve, join as pathJoin, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = pathResolve(__dirname, "..");
const DATA_DIR = pathJoin(REPO_ROOT, "lo_nlp", "data");

// ── family priority ─────────────────────────────────────────────────
const FAMILY_PRIORITY = ["country", "us_state", "mesh", "sic", "cpc", "hs"];
function familyRank(family) {
  const idx = FAMILY_PRIORITY.indexOf(family ?? "");
  return idx >= 0 ? idx : 99;
}

// ── similarity helpers ──────────────────────────────────────────────
function tokens(s) {
  return new Set((s || "").toLowerCase().match(/[a-z0-9]+/g) ?? []);
}
function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
function charNgrams(s, n = 3) {
  const p = `  ${(s || "").toLowerCase()}  `;
  const out = new Set();
  for (let i = 0; i <= p.length - n; i++) out.add(p.slice(i, i + n));
  return out;
}
function charSim(a, b) {
  const na = charNgrams(a);
  const nb = charNgrams(b);
  if (na.size === 0 || nb.size === 0) return 0;
  let inter = 0;
  for (const t of na) if (nb.has(t)) inter++;
  return inter / (na.size + nb.size - inter);
}
function levenshtein(s, t) {
  s = s.toLowerCase();
  t = t.toLowerCase();
  if (s === t) return 0;
  if (!s) return t.length;
  if (!t) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const cur = [i];
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur.push(Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost));
    }
    prev = cur;
  }
  return prev[t.length];
}
function levSim(a, b) {
  if (!a || !b) return 0;
  const m = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / m;
}
function stripPrefix(q) {
  return q.replace(
    /^(mesh|commodity|region|state|assignee|country|cpc|sic|noaa|station|hs|iso)[_\-]/i,
    "",
  );
}

// ── ontology load ───────────────────────────────────────────────────
function loadOntology() {
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("eval_"))
    .sort();
  const rows = [];
  for (const f of files) {
    const family = f
      .replace(".json", "")
      .replace(/_top$|_codes$|_iso$|_classes$|_stations$/, "");
    try {
      const parsed = JSON.parse(readFileSync(pathJoin(DATA_DIR, f), "utf-8"));
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
      // skip unreadable
    }
  }
  const codeIndex = new Map();
  const aliasIndex = new Map();
  for (const e of rows) {
    if (e.code) codeIndex.set(e.code.toLowerCase(), e);
    for (const a of e.aliases ?? []) {
      const key = a.toLowerCase();
      const existing = aliasIndex.get(key);
      if (existing === undefined) aliasIndex.set(key, e);
      else if (familyRank(e.family) < familyRank(existing.family)) aliasIndex.set(key, e);
    }
  }
  return { rows, codeIndex, aliasIndex };
}

// ── resolve ─────────────────────────────────────────────────────────
function resolve(ontology, query, topK = 5) {
  const { rows, codeIndex, aliasIndex } = ontology;
  const q = (query || "").trim();
  if (!q || rows.length === 0) {
    return {
      query: q,
      resolved: false,
      code: null,
      family: null,
      confidence: 0.0,
      source: "none",
      candidates: [],
    };
  }

  // 1. exact code
  let hit = codeIndex.get(q.toLowerCase());
  if (hit) return { query: q, resolved: true, code: hit.code, family: hit.family, confidence: 1.0, source: "codebook", candidates: [{ ...hit, score: 1.0 }] };

  // 1b. prefix-stripped
  const stripped = stripPrefix(q);
  if (stripped !== q) {
    hit = codeIndex.get(stripped.toLowerCase());
    if (hit) return { query: q, resolved: true, code: hit.code, family: hit.family, confidence: 0.95, source: "codebook", candidates: [{ ...hit, score: 0.95 }] };
  }

  // 2. alias
  hit = aliasIndex.get(stripped.toLowerCase());
  if (hit) return { query: q, resolved: true, code: hit.code, family: hit.family, confidence: 0.9, source: "codebook", candidates: [{ ...hit, score: 0.9 }] };

  // 3. lexical — query vs canonical name + each alias, best wins per entry
  const qTok = tokens(stripped);
  const scored = [];
  for (const e of rows) {
    const targets = [e.name, ...(e.aliases ?? [])].filter(Boolean);
    let best = 0;
    for (const target of targets) {
      const j = jaccard(qTok, tokens(target));
      const c = charSim(stripped, target);
      const lev = levSim(stripped, target);
      const s = 0.4 * j + 0.2 * c + 0.4 * lev;
      if (s > best) best = s;
    }
    if (best > 0.10) scored.push([best, e]);
  }
  scored.sort((a, b) => (b[0] - a[0]) || (familyRank(a[1].family) - familyRank(b[1].family)));
  const top = scored.slice(0, topK);
  if (top.length) {
    const [bestScore, best] = top[0];
    const resolved = bestScore > 0.35;
    return {
      query: q,
      resolved,
      code: resolved ? best.code : null,
      family: resolved ? best.family : null,
      confidence: Math.round(bestScore * 1000) / 1000,
      source: resolved ? "lexical" : "fuzzy",
      candidates: top.map(([s, e]) => ({ ...e, score: Math.round(s * 1000) / 1000 })),
    };
  }
  return { query: q, resolved: false, code: null, family: null, confidence: 0.0, source: "none", candidates: [] };
}

// ── main ────────────────────────────────────────────────────────────
function main() {
  const fixturePath = process.argv[2];
  if (!fixturePath) {
    console.error("usage: node parity_cli.mjs <fixture-path>");
    process.exit(2);
  }
  const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
  const ontology = loadOntology();
  for (const item of fixture) {
    const r = resolve(ontology, item.query, 5);
    // Emit one JSON per line for easy diffing.
    process.stdout.write(JSON.stringify(r) + "\n");
  }
}

main();
