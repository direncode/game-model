"""Natural-language description generation for modules.

Deterministic, offline, no external GenAI. All description generation flows
through the lo_core `Generator` ABC. The default is `TemplateGenerator`
(pure stdlib, reproducible). Customers install their own fine-tuned
`Generator` implementation — the interface is stable, the caller
is unchanged.

History: this module previously proxied Anthropic Claude via an
`ANTHROPIC_API_KEY`. That path has been removed — `lo_core` is the
engine, fine-tuning is additive, no external GenAI on the critical path.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from app.services.interpretation.module_analyzer import ModuleAnalysis

logger = logging.getLogger(__name__)


@dataclass
class ModuleDescription:
    """Module description produced by the internal generator."""

    module_id: str
    name: str
    description: str
    confidence: str  # "high", "medium", "low"
    source: str  # "template" (default) or "fine_tuned" (customer-supplied)


class NaturalLanguageDescriber:
    """Generate deterministic module descriptions via the internal generator."""

    def __init__(self, generator: object | None = None) -> None:
        """Initialize with an optional custom generator.

        Args:
            generator: An object exposing `.narrate_module(analysis, purity)`.
                If None, uses the deterministic template describer.
        """
        self._generator = generator

    async def describe(
        self, analysis: ModuleAnalysis, purity_score: float
    ) -> ModuleDescription:
        """Produce a ModuleDescription."""
        if self._generator is not None and hasattr(self._generator, "narrate_module"):
            try:
                out = self._generator.narrate_module(analysis, purity_score)
                if isinstance(out, ModuleDescription):
                    return out
                # Duck-typed dict return
                return ModuleDescription(
                    module_id=getattr(analysis, "module_id", "?"),
                    name=out.get("name", "Unnamed Module"),
                    description=out.get("description", ""),
                    confidence=out.get("confidence", "low"),
                    source="fine_tuned",
                )
            except Exception as e:
                logger.warning(
                    "fine-tuned generator failed for module %s: %s; falling back to template",
                    getattr(analysis, "module_index", "?"), e,
                )
        return self._describe_with_template(analysis, purity_score)

    @staticmethod
    def _describe_with_template(
        analysis: ModuleAnalysis, purity_score: float
    ) -> ModuleDescription:
        """Deterministic template-based description. Zero external deps."""
        dominant_type = "mixed"
        dominant_count = 0
        for t, c in analysis.entity_composition.items():
            if c > dominant_count:
                dominant_type = t
                dominant_count = c

        if purity_score > 0.8:
            name = f"{dominant_type.title()} Cluster"
        elif purity_score > 0.5:
            types = list(analysis.entity_composition.keys())[:2]
            name = f"{'/'.join(t.title() for t in types)} Group"
        else:
            name = f"Mixed Module {analysis.module_index}"

        anchor_names = [a.name for a in analysis.anchor_entities[:3]]
        anchors_str = ", ".join(anchor_names) if anchor_names else "no clear anchors"

        if purity_score > 0.8:
            desc = (
                f"A highly cohesive module of {analysis.entity_count} "
                f"{dominant_type} entities with {purity_score:.0%} type purity. "
                f"Key entities include {anchors_str}."
            )
        elif purity_score > 0.5:
            desc = (
                f"A module of {analysis.entity_count} entities predominantly "
                f"of type {dominant_type} ({purity_score:.0%} purity). "
                f"Central entities: {anchors_str}."
            )
        else:
            desc = (
                f"A diverse module of {analysis.entity_count} entities spanning "
                f"{len(analysis.entity_composition)} types. "
                f"Most connected entities: {anchors_str}."
            )

        if analysis.entity_count >= 10 and purity_score > 0.6:
            confidence = "medium"
        else:
            confidence = "low"

        return ModuleDescription(
            module_id=analysis.module_id,
            name=name,
            description=desc,
            confidence=confidence,
            source="template",
        )

    async def describe_batch(
        self,
        analyses: list[tuple[ModuleAnalysis, float]],
    ) -> list[ModuleDescription]:
        descriptions = []
        for analysis, purity in analyses:
            descriptions.append(await self.describe(analysis, purity))
        logger.info(
            "Generated %d module descriptions (template=%d, fine_tuned=%d)",
            len(descriptions),
            sum(1 for d in descriptions if d.source == "template"),
            sum(1 for d in descriptions if d.source == "fine_tuned"),
        )
        return descriptions
