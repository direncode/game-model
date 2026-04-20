import { NextResponse } from "next/server";
import { getHistory } from "@/lib/streamingFingerprint";

// Per-stream null-test endpoint.
//
// The falsifiability claim on /live depends on this: given the in-memory
// rolling history of 48-bit fingerprints for a stream (quakes / crypto /
// edgar), is the observed top-K composite mean significantly higher than
// what we would see under random permutation of the fingerprint bits?
//
// Null model: for each iteration, shuffle the bits of every history
// fingerprint (preserving bit-count — a balanced permutation), recompute
// top-K mean Hamming-isolation score, build null distribution. Compare
// true top-K mean against null p95 / p99 / p999. Report z-score.
//
// Same seed determinism as the batch validator. No LLM, no external API.
export const dynamic = "force-dynamic";

function hamming(a: string, b: string): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

function meanIsolation(fingerprints: string[], K: number): number {
  if (fingerprints.length < 2) return 0;
  const scores: number[] = [];
  for (const fp of fingerprints) {
    let minH = fp.length;
    for (const g of fingerprints) {
      if (g === fp) continue;
      const h = hamming(fp, g);
      if (h < minH) minH = h;
    }
    scores.push(minH / fp.length);
  }
  scores.sort((a, b) => b - a);
  const topK = scores.slice(0, Math.min(K, scores.length));
  return topK.reduce((a, b) => a + b, 0) / topK.length;
}

function seededShuffle(bits: string, seed: number): string {
  // Fisher-Yates with a linear-congruential PRNG seeded by `seed`.
  const arr = bits.split("");
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export async function GET(
  _req: Request,
  { params }: { params: { stream: string } },
) {
  const stream = params.stream;
  const history = getHistory(stream);
  if (history.length < 20) {
    return NextResponse.json({
      stream,
      status: "insufficient_history",
      history_size: history.length,
      min_required: 20,
      message: "Poll /api/live/* a few more times to accumulate history.",
    });
  }

  const url = new URL(_req.url);
  const iterations = Math.max(50, Math.min(1000, parseInt(url.searchParams.get("n") || "300", 10)));
  const K = Math.min(history.length - 1, parseInt(url.searchParams.get("k") || "10", 10));

  const trueMean = meanIsolation(history, K);

  const nullMeans: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const shuffled = history.map((fp, j) => seededShuffle(fp, 42 + i * 7919 + j));
    nullMeans[i] = meanIsolation(shuffled, K);
  }
  const sorted = nullMeans.slice().sort((a, b) => a - b);
  const mean = nullMeans.reduce((a, b) => a + b, 0) / iterations;
  const variance =
    nullMeans.reduce((a, b) => a + (b - mean) ** 2, 0) / iterations;
  const std = Math.sqrt(variance) + 1e-12;
  const p95 = sorted[Math.floor(0.95 * iterations)];
  const p99 = sorted[Math.floor(0.99 * iterations)];
  const p999 = sorted[Math.floor(0.999 * iterations)];
  const zScore = (trueMean - mean) / std;

  return NextResponse.json({
    stream,
    history_size: history.length,
    K,
    n_iterations: iterations,
    seed: 42,
    true_top_k_isolation: trueMean,
    null: {
      mean,
      std,
      p95,
      p99,
      p999,
    },
    z_score: zScore,
    significant_0_05: trueMean > p95,
    significant_0_01: trueMean > p99,
    significant_0_001: trueMean > p999,
    primitive:
      "seeded Fisher-Yates bit-shuffle preserving bit-count per fingerprint; " +
      "top-K mean Hamming-isolation under true vs null",
  });
}
