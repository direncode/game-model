"""RAG Synthesizer — Claude-powered analysis from BTUT signal + source documents.

Combines BTUT structural signal (scores, fingerprint, anomaly tags) with
primary source excerpts (SEC filings, PubMed abstracts) and uses Claude
to produce grounded, citation-backed analysis.

Ported from app.services.btut.rag_synthesizer. Changes from original:
  - Removed ``from app.config import settings`` dependency.
  - ``RAGSynthesizer.__init__`` requires an explicit ``api_key`` parameter
    (no fallback to app settings).
  - ``synthesize_cached`` requires an explicit ``redis_url`` parameter.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"


@dataclass
class BTUTContext:
    """BTUT structural signal for an entity."""
    entity_key: str = ""
    entity_name: str = ""
    entity_type: str = ""
    dataset_id: str = ""
    scores: dict = field(default_factory=dict)
    structural_role: str = ""
    role_description: str = ""
    fingerprint: str = ""
    flips: int = 0
    cluster_id: int = -1
    cluster_size: int = 0
    anomaly_tags: list[dict] = field(default_factory=list)
    anomaly_story: str = ""
    peer_network: list[dict] = field(default_factory=list)
    attributes: dict = field(default_factory=dict)


@dataclass
class Citation:
    """A citation linking analysis to a source document."""
    source_id: str = ""
    source_type: str = ""
    source_url: str = ""
    excerpt: str = ""
    relevance: str = ""


@dataclass
class RAGSynthesis:
    """Complete RAG analysis output."""
    entity_key: str = ""
    dataset_id: str = ""
    executive_summary: str = ""
    structural_analysis: str = ""
    source_evidence: list[Citation] = field(default_factory=list)
    anomaly_explanation: str = ""
    risk_assessment: str = ""
    opportunity_assessment: str = ""
    confidence_note: str = ""
    generated_at: str = ""
    model: str = MODEL
    chunk_count_used: int = 0

    def to_dict(self) -> dict:
        return {
            "entity_key": self.entity_key,
            "dataset_id": self.dataset_id,
            "executive_summary": self.executive_summary,
            "structural_analysis": self.structural_analysis,
            "source_evidence": [
                {"source_id": c.source_id, "source_type": c.source_type,
                 "source_url": c.source_url, "excerpt": c.excerpt, "relevance": c.relevance}
                for c in self.source_evidence
            ],
            "anomaly_explanation": self.anomaly_explanation,
            "risk_assessment": self.risk_assessment,
            "opportunity_assessment": self.opportunity_assessment,
            "confidence_note": self.confidence_note,
            "generated_at": self.generated_at,
            "model": self.model,
            "chunk_count_used": self.chunk_count_used,
        }


class RAGSynthesizer:
    """Synthesize BTUT structural signal + source documents via Claude.

    Parameters
    ----------
    api_key : str
        Anthropic API key (required -- no fallback to app settings).
    """

    def __init__(self, api_key: str):
        self._api_key = api_key

    async def synthesize(
        self,
        btut_context: BTUTContext,
        chunks: list,
        focus: str = "general",
    ) -> RAGSynthesis:
        """Generate Claude-powered analysis from BTUT signal + source chunks."""
        if not self._api_key:
            logger.warning("No Anthropic API key -- returning template-based synthesis")
            return self._template_synthesis(btut_context, chunks)

        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=self._api_key)

            prompt = self._build_prompt(btut_context, chunks, focus)

            response = await client.messages.create(
                model=MODEL,
                max_tokens=2500,
                messages=[{"role": "user", "content": prompt}],
            )

            text = response.content[0].text if response.content else ""
            synthesis = self._parse_response(text, btut_context, chunks)
            synthesis.generated_at = datetime.utcnow().isoformat()
            synthesis.chunk_count_used = len(chunks)

            logger.info(
                "RAG synthesis complete for %s: %d chunks, %d citations",
                btut_context.entity_key, len(chunks), len(synthesis.source_evidence),
            )
            return synthesis

        except Exception as e:
            logger.error("Claude synthesis failed: %s", e)
            return self._template_synthesis(btut_context, chunks)

    async def synthesize_cached(
        self,
        btut_context: BTUTContext,
        chunks: list,
        focus: str = "general",
        redis_url: str = "",
    ) -> tuple[RAGSynthesis, bool]:
        """Synthesize with Redis caching. Returns (synthesis, was_cached).

        Parameters
        ----------
        redis_url : str
            Redis connection URL. If empty, caching is skipped.
        """
        cache_key = f"btut_rag:{btut_context.dataset_id}:{btut_context.entity_key}"

        if redis_url:
            try:
                import redis.asyncio as aioredis
                r = aioredis.from_url(redis_url)
                cached = await r.get(cache_key)
                if cached:
                    data = json.loads(cached)
                    synthesis = RAGSynthesis(**{
                        k: v for k, v in data.items()
                        if k != "source_evidence"
                    })
                    synthesis.source_evidence = [
                        Citation(**c) for c in data.get("source_evidence", [])
                    ]
                    await r.close()
                    return synthesis, True
            except Exception:
                pass

        synthesis = await self.synthesize(btut_context, chunks, focus)

        if redis_url:
            try:
                import redis.asyncio as aioredis
                r = aioredis.from_url(redis_url)
                await r.setex(cache_key, 3600, json.dumps(synthesis.to_dict()))
                await r.close()
            except Exception:
                pass

        return synthesis, False

    def _build_prompt(
        self, ctx: BTUTContext, chunks: list, focus: str,
    ) -> str:
        """Build the synthesis prompt combining BTUT signal + source excerpts."""
        scores = ctx.scores

        btut_section = f"""## BTUT STRUCTURAL SIGNAL

