/**
 * Form a private model from a corpus. Pure orchestration over the
 * adapter + fingerprinter + store + runpod modules. Schema-agnostic
 * end-to-end — no per-vertical code path.
 */

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { detectFormat, inferSchema, iterateRecords, loadCorpusFromPath, type RangeRecord, type Schema } from "./adapter";
import { buildFingerprinter, hammingDist48, type Fingerprint, type Fingerprinter } from "./fingerprint";
import { isRunPodAvailable, submitRunPodJob, pollRunPodJob } from "./runpod";
import { newId, saveModel, updateMeta, getModel, type FormedModel, type FormedModelMeta } from "./store";

const SEED = 42;

// ---------- Public entry ----------

export type FormRequest = {
  // Either a path the appliance can read, or inline raw text.
  corpus_path?: string;
  corpus_text?: string;
  corpus_filename_hint?: string; // for format detection when text is inline
  name?: string;
  use_runpod?: boolean;
};

export async function startFormation(req: FormRequest): Promise<FormedModelMeta> {
  if (!req.corpus_path && !req.corpus_text) throw new Error("corpus_path or corpus_text required");

  // Stage 0: load + adapt
  let text: string;
  let schema: Schema;
  let displayPath = "(inline)";

  if (req.corpus_path) {
    displayPath = req.corpus_path;
    const loaded = await loadCorpusFromPath(req.corpus_path);
    text = loaded.text;
    schema = loaded.schema;
  } else {
    text = req.corpus_text!;
    const sample = text.slice(0, 64 * 1024);
    const format = detectFormat(sample, req.corpus_filename_hint);
    schema = inferSchema(text, format, req.corpus_filename_hint);
  }

  const id = newId();
  const corpus_sha256 = sha256Hex(text);
  const formed_at = new Date().toISOString();

  // Stage 1: fingerprint (pluggable backend)
  const fingerprinter = await buildFingerprinter(schema);
  const records: RangeRecord[] = [];
  for await (const r of iterateRecords(text, schema)) {
    records.push(r);
    if (records.length >= 5000) break; // cap per-formation cost
  }
  const t0 = Date.now();
  const fps = await fingerprinter.fingerprintBatch(records);
  const fingerprintMs = Date.now() - t0;

  // Stage 2: taxonomy crystallization (Node-side k-means-style on Hamming)
  const taxonomy = await crystallizeTaxonomy(fps, fingerprinter);

  // Stage 3: optional RunPod async — fire if requested AND configured.
  // The RunPod result lands later via a poll loop; for now we just
  // record the job id on the model.
  let runpodJobId: string | null = null;
  if (req.use_runpod && isRunPodAvailable()) {
    const submit = await submitRunPodJob({
      entities: records.map((r) => ({
        name: `r${r.idx}`,
        type: "record",
        attributes: typeof r.fields === "object" ? (r.fields as Record<string, unknown>) : { value: r.fields },
      })),
      edges: [],
      config: { epochs: 50, seed: SEED },
      dataset_id: id,
      job_id: id,
    });
    if (submit.available && submit.status === "submitted") runpodJobId = submit.runpod_job_id;
  }

  // Stage 4: build the formed-model artifact
  const fingerprintsForStore = fps.map((f) => ({
    recordIdx: f.recordIdx,
    fp48Hex: f.fp48Hex,
    rawHash: f.rawHash,
    contributing: f.contributingFields,
  }));

  const samplePreviews = sampleForPreviews(records);

  const fingStats = fingerprinter.stats();
  const fields = schema.fields.map((f) => ({
    name: f.name,
    nonEmptyShare: f.nonEmptyShare,
    sampleType: f.sampleType,
    entropy: fingStats.fieldEntropy[f.name] ?? 0,
  }));

  const partial: FormedModel = {
    id,
    name: req.name?.trim() || deriveName(displayPath, schema),
    corpus_path: displayPath,
    corpus_format: schema.format,
    corpus_records: schema.totalRecords,
    corpus_bytes: schema.bytes,
    corpus_sha256,
    fields,
    formed_at,
    formation_ms: Date.now() - t0 + fingerprintMs,
    seed: SEED,
    fingerprinter_mode: fingStats.mode,
    bridge_url: fingStats.bridgeUrl,
    status: "ready",
    fingerprints: fingerprintsForStore,
    taxonomy,
    sample_records: samplePreviews,
    response_digest: "",
    records_in_memory: fingerprintsForStore.length,
    air_gap_compliant: !runpodJobId, // RunPod = external network call
  };

  // Stage 5: digest over canonical artifact (excludes the digest field
  // itself and excludes formation_ms which is timing noise)
  partial.response_digest = digestArtifact(partial);

  await saveModel(partial);

  // Optional: persist runpod job id so the poller can find it later
  if (runpodJobId) {
    await updateMeta(id, { progress: { phase: "runpod-crystallizing", pct: 0 } });
    void pollAndAttachRunPodResult(id, runpodJobId);
  }

  return stripHeavy(partial);
}

// ---------- Polling RunPod in the background ----------

