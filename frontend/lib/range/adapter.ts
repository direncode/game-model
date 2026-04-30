/**
 * Generic record adapter — point at any text corpus and produce a stream
 * of records without per-vertical hardcoding.
 *
 * Supported formats:
 *  - JSON array (top-level array of objects)
 *  - NDJSON (newline-delimited JSON, one record per line)
 *  - CSV / TSV / PSV (auto-detected delimiter and header)
 *  - Plaintext (one line = one record)
 *
 * Output: an async iterator of RangeRecord objects, plus a Schema describing
 * the inferred field set. No per-vertical adapter code anywhere — the
 * decision tree is pure shape-of-bytes.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type Format = "json-array" | "ndjson" | "csv" | "tsv" | "psv" | "plaintext";

export type Schema = {
  format: Format;
  delimiter?: string;
  hasHeader?: boolean;
  fields: { name: string; sampleType: "string" | "number" | "boolean" | "object" | "array" | "null"; nonEmptyShare: number }[];
  totalRecords: number;
  bytes: number;
};

export type RangeRecord = {
  idx: number;
  raw: string;          // canonical bytes for fingerprinting
  fields: Record<string, unknown> | string;
};

// ---------- Format detection ----------

const SAMPLE_BYTES = 64 * 1024;

export function detectFormat(sample: string, hint?: string): Format {
  // Filename hint takes priority where unambiguous
  const ext = (hint || "").toLowerCase();
  if (ext.endsWith(".jsonl") || ext.endsWith(".ndjson")) return "ndjson";
  if (ext.endsWith(".csv")) return "csv";
  if (ext.endsWith(".tsv")) return "tsv";
  if (ext.endsWith(".psv")) return "psv";

  const trimmed = sample.trimStart();

  // JSON array: starts with [
  if (trimmed.startsWith("[")) return "json-array";

  // NDJSON: every nonblank line should parse as JSON
  const lines = sample.split("\n").filter((l) => l.trim().length > 0).slice(0, 10);
  if (lines.length >= 2) {
    let jsonLines = 0;
    for (const line of lines) {
      try {
        JSON.parse(line);
        jsonLines++;
      } catch { /* not json */ }
    }
    if (jsonLines === lines.length) return "ndjson";
  }

  // CSV / TSV / PSV: detect by delimiter frequency
  if (lines.length >= 2) {
    const counts = { ",": 0, "\t": 0, "|": 0 } as Record<string, number>;
    const probe = lines[0];
    for (const c of probe) if (counts[c] !== undefined) counts[c]++;
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (winner && winner[1] > 0) {
      const sample2 = lines[1] || "";
      // Confirmed if next line has the same number of delimiters (±1 tolerance)
      let n2 = 0;
      for (const c of sample2) if (c === winner[0]) n2++;
      if (Math.abs(n2 - winner[1]) <= 1) {
        if (winner[0] === ",") return "csv";
        if (winner[0] === "\t") return "tsv";
        if (winner[0] === "|") return "psv";
      }
    }
  }

  return "plaintext";
}

// ---------- Schema inference ----------

export function inferSchema(text: string, format: Format, hint?: string): Schema {
  const bytes = Buffer.byteLength(text, "utf-8");

  if (format === "json-array") {
    let arr: unknown;
    try { arr = JSON.parse(text); } catch { arr = []; }
    const items = Array.isArray(arr) ? arr : [];
    return {
      format,
      fields: inferFieldsFromObjects(items),
      totalRecords: items.length,
      bytes,
    };
  }

  if (format === "ndjson") {
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const sample = lines.slice(0, 200).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter((x) => x !== null);
    return {
      format,
      fields: inferFieldsFromObjects(sample as unknown[]),
      totalRecords: lines.length,
      bytes,
    };
  }

  if (format === "csv" || format === "tsv" || format === "psv") {
    const delim = format === "csv" ? "," : format === "tsv" ? "\t" : "|";
    const lines = text.split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) return { format, delimiter: delim, hasHeader: false, fields: [], totalRecords: 0, bytes };
    // Header detection: assume first row is header if it has no purely numeric cells
    const headerCells = parseCSVLine(lines[0], delim);
    const looksHeader = headerCells.every((c) => c.length > 0 && Number.isNaN(Number(c)));
    const hasHeader = looksHeader;
    const fieldNames = hasHeader ? headerCells : headerCells.map((_, i) => `c${i}`);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const sample = dataLines.slice(0, 200).map((l) => {
      const cells = parseCSVLine(l, delim);
      const o: Record<string, unknown> = {};
      for (let i = 0; i < fieldNames.length; i++) o[fieldNames[i]] = cells[i] ?? "";
      return o;
    });
    return {
      format,
      delimiter: delim,
      hasHeader,
      fields: inferFieldsFromObjects(sample),
      totalRecords: dataLines.length,
      bytes,
    };
  }

  // plaintext
  const lines = text.split("\n").filter((l) => l.length > 0);
  return {
    format,
    fields: [{ name: "line", sampleType: "string", nonEmptyShare: 1 }],
    totalRecords: lines.length,
    bytes,
  };

  // Suppress unused param warning
  void hint;
}

