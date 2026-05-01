/**
 * Form a private model from a corpus.
 *
 * Pipeline:
 *   1. load + adapt (generic adapter, schema-agnostic)
 *   2. iterate ALL records (no 5000-record cap — chunked instead)
 *   3. fingerprint via primary BTUT bridge → fall back through sparse
 *      operators on a per-strategy basis if primary fails or covers
 *      poorly. Coverage is recorded on the model artifact.
 *   4. crystallize taxonomy (k-means on Hamming over the merged set)
 *   5. optionally fire RunPod async; background poller updates artifact
 *   6. persist (encrypted by default) to /data/formed_models/<tenant>/
 */

import crypto from "node:crypto";
import { iterateRecords, loadCorpusFromPath, detectFormat, inferSchema, type RangeRecord, type Schema } from "./adapter";
import { buildFingerprinter, hammingDist48, NodeFingerprinter, type Fingerprint, type Fingerprinter } from "./fingerprint";
import { MinHashFingerprinter, SimHashFingerprinter, BloomFingerprinter, ByteHashFingerprinter, shouldTryMinHash, shouldTrySimHash, shouldTryBloom, type ChainAttempt } from "./sparse";
import { isRunPodAvailable, submitRunPodJob, pollRunPodJob } from "./runpod";
import { newId, saveModel, updateMeta, getModel, type FormedModel, type FormedModelMeta } from "./store";
import { record as auditRecord } from "./audit";

const SEED = 42;
const CHUNK_SIZE = 5000;       // bridge cap per call; we batch around it
const MAX_CHUNKS = 100;        // hard ceiling at 500k records per formation
const TARGET_FINGERPRINT_COUNT = 5000; // if a chunk returns this many, plenty

// ---------- Public entry ----------

export type FormRequest = {
  corpus_path?: string;
  corpus_text?: string;
  corpus_filename_hint?: string;
  name?: string;
  use_runpod?: boolean;
  compute_persistence?: boolean;       // call api container's ripser endpoint after BTUT
  // Optional caller identity (passed through from auth-resolved request).
  identity?: { user_id: string; tenant_id: string; ip?: string; user_agent?: string };
};

