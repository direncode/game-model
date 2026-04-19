import { NextResponse } from "next/server";
import {
  anomalyScore,
  fingerprint48,
  getHistory,
  historySize,
  pushHistory,
} from "@/lib/streamingFingerprint";

// Live pipeline — USGS global earthquake feed.
// Source:    https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson
// Update:    refreshed every ~1 min by USGS, no authentication required
// Pipeline:  fetch  →  extract attrs  →  48-bit fingerprint  →  score vs
//            rolling history  →  rank by composite
// Determinism: seed=42, attribute quantization fixed, same input → same output
export const dynamic = "force-dynamic";

const USGS_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
const STREAM = "quakes";

function round(x: number, step: number): number {
  return Math.round(x / step) * step;
}

export async function GET() {
  const t0 = Date.now();
  let data: any;
  try {
    const resp = await fetch(USGS_URL, {
      headers: { "User-Agent": "LatentOcean/1.0 (commercial demo)" },
      next: { revalidate: 30 },
    });
    if (!resp.ok) {
      return NextResponse.json(
        { error: `USGS upstream ${resp.status}` },
        { status: 502 },
      );
    }
    data = await resp.json();
  } catch (e) {
    return NextResponse.json(
      { error: "USGS unreachable", detail: String(e) },
      { status: 503 },
    );
  }

  const features: any[] = Array.isArray(data.features) ? data.features : [];

  // Per-record fingerprint + score
  const scored = features.map((f) => {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates ?? [0, 0, 0];
    // Quantized attrs — rotation-ensemble fingerprint is scale-sensitive so
    // we quantize to stable bins to keep neighbouring quakes structurally close.
    const attrs = {
      mag: round(p.mag ?? 0, 0.1),
      depth: round(coords[2] ?? 0, 10),
      lat_bin: round(coords[1] ?? 0, 2),
      lon_bin: round(coords[0] ?? 0, 2),
      type: String(p.type ?? "earthquake"),
      mag_class: round(p.mag ?? 0, 1.0),
    };
    const fp = fingerprint48(attrs);
    const scores = anomalyScore(fp, getHistory(STREAM));
    pushHistory(STREAM, fp);
    return {
      id: f.id,
      time: new Date(p.time ?? Date.now()).toISOString(),
      place: p.place ?? "",
      magnitude: p.mag ?? null,
      depth_km: coords[2] ?? null,
      lat: coords[1] ?? null,
      lon: coords[0] ?? null,
      type: p.type ?? null,
      fingerprint_prefix: fp.slice(0, 16),
      ...scores,
    };
  });

  scored.sort((a, b) => b.composite - a.composite);

  return NextResponse.json({
    source: "USGS all_hour earthquake feed",
    source_url: USGS_URL,
    fetched_at: new Date().toISOString(),
    upstream_fetch_ms: Date.now() - t0,
    stream_history_size: historySize(STREAM),
    total_events_in_feed: features.length,
    ranked_top: scored.slice(0, 20),
    primitive: "streaming 48-bit fingerprint + Hamming-isolation + entropy",
    determinism: { seed: 42 },
  });
}
