"""Email service using AWS SES for transactional emails."""

from __future__ import annotations

import logging

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


def _get_ses_client():
    """Create an AWS SES client."""
    return boto3.client("ses", region_name=settings.AWS_SES_REGION)


async def send_email(to: str, subject: str, html_body: str) -> None:
    """Send an email via AWS SES.

    Note: boto3 is synchronous but SES send_email is fast (~100ms).
    For high-volume scenarios, consider wrapping in run_in_executor.
    """
    try:
        client = _get_ses_client()
        client.send_email(
            Source=f"{settings.APP_NAME} <{settings.AWS_SES_FROM_EMAIL}>",
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": html_body, "Charset": "UTF-8"},
                },
            },
        )
        logger.info(f"Email sent to {to}: {subject}")
    except ClientError as e:
        logger.error(f"Failed to send email to {to}: {e}")
        raise


async def send_verification_email(email: str, token: str) -> None:
    """Send an email verification link."""
    verification_url = f"{settings.APP_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #0a0a0f; border: 1px solid #1a1a2e; border-radius: 8px; padding: 40px;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0;">Verify your email</h1>
            <p style="color: #9ca3af; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                Welcome to {settings.APP_NAME}. Click the button below to verify your email address
                and activate your account.
            </p>
            <a href="{verification_url}"
               style="display: inline-block; background: #06b6d4; color: #000000; padding: 12px 32px;
                      border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Verify Email
            </a>
            <p style="color: #6b7280; font-size: 13px; margin-top: 32px; line-height: 1.5;">
                If you didn't create an account, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #1a1a2e; margin: 32px 0 16px 0;" />
            <p style="color: #4b5563; font-size: 12px; margin: 0;">
                {settings.APP_NAME} &mdash; Enterprise Structure Discovery
            </p>
        </div>
    </div>
    """
    await send_email(email, f"Verify your email — {settings.APP_NAME}", html)


async def send_password_reset_email(email: str, token: str) -> None:
    """Send a password reset link."""
    reset_url = f"{settings.APP_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #0a0a0f; border: 1px solid #1a1a2e; border-radius: 8px; padding: 40px;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0;">Reset your password</h1>
            <p style="color: #9ca3af; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                We received a request to reset the password for your {settings.APP_NAME} account.
                Click the button below to set a new password. This link expires in 1 hour.
            </p>
            <a href="{reset_url}"
               style="display: inline-block; background: #06b6d4; color: #000000; padding: 12px 32px;
                      border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Reset Password
            </a>
            <p style="color: #6b7280; font-size: 13px; margin-top: 32px; line-height: 1.5;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password will remain unchanged.
            </p>
            <hr style="border: none; border-top: 1px solid #1a1a2e; margin: 32px 0 16px 0;" />
            <p style="color: #4b5563; font-size: 12px; margin: 0;">
                {settings.APP_NAME} &mdash; Enterprise Structure Discovery
            </p>
        </div>
    </div>
    """
    await send_email(email, f"Reset your password — {settings.APP_NAME}", html)
