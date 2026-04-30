import { NextResponse } from "next/server";
import { listEvents, toCEF, toOCSF } from "@/lib/range/audit";
import { resolveIdentity, shouldDeny, denyResponse } from "@/lib/range/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/range-audit
//   ?format=json (default) | cef | ocsf
//   ?since=YYYY-MM-DD
//   ?until=YYYY-MM-DD
//   ?limit=N (default 200, max 5000)
export async function GET(req: Request) {
  const ident = await resolveIdentity(req);
  if (shouldDeny(ident)) return denyResponse(ident.reason ?? "auth required");
  const url = new URL(req.url);
  const fmt = (url.searchParams.get("format") || "json").toLowerCase();
  const since = url.searchParams.get("since") || undefined;
  const until = url.searchParams.get("until") || undefined;
  const limitN = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit")) || 200));

  const events = await listEvents({ tenant_id: ident.tenant_id, since, until, limit: limitN });

  if (fmt === "cef") {
    const body = events.map(toCEF).join("\n") + "\n";
    return new Response(body, {
      headers: { "Content-Type": "text/x-cef", "Content-Disposition": "attachment; filename=\"range-audit.cef\"" },
    });
  }
  if (fmt === "ocsf") {
    return NextResponse.json({
      events: events.map(toOCSF),
      meta: { generated_at: new Date().toISOString(), tenant_id: ident.tenant_id, count: events.length, since, until },
    }, {
      headers: { "Content-Disposition": "attachment; filename=\"range-audit.ocsf.json\"" },
    });
  }
  return NextResponse.json({
    events,
    meta: { generated_at: new Date().toISOString(), tenant_id: ident.tenant_id, count: events.length, since, until, limit: limitN },
  }, { headers: { "Cache-Control": "no-store", "x-range-tenant": ident.tenant_id } });
}
