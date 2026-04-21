/**
 * Narrative enhancement client — LLM-provider-agnostic.
 *
 * The substrate is deterministic. The narrative layer is optional and
 * explicitly non-deterministic; it sits *above* the substrate and adds
 * explanation quality without touching reproducibility.
 *
 * Three deployment modes, chosen by environment:
 *
 *   LO_NARRATIVE_MODE=ollama    (default for air-gap / on-prem)
 *     -> POSTs to LO_OLLAMA_URL (default http://localhost:11434)
 *     -> uses LO_OLLAMA_MODEL    (default 'llama3.1:8b-instruct')
 *
 *   LO_NARRATIVE_MODE=anthropic (hosted SaaS tier)
 *     -> uses ANTHROPIC_API_KEY
 *     -> uses LO_ANTHROPIC_MODEL (default 'claude-sonnet-4-20250522')
 *
 *   LO_NARRATIVE_MODE=openai    (hosted alternative)
 *     -> uses OPENAI_API_KEY
 *     -> uses LO_OPENAI_MODEL    (default 'gpt-4o-mini')
 *
 *   LO_NARRATIVE_MODE=off or unset
 *     -> enhanceThesis() returns null; callers fall back to the
 *        deterministic template in thesisGenerator.ts
 *
 * Every call requires a citation bundle: the fingerprint, score vector,
 * corpus context, and reproducibility digest that ground the
 * generation. The prompt template forbids the LLM from introducing
 * claims that aren't grounded in the bundle. If the LLM output cites
 * something outside the bundle, `validateCitations()` flags it for the
 * caller to reject.
 */

export type LLMProvider = "ollama" | "anthropic" | "openai" | "off";

export type CitationBundle = {
  // Raw substrate facts. The LLM is ONLY allowed to narrate these.
  entity_raw: string;
  entity_resolved?: string;
  composite: number;
  anomaly: number;
  reconstruction: number;
  diversity: number;
  peer_rank?: number;
  universe_size?: number;
  cluster_rank?: number;
  cluster_size?: number;
  corpus_id?: string;
  corpus_domain?: string;
  reproducibility_digest?: string;
  null_test?: {
    z_score?: number;
    p_value?: string;
    iterations?: number;
  };
  top_line_concept?: string;
  concept_gloss?: string;
};

export type NarrativeResult = {
  narrative: string;
  provider: LLMProvider;
  model?: string;
  cited_claims: string[];
  uncited_claims: string[];
  citations_ok: boolean;
  generated_at: string;
  // Falls back to the template if the LLM is unavailable or fails.
  fallback_used?: boolean;
  template_output?: string;
};

const PROMPT_SYSTEM = `You are a narrative-enhancement layer on top of a deterministic data-analysis substrate. Your ONLY job is to produce a 2–3 sentence analyst-grade explanation of a finding, using ONLY the facts provided in the citation bundle.

STRICT RULES:
1. Do NOT introduce any fact, number, entity, event, or context that is not in the bundle. Every claim must trace to a bundle field.
2. Do NOT speculate about causation, motive, or external events.
3. Do NOT use marketing language ("unprecedented", "groundbreaking", etc).
4. Write in the tone of a senior research analyst explaining a finding to a colleague.
5. Cite the composite score, dimension scores, and rank explicitly when relevant.
6. If the concept has a domain gloss, weave it in naturally.
7. 2–3 sentences. No bullet points. No headers.

OUTPUT FORMAT: prose only, no preamble, no "Here is..." prefix.`;

function buildUserPrompt(b: CitationBundle): string {
  const lines = [
    `entity_raw: ${b.entity_raw}`,
    b.entity_resolved ? `entity_resolved: ${b.entity_resolved}` : "",
    `composite: ${b.composite.toFixed(3)}`,
    `anomaly: ${b.anomaly.toFixed(3)}`,
    `reconstruction: ${b.reconstruction.toFixed(3)}`,
    `diversity: ${b.diversity.toFixed(3)}`,
    b.peer_rank && b.universe_size
      ? `peer_rank: ${b.peer_rank} of ${b.universe_size}`
      : "",
    b.cluster_rank && b.cluster_size
      ? `cluster_rank: ${b.cluster_rank} of ${b.cluster_size}`
      : "",
    b.corpus_id ? `corpus_id: ${b.corpus_id}` : "",
    b.corpus_domain ? `corpus_domain: ${b.corpus_domain}` : "",
    b.top_line_concept ? `top_line_concept: ${b.top_line_concept}` : "",
    b.concept_gloss ? `concept_gloss: ${b.concept_gloss}` : "",
    b.null_test?.z_score
      ? `null_test_z_score: ${b.null_test.z_score.toFixed(2)}`
      : "",
    b.null_test?.p_value ? `null_test_p_value: ${b.null_test.p_value}` : "",
    b.reproducibility_digest
      ? `reproducibility_digest: ${b.reproducibility_digest.slice(0, 16)}…`
      : "",
  ].filter(Boolean);
  return `FACTS AVAILABLE:\n${lines.join("\n")}\n\nWrite the 2-3 sentence analyst explanation now.`;
}

function getMode(): LLMProvider {
  const m = (process.env.LO_NARRATIVE_MODE || "off").toLowerCase();
  if (m === "ollama" || m === "anthropic" || m === "openai") return m;
  return "off";
}

