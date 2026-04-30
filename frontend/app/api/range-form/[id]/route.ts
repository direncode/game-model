import { NextResponse } from "next/server";
import { getModel, deleteModel } from "@/lib/range/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/range-form/[id] -> full formed-model artifact
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  if (!id || !/^rng_[a-f0-9]+$/.test(id)) {
    return NextResponse.json({ error: "invalid model id" }, { status: 400 });
  }
  const m = await getModel(id);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(m, {
    headers: {
      "Cache-Control": "no-store",
      "x-range-model-id": m.id,
      "x-range-digest": m.response_digest,
    },
  });
}

// DELETE /api/range-form/[id] -> remove a formed model
export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  if (!id || !/^rng_[a-f0-9]+$/.test(id)) {
    return NextResponse.json({ error: "invalid model id" }, { status: 400 });
  }
  const ok = await deleteModel(id);
  return NextResponse.json({ deleted: ok }, { status: ok ? 200 : 404 });
}
