"""Dissent trigger — third of four operator contribution files.

INR's signature move is the Alternative View — a footnoted dissent attached
to an otherwise assertive analytical product. This function decides when
the system must generate one alongside a primary finding. If ``required``
is True, the synthesizer is obligated to produce a dissent block.

Common triggers the operator should encode:

    - Key claim rests on a single source
    - Confidence is LOW on a consequential claim
    - ≥2 sources conflict materially on the specific claim
    - Finding contradicts a recent standing Key Judgment
    - Finding rests on inference rather than direct reporting

The default below is deliberately naive. **Operator: replace with your
calibrated rule before going live.**
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DissentCheck:
    required: bool
    reasons: list[str] = field(default_factory=list)


def needs_dissent(
    *,
    confidence: str,
    source_count: int,
    conflicting_sources: int = 0,
    contradicts_standing_kj: bool = False,
    relies_on_inference: bool = False,
) -> DissentCheck:
    """Return whether an Alternative View block must accompany this finding.

    TODO(operator): replace this body with your calibrated rule.
    The defaults below are starter triggers.
    """
    reasons: list[str] = []

    if source_count <= 1:
        reasons.append("single-source key claim")
    if confidence == "LOW":
        reasons.append("low-confidence finding on a consequential claim")
    if conflicting_sources >= 1:
        reasons.append(f"material conflict across {conflicting_sources} source(s)")
    if contradicts_standing_kj:
        reasons.append("contradicts standing Key Judgment")
    if relies_on_inference and confidence != "HIGH":
        reasons.append("rests on analytic inference, not direct reporting")

    return DissentCheck(required=bool(reasons), reasons=reasons)
