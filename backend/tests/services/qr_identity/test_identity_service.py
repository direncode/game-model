import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.qr_identity.identity_service import QRIdentityService


@pytest.fixture
def mock_session():
    session = AsyncMock()
    # execute is async, but its return value (Result) is sync
    result_mock = MagicMock()
    session.execute = AsyncMock(return_value=result_mock)
    session.add = MagicMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
def service(mock_session):
    return QRIdentityService(mock_session)


@pytest.mark.asyncio
async def test_mint_creates_identity(service, mock_session):
    mock_session.execute.return_value.scalar_one_or_none.return_value = None
    result = await service.mint(
        subject_type="module",
        subject_id=uuid.uuid4(),
        tier="org",
        minted_by="test-user",
    )
    assert result.subject_type == "module"
    assert result.tier == "org"
    assert len(result.code) == 9
    mock_session.add.assert_called_once()


@pytest.mark.asyncio
async def test_resolve_returns_none_for_unknown_code(service, mock_session):
    mock_session.execute.return_value.scalar_one_or_none.return_value = None
    result = await service.resolve("ZZZZ-9999")
    assert result is None


@pytest.mark.asyncio
async def test_revoke_sets_revoked_at(service, mock_session):
    from app.models.qr_identity import QRIdentity
    fake_qi = QRIdentity(
        id=uuid.uuid4(), code="ABCD-1234",
        subject_type="module", subject_id=uuid.uuid4(),
        tier="public", minted_by="test",
    )
    mock_session.execute.return_value.scalar_one_or_none.return_value = fake_qi
    result = await service.revoke("ABCD-1234")
    assert result is not None
    assert result.revoked_at is not None
