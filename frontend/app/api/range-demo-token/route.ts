import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { issueToken } from "@/lib/range/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/range-demo-token
//   body: { color?: string }
// Issues a short-lived (1h) viewer/operator token for a SCOPED demo tenant.
// The tenant_id is forced to start with "demo_" and includes a random suffix
// so two browsers never collide. This is the only auth route an anonymous
// caller may hit. Used by /method's MultiTenantSplitWidget to mint two
// distinct demo identities in the same browser, proving real cross-tenant
// isolation against the same backend.
export async function POST(req: Request) {
  let body: { color?: string } = {};
  try { body = await req.json(); } catch { /* tolerate empty body */ }
  const color = (body.color || "x").toString().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "x";
  const rand = crypto.randomBytes(4).toString("hex");
  const tenant_id = `demo_${color}_${rand}`;
  const user_id = `demo_${color}_user_${rand}`;
  const out = await issueToken({
    user_id,
    tenant_id,
    role: "operator",          // operator can form, query, list within their tenant
    ttl_hours: 1,              // tight TTL — demo lives in the browser tab
  });
  return NextResponse.json({
    token: out.token,
    kid: out.kid,
    tenant_id,
    user_id,
    exp: new Date(out.exp).toISOString(),
    note: "Scoped demo token. Tenant prefix: demo_. TTL: 1 hour. Issued anonymously for /method demonstrations only.",
  }, { headers: { "Cache-Control": "no-store" } });
}
