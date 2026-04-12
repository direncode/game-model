"""Module marketplace pricing and licensing.

Prices crystallized modules based on purity, quality, and entity coverage.
Tiers: basic (<100 credits), standard (100-500), premium (>500).
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from typing import Any


def estimate_price(module: Any) -> dict:
    """Estimate the market price of a crystallized module."""
    purity = getattr(module, "purity", 0.5)
    quality = getattr(module, "quality_score", 0.5)
    members = getattr(module, "members", [])

    base = 100
    purity_mult = purity ** 2
    quality_mult = quality * 2
    size_mult = min(len(members) / 10, 5.0)
    price = base * purity_mult * quality_mult * max(size_mult, 0.5)

    if price > 500:
        tier = "premium"
    elif price > 100:
        tier = "standard"
    else:
        tier = "basic"

    return {
        "price_credits": round(price, 2),
        "tier": tier,
        "pricing_factors": {
            "base": base,
            "purity_multiplier": round(purity_mult, 3),
            "quality_multiplier": round(quality_mult, 3),
            "coverage_multiplier": round(size_mult, 3),
        },
    }


def generate_license_key(module_id: str) -> dict:
    """Generate a mock license key for a module."""
    key = hashlib.sha256(
        f"{module_id}:{datetime.utcnow().isoformat()}:{uuid.uuid4()}".encode()
    ).hexdigest()[:32]
    return {
        "license_key": f"TCD-{key[:8].upper()}-{key[8:16].upper()}-{key[16:24].upper()}-{key[24:32].upper()}",
        "module_id": module_id,
        "issued_at": datetime.utcnow().isoformat(),
        "valid_until": "2027-04-12T00:00:00",
        "tier": "enterprise",
    }
