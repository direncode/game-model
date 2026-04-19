import { NextResponse } from "next/server";
import {
  anomalyScore,
  fingerprint48,
  getHistory,
  historySize,
  pushHistory,
} from "@/lib/streamingFingerprint";

// Live pipeline — CoinGecko top-100 markets.
// Source:  https://api.coingecko.com/api/v3/coins/markets
// Auth:    none for the top-of-list query (rate limited to ~10 rpm)
// Pipeline: same universal fingerprint primitive as /api/live/quakes.
//           Proves the engine applies unchanged from seismology to finance.
export const dynamic = "force-dynamic";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/coins/markets" +
  "?vs_currency=usd&order=market_cap_desc&per_page=100&page=1" +
  "&sparkline=false&price_change_percentage=1h,24h,7d";
const STREAM = "crypto";

function bucket(x: number, step: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x / step) * step;
}

export async function GET() {
  const t0 = Date.now();
  let rows: any[];
  try {
    const resp = await fetch(COINGECKO_URL, {
      headers: {
        "User-Agent": "LatentOcean/1.0 (commercial demo)",
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });
    if (!resp.ok) {
      return NextResponse.json(
        { error: `CoinGecko upstream ${resp.status}` },
        { status: 502 },
      );
    }
    rows = await resp.json();
    if (!Array.isArray(rows)) throw new Error("non-array response");
  } catch (e) {
    return NextResponse.json(
      { error: "CoinGecko unreachable", detail: String(e) },
      { status: 503 },
    );
  }

  const scored = rows.map((r) => {
    const attrs = {
      mcap_bucket: bucket(Math.log10(r.market_cap ?? 1), 0.25),
      vol_bucket: bucket(Math.log10(r.total_volume ?? 1), 0.25),
      h1: bucket(r.price_change_percentage_1h_in_currency ?? 0, 0.25),
      h24: bucket(r.price_change_percentage_24h_in_currency ?? 0, 0.5),
      d7: bucket(r.price_change_percentage_7d_in_currency ?? 0, 1.0),
      ath_frac: bucket((r.current_price ?? 0) / (r.ath ?? 1) || 0, 0.02),
      atl_mult: bucket(Math.log10((r.current_price ?? 1) / (r.atl || 1)), 0.25),
    };
    const fp = fingerprint48(attrs);
    const scores = anomalyScore(fp, getHistory(STREAM));
    pushHistory(STREAM, fp);
    return {
      id: r.id,
      symbol: r.symbol,
      name: r.name,
      price_usd: r.current_price,
      change_1h_pct: r.price_change_percentage_1h_in_currency,
      change_24h_pct: r.price_change_percentage_24h_in_currency,
      change_7d_pct: r.price_change_percentage_7d_in_currency,
      market_cap_usd: r.market_cap,
      total_volume_usd: r.total_volume,
      ath_pct: r.ath && r.current_price ? (r.current_price / r.ath) * 100 : null,
      fingerprint_prefix: fp.slice(0, 16),
      ...scores,
    };
  });

  scored.sort((a, b) => b.composite - a.composite);

  return NextResponse.json({
    source: "CoinGecko top-100 markets",
    source_url: COINGECKO_URL,
    fetched_at: new Date().toISOString(),
    upstream_fetch_ms: Date.now() - t0,
    stream_history_size: historySize(STREAM),
    total_assets: scored.length,
    ranked_top: scored.slice(0, 20),
    primitive: "streaming 48-bit fingerprint + Hamming-isolation + entropy",
    determinism: { seed: 42 },
  });
}
