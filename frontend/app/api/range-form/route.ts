import { NextResponse } from "next/server";
import { startFormation, type FormRequest } from "@/lib/range/form";
import { listModels } from "@/lib/range/store";
import { resolveIdentity, shouldDeny, denyResponse } from "@/lib/range/auth";
import { record as auditRecord } from "@/lib/range/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const id = await resolveIdentity(req);
  if (shouldDeny(id)) {
    await auditRecord({ ts: new Date().toISOString(), actor: id, action: "auth_failed", result: "denied", details: { route: "GET /api/range-form" } }).catch(() => {});
    return denyResponse(id.reason ?? "auth required");
  }
  const models = await listModels({ tenant_id: id.tenant_id });
  await auditRecord({ ts: new Date().toISOString(), actor: id, action: "list", result: "success", details: { count: models.length } }).catch(() => {});
  return NextResponse.json({ models, count: models.length, tenant_id: id.tenant_id }, {
    headers: { "Cache-Control": "no-store", "x-range-tenant": id.tenant_id, "x-range-user": id.user_id },
  });
}

export async function POST(req: Request) {
  const id = await resolveIdentity(req);
  if (shouldDeny(id)) {
    await auditRecord({ ts: new Date().toISOString(), actor: id, action: "auth_failed", result: "denied", details: { route: "POST /api/range-form" } }).catch(() => {});
    return denyResponse(id.reason ?? "auth required");
  }

  let body: FormRequest;
  try { body = (await req.json()) as FormRequest; }
  catch { return NextResponse.json({ error: "invalid json body" }, { status: 400 }); }

  if (!body.corpus_path && !body.corpus_text) {
    return NextResponse.json({ error: "corpus_path or corpus_text required" }, { status: 400 });
  }
  if (body.corpus_text && body.corpus_text.length > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "inline corpus_text capped at 8 MB" }, { status: 413 });
  }

  // Inject identity so the formation tags the model with tenant_id
  body.identity = id;

  try {
    const meta = await startFormation(body);
    return NextResponse.json(meta, {
      headers: {
        "Cache-Control": "no-store",
        "x-range-model-id": meta.id,
        "x-range-fingerprinter": meta.fingerprinter_mode,
        "x-range-effective-strategy": meta.effective_strategy ?? "n/a",
        "x-range-coverage-pct": String(meta.coverage_pct ?? 0),
        "x-range-tenant": id.tenant_id,
        "x-range-encrypted": meta.encrypted ? "1" : "0",
      },
    });
  } catch (e) {
    await auditRecord({
      ts: new Date().toISOString(),
      actor: id,
      action: "form",
      result: "failure",
      details: { detail: String(e) },
    }).catch(() => {});
    return NextResponse.json({ error: "formation failed", detail: String(e) }, { status: 500 });
  }
}