Entity: {ctx.entity_name} ({ctx.entity_type})
Key: {ctx.entity_key}
Dataset: {ctx.dataset_id}

Composite Score: {scores.get('composite', 0):.4f}
Diversity Score: {scores.get('diversity', 0):.4f} (how unique the structural fingerprint is)
Reconstruction Score: {scores.get('reconstruction', 0):.4f} (how important for dataset coverage)
Anomaly Score: {scores.get('anomaly', 0):.4f} (how different from its type peers)

Structural Role: {ctx.structural_role} -- {ctx.role_description}
Lattice Fingerprint: {ctx.fingerprint} ({ctx.flips}/48 flips)
Cluster: #{ctx.cluster_id} ({ctx.cluster_size} members)

Anomaly Tags:
{chr(10).join(f"- [{t.get('severity', '')}] {t.get('tag', '')}: {t.get('description', '')}" for t in ctx.anomaly_tags[:5])}

Pre-existing Analysis: {ctx.anomaly_story}
"""

        if ctx.peer_network:
            btut_section += "\nNearest Structural Peers:\n"
            for p in ctx.peer_network[:3]:
                btut_section += f"- {p.get('name', '')} ({p.get('type', '')}) -- {p.get('similarity', 0)*100:.0f}% similar\n"

        source_section = "## PRIMARY SOURCE DOCUMENTS\n\n"
        if chunks:
            for i, chunk in enumerate(chunks[:15]):
                source_section += f"[SOURCE {i+1}] ({chunk.source_type} | {chunk.source_id} | {chunk.section})\n"
                source_section += f"{chunk.chunk_text[:800]}\n\n---\n\n"
        else:
            source_section += "No primary source documents available. Analyze based on BTUT structural signal only.\n"

        instructions = """## INSTRUCTIONS

Based on the BTUT structural analysis and the primary source documents above, produce a structured analysis with these sections. Be specific, cite sources by [SOURCE N] number, and explain whether the source evidence corroborates or contradicts the BTUT structural signal.

EXECUTIVE_SUMMARY:
2-3 sentences summarizing the key finding. What makes this entity structurally noteworthy and what do the sources reveal?

STRUCTURAL_ANALYSIS:
Explain the BTUT scores in plain language. Why does this entity score high/low on each axis? What does the fingerprint pattern indicate?

SOURCE_EVIDENCE:
For each relevant source, provide:
CITATION: [SOURCE N] -- one-sentence excerpt
RELEVANCE: How this evidence relates to the structural anomaly

ANOMALY_EXPLANATION:
Why did BTUT flag this entity? Ground the explanation in the source documents. What specific content in the filings/papers/data explains the structural uniqueness?

RISK_ASSESSMENT:
Based on the structural signal and sources, what risks does this entity face? Be specific.

OPPORTUNITY_ASSESSMENT:
What opportunities or positive signals exist? Be specific.

