"""Smoke tests for the /api/v1/tcd/* endpoints.

Uses FastAPI's TestClient with dependency_overrides to stub auth,
DB, and Redis. Monkeypatches _get_permissions_for_role to grant all
permissions so require_permission closures always pass.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_active_user
from app.core import permissions as perms_module
from app.db.session import get_db
from app.main import app


class _FakeUser:
    id = uuid.uuid4()
    email = "tester@example.com"
    role = "operator"
    is_active = True


class _FakeRegistry:
    def __init__(self) -> None:
        self.rows: list = []

    async def list(self, **kwargs):  # noqa: A003
        return list(self.rows)

    async def get(self, entry_id):
        return None


class _FakeRedis:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self._store[key] = value


def _all_permissions(role: str) -> set[str]:
    """Grant every permission to any role — test-only."""
    return {
        "read_modules", "read_connections", "view_lineage",
        "create_challenges", "annotate_modules", "export_reports",
        "run_crystallization", "manage_datasets", "resolve_challenges",
        "manage_users", "manage_roles", "configure_system",
        "access_audit_logs", "export_audit_reports",
    }


@pytest.fixture
def client(monkeypatch):
    async def _fake_user():
        return _FakeUser()

    async def _fake_db():
        yield None

    app.dependency_overrides[get_current_active_user] = _fake_user
    app.dependency_overrides[get_db] = _fake_db

    # Grant all permissions so require_permission closures always pass.
    monkeypatch.setattr(perms_module, "_get_permissions_for_role", _all_permissions)

    # Stub ModuleRegistryService
    from app.api.v1 import tcd_vertical as _v

    monkeypatch.setattr(_v, "ModuleRegistryService", lambda session: _FakeRegistry())

    # Stub Redis
    fake_redis = _FakeRedis()

    async def _fake_get_redis():
        return fake_redis

    monkeypatch.setattr(_v, "get_redis", _fake_get_redis)

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


def test_list_modules_unknown_session_404(client: TestClient):
    fake_id = uuid.uuid4()
    r = client.get(f"/api/v1/tcd/verticals/{fake_id}/modules")
    assert r.status_code == 404


def test_create_session_and_list_modules(client: TestClient):
    """Happy path: create session → list modules (empty registry)."""
    create = client.post("/api/v1/tcd/verticals", json={"preset": "generic"})
    assert create.status_code == 201
    session_id = create.json()["id"]

    r = client.get(f"/api/v1/tcd/verticals/{session_id}/modules")
    assert r.status_code == 200
    assert r.json()["total"] == 0
    assert r.json()["modules"] == []


def test_route_with_empty_registry_returns_sentinel(client: TestClient):
    create = client.post("/api/v1/tcd/verticals", json={"preset": "trading"})
    assert create.status_code == 201
    session_id = create.json()["id"]

    r = client.post(
        f"/api/v1/tcd/verticals/{session_id}/route",
        json={"signal": [1.0, 0.0, 0.0], "top_k": 1},
    )
    assert r.status_code == 200
    decisions = r.json()["decisions"]
    assert len(decisions) == 1
    assert decisions[0]["module_id"] is None
    assert decisions[0]["reason"] == "empty_registry"


def test_crystallize_dispatches_and_returns_202(client: TestClient, monkeypatch):
    """Crystallize endpoint should return 202 and dispatch a Celery task."""
    create = client.post("/api/v1/tcd/verticals", json={"preset": "generic"})
    assert create.status_code == 201
    session_id = create.json()["id"]

    # The endpoint does `from app.celery_app import celery_app` at call time,
    # so we monkeypatch the module-level object in app.celery_app.
    from unittest.mock import MagicMock

    import app.celery_app as _ca

    mock_send = MagicMock()
    monkeypatch.setattr(_ca.celery_app, "send_task", mock_send)

    btut_id = str(uuid.uuid4())
    r = client.post(
        f"/api/v1/tcd/verticals/{session_id}/crystallize",
        json={"btut_job_id": btut_id},
    )
    assert r.status_code == 202
    assert r.json()["status"] == "queued"
    assert r.json()["btut_job_id"] == btut_id
    mock_send.assert_called_once()


def test_incremental_push_validates_length_mismatch(client: TestClient):
    create = client.post("/api/v1/tcd/verticals", json={"preset": "generic"})
    assert create.status_code == 201
    session_id = create.json()["id"]

    r = client.post(
        f"/api/v1/tcd/verticals/{session_id}/incremental",
        json={"embeddings": [[0.0, 0.0]], "ids": ["a", "b"]},
    )
    assert r.status_code in (400, 422)  # FastAPI may raise 422 before our handler


def test_incremental_push_success(client: TestClient):
    create = client.post("/api/v1/tcd/verticals", json={"preset": "generic"})
    assert create.status_code == 201
    session_id = create.json()["id"]

    r = client.post(
        f"/api/v1/tcd/verticals/{session_id}/incremental",
        json={"embeddings": [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]], "ids": ["a", "b"]},
    )
    assert r.status_code == 200
    assert r.json()["pushed"] == 2


def test_export_unknown_module_404(client: TestClient):
    fake = uuid.uuid4()
    r = client.get(f"/api/v1/tcd/modules/{fake}/export?format=json")
    assert r.status_code == 404


def test_tcd_router_is_mounted():
    paths = {r.path for r in app.routes if "/api/v1/tcd" in getattr(r, "path", "")}
    assert "/api/v1/tcd/verticals" in paths
    assert "/api/v1/tcd/verticals/{session_id}/crystallize" in paths
    assert "/api/v1/tcd/verticals/{session_id}/incremental" in paths
    assert "/api/v1/tcd/verticals/{session_id}/modules" in paths
    assert "/api/v1/tcd/verticals/{session_id}/route" in paths
    assert "/api/v1/tcd/modules/{module_id}/export" in paths
