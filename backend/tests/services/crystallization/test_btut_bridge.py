import numpy as np
import pytest

from app.services.crystallization.btut_bridge import (
    from_pipeline_dict,
    from_tuner_result,
)
from app.services.crystallization.vertical_types import BTUTSurvivorBundle


def test_from_pipeline_dict_basic():
    pipe = {
        "summary": {"survivors": 3, "variance_preservation": 0.91},
        "survivors": [
            {"entity": {"name": "alpha"}, "cluster": 0, "scores": {"composite": 0.8}},
            {"entity": {"name": "beta"},  "cluster": 0, "scores": {"composite": 0.7}},
            {"entity": {"name": "gamma"}, "cluster": 1, "scores": {"composite": 0.6}},
        ],
        "embeddings_8d": [0.0] * 24,  # 3 survivors × 8 dims
    }
    bundle = from_pipeline_dict(pipe)
    assert isinstance(bundle, BTUTSurvivorBundle)
    assert bundle.embeddings.shape == (3, 8)
    assert bundle.ids == ["alpha", "beta", "gamma"]
    assert bundle.metadata["variance_preservation"] == 0.91
    assert bundle.metadata["cluster_assignments"] == [0, 0, 1]


def test_from_pipeline_dict_empty_embeddings_raises():
    pipe = {
        "summary": {},
        "survivors": [{"entity": {"name": "a"}, "cluster": 0, "scores": {}}],
        "embeddings_8d": [],
    }
    with pytest.raises(ValueError, match="embeddings_8d"):
        from_pipeline_dict(pipe)


def test_from_tuner_result_maps_edges():
    class FakeResult:
        survivors = [{"name": "a"}, {"name": "b"}, {"name": "c"}]
        survivor_edges = [("a", "b", 0.9), ("b", "c", 0.5)]
        quality_scores = {"purity": 0.88}
        survivor_embeddings = np.random.RandomState(0).randn(3, 8).astype(np.float32)
        provenance_job_id = "job-xyz"

    bundle = from_tuner_result(FakeResult())
    assert bundle.embeddings.shape == (3, 8)
    assert bundle.ids == ["a", "b", "c"]
    assert bundle.edges == [(0, 1, 0.9), (1, 2, 0.5)]
    assert bundle.metadata["quality_scores"]["purity"] == 0.88
    assert bundle.metadata["provenance_job_id"] == "job-xyz"