export async function startFormation(req: FormRequest): Promise<FormedModelMeta> {
  if (!req.corpus_path && !req.corpus_text) throw new Error("corpus_path or corpus_text required");
  const identity = req.identity ?? { user_id: "anonymous", tenant_id: "anon" };

  // Stage 0: load + adapt
  let text: string;
  let schema: Schema;
  let displayPath = "(inline)";
  if (req.corpus_path) {
    displayPath = req.corpus_path;
    const loaded = await loadCorpusFromPath(req.corpus_path);
    text = loaded.text; schema = loaded.schema;
  } else {
    text = req.corpus_text!;
    const sample = text.slice(0, 64 * 1024);
    const format = detectFormat(sample, req.corpus_filename_hint);
    schema = inferSchema(text, format, req.corpus_filename_hint);
  }

  const id = newId();
  const corpus_sha256 = sha256Hex(text);
  const formed_at = new Date().toISOString();
  const t0 = Date.now();

  // Stage 1: iterate ALL records (chunked downstream)
  const records: RangeRecord[] = [];
  for await (const r of iterateRecords(text, schema)) {
    records.push(r);
    if (records.length >= CHUNK_SIZE * MAX_CHUNKS) break; // hard ceiling
  }

  // Stage 2: chunked fingerprinting with sparse fallback chain
  const { fps, attempts, effective } = await fingerprintWithFallback(records, schema);

  // Stage 3: taxonomy
  const taxonomy = await crystallizeTaxonomy(fps);

  // Stage 3b: persistent homology (H0/H1/H2) over the BTUT survivor
  // fingerprints. Fires only when explicitly requested — ripser runs in
  // the api container with O(n^2) memory for the distance matrix and
  // O(n^(d+1)) compute for the Vietoris-Rips complex.
  let persistence: FormedModel["persistence"] | undefined = undefined;
  if (req.compute_persistence && fps.length >= 3) {
    persistence = await computePersistence(fps).catch(() => {
      // Persistence is optional — never let its failure break formation.
      return {
        bars: [],
        counts: { H0: 0, H1: 0, H2: 0 },
        metric: "hamming48" as const,
        n_points: 0,
        wall_seconds: 0,
        library: "ripser" as const,
        max_dim: 2 as const,
      };
    });
  }

  // Stage 4: optional RunPod
  let runpodJobId: string | null = null;
  let runpodSubmittedAt: string | null = null;
  if (req.use_runpod && isRunPodAvailable()) {
    const submit = await submitRunPodJob({
      entities: records.slice(0, CHUNK_SIZE).map((r) => ({
        name: `r${r.idx}`,
        type: "record",
        attributes: typeof r.fields === "object" ? (r.fields as Record<string, unknown>) : { value: r.fields },
      })),
      edges: [],
      config: { epochs: 50, seed: SEED },
      dataset_id: id,
      job_id: id,
    });
    if (submit.available && submit.status === "submitted") {
      runpodJobId = submit.runpod_job_id;
      runpodSubmittedAt = new Date().toISOString();
    }
  }

  // Stage 5: build artifact
  const fingerprintsForStore = fps.map((f) => ({
    recordIdx: f.recordIdx,
    fp48Hex: f.fp48Hex,
    rawHash: f.rawHash,
    contributing: f.contributingFields,
    strategy: (f as unknown as { __strategy?: string }).__strategy,
  }));

  const samplePreviews = sampleForPreviews(records);
  const fingerprintMs = Date.now() - t0;
  const totalChunks = Math.max(1, Math.ceil(records.length / CHUNK_SIZE));
  const coverage_pct = records.length > 0 ? Math.round((fps.length / records.length) * 100) : 0;

  const partial: FormedModel = {
    id,
    tenant_id: identity.tenant_id,
    name: req.name?.trim() || deriveName(displayPath, schema),
    corpus_path: displayPath,
    corpus_format: schema.format,
    corpus_records: schema.totalRecords,
    corpus_bytes: schema.bytes,
    corpus_sha256,
    fields: schema.fields.map((f) => ({
      name: f.name,
      nonEmptyShare: f.nonEmptyShare,
      sampleType: f.sampleType,
      entropy: 0,
    })),
    formed_at,
    formation_ms: fingerprintMs,
    seed: SEED,
    fingerprinter_mode: effective === "btut" ? "btut" : "node",
    bridge_url: process.env.BTUT_BRIDGE_URL,
    adapter_chain: attempts,
    coverage_pct,
    effective_strategy: effective,
    chunked: { total_chunks: totalChunks, chunk_size: CHUNK_SIZE, merged: totalChunks > 1 },
    encrypted: true,
    persistence,
    runpod: runpodJobId ? {
      job_id: runpodJobId,
      status: "submitted",
      submitted_at: runpodSubmittedAt!,
    } : undefined,
    status: "ready",
    fingerprints: fingerprintsForStore,
    taxonomy,
    sample_records: samplePreviews,
    response_digest: "",
    records_in_memory: fingerprintsForStore.length,
    air_gap_compliant: !runpodJobId,
  };

  partial.response_digest = digestArtifact(partial);
  await saveModel(partial, { encrypt: true });

  // Audit
  await auditRecord({
    ts: new Date().toISOString(),
    actor: identity,
    action: "form",
    resource: { kind: "model", id, name: partial.name },
    details: {
      records: records.length,
      chunks: totalChunks,
      effective_strategy: effective,
      coverage_pct,
      runpod: !!runpodJobId,
      corpus_format: schema.format,
    },
    result: "success",
    digest: partial.response_digest,
    wall_ms: fingerprintMs,
  }).catch(() => { /* never let audit failure break formation */ });

  if (runpodJobId) {
    await updateMeta(id, { progress: { phase: "runpod-crystallizing", pct: 0 } }, identity.tenant_id);
    void pollAndAttachRunPodResult(id, runpodJobId, identity.tenant_id);
  }

  return stripHeavy(partial);
}

// ---------- Sparse-chain fingerprinter orchestration ----------

