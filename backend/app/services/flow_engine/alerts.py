"""Alert hysteresis state machine — generalized from NIV's AlertEnvelope.

Operates on any metric in [0, 1]. Higher = worse (like recession probability).
The hysteresis band prevents flip-flopping on noisy metrics.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class AlertLevel(str, Enum):
    NORMAL = "normal"
    ELEVATED = "elevated"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class AlertThresholds:
    elevated: float = 0.30
    warning: float = 0.50
    critical: float = 0.70
    hysteresis_band: float = 0.10


@dataclass
class AlertEnvelope:
    level: AlertLevel
    severity: float


_DEFAULT_THRESHOLDS = AlertThresholds()


def alert_from_metric(
    value: float,
    current: AlertEnvelope | None = None,
    thresholds: AlertThresholds = _DEFAULT_THRESHOLDS,
) -> AlertEnvelope:
    t = thresholds

    if current is not None:
        hb = t.hysteresis_band
        cl = current.level
        if cl == AlertLevel.CRITICAL and value >= t.critical - hb:
            return AlertEnvelope(level=AlertLevel.CRITICAL, severity=value)
        if cl == AlertLevel.WARNING and value >= t.warning - hb:
            return AlertEnvelope(level=AlertLevel.WARNING, severity=value)
        if cl == AlertLevel.ELEVATED and value >= t.elevated - hb:
            return AlertEnvelope(level=AlertLevel.ELEVATED, severity=value)

    if value >= t.critical:
        return AlertEnvelope(level=AlertLevel.CRITICAL, severity=value)
    if value >= t.warning:
        return AlertEnvelope(level=AlertLevel.WARNING, severity=value)
    if value >= t.elevated:
        return AlertEnvelope(level=AlertLevel.ELEVATED, severity=value)
    return AlertEnvelope(level=AlertLevel.NORMAL, severity=value)
