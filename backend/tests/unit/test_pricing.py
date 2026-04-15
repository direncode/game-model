"""Unit tests for the pricing engine."""
from __future__ import annotations

import sys
import os
import math
from datetime import datetime, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from lo_platform.control_plane.services.pricing import (
    PricingEngine,
    PricingTier,
    TierPricing,
    TIER_PRICING,
    Invoice,
    InvoiceLineItem,
)


# =====================================================================
#  Tier definitions
# =====================================================================

class TestTierDefinitions:
    """Verify the tier pricing constants are sane."""

    def test_starter_tier_exists(self):
        assert PricingTier.STARTER in TIER_PRICING

    def test_professional_tier_exists(self):
        assert PricingTier.PROFESSIONAL in TIER_PRICING

    def test_enterprise_tier_exists(self):
        assert PricingTier.ENTERPRISE in TIER_PRICING

    def test_starter_base_fee(self):
        assert TIER_PRICING[PricingTier.STARTER].base_monthly_usd == 2_500

    def test_professional_base_fee(self):
        assert TIER_PRICING[PricingTier.PROFESSIONAL].base_monthly_usd == 15_000

    def test_enterprise_base_fee(self):
        assert TIER_PRICING[PricingTier.ENTERPRISE].base_monthly_usd == 50_000

    def test_enterprise_unlimited_sources(self):
        assert TIER_PRICING[PricingTier.ENTERPRISE].max_sources == -1

    def test_enterprise_unlimited_modules(self):
        assert TIER_PRICING[PricingTier.ENTERPRISE].max_modules == -1


# =====================================================================
#  PricingEngine
# =====================================================================

PERIOD_START = datetime(2024, 1, 1, tzinfo=timezone.utc)
PERIOD_END = datetime(2024, 1, 31, tzinfo=timezone.utc)


