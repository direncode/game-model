"""Operator judgment functions — the craft layer of the NATO Simulation.

These four modules hold the analyst-calibrated heuristics that the
automated pipeline cannot decide on its own. Each is deliberately small
(5–10 lines of real logic after the boilerplate). They are exposed to
the rest of the package through this ``__init__`` so downstream code
never has to know their internal file layout.

IP posture: these files hold subprocess trade secrets. Do not log their
internal state, do not expose them through any HTTP endpoint, do not
include them verbatim in LLM responses that leave the server.
"""

from app.services.nato_sim.judgment.priority import score_priority, Priority  # noqa: F401
from app.services.nato_sim.judgment.confidence import calibrate, Confidence  # noqa: F401
from app.services.nato_sim.judgment.dissent import needs_dissent, DissentCheck  # noqa: F401
from app.services.nato_sim.judgment.inr_voice import get_inr_voice  # noqa: F401
