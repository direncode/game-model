"""Internal model abstraction for the Data Estate vertical.

Pure deterministic implementation. Completions return templated text;
embeddings return deterministic hashed vectors. No external GenAI.

Customer fine-tuning plugs in via the `generator` argument — any object
exposing `.complete(prompt, system, max_tokens)` and/or `.embed(text)`
will be preferred over the built-in defaults.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

_EMBED_DIM = 256


class ModelRouter:
    """Deterministic completion + embedding with a fine-tuning seam."""

    def __init__(
        self,
        provider: str | None = None,
        model: str | None = None,
        embed_model: str | None = None,
        generator: object | None = None,
    ) -> None:
        # `provider` / `model` kept for backward-compat; we no longer
        # route to external APIs. Everything stays local.
        self.provider = "internal"
        self.model = model or "lo_core.template"
        self.embed_model = embed_model or "lo_core.hash256"
        self._generator = generator
        # Silence unused-warning; retained for compat
        _ = provider
        _ = getattr(settings, "DATA_ESTATE_MODEL_PROVIDER", None)

    async def complete(
        self,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 2048,
    ) -> str:
        """Return a deterministic completion. Uses the fine-tuned generator
        if one was supplied at construction time; otherwise produces a
        structural summary of the prompt."""
        if self._generator is not None and hasattr(self._generator, "complete"):
            try:
                out = self._generator.complete(prompt, system=system, max_tokens=max_tokens)
                if isinstance(out, str):
                    return out[:max_tokens * 4]  # rough char cap
            except Exception as e:
                logger.warning("fine-tuned generator.complete failed (%s); using template", e)

        return self._template_complete(prompt, system, max_tokens)

    async def embed(self, text: str) -> list[float]:
        """Return a deterministic 256-D embedding."""
        if self._generator is not None and hasattr(self._generator, "embed"):
            try:
                out = self._generator.embed(text)
                if isinstance(out, list) and out:
                    return [float(x) for x in out]
            except Exception as e:
                logger.warning("fine-tuned generator.embed failed (%s); using hash256", e)

        return self._hash_embed(text)

    # ─── Deterministic defaults ────────────────────────────────────────────

    @staticmethod
    def _template_complete(prompt: str, system: str | None, max_tokens: int) -> str:
        """Deterministic structural summary. Not a substitute for a real LLM,
        but a verifiable, offline, reproducible completion."""
        header = "[internal/template completion]"
        prompt_lines = prompt.strip().splitlines()
        n_lines = len(prompt_lines)
        first = prompt_lines[0][:160] if prompt_lines else ""
        signals: list[str] = []
        if system:
            signals.append(f"system: {system[:80]}")
        signals.append(f"input_lines={n_lines}")
        signals.append(f"max_tokens={max_tokens}")
        signals.append(f"first_line={first!r}")
        return (
            f"{header}\n"
            f"{'; '.join(signals)}\n"
            "This completion is deterministic. For natural-language output, plug "
            "in a fine-tuned generator via ModelRouter(generator=...)."
        )

    @staticmethod
    def _hash_embed(text: str) -> list[float]:
        """Deterministic 256-D embedding via SHA-256 hashing.

        Not semantically meaningful, but stable across runs and sufficient
        for identity checks / deduplication. Customers replace this with a
        trained local embedding model via the `generator` seam.
        """
        text_bytes = (text or "").encode("utf-8")
        vec: list[float] = []
        counter = 0
        while len(vec) < _EMBED_DIM:
            h = hashlib.sha256(text_bytes + counter.to_bytes(4, "big")).digest()
            vec.extend((b / 255.0) * 2.0 - 1.0 for b in h)
            counter += 1
        return vec[:_EMBED_DIM]
