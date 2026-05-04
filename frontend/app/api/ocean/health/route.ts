import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OCEAN_API_BASE = process.env.OCEAN_API_BASE || "http://ocean_api:8000";

export async function GET() {
  try {
    const r = await fetch(`${OCEAN_API_BASE}/v1/health`, { cache: "no-store" });
    if (!r.ok) return NextResponse.json({ ok: false, status: r.status }, { status: 503 });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 503 });
  }
}
