import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Universal validation endpoint: reads the source-of-truth artifact emitted by
// scripts/commercial_validation.py. Zero hardcoded numbers in the UI layer —
// the page just renders whatever the latest validation run produced.
export const dynamic = "force-dynamic";

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const target = path.join(repoRoot, "data", "validation", "commercial_validation.json");
  try {
    const raw = await fs.readFile(target, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "validation artifact missing", path: target, detail: String(err) },
      { status: 503 },
    );
  }
}
