"""D-U-N-C Tactical Football Intelligence Engine — service package.

Vertical that turns live player tracking (GPS/RFID or synthetic) into digital
twins, tactical insights, and role-scoped intelligence for managers and
technical staff. Slots alongside `btut`, `crystallization`, `interpretation`
as a first-class Latent Ocean vertical.

Design: docs/plans/2026-04-11-dunc-vertical-design.md
"""

from app.services.dunc.adapters import (
    TrackingAdapter,
    SyntheticAdapter,
)
from app.services.dunc.simulator import MatchSimulator, MatchPreset
from app.services.dunc.twins import DigitalTwin, DigitalTwinRegistry
from app.services.dunc.tactical_engine import TacticalEngine
from app.services.dunc.scenarios import (
    ScenarioDetector,
    detect_under_run,
    detect_pressing_shift,
    detect_convergence_moment,
)
from app.services.dunc.insights import Insight, InsightStream
from app.services.dunc.agents import DuncAgent, AgentReply, Role
from app.services.dunc.runtime import MatchRuntime
from app.services.dunc.registry import ActiveMatchRegistry, get_registry

__all__ = [
    "TrackingAdapter",
    "SyntheticAdapter",
    "MatchSimulator",
    "MatchPreset",
    "DigitalTwin",
    "DigitalTwinRegistry",
    "TacticalEngine",
    "ScenarioDetector",
    "detect_under_run",
    "detect_pressing_shift",
    "detect_convergence_moment",
    "Insight",
    "InsightStream",
    "DuncAgent",
    "AgentReply",
    "Role",
    "MatchRuntime",
    "ActiveMatchRegistry",
    "get_registry",
]
