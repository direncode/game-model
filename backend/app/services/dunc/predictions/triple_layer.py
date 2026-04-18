"""Triple-layer probability fusion and divergence analysis.

Combines bookmaker odds, Polymarket crowd intelligence, and ML model
probabilities. Divergences between layers are among the most valuable
analytical signals.
"""

from __future__ import annotations

import numpy as np


class TripleLayerFeatures:

    @staticmethod
    def compute_divergence_features(
        bookmaker_probs: dict,
        polymarket_probs: dict,
        ml_probs: dict | None = None,
    ) -> dict:
        features: dict = {}
        epsilon = 1e-6

        # Raw probabilities
        for prefix, probs in [("bk", bookmaker_probs), ("poly", polymarket_probs)]:
            for key in ("home", "draw", "away"):
                features[f"{prefix}_prob_{key[0].upper()}"] = probs.get(key, 0)

        # KL-divergence bookmaker vs Polymarket
        kl_div = 0.0
        for key in ("home", "draw", "away"):
            p = max(bookmaker_probs.get(key, epsilon), epsilon)
            q = max(polymarket_probs.get(key, epsilon), epsilon)
            kl_div += p * np.log(p / q)
        features["kl_div_bk_poly"] = kl_div

        # Absolute divergences
        for key, label in [("home", "H"), ("draw", "D"), ("away", "A")]:
            bk = bookmaker_probs.get(key, 0)
            poly = polymarket_probs.get(key, 0)
            features[f"divergence_{label}"] = bk - poly
            features[f"abs_divergence_{label}"] = abs(bk - poly)

        features["max_divergence"] = max(
            features["abs_divergence_H"],
            features["abs_divergence_D"],
            features["abs_divergence_A"],
        )

        # Favorite agreement
        bk_fav = max(bookmaker_probs, key=bookmaker_probs.get)
        poly_fav = max(polymarket_probs, key=polymarket_probs.get)
        features["sources_agree"] = int(bk_fav == poly_fav)

        # Blended (50/50 default)
        for key, label in [("home", "H"), ("draw", "D"), ("away", "A")]:
            features[f"blended_prob_{label}"] = (
                0.5 * bookmaker_probs.get(key, 0) + 0.5 * polymarket_probs.get(key, 0)
            )

        # Triple system with ML
        if ml_probs:
            for key, label in [("home", "H"), ("draw", "D"), ("away", "A")]:
                ml = ml_probs.get(key, 0)
                bk = bookmaker_probs.get(key, 0)
                poly = polymarket_probs.get(key, 0)
                features[f"ml_prob_{label}"] = ml
                features[f"ml_vs_bk_{label}"] = ml - bk
                features[f"ml_vs_poly_{label}"] = ml - poly
                features[f"triple_blend_{label}"] = 0.40 * ml + 0.35 * poly + 0.25 * bk

            ml_fav = max(ml_probs, key=ml_probs.get)
            features["all_three_agree"] = int(bk_fav == poly_fav == ml_fav)

        return features
