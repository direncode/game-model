"""Deterministic AI agent for TCD-JEPA intelligence queries.

v0: keyword-matched responses sourced from cached intelligence results.
Ready for LLM integration — swap _match_keywords for an API call.
"""
from __future__ import annotations

from typing import Any

from . import intelligence_cache


_KEYWORD_MAP = {
    "hidden": ("causal", "Look at causal chain and intervention analysis results."),
    "dependency": ("causal", "Causal intelligence reveals hidden dependencies."),
    "dependencies": ("causal", "Causal intelligence reveals hidden dependencies."),
    "causal": ("causal", "Here are the causal chain analysis results."),
    "bottleneck": ("causal", "Information bottleneck analysis results."),
    "risk": ("oracle", "Oracle intelligence provides risk assessments."),
    "supply chain": ("oracle", "Supply chain risk analysis from oracle intelligence."),
    "invest": ("oracle", "Investment signal analysis."),
    "geopolitical": ("oracle", "Geopolitical risk assessment."),
    "gap": ("topological", "Topological analysis identifies knowledge gaps."),
    "void": ("topological", "H2 void detection results."),
    "loop": ("topological", "Feedback loop detection via H1 cycles."),
    "topology": ("topological", "Full topological analysis."),
    "convergence": ("temporal", "Convergence dynamics analysis."),
    "phase": ("temporal", "Phase transition detection results."),
    "drift": ("temporal", "Topic drift / velocity field analysis."),
    "quality": ("meta", "Representation quality assessment."),
    "coverage": ("meta", "Corpus completeness and coverage analysis."),
    "capacity": ("meta", "Model capacity assessment."),
    "uncertain": ("uncertainty", "Epistemic uncertainty quantification."),
    "energy": ("deep_signals", "Energy landscape analysis."),
    "blank": ("deep_signals", "Blank space detection results."),
    "attention": ("deep_signals", "Attention structure analysis."),
    "hub": ("deep_signals", "Attention hub identification."),
    "value": ("oracle", "Module valuation and investment signals."),
    "highest": ("oracle", "Highest-value modules identified by oracle intelligence."),
    "strongest": ("causal", "Strongest causal pathways identified."),
    "explain": ("causal", "Here is the explanation from causal analysis."),
}


async def query_agent(session_id: str, question: str) -> dict:
    """Answer a question using cached intelligence results."""
    question_lower = question.lower()

    # Find the best matching engine
    best_engine = "oracle"  # default
    best_reason = "General intelligence briefing."
    for keyword, (engine, reason) in _KEYWORD_MAP.items():
        if keyword in question_lower:
            best_engine = engine
            best_reason = reason
            break

    # Fetch cached insights
    insights = await intelligence_cache.get_engine_result(session_id, best_engine)
    if not insights:
        all_results = await intelligence_cache.get_all_results(session_id)
        if not all_results:
            return {
                "answer": "No intelligence data available yet. Run the demo or a crystallization job first.",
                "sources": [],
                "confidence": 0.0,
                "engine": None,
            }
        # Fall back to the first engine with data
        best_engine = next(iter(all_results))
        insights = all_results[best_engine]

    # Build answer from top insights
    top = insights[:3]
    answer_parts = [best_reason, ""]
    sources = []
    for ins in top:
        title = ins.get("title", "Untitled insight")
        desc = ins.get("description", "")
        sev = ins.get("severity", "info")
        answer_parts.append(f"[{sev.upper()}] {title}")
        answer_parts.append(desc)
        answer_parts.append("")
        sources.append(f"{best_engine}:{title}")

    if ins_evidence := top[0].get("evidence") if top else None:
        answer_parts.append("Key evidence:")
        for ev in ins_evidence[:3]:
            answer_parts.append(f"  - {ev}")

    return {
        "answer": "\n".join(answer_parts),
        "sources": sources,
        "confidence": top[0].get("confidence", 0.7) if top else 0.0,
        "engine": best_engine,
    }
