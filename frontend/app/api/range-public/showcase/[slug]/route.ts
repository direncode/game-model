import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { modelsRoot } from "@/lib/range/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public, no-auth endpoint that serves a precomputed showcase artifact.
//
// Showcases are formed models we publish for external verification. The
// underlying tenant remains tenant-scoped on the appliance; this endpoint
// reads only the precomputed analysis JSON (corpus sha256, response_digest,
// persistence bars, cluster purity, decade trajectory, named rare records),
// not the survivor fingerprints themselves.
//
// Slugs are explicitly allowlisted to prevent path-traversal and to keep
// the contract narrow.

const ALLOWED: Record<string, string> = {
  docsouth:                  "docsouth.json",
  "docsouth-constellations": "docsouth_constellations.json",
  "docsouth-findings":       "docsouth_findings.json",
  atlas:                     "arxiv.json",
  "atlas-constellations":    "arxiv_constellations.json",
  "atlas-findings":          "atlas_findings.json",
  pulse:                     "uspto.json",
  "pulse-constellations":    "uspto_constellations.json",
  "pulse-findings":          "pulse_findings.json",
  receipt:                   "sec_edgar.json",
  "receipt-chain":           "sec_edgar_chain.json",
};

export async function GET(_req: Request, ctx: { params: { slug: string } }) {
  const slug = ctx.params.slug;
  const filename = ALLOWED[slug];
  if (!filename) {
    return NextResponse.json({ error: "showcase not found", slug }, { status: 404 });
  }
  const file = path.join(modelsRoot(), "_public", filename);
  try {
    const data = await fs.readFile(file, "utf-8");
    return new NextResponse(data, {
      headers: {
        "Content-Type":  "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "x-range-showcase": slug,
        "x-range-public":   "1",
      },
    });
  } catch (e) {
    return NextResponse.json({
      error: "showcase data unavailable",
      slug,
      hint: "the showcase artifact has not been generated yet",
    }, { status: 503 });
  }
}
