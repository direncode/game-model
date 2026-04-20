import { NextResponse } from "next/server";
import path from "path";
import { readCachedJson } from "@/lib/artifactCache";

export const dynamic = "force-dynamic";

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const mounted = path.join("/data", "validation", "titan_alien_validation.json");
  const fallback = path.join(repoRoot, "data", "validation", "titan_alien_validation.json");
  try {
    const data = await readCachedJson<any>(mounted, 120_000).catch(() =>
      readCachedJson<any>(fallback, 120_000),
    );
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "titan_alien artifact missing", detail: String(err) },
      { status: 503 },
    );
  }
}