async function callOllama(system: string, user: string): Promise<string> {
  const url = process.env.LO_OLLAMA_URL || "http://localhost:11434";
  const model = process.env.LO_OLLAMA_MODEL || "llama3.1:8b-instruct";
  const resp = await fetch(`${url.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      options: { temperature: 0.2 },
    }),
  });
  if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
  const j = await resp.json();
  return (j?.message?.content || "").trim();
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const model = process.env.LO_ANTHROPIC_MODEL || "claude-sonnet-4-20250522";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      system,
      messages: [{ role: "user", content: user }],
      temperature: 0.2,
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}`);
  const j = await resp.json();
  return (j?.content?.[0]?.text || "").trim();
}

async function callOpenAI(system: string, user: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.LO_OPENAI_MODEL || "gpt-4o-mini";
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 256,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
  const j = await resp.json();
  return (j?.choices?.[0]?.message?.content || "").trim();
}

/**
 * Check that every substantive numeric claim in the narrative appears
 * in the citation bundle. This is a coarse "has the LLM fabricated
 * numbers?" check. Returns the set of numbers the narrative uses that
 * are NOT in the bundle; callers can treat a non-empty result as a
 * reason to reject the output and fall back to the template.
 */
export function validateCitations(
  narrative: string,
  bundle: CitationBundle,
): { cited: string[]; uncited: string[]; ok: boolean } {
  const numbersInBundle = new Set<string>();
  const addNum = (n: number | undefined) => {
    if (typeof n !== "number") return;
    numbersInBundle.add(n.toFixed(2));
    numbersInBundle.add(n.toFixed(3));
    numbersInBundle.add(Math.round(n).toString());
    // Percent interpretation of [0,1] scores
    if (n >= 0 && n <= 1) numbersInBundle.add(Math.round(n * 100).toString());
  };
  addNum(bundle.composite);
  addNum(bundle.anomaly);
  addNum(bundle.reconstruction);
  addNum(bundle.diversity);
  if (bundle.peer_rank) numbersInBundle.add(String(bundle.peer_rank));
  if (bundle.universe_size) numbersInBundle.add(String(bundle.universe_size));
  if (bundle.cluster_rank) numbersInBundle.add(String(bundle.cluster_rank));
  if (bundle.cluster_size) numbersInBundle.add(String(bundle.cluster_size));
  if (bundle.null_test?.z_score) addNum(bundle.null_test.z_score);
  if (bundle.null_test?.iterations)
    numbersInBundle.add(String(bundle.null_test.iterations));

  const found: string[] = narrative.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const cited: string[] = [];
  const uncited: string[] = [];
  for (const raw of found) {
    // Allow year-like tokens (2020-2030) as contextual, not fabricated
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    if (Number.isInteger(n) && n >= 1900 && n <= 2100) continue;
    if (numbersInBundle.has(raw)) cited.push(raw);
    else uncited.push(raw);
  }
  return { cited, uncited, ok: uncited.length === 0 };
}

export async function enhanceThesis(
  bundle: CitationBundle,
  fallbackTemplate: string,
): Promise<NarrativeResult> {
  const mode = getMode();
  const now = new Date().toISOString();

  if (mode === "off") {
    return {
      narrative: fallbackTemplate,
      provider: "off",
      cited_claims: [],
      uncited_claims: [],
      citations_ok: true,
      generated_at: now,
      fallback_used: true,
      template_output: fallbackTemplate,
    };
  }

  try {
    const system = PROMPT_SYSTEM;
    const user = buildUserPrompt(bundle);
    let text = "";
    let model: string | undefined;
    if (mode === "ollama") {
      text = await callOllama(system, user);
      model = process.env.LO_OLLAMA_MODEL || "llama3.1:8b-instruct";
    } else if (mode === "anthropic") {
      text = await callAnthropic(system, user);
      model = process.env.LO_ANTHROPIC_MODEL || "claude-sonnet-4-20250522";
    } else if (mode === "openai") {
      text = await callOpenAI(system, user);
      model = process.env.LO_OPENAI_MODEL || "gpt-4o-mini";
    }

    const validation = validateCitations(text, bundle);
    // Reject if the LLM cited uncited numbers — fall back to template.
    if (!validation.ok || !text) {
      return {
        narrative: fallbackTemplate,
        provider: mode,
        model,
        cited_claims: validation.cited,
        uncited_claims: validation.uncited,
        citations_ok: false,
        generated_at: now,
        fallback_used: true,
        template_output: fallbackTemplate,
      };
    }

    return {
      narrative: text,
      provider: mode,
      model,
      cited_claims: validation.cited,
      uncited_claims: validation.uncited,
      citations_ok: true,
      generated_at: now,
      fallback_used: false,
      template_output: fallbackTemplate,
    };
  } catch (err) {
    // Any failure -> fall back to deterministic template. The substrate
    // stays fully operational; the narrative layer degrades gracefully.
    return {
      narrative: fallbackTemplate,
      provider: mode,
      cited_claims: [],
      uncited_claims: [],
      citations_ok: true,
      generated_at: now,
      fallback_used: true,
      template_output: fallbackTemplate,
    };
  }
}
