"""Tests for QR Digital Identity SQLAlchemy models."""

import uuid
from datetime import datetime, timezone

import pytest


def test_qr_identity_construction():
    """QRIdentity can be constructed with valid attributes."""
    # Import here to avoid triggering DB connection at module level
    from app.models.qr_identity import QRIdentity

    identity = QRIdentity(
        id=uuid.uuid4(),
        code="LSX-A1B2C",
        subject_type="module",
        subject_id=uuid.uuid4(),
        tier="public",
        org_id=None,
        minted_by="test-user@example.com",
        metadata_={"label": "test"},
    )

    assert identity.code == "LSX-A1B2C"
    assert identity.subject_type == "module"
    assert identity.tier == "public"
    assert identity.org_id is None
    assert identity.minted_by == "test-user@example.com"
    assert identity.metadata_ == {"label": "test"}
    assert identity.revoked_at is None


def test_qr_identity_has_id_default():
    """QRIdentity has a default callable for id generation."""
    from app.models.qr_identity import QRIdentity

    assert QRIdentity.id.default is not None
    assert QRIdentity.id.default.is_callable


def test_qr_identity_table_name():
    """QRIdentity maps to the qr_identity table."""
    from app.models.qr_identity import QRIdentity

    assert QRIdentity.__tablename__ == "qr_identity"


def test_qr_scan_log_construction():
    """QRScanLog can be constructed with valid attributes."""
    from app.models.qr_identity import QRScanLog

    qr_id = uuid.uuid4()
    log = QRScanLog(
        id=uuid.uuid4(),
        qr_identity_id=qr_id,
        scanned_by="scanner@example.com",
        scanned_at=datetime.now(timezone.utc),
        access_granted="public",
        ip_address="192.168.1.1",
    )

    assert log.qr_identity_id == qr_id
    assert log.scanned_by == "scanner@example.com"
    assert log.access_granted == "public"
    assert log.ip_address == "192.168.1.1"


def test_qr_scan_log_nullable_fields():
    """QRScanLog allows nullable fields to be None."""
    from app.models.qr_identity import QRScanLog

    log = QRScanLog(
        qr_identity_id=uuid.uuid4(),
        access_granted="org",
        scanned_by=None,
        ip_address=None,
    )

    assert log.scanned_by is None
    assert log.ip_address is None


def test_qr_scan_log_table_name():
    """QRScanLog maps to the qr_scan_log table."""
    from app.models.qr_identity import QRScanLog

    assert QRScanLog.__tablename__ == "qr_scan_log"


def test_models_registered_in_init():
    """QRIdentity and QRScanLog are exported from models package."""
    from app import models

    assert hasattr(models, "QRIdentity")
    assert hasattr(models, "QRScanLog")
    assert "QRIdentity" in models.__all__
    assert "QRScanLog" in models.__all__
