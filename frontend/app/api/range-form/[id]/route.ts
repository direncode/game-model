import { NextResponse } from "next/server";
import { getModel, deleteModel } from "@/lib/range/store";
import { resolveIdentity, shouldDeny, denyResponse } from "@/lib/range/auth";
import { record as auditRecord } from "@/lib/range/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const ident = await resolveIdentity(req);
  if (shouldDeny(ident)) return denyResponse(ident.reason ?? "auth required");
  const id = ctx.params.id;
  if (!id || !/^rng_[a-f0-9]+$/.test(id)) return NextResponse.json({ error: "invalid model id" }, { status: 400 });

  const m = await getModel(id, ident.tenant_id);
  if (!m) {
    await auditRecord({ ts: new Date().toISOString(), actor: ident, action: "list", resource: { kind: "model", id }, result: "denied", details: { reason: "not found or wrong tenant" } }).catch(() => {});
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(m, {
    headers: {
      "Cache-Control": "no-store",
      "x-range-model-id": m.id,
      "x-range-digest": m.response_digest,
      "x-range-tenant": ident.tenant_id,
      "x-range-coverage-pct": String(m.coverage_pct ?? 0),
      "x-range-effective-strategy": m.effective_strategy ?? "n/a",
    },
  });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const ident = await resolveIdentity(req);
  if (shouldDeny(ident)) return denyResponse(ident.reason ?? "auth required");
  const id = ctx.params.id;
  if (!id || !/^rng_[a-f0-9]+$/.test(id)) return NextResponse.json({ error: "invalid model id" }, { status: 400 });

  const m = await getModel(id, ident.tenant_id);
  if (!m) return NextResponse.json({ error: "not found or wrong tenant" }, { status: 404 });
  const ok = await deleteModel(id, ident.tenant_id);
  await auditRecord({
    ts: new Date().toISOString(),
    actor: ident, action: "delete",
    resource: { kind: "model", id, name: m.name },
    result: ok ? "success" : "failure",
  }).catch(() => {});
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404 });
}
