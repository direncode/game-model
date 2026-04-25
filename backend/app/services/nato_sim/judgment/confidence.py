"""Confidence calibrator — second of four operator contribution files.

Given a finding's evidence set, decide whether to attach HIGH, MEDIUM, or
LOW confidence. This is the call that INR is famous for getting right when
other agencies hedge — the "we assess" qualifier carries real weight
because INR stakes its reputation on the number-of-fingers-in-the-air
discipline.

Dimensions the operator should weigh in the heuristic:

    - Source count (single vs multiple independent lines of reporting)
    - Source tier (institutional/government vs think-tank vs news vs chatter)
    - Quote directness (verbatim quote vs analytic inference)
    - Temporal freshness (today vs weeks old)
    - Internal consistency (do sources agree on the specific claim?)

The default below is deliberately naive. **Operator: replace with your
calibrated rule before going live.**
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Confidence = Literal["HIGH", "MEDIUM", "LOW"]


@dataclass(frozen=True)
class EvidenceItem:
    """One piece of evidence supporting a finding.

    ``tier`` mirrors the corpus-doc tier: 1 = institutional/government,
    2 = major think tank, 3 = high-quality news, 4 = chatter/anonymous.
    """

    source: str
    tier: int = 2
    is_direct_quote: bool = False
    conflicts_with_others: bool = False


def calibrate(evidence: list[EvidenceItem]) -> Confidence:
    """Return a confidence band for a finding given its evidence set.

    TODO(operator): replace this body with your calibrated heuristic.
    The defaults below are starter rules.
    """
    if not evidence:
        return "LOW"

    # Count distinct source handles (loose uniqueness check on the
    # leading identifier of the source string).
    distinct = len({item.source.split(" ")[0] for item in evidence})
    has_institutional = any(item.tier == 1 for item in evidence)
    has_conflicts = any(item.conflicts_with_others for item in evidence)

    # Downgrade when sources contradict.
    if has_conflicts and distinct <= 2:
        return "LOW"

    # HIGH requires multiple distinct sources AND at least one institutional.
    if distinct >= 3 and has_institutional:
        return "HIGH"

    # MEDIUM for reasonable multi-source triangulation.
    if distinct >= 2:
        return "MEDIUM"

    return "LOW"
