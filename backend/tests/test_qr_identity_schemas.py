"""Tests for QR Digital Identity Pydantic schemas."""

import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.qr_identity import (
    QRCodeImageOut,
    QRIdentityOut,
    QRMintRequest,
    QRScanLogOut,
    QRScanRequest,
    QRScanResult,
)


# ── QRMintRequest ────────────────────────────────────────────────────


class TestQRMintRequest:
    def test_valid_minimal(self):
        req = QRMintRequest(
            subject_type="module",
            subject_id=uuid.uuid4(),
        )
        assert req.tier == "public"
        assert req.org_id is None
        assert req.metadata is None

    def test_valid_full(self):
        oid = uuid.uuid4()
        req = QRMintRequest(
            subject_type="bundle",
            subject_id=uuid.uuid4(),
            tier="org",
            org_id=oid,
            metadata={"version": 2},
        )
        assert req.tier == "org"
        assert req.org_id == oid
        assert req.metadata == {"version": 2}

    def test_invalid_subject_type(self):
        with pytest.raises(ValidationError) as exc_info:
            QRMintRequest(
                subject_type="invalid_type",
                subject_id=uuid.uuid4(),
            )
        assert "subject_type" in str(exc_info.value)

    def test_invalid_tier(self):
        with pytest.raises(ValidationError) as exc_info:
            QRMintRequest(
                subject_type="module",
                subject_id=uuid.uuid4(),
                tier="superadmin",
            )
        assert "tier" in str(exc_info.value)

    def test_invalid_subject_id_not_uuid(self):
        with pytest.raises(ValidationError):
            QRMintRequest(
                subject_type="module",
                subject_id="not-a-uuid",
            )

    def test_all_subject_types(self):
        for st in ("module", "bundle", "submission", "allocation", "dataset"):
            req = QRMintRequest(subject_type=st, subject_id=uuid.uuid4())
            assert req.subject_type == st


# ── QRScanRequest ────────────────────────────────────────────────────


class TestQRScanRequest:
    def test_valid_empty(self):
        req = QRScanRequest()
        assert req.scanned_by is None
        assert req.ip_address is None

    def test_valid_full(self):
        req = QRScanRequest(scanned_by="user@test.com", ip_address="10.0.0.1")
        assert req.scanned_by == "user@test.com"
        assert req.ip_address == "10.0.0.1"


# ── QRIdentityOut ────────────────────────────────────────────────────


class TestQRIdentityOut:
    def _make_data(self, **overrides):
        base = dict(
            id=uuid.uuid4(),
            code="LSX-A1B2C",
            subject_type="module",
            subject_id=uuid.uuid4(),
            tier="public",
            org_id=None,
            minted_by="system",
            minted_at=datetime.now(timezone.utc),
            revoked_at=None,
            metadata=None,
        )
        base.update(overrides)
        return base

    def test_valid(self):
        out = QRIdentityOut(**self._make_data())
        assert out.code == "LSX-A1B2C"

    def test_from_attributes_config(self):
        assert QRIdentityOut.model_config.get("from_attributes") is True

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            QRIdentityOut(id=uuid.uuid4(), code="LSX-A1B2C")


# ── QRScanResult ─────────────────────────────────────────────────────


class TestQRScanResult:
    def test_valid(self):
        identity_data = dict(
            id=uuid.uuid4(),
            code="LSX-A1B2C",
            subject_type="module",
            subject_id=uuid.uuid4(),
            tier="public",
            org_id=None,
            minted_by="system",
            minted_at=datetime.now(timezone.utc),
            revoked_at=None,
            metadata=None,
        )
        result = QRScanResult(
            qr_identity=QRIdentityOut(**identity_data),
            access_granted="public",
            entity_summary={"name": "Test Module"},
        )
        assert result.access_granted == "public"
        assert result.lineage is None

    def test_with_lineage(self):
        identity_data = dict(
            id=uuid.uuid4(),
            code="LSX-A1B2C",
            subject_type="dataset",
            subject_id=uuid.uuid4(),
            tier="admin",
            org_id=uuid.uuid4(),
            minted_by="admin",
            minted_at=datetime.now(timezone.utc),
            revoked_at=None,
            metadata={"key": "val"},
        )
        result = QRScanResult(
            qr_identity=QRIdentityOut(**identity_data),
            access_granted="admin",
            entity_summary={"rows": 1000},
            lineage=[{"step": "ingest", "ts": "2026-01-01"}],
        )
        assert len(result.lineage) == 1


# ── QRScanLogOut ─────────────────────────────────────────────────────


class TestQRScanLogOut:
    def test_valid(self):
        out = QRScanLogOut(
            id=uuid.uuid4(),
            qr_identity_id=uuid.uuid4(),
            scanned_by="user@test.com",
            scanned_at=datetime.now(timezone.utc),
            access_granted="public",
            ip_address="192.168.1.1",
        )
        assert out.access_granted == "public"

    def test_from_attributes_config(self):
        assert QRScanLogOut.model_config.get("from_attributes") is True

    def test_nullable_fields(self):
        out = QRScanLogOut(
            id=uuid.uuid4(),
            qr_identity_id=uuid.uuid4(),
            scanned_by=None,
            scanned_at=datetime.now(timezone.utc),
            access_granted="org",
            ip_address=None,
        )
        assert out.scanned_by is None
        assert out.ip_address is None


# ── QRCodeImageOut ───────────────────────────────────────────────────


class TestQRCodeImageOut:
    def test_valid(self):
        out = QRCodeImageOut(
            code="LSX-A1B2C",
            image_base64="iVBORw0KGgo=",
            url="https://app.example.com/qr/LSX-A1B2C",
        )
        assert out.code == "LSX-A1B2C"

    def test_missing_field(self):
        with pytest.raises(ValidationError):
            QRCodeImageOut(code="LSX-A1B2C")
