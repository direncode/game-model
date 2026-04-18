"""Claude API integration for match analysis and divergence interpretation.

Uses claude-sonnet-4-20250514 for structured analysis. Gracefully degrades
when no ANTHROPIC_API_KEY is set -- the prediction pipeline works without
Claude, just without natural language reports.
"""

from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)


class ClaudeAnalyst:
    def __init__(self) -> None:
        self._client = None
        self.available = False
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if api_key:
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=api_key)
                self.available = True
            except Exception as e:
                logger.warning("Claude analyst unavailable: %s", e)

    def _call(self, prompt: str, max_tokens: int = 800) -> str | None:
        if not self._client:
            return None
        try:
            message = self._client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text.strip()
        except Exception as e:
            logger.warning("Claude API call failed: %s", e)
            return None

    def _build_matchup_prompt(
        self,
        home_team: str,
        away_team: str,
        home_form: dict,
        away_form: dict,
        league: str,
    ) -> str:
        return (
            "You are an expert football analyst. Analyze this match and return ONLY JSON:\n"
            "\n"
            f"Match: {home_team} (home) vs {away_team} (away)\n"
            f"League: {league}\n"
            "\n"
            f"{home_team} last 5 matches:\n"
            f"- Goals scored avg: {home_form.get('avg_GF', 0):.2f}\n"
            f"- Goals conceded avg: {home_form.get('avg_GA', 0):.2f}\n"
            f"- Form (avg pts): {home_form.get('Form', 0):.2f}\n"
            "\n"
            f"{away_team} last 5 matches:\n"
            f"- Goals scored avg: {away_form.get('avg_GF', 0):.2f}\n"
            f"- Goals conceded avg: {away_form.get('avg_GA', 0):.2f}\n"
            f"- Form (avg pts): {away_form.get('Form', 0):.2f}\n"
            "\n"
            'Return JSON: {"home_attack_strength": <0-1>, "home_defense_strength": <0-1>, '
            '"away_attack_strength": <0-1>, "away_defense_strength": <0-1>, '
            '"home_momentum": <0-1>, "away_momentum": <0-1>, '
            '"upset_probability": <0-1>, "home_win_confidence": <0-1>, '
            '"reasoning": "<1-2 sentences>"}'
        )

    def analyze_matchup(self, home_team: str, away_team: str, home_form: dict, away_form: dict, league: str) -> dict | None:
        prompt = self._build_matchup_prompt(home_team, away_team, home_form, away_form, league)
        text = self._call(prompt, max_tokens=500)
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start, end = text.find("{"), text.rfind("}") + 1
            if start != -1 and end > start:
                return json.loads(text[start:end])
            return None

    def analyze_divergence(
        self,
        match: str,
        bookmaker: dict,
        polymarket: dict,
        ml_model: dict,
        poly_liquidity: float = 0,
        poly_volume_24h: float = 0,
    ) -> str | None:
        prompt = (
            "You are a senior sports analyst. Analyze divergences between three "
            "probability sources for a football match.\n"
            "\n"
            f"Match: {match}\n"
            "\n"
            "| Source | Home | Draw | Away |\n"
            "|---|---|---|---|\n"
            f"| Bookmaker | {bookmaker.get('home', 0):.1%} | {bookmaker.get('draw', 0):.1%} | {bookmaker.get('away', 0):.1%} |\n"
            f"| Polymarket | {polymarket.get('home', 0):.1%} | {polymarket.get('draw', 0):.1%} | {polymarket.get('away', 0):.1%} |\n"
            f"| ML Model | {ml_model.get('home', 0):.1%} | {ml_model.get('draw', 0):.1%} | {ml_model.get('away', 0):.1%} |\n"
            "\n"
            f"Polymarket liquidity: ${poly_liquidity:,.0f} | 24h volume: ${poly_volume_24h:,.0f}\n"
            "\n"
            "1. Where are the main divergences and what might they mean?\n"
            "2. Which source is likely most reliable here and why?\n"
            "3. Final analytical assessment with confidence level.\n"
            "\n"
            "5-8 sentences. No filler. This is analytical research, not betting advice."
        )
        return self._call(prompt, max_tokens=600)

    def generate_match_report(
        self,
        home_team: str,
        away_team: str,
        model_proba: dict,
        stats: dict,
        league: str,
    ) -> str | None:
        prompt = (
            "You are a professional football analyst. Write a concise analytical report.\n"
            "\n"
            f"Match: {home_team} vs {away_team} ({league})\n"
            "\n"
            f"ML probabilities: Home={model_proba.get('home', 0):.1%} | "
            f"Draw={model_proba.get('draw', 0):.1%} | Away={model_proba.get('away', 0):.1%}\n"
            "\n"
            f"{home_team} (5-match): GF={stats.get('home_avg_GF', 0):.2f}, "
            f"GA={stats.get('home_avg_GA', 0):.2f}, Form={stats.get('home_Form', 0):.2f}\n"
            f"{away_team} (5-match): GF={stats.get('away_avg_GF', 0):.2f}, "
            f"GA={stats.get('away_avg_GA', 0):.2f}, Form={stats.get('away_Form', 0):.2f}\n"
            "\n"
            "Include: key factors, strengths/weaknesses, prediction, "
            "confidence (high/medium/low), risks.\n"
            "Concise, professional, no filler. This is analytical research, not betting advice."
        )
        return self._call(prompt, max_tokens=1000)
