"""Polymarket Gamma API client for crowd-sourced prediction market data.

The Gamma API is fully open -- no API key or authentication required.
Contract prices = implied probabilities (price $0.65 = 65% probability).
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

GAMMA_API = "https://gamma-api.polymarket.com"


@dataclass
class PolymarketOdds:
    home_win: float
    draw: float | None
    away_win: float
    liquidity: float
    volume_24h: float
    market_slug: str
    last_updated: str


class PolymarketClient:
    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36"
        )
    }

    FOOTBALL_KEYWORDS = [
        "soccer", "premier league", "la liga", "bundesliga",
        "serie a", "ligue 1", "champions league", "uefa",
        "manchester", "liverpool", "arsenal", "chelsea",
        "barcelona", "real madrid", "bayern", "psg",
        "epl", "football match",
    ]

    def search_football_markets(self, limit: int = 100) -> list[dict]:
        all_markets: list[dict] = []
        offset = 0

        while offset < limit:
            try:
                resp = requests.get(
                    f"{GAMMA_API}/markets",
                    params={"active": "true", "closed": "false", "limit": 50, "offset": offset},
                    headers=self.HEADERS,
                    timeout=15,
                )
                resp.raise_for_status()
                markets = resp.json()
                if not markets:
                    break

                for market in markets:
                    text = (market.get("question", "") + " " + market.get("description", "")).lower()
                    if any(kw in text for kw in self.FOOTBALL_KEYWORDS):
                        all_markets.append(market)

                offset += 50
                time.sleep(0.5)
            except requests.RequestException as e:
                logger.warning("Polymarket request error: %s", e)
                break

        logger.info("Found %d football markets on Polymarket", len(all_markets))
        return all_markets

    def extract_match_odds(self, market: dict) -> PolymarketOdds | None:
        try:
            outcomes = market.get("outcomes", [])
            prices_raw = market.get("outcomePrices", "[]")
            prices = json.loads(prices_raw) if isinstance(prices_raw, str) else prices_raw

            if len(prices) < 2:
                return None

            prices = [float(p) for p in prices]

            if len(prices) == 2:
                return PolymarketOdds(
                    home_win=prices[0], draw=None, away_win=prices[1],
                    liquidity=float(market.get("liquidity", 0) or 0),
                    volume_24h=float(market.get("volume24hr", 0) or 0),
                    market_slug=market.get("slug", ""),
                    last_updated=market.get("updatedAt", ""),
                )

            if len(prices) >= 3:
                outcomes_lower = [o.lower() for o in outcomes]
                home_idx = next((i for i, o in enumerate(outcomes_lower) if "home" in o or "win" in o), 0)
                draw_idx = next((i for i, o in enumerate(outcomes_lower) if "draw" in o or "tie" in o), 1)
                away_idx = next((i for i, o in enumerate(outcomes_lower) if "away" in o or "lose" in o), 2)

                return PolymarketOdds(
                    home_win=prices[home_idx], draw=prices[draw_idx], away_win=prices[away_idx],
                    liquidity=float(market.get("liquidity", 0) or 0),
                    volume_24h=float(market.get("volume24hr", 0) or 0),
                    market_slug=market.get("slug", ""),
                    last_updated=market.get("updatedAt", ""),
                )
        except (ValueError, IndexError, KeyError) as e:
            logger.warning("Failed to extract Polymarket prices: %s", e)

        return None
