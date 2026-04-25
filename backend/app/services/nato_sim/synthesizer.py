"""Prose generation — turns a structured finding into INR-voice product.

The synthesizer is the final step of the pipeline: given a topic, a list
of evidence items, and a target confidence, it calls Claude with the
operator-calibrated INR voice system prompt and returns a BLUF-led,
paragraph-numbered, portion-marked, citation-bearing analytical product.

IP: the system prompt is trade-secret subprocess (lives in
``judgment/inr_voice.py``). This file is the plumbing around it.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

from app.services.nato_sim.judgment import get_inr_voice
from app.services.nato_sim.llm import llm_call

logger = logging.getLogger(__name__)

FindingKind = Literal[
    "daily-read",
    "key-judgment",
    "actor-card",
    "watchboard-item",
    "dissent",
    "sitrep",
    "assessment",
    "brief-dni",
    "brief-potus",
    "hidden-connection",
]

Confidence = Literal["HIGH", "MEDIUM", "LOW"]


@dataclass(frozen=True)
class EvidenceItem:
    text: str
    source: str  # e.g. "briefing ¶287", "CSIS 2024-05", "discord:control-9"


@dataclass(frozen=True)
class SynthesizeInput:
    kind: FindingKind
    topic: str
    evidence: list[EvidenceItem]
    confidence: Confidence
    extra_instructions: str | None = None
    use_deep_model: bool = False


# Per-kind scaffolding appended to the INR voice. Each describes the
# *shape* of the product; the voice prompt describes the *tone*.
_KIND_SCAFFOLD: dict[FindingKind, str] = {
    "daily-read": (
        "Produce a Daily Read. Open with BLUF. "
        "Follow with 3 to 5 numbered Key Judgments. "
        "Each Key Judgment: one assertive sentence plus a two-sentence "
        "supporting block with portion markers and citations. "
        "End with a 'HIDDEN CONNECTIONS' note only if the evidence "
        "reveals a non-obvious link."
    ),
    "key-judgment": (
        "Produce a single Key Judgment in the INR Morning Book format. "
        "BLUF (one sentence), then 2-3 supporting numbered paragraphs."
    ),
    "actor-card": (
        "Produce a Country/Actor Card. Required sections (in order, "
        "each as a numbered paragraph):\n"
        "  1. BLUF — this actor's current posture in one sentence\n"
        "  2. POSITIONS — declared positions on the active scenario\n"
        "  3. INTENT — assessed near-term intent (with hedges)\n"
        "  4. CAPABILITIES — relevant capability posture\n"
        "  5. RED LINES — what would trigger escalation\n"
        "  6. WILDCARDS — off-ramp or surprise factors"
    ),
    "watchboard-item": (
        "Produce a single Watchboard line. One sentence stating the "
        "indicator, a color-code recommendation (RED/AMBER/GREEN), "
        "and the observable that would promote or demote the status."
    ),
    "dissent": (
        "Produce an Alternative View block. Begin with 'ALTERNATIVE VIEW:'. "
        "Lay out the competing interpretation in 2-3 numbered paragraphs. "
        "Explicitly note what evidence would make the alternative view "
        "more likely than the baseline."
    ),
    "sitrep": (
        "Produce a current-posture Situation Report. BLUF, then numbered "
        "paragraphs in order: WHAT (events since last SITREP), SO WHAT "
        "(implications), NEXT (what to watch for). End with CONFIDENCE."
    ),
    "assessment": (
        "Produce a formal analytical assessment. BLUF, 3-5 numbered "
        "Key Judgments, an Alternative View block, and a CONFIDENCE line."
    ),
    "brief-dni": (
        "Produce a DNI-ready briefing card. Maximum 400 words. BLUF, "
        "3 Key Judgments, one dissent footnote if warranted. "
        "Assume the reader is Jack Barr; he is about to brief the President."
    ),
    "brief-potus": (
        "Produce a POTUS-ready BLUF card. Maximum 200 words. One BLUF "
        "sentence, up to 3 bullet judgments each under 20 words, one "
        "action-relevant wildcard. Assume the reader is the President; "
        "he reads this in under 60 seconds."
    ),
    "hidden-connection": (
        "Produce a Hidden Connection note. BLUF states the non-obvious "
        "link in one sentence. One supporting paragraph traces the path. "
        "One paragraph states the analytic implication."
    ),
}


def _format_evidence(evidence: list[EvidenceItem]) -> str:
    if not evidence:
        return "[no evidence supplied — state this explicitly in the product]"
    return "\n".join(
        f"[E{i + 1}] {item.text}  (src: {item.source})"
        for i, item in enumerate(evidence)
    )


async def synthesize(inp: SynthesizeInput) -> str:
    """Return an INR-voice analytical product for the given input."""
    scaffold = _KIND_SCAFFOLD.get(inp.kind, "")
    system_prompt = get_inr_voice() + "\n\n" + scaffold
    if inp.extra_instructions:
        system_prompt = system_prompt + "\n\nAdditional instructions:\n" + inp.extra_instructions

    user = (
        f"Topic: {inp.topic}\n\n"
        f"Evidence:\n{_format_evidence(inp.evidence)}\n\n"
        f"Target confidence baseline: {inp.confidence}\n\n"
        f"Produce the {inp.kind} now."
    )

    result = await llm_call(
        user,
        system=system_prompt,
        model="deep" if inp.use_deep_model else "routine",
        temperature=0.2,
        max_tokens=1500,
        cache_system=True,
    )
    return result.text.strip()
