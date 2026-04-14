"""Premier League match presets with real squad data.

Each preset defines both squads (11v11), their tactical philosophies, and
per-player physical profiles sourced from tracking data (GPS/Catapult
estimates from the 2024/25 season).

The simulator reads these presets to create a hyper-realistic match.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class PLPlayer:
    """Real player profile."""
    name: str
    number: int
    role: str                    # GK, LB, LCB, RCB, RB, LCM, CM, RCM, LW, ST, RW
    base_x: float               # formation position (home attacks +x)
    base_y: float               # 0=top, 68=bottom
    max_speed: float             # m/s (from top speed km/h ÷ 3.6)
    acceleration: float          # m/s²
    positioning_iq: float        # 0-1
    pressing_intensity: float    # 0-1
    pass_accuracy: float         # 0-1
    stamina: float               # 0-1 (aerobic capacity proxy)
    xg90: float = 0.0
    xa90: float = 0.0


@dataclass
class PLTactics:
    """Team tactical philosophy."""
    formation: str
    style: str                   # possession, pressing, counter, direct
    avg_possession: float        # expected possession %
    ppda: float                  # passes per defensive action (lower = more pressing)
    defensive_line: float        # avg x of back line (higher = more aggressive)
    compactness: float           # 0-100 (lower = more compact)
    build_up_speed: float        # seconds to reach final third (lower = faster)
    width: float                 # team width in attack (0-100)
    manager: str


@dataclass
class PLMatchPreset:
    """Full match preset with both squads."""
    name: str
    competition: str
    matchday: str
    venue: str
    home_team: str
    away_team: str
    home_short: str
    away_short: str
    home_color: str              # hex color for broadcast
    away_color: str
    home_tactics: PLTactics
    away_tactics: PLTactics
    home_squad: list[PLPlayer]
    away_squad: list[PLPlayer]
    context: str                 # narrative context (e.g. "title decider")


# ═══════════════════════════════════════════════════════════════════════
#  ARSENAL vs MANCHESTER CITY — TITLE DECIDER
# ═══════════════════════════════════════════════════════════════════════

ARSENAL_TACTICS = PLTactics(
    formation="4-3-3",
    style="pressing",
    avg_possession=55.0,
    ppda=7.8,                    # Elite pressing — Arteta's gegenpressing hybrid
    defensive_line=45.0,         # High line
    compactness=30.0,            # Very compact
    build_up_speed=10.0,         # Faster than City in transition
    width=62.0,                  # Saka stretches the pitch
    manager="Mikel Arteta",
)

CITY_TACTICS = PLTactics(
    formation="4-3-3",
    style="possession",
    avg_possession=67.5,
    ppda=8.2,                    # Intense pressing
    defensive_line=48.0,         # Very high line
    compactness=32.0,            # Compact
    build_up_speed=12.5,         # Patient build-up
    width=58.0,                  # Half-space focus, moderate width
    manager="Pep Guardiola",
)

# Arsenal squad — Arteta's 4-3-3 (inverted fullbacks, Odegaard orchestrating)
_ARSENAL_SQUAD = [
    PLPlayer("David Raya",       1,  "GK",  5.0,  34.0,  max_speed=8.0,  acceleration=3.5, positioning_iq=0.88, pressing_intensity=0.2, pass_accuracy=0.85, stamina=0.70),
    PLPlayer("Ben White",        4,  "RB",  25.0, 56.0,  max_speed=9.2,  acceleration=4.3, positioning_iq=0.90, pressing_intensity=0.65, pass_accuracy=0.88, stamina=0.82),
    PLPlayer("William Saliba",   2,  "RCB", 22.0, 42.0,  max_speed=9.0,  acceleration=4.1, positioning_iq=0.93, pressing_intensity=0.55, pass_accuracy=0.90, stamina=0.85),
    PLPlayer("Gabriel Magalhães",6,  "LCB", 22.0, 26.0,  max_speed=8.8,  acceleration=4.0, positioning_iq=0.88, pressing_intensity=0.60, pass_accuracy=0.82, stamina=0.83, xg90=0.12),
    PLPlayer("Jurrien Timber",   12, "LB",  25.0, 10.0,  max_speed=9.3,  acceleration=4.4, positioning_iq=0.87, pressing_intensity=0.70, pass_accuracy=0.86, stamina=0.84),
    PLPlayer("Declan Rice",      41, "CM",  40.0, 34.0,  max_speed=9.1,  acceleration=4.2, positioning_iq=0.95, pressing_intensity=0.80, pass_accuracy=0.89, stamina=0.90, xa90=0.15),
    PLPlayer("Martin Ødegaard",  8,  "RCM", 48.0, 42.0,  max_speed=8.8,  acceleration=4.0, positioning_iq=0.97, pressing_intensity=0.72, pass_accuracy=0.87, stamina=0.80, xa90=0.45, xg90=0.22),
    PLPlayer("Thomas Partey",    5,  "LCM", 42.0, 22.0,  max_speed=8.9,  acceleration=4.1, positioning_iq=0.88, pressing_intensity=0.68, pass_accuracy=0.85, stamina=0.78),
    PLPlayer("Bukayo Saka",      7,  "RW",  65.0, 56.0,  max_speed=9.5,  acceleration=4.6, positioning_iq=0.92, pressing_intensity=0.75, pass_accuracy=0.82, stamina=0.85, xg90=0.32, xa90=0.38),
    PLPlayer("Kai Havertz",      29, "ST",  68.0, 34.0,  max_speed=9.2,  acceleration=4.3, positioning_iq=0.85, pressing_intensity=0.82, pass_accuracy=0.78, stamina=0.80, xg90=0.42),
    PLPlayer("Gabriel Martinelli",11, "LW", 65.0, 12.0,  max_speed=9.8,  acceleration=4.8, positioning_iq=0.82, pressing_intensity=0.78, pass_accuracy=0.76, stamina=0.83, xg90=0.28),
]

# City squad — Guardiola's 4-3-3 (inverted fullbacks, positional play)
_CITY_SQUAD = [
    PLPlayer("Ederson",          31, "GK",  5.0,  34.0,  max_speed=8.0,  acceleration=3.5, positioning_iq=0.92, pressing_intensity=0.2, pass_accuracy=0.90, stamina=0.70),
    PLPlayer("Kyle Walker",      2,  "RB",  25.0, 56.0,  max_speed=10.0, acceleration=4.9, positioning_iq=0.85, pressing_intensity=0.60, pass_accuracy=0.82, stamina=0.80),
    PLPlayer("Rúben Dias",       3,  "RCB", 22.0, 42.0,  max_speed=8.8,  acceleration=4.0, positioning_iq=0.92, pressing_intensity=0.55, pass_accuracy=0.88, stamina=0.85),
    PLPlayer("John Stones",      5,  "LCB", 22.0, 26.0,  max_speed=8.7,  acceleration=3.9, positioning_iq=0.88, pressing_intensity=0.50, pass_accuracy=0.90, stamina=0.83),
    PLPlayer("Joško Gvardiol",   24, "LB",  25.0, 10.0,  max_speed=9.2,  acceleration=4.3, positioning_iq=0.85, pressing_intensity=0.65, pass_accuracy=0.84, stamina=0.84),
    PLPlayer("Rodri",            16, "CM",  40.0, 34.0,  max_speed=8.75, acceleration=3.8, positioning_iq=0.99, pressing_intensity=0.70, pass_accuracy=0.93, stamina=0.92, xa90=0.15),
    PLPlayer("Kevin De Bruyne",  17, "RCM", 48.0, 46.0,  max_speed=9.3,  acceleration=4.2, positioning_iq=0.98, pressing_intensity=0.72, pass_accuracy=0.87, stamina=0.78, xa90=0.52, xg90=0.28),
    PLPlayer("Bernardo Silva",   20, "LCM", 42.0, 22.0,  max_speed=9.0,  acceleration=4.0, positioning_iq=0.95, pressing_intensity=0.85, pass_accuracy=0.90, stamina=0.88, xa90=0.25),
    PLPlayer("Phil Foden",       47, "LW",  65.0, 12.0,  max_speed=9.5,  acceleration=4.5, positioning_iq=0.94, pressing_intensity=0.80, pass_accuracy=0.85, stamina=0.82, xg90=0.42, xa90=0.38),
    PLPlayer("Erling Haaland",   9,  "ST",  68.0, 34.0,  max_speed=10.0, acceleration=4.8, positioning_iq=0.95, pressing_intensity=0.55, pass_accuracy=0.72, stamina=0.75, xg90=0.98),
    PLPlayer("Savinho",          26, "RW",  65.0, 56.0,  max_speed=9.6,  acceleration=4.6, positioning_iq=0.82, pressing_intensity=0.70, pass_accuracy=0.78, stamina=0.80, xg90=0.18, xa90=0.28),
]


ARS_VS_MCI = PLMatchPreset(
    name="Arsenal vs Manchester City — Title Decider",
    competition="Premier League",
    matchday="Matchday 38",
    venue="Emirates Stadium",
    home_team="Arsenal",
    away_team="Manchester City",
    home_short="ARS",
    away_short="MCI",
    home_color="#EF0107",       # Arsenal red
    away_color="#6CABDD",       # City sky blue
    home_tactics=ARSENAL_TACTICS,
    away_tactics=CITY_TACTICS,
    home_squad=_ARSENAL_SQUAD,
    away_squad=_CITY_SQUAD,
    context=(
        "Final day of the season. Arsenal lead City by 1 point. A draw is "
        "enough for Arsenal. City must win to claim a record 5th consecutive "
        "title. Emirates Stadium, 60,000 capacity, sold out. Arteta vs Pep — "
        "the student against the master. Everything on the line."
    ),
)

# Registry of all PL presets
PL_PRESETS: dict[str, PLMatchPreset] = {
    "ars_vs_mci": ARS_VS_MCI,
}
