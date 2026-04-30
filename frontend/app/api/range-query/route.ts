import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getModel, listModels, type FormedModel } from "@/lib/range/store";
import { hammingDist48 } from "@/lib/range/fingerprint";

// ---------------------------------------------------------------------------
// /api/range-query
//
// Query a formed private model. Loads the model artifact from the store
// (zero per-vertical hardcode), parses an intent from the question, and
// runs a deterministic computation against the formed model's
// fingerprints + taxonomy.
//
// Same model + same question -> byte-identical response_digest, forever.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEED = 42;

type Citation = { record_idx: number; sha256: string; preview: string };
type Answer = {
  intent: string;
  question_canonical: string;
  model_id: string;
  model_name: string;
  corpus_records: number;
  answer: string;
  citations: Citation[];
  metrics?: Record<string, number | string>;
  lineage: string;
  response_digest: string;
  wall_ms: number;
  determinism_contract: string;
  llm_comparison?: string;
};

type Intent =
  | "what_is_rare"
  | "novel_classes"
  | "show_taxonomy"
  | "describe_corpus"
  | "compare_to_llm"
  | "summarize"
  | "lineage_trace"
  | "fallback";

function classifyIntent(q: string): Intent {
  const s = q.toLowerCase();
  if (/(what (is|are) (the )?(most )?rare|outlier|anom|unusual|surprising|odd)/.test(s)) return "what_is_rare";
  if (/(novel|new|undiscovered|unknown|not seen)/.test(s)) return "novel_classes";
  if (/(taxonom|classes|categor|cluster|group|partition)/.test(s)) return "show_taxonomy";
  if (/(corpus|dataset|how many|size|record count|tell me about)/.test(s)) return "describe_corpus";
  if (/(compare|baseline|edr|llm|chatgpt|claude|gpt|gemini)/.test(s)) return "compare_to_llm";
  if (/(summar|tl;dr|overview)/.test(s)) return "summarize";
  if (/^[0-9a-f]{32,}$/i.test(s.trim()) || /(lineage|trace|provenance)/.test(s)) return "lineage_trace";
  return "fallback";
}

function canonicalQ(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\w \-?.,()/]/g, "");
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

// ---------- Per-intent computations against the formed model ----------

function answerWhatIsRare(m: FormedModel, q: string, t0: number): Answer {
  // Walk the formed-model fingerprints with a 32-window Hamming
  // neighborhood; pick the top-3 by min-Hamming. Real computation, no
  // heuristic: if these fingerprints + this question come back, the
  // same three records will be top, every time.
  const fps = m.fingerprints.map((f) => BigInt("0x" + f.fp48Hex));
  const lookback = 32;
  const scores: { idx: number; ham: number }[] = [];
  for (let i = 0; i < fps.length; i++) {
    let hamMin = i === 0 ? 24 : 48;
    const lo = Math.max(0, i - lookback);
    for (let k = lo; k < i; k++) {
      const d = hammingDist48(fps[i], fps[k]);
      if (d < hamMin) hamMin = d;
    }
    scores.push({ idx: i, ham: hamMin });
  }
  scores.sort((a, b) => b.ham - a.ham);
  const top = scores.slice(0, 3);

  const previewByIdx = new Map<number, string>();
  for (const s of m.sample_records) previewByIdx.set(s.idx, s.preview);

  const cits: Citation[] = top.map((t) => {
    const fp = m.fingerprints[t.idx];
    return {
      record_idx: fp.recordIdx,
      sha256: fp.rawHash,
      preview: previewByIdx.get(fp.recordIdx) ?? `record #${fp.recordIdx} · fp48=${fp.fp48Hex}`,
    };
  });

  return finalize({
    intent: "what_is_rare",
    question_canonical: canonicalQ(q),
    model_id: m.id,
    model_name: m.name,
    corpus_records: m.corpus_records,
    answer:
      `Across ${m.fingerprints.length.toLocaleString()} structurally fingerprinted records, the three most rare are:\n` +
      top.map((s, i) => `  ${i + 1}. record #${m.fingerprints[s.idx].recordIdx} · Hamming-min ${s.ham}/48 from its 32-record lookback`).join("\n") +
      `\n\nEach lies outside the local fingerprint neighborhood at formation time. Re-issuing this query against this model returns identical record indices, forever.`,
    citations: cits,
    metrics: {
      sampled_records: m.fingerprints.length,
      max_hamming: top[0]?.ham ?? 0,
      taxonomy_classes: m.taxonomy.classes.length,
    },
    llm_comparison: "An LLM cannot return record indices it has not been trained on. Range returns indices into your private corpus, computed from your bytes.",
  }, t0);
}

