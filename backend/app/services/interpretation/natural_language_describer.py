"""LLM-powered natural language description generation for modules.

Uses the Anthropic Claude API to generate human-readable names and
descriptions for crystallized modules. Falls back to template-based
descriptions when the API is unavailable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.config import settings
from app.services.interpretation.module_analyzer import ModuleAnalysis

logger = logging.getLogger(__name__)


@dataclass
class ModuleDescription:
    """LLM-generated or template-based module description."""

    module_id: str
    name: str
    description: str
    confidence: str  # "high", "medium", "low"
    source: str  # "llm" or "template"


class NaturalLanguageDescriber:
    """Generate human-readable module descriptions using LLM or templates."""

    def __init__(self, anthropic_client: Any | None = None) -> None:
        self._client = anthropic_client
        self._api_key = settings.ANTHROPIC_API_KEY

    async def describe(
        self, analysis: ModuleAnalysis, purity_score: float
    ) -> ModuleDescription:
        """Generate a description for a module.

        Attempts to use Claude API first, then falls back to template.

        Args:
            analysis: Statistical analysis of the module.
            purity_score: Type purity score (0-1).

        Returns:
            ModuleDescription with name, description, and confidence.
        """
        if self._api_key:
            try:
                return await self._describe_with_llm(analysis, purity_score)
            except Exception:
                logger.warning(
                    "LLM description failed for module %d, using template",
                    analysis.module_index,
                )

        return self._describe_with_template(analysis, purity_score)

    async def _describe_with_llm(
        self, analysis: ModuleAnalysis, purity_score: float
    ) -> ModuleDescription:
        """Generate description using Claude API."""
        import anthropic

        client = self._client or anthropic.AsyncAnthropic(api_key=self._api_key)

        # Build context prompt
        anchor_names = [a.name for a in analysis.anchor_entities]
        composition_str = ", ".join(
            f"{t}: {c}" for t, c in analysis.entity_composition.items()
        )
        external_str = ", ".join(
            f"{ec['entity']} ({ec['connection_count']} connections)"
            for ec in analysis.external_connected_modules[:5]
        )

        prompt = (
            f"Analyze this data module from a knowledge graph crystallization:\n\n"
            f"Module Index: {analysis.module_index}\n"
            f"Entity Count: {analysis.entity_count}\n"
            f"Entity Types: {composition_str}\n"
            f"Type Purity: {purity_score:.2f}\n"
            f"Internal Density: {analysis.internal_density:.4f}\n"
            f"Anchor Entities (most connected): {', '.join(anchor_names)}\n"
            f"External Connections: {external_str or 'None'}\n\n"
            f"Provide:\n"
            f"1. A concise name for this module (3-6 words)\n"
            f"2. A description (2-3 sentences) explaining what this module represents\n"
            f"3. Confidence level: high, medium, or low\n\n"
            f"Format your response as:\n"
            f"NAME: <name>\n"
            f"DESCRIPTION: <description>\n"
            f"CONFIDENCE: <high|medium|low>"
        )

        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text
        return self._parse_llm_response(analysis.module_id, text)

    def _parse_llm_response(
        self, module_id: str, text: str
    ) -> ModuleDescription:
        """Parse structured LLM response into ModuleDescription."""
        name = "Unnamed Module"
        description = ""
        confidence = "medium"

        for line in text.strip().split("\n"):
            line = line.strip()
            if line.upper().startswith("NAME:"):
                name = line[5:].strip()
            elif line.upper().startswith("DESCRIPTION:"):
                description = line[12:].strip()
            elif line.upper().startswith("CONFIDENCE:"):
                conf = line[11:].strip().lower()
                if conf in ("high", "medium", "low"):
                    confidence = conf

        # If description spans multiple lines, capture continuation
        if not description:
            lines = text.strip().split("\n")
            if len(lines) >= 2:
                description = lines[1].strip()

        return ModuleDescription(
            module_id=module_id,
            name=name,
            description=description or "No description generated.",
            confidence=confidence,
            source="llm",
        )

    @staticmethod
    def _describe_with_template(
        analysis: ModuleAnalysis, purity_score: float
    ) -> ModuleDescription:
        """Generate template-based description as LLM fallback."""
        # Determine dominant type
        dominant_type = "mixed"
        dominant_count = 0
        for t, c in analysis.entity_composition.items():
            if c > dominant_count:
                dominant_type = t
                dominant_count = c

        # Build name
        if purity_score > 0.8:
            name = f"{dominant_type.title()} Cluster"
        elif purity_score > 0.5:
            types = list(analysis.entity_composition.keys())[:2]
            name = f"{'/'.join(t.title() for t in types)} Group"
        else:
            name = f"Mixed Module {analysis.module_index}"

        # Build description
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

        # Confidence based on data quality
        if analysis.entity_count >= 10 and purity_score > 0.6:
            confidence = "medium"
        elif analysis.entity_count >= 5:
            confidence = "low"
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
        """Generate descriptions for multiple modules.

        Args:
            analyses: List of (ModuleAnalysis, purity_score) tuples.

        Returns:
            List of ModuleDescription instances.
        """
        descriptions = []
        for analysis, purity in analyses:
            desc = await self.describe(analysis, purity)
            descriptions.append(desc)

        logger.info(
            "Generated %d module descriptions (llm=%d, template=%d)",
            len(descriptions),
            sum(1 for d in descriptions if d.source == "llm"),
            sum(1 for d in descriptions if d.source == "template"),
        )
        return descriptions
