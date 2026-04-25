"""Priority scorer — first of four operator contribution files.

Given a freshly ingested message and the entities it mentions, assign one
of four handling priorities:

    FLASH       — drop everything; warm body must read now
    IMMEDIATE   — read within minutes; high impact
    PRIORITY    — read within the hour; meaningful
    ROUTINE     — stream it; background awareness

Considerations the operator should encode in the heuristic:

    - Which entities are named? Major-actor red line tripped → likely FLASH.
    - Does it contradict a standing Key Judgment? Escalate.
    - Named capability change (new deployment, confirmed strike)? Escalate.
    - Mere repetition of known facts? Routine.
    - Source credibility (gov/official → higher; chatter → lower).

The default implementation below is deliberately naive. **Operator: replace
with your calibrated heuristic before going live.**
"""

from __future__ import annotations

from typing import Literal

Priority = Literal["FLASH", "IMMEDIATE", "PRIORITY", "ROUTINE"]

# Entities whose mention in a fresh message significantly raises priority.
# Operator: tune this list for the specific simulation scenario.
_HIGH_PRIORITY_ACTORS: frozenset[str] = frozenset({
    "Russia",
    "Belarus",
    "Turkey",
    "NATO",
    "Ukraine",
})

# Keywords that are scenario-specific red-line indicators.
# Operator: tune for the AWIS 1 April 2030 posture.
_FLASH_KEYWORDS: tuple[str, ...] = (
    "article 5",
    "article five",
    "suwalki",
    "suwałki",
    "tactical nuclear",
    "oreshnik",
    "nuclear deployment",
    "crossed the border",
    "armed incursion",
)


def score_priority(
    *,
    content: str,
    mentioned_entities: list[str],
) -> Priority:
    """Return the handling priority for a freshly ingested message.

    TODO(operator): replace this body with your calibrated heuristic.
    The defaults below are starter rules.
    """
    text = content.lower()

    # FLASH on scenario-specific red lines.
    if any(keyword in text for keyword in _FLASH_KEYWORDS):
        return "FLASH"

    # IMMEDIATE when multiple major actors are named together.
    high_priority_mentions = sum(
        1 for e in mentioned_entities if e in _HIGH_PRIORITY_ACTORS
    )
    if high_priority_mentions >= 2:
        return "IMMEDIATE"
    if high_priority_mentions >= 1 and len(mentioned_entities) >= 3:
        return "IMMEDIATE"

    # PRIORITY when there's substantive entity mention density.
    if len(mentioned_entities) >= 3:
        return "PRIORITY"

    return "ROUTINE"
