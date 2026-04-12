"""NIV tearsheet generation — PDF/PNG/JSON."""
from __future__ import annotations

import json
import logging
from dataclasses import asdict
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def investment_thesis_paragraph(
    current_result: Any,
    walkforward: Any,
    orthogonal_var: float,
    crystallization_context: list[str] | None,
) -> str:
    """Generate a 3-5 sentence investment thesis from NIV state.

    Voice: opinionated, operational, specific. Not hedged. Not academic.
    The reader is a portfolio manager who needs to act this week.

    Structure:
    1. Lead sentence: alert level + directional call.
    2. Evidence sentence: which component is driving the signal.
    3. (If orthogonal_var > 0.30) Independence sentence: NIV sees what
       the yield curve doesn't.
    4. (If crystallization_context) Historical analogue sentence.
    5. Action sentence: what to do with the portfolio.
    """
    if current_result is None:
        return "NIV data unavailable. No thesis generated."

    score = current_result.niv_score
    prob = current_result.recession_probability
    alert = current_result.alert
    comps = current_result.components

    # ── Lead sentence: directional call ──────────────────────
    if alert.level == "critical":
        lead = (f"NIV is at {score:+.1f} with {prob:.0%} recession probability. "
                "The liquidity channel is contracting — this is a defensive position.")
    elif alert.level == "warning":
        lead = (f"NIV at {score:+.1f} ({prob:.0%} recession probability) signals deteriorating "
                "credit transmission. The expansion is aging.")
    elif alert.level == "elevated":
        lead = (f"NIV at {score:+.1f} ({prob:.0%}) shows early stress. "
                "Not a recession call yet, but the margin of safety is thinning.")
    else:
        lead = (f"NIV at {score:+.1f} ({prob:.0%}) confirms expansionary conditions. "
                "Liquidity channels are open and channeling capital.")

    # ── Evidence sentence: dominant component ────────────────
    drivers = []
    if abs(comps.thrust) > 0.5:
        direction = "strong fiscal/monetary impulse" if comps.thrust > 0 else "contractionary policy impulse"
        drivers.append(direction)
    if comps.drag.total > 0.01:
        drag_parts = []
        if comps.drag.spread > 0.005:
            drag_parts.append("inverted yield curve")
        if comps.drag.real_rate > 0.005:
            drag_parts.append("positive real rates")
        if comps.drag.vol > 0.003:
            drag_parts.append("rate volatility")
        if drag_parts:
            drivers.append(f"drag from {', '.join(drag_parts)}")
    if comps.slack < 0.10:
        drivers.append("near-zero slack (economy at capacity limits)")

    if drivers:
        evidence = f"Primary drivers: {'; '.join(drivers)}."
    else:
        evidence = "No single component dominates — the signal is compositional."

    # ── Independence sentence (only if orthogonal variance is high) ──
    independence = ""
    if orthogonal_var > 0.30:
        independence = (
            f" NIV captures {orthogonal_var:.0%} variance orthogonal to the Fed yield curve — "
            "this is information the bond market is not pricing."
        )

    # ── Historical analogue ──────────────────────────────────
    analogue = ""
    if crystallization_context:
        analogues_str = ", ".join(crystallization_context[:3])
        analogue = f" Regime clustering maps the current state to: {analogues_str}."

    # ── Action sentence ──────────────────────────────────────
    action = f" Recommended positioning: {alert.action} (equity allocation multiplier: {alert.dollar_stakes:.0%})."

    return lead + " " + evidence + independence + analogue + action


def generate_tearsheet_json(
    niv_result: Any = None,
    walkforward_result: Any = None,
    protocol_d_result: Any = None,
    orthogonal_result: Any = None,
) -> dict:
    """Generate a JSON tearsheet."""
    sheet: dict[str, Any] = {
        "generated_at": None,
        "niv_latest": None,
        "walkforward": None,
        "protocol_d": None,
        "orthogonal_variance": None,
        "thesis": None,
    }

    if niv_result is not None:
        try:
            sheet["niv_latest"] = asdict(niv_result)
        except Exception:
            sheet["niv_latest"] = str(niv_result)

    if walkforward_result is not None:
        sheet["walkforward"] = walkforward_result.to_dict()

    if protocol_d_result is not None:
        try:
            sheet["protocol_d"] = asdict(protocol_d_result)
        except Exception:
            pass

    if orthogonal_result is not None:
        try:
            sheet["orthogonal_variance"] = asdict(orthogonal_result)
        except Exception:
            pass

    return sheet


def save_tearsheet(sheet: dict, output_path: Path, fmt: str = "json") -> Path:
    """Save tearsheet to disk."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "json":
        path = output_path.with_suffix(".json")
        path.write_text(json.dumps(sheet, indent=2, default=str))
        return path
    elif fmt == "pdf":
        path = output_path.with_suffix(".pdf")
        logger.warning("PDF rendering not yet implemented, saving JSON fallback")
        path.write_text(json.dumps(sheet, indent=2, default=str))
        return path
    else:
        raise ValueError(f"Unsupported format: {fmt}")