class TestPricingEngine:
    """Test invoice computation for all tiers."""

    # -- Starter tier --

    def test_starter_zero_usage_invoice(self):
        engine = PricingEngine(PricingTier.STARTER)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        assert inv.tier == PricingTier.STARTER
        assert inv.subtotal == 2_500  # Base fee only
        assert inv.total == 2_500
        assert inv.currency == "usd"
        assert inv.status == "draft"

    def test_starter_within_included_entities(self):
        engine = PricingEngine(PricingTier.STARTER)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=50_000,  # Under 100k included
            query_count=10_000,   # Under 50k included
            storage_gb=0,
            enabled_modules=[],
        )
        # No overage
        assert inv.subtotal == 2_500

    def test_starter_entity_overage(self):
        engine = PricingEngine(PricingTier.STARTER)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=150_000,  # 50k overage
            query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        # 50k overage = ceil(50000/1000) * 0.10 = 50 * 0.10 = 5.00
        entity_items = [li for li in inv.line_items if li.category == "entity"]
        assert len(entity_items) == 1
        assert entity_items[0].total == 5.0
        assert inv.subtotal == 2_500 + 5.0

    def test_starter_with_modules(self):
        engine = PricingEngine(PricingTier.STARTER)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=["edgar", "pubmed"],
        )
        module_items = [li for li in inv.line_items if li.category == "module"]
        assert len(module_items) == 1
        assert module_items[0].total == 2 * 500  # 2 modules * $500

    # -- Professional tier --

    def test_professional_base_fee(self):
        engine = PricingEngine(PricingTier.PROFESSIONAL)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        assert inv.subtotal == 15_000

    def test_professional_entity_overage(self):
        engine = PricingEngine(PricingTier.PROFESSIONAL)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=1_500_000,  # 500k overage
            query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        # 500k overage = ceil(500000/1000) * 0.08 = 500 * 0.08 = 40.0
        entity_items = [li for li in inv.line_items if li.category == "entity"]
        assert entity_items[0].total == 40.0

    def test_professional_query_overage(self):
        engine = PricingEngine(PricingTier.PROFESSIONAL)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0,
            query_count=600_000,  # 100k overage
            storage_gb=0,
            enabled_modules=[],
        )
        # 100k overage = ceil(100000/1000) * 0.03 = 100 * 0.03 = 3.0
        query_items = [li for li in inv.line_items if li.category == "query"]
        assert len(query_items) == 1
        assert query_items[0].total == 3.0

    def test_professional_storage(self):
        engine = PricingEngine(PricingTier.PROFESSIONAL)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0,
            storage_gb=100.0,
            enabled_modules=[],
        )
        storage_items = [li for li in inv.line_items if li.category == "storage"]
        assert len(storage_items) == 1
        assert storage_items[0].total == 100.0 * 0.20  # $20

    def test_professional_module_pricing(self):
        engine = PricingEngine(PricingTier.PROFESSIONAL)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=["edgar", "pubmed", "patent"],
        )
        module_items = [li for li in inv.line_items if li.category == "module"]
        assert module_items[0].total == 3 * 1_000  # 3 modules * $1000

    # -- Enterprise tier --

    def test_enterprise_base_fee(self):
        engine = PricingEngine(PricingTier.ENTERPRISE)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        assert inv.subtotal == 50_000

    def test_enterprise_large_entity_overage(self):
        engine = PricingEngine(PricingTier.ENTERPRISE)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=15_000_000,  # 5M overage
            query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        # 5M overage = ceil(5000000/1000) * 0.05 = 5000 * 0.05 = 250.0
        entity_items = [li for li in inv.line_items if li.category == "entity"]
        assert entity_items[0].total == 250.0

    def test_enterprise_module_pricing(self):
        engine = PricingEngine(PricingTier.ENTERPRISE)
        inv = engine.compute_invoice(
            customer_id="cust-1", fork_id="fork-1",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=["mod1"],
        )
        module_items = [li for li in inv.line_items if li.category == "module"]
        assert module_items[0].total == 2_000

    # -- Cross-tier tests --

    def test_no_entity_overage_when_under_included(self):
        for tier in [PricingTier.STARTER, PricingTier.PROFESSIONAL, PricingTier.ENTERPRISE]:
            engine = PricingEngine(tier)
            included = TIER_PRICING[tier].included_entities
            inv = engine.compute_invoice(
                customer_id="c", fork_id="f",
                period_start=PERIOD_START, period_end=PERIOD_END,
                entity_count=included - 1,
                query_count=0, storage_gb=0,
                enabled_modules=[],
            )
            entity_items = [li for li in inv.line_items if li.category == "entity"]
            assert len(entity_items) == 0, f"Unexpected overage for {tier}"

    def test_no_query_overage_when_under_included(self):
        for tier in [PricingTier.STARTER, PricingTier.PROFESSIONAL, PricingTier.ENTERPRISE]:
            engine = PricingEngine(tier)
            included = TIER_PRICING[tier].included_queries
            inv = engine.compute_invoice(
                customer_id="c", fork_id="f",
                period_start=PERIOD_START, period_end=PERIOD_END,
                entity_count=0,
                query_count=included,
                storage_gb=0,
                enabled_modules=[],
            )
            query_items = [li for li in inv.line_items if li.category == "query"]
            assert len(query_items) == 0, f"Unexpected query overage for {tier}"

    def test_zero_storage_no_storage_line_item(self):
        engine = PricingEngine(PricingTier.PROFESSIONAL)
        inv = engine.compute_invoice(
            customer_id="c", fork_id="f",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        storage_items = [li for li in inv.line_items if li.category == "storage"]
        assert len(storage_items) == 0

    def test_invoice_line_item_categories(self):
        engine = PricingEngine(PricingTier.STARTER)
        inv = engine.compute_invoice(
            customer_id="c", fork_id="f",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=200_000, query_count=100_000,
            storage_gb=50.0,
            enabled_modules=["mod1"],
        )
        categories = {li.category for li in inv.line_items}
        assert "base" in categories
        assert "module" in categories
        assert "entity" in categories
        assert "query" in categories
        assert "storage" in categories

    def test_subtotal_equals_sum_of_line_items(self):
        engine = PricingEngine(PricingTier.PROFESSIONAL)
        inv = engine.compute_invoice(
            customer_id="c", fork_id="f",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=2_000_000, query_count=1_000_000,
            storage_gb=500.0,
            enabled_modules=["a", "b", "c"],
        )
        expected = round(sum(li.total for li in inv.line_items), 2)
        assert inv.subtotal == expected

    def test_total_equals_subtotal_when_no_tax(self):
        engine = PricingEngine(PricingTier.STARTER)
        inv = engine.compute_invoice(
            customer_id="c", fork_id="f",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        assert inv.total == inv.subtotal

    # -- estimate_monthly --

    def test_estimate_monthly_base_only(self):
        engine = PricingEngine(PricingTier.STARTER)
        est = engine.estimate_monthly(
            entity_count=0, query_count=0, storage_gb=0, module_count=0,
        )
        assert est == 2_500

    def test_estimate_monthly_with_modules(self):
        engine = PricingEngine(PricingTier.PROFESSIONAL)
        est = engine.estimate_monthly(
            entity_count=0, query_count=0, storage_gb=0, module_count=5,
        )
        assert est == 15_000 + 5 * 1_000

    def test_estimate_monthly_with_overage(self):
        engine = PricingEngine(PricingTier.STARTER)
        est = engine.estimate_monthly(
            entity_count=200_000,  # 100k overage
            query_count=100_000,   # 50k overage
            storage_gb=10,
            module_count=2,
        )
        base = 2_500
        modules = 2 * 500
        entity_overage = math.ceil(100_000 / 1_000) * 0.10  # 10.0
        query_overage = math.ceil(50_000 / 1_000) * 0.05    # 2.5
        storage = 10 * 0.25                                  # 2.5
        expected = round(base + modules + entity_overage + query_overage + storage, 2)
        assert est == expected

    def test_estimate_monthly_no_overage_within_included(self):
        engine = PricingEngine(PricingTier.ENTERPRISE)
        est = engine.estimate_monthly(
            entity_count=5_000_000,  # Under 10M included
            query_count=1_000_000,   # Under 5M included
            storage_gb=0,
            module_count=0,
        )
        assert est == 50_000  # Base only

    # -- get_tier_limits --

    def test_get_tier_limits_returns_all_fields(self):
        engine = PricingEngine(PricingTier.PROFESSIONAL)
        limits = engine.get_tier_limits()
        assert limits["tier"] == "professional"
        assert limits["name"] == "Professional"
        assert "base_monthly_usd" in limits
        assert "per_module_monthly_usd" in limits
        assert "included_entities" in limits
        assert "per_1k_entities_usd" in limits
        assert "included_queries" in limits
        assert "per_1k_queries_usd" in limits
        assert "per_gb_storage_usd" in limits
        assert "max_sources" in limits
        assert "max_modules" in limits
        assert "features" in limits

    def test_get_tier_limits_values(self):
        engine = PricingEngine(PricingTier.STARTER)
        limits = engine.get_tier_limits()
        assert limits["base_monthly_usd"] == 2_500
        assert limits["max_sources"] == 1
        assert limits["max_modules"] == 3

    # -- Invoice metadata --

    def test_invoice_customer_and_fork_ids(self):
        engine = PricingEngine(PricingTier.STARTER)
        inv = engine.compute_invoice(
            customer_id="acme-corp", fork_id="fork-prod",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        assert inv.customer_id == "acme-corp"
        assert inv.fork_id == "fork-prod"

    def test_invoice_period(self):
        engine = PricingEngine(PricingTier.STARTER)
        inv = engine.compute_invoice(
            customer_id="c", fork_id="f",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=0, query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        assert inv.period_start == PERIOD_START
        assert inv.period_end == PERIOD_END

    def test_overage_calculation_rounds_up(self):
        """Overage of 1 entity beyond included should charge for 1K block."""
        engine = PricingEngine(PricingTier.STARTER)
        inv = engine.compute_invoice(
            customer_id="c", fork_id="f",
            period_start=PERIOD_START, period_end=PERIOD_END,
            entity_count=100_001,  # 1 entity overage
            query_count=0, storage_gb=0,
            enabled_modules=[],
        )
        entity_items = [li for li in inv.line_items if li.category == "entity"]
        assert len(entity_items) == 1
        # ceil(1/1000) = 1 block * $0.10 = $0.10
        assert entity_items[0].total == 0.10
