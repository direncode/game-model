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

from typing import Any, Final


IC_AGENCIES: Final[dict[str, dict[str, Any]]] = {
    "POTUS": {
        "long_name": "Office of the President of the United States",
        "sim_team": {
            "room": "4003",
            "director": "Admiral Dennis C. Blair (USN, ret.)",
            "members": ["Mark Thomas-Patterson — National Security Advisor"],
        },
        "strengths": [
            "ultimate consumer of finished intelligence",
            "decision authority on national-level response",
        ],
        "best_for_gaps_about": [
            "consumer needs — what the President is asking",
            "POTUS-tier decision tempo",
        ],
    },
    "ODNI": {
        "long_name": "Office of the Director of National Intelligence",
        "sim_team": {
            "room": "1001 (Atrium)",
            "director": "Jack Barr — DNI",
            "members": ["Toni Winkler — Deputy"],
        },
        "strengths": [
            "IC-wide tasking and integration",
            "PDB content authority",
            "convenes the National Intelligence Council",
        ],
        "best_for_gaps_about": [
            "cross-agency tasking decisions",
            "integrated assessments routed to POTUS",
            "IC-wide collection prioritization",
        ],
    },
    "INR-internal": {
        "long_name": "State INR — Bureau of Intelligence and Research",
        "sim_team": {
            "room": "2010",
            "director": "Luke Garner",
            "members": [
                "Daniel Sielicki",
                "Diren Kumaratilleke",
                "Daniel Zeng",
                "Connor Lamb",
            ],
        },
        "strengths": [
            "diplomatic reporting from posts (FSO cables)",
            "long-form regional analysis",
            "all-source synthesis with Sec State as primary customer",
            "willingness to dissent from IC consensus",
        ],
        "best_for_gaps_about": [
            "what foreign governments are saying through diplomatic channels",
            "FSO-observed actions on the ground",
            "long-running political-economic context for an actor",
            "alliance-partner posture inferred from diplomatic signals",
        ],
    },
    "CIA": {
        "long_name": "Central Intelligence Agency",
        "sim_team": {
            "room": "1005",
            "director": "Nathan Garrett",
            "members": [
                "John Barrett (US Army)",
                "Maddie Beaupre",
                "Ray Taft",
                "Sophie Shepherd",
                "Ryan Clark",
                "Barrett Massand",
            ],
        },
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
        "sim_team": {
            "room": "1009",
            "director": "William Phillips",
            "members": [
                "Alexander P. Vamvakias",
                "Elinor Storey",
                "Page Smith",
                "Paul Lewis",
                "Anton Leng",
                "Dirsta Ioan",
            ],
        },
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
        "sim_team": {
            "room": "3009",
            "director": "Rhishit Tiwari",
            "members": [
                "Sarah Terlizzi",
                "Maddie Beaupre",
                "Nicole Juzaitis",
                "Brem Sholar",
                "Mpieri Ezinne",
                "Ted Teague",
            ],
        },
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
        "sim_team": {
            "room": "3024",
            "director": "Kent Wiggs",
            "members": [
                "Hayden Wallace",
                "John Britt",
                "Drake Betts",
                "Grace Fuller",
                "Alexia Zambito",
                "Ian Bordes",
            ],
        },
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
    "FBI": {
        "long_name": "Federal Bureau of Investigation",
        "sim_team": {
            "room": "2008",
            "director": "Eli Davis",
            "members": [
                "Nicole Starvojohn",
                "Nolan Bates",
                "Bennett Booker",
            ],
        },
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
    "EUCOM-J2": {
        "long_name": "U.S. European Command, J2 (Intelligence Directorate)",
        "sim_team": {
            "room": "1001 (Atrium)",
            "director": "Lt. Col. Lisa Klekowski (US Army)",
            "members": ["Captain Oren Rosen (US Army)"],
        },
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
        "long_name": "NATO Intelligence Fusion Centre / JISD",
        "sim_team": {
            "room": "3033",
            "director": "Lucas Wicki",
            "members": ["Skye Law"],
        },
        "strengths": [
            "alliance-partner intelligence integration",
            "multi-national fusion of theater reporting",
            "REL TO NATO sharing channel",
        ],
        "best_for_gaps_about": [
            "alliance cohesion indicators",
            "NATO-partner-specific reporting State cannot independently verify",
            "what other 31 allies are seeing in their own collection",
        ],
    },
    "Control": {
        "long_name": "Collection Control · Faculty Game-Master",
        "sim_team": {
            "room": "1203",
            "director": "Riley Seiple",
            "members": [
                "Prof. Bill Boettcher",
                "Prof. Bob Jenkins",
                "Col. Jay Bateman",
                "Prof. Carolyn Pumphrey",
            ],
        },
        "strengths": [
            "scenario authoritative source",
            "all collection-tasking responses",
            "inject delivery + tempo control",
        ],
        "best_for_gaps_about": [
            "any collection request requires Control approval",
            "ground-truth on what is happening in the scenario",
        ],
    },
    "NRO": {
        "long_name": "National Reconnaissance Office",
        "sim_team": {
            "room": "(not on the AWIS sim floor)",
            "director": "—",
            "members": [],
        },
        "strengths": [
            "overhead collection asset tasking",
            "high-cadence satellite reconnaissance",
        ],
        "best_for_gaps_about": [
            "anything requiring tasked overhead collection",
            "high-cadence imaging revisit on contested sites",
        ],
    },
    "Treasury": {
        "long_name": "Treasury Office of Intelligence and Analysis (FinCEN/OFAC nexus)",
        "sim_team": {
            "room": "(not on the AWIS sim floor)",
            "director": "—",
            "members": [],
        },
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
        "sim_team": {
            "room": "(not on the AWIS sim floor)",
            "director": "—",
            "members": [],
        },
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
