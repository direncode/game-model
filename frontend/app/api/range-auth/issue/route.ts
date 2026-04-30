import { NextResponse } from "next/server";
import { issueToken, resolveIdentity, requireRole, secretKid, type Role } from "@/lib/range/auth";
import { record as auditRecord } from "@/lib/range/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/range-auth/issue
//   body: { user_id, tenant_id, role?, ttl_hours? }
// Caller must be admin (master admin token or admin-role issued token).
export async function POST(req: Request) {
  const ident = await resolveIdentity(req);
  if (!requireRole(ident, "admin")) {
    await auditRecord({ ts: new Date().toISOString(), actor: ident, action: "auth_failed", result: "denied", details: { route: "POST /api/range-auth/issue", reason: "not-admin" } }).catch(() => {});
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }

  let body: { user_id?: string; tenant_id?: string; role?: Role; ttl_hours?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!body.user_id || !body.tenant_id) return NextResponse.json({ error: "user_id and tenant_id required" }, { status: 400 });

  const out = await issueToken({
    user_id: body.user_id, tenant_id: body.tenant_id,
    role: body.role ?? "operator",
    ttl_hours: body.ttl_hours,
  });

  await auditRecord({
    ts: new Date().toISOString(), actor: ident, action: "form",
    details: { kind: "issue_token", subject_user: body.user_id, subject_tenant: body.tenant_id, role: body.role ?? "operator", ttl_hours: body.ttl_hours ?? 720 },
    result: "success",
  }).catch(() => {});

  return NextResponse.json({
    token: out.token,
    kid: out.kid,
    exp: new Date(out.exp).toISOString(),
    secret_kid: await secretKid(),
    note: "Pass this token in Authorization: Bearer <token> on /api/range-* calls. Single-use? No — use the appliance to revoke a tenant by changing RANGE_AUTH_SECRET (rotates all tokens).",
  }, { headers: { "Cache-Control": "no-store" } });
}
