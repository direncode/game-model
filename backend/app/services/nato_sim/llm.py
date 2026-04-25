"""Provider-agnostic LLM wrapper for the NATO Simulation vertical.

Routing logic on every call:
    1. If ``XAI_API_KEY`` (or ``GROK_API_KEY``) is set → use xAI Grok via the
       OpenAI-compatible client. Models default to grok-3 / grok-4.
    2. Else if ``ANTHROPIC_API_KEY`` is set → use Anthropic. Models default
       to claude-sonnet-4-5 / claude-opus-4-1.
    3. Else → raise.

This means an EC2 deployment that already has ANTHROPIC_API_KEY for other
LO services keeps working out of the box; pasting an XAI_API_KEY into
``.env`` later switches transparently. Callers don't change.

Subprocess IP: the system prompts passed to this wrapper are trade-secret
prose that shapes how the NATO sim reasons. Never log raw system prompts
or full responses.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Literal

logger = logging.getLogger(__name__)

# Grok / xAI defaults
XAI_MODEL_ROUTINE = os.environ.get("NATO_SIM_MODEL_ROUTINE", "grok-3")
XAI_MODEL_DEEP = os.environ.get("NATO_SIM_MODEL_DEEP", "grok-4")
XAI_API_BASE = os.environ.get("XAI_API_BASE", "https://api.x.ai/v1")

# Anthropic fallback defaults
ANTHROPIC_MODEL_ROUTINE = os.environ.get(
    "NATO_SIM_ANTHROPIC_MODEL_ROUTINE", "claude-sonnet-4-5"
)
ANTHROPIC_MODEL_DEEP = os.environ.get(
    "NATO_SIM_ANTHROPIC_MODEL_DEEP", "claude-opus-4-1"
)


@dataclass(frozen=True)
class LlmResult:
    text: str
    stop_reason: str
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    provider: str = "unknown"


_xai_client: Any = None
_anthropic_client: Any = None


def _provider() -> Literal["xai", "anthropic"]:
    if os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY"):
        return "xai"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    raise RuntimeError(
        "No LLM provider configured: set XAI_API_KEY (preferred) or ANTHROPIC_API_KEY"
    )


async def _call_xai(
    user_content: str,
    *,
    system: str,
    model_id: str,
    max_tokens: int,
    temperature: float,
    stop_sequences: list[str] | None,
) -> LlmResult:
    global _xai_client
    if _xai_client is None:
        from openai import AsyncOpenAI

        _xai_client = AsyncOpenAI(
            api_key=os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY"),
            base_url=XAI_API_BASE,
        )
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
    resp = await _xai_client.chat.completions.create(**kwargs)
    choice = resp.choices[0]
    text = (choice.message.content or "").strip()
    usage = getattr(resp, "usage", None)
    return LlmResult(
        text=text,
        stop_reason=choice.finish_reason or "",
        input_tokens=getattr(usage, "prompt_tokens", 0) if usage else 0,
        output_tokens=getattr(usage, "completion_tokens", 0) if usage else 0,
        provider="xai",
    )


async def _call_anthropic(
    user_content: str,
    *,
    system: str,
    model_id: str,
    max_tokens: int,
    temperature: float,
    stop_sequences: list[str] | None,
    cache_system: bool,
) -> LlmResult:
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic

        _anthropic_client = anthropic.AsyncAnthropic(
            api_key=os.environ["ANTHROPIC_API_KEY"]
        )
    system_param: Any
    if cache_system:
        system_param = [
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ]
    else:
        system_param = system
    kwargs: dict[str, Any] = {
        "model": model_id,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system_param,
        "messages": [{"role": "user", "content": user_content}],
    }
    if stop_sequences:
        kwargs["stop_sequences"] = stop_sequences
    resp = await _anthropic_client.messages.create(**kwargs)
    text_parts: list[str] = []
    for block in resp.content:
        if getattr(block, "type", None) == "text":
            text_parts.append(block.text)
    return LlmResult(
        text="".join(text_parts).strip(),
        stop_reason=resp.stop_reason or "",
        input_tokens=resp.usage.input_tokens,
        output_tokens=resp.usage.output_tokens,
        cache_read_tokens=getattr(resp.usage, "cache_read_input_tokens", 0) or 0,
        cache_write_tokens=getattr(resp.usage, "cache_creation_input_tokens", 0) or 0,
        provider="anthropic",
    )


async def llm_call(
    user_content: str,
    *,
    system: str,
    model: Literal["routine", "deep"] = "routine",
    max_tokens: int = 2048,
    temperature: float = 0.2,
    cache_system: bool = True,
    stop_sequences: list[str] | None = None,
) -> LlmResult:
    """Provider-routed LLM call. Picks Grok if available, else Anthropic."""
    provider = _provider()
    if provider == "xai":
        model_id = XAI_MODEL_DEEP if model == "deep" else XAI_MODEL_ROUTINE
        return await _call_xai(
            user_content,
            system=system,
            model_id=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            stop_sequences=stop_sequences,
        )
    # anthropic
    model_id = ANTHROPIC_MODEL_DEEP if model == "deep" else ANTHROPIC_MODEL_ROUTINE
    return await _call_anthropic(
        user_content,
        system=system,
        model_id=model_id,
        max_tokens=max_tokens,
        temperature=temperature,
        stop_sequences=stop_sequences,
        cache_system=cache_system,
    )
