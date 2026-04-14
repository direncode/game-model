import uuid
import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient

from app.core.auth import get_current_active_user
from app.db.session import get_db
from app.main import app


def _fake_user():
    class FakeUser:
        id = uuid.uuid4()
        email = "test@example.com"
        organization_id = uuid.uuid4()
    return FakeUser()


def _fake_db():
    return AsyncMock()


@pytest.fixture
def client():
    app.dependency_overrides[get_current_active_user] = _fake_user
    app.dependency_overrides[get_db] = _fake_db
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


def test_mint_endpoint_exists(client):
    response = client.post(
        "/api/v1/qr/mint",
        json={"subject_type": "module", "subject_id": str(uuid.uuid4()), "tier": "public"},
    )
    assert response.status_code != 404


def test_resolve_endpoint_exists(client):
    response = client.get("/api/v1/qr/ABCD-1234")
    assert response.status_code != 404
