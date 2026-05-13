"""Narrate operators — deterministic plain-English summaries of aligned modules.

Vendored open-core shape: instance-based registry rather than the
@register decorator used by the closed-source full runtime. The class
itself has the same surface as the source-of-truth narrate.py; only the
registration shim at the bottom differs.

This module is non-proprietary and ships in the open-core wheel.
"""
from __future__ import annotations

from typing import Any


class NarratePlainEnglish:
    """Per-module plain-English narration.

    Output is byte-identical for any given input — no LLM sampling, no
    random seeds beyond what callers pass. ``narrate every module using
    N nearest records`` from an OCEAN program flows through here.

    config:
        top_k_alt_labels:      int  — alternative labels to list (default 2)
        include_sample_titles: bool — append up to 3 nearest-record titles
                                      from the alignment block (default True)
    """

    kind = "narrate.plain_english"
    stage = "narrate"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        config = config or {}
        modules = inputs.get("aligned_modules") or inputs.get("modules") or []
        top_k_alt = int(config.get("top_k_alt_labels", 2))
        include_titles = bool(config.get("include_sample_titles", True))
        label_field = inputs.get("label_field", "label")

        out = [
            self._narrate_module(m, top_k_alt=top_k_alt, include_titles=include_titles)
            for m in modules
        ]
        return {
            "aligned_modules": out,
            "label_field":     label_field,
        }

    def _narrate_module(
        self,
        module: dict,
        *,
        top_k_alt: int,
        include_titles: bool,
    ) -> dict:
        m = dict(module)
        align = module.get("alignment") or {}
        if not align:
            m["narrative"] = (
                f"Module {module.get('module_id', '?')} has no alignment "
                "data; no narrative available."
            )
            return m

        mid = module.get("module_id", "?")
        n_near = align.get("k_nearest", 0)
        dom_label = align.get("dominant_label", "?")
        dom_share_pct = int(round(float(align.get("dominant_share", 0.0)) * 100))
        bleed_pct = int(round(float(align.get("bleed_share", 0.0)) * 100))
        top3 = align.get("top3_labels") or []
        alt_labels = [t.get("label") for t in top3[1: 1 + top_k_alt] if t.get("label")]

        parts: list[str] = [
            f"Module {mid}: of {n_near} nearest records, "
            f"{dom_share_pct}% lean toward label \"{dom_label}\""
        ]
        if alt_labels:
            quoted = ", ".join(f"\"{a}\"" for a in alt_labels)
            parts.append(f"with {bleed_pct}% spread across {quoted}")
        else:
            parts.append(f"with {bleed_pct}% spread elsewhere")

        cs = module.get("centroid_stats") or {}
        if cs:
            norm = cs.get("norm")
            std = cs.get("std")
            dim = cs.get("dim")
            if norm is not None and std is not None and dim:
                parts.append(
                    f"centroid norm {norm}, std {std} over {dim}-D embedding"
                )

        topo = module.get("topology") or {}
        persistence = topo.get("persistence") if isinstance(topo, dict) else None
        if persistence is not None:
            parts.append(
                f"persistent-homology lifespan {persistence} in dim "
                f"{topo.get('homology_dim', '?')}"
            )

        narrative = "; ".join(parts) + "."

        if include_titles:
            samples = align.get("sample_records") or []
            titles = [s.get("title") for s in samples[:3] if s.get("title")]
            if titles:
                joined = " | ".join(t[:60] for t in titles)
                narrative += f" Examples: {joined}."

        m["narrative"] = narrative
        return m


class NarrateLlmSummary:
    """LLM-narrated module summaries via the Anthropic API.

    Free-tier operator. Requires the user to set their own
    ``ANTHROPIC_API_KEY``. Falls back to ``NarratePlainEnglish`` if the
    key or SDK is missing so the OCEAN program completes regardless.
    """

    kind = "narrate.llm_summary"
    stage = "narrate"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        import os

        config = config or {}
        modules = inputs.get("aligned_modules") or inputs.get("modules") or []
        label_field = inputs.get("label_field", "label")
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        model = config.get("model", "claude-haiku-4-5-20251001")
        max_tokens = int(config.get("max_tokens", 200))
        temperature = float(config.get("temperature", 0.0))

        client = self._make_client(api_key)
        if client is None:
            fallback = NarratePlainEnglish()
            result = fallback.run(inputs, seed=seed, config=config)
            for m in result["aligned_modules"]:
                m["narrative_source"] = "template_fallback"
            result["narrator_model"] = "template_fallback"
            return result

        out = [
            self._narrate_with_llm(m, client=client, model=model,
                                   max_tokens=max_tokens,
                                   temperature=temperature)
            for m in modules
        ]
        return {
            "aligned_modules": out,
            "label_field":     label_field,
            "narrator_model":  model,
        }

    @staticmethod
    def _make_client(api_key: str):
        if not api_key:
            return None
        try:
            import anthropic  # type: ignore
        except ImportError:
            return None
        try:
            return anthropic.Anthropic(api_key=api_key)
        except Exception:
            return None

    def _narrate_with_llm(self, module: dict, *, client, model: str,
                          max_tokens: int, temperature: float) -> dict:
        m = dict(module)
        align = module.get("alignment") or {}
        if not align:
            m["narrative"] = (
                f"Module {module.get('module_id', '?')} has no alignment data."
            )
            m["narrative_source"] = "no_data"
            return m

        prompt = self._render_prompt(module, align)
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=(
                    "You write one-sentence summaries of unsupervised "
                    "clusters. Stay factual; do not invent labels."
                ),
                messages=[{"role": "user", "content": prompt}],
            )
            text_chunks = [
                block.text for block in resp.content
                if getattr(block, "type", "") == "text"
            ]
            narrative = " ".join(text_chunks).strip() or "(empty response)"
            m["narrative"] = narrative
            m["narrative_source"] = "anthropic_llm"
        except Exception as e:  # noqa: BLE001
            m["narrative"] = (
                f"Module {module.get('module_id', '?')}: LLM call failed "
                f"({type(e).__name__}); template fallback used."
            )
            m["narrative_source"] = "llm_error_fallback"
        return m

    @staticmethod
    def _render_prompt(module: dict, align: dict) -> str:
        mid = module.get("module_id", "?")
        dom = align.get("dominant_label", "?")
        dom_pct = int(round(float(align.get("dominant_share", 0.0)) * 100))
        bleed_pct = int(round(float(align.get("bleed_share", 0.0)) * 100))
        top3 = align.get("top3_labels") or []
        samples = align.get("sample_records") or []
        sample_titles = "\n".join(
            f"  - {s.get('title', '')[:80]}"
            for s in samples[:3] if s.get("title")
        )
        return (
            f"Cluster id: {mid}\n"
            f"Dominant label: {dom} ({dom_pct}%)\n"
            f"Bleed across other labels: {bleed_pct}%\n"
            f"Top-3 labels: {top3}\n"
            f"Sample records:\n{sample_titles}\n\n"
            "Write a single sentence that names what binds these records "
            "together. Reference only labels and concepts that appear above."
        )


# ── Per-module registry ──────────────────────────────────────────────────

_REGISTRY: dict[str, Any] = {
    "narrate.plain_english": NarratePlainEnglish(),
    "narrate.llm_summary":   NarrateLlmSummary(),
}


def get(name: str):
    """Return the operator instance registered under `name`, or None."""
    return _REGISTRY.get(name)