CONFIDENCE_NOTE:
Do the primary sources corroborate the BTUT structural signal? Rate your confidence (HIGH/MEDIUM/LOW) and explain why.
"""

        return btut_section + source_section + instructions

    def _parse_response(
        self, text: str, ctx: BTUTContext, chunks: list,
    ) -> RAGSynthesis:
        """Parse Claude's structured response into RAGSynthesis."""
        synthesis = RAGSynthesis(
            entity_key=ctx.entity_key,
            dataset_id=ctx.dataset_id,
        )

        sections = {
            "EXECUTIVE_SUMMARY": "executive_summary",
            "STRUCTURAL_ANALYSIS": "structural_analysis",
            "ANOMALY_EXPLANATION": "anomaly_explanation",
            "RISK_ASSESSMENT": "risk_assessment",
            "OPPORTUNITY_ASSESSMENT": "opportunity_assessment",
            "CONFIDENCE_NOTE": "confidence_note",
        }

        current_section = None
        current_text: list[str] = []

        for line in text.split("\n"):
            stripped = line.strip()

            found_section = False
            for header, field_name in sections.items():
                if stripped.startswith(header):
                    if current_section:
                        setattr(synthesis, current_section, "\n".join(current_text).strip())
                    current_section = field_name
                    current_text = []
                    after = stripped[len(header):].lstrip(":").strip()
                    if after:
                        current_text.append(after)
                    found_section = True
                    break

            if not found_section and current_section:
                if current_section == "source_evidence_raw":
                    pass
                else:
                    current_text.append(line)

        if current_section:
            setattr(synthesis, current_section, "\n".join(current_text).strip())

        # Extract citations from SOURCE_EVIDENCE section
        source_evidence_text = ""
        in_source_evidence = False
        for line in text.split("\n"):
            stripped = line.strip()
            if stripped.startswith("SOURCE_EVIDENCE"):
                in_source_evidence = True
                continue
            if in_source_evidence:
                if any(stripped.startswith(h) for h in sections if h != "SOURCE_EVIDENCE"):
                    break
                source_evidence_text += line + "\n"

        citations = []
        current_citation = None
        for line in source_evidence_text.split("\n"):
            stripped = line.strip()
            if stripped.startswith("CITATION:"):
                if current_citation:
                    citations.append(current_citation)
                excerpt = stripped[len("CITATION:"):].strip()
                source_ref = ""
                if "[SOURCE" in excerpt:
                    match = re.search(r'\[SOURCE\s+(\d+)\]', excerpt)
                    if match:
                        idx = int(match.group(1)) - 1
                        if 0 <= idx < len(chunks):
                            source_ref = chunks[idx].source_id
                current_citation = Citation(
                    source_id=source_ref,
                    source_type=chunks[0].source_type if chunks else "",
                    source_url=chunks[0].source_url if chunks else "",
                    excerpt=excerpt,
                )
            elif stripped.startswith("RELEVANCE:") and current_citation:
                current_citation.relevance = stripped[len("RELEVANCE:"):].strip()

        if current_citation:
            citations.append(current_citation)

        synthesis.source_evidence = citations
        return synthesis

    def _template_synthesis(
        self, ctx: BTUTContext, chunks: list,
    ) -> RAGSynthesis:
        """Fallback template-based synthesis when Claude is unavailable."""
        scores = ctx.scores
        chunk_summary = f"{len(chunks)} source documents indexed" if chunks else "No source documents available"

        return RAGSynthesis(
            entity_key=ctx.entity_key,
            dataset_id=ctx.dataset_id,
            executive_summary=(
                f"{ctx.entity_name} ({ctx.entity_type}) is classified as {ctx.structural_role} "
                f"with a composite signal score of {scores.get('composite', 0):.3f}. "
                f"{chunk_summary}. {ctx.anomaly_story}"
            ),
            structural_analysis=(
                f"Composite: {scores.get('composite', 0):.4f} | "
                f"Anomaly: {scores.get('anomaly', 0):.4f} | "
                f"Diversity: {scores.get('diversity', 0):.4f} | "
                f"Reconstruction: {scores.get('reconstruction', 0):.4f}. "
                f"Lattice fingerprint shows {ctx.flips}/48 dimensional flips."
            ),
            anomaly_explanation=ctx.anomaly_story,
            risk_assessment="Requires Claude API key for source-grounded risk assessment.",
            opportunity_assessment="Requires Claude API key for source-grounded opportunity assessment.",
            confidence_note=f"Template-based analysis. {chunk_summary}.",
            generated_at=datetime.utcnow().isoformat(),
            model="template",
            chunk_count_used=len(chunks),
        )