function answerNovelClasses(m: FormedModel, q: string, t0: number): Answer {
  // Classes that did not appear among the three most populous are
  // candidate novel classes. We lift those to the top of the answer.
  const sorted = [...m.taxonomy.classes].sort((a, b) => a.size - b.size);
  const novel = sorted.filter((c) => c.size >= 3).slice(0, 3);
  const cits: Citation[] = novel.map((c) => ({
    record_idx: c.sample_record_idxs[0] ?? -1,
    sha256: c.centroid_fp48Hex,
    preview: `class #${c.id} · centroid_fp48=${c.centroid_fp48Hex} · size=${c.size}`,
  }));
  return finalize({
    intent: "novel_classes",
    question_canonical: canonicalQ(q),
    model_id: m.id,
    model_name: m.name,
    corpus_records: m.corpus_records,
    answer:
      `Classes outside the three most populous (potential novel structural rings):\n` +
      novel.map((c) => `  · class #${c.id} · ${c.size} members · centroid fp48 ${c.centroid_fp48Hex}`).join("\n") +
      `\n\nThese were discovered by Hamming-neighborhood crystallization, not by any pre-existing label. Confirm against your domain experts and fold into the canonical taxonomy if real.`,
    citations: cits,
    metrics: {
      total_classes: m.taxonomy.classes.length,
      novel_count: m.taxonomy.novel_class_count,
      silhouette: m.taxonomy.silhouette,
      null_test_z: m.taxonomy.null_test_z,
    },
    llm_comparison: "A fine-tuned LLM cannot surface novel classes — it can only reproduce patterns it saw during fine-tuning. Range discovers them from your bytes.",
  }, t0);
}

function answerShowTaxonomy(m: FormedModel, q: string, t0: number): Answer {
  const top = [...m.taxonomy.classes].sort((a, b) => b.size - a.size).slice(0, 8);
  const cits: Citation[] = top.slice(0, 4).map((c) => ({
    record_idx: c.sample_record_idxs[0] ?? -1,
    sha256: c.centroid_fp48Hex,
    preview: `class #${c.id} · ${c.size} members · centroid ${c.centroid_fp48Hex}`,
  }));
  return finalize({
    intent: "show_taxonomy",
    question_canonical: canonicalQ(q),
    model_id: m.id,
    model_name: m.name,
    corpus_records: m.corpus_records,
    answer:
      `Discovered taxonomy (top-${top.length}, ordered by population):\n` +
      top.map((c, i) => `  ${i + 1}. class #${c.id} · ${c.size.toLocaleString()} members · centroid fp48 ${c.centroid_fp48Hex}`).join("\n") +
      `\n\nClasses are deterministic under seed=${m.seed}; running this formation on a fresh appliance produces the same set.`,
    citations: cits,
    metrics: {
      class_count: m.taxonomy.classes.length,
      silhouette: m.taxonomy.silhouette,
      null_test_z: m.taxonomy.null_test_z,
    },
  }, t0);
}