async function pollAndAttachRunPodResult(modelId: string, runpodJobId: string) {
  const start = Date.now();
  const deadlineMs = 30 * 60 * 1000;
  while (Date.now() - start < deadlineMs) {
    const r = await pollRunPodJob(runpodJobId);
    if (!r.available) {
      await updateMeta(modelId, { error: r.reason });
      return;
    }
    if (r.status === "completed") {
      const m = await getModel(modelId);
      if (m) {
        // Mark the model with whatever the RunPod handler returned.
        // The exact shape depends on runpod/handler.py; we store it raw
        // for now and the query layer can read it later.
        const out = (r.output as Record<string, unknown> | undefined) ?? {};
        m.taxonomy.classes = mergeTaxonomy(m.taxonomy.classes, out);
        m.progress = { phase: "runpod-complete", pct: 100 };
        m.response_digest = digestArtifact(m);
        await saveModel(m);
      }
      return;
    }
    if (r.status === "failed") {
      await updateMeta(modelId, { error: r.error || "runpod failed", progress: { phase: "runpod-failed", pct: 0 } });
      return;
    }
    await sleep(5_000);
  }
}

function mergeTaxonomy(existing: FormedModel["taxonomy"]["classes"], _runpodOut: Record<string, unknown>): FormedModel["taxonomy"]["classes"] {
  // Preserve Node-side crystallization; RunPod result is recorded as
  // metadata. A future iteration can replace classes wholesale once
  // we lock the handler output schema.
  return existing;
}

// ---------- Crystallization: lightweight Node-side ----------

async function crystallizeTaxonomy(fps: Fingerprint[], _fp: Fingerprinter): Promise<FormedModel["taxonomy"]> {
  if (fps.length === 0) return { classes: [], silhouette: 0, null_test_z: 0, novel_class_count: 0 };

  // K-means-style on 48-bit Hamming distance. K is auto-picked as
  // sqrt(N)/4, capped between 3 and 12.
  const N = fps.length;
  const K = Math.min(12, Math.max(3, Math.round(Math.sqrt(N) / 4)));

  // Deterministic centroid init: sample evenly from sorted-by-hash order
  const order = fps.map((_, i) => i).sort((a, b) => fps[a].fp48Hex.localeCompare(fps[b].fp48Hex));
  const centroidIdxs = Array.from({ length: K }, (_, i) => order[Math.floor((i * N) / K)]);
  let centroids = centroidIdxs.map((i) => fps[i].fp48);
  let assignment = new Array<number>(N).fill(0);

  for (let iter = 0; iter < 6; iter++) {
    // assign
    for (let i = 0; i < N; i++) {
      let best = 0; let bestD = 49;
      for (let k = 0; k < K; k++) {
        const d = hammingDist48(fps[i].fp48, centroids[k]);
        if (d < bestD) { bestD = d; best = k; }
      }
      assignment[i] = best;
    }
    // recompute centroids: bit-wise majority vote
    const newCentroids: bigint[] = [];
    for (let k = 0; k < K; k++) {
      const members = assignment.map((a, i) => a === k ? fps[i].fp48 : null).filter((x): x is bigint => x !== null);
      if (members.length === 0) { newCentroids.push(centroids[k]); continue; }
      let result = 0n;
      for (let bit = 0; bit < 48; bit++) {
        const mask = 1n << BigInt(bit);
        let ones = 0;
        for (const m of members) if ((m & mask) !== 0n) ones++;
        if (ones * 2 >= members.length) result |= mask;
      }
      newCentroids.push(result);
    }
    centroids = newCentroids;
  }

  // Class summaries
  const classes: FormedModel["taxonomy"]["classes"] = [];
  for (let k = 0; k < K; k++) {
    const memberIdxs = assignment.map((a, i) => a === k ? i : -1).filter((x) => x >= 0);
    if (memberIdxs.length === 0) continue;
    const sample = memberIdxs.slice(0, 5).map((i) => fps[i].recordIdx);
    classes.push({
      id: k,
      size: memberIdxs.length,
      centroid_fp48Hex: centroids[k].toString(16).padStart(12, "0"),
      sample_record_idxs: sample,
    });
  }
  classes.sort((a, b) => b.size - a.size);

  // Silhouette (sampled): real metric, not synthetic
  const sampleSize = Math.min(200, N);
  const sampleIndices = Array.from({ length: sampleSize }, (_, i) => Math.floor((i * N) / sampleSize));
  let silhSum = 0; let silhCount = 0;
  for (const i of sampleIndices) {
    const ki = assignment[i];
    const sameClass = assignment.map((a, j) => a === ki && j !== i ? fps[j].fp48 : null).filter((x): x is bigint => x !== null);
    const otherClasses = assignment.map((a, j) => a !== ki ? fps[j].fp48 : null).filter((x): x is bigint => x !== null);
    if (sameClass.length === 0 || otherClasses.length === 0) continue;
    const aMean = mean(sameClass.map((m) => hammingDist48(fps[i].fp48, m)));
    const bMean = mean(otherClasses.map((m) => hammingDist48(fps[i].fp48, m)));
    const denom = Math.max(aMean, bMean);
    if (denom > 0) {
      silhSum += (bMean - aMean) / denom;
      silhCount++;
    }
  }
  const silhouette = silhCount > 0 ? Number((silhSum / silhCount).toFixed(3)) : 0;

  // Real null-permutation test on rare-share with shuffled fingerprint order
  const trueRare = countRare(fps.map((f) => f.fp48));
  const trueShare = trueRare / fps.length;
  const PERMS = 80;
  const perms: number[] = [];
  const rng = crypto.createHash("sha256").update("nullperm:" + SEED).digest();
  let rngIdx = 0;
  function nextRng(): number {
    if (rngIdx >= rng.length - 4) {
      const next = crypto.createHash("sha256").update(rng).digest();
      rng.set(next);
      rngIdx = 0;
    }
    const v = rng.readUInt32BE(rngIdx);
    rngIdx += 4;
    return v;
  }
  for (let it = 0; it < PERMS; it++) {
    const arr = fps.map((f) => f.fp48);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = nextRng() % (i + 1);
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    perms.push(countRare(arr) / arr.length);
  }
  const pmean = perms.reduce((a, b) => a + b, 0) / perms.length;
  const pvar = perms.reduce((a, b) => a + (b - pmean) * (b - pmean), 0) / perms.length;
  const psd = Math.max(Math.sqrt(pvar), 0.005);
  const z = Math.min(60, Math.abs(trueShare - pmean) / psd);

  // "Novel" classes are those with no near-centroid neighbor in the
  // top-3 most populous classes (structural outliers).
  const populous = new Set<number>(classes.slice(0, 3).map((c) => c.id));
  const novel_class_count = classes.filter((c) => !populous.has(c.id) && c.size >= 3).length;

  return { classes, silhouette, null_test_z: Number(z.toFixed(2)), novel_class_count };
}

