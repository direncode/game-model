"""Customer health scoring — monitors fork engagement and health.

Scores each fork across four dimensions:
    1. Freshness — how recently the fork ran a reduction
    2. Activity  — query and API usage trends
    3. Errors    — error rates and consecutive failures
    4. Utilization — entity coverage and storage efficiency

The composite score (0.0-1.0) drives alerts, customer success
outreach, and auto-suspension of abandoned forks.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Scoring thresholds
MAX_FRESHNESS_HOURS = 72  # 3 days — anything older scores 0
IDEAL_QUERIES_PER_DAY = 50  # Expected daily query volume
MAX_CONSECUTIVE_FAILURES = 5


class HealthScorer:
    """Score fork health across multiple dimensions.

    Stateless scorer — takes a fork data dict and returns scores.
    Does not access the database directly; the caller assembles
    the required data.
    """

    def score(self, fork_data: dict) -> dict:
        """Score fork health across all dimensions.

        Args:
            fork_data: Dict with fork state, must include:
                - last_reduction_at: ISO datetime string or None
                - queries_served_total: int
                - created_at: ISO datetime string
                - health_status: str
                - consecutive_failures: int
                - entity_count: int
                - survivor_count: int
                - storage_used_bytes: int
                - status: str

        Returns:
            Dict with per-dimension scores and composite:
            {
                "freshness": 0.85,
                "activity": 0.72,
                "errors": 1.0,
                "utilization": 0.60,
                "composite": 0.79,
                "grade": "B",
                "alerts": [...],
            }
        """
        freshness = self._score_freshness(fork_data)
        activity = self._score_activity(fork_data)
        errors = self._score_errors(fork_data)
        utilization = self._score_utilization(fork_data)

        # Weighted composite: errors weighted highest (service quality)
        composite = (
            freshness * 0.25
            + activity * 0.25
            + errors * 0.35
            + utilization * 0.15
        )
        composite = round(min(1.0, max(0.0, composite)), 3)

        grade = self._grade_from_score(composite)
        alerts = self._generate_alerts(
            fork_data, freshness, activity, errors, utilization
        )

        result = {
            "freshness": round(freshness, 3),
            "activity": round(activity, 3),
            "errors": round(errors, 3),
            "utilization": round(utilization, 3),
            "composite": composite,
            "grade": grade,
            "alerts": alerts,
        }

        logger.debug(
            "[health] fork=%s composite=%.3f grade=%s alerts=%d",
            fork_data.get("fork_id", "?"),
            composite,
            grade,
            len(alerts),
        )
        return result

    def score_fleet(self, forks: list[dict]) -> dict:
        """Score health for an entire fleet of forks.

        Args:
            forks: List of fork data dicts.

        Returns:
            Dict with fleet-level aggregates and per-fork scores.
        """
        scores = []
        for f in forks:
            s = self.score(f)
            s["fork_id"] = f.get("fork_id", f.get("id", ""))
            s["subdomain"] = f.get("subdomain", "")
            scores.append(s)

        composites = [s["composite"] for s in scores]
        avg_score = sum(composites) / max(len(composites), 1)

        grade_counts = {}
        for s in scores:
            g = s["grade"]
            grade_counts[g] = grade_counts.get(g, 0) + 1

        total_alerts = sum(len(s["alerts"]) for s in scores)

        return {
            "fleet_size": len(forks),
            "average_score": round(avg_score, 3),
            "grade_distribution": grade_counts,
            "total_alerts": total_alerts,
            "forks": scores,
        }

    # ── Dimension scorers ─────────────────────────────────────────────

    def _score_freshness(self, fork_data: dict) -> float:
        """Score based on recency of last reduction.

        Returns 1.0 if reduced within the last hour, decaying
        exponentially to 0.0 at MAX_FRESHNESS_HOURS.
        """
        last_reduction = fork_data.get("last_reduction_at")
        if not last_reduction:
            return 0.0

        if isinstance(last_reduction, str):
            try:
                last_dt = datetime.fromisoformat(last_reduction)
            except ValueError:
                return 0.0
        else:
            last_dt = last_reduction

        # Ensure timezone-aware
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)

        hours_ago = (
            datetime.now(timezone.utc) - last_dt
        ).total_seconds() / 3600.0

        if hours_ago <= 0:
            return 1.0
        if hours_ago >= MAX_FRESHNESS_HOURS:
            return 0.0

        # Exponential decay
        return math.exp(-3.0 * hours_ago / MAX_FRESHNESS_HOURS)

    def _score_activity(self, fork_data: dict) -> float:
        """Score based on query/API activity relative to fork age.

        Returns 1.0 if the fork is seeing at least IDEAL_QUERIES_PER_DAY,
        scaling linearly below that.
        """
        queries = fork_data.get("queries_served_total", 0)
        created_at = fork_data.get("created_at")

        if not created_at or queries == 0:
            return 0.0

        if isinstance(created_at, str):
            try:
                created_dt = datetime.fromisoformat(created_at)
            except ValueError:
                return 0.0
        else:
            created_dt = created_at

        if created_dt.tzinfo is None:
            created_dt = created_dt.replace(tzinfo=timezone.utc)

        days_active = max(
            1.0,
            (datetime.now(timezone.utc) - created_dt).total_seconds() / 86400.0,
        )

        queries_per_day = queries / days_active
        score = min(1.0, queries_per_day / IDEAL_QUERIES_PER_DAY)
        return score

    def _score_errors(self, fork_data: dict) -> float:
        """Score based on error rates and consecutive failures.

        Returns 1.0 for no errors, 0.0 for MAX_CONSECUTIVE_FAILURES
        or more consecutive failures.
        """
        health_status = fork_data.get("health_status", "unknown")
        consecutive = fork_data.get("consecutive_failures", 0)

        if health_status == "healthy" and consecutive == 0:
            return 1.0

        if health_status == "unhealthy":
            return 0.1

        # Degrade linearly with consecutive failures
        failure_penalty = min(
            1.0, consecutive / MAX_CONSECUTIVE_FAILURES
        )
        base = 0.7 if health_status == "degraded" else 0.9
        return max(0.0, base - failure_penalty)

    def _score_utilization(self, fork_data: dict) -> float:
        """Score based on entity coverage and storage efficiency.

        A well-utilized fork has a reasonable entity count and
        survivor-to-entity ratio.
        """
        entity_count = fork_data.get("entity_count", 0)
        survivor_count = fork_data.get("survivor_count", 0)

        if entity_count == 0:
            return 0.0

        # Reduction ratio quality: ideal is 50-500x
        if survivor_count > 0:
            ratio = entity_count / survivor_count
            if 50 <= ratio <= 500:
                ratio_score = 1.0
            elif ratio < 50:
                ratio_score = ratio / 50.0
            else:
                ratio_score = max(0.3, 500.0 / ratio)
        else:
            ratio_score = 0.0

        # Entity volume score: more data = more useful (log scale)
        volume_score = min(1.0, math.log10(max(1, entity_count)) / 6.0)

        return ratio_score * 0.6 + volume_score * 0.4

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _grade_from_score(score: float) -> str:
        """Convert a 0.0-1.0 score to a letter grade."""
        if score >= 0.9:
            return "A"
        if score >= 0.8:
            return "B"
        if score >= 0.7:
            return "C"
        if score >= 0.5:
            return "D"
        return "F"

    @staticmethod
    def _generate_alerts(
        fork_data: dict,
        freshness: float,
        activity: float,
        errors: float,
        utilization: float,
    ) -> list[dict]:
        """Generate alerts based on dimension scores."""
        alerts = []

        if freshness < 0.2:
            alerts.append({
                "level": "warning",
                "dimension": "freshness",
                "message": "Fork has not run a reduction in over 48 hours",
            })

        if activity < 0.1 and fork_data.get("status") == "active":
            alerts.append({
                "level": "info",
                "dimension": "activity",
                "message": "Fork has very low query activity — customer may need onboarding help",
            })

        if errors < 0.5:
            alerts.append({
                "level": "critical" if errors < 0.2 else "warning",
                "dimension": "errors",
                "message": (
                    f"Fork experiencing errors "
                    f"(consecutive_failures={fork_data.get('consecutive_failures', 0)})"
                ),
            })

        if utilization < 0.2 and fork_data.get("entity_count", 0) > 0:
            alerts.append({
                "level": "info",
                "dimension": "utilization",
                "message": "Fork has low utilization — review engine configuration",
            })

        return alerts
