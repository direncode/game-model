"""Edge Edition configuration — extends EngineConfig for hardened deployments."""

from __future__ import annotations

from dataclasses import dataclass, field

from engine.config import EngineConfig


@dataclass
class EdgeConfig(EngineConfig):
    """Configuration for air-gapped / classified Edge deployments.

    Inherits all base engine settings and adds security, audit,
    classification, and update-verification knobs.
    """

    # Classification
    classification_default: str = "UNCLASSIFIED"
    classification_marking_enabled: bool = True

    # Security
    fips_enabled: bool = True
    air_gap_mode: bool = True
    telemetry_enabled: bool = False

    # Audit
    immutable_audit: bool = True
    audit_chain_algorithm: str = "sha256"

    # Updates
    update_verification_key: str = ""  # Ed25519 public key (hex or PEM path)

    # Access control
    clearance_levels_enabled: bool = True

    # Network restrictions
    allowed_hosts: list[str] = field(
        default_factory=lambda: ["localhost", "127.0.0.1", "0.0.0.0", "::1"]
    )

    def validate(self) -> list[str]:
        """Return a list of configuration warnings (empty = OK)."""
        warnings: list[str] = []
        if self.air_gap_mode and self.telemetry_enabled:
            warnings.append("Telemetry is enabled in air-gap mode — this will be suppressed at runtime.")
        if self.fips_enabled and not self.immutable_audit:
            warnings.append("FIPS mode is on but immutable audit is disabled — recommended to enable.")
        if not self.update_verification_key:
            warnings.append("No update verification key configured — offline updates cannot be verified.")
        return warnings