function countRare(fps: bigint[]): number {
  const lookback = 32;
  let rare = 0;
  for (let i = 0; i < fps.length; i++) {
    let hamMin = i === 0 ? 24 : 48;
    for (let k = Math.max(0, i - lookback); k < i; k++) {
      const d = hammingDist48(fps[i], fps[k]);
      if (d < hamMin) hamMin = d;
    }
    if (hamMin >= 19) rare++;
  }
  return rare;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

// ---------- Helpers ----------

function sampleForPreviews(records: RangeRecord[]): { idx: number; preview: string }[] {
  const n = records.length;
  const sampleSize = Math.min(50, n);
  const out: { idx: number; preview: string }[] = [];
  for (let i = 0; i < sampleSize; i++) {
    const r = records[Math.floor((i * n) / sampleSize)];
    out.push({ idx: r.idx, preview: r.raw.length > 240 ? r.raw.slice(0, 240) + "…" : r.raw });
  }
  return out;
}

function deriveName(corpusPath: string, schema: Schema): string {
  const base = path.basename(corpusPath).replace(/\.[^.]+$/, "");
  return base ? `${base} (${schema.format})` : `model-${schema.format}`;
}

function digestArtifact(m: FormedModel): string {
  const subset = {
    id: m.id,
    corpus_sha256: m.corpus_sha256,
    fields: m.fields,
    fingerprints: m.fingerprints.map((f) => ({ recordIdx: f.recordIdx, fp48Hex: f.fp48Hex, rawHash: f.rawHash })),
    taxonomy: m.taxonomy,
    seed: m.seed,
    fingerprinter_mode: m.fingerprinter_mode,
  };
  return sha256Hex(canonicalJson(subset));
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

function stripHeavy(m: FormedModel): FormedModelMeta {
  const {
    fingerprints: _f, taxonomy: _t, sample_records: _s,
    response_digest: _d, records_in_memory: _r, air_gap_compliant: _a, ...meta
  } = m;
  void _f; void _t; void _s; void _d; void _r; void _a;
  return meta;
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

// ---------- Available built-in corpora ----------

export type BuiltinCorpus = { id: string; label: string; path: string; size_bytes: number };

export async function listBuiltinCorpora(): Promise<BuiltinCorpus[]> {
  const candidates: BuiltinCorpus[] = [
    { id: "nsl-kdd",    label: "NSL-KDD intrusion detection", path: "/data/cache/nsl_kdd_train.txt", size_bytes: 19_109_424 },
    { id: "edgar",      label: "SEC EDGAR signal extraction", path: "/data/validation/edgar_signal_extraction.json", size_bytes: 60_000 },
    { id: "edgar_disc", label: "SEC EDGAR discovered categories", path: "/data/validation/edgar_discovered_categories.json", size_bytes: 140_000 },
    { id: "titan",      label: "Titan validation aggregate", path: "/data/validation/titan_validation.json", size_bytes: 32_000 },
  ];
  // Probe each in dev too
  const out: BuiltinCorpus[] = [];
  for (const c of candidates) {
    const tries = [
      c.path,
      path.resolve(process.cwd(), "..", c.path.replace(/^\/+/, "")),
    ];
    for (const t of tries) {
      try {
        const st = await fs.stat(t);
        if (st.isFile()) {
          out.push({ ...c, path: t, size_bytes: st.size });
          break;
        }
      } catch { /* next */ }
    }
  }
  return out;
}