async function fingerprintWithFallback(
  records: RangeRecord[],
  schema: Schema,
): Promise<{ fps: Fingerprint[]; attempts: ChainAttempt[]; effective: string }> {
  const attempts: ChainAttempt[] = [];

  // 1. BTUT (or node-dense if bridge unavailable)
  const primary = await buildFingerprinter(schema);
  const primaryStrategy = primary.mode === "btut" ? "btut" : "node-dense";
  const t0 = Date.now();
  let primaryFps: Fingerprint[] = [];
  let primaryOK = false;
  try {
    primaryFps = await chunkedFingerprint(primary, records);
    // Coverage heuristic differs by primary mode:
    //   - BTUT is a SAMPLING primitive by design (~300 survivors per chunk).
    //     If it produced any survivors at all, primary covered the corpus
    //     in the BTUT sense and the sparse-fallback chain should NOT run.
    //   - Node-dense is a 1:1 fingerprinter: it must cover every record.
    if (primary.mode === "btut") {
      primaryOK = primaryFps.length > 0;
    } else {
      primaryOK = primaryFps.length >= Math.min(records.length, TARGET_FINGERPRINT_COUNT) || primaryFps.length === records.length;
    }
  } catch (e) {
    attempts.push({ strategy: primaryStrategy as ChainAttempt["strategy"], tried: true, succeeded: false, records_covered: 0, ms: Date.now() - t0, reason: `primary failed: ${e}` });
  }
  if (primaryOK) {
    attempts.push({ strategy: primaryStrategy as ChainAttempt["strategy"], tried: true, succeeded: true, records_covered: primaryFps.length, ms: Date.now() - t0, reason: "primary path covered the corpus" });
    // Mark fingerprints with their strategy
    for (const f of primaryFps) (f as unknown as { __strategy: string }).__strategy = primaryStrategy;
    // No fallbacks needed
    attempts.push({ strategy: "minhash", tried: false, succeeded: false, records_covered: 0, ms: 0, reason: "primary covered; sparse fallback not needed" });
    attempts.push({ strategy: "simhash", tried: false, succeeded: false, records_covered: 0, ms: 0, reason: "primary covered" });
    attempts.push({ strategy: "bloom",   tried: false, succeeded: false, records_covered: 0, ms: 0, reason: "primary covered" });
    attempts.push({ strategy: "byte_hash", tried: false, succeeded: false, records_covered: 0, ms: 0, reason: "primary covered" });
    return { fps: primaryFps, attempts, effective: primaryStrategy };
  }
  // Note primary failure but DON'T add a duplicate attempt entry
  if (attempts.length === 0) {
    attempts.push({ strategy: primaryStrategy as ChainAttempt["strategy"], tried: true, succeeded: false, records_covered: primaryFps.length, ms: Date.now() - t0, reason: "primary path did not converge" });
  }

  // 2. Sparse fallbacks — try per-record. Use uncovered records first.
  const covered = new Set(primaryFps.map((f) => f.recordIdx));
  const uncovered = records.filter((r) => !covered.has(r.idx));
  let merged: Fingerprint[] = [...primaryFps];

  // MinHash
  const mh = shouldTryMinHash(schema);
  if (mh.tryIt && uncovered.length > 0) {
    const t = Date.now();
    try {
      const fp = new MinHashFingerprinter(schema);
      const got = await chunkedFingerprint(fp, uncovered);
      for (const f of got) (f as unknown as { __strategy: string }).__strategy = "minhash";
      merged = merged.concat(got);
      attempts.push({ strategy: "minhash", tried: true, succeeded: got.length > 0, records_covered: got.length, ms: Date.now() - t, reason: mh.reason });
    } catch (e) {
      attempts.push({ strategy: "minhash", tried: true, succeeded: false, records_covered: 0, ms: Date.now() - t, reason: `minhash failed: ${e}` });
    }
  } else {
    attempts.push({ strategy: "minhash", tried: false, succeeded: false, records_covered: 0, ms: 0, reason: mh.reason });
  }

  // SimHash
  const sh = shouldTrySimHash(schema);
  const stillUncovered1 = records.filter((r) => !merged.some((f) => f.recordIdx === r.idx));
  if (sh.tryIt && stillUncovered1.length > 0) {
    const t = Date.now();
    try {
      const fp = new SimHashFingerprinter(schema);
      const got = await chunkedFingerprint(fp, stillUncovered1);
      for (const f of got) (f as unknown as { __strategy: string }).__strategy = "simhash";
      merged = merged.concat(got);
      attempts.push({ strategy: "simhash", tried: true, succeeded: got.length > 0, records_covered: got.length, ms: Date.now() - t, reason: sh.reason });
    } catch (e) {
      attempts.push({ strategy: "simhash", tried: true, succeeded: false, records_covered: 0, ms: Date.now() - t, reason: `simhash failed: ${e}` });
    }
  } else {
    attempts.push({ strategy: "simhash", tried: false, succeeded: false, records_covered: 0, ms: 0, reason: sh.reason });
  }

  // Bloom
  const bl = shouldTryBloom(schema);
  const stillUncovered2 = records.filter((r) => !merged.some((f) => f.recordIdx === r.idx));
  if (bl.tryIt && stillUncovered2.length > 0) {
    const t = Date.now();
    try {
      const fp = new BloomFingerprinter(schema);
      const got = await chunkedFingerprint(fp, stillUncovered2);
      for (const f of got) (f as unknown as { __strategy: string }).__strategy = "bloom";
      merged = merged.concat(got);
      attempts.push({ strategy: "bloom", tried: true, succeeded: got.length > 0, records_covered: got.length, ms: Date.now() - t, reason: bl.reason });
    } catch (e) {
      attempts.push({ strategy: "bloom", tried: true, succeeded: false, records_covered: 0, ms: Date.now() - t, reason: `bloom failed: ${e}` });
    }
  } else {
    attempts.push({ strategy: "bloom", tried: false, succeeded: false, records_covered: 0, ms: 0, reason: bl.reason });
  }

  // Byte-hash fail-safe — anything still uncovered
  const stillUncovered3 = records.filter((r) => !merged.some((f) => f.recordIdx === r.idx));
  if (stillUncovered3.length > 0) {
    const t = Date.now();
    const fp = new ByteHashFingerprinter(schema);
    const got = await chunkedFingerprint(fp, stillUncovered3);
    for (const f of got) (f as unknown as { __strategy: string }).__strategy = "byte_hash";
    merged = merged.concat(got);
    attempts.push({ strategy: "byte_hash", tried: true, succeeded: got.length > 0, records_covered: got.length, ms: Date.now() - t, reason: "fail-safe coverage of remaining records" });
  } else {
    attempts.push({ strategy: "byte_hash", tried: false, succeeded: false, records_covered: 0, ms: 0, reason: "all records covered by earlier strategies" });
  }

  // Sort merged by recordIdx so taxonomy / queries see stable ordering
  merged.sort((a, b) => a.recordIdx - b.recordIdx);

  // Effective: the strategy that covered the most records
  const tally = new Map<string, number>();
  for (const a of attempts) if (a.succeeded) tally.set(a.strategy, (tally.get(a.strategy) ?? 0) + a.records_covered);
  let effective = primaryStrategy;
  let max = 0;
  for (const [s, n] of tally) if (n > max) { max = n; effective = s; }

  return { fps: merged, attempts, effective };
}

