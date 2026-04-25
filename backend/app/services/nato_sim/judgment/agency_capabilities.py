"""IC agency capability mapping — operator contribution file (5th).

Used by the gap scanner to recommend which agencies are best positioned
to fill identified intelligence gaps and what specific collection to ask
for. The mapping is what an INR analyst would carry in their head when
turning to the DNI to ask for help.

This file is part of the trade-secret subprocess layer — it's prose +
keys that shape the LLM's recommendations. **Operator: refine before
the sim.** The defaults below are textbook IC tradecraft, not your
calibrated read of what each agency at AWIS will be most useful for.
"""

from __future__ import annotations

from typing import Final


IC_AGENCIES: Final[dict[str, dict[str, list[str] | str]]] = {
    "CIA": {
        "long_name": "Central Intelligence Agency",
        "strengths": [
            "all-source HUMINT against foreign governments",
            "covert HUMINT — especially political-elite penetration",
            "clandestine reporting on senior leadership intent",
            "operations in non-permissive environments",
        ],
        "best_for_gaps_about": [
            "leadership intent and decision-making (closed regimes)",
            "covert action / paramilitary",
            "political dynamics inside hostile regimes",
            "non-state actors with intelligence-relevant ties",
        ],
    },
    "DIA": {
        "long_name": "Defense Intelligence Agency",
        "strengths": [
            "military order of battle",
            "foreign military doctrine and capabilities",
            "ground/sea/air force readiness assessments",
            "WMD proliferation tracking",
        ],
        "best_for_gaps_about": [
            "force disposition, readiness, posture",
            "doctrinal questions about military operations",
            "force-on-force comparative analysis",
            "WMD acquisition and proliferation",
        ],
    },
    "NSA": {
        "long_name": "National Security Agency",
        "strengths": [
            "SIGINT — communications intercept",
            "cryptanalysis",
            "cyber threat intelligence",
            "tactical SIGINT in conflict zones",
        ],
        "best_for_gaps_about": [
            "communications between named actors",
            "cyber intrusions and infrastructure attacks",
            "information-operations attribution",
            "tactical SIGINT for force movement",
        ],
    },
    "NGA": {
        "long_name": "National Geospatial-Intelligence Agency",
        "strengths": [
            "imagery intelligence (satellite + airborne)",
            "geospatial analysis",
            "foundational mapping data",
            "change detection over physical infrastructure",
        ],
        "best_for_gaps_about": [
            "force movements visible from above",
            "infrastructure damage assessment",
            "construction/expansion at military facilities",
            "cross-border movements",
        ],
    },
    "NRO": {
        "long_name": "National Reconnaissance Office",
        "strengths": [
            "overhead collection asset tasking",
            "high-cadence satellite reconnaissance",
        ],
        "best_for_gaps_about": [
            "anything requiring tasked overhead collection",
            "high-cadence imaging revisit on contested sites",
        ],
    },
    "FBI": {
        "long_name": "Federal Bureau of Investigation",
        "strengths": [
            "domestic counterintelligence",
            "foreign-influence operations on US soil",
            "law-enforcement intelligence with foreign ties",
        ],
        "best_for_gaps_about": [
            "Russian/foreign influence in the US",
            "diaspora-network intelligence with policy relevance",
            "domestic implications of foreign intelligence operations",
        ],
    },
    "Treasury": {
        "long_name": "Treasury Office of Intelligence and Analysis (FinCEN/OFAC nexus)",
        "strengths": [
            "financial intelligence",
            "sanctions enforcement and tracking",
            "illicit finance flow analysis",
        ],
        "best_for_gaps_about": [
            "funding sources for hostile operations",
            "sanctions-evasion patterns",
            "front-company networks",
            "kleptocratic financial flows",
        ],
    },
    "Energy": {
        "long_name": "Department of Energy / Office of Intelligence and Counterintelligence",
        "strengths": [
            "nuclear weapons intelligence",
            "foreign nuclear-energy programs",
            "technical / MASINT for radiological signatures",
        ],
        "best_for_gaps_about": [
            "nuclear posture changes",
            "radiological signatures and incidents",
            "civilian-nuclear-program dual-use questions",
        ],
    },
    "EUCOM-J2": {
        "long_name": "U.S. European Command, J2 (Intelligence Directorate)",
        "strengths": [
            "theater-level military intelligence on Europe",
            "force-protection intelligence for US-EUR forces",
            "liaison with NATO intelligence partners",
        ],
        "best_for_gaps_about": [
            "tactical/operational European-theater questions",
            "alliance-partner intelligence sharing",
            "force-protection-relevant threats in theater",
        ],
    },
    "NATO-NIFC": {
        "long_name": "NATO Intelligence Fusion Centre",
        "strengths": [
            "alliance-partner intelligence integration",
            "multi-national fusion of theater reporting",
        ],
        "best_for_gaps_about": [
            "alliance cohesion indicators",
            "NATO-partner-specific reporting State cannot independently verify",
        ],
    },
    "INR-internal": {
        "long_name": "State INR — Bureau of Intelligence and Research",
        "strengths": [
            "diplomatic reporting from posts (FSO cables)",
            "long-form regional analysis",
            "all-source synthesis",
        ],
        "best_for_gaps_about": [
            "what foreign governments are saying through diplomatic channels",
            "FSO-observed actions on the ground",
            "long-running political-economic context for an actor",
        ],
    },
}


def render_agency_directory() -> str:
    """Render the IC capability map as a system-prompt fragment.

    Used by the gap scanner so the LLM has a uniform reference for
    which agency to recommend. Returns plain text suitable for direct
    concatenation onto an inr_voice prompt.
    """
    lines: list[str] = ["# IC Agency Capability Reference\n"]
    for key, info in IC_AGENCIES.items():
        lines.append(f"## {key} — {info['long_name']}")
        lines.append("Strengths:")
        for s in info["strengths"]:  # type: ignore[union-attr]
            lines.append(f"  - {s}")
        lines.append("Best for gaps about:")
        for s in info["best_for_gaps_about"]:  # type: ignore[union-attr]
            lines.append(f"  - {s}")
        lines.append("")
    return "\n".join(lines)
