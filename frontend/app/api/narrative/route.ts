import { NextResponse } from "next/server";
import { enhanceThesis, type CitationBundle } from "@/lib/narrativeClient";
import { generateThesis } from "@/lib/thesisGenerator";
import { resolveEntity } from "@/lib/entityResolver";

// Narrative enhancement endpoint.
//
// POST /api/narrative
// body: { entity_raw, composite, anomaly, reconstruction, diversity,
//         peer_rank?, universe_size?, corpus_id?, corpus_domain?,
//         reproducibility_digest?, null_test?, top_line_concept? }
//
// Returns:
//   {
//     narrative: string,
//     provider: 'ollama'|'anthropic'|'openai'|'off',
//     model: string,
//     citations_ok: boolean,
//     cited_claims: string[],
//     uncited_claims: string[],
//     fallback_used: boolean,
//     template_output: string
//   }
//
// If LO_NARRATIVE_MODE is unset or the LLM fails / hallucinates numbers,
// the endpoint returns the deterministic template as the narrative
// (with fallback_used=true). The substrate stays operational regardless.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let payload: Partial<CitationBundle> = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  if (!payload.entity_raw || payload.composite === undefined) {
    return NextResponse.json(
      { error: "entity_raw and composite are required" },
      { status: 400 },
    );
  }

  const bundle: CitationBundle = {
    entity_raw: payload.entity_raw,
    entity_resolved: payload.entity_resolved,
    composite: Number(payload.composite),
    anomaly: Number(payload.anomaly ?? 0),
    reconstruction: Number(payload.reconstruction ?? 0),
    diversity: Number(payload.diversity ?? 0),
    peer_rank: payload.peer_rank,
    universe_size: payload.universe_size,
    cluster_rank: payload.cluster_rank,
    cluster_size: payload.cluster_size,
    corpus_id: payload.corpus_id,
    corpus_domain: payload.corpus_domain,
    reproducibility_digest: payload.reproducibility_digest,
    null_test: payload.null_test,
    top_line_concept: payload.top_line_concept,
    concept_gloss: payload.concept_gloss,
  };

  // Deterministic fallback first — the narrative layer enhances this.
  const resolved = resolveEntity(bundle.entity_raw);
  const templateOutput = generateThesis({
    resolved,
    composite: bundle.composite,
    anomaly: bundle.anomaly,
    reconstruction: bundle.reconstruction,
    diversity: bundle.diversity,
    peerRank: bundle.peer_rank,
    universeSize: bundle.universe_size,
    clusterRank: bundle.cluster_rank,
    clusterSize: bundle.cluster_size,
    corpusDomain: bundle.corpus_domain,
  });

  const result = await enhanceThesis(bundle, templateOutput);
  return NextResponse.json(result);
}

// Quick GET for smoke testing: returns the mode + a sample bundle's
// narrative so a curl against /api/narrative confirms the plumbing.
export async function GET() {
  const sample: CitationBundle = {
    entity_raw: "fact_4904_AssetRetirementObligation",
    entity_resolved: "AMERICAN ELECTRIC POWER CO INC · Asset Retirement Obligation",
    composite: 0.859,
    anomaly: 1.0,
    reconstruction: 0.804,
    diversity: 0.815,
    peer_rank: 1,
    universe_size: 642,
    corpus_id: "edgar_5000",
    corpus_domain: "SEC EDGAR financial filings",
    top_line_concept: "AssetRetirementObligation",
    concept_gloss:
      "decommissioning-estimate line — audit-sensitive and prone to material revision",
    null_test: { z_score: 30.37, p_value: "< 0.001", iterations: 500 },
    reproducibility_digest:
      "78a54094d6f2c460abcdef0123456789abcdef0123456789abcdef0123456789",
  };
  const resolved = resolveEntity(sample.entity_raw);
  const templateOutput = generateThesis({
    resolved,
    composite: sample.composite,
    anomaly: sample.anomaly,
    reconstruction: sample.reconstruction,
    diversity: sample.diversity,
    peerRank: sample.peer_rank,
    universeSize: sample.universe_size,
    corpusDomain: sample.corpus_domain,
  });
  const result = await enhanceThesis(sample, templateOutput);
  return NextResponse.json({ sample_bundle: sample, ...result });
}