// Run the fingerprinter in chunks of CHUNK_SIZE so the bridge cap is
// always respected.
async function chunkedFingerprint(fp: Fingerprinter, records: RangeRecord[]): Promise<Fingerprint[]> {
  const out: Fingerprint[] = [];
  for (let off = 0; off < records.length; off += CHUNK_SIZE) {
    const slice = records.slice(off, off + CHUNK_SIZE);
    const got = await fp.fingerprintBatch(slice);
    out.push(...got);
  }
  return out;
}

// ---------- RunPod background poll ----------

async function pollAndAttachRunPodResult(modelId: string, runpodJobId: string, tenantId: string) {
  const start = Date.now();
  const deadlineMs = 30 * 60 * 1000;
  while (Date.now() - start < deadlineMs) {
    const r = await pollRunPodJob(runpodJobId);
    if (!r.available) {
      await updateMeta(modelId, { error: r.reason }, tenantId);
      return;
    }
    if (r.status === "completed") {
      const m = await getModel(modelId, tenantId);
      if (m) {
        m.progress = { phase: "runpod-complete", pct: 100 };
        // Capture RunPod output summary on the model so callers can verify
        // the GPU run actually fired and produced something. The handler
        // returns either a single dict or a list (one per yield).
        const out = r.output;
        const final = Array.isArray(out) ? (out[out.length - 1] as Record<string, unknown>) : (out as Record<string, unknown> | undefined);
        if (final && typeof final === "object") {
          const modules = Array.isArray(final.modules) ? final.modules.length : 0;
          if (m.runpod) {
            m.runpod = {
              ...m.runpod,
              status: "completed",
              completed_at: new Date().toISOString(),
              output_summary: {
                modules,
                final_loss: typeof final.final_loss === "number" ? final.final_loss : undefined,
                final_auc:  typeof final.final_auc  === "number" ? final.final_auc  : undefined,
                final_knn:  typeof final.final_knn  === "number" ? final.final_knn  : undefined,
                total_epochs: typeof final.total_epochs === "number" ? final.total_epochs : undefined,
                training_time_seconds: typeof final.training_time_seconds === "number" ? final.training_time_seconds : undefined,
                device: typeof final.device === "string" ? final.device : undefined,
              },
            };
          }
        }
        m.response_digest = digestArtifact(m);
        await saveModel(m);
      }
      return;
    }
    if (r.status === "failed") {
      // Update both progress AND runpod sub-state so the model artifact
      // reflects the failure honestly.
      const m = await getModel(modelId, tenantId);
      if (m) {
        m.progress = { phase: "runpod-failed", pct: 0 };
        m.error = r.error || "runpod failed";
        if (m.runpod) m.runpod = { ...m.runpod, status: "failed", error: r.error, completed_at: new Date().toISOString() };
        m.response_digest = digestArtifact(m);
        await saveModel(m);
      }
      return;
    }
    await sleep(5_000);
  }
}

