"""Template-driven scoring engine for allocation requests.

Organizations define scoring factors via EstateScoringTemplate.
Each factor has a type (keyword, range, duplicate, model) and
configurable parameters.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class FactorResult:
    name: str
    score: float
    weight: float
    detail: str


@dataclass
class ScoreResult:
    total: float
    recommendation: str
    factors: list[FactorResult]

    def to_dict(self) -> dict[str, Any]:
        return {
            "total": round(self.total, 1),
            "recommendation": self.recommendation,
            "factors": [
                {"name": f.name, "score": round(f.score, 1), "weight": f.weight, "detail": f.detail}
                for f in self.factors
            ],
        }


class ScoringEngine:
    def __init__(self, model_router: Any | None = None) -> None:
        self._model_router = model_router

    async def score(
        self,
        amount: float,
        justification: str,
        category_tag: str,
        templates: list[dict],
        recent_requests: list[dict] | None = None,
    ) -> ScoreResult:
        factors: list[FactorResult] = []

        for tmpl in templates:
            if not tmpl.get("is_active", True):
                continue
            etype = tmpl["evaluator_type"]
            config = tmpl.get("evaluator_config", {})
            name = tmpl["name"]
            weight = tmpl.get("weight", 1.0)

            if etype == "keyword":
                result = self._eval_keyword(justification, config)
            elif etype == "range":
                result = self._eval_range(amount, config)
            elif etype == "duplicate":
                result = self._eval_duplicate(justification, amount, recent_requests or [], config)
            elif etype == "model":
                result = await self._eval_model(amount, justification, category_tag, config)
            else:
                result = (50.0, f"Unknown evaluator type: {etype}")

            factors.append(FactorResult(name=name, score=result[0], weight=weight, detail=result[1]))

        if not factors:
            return ScoreResult(total=50.0, recommendation="review", factors=[])

        total_weight = sum(f.weight for f in factors)
        weighted_sum = sum(f.score * f.weight for f in factors)
        total = weighted_sum / total_weight if total_weight > 0 else 50.0

        recommendation = self._recommend(total, factors)
        return ScoreResult(total=total, recommendation=recommendation, factors=factors)

    def _recommend(self, total: float, factors: list[FactorResult]) -> str:
        for f in factors:
            if f.score < 10:
                return "flag"
        if total >= 75:
            return "approve"
        if total >= 35:
            return "review"
        return "deny"

    def _eval_keyword(self, text: str, config: dict) -> tuple[float, str]:
        keywords = config.get("keywords", {})
        text_lower = text.lower()
        total = 0.0
        matched = []
        for kw, pts in keywords.items():
            if kw.lower() in text_lower:
                total += pts
                matched.append(kw)
        score = min(total, 100.0)
        detail = f"Matched: {', '.join(matched)}" if matched else "No keyword matches"
        return (score, detail)

    def _eval_range(self, amount: float, config: dict) -> tuple[float, str]:
        typical = config.get("typical", 1000)
        maximum = config.get("maximum", 10000)
        if amount <= typical:
            return (90.0, f"Amount ${amount:.0f} within typical range (${typical:.0f})")
        elif amount <= maximum:
            ratio = (amount - typical) / (maximum - typical)
            score = 90.0 - (ratio * 60.0)
            return (score, f"Amount ${amount:.0f} above typical but within max (${maximum:.0f})")
        else:
            score = max(0.0, 20.0 - ((amount - maximum) / maximum) * 20.0)
            return (score, f"Amount ${amount:.0f} exceeds maximum (${maximum:.0f})")

    def _eval_duplicate(self, justification: str, amount: float, recent: list[dict], config: dict) -> tuple[float, str]:
        window_days = config.get("window_days", 30)
        threshold = config.get("similarity_threshold", 0.7)
        cutoff = datetime.utcnow() - timedelta(days=window_days)

        for req in recent:
            req_date = req.get("created_at")
            if isinstance(req_date, str):
                try:
                    req_date = datetime.fromisoformat(req_date)
                except ValueError:
                    continue
            if req_date and req_date < cutoff:
                continue
            prev_text = req.get("justification", "")
            similarity = SequenceMatcher(None, justification.lower(), prev_text.lower()).ratio()
            if similarity >= threshold:
                return (15.0, f"Similar request found ({similarity:.0%} match within {window_days}d)")
        return (85.0, f"No duplicates in last {window_days} days")

    async def _eval_model(self, amount: float, justification: str, category_tag: str, config: dict) -> tuple[float, str]:
        if self._model_router is None:
            return (50.0, "Model router not configured")

        prompt = config.get(
            "prompt_template",
            "Evaluate this resource allocation request. "
            "Category: {category}. Amount: ${amount:.2f}. "
            "Justification: {justification}\n\n"
            "Rate the reasonableness from 0-100 and explain briefly. "
            "Respond with just the number and one sentence.",
        ).format(category=category_tag, amount=amount, justification=justification)

        try:
            response = await self._model_router.complete(prompt)
            numbers = re.findall(r"\d+", response)
            score = float(numbers[0]) if numbers else 50.0
            score = min(max(score, 0.0), 100.0)
            return (score, response[:200])
        except Exception as exc:
            logger.warning("Model scoring failed: %s", exc)
            return (50.0, f"Model evaluation failed: {exc}")

    async def suggest_reallocations(self, ledger_entries: list[dict], threshold_pct: float = 30.0) -> list[dict]:
        by_category: dict[str, dict] = {}
        for entry in ledger_entries:
            tag = entry.get("category_tag", "other")
            if tag not in by_category:
                by_category[tag] = {"allocated": 0.0}
            by_category[tag]["allocated"] += entry.get("amount", 0.0)

        suggestions = []
        for tag, data in by_category.items():
            allocated = data["allocated"]
            if allocated > 0:
                suggestions.append({"source_category": tag, "available": allocated, "reason": f"Category '{tag}' may have surplus allocation"})
        return suggestions
