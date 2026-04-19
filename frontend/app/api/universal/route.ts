import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Universality endpoint: reads data/validation/universal_validation.json
// emitted by scripts/universal_validation.py. Every corpus is processed
// with identical primitives — no corpus-specific knobs anywhere.
export const dynamic = "force-dynamic";

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const target = path.join(repoRoot, "data", "validation", "universal_validation.json");
  try {
    const raw = await fs.readFile(target, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "universal validation artifact missing", path: target, detail: String(err) },
      { status: 503 },
    );
  }
}