// Compute persistent homology over a set of survivor fingerprints by
// calling the api container's /api/v1/range/persistence endpoint.
// Returns null shape if the bridge URL isn't set or the call fails;
// callers MUST treat persistence as optional.
async function computePersistence(fps: Fingerprint[]): Promise<FormedModel["persistence"]> {
  const bridge = process.env.BTUT_BRIDGE_URL;
  if (!bridge) return undefined;
  // The bridge samples server-side (stride). We send all survivors and let
  // the server cap. max_points=600 + thresh=24 keeps wall-time under ~90s.
  const max_points = 600;
  const fpsHex = fps.map((f) => f.fp48Hex);
  const t0 = Date.now();

  // Node 20's undici fetch defaults to headersTimeout=60s. Ripser on 600
  // Hamming-48 points runs ~75s, so we use the raw http module with no
  // socket idle timeout — fetch+webpack don't surface a clean way to
  // raise undici timeouts in a Next.js server route.
  const data = await new Promise<{
    bars: { dim: number; birth: number; death: number }[];
    counts?: { H0?: number; H1?: number; H2?: number };
    n_points?: number;
    wall_seconds?: number;
  }>((resolve, reject) => {
    const http = require("node:http") as typeof import("node:http");
    const url = new URL(`${bridge}/api/v1/range/persistence`);
    const body = JSON.stringify({ fingerprints: fpsHex, max_dim: 2, max_points, thresh: 24.0 });
    const req = http.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Connection: "close",
      },
      timeout: 0,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
          return reject(new Error(`persistence bridge HTTP ${res.statusCode}`));
        }
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8"))); }
        catch (e) { reject(new Error(`persistence bridge JSON parse: ${e}`)); }
      });
      res.on("error", reject);
    });
    req.setTimeout(0);   // no idle timeout
    req.on("error", (e) => reject(new Error(`persistence bridge unreachable: ${e}`)));
    req.write(body);
    req.end();
  });
  const bars = (data.bars ?? []).map((b) => ({
    dim: (b.dim === 1 ? 1 : b.dim === 2 ? 2 : 0) as 0 | 1 | 2,
    birth: b.birth, death: b.death,
  }));
  return {
    bars,
    counts: { H0: data.counts?.H0 ?? 0, H1: data.counts?.H1 ?? 0, H2: data.counts?.H2 ?? 0 },
    metric: "hamming48",
    n_points: data.n_points ?? fpsHex.length,
    wall_seconds: data.wall_seconds ?? (Date.now() - t0) / 1000,
    library: "ripser",
    max_dim: 2,
  };
}

// ---------- Taxonomy crystallization (unchanged math) ----------

