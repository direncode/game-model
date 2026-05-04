import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;  // up to 5 min for /v1/run

const OCEAN_API_BASE = process.env.OCEAN_API_BASE || "http://ocean_api:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const auth = req.headers.get("authorization");
    const r = await fetch(`${OCEAN_API_BASE}/v1/run`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body:    JSON.stringify(body),
      cache:   "no-store",
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
