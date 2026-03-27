"""Multi-user consensus tracking for challenge resolution.

Tracks votes on challenges, computes consensus scores,
and auto-escalates when agreement cannot be reached.
"""

from __future__ import annotations

import logging
import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import Challenge, ChallengeComment

logger = logging.getLogger(__name__)

# Minimum votes required before computing consensus
_MIN_VOTES_FOR_CONSENSUS = 3

# Threshold above which consensus is considered reached
_CONSENSUS_THRESHOLD = 0.67

# Maximum rounds before auto-escalation
_MAX_ROUNDS = 5


@dataclass
class Vote:
    """A single vote on a challenge."""

    voter_id: str
    position: str  # "agree", "disagree", "abstain"
    reasoning: str | None = None
    voted_at: str = ""


@dataclass
class ConsensusReport:
    """Consensus status for a challenge."""

    challenge_id: str
    total_votes: int
    agree_count: int
    disagree_count: int
    abstain_count: int
    consensus_score: float  # 0-1, where 1 is full agreement
    consensus_reached: bool
    majority_position: str | None  # "agree" or "disagree"
    needs_escalation: bool
    round_number: int


class ConsensusEngine:
    """Track votes and compute consensus for challenge resolution.

    Votes are stored in the challenge's evidence JSONB field as a
    'votes' array to keep all consensus data with the challenge record.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def cast_vote(
        self,
        challenge_id: uuid.UUID,
        voter_id: uuid.UUID,
        position: str,
        reasoning: str | None = None,
    ) -> Vote:
        """Cast or update a vote on a challenge.

        Args:
            challenge_id: UUID of the challenge.
            voter_id: UUID of the voting user.
            position: "agree", "disagree", or "abstain".
            reasoning: Optional explanation.

        Returns:
            The recorded Vote.

        Raises:
            ValueError: If challenge not found or position is invalid.
        """
        if position not in ("agree", "disagree", "abstain"):
            raise ValueError(
                f"Invalid position: {position}. Must be agree/disagree/abstain."
            )

        result = await self._db.execute(
            select(Challenge).where(Challenge.id == challenge_id)
        )
        challenge = result.scalar_one_or_none()
        if challenge is None:
            raise ValueError(f"Challenge {challenge_id} not found")

        if challenge.status not in ("open", "under_review"):
            raise ValueError(
                f"Cannot vote on challenge with status '{challenge.status}'"
            )

        vote = Vote(
            voter_id=str(voter_id),
            position=position,
            reasoning=reasoning,
            voted_at=datetime.now(timezone.utc).isoformat(),
        )

        # Store in evidence JSONB
        evidence = challenge.evidence or {}
        votes: list[dict] = evidence.get("votes", [])

        # Replace existing vote from same voter
        votes = [v for v in votes if v.get("voter_id") != str(voter_id)]
        votes.append({
            "voter_id": vote.voter_id,
            "position": vote.position,
            "reasoning": vote.reasoning,
            "voted_at": vote.voted_at,
        })

        evidence["votes"] = votes

        # Update status to under_review if first vote
        new_status = challenge.status
        if challenge.status == "open" and len(votes) >= 1:
            new_status = "under_review"

        await self._db.execute(
            update(Challenge)
            .where(Challenge.id == challenge_id)
            .values(evidence=evidence, status=new_status)
        )
        await self._db.flush()

        logger.info(
            "Vote cast: challenge=%s, voter=%s, position=%s",
            challenge_id,
            voter_id,
            position,
        )
        return vote

    async def get_consensus(
        self, challenge_id: uuid.UUID
    ) -> ConsensusReport:
        """Compute current consensus status for a challenge.

        Args:
            challenge_id: UUID of the challenge.

        Returns:
            ConsensusReport with vote tallies and consensus status.
        """
        result = await self._db.execute(
            select(Challenge).where(Challenge.id == challenge_id)
        )
        challenge = result.scalar_one_or_none()
        if challenge is None:
            raise ValueError(f"Challenge {challenge_id} not found")

        evidence = challenge.evidence or {}
        votes: list[dict] = evidence.get("votes", [])
        round_number = evidence.get("round_number", 1)

        counts = Counter(v.get("position") for v in votes)
        agree = counts.get("agree", 0)
        disagree = counts.get("disagree", 0)
        abstain = counts.get("abstain", 0)
        total = agree + disagree + abstain

        # Consensus score: proportion of majority position among non-abstaining
        non_abstain = agree + disagree
        if non_abstain == 0:
            consensus_score = 0.0
            majority = None
        else:
            majority_count = max(agree, disagree)
            consensus_score = majority_count / non_abstain
            majority = "agree" if agree >= disagree else "disagree"

        consensus_reached = (
            total >= _MIN_VOTES_FOR_CONSENSUS
            and consensus_score >= _CONSENSUS_THRESHOLD
        )

        needs_escalation = (
            total >= _MIN_VOTES_FOR_CONSENSUS
            and not consensus_reached
            and round_number >= _MAX_ROUNDS
        )

        report = ConsensusReport(
            challenge_id=str(challenge_id),
            total_votes=total,
            agree_count=agree,
            disagree_count=disagree,
            abstain_count=abstain,
            consensus_score=round(consensus_score, 4),
            consensus_reached=consensus_reached,
            majority_position=majority,
            needs_escalation=needs_escalation,
            round_number=round_number,
        )

        logger.debug(
            "Consensus for challenge %s: score=%.2f, reached=%s, votes=%d",
            challenge_id,
            consensus_score,
            consensus_reached,
            total,
        )
        return report

    async def escalate(
        self, challenge_id: uuid.UUID, reason: str | None = None
    ) -> None:
        """Escalate a challenge that cannot reach consensus.

        Sets the challenge to a special 'escalated' status for admin review.

        Args:
            challenge_id: UUID of the challenge.
            reason: Escalation reason.
        """
        result = await self._db.execute(
            select(Challenge).where(Challenge.id == challenge_id)
        )
        challenge = result.scalar_one_or_none()
        if challenge is None:
            raise ValueError(f"Challenge {challenge_id} not found")

        evidence = challenge.evidence or {}
        evidence["escalation"] = {
            "reason": reason or "Consensus not reached after maximum rounds",
            "escalated_at": datetime.now(timezone.utc).isoformat(),
            "vote_summary": {
                "total": len(evidence.get("votes", [])),
            },
        }

        await self._db.execute(
            update(Challenge)
            .where(Challenge.id == challenge_id)
            .values(evidence=evidence, status="under_review")
        )
        await self._db.flush()

        logger.info(
            "Challenge %s escalated: %s",
            challenge_id,
            reason or "no consensus",
        )

    async def advance_round(self, challenge_id: uuid.UUID) -> int:
        """Advance the consensus round number.

        Args:
            challenge_id: UUID of the challenge.

        Returns:
            New round number.
        """
        result = await self._db.execute(
            select(Challenge).where(Challenge.id == challenge_id)
        )
        challenge = result.scalar_one_or_none()
        if challenge is None:
            raise ValueError(f"Challenge {challenge_id} not found")

        evidence = challenge.evidence or {}
        round_number = evidence.get("round_number", 1) + 1
        evidence["round_number"] = round_number

        await self._db.execute(
            update(Challenge)
            .where(Challenge.id == challenge_id)
            .values(evidence=evidence)
        )
        await self._db.flush()

        logger.info(
            "Challenge %s advanced to round %d", challenge_id, round_number
        )
        return round_number
