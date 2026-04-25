"""Thin xAI (Grok) client wrapper for the NATO Simulation vertical.

xAI's API is OpenAI-compatible — we point the OpenAI SDK at
``https://api.x.ai/v1`` and everything downstream works unchanged. Only
this file knows the provider; ``resolver.py``, ``synthesizer.py``, and
every caller use the provider-agnostic ``llm_call`` interface.

Subprocess IP: the system prompts passed to this wrapper are trade-secret
prose that shapes how the NATO sim reasons. They live in callers and are
hashed to xAI. Never log raw system prompts or responses.

Env vars:
    XAI_API_KEY              — required
    NATO_SIM_MODEL_ROUTINE   — default "grok-3"
    NATO_SIM_MODEL_DEEP      — default "grok-4"
    XAI_API_BASE             — default "https://api.x.ai/v1"

Note: Grok does not currently implement Anthropic-style prompt caching.
The ``cache_system`` parameter is accepted for interface compatibility
but ignored. Future swap back to Anthropic would re-enable it without
any caller changes.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Literal

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Model aliases. Override via env at deploy time.
MODEL_ROUTINE = os.environ.get("NATO_SIM_MODEL_ROUTINE", "grok-3")
MODEL_DEEP = os.environ.get("NATO_SIM_MODEL_DEEP", "grok-4")
API_BASE = os.environ.get("XAI_API_BASE", "https://api.x.ai/v1")


@dataclass(frozen=True)
class LlmResult:
    text: str
    stop_reason: str
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int = 0  # Grok doesn't expose cache stats
    cache_write_tokens: int = 0


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        key = os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY")
        if not key:
            raise RuntimeError(
                "XAI_API_KEY (or GROK_API_KEY) is not set in the environment"
            )
        _client = AsyncOpenAI(api_key=key, base_url=API_BASE)
    return _client


async def llm_call(
    user_content: str,
    *,
    system: str,
    model: Literal["routine", "deep"] = "routine",
    max_tokens: int = 2048,
    temperature: float = 0.2,
    cache_system: bool = True,  # kept for interface compat; ignored on Grok
    stop_sequences: list[str] | None = None,
) -> LlmResult:
    """Call Grok with a system prompt + single user turn.

    Returns an ``LlmResult``. The ``cache_system`` arg is a no-op under
    the Grok backend; it's retained so callers compose cleanly if we
    swap providers later.
    """
    del cache_system  # explicit: we ignore it on Grok

    client = _get_client()
    model_id = MODEL_DEEP if model == "deep" else MODEL_ROUTINE

    kwargs: dict[str, Any] = {
        "model": model_id,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
    }
    if stop_sequences:
        kwargs["stop"] = stop_sequences

    resp = await client.chat.completions.create(**kwargs)

    choice = resp.choices[0]
    text = (choice.message.content or "").strip()

    usage = getattr(resp, "usage", None)
    input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
    output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0

    return LlmResult(
        text=text,
        stop_reason=choice.finish_reason or "",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
