import { NextResponse } from "next/server";
import { startFormation, type FormRequest } from "@/lib/range/form";
import { listModels } from "@/lib/range/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/range-form -> list of all formed models (meta only)
export async function GET() {
  const models = await listModels();
  return NextResponse.json({ models, count: models.length }, {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST /api/range-form -> form a model from a corpus_path or corpus_text
//   body: { corpus_path?, corpus_text?, corpus_filename_hint?, name?, use_runpod? }
export async function POST(req: Request) {
  let body: FormRequest;
  try { body = (await req.json()) as FormRequest; }
  catch { return NextResponse.json({ error: "invalid json body" }, { status: 400 }); }

  if (!body.corpus_path && !body.corpus_text) {
    return NextResponse.json({ error: "corpus_path or corpus_text required" }, { status: 400 });
  }
  if (body.corpus_text && body.corpus_text.length > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "inline corpus_text capped at 8 MB" }, { status: 413 });
  }

  try {
    const meta = await startFormation(body);
    return NextResponse.json(meta, {
      headers: {
        "Cache-Control": "no-store",
        "x-range-model-id": meta.id,
        "x-range-fingerprinter": meta.fingerprinter_mode,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "formation failed", detail: String(e) }, { status: 500 });
  }
}