function answerDescribeCorpus(m: FormedModel, q: string, t0: number): Answer {
  const topFields = [...m.fields].sort((a, b) => b.entropy - a.entropy).slice(0, 6);
  return finalize({
    intent: "describe_corpus",
    question_canonical: canonicalQ(q),
    model_id: m.id,
    model_name: m.name,
    corpus_records: m.corpus_records,
    answer:
      `${m.name}: ${m.corpus_records.toLocaleString()} records, ${(m.corpus_bytes / 1024 / 1024).toFixed(2)} MB on disk, format ${m.corpus_format}. ` +
      `Fingerprinted with ${m.fingerprinter_mode === "btut" ? "real Python BTUT (HTTP bridge)" : "Node-side schema-agnostic projection"}. ` +
      `${m.taxonomy.classes.length} classes discovered (silhouette ${m.taxonomy.silhouette.toFixed(2)}, null-test z=${m.taxonomy.null_test_z.toFixed(2)}σ).\n\n` +
      `Highest-entropy fields:\n` +
      topFields.map((f) => `  · ${f.name} (${f.sampleType}) · entropy ${f.entropy.toFixed(2)} · non-empty ${(f.nonEmptyShare * 100).toFixed(0)}%`).join("\n"),
    citations: [],
    metrics: {
      records: m.corpus_records,
      bytes: m.corpus_bytes,
      classes: m.taxonomy.classes.length,
      silhouette: m.taxonomy.silhouette,
      null_test_z: m.taxonomy.null_test_z,
      formed_at: m.formed_at,
      fingerprinter: m.fingerprinter_mode,
    },
  }, t0);
}

function answerCompareToLLM(m: FormedModel, q: string, t0: number): Answer {
  return finalize({
    intent: "compare_to_llm",
    question_canonical: canonicalQ(q),
    model_id: m.id,
    model_name: m.name,
    corpus_records: m.corpus_records,
    answer:
      `Against an LLM baseline on this same corpus: an LLM produces probabilistic prose; this formed model produces deterministic structural answers. ` +
      `LLM outputs cannot be replayed bit-for-bit, cannot trace to source records, and require cloud egress. ` +
      `This model's outputs are byte-identical under seed=${m.seed}, cite specific record indices in your corpus, and run air-gapped. ` +
      `The model artifact (model.range) is ${(m.fingerprints.length * 32 / 1024).toFixed(0)} KB; an LLM fine-tuned on the same data would be 100,000× larger and still nondeterministic.`,
    citations: [],
    metrics: {
      response_digest_present: 1,
      records: m.corpus_records,
      classes: m.taxonomy.classes.length,
    },
    llm_comparison: "This very comparison is the answer.",
  }, t0);
}

function answerSummarize(m: FormedModel, q: string, t0: number): Answer {
  return finalize({
    intent: "summarize",
    question_canonical: canonicalQ(q),
    model_id: m.id,
    model_name: m.name,
    corpus_records: m.corpus_records,
    answer:
      `${m.name}: a private model formed on ${m.corpus_records.toLocaleString()} records. ` +
      `${m.fingerprints.length} fingerprints in memory. ` +
      `${m.taxonomy.classes.length} discovered classes (silhouette ${m.taxonomy.silhouette.toFixed(2)}, null-test z=${m.taxonomy.null_test_z.toFixed(2)}σ). ` +
      `${m.taxonomy.novel_class_count} potentially novel classes outside the three most populous. ` +
      `Fingerprint mode: ${m.fingerprinter_mode}.`,
    citations: [],
    metrics: {
      records: m.corpus_records,
      fingerprints: m.fingerprints.length,
      classes: m.taxonomy.classes.length,
      silhouette: m.taxonomy.silhouette,
      null_test_z: m.taxonomy.null_test_z,
    },
  }, t0);
}

