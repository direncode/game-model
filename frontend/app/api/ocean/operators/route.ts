import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OCEAN_API_BASE = process.env.OCEAN_API_BASE || "http://ocean_api:8000";

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization");
    const r = await fetch(`${OCEAN_API_BASE}/v1/operators`, {
      headers: { ...(auth ? { Authorization: auth } : {}) },
      cache:   "no-store",
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
