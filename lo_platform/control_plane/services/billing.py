"""Billing service — Stripe integration and invoice lifecycle.

Manages customer billing through Stripe: subscriptions, invoices,
usage reporting, and webhook processing. Falls back to mock mode
when the stripe package is not installed or no API key is configured.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable

logger = logging.getLogger(__name__)


# ── Stripe product / price configuration ─────────────────────────────


@dataclass
class StripeProductConfig:
    """Maps Latent Ocean billing dimensions to Stripe Price IDs.

    Configure these with the IDs created in the Stripe Dashboard
    (or via the Stripe API) for each pricing component.
    """

    base_platform_price_id: str = ""  # Stripe Price ID for base platform
    module_price_id: str = ""  # Stripe Price ID for per-module fee
    entity_metered_price_id: str = ""  # Stripe Price ID for entity usage
    query_metered_price_id: str = ""  # Stripe Price ID for query usage
    storage_metered_price_id: str = ""  # Stripe Price ID for storage usage

    def validate(self) -> list[str]:
        """Return a list of missing price IDs (empty strings)."""
        missing = []
        for fld in (
            "base_platform_price_id",
            "entity_metered_price_id",
            "query_metered_price_id",
            "storage_metered_price_id",
        ):
            if not getattr(self, fld):
                missing.append(fld)
        return missing


# ── Data classes ─────────────────────────────────────────────────────


@dataclass
class PaymentMethod:
    id: str
    type: str  # "card", "bank_account"
    last_four: str
    brand: str = ""
    exp_month: int = 0
    exp_year: int = 0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "last_four": self.last_four,
            "brand": self.brand,
            "exp_month": self.exp_month,
            "exp_year": self.exp_year,
        }


class BillingService:
    """Manages customer billing via Stripe.

    When stripe is unavailable (no package or empty API key), all
    methods run in mock mode -- they log warnings and return
    simulated responses so the rest of the platform can develop
    and test without a live Stripe account.

    Parameters
    ----------
    stripe_api_key : str
        Stripe secret key.  Empty string triggers mock mode.
    stripe_webhook_secret : str
        Stripe webhook endpoint signing secret (whsec_...).
    product_config : StripeProductConfig | None
        Mapping of billing dimensions to Stripe Price IDs.
    test_mode : bool
        When True, logs extra detail for debugging.
    on_customer_status_change : callback, optional
        ``async def(customer_id: str, status: str) -> None``
        Called when a webhook changes customer payment status.
    on_fork_teardown : callback, optional
        ``async def(subscription_id: str) -> None``
        Called when a subscription deletion requires fork teardown.
    """

    def __init__(
        self,
        stripe_api_key: str = "",
        stripe_webhook_secret: str = "",
        product_config: StripeProductConfig | None = None,
        test_mode: bool = True,
        on_customer_status_change: (
            Callable[[str, str], Awaitable[None]] | None
        ) = None,
        on_fork_teardown: (
            Callable[[str], Awaitable[None]] | None
        ) = None,
    ) -> None:
        self._stripe_key = stripe_api_key
        self._webhook_secret = stripe_webhook_secret
        self._product_config = product_config or StripeProductConfig()
        self._test_mode = test_mode
        self._stripe = None
        self._mock = not stripe_api_key

        # External callbacks for webhook-driven side effects
        self._on_customer_status_change = on_customer_status_change
        self._on_fork_teardown = on_fork_teardown

        if self._mock:
            logger.warning(
                "[billing] No Stripe API key provided -- running in MOCK mode. "
                "All billing operations will return simulated responses."
            )

    # ── Stripe SDK access ────────────────────────────────────────────

    def _get_stripe(self):
        """Lazily import and configure the stripe SDK."""
        if self._stripe is not None:
            return self._stripe
        if self._mock:
            return None
        try:
            import stripe

            stripe.api_key = self._stripe_key
            self._stripe = stripe
            # Validate product config on first real access
            missing = self._product_config.validate()
            if missing:
                logger.warning(
                    "[billing] StripeProductConfig has missing price IDs: %s. "
                    "Subscription creation may fail.",
                    ", ".join(missing),
                )
            return stripe
        except ImportError:
            logger.warning(
                "[billing] stripe package not installed -- billing in MOCK mode. "
                "Install with: pip install stripe"
            )
            self._mock = True
            return None

    @property
    def is_mock(self) -> bool:
        return self._mock or self._get_stripe() is None

    # ── Customer management ──────────────────────────────────────────

    async def create_customer(
        self,
        customer_id: str,
        email: str,
        name: str,
        metadata: dict | None = None,
    ) -> dict:
        """Create a Stripe customer linked to our internal customer_id."""
        meta = {"lo_customer_id": customer_id, **(metadata or {})}

        stripe = self._get_stripe()
        if stripe is None:
            mock_id = f"cus_mock_{uuid.uuid4().hex[:12]}"
            logger.warning(
                "[billing-mock] create_customer %s -> %s (mock -- not sent to Stripe)",
                customer_id,
                mock_id,
            )
            return {
                "id": mock_id,
                "email": email,
                "name": name,
                "metadata": meta,
            }

        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata=meta,
        )
        logger.info(
            "[billing] created Stripe customer %s for %s",
            customer.id,
            customer_id,
        )
        return {
            "id": customer.id,
            "email": email,
            "name": name,
            "metadata": meta,
        }

    async def update_customer(
        self,
        stripe_customer_id: str,
        **kwargs,
    ) -> dict:
        """Update a Stripe customer's attributes."""
        stripe = self._get_stripe()
        if stripe is None:
            logger.warning(
                "[billing-mock] update_customer %s: %s",
                stripe_customer_id,
                kwargs,
            )
            return {"id": stripe_customer_id, **kwargs}

        customer = stripe.Customer.modify(stripe_customer_id, **kwargs)
        return {"id": customer.id, "updated": True}

    # ── Subscription management ──────────────────────────────────────

    async def create_subscription(
        self,
        stripe_customer_id: str,
        tier: str,
        modules: list[str] | None = None,
    ) -> dict:
        """Create a subscription with metered billing items.

        Builds subscription items from ``StripeProductConfig``:
        - Base platform price (licensed / recurring)
        - Per-module price (one item per enabled module)
        - Entity metered price (usage_type=metered)
        - Query metered price (usage_type=metered)
        - Storage metered price (usage_type=metered)
        """
        stripe = self._get_stripe()
        if stripe is None:
            mock_sub = f"sub_mock_{uuid.uuid4().hex[:12]}"
            logger.warning(
                "[billing-mock] create_subscription %s tier=%s -> %s "
                "(mock -- not sent to Stripe)",
                stripe_customer_id,
                tier,
                mock_sub,
            )
            return {
                "id": mock_sub,
                "customer": stripe_customer_id,
                "status": "active",
                "tier": tier,
                "modules": modules or [],
            }

        cfg = self._product_config

        # Build subscription items from configured price IDs
        items: list[dict] = []

        # Base platform fee
        if cfg.base_platform_price_id:
            items.append({"price": cfg.base_platform_price_id})

        # Per-module fees
        if cfg.module_price_id and modules:
            for _module in modules:
                items.append({
                    "price": cfg.module_price_id,
                    "metadata": {"module_name": _module},
                })

        # Metered usage prices
        for price_id in (
            cfg.entity_metered_price_id,
            cfg.query_metered_price_id,
            cfg.storage_metered_price_id,
        ):
            if price_id:
                items.append({"price": price_id})

        if not items:
            raise ValueError(
                "No Stripe Price IDs configured in StripeProductConfig. "
                "Cannot create subscription without at least one price item."
            )

        sub = stripe.Subscription.create(
            customer=stripe_customer_id,
            items=items,
            metadata={
                "tier": tier,
                "modules": ",".join(modules or []),
                "lo_platform": "true",
            },
        )
        logger.info(
            "[billing] created subscription %s for customer %s (tier=%s, %d items)",
            sub.id,
            stripe_customer_id,
            tier,
            len(items),
        )
        return {
            "id": sub.id,
            "customer": stripe_customer_id,
            "status": sub.status,
            "tier": tier,
            "items": [
                {"id": item.id, "price": item.price.id}
                for item in sub["items"]["data"]
            ],
        }

    async def update_subscription(
        self,
        subscription_id: str,
        tier: str | None = None,
        modules: list[str] | None = None,
    ) -> dict:
        """Update an existing subscription (tier change, module add/remove)."""
        stripe = self._get_stripe()
        if stripe is None:
            logger.warning(
                "[billing-mock] update_subscription %s tier=%s modules=%s",
                subscription_id,
                tier,
                modules,
            )
            return {
                "id": subscription_id,
                "status": "active",
                "tier": tier,
                "modules": modules,
                "updated": True,
            }

        update_params: dict = {}
        if tier:
            update_params["metadata"] = {"tier": tier}
        if modules is not None:
            update_params.setdefault("metadata", {})["modules"] = ",".join(
                modules
            )

        sub = stripe.Subscription.modify(subscription_id, **update_params)
        return {"id": sub.id, "status": sub.status, "updated": True}

    async def cancel_subscription(
        self,
        subscription_id: str,
        at_period_end: bool = True,
    ) -> dict:
        """Cancel a subscription, optionally at end of billing period."""
        stripe = self._get_stripe()
        if stripe is None:
            logger.warning(
                "[billing-mock] cancel_subscription %s at_period_end=%s",
                subscription_id,
                at_period_end,
            )
            return {
                "id": subscription_id,
                "status": "canceled" if not at_period_end else "active",
                "cancel_at_period_end": at_period_end,
            }

        if at_period_end:
            sub = stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True,
            )
        else:
            sub = stripe.Subscription.delete(subscription_id)

        return {
            "id": sub.id,
            "status": sub.status,
            "cancel_at_period_end": getattr(
                sub, "cancel_at_period_end", False
            ),
        }

    # ── Usage-based billing ──────────────────────────────────────────

    async def report_usage(
        self,
        subscription_item_id: str,
        quantity: int,
        timestamp: datetime | None = None,
    ) -> dict:
        """Report metered usage to Stripe for a subscription item.

        Used for entity, query, and storage overage billing.
        """
        ts = timestamp or datetime.now(timezone.utc)
        ts_unix = int(ts.timestamp())

        stripe = self._get_stripe()
        if stripe is None:
            record_id = f"mbur_mock_{uuid.uuid4().hex[:12]}"
            logger.warning(
                "[billing-mock] report_usage item=%s qty=%d ts=%d -> %s "
                "(mock -- not sent to Stripe)",
                subscription_item_id,
                quantity,
                ts_unix,
                record_id,
            )
            return {
                "id": record_id,
                "subscription_item": subscription_item_id,
                "quantity": quantity,
                "timestamp": ts_unix,
            }

        record = stripe.SubscriptionItem.create_usage_record(
            subscription_item_id,
            quantity=quantity,
            timestamp=ts_unix,
            action="increment",
        )
        logger.info(
            "[billing] reported usage: item=%s qty=%d ts=%d -> %s",
            subscription_item_id,
            quantity,
            ts_unix,
            record.id,
        )
        return {
            "id": record.id,
            "subscription_item": subscription_item_id,
            "quantity": quantity,
            "timestamp": ts_unix,
        }

    # ── Invoice management ───────────────────────────────────────────

    async def create_invoice(
        self,
        stripe_customer_id: str,
        line_items: list[dict],
    ) -> dict:
        """Create a Stripe invoice with explicit line items.

        Each line_item dict should have: description, amount (cents), quantity.
        """
        stripe = self._get_stripe()
        if stripe is None:
            mock_inv = f"in_mock_{uuid.uuid4().hex[:12]}"
            total = sum(
                item.get("amount", 0) * item.get("quantity", 1)
                for item in line_items
            )
            logger.warning(
                "[billing-mock] create_invoice %s total=%d -> %s "
                "(mock -- not sent to Stripe)",
                stripe_customer_id,
                total,
                mock_inv,
            )
            return {
                "id": mock_inv,
                "customer": stripe_customer_id,
                "status": "draft",
                "total": total,
                "currency": "usd",
                "line_items": line_items,
            }

        invoice = stripe.Invoice.create(
            customer=stripe_customer_id,
            auto_advance=False,
        )
        for item in line_items:
            stripe.InvoiceItem.create(
                customer=stripe_customer_id,
                invoice=invoice.id,
                description=item.get("description", ""),
                amount=item.get("amount", 0),
                currency="usd",
                quantity=item.get("quantity", 1),
            )

        # Refresh to get line items
        invoice = stripe.Invoice.retrieve(invoice.id)
        logger.info(
            "[billing] created invoice %s for customer %s (total=%d)",
            invoice.id,
            stripe_customer_id,
            invoice.total,
        )
        return {
            "id": invoice.id,
            "customer": stripe_customer_id,
            "status": invoice.status,
            "total": invoice.total,
            "currency": invoice.currency,
        }

    async def finalize_invoice(self, invoice_id: str) -> dict:
        """Finalize a draft invoice, making it ready for payment."""
        stripe = self._get_stripe()
        if stripe is None:
            logger.warning(
                "[billing-mock] finalize_invoice %s", invoice_id
            )
            return {"id": invoice_id, "status": "open", "finalized": True}

        invoice = stripe.Invoice.finalize_invoice(invoice_id)
        return {"id": invoice.id, "status": invoice.status}

    async def void_invoice(self, invoice_id: str) -> dict:
        """Void an open invoice."""
        stripe = self._get_stripe()
        if stripe is None:
            logger.warning("[billing-mock] void_invoice %s", invoice_id)
            return {"id": invoice_id, "status": "void"}

        invoice = stripe.Invoice.void_invoice(invoice_id)
        return {"id": invoice.id, "status": invoice.status}

    async def get_invoice(self, invoice_id: str) -> dict:
        """Retrieve a single invoice by ID."""
        stripe = self._get_stripe()
        if stripe is None:
            logger.warning("[billing-mock] get_invoice %s", invoice_id)
            return {
                "id": invoice_id,
                "status": "draft",
                "total": 0,
                "currency": "usd",
            }

        invoice = stripe.Invoice.retrieve(invoice_id)
        return {
            "id": invoice.id,
            "customer": invoice.customer,
            "status": invoice.status,
            "total": invoice.total,
            "amount_due": invoice.amount_due,
            "amount_paid": invoice.amount_paid,
            "currency": invoice.currency,
            "hosted_invoice_url": invoice.hosted_invoice_url,
            "pdf": invoice.invoice_pdf,
            "created": invoice.created,
        }

    async def list_invoices(
        self,
        stripe_customer_id: str,
        limit: int = 10,
    ) -> list[dict]:
        """List invoices for a Stripe customer."""
        stripe = self._get_stripe()
        if stripe is None:
            logger.warning(
                "[billing-mock] list_invoices %s limit=%d",
                stripe_customer_id,
                limit,
            )
            return []

        invoices = stripe.Invoice.list(
            customer=stripe_customer_id,
            limit=limit,
        )
        return [
            {
                "id": inv.id,
                "status": inv.status,
                "total": inv.total,
                "currency": inv.currency,
                "created": inv.created,
                "hosted_invoice_url": inv.hosted_invoice_url,
            }
            for inv in invoices.data
        ]

    # ── Payment methods ──────────────────────────────────────────────

    async def list_payment_methods(
        self,
        stripe_customer_id: str,
    ) -> list[PaymentMethod]:
        """List payment methods attached to a Stripe customer."""
        stripe = self._get_stripe()
        if stripe is None:
            logger.warning(
                "[billing-mock] list_payment_methods %s",
                stripe_customer_id,
            )
            return [
                PaymentMethod(
                    id=f"pm_mock_{uuid.uuid4().hex[:8]}",
                    type="card",
                    last_four="4242",
                    brand="visa",
                    exp_month=12,
                    exp_year=2027,
                ),
            ]

        methods = stripe.PaymentMethod.list(
            customer=stripe_customer_id,
            type="card",
        )
        return [
            PaymentMethod(
                id=pm.id,
                type=pm.type,
                last_four=pm.card.last4 if pm.card else "",
                brand=pm.card.brand if pm.card else "",
                exp_month=pm.card.exp_month if pm.card else 0,
                exp_year=pm.card.exp_year if pm.card else 0,
            )
            for pm in methods.data
        ]

    # ── Webhooks ─────────────────────────────────────────────────────

    async def handle_webhook(
        self,
        payload: bytes,
        signature: str,
    ) -> dict:
        """Process Stripe webhook events.

        Verifies the signature using the webhook secret, parses the
        event, and dispatches to the appropriate handler.

        Returns:
            Dict with event type and processing result.
        """
        stripe = self._get_stripe()
        if stripe is None:
            logger.warning(
                "[billing-mock] handle_webhook (mock -- skipping verification)"
            )
            return {"status": "mock", "event_type": "none"}

        if not self._webhook_secret:
            logger.error(
                "[billing] Webhook secret not configured -- rejecting event. "
                "Set stripe_webhook_secret to enable webhook processing."
            )
            return {
                "status": "error",
                "detail": "Webhook secret not configured",
            }

        try:
            event = stripe.Webhook.construct_event(
                payload,
                signature,
                self._webhook_secret,
            )
        except stripe.error.SignatureVerificationError:
            logger.warning(
                "[billing] webhook signature verification failed"
            )
            return {"status": "error", "detail": "Invalid signature"}
        except Exception as exc:
            logger.error("[billing] webhook parse error: %s", exc)
            return {"status": "error", "detail": str(exc)}

        event_type = event["type"]
        data = event["data"]["object"]

        logger.info("[billing] webhook received: %s", event_type)

        handler = self._WEBHOOK_HANDLERS.get(event_type)
        if handler:
            result = await handler(self, data)
            return {
                "status": "processed",
                "event_type": event_type,
                **result,
            }

        logger.debug("[billing] unhandled webhook event: %s", event_type)
        return {"status": "ignored", "event_type": event_type}

    # ── Webhook event handlers ───────────────────────────────────────

    async def _handle_invoice_paid(self, data: dict) -> dict:
        """Handle invoice.paid -- update customer payment status.

        Marks the customer as in good standing and clears any
        payment-failure flags.
        """
        invoice_id = data.get("id", "")
        customer_id = data.get("customer", "")
        amount = data.get("amount_paid", 0)
        logger.info(
            "[billing] invoice paid: %s customer=%s amount=%d",
            invoice_id,
            customer_id,
            amount,
        )

        # Notify the control plane to update customer status
        if self._on_customer_status_change:
            try:
                await self._on_customer_status_change(
                    customer_id, "active"
                )
            except Exception as exc:
                logger.error(
                    "[billing] failed to update customer status on invoice.paid: %s",
                    exc,
                )

        return {
            "invoice_id": invoice_id,
            "amount_paid": amount,
            "customer_status": "active",
        }

    async def _handle_invoice_payment_failed(self, data: dict) -> dict:
        """Handle invoice.payment_failed -- flag customer for dunning.

        Marks the customer as payment_failed, which may trigger
        fork suspension if repeated failures occur.
        """
        invoice_id = data.get("id", "")
        customer_id = data.get("customer", "")
        attempt_count = data.get("attempt_count", 0)
        next_attempt = data.get("next_payment_attempt")

        logger.warning(
            "[billing] payment failed: invoice=%s customer=%s attempt=%d",
            invoice_id,
            customer_id,
            attempt_count,
        )

        # Flag customer as having payment issues
        if self._on_customer_status_change:
            try:
                # Suspend after 3+ failed attempts
                new_status = (
                    "suspended" if attempt_count >= 3 else "payment_failed"
                )
                await self._on_customer_status_change(
                    customer_id, new_status
                )
            except Exception as exc:
                logger.error(
                    "[billing] failed to update customer status on payment failure: %s",
                    exc,
                )

        return {
            "invoice_id": invoice_id,
            "action": "dunning_required",
            "attempt_count": attempt_count,
            "next_attempt": next_attempt,
        }

    async def _handle_subscription_updated(self, data: dict) -> dict:
        """Handle customer.subscription.updated -- sync tier changes.

        Reads the updated subscription metadata to determine if the
        tier or module set has changed, and propagates that change.
        """
        sub_id = data.get("id", "")
        status = data.get("status", "")
        metadata = data.get("metadata", {})
        tier = metadata.get("tier", "")
        customer_id = data.get("customer", "")

        logger.info(
            "[billing] subscription updated: %s status=%s tier=%s",
            sub_id,
            status,
            tier,
        )

        # Map subscription status to customer status
        if self._on_customer_status_change and status in (
            "past_due",
            "unpaid",
        ):
            try:
                await self._on_customer_status_change(
                    customer_id, "suspended"
                )
            except Exception as exc:
                logger.error(
                    "[billing] failed to sync subscription status: %s", exc
                )
        elif self._on_customer_status_change and status == "active":
            try:
                await self._on_customer_status_change(
                    customer_id, "active"
                )
            except Exception as exc:
                logger.error(
                    "[billing] failed to sync subscription status: %s", exc
                )

        return {
            "subscription_id": sub_id,
            "status": status,
            "tier": tier,
        }

    async def _handle_subscription_deleted(self, data: dict) -> dict:
        """Handle customer.subscription.deleted -- initiate fork teardown.

        When a subscription is fully canceled and deleted, this
        triggers the fork teardown process to deprovision the
        customer's infrastructure.
        """
        sub_id = data.get("id", "")
        customer_id = data.get("customer", "")

        logger.info(
            "[billing] subscription deleted: %s customer=%s", sub_id, customer_id
        )

        # Mark customer as churned
        if self._on_customer_status_change:
            try:
                await self._on_customer_status_change(
                    customer_id, "churned"
                )
            except Exception as exc:
                logger.error(
                    "[billing] failed to mark customer as churned: %s", exc
                )

        # Initiate fork teardown
        if self._on_fork_teardown:
            try:
                await self._on_fork_teardown(sub_id)
            except Exception as exc:
                logger.error(
                    "[billing] failed to initiate fork teardown for sub %s: %s",
                    sub_id,
                    exc,
                )

        return {
            "subscription_id": sub_id,
            "action": "fork_teardown_initiated",
        }

    _WEBHOOK_HANDLERS = {
        "invoice.paid": _handle_invoice_paid,
        "invoice.payment_failed": _handle_invoice_payment_failed,
        "customer.subscription.updated": _handle_subscription_updated,
        "customer.subscription.deleted": _handle_subscription_deleted,
    }
