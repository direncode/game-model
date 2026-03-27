"""NaN/Inf detection and gradient explosion guard for TCD-JEPA training.

Monitors loss values during training, detects numerical instabilities,
and provides auto-rollback to the last stable checkpoint.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class NaNGuardState:
    """Track NaN guard state across training steps."""

    nan_count: int = 0
    inf_count: int = 0
    explosion_count: int = 0
    last_stable_loss: float | None = None
    last_stable_step: int = 0
    last_stable_checkpoint: str | None = None
    loss_history: list[float] = field(default_factory=list)
    max_history_size: int = 100
    consecutive_nan_count: int = 0


class NaNGuard:
    """Monitor training for numerical instabilities.

    Detects NaN/Inf losses and gradient explosions (sudden large loss spikes),
    and can trigger auto-rollback to the last known good checkpoint.
    """

    def __init__(
        self,
        explosion_threshold: float = 10.0,
        max_consecutive_nan: int = 3,
        rollback_enabled: bool = True,
    ) -> None:
        """Initialize the NaN guard.

        Args:
            explosion_threshold: Multiplicative factor above rolling average
                that constitutes a gradient explosion.
            max_consecutive_nan: Maximum consecutive NaN/Inf values before
                triggering rollback.
            rollback_enabled: Whether auto-rollback is enabled.
        """
        self._explosion_threshold = explosion_threshold
        self._max_consecutive_nan = max_consecutive_nan
        self._rollback_enabled = rollback_enabled
        self._state = NaNGuardState()

    @property
    def state(self) -> NaNGuardState:
        """Current guard state."""
        return self._state

    def check_loss(self, loss: float, step: int) -> dict[str, Any]:
        """Check a loss value for numerical issues.

        Args:
            loss: Current training loss value.
            step: Current training step number.

        Returns:
            Dictionary with check results:
            - is_valid: True if loss is acceptable.
            - action: None, "warn", or "rollback".
            - reason: Human-readable explanation.
        """
        # NaN check
        if math.isnan(loss):
            self._state.nan_count += 1
            self._state.consecutive_nan_count += 1
            logger.warning(
                "NaN loss detected at step %d (total=%d, consecutive=%d)",
                step,
                self._state.nan_count,
                self._state.consecutive_nan_count,
            )
            return self._handle_bad_value(step, "NaN loss detected")

        # Inf check
        if math.isinf(loss):
            self._state.inf_count += 1
            self._state.consecutive_nan_count += 1
            logger.warning(
                "Inf loss detected at step %d (total=%d)",
                step,
                self._state.inf_count,
            )
            return self._handle_bad_value(step, "Inf loss detected")

        # Reset consecutive counter on valid loss
        self._state.consecutive_nan_count = 0

        # Gradient explosion check
        if self._is_explosion(loss):
            self._state.explosion_count += 1
            logger.warning(
                "Gradient explosion at step %d: loss=%.4f, avg=%.4f",
                step,
                loss,
                self._rolling_average(),
            )
            return {
                "is_valid": False,
                "action": "warn",
                "reason": (
                    f"Gradient explosion: loss {loss:.4f} is "
                    f"{self._explosion_threshold}x above rolling average"
                ),
                "loss": loss,
                "step": step,
            }

        # Valid loss: update state
        self._state.last_stable_loss = loss
        self._state.last_stable_step = step
        self._update_history(loss)

        return {
            "is_valid": True,
            "action": None,
            "reason": None,
            "loss": loss,
            "step": step,
        }

    def register_checkpoint(self, checkpoint_path: str, step: int) -> None:
        """Register a stable checkpoint for potential rollback.

        Args:
            checkpoint_path: Path to the saved checkpoint file.
            step: Training step at checkpoint time.
        """
        self._state.last_stable_checkpoint = checkpoint_path
        self._state.last_stable_step = step
        logger.debug(
            "Registered stable checkpoint at step %d: %s",
            step,
            checkpoint_path,
        )

    def get_rollback_checkpoint(self) -> str | None:
        """Get the last stable checkpoint path for rollback.

        Returns:
            Checkpoint path or None if no stable checkpoint exists.
        """
        return self._state.last_stable_checkpoint

    def get_summary(self) -> dict[str, Any]:
        """Return a summary of all detected issues.

        Returns:
            Dictionary with NaN, Inf, and explosion counts and last stable state.
        """
        return {
            "nan_count": self._state.nan_count,
            "inf_count": self._state.inf_count,
            "explosion_count": self._state.explosion_count,
            "last_stable_loss": self._state.last_stable_loss,
            "last_stable_step": self._state.last_stable_step,
            "last_stable_checkpoint": self._state.last_stable_checkpoint,
            "total_issues": (
                self._state.nan_count
                + self._state.inf_count
                + self._state.explosion_count
            ),
        }

    def _handle_bad_value(self, step: int, reason: str) -> dict[str, Any]:
        """Handle NaN/Inf detection, possibly triggering rollback."""
        should_rollback = (
            self._rollback_enabled
            and self._state.consecutive_nan_count >= self._max_consecutive_nan
            and self._state.last_stable_checkpoint is not None
        )

        if should_rollback:
            logger.error(
                "Auto-rollback triggered at step %d after %d consecutive bad values. "
                "Rolling back to checkpoint: %s",
                step,
                self._state.consecutive_nan_count,
                self._state.last_stable_checkpoint,
            )
            return {
                "is_valid": False,
                "action": "rollback",
                "reason": reason,
                "rollback_checkpoint": self._state.last_stable_checkpoint,
                "rollback_step": self._state.last_stable_step,
                "step": step,
            }

        return {
            "is_valid": False,
            "action": "warn",
            "reason": reason,
            "step": step,
            "consecutive_bad_values": self._state.consecutive_nan_count,
        }

    def _is_explosion(self, loss: float) -> bool:
        """Check if loss represents a gradient explosion."""
        avg = self._rolling_average()
        if avg is None or avg == 0:
            return False
        return loss > avg * self._explosion_threshold

    def _rolling_average(self) -> float | None:
        """Compute rolling average of recent loss values."""
        if not self._state.loss_history:
            return None
        return sum(self._state.loss_history) / len(self._state.loss_history)

    def _update_history(self, loss: float) -> None:
        """Add loss to history, maintaining max size."""
        self._state.loss_history.append(loss)
        if len(self._state.loss_history) > self._state.max_history_size:
            self._state.loss_history.pop(0)
