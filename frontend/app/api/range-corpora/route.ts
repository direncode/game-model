import { NextResponse } from "next/server";
import { listBuiltinCorpora } from "@/lib/range/form";
import { isRunPodAvailable } from "@/lib/range/runpod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/range-corpora -> list available built-in corpora the appliance
// can read directly, plus capability flags so the UI can render an
// honest picker.
export async function GET() {
  const corpora = await listBuiltinCorpora();
  return NextResponse.json({
    corpora,
    capabilities: {
      runpod_available: isRunPodAvailable(),
      btut_bridge_url: process.env.BTUT_BRIDGE_URL || null,
      formed_models_dir: process.env.FORMED_MODELS_DIR || "/data/formed_models",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
