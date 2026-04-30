import { NextResponse } from "next/server";
import { resolveIdentity, secretKid } from "@/lib/range/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/range-auth/verify
// Probe the current Authorization: Bearer header and return the
// resolved identity (or anonymous) without side-effects. Useful for
// the frontend to confirm a stored token is still valid.
export async function GET(req: Request) {
  const ident = await resolveIdentity(req);
  return NextResponse.json({
    valid: !ident.is_anonymous,
    user_id: ident.user_id,
    tenant_id: ident.tenant_id,
    role: ident.role,
    reason: ident.reason,
    token_kid: ident.token_kid ?? null,
    secret_kid: await secretKid(),
  }, { headers: { "Cache-Control": "no-store" } });
}
