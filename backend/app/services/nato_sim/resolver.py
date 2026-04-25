"""Entity and claim extraction from raw text.

The resolver is the bridge between unstructured text (briefing book
paragraphs, Discord messages, RSS snippets) and the structured knowledge
graph. It calls Claude with a cached system prompt and returns a typed
``ResolverResult``.

IP: the extraction prompt is subprocess trade secret — it embeds the
specific entity taxonomy and canonicalization rules tuned to the NATO
Simulation scenario. Never log the full prompt or full response; log only
counts + the caller's entity names.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Literal

from app.services.nato_sim.llm import llm_call

logger = logging.getLogger(__name__)

EntityType = Literal["actor", "place", "event", "claim", "system", "region"]


@dataclass(frozen=True)
class ResolvedEntity:
    type: EntityType
    canonical_name: str
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True)
class ResolvedClaim:
    text: str
    about: str
    by: str | None
    confidence: Literal["HIGH", "MEDIUM", "LOW"]


@dataclass(frozen=True)
class ResolverResult:
    entities: list[ResolvedEntity]
    claims: list[ResolvedClaim]


_SYSTEM = """You are an entity resolver for an all-source intelligence workstation covering the NATO Eastern Flank scenario as of April 2030.

Given a text chunk, extract entities and claims. Return STRICT JSON matching this schema exactly:

{
  "entities": [
    {
      "type": "actor" | "place" | "event" | "claim" | "system" | "region",
      "canonical_name": string,
      "aliases": [string, ...]
    }
  ],
  "claims": [
    {
      "text": string,
      "about": string,
      "by": string | null,
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ]
}

Type rules:
- "actor" — states, organizations, named individuals, named military units. Examples: Russia, NATO, Volodymyr Zelenskyy, GRU Spetsnaz.
- "place" — specific discrete locations. Examples: Daugavpils, Brest Belarus, Port of Constanta.
- "region" — named geographic arcs or strategic zones. Examples: Suwałki corridor, Eastern Flank, Black Sea, Baltic Defense Line.
- "event" — named operations, treaties, incidents with temporal scope. Examples: Operation Eastern Sentry, Hague Summit, ZAPAD-26, Operation Midnight Hammer, 1999 Union State treaty.
- "system" — named weapon systems, legal instruments, pieces of infrastructure treated as discrete objects. Examples: Oreshnik IRBM, Patriot interceptors, Montreux Convention, Neptun Deep platform, Article 5.
- "claim" — only use when the text makes an assertion specific enough to be its own node. Otherwise prefer populating the "claims" array instead.

Canonicalization rules:
- "Russian Federation" → "Russia"; "RU" → "Russia"; "Moscow" stays as "Moscow" (place).
- Individuals: full formal name — "Vladimir Putin", "Mojtaba Khamenei".
- Organizations: common English name — "CIA", "NATO", "IRGC".
- Places: modern English toponym — "Daugavpils" (not "Dvinsk"), "Kyiv" (not "Kiev").

Claim rules:
- "about" must be the canonical_name of an entity present in the entities array.
- "by" is the canonical_name of the entity making the claim, or null if unattributed.
- Confidence reflects how strongly the text supports the claim: HIGH = directly stated and specific; MEDIUM = implied or general; LOW = speculative.

If the chunk is empty or contains no resolvable entities, return {"entities": [], "claims": []}.

OUTPUT ONLY THE JSON OBJECT. No prose before or after. No markdown fences."""


def _extract_json(text: str) -> str:
    """Pull the outermost JSON object out of an LLM response.

    Falls back to matching the first `{...}` span if the response is
    wrapped in ``markdown`` fences or prefixed with stray text.
    """
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        return text
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("resolver response contained no JSON object")
    return m.group(0)


async def resolve(text: str) -> ResolverResult:
    """Extract entities and claims from ``text``.

    Returns an empty result on empty or whitespace-only input without
    calling the LLM.
    """
    if not text or not text.strip():
        return ResolverResult(entities=[], claims=[])

    result = await llm_call(
        text,
        system=_SYSTEM,
        model="routine",
        temperature=0.0,
        max_tokens=2048,
        cache_system=True,
    )

    try:
        parsed = json.loads(_extract_json(result.text))
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("resolver: failed to parse JSON (%s); input chars=%d", exc, len(text))
        return ResolverResult(entities=[], claims=[])

    entities: list[ResolvedEntity] = []
    for e in parsed.get("entities", []):
        try:
            entities.append(
                ResolvedEntity(
                    type=e["type"],
                    canonical_name=e["canonical_name"],
                    aliases=tuple(e.get("aliases") or ()),
                )
            )
        except (KeyError, TypeError):
            continue

    claims: list[ResolvedClaim] = []
    for c in parsed.get("claims", []):
        try:
            claims.append(
                ResolvedClaim(
                    text=c["text"],
                    about=c["about"],
                    by=c.get("by"),
                    confidence=c.get("confidence", "MEDIUM"),
                )
            )
        except (KeyError, TypeError):
            continue

    return ResolverResult(entities=entities, claims=claims)
