"""Pricing engine — maps engine usage to billing amounts.

Pricing model:
  Monthly = Base Platform Fee
          + Per Module Fee (per enabled module)
          + Entity Volume (per 1K entities processed)
          + Query Volume (per 1K queries)
          + Storage (per GB)

The BTUTConfig.auto_scale() budget math already computes GPU cost
from entity count. This pricing engine wraps that into customer-facing tiers.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class PricingTier(str, Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    CUSTOM = "custom"


@dataclass
class TierPricing:
    name: str
    base_monthly_usd: float
    per_module_monthly_usd: float
    included_entities: int  # Free tier entities
    per_1k_entities_usd: float
    included_queries: int  # Free tier queries
    per_1k_queries_usd: float
    per_gb_storage_usd: float
    max_sources: int
    max_modules: int
    features: list[str] = field(default_factory=list)


TIER_PRICING: dict[PricingTier, TierPricing] = {
    PricingTier.STARTER: TierPricing(
        name="Starter",
        base_monthly_usd=2_500,
        per_module_monthly_usd=500,
        included_entities=100_000,
        per_1k_entities_usd=0.10,
        included_queries=50_000,
        per_1k_queries_usd=0.05,
        per_gb_storage_usd=0.25,
        max_sources=1,
        max_modules=3,
        features=["dashboard", "api", "fast_profile"],
    ),
    PricingTier.PROFESSIONAL: TierPricing(
        name="Professional",
        base_monthly_usd=15_000,
        per_module_monthly_usd=1_000,
        included_entities=1_000_000,
        per_1k_entities_usd=0.08,
        included_queries=500_000,
        per_1k_queries_usd=0.03,
        per_gb_storage_usd=0.20,
        max_sources=5,
        max_modules=10,
        features=[
            "dashboard", "api", "fast_profile", "deep_profile",
            "cdc", "webhooks",
        ],
    ),
    PricingTier.ENTERPRISE: TierPricing(
        name="Enterprise",
        base_monthly_usd=50_000,
        per_module_monthly_usd=2_000,
        included_entities=10_000_000,
        per_1k_entities_usd=0.05,
        included_queries=5_000_000,
        per_1k_queries_usd=0.01,
        per_gb_storage_usd=0.15,
        max_sources=-1,  # unlimited
        max_modules=-1,
        features=[
            "dashboard", "api", "fast_profile", "deep_profile",
            "cdc", "webhooks", "sso", "siem", "dedicated_support",
        ],
    ),
}


@dataclass
class InvoiceLineItem:
    description: str
    quantity: float
    unit_price: float
    total: float
    category: str  # "base", "module", "entity", "query", "storage"


@dataclass
class Invoice:
    customer_id: str
    fork_id: str
    period_start: datetime
    period_end: datetime
    tier: PricingTier
    line_items: list[InvoiceLineItem]
    subtotal: float
    tax: float = 0.0
    total: float = 0.0
    currency: str = "usd"
    status: str = "draft"  # draft, finalized, paid, void


class PricingEngine:
    """Computes invoices from usage data."""

    def __init__(self, tier: PricingTier = PricingTier.PROFESSIONAL) -> None:
        self.tier = tier
        self.pricing = TIER_PRICING[tier]

    def compute_invoice(
        self,
        customer_id: str,
        fork_id: str,
        period_start: datetime,
        period_end: datetime,
        entity_count: int,
        query_count: int,
        storage_gb: float,
        enabled_modules: list[str],
    ) -> Invoice:
        """Build a complete invoice from usage data.

        Entity/query volumes subtract the tier's included amounts
        before computing overage charges.
        """
        line_items: list[InvoiceLineItem] = []
        p = self.pricing

        # 1. Base platform fee
        line_items.append(InvoiceLineItem(
            description=f"{p.name} plan — base platform fee",
            quantity=1,
            unit_price=p.base_monthly_usd,
            total=p.base_monthly_usd,
            category="base",
        ))

        # 2. Per-module fees
        module_count = len(enabled_modules)
        if module_count > 0:
            module_total = module_count * p.per_module_monthly_usd
            line_items.append(InvoiceLineItem(
                description=f"Enabled modules ({module_count})",
                quantity=module_count,
                unit_price=p.per_module_monthly_usd,
                total=module_total,
                category="module",
            ))

        # 3. Entity volume overage
        overage_entities = max(0, entity_count - p.included_entities)
        if overage_entities > 0:
            overage_1k = math.ceil(overage_entities / 1_000)
            entity_total = overage_1k * p.per_1k_entities_usd
            line_items.append(InvoiceLineItem(
                description=(
                    f"Entity volume overage — {overage_entities:,} entities "
                    f"over {p.included_entities:,} included"
                ),
                quantity=overage_1k,
                unit_price=p.per_1k_entities_usd,
                total=round(entity_total, 2),
                category="entity",
            ))

        # 4. Query volume overage
        overage_queries = max(0, query_count - p.included_queries)
        if overage_queries > 0:
            overage_1k_q = math.ceil(overage_queries / 1_000)
            query_total = overage_1k_q * p.per_1k_queries_usd
            line_items.append(InvoiceLineItem(
                description=(
                    f"Query volume overage — {overage_queries:,} queries "
                    f"over {p.included_queries:,} included"
                ),
                quantity=overage_1k_q,
                unit_price=p.per_1k_queries_usd,
                total=round(query_total, 2),
                category="query",
            ))

        # 5. Storage
        if storage_gb > 0:
            storage_total = round(storage_gb * p.per_gb_storage_usd, 2)
            line_items.append(InvoiceLineItem(
                description=f"Storage — {storage_gb:.2f} GB",
                quantity=storage_gb,
                unit_price=p.per_gb_storage_usd,
                total=storage_total,
                category="storage",
            ))

        subtotal = round(sum(item.total for item in line_items), 2)

        return Invoice(
            customer_id=customer_id,
            fork_id=fork_id,
            period_start=period_start,
            period_end=period_end,
            tier=self.tier,
            line_items=line_items,
            subtotal=subtotal,
            tax=0.0,
            total=subtotal,
            currency="usd",
            status="draft",
        )

    def estimate_monthly(
        self,
        entity_count: int,
        query_count: int,
        storage_gb: float,
        module_count: int,
    ) -> float:
        """Quick estimate for sales conversations.

        Returns estimated monthly cost in USD.
        """
        p = self.pricing
        total = p.base_monthly_usd

        # Module fees
        total += module_count * p.per_module_monthly_usd

        # Entity overage
        overage_entities = max(0, entity_count - p.included_entities)
        if overage_entities > 0:
            total += math.ceil(overage_entities / 1_000) * p.per_1k_entities_usd

        # Query overage
        overage_queries = max(0, query_count - p.included_queries)
        if overage_queries > 0:
            total += math.ceil(overage_queries / 1_000) * p.per_1k_queries_usd

        # Storage
        total += storage_gb * p.per_gb_storage_usd

        return round(total, 2)

    def get_tier_limits(self) -> dict:
        """Return current tier's limits and included amounts."""
        p = self.pricing
        return {
            "tier": self.tier.value,
            "name": p.name,
            "base_monthly_usd": p.base_monthly_usd,
            "per_module_monthly_usd": p.per_module_monthly_usd,
            "included_entities": p.included_entities,
            "per_1k_entities_usd": p.per_1k_entities_usd,
            "included_queries": p.included_queries,
            "per_1k_queries_usd": p.per_1k_queries_usd,
            "per_gb_storage_usd": p.per_gb_storage_usd,
            "max_sources": p.max_sources,
            "max_modules": p.max_modules,
            "features": p.features,
        }