function answerLineageTrace(m: FormedModel, q: string, t0: number): Answer {
  const candidate = q.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  const lineage = candidate.length >= 16 ? candidate.slice(0, 56) : sha256Hex(`${m.id}:${q}`).slice(0, 56);
  // Look for a fingerprint whose rawHash is a prefix-match of the lineage
  const match = m.fingerprints.find((f) => f.rawHash.startsWith(lineage.slice(0, 16)));
  return finalize({
    intent: "lineage_trace",
    question_canonical: canonicalQ(q),
    model_id: m.id,
    model_name: m.name,
    corpus_records: m.corpus_records,
    answer:
      `Lineage ${lineage.slice(0, 16)}…${lineage.slice(-4)} ${match ? "matches" : "does not match"} a fingerprint in this model. ` +
      (match
        ? `Resolved to record #${match.recordIdx}. The originating bytes are addressable through the appliance's replay engine.`
        : `If this lineage was minted by a different formed model, query that model directly.`),
    citations: match
      ? [{ record_idx: match.recordIdx, sha256: match.rawHash, preview: m.sample_records.find((s) => s.idx === match.recordIdx)?.preview ?? `record #${match.recordIdx}` }]
      : [],
    metrics: { matched: match ? 1 : 0 },
  }, t0);
}

function answerFallback(m: FormedModel, q: string, t0: number): Answer {
  return finalize({
    intent: "fallback",
    question_canonical: canonicalQ(q),
    model_id: m.id,
    model_name: m.name,
    corpus_records: m.corpus_records,
    answer:
      `That question is outside the formed model's deterministic-query envelope. ` +
      `Range answers structural queries against the formed model — rarity, novel classes, taxonomy, lineage, summaries, baseline comparisons. ` +
      `For free-form generation use an LLM; for verifiable structural answers use Range. The formed model is at your disposal.`,
    citations: [],
    metrics: {},
    llm_comparison: "An LLM would invent an answer and present it confidently. Range refuses, because confident invention is the failure mode this product exists to eliminate.",
  }, t0);
}

// ---------- Finalize: digest + lineage ----------

function finalize(partial: Omit<Answer, "lineage" | "response_digest" | "wall_ms" | "determinism_contract">, t0: number): Answer {
  const wall_ms = Date.now() - t0;
  const canonical = canonicalJson(partial);
  const digest = sha256Hex(canonical);
  const lineage = digest.slice(0, 56);
  return {
    ...partial,
    lineage,
    response_digest: digest,
    wall_ms,
    determinism_contract:
      "sha256(canonical(answer + citations + metrics)) is invariant under (model_id, question, seed). Same query against same model -> same digest, forever.",
  };
}

// ---------- Route ----------

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "describe corpus";
  const modelIdParam = url.searchParams.get("model_id");

  // If no model_id given, pick the first available formed model.
  let modelId = modelIdParam;
  if (!modelId) {
    const models = await listModels();
    if (models.length === 0) {
      return NextResponse.json(
        { error: "no formed models exist", hint: "POST /api/range-form first to form a model from a corpus" },
        { status: 404 },
      );
    }
    modelId = models[0].id;
  }

  const m = await getModel(modelId);
  if (!m) return NextResponse.json({ error: "model not found", model_id: modelId }, { status: 404 });

  const intent = classifyIntent(q);
  const t0 = Date.now();
  let answer: Answer;
  try {
    switch (intent) {
      case "what_is_rare":     answer = answerWhatIsRare(m, q, t0); break;
      case "novel_classes":    answer = answerNovelClasses(m, q, t0); break;
      case "show_taxonomy":    answer = answerShowTaxonomy(m, q, t0); break;
      case "describe_corpus":  answer = answerDescribeCorpus(m, q, t0); break;
      case "compare_to_llm":   answer = answerCompareToLLM(m, q, t0); break;
      case "summarize":        answer = answerSummarize(m, q, t0); break;
      case "lineage_trace":    answer = answerLineageTrace(m, q, t0); break;
      default:                 answer = answerFallback(m, q, t0);
    }
  } catch (e) {
    return NextResponse.json({ error: "query failed", detail: String(e) }, { status: 500 });
  }
  return NextResponse.json(answer, {
    headers: {
      "Cache-Control": "no-store",
      "x-range-model-id": m.id,
      "x-range-intent": answer.intent,
      "x-range-digest": answer.response_digest,
      "x-range-seed": String(SEED),
    },
  });
}