function parseCSVLine(line: string, delim: string): string[] {
  // Minimal RFC 4180 quoting support
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === delim) { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function inferFieldsFromObjects(items: unknown[]): Schema["fields"] {
  const tally = new Map<string, { types: Map<string, number>; nonEmpty: number }>();
  let n = 0;
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    n++;
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      const t = typeOf(v);
      const slot = tally.get(k) ?? { types: new Map<string, number>(), nonEmpty: 0 };
      if (v !== null && v !== "" && v !== undefined) slot.nonEmpty++;
      slot.types.set(t, (slot.types.get(t) ?? 0) + 1);
      tally.set(k, slot);
    }
  }
  if (n === 0) return [];
  const out: Schema["fields"] = [];
  for (const [name, { types, nonEmpty }] of tally) {
    const dominant = Array.from(types.entries()).sort((a, b) => b[1] - a[1])[0];
    out.push({
      name,
      sampleType: (dominant?.[0] ?? "string") as Schema["fields"][number]["sampleType"],
      nonEmptyShare: Number((nonEmpty / n).toFixed(3)),
    });
  }
  return out;
}

function typeOf(v: unknown): "string" | "number" | "boolean" | "object" | "array" | "null" {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "object") return "object";
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "boolean";
  return "string";
}

// ---------- RangeRecord iteration ----------

export async function* iterateRecords(text: string, schema: Schema): AsyncGenerator<RangeRecord> {
  if (schema.format === "json-array") {
    let arr: unknown;
    try { arr = JSON.parse(text); } catch { arr = []; }
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const fields = (item && typeof item === "object" && !Array.isArray(item)) ? (item as Record<string, unknown>) : { value: item };
      yield {
        idx: i,
        raw: JSON.stringify(item),
        fields,
      };
    }
    return;
  }

  if (schema.format === "ndjson") {
    const lines = text.split("\n");
    let idx = 0;
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      let obj: unknown;
      try { obj = JSON.parse(line); } catch { continue; }
      const fields = (obj && typeof obj === "object" && !Array.isArray(obj)) ? (obj as Record<string, unknown>) : { value: obj };
      yield { idx: idx++, raw: line, fields };
    }
    return;
  }

  if (schema.format === "csv" || schema.format === "tsv" || schema.format === "psv") {
    const delim = schema.delimiter ?? ",";
    const lines = text.split("\n").filter((l) => l.length > 0);
    const header = schema.hasHeader ? parseCSVLine(lines[0], delim) : null;
    const fieldNames = header ?? (lines[0] ? parseCSVLine(lines[0], delim).map((_, i) => `c${i}`) : []);
    const data = schema.hasHeader ? lines.slice(1) : lines;
    let idx = 0;
    for (const line of data) {
      const cells = parseCSVLine(line, delim);
      const fields: Record<string, unknown> = {};
      for (let i = 0; i < fieldNames.length; i++) fields[fieldNames[i]] = cells[i] ?? "";
      yield { idx: idx++, raw: line, fields };
    }
    return;
  }

  // plaintext
  const lines = text.split("\n");
  let idx = 0;
  for (const line of lines) {
    if (line.length === 0) continue;
    yield { idx: idx++, raw: line, fields: { line } };
  }
}

// ---------- Convenience: load + adapt ----------

export async function loadCorpusFromPath(filePath: string): Promise<{ schema: Schema; text: string }> {
  const text = await fs.readFile(filePath, "utf-8");
  const sample = text.length > SAMPLE_BYTES ? text.slice(0, SAMPLE_BYTES) : text;
  const format = detectFormat(sample, path.basename(filePath));
  const schema = inferSchema(text, format, filePath);
  return { schema, text };
}
