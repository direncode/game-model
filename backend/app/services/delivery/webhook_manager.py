"""External notification delivery via webhooks, email, and Slack.

Handles HTTP webhooks with retry logic, SMTP email delivery,
and Slack incoming webhook integration.
"""

from __future__ import annotations

import json
import logging
import smtplib
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import httpx
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.delivery import AlertEvent

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 30.0
_MAX_RETRIES = 3


@dataclass
class DeliveryResult:
    """Result of a notification delivery attempt."""

    success: bool
    method: str
    status_code: int | None = None
    error: str | None = None
    attempts: int = 1


class WebhookManager:
    """Manage external notification delivery."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def deliver(
        self,
        method: str,
        config: dict,
        payload: dict,
        event_id: uuid.UUID | None = None,
    ) -> DeliveryResult:
        """Deliver a notification via the specified method.

        Args:
            method: Delivery method (webhook/email/slack).
            config: Method-specific configuration.
            payload: Notification payload.
            event_id: Optional AlertEvent ID to update on delivery.

        Returns:
            DeliveryResult with delivery status.
        """
        result: DeliveryResult

        if method == "webhook":
            result = await self.send_webhook(
                config.get("url", ""), payload
            )
        elif method == "email":
            result = await self.send_email(
                to=config.get("to", ""),
                subject=config.get("subject", "Latent Intelligence Alert"),
                body=json.dumps(payload, indent=2, default=str),
                smtp_config=config.get("smtp"),
            )
        elif method == "slack":
            result = await self.send_slack(
                config.get("webhook_url", ""),
                self._format_slack_message(payload),
            )
        else:
            result = DeliveryResult(
                success=False, method=method, error=f"Unknown method: {method}"
            )

        # Update event delivery status
        if event_id:
            await self._update_event_status(event_id, result)

        return result

    async def send_webhook(
        self, url: str, payload: dict
    ) -> DeliveryResult:
        """Send an HTTP POST webhook with retry logic.

        Args:
            url: Webhook endpoint URL.
            payload: JSON payload to send.

        Returns:
            DeliveryResult with HTTP status.
        """
        if not url:
            return DeliveryResult(
                success=False, method="webhook", error="No URL provided"
            )

        last_error: str | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
                    response = await client.post(
                        url,
                        json=payload,
                        headers={
                            "Content-Type": "application/json",
                            "User-Agent": "LatentIntelligence/1.0",
                        },
                    )

                if response.status_code < 400:
                    logger.info(
                        "Webhook delivered: url=%s, status=%d, attempt=%d",
                        url,
                        response.status_code,
                        attempt,
                    )
                    return DeliveryResult(
                        success=True,
                        method="webhook",
                        status_code=response.status_code,
                        attempts=attempt,
                    )

                last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                logger.warning(
                    "Webhook failed (attempt %d/%d): %s",
                    attempt,
                    _MAX_RETRIES,
                    last_error,
                )

            except httpx.RequestError as exc:
                last_error = str(exc)
                logger.warning(
                    "Webhook request error (attempt %d/%d): %s",
                    attempt,
                    _MAX_RETRIES,
                    exc,
                )

        return DeliveryResult(
            success=False,
            method="webhook",
            error=last_error,
            attempts=_MAX_RETRIES,
        )

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        smtp_config: dict | None = None,
    ) -> DeliveryResult:
        """Send an email notification via SMTP.

        Args:
            to: Recipient email address.
            subject: Email subject line.
            body: Email body (plain text).
            smtp_config: SMTP server configuration.

        Returns:
            DeliveryResult with delivery status.
        """
        if not to:
            return DeliveryResult(
                success=False, method="email", error="No recipient provided"
            )

        config = smtp_config or {}
        host = config.get("host", "localhost")
        port = config.get("port", 587)
        username = config.get("username")
        password = config.get("password")
        from_addr = config.get("from", "noreply@latentintelligence.ai")
        use_tls = config.get("use_tls", True)

        try:
            msg = MIMEMultipart()
            msg["From"] = from_addr
            msg["To"] = to
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            if use_tls:
                server = smtplib.SMTP(host, port)
                server.starttls()
            else:
                server = smtplib.SMTP(host, port)

            if username and password:
                server.login(username, password)

            server.sendmail(from_addr, [to], msg.as_string())
            server.quit()

            logger.info("Email sent: to=%s, subject=%s", to, subject)
            return DeliveryResult(success=True, method="email")

        except Exception as exc:
            logger.exception("Email delivery failed: to=%s", to)
            return DeliveryResult(
                success=False, method="email", error=str(exc)
            )

    async def send_slack(
        self, webhook_url: str, message: dict
    ) -> DeliveryResult:
        """Send a Slack notification via incoming webhook.

        Args:
            webhook_url: Slack incoming webhook URL.
            message: Slack message payload (Block Kit or simple text).

        Returns:
            DeliveryResult with delivery status.
        """
        if not webhook_url:
            return DeliveryResult(
                success=False, method="slack", error="No webhook URL provided"
            )

        try:
            async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
                response = await client.post(
                    webhook_url,
                    json=message,
                    headers={"Content-Type": "application/json"},
                )

            if response.status_code == 200:
                logger.info("Slack notification sent")
                return DeliveryResult(
                    success=True,
                    method="slack",
                    status_code=200,
                )

            return DeliveryResult(
                success=False,
                method="slack",
                status_code=response.status_code,
                error=response.text[:200],
            )

        except Exception as exc:
            logger.exception("Slack delivery failed")
            return DeliveryResult(
                success=False, method="slack", error=str(exc)
            )

    @staticmethod
    def _format_slack_message(payload: dict) -> dict:
        """Format a payload as a Slack Block Kit message."""
        title = payload.get("title", "Latent Intelligence Alert")
        details = json.dumps(payload.get("details", {}), indent=2, default=str)

        return {
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": title[:150]},
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"```{details[:2900]}```",
                    },
                },
            ],
        }

    async def _update_event_status(
        self, event_id: uuid.UUID, result: DeliveryResult
    ) -> None:
        """Update AlertEvent delivery status."""
        await self._db.execute(
            update(AlertEvent)
            .where(AlertEvent.id == event_id)
            .values(
                delivered=result.success,
                delivered_at=(
                    datetime.now(timezone.utc) if result.success else None
                ),
            )
        )
        await self._db.flush()
