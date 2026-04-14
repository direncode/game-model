"""Provider-agnostic LLM abstraction for the Data Estate vertical.

Supports Anthropic, xAI (Grok), and OpenAI. Provider and model are
configured via environment variables.
"""
from __future__ import annotations

import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class ModelRouter:
    """Configurable LLM provider for completions and embeddings."""

    def __init__(
        self,
        provider: str | None = None,
        model: str | None = None,
        embed_model: str | None = None,
    ) -> None:
        self.provider = provider or getattr(
            settings, "DATA_ESTATE_MODEL_PROVIDER", "anthropic"
        )
        self.model = model or getattr(
            settings, "DATA_ESTATE_MODEL_NAME", "claude-sonnet-4-6"
        )
        self.embed_model = embed_model or getattr(
            settings, "DATA_ESTATE_EMBED_MODEL", ""
        )

    async def complete(
        self,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 2048,
    ) -> str:
        if self.provider == "anthropic":
            return await self._anthropic_complete(prompt, system, max_tokens)
        if self.provider == "xai":
            return await self._xai_complete(prompt, system, max_tokens)
        if self.provider == "openai":
            return await self._openai_complete(prompt, system, max_tokens)
        raise ValueError(f"Unknown model provider: {self.provider}")

    async def embed(self, text: str) -> list[float]:
        if self.provider == "xai":
            return await self._xai_embed(text)
        if self.provider == "openai":
            return await self._openai_embed(text)
        return self._fallback_embed(text)

    async def _anthropic_complete(
        self, prompt: str, system: str | None, max_tokens: int
    ) -> str:
        try:
            from anthropic import AsyncAnthropic

            client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
            kwargs: dict[str, Any] = {
                "model": self.model,
                "max_tokens": max_tokens,
                "messages": messages,
            }
            if system:
                kwargs["system"] = system
            response = await client.messages.create(**kwargs)
            return response.content[0].text
        except Exception as exc:
            logger.error("Anthropic completion failed: %s", exc)
            raise

    async def _xai_complete(
        self, prompt: str, system: str | None, max_tokens: int
    ) -> str:
        try:
            import httpx

            api_key = getattr(settings, "XAI_API_KEY", "")
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.x.ai/v1/chat/completions",
                    headers=headers,
                    json={"model": self.model, "messages": messages, "max_tokens": max_tokens},
                    timeout=60.0,
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.error("xAI completion failed: %s", exc)
            raise

    async def _openai_complete(
        self, prompt: str, system: str | None, max_tokens: int
    ) -> str:
        try:
            import httpx

            api_key = getattr(settings, "OPENAI_API_KEY", "")
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json={"model": self.model, "messages": messages, "max_tokens": max_tokens},
                    timeout=60.0,
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.error("OpenAI completion failed: %s", exc)
            raise

    async def _xai_embed(self, text: str) -> list[float]:
        import httpx

        api_key = getattr(settings, "XAI_API_KEY", "")
        model = self.embed_model or "v1"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.x.ai/v1/embeddings",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "input": text},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()["data"][0]["embedding"]

    async def _openai_embed(self, text: str) -> list[float]:
        import httpx

        api_key = getattr(settings, "OPENAI_API_KEY", "")
        model = self.embed_model or "text-embedding-3-small"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "input": text},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()["data"][0]["embedding"]

    def _fallback_embed(self, text: str) -> list[float]:
        import hashlib
        h = hashlib.sha256(text.encode()).digest()
        return [float(b) / 255.0 for b in h]
