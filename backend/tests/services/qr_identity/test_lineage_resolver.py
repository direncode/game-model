import uuid
import pytest
from unittest.mock import AsyncMock

from app.services.qr_identity.lineage_resolver import QRLineageResolver


@pytest.fixture
def mock_lineage_tracker():
    tracker = AsyncMock()
    tracker.get_lineage.return_value = [
        {"event_type": "ingestion", "action": "Ingested document"},
        {"event_type": "crystallization", "action": "Crystallized to module"},
    ]
    tracker.get_lineage_graph.return_value = {
        "nodes": [{"id": "a"}, {"id": "b"}],
        "edges": [{"source": "a", "target": "b"}],
    }
    return tracker


@pytest.mark.asyncio
async def test_public_returns_shallow_lineage(mock_lineage_tracker):
    resolver = QRLineageResolver(mock_lineage_tracker)
    result = await resolver.resolve("module", uuid.uuid4(), "public")
    assert "summary" in result
    assert "graph" not in result


@pytest.mark.asyncio
async def test_org_returns_full_lineage(mock_lineage_tracker):
    resolver = QRLineageResolver(mock_lineage_tracker)
    result = await resolver.resolve("module", uuid.uuid4(), "org")
    assert "graph" in result


@pytest.mark.asyncio
async def test_admin_returns_full_lineage(mock_lineage_tracker):
    resolver = QRLineageResolver(mock_lineage_tracker)
    result = await resolver.resolve("module", uuid.uuid4(), "admin")
    assert "graph" in result