async function crystallizeTaxonomy(fps: Fingerprint[]): Promise<FormedModel["taxonomy"]> {
  if (fps.length === 0) return { classes: [], silhouette: 0, null_test_z: 0, novel_class_count: 0 };
  const N = fps.length;
  const K = Math.min(12, Math.max(3, Math.round(Math.sqrt(N) / 4)));
  const order = fps.map((_, i) => i).sort((a, b) => fps[a].fp48Hex.localeCompare(fps[b].fp48Hex));
  const centroidIdxs = Array.from({ length: K }, (_, i) => order[Math.floor((i * N) / K)]);
  let centroids = centroidIdxs.map((i) => fps[i].fp48);
  let assignment = new Array<number>(N).fill(0);

  for (let iter = 0; iter < 6; iter++) {
    for (let i = 0; i < N; i++) {
      let best = 0; let bestD = 49;
      for (let k = 0; k < K; k++) {
        const d = hammingDist48(fps[i].fp48, centroids[k]);
        if (d < bestD) { bestD = d; best = k; }
      }
      assignment[i] = best;
    }
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

  const classes: FormedModel["taxonomy"]["classes"] = [];
  for (let k = 0; k < K; k++) {
    const memberIdxs = assignment.map((a, i) => a === k ? i : -1).filter((x) => x >= 0);
    if (memberIdxs.length === 0) continue;
    const sample = memberIdxs.slice(0, 5).map((i) => fps[i].recordIdx);
    classes.push({
      id: k, size: memberIdxs.length,
      centroid_fp48Hex: centroids[k].toString(16).padStart(12, "0"),
      sample_record_idxs: sample,
    });
  }
  classes.sort((a, b) => b.size - a.size);

  // Sampled silhouette
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
    if (denom > 0) { silhSum += (bMean - aMean) / denom; silhCount++; }
  }
  const silhouette = silhCount > 0 ? Number((silhSum / silhCount).toFixed(3)) : 0;

  // Real null permutation test
  const trueRare = countRare(fps.map((f) => f.fp48));
  const trueShare = trueRare / fps.length;
  const PERMS = 80;
  const perms: number[] = [];
  let rngBuf = crypto.createHash("sha256").update("nullperm:" + SEED).digest();
  let rngIdx = 0;
  const nextRng = (): number => {
    if (rngIdx >= rngBuf.length - 4) { rngBuf = crypto.createHash("sha256").update(rngBuf).digest(); rngIdx = 0; }
    const v = rngBuf.readUInt32BE(rngIdx); rngIdx += 4; return v;
  };
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
  let s = 0; for (const v of arr) s += v; return s / arr.length;
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
  const base = corpusPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "";
  return base ? `${base} (${schema.format})` : `model-${schema.format}`;
}

function digestArtifact(m: FormedModel): string {
  const subset = {
    id: m.id,
    tenant_id: m.tenant_id,
    corpus_sha256: m.corpus_sha256,
    fields: m.fields,
    fingerprints: m.fingerprints.map((f) => ({ recordIdx: f.recordIdx, fp48Hex: f.fp48Hex, rawHash: f.rawHash, strategy: f.strategy })),
    taxonomy: m.taxonomy,
    seed: m.seed,
    fingerprinter_mode: m.fingerprinter_mode,
    coverage_pct: m.coverage_pct,
    effective_strategy: m.effective_strategy,
  };
  return sha256Hex(canonicalJson(subset));
}
function sha256Hex(s: string): string { return crypto.createHash("sha256").update(s).digest("hex"); }
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

import { promises as fs } from "node:fs";
import path from "node:path";

export type BuiltinCorpus = { id: string; label: string; path: string; size_bytes: number };

export async function listBuiltinCorpora(): Promise<BuiltinCorpus[]> {
  const candidates: BuiltinCorpus[] = [
    { id: "nsl-kdd",    label: "NSL-KDD intrusion detection", path: "/data/cache/nsl_kdd_train.txt", size_bytes: 19_109_424 },
    { id: "edgar",      label: "SEC EDGAR signal extraction", path: "/data/validation/edgar_signal_extraction.json", size_bytes: 60_000 },
    { id: "edgar_disc", label: "SEC EDGAR discovered categories", path: "/data/validation/edgar_discovered_categories.json", size_bytes: 140_000 },
    { id: "titan",      label: "Titan validation aggregate", path: "/data/validation/titan_validation.json", size_bytes: 32_000 },
  ];
  const out: BuiltinCorpus[] = [];
  for (const c of candidates) {
    const tries = [c.path, path.resolve(process.cwd(), "..", c.path.replace(/^\/+/, ""))];
    for (const t of tries) {
      try {
        const st = await fs.stat(t);
        if (st.isFile()) { out.push({ ...c, path: t, size_bytes: st.size }); break; }
      } catch { /* next */ }
    }
  }
  return out;
}
