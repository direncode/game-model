"""Dataset adapter registry for multi-dataset BTUT support.

Usage:
    from app.services.btut.adapters import get_adapter, list_datasets

    adapter = get_adapter("edgar")
    entities = adapter.fetch_entities(limit=10000)

    all_datasets = list_datasets()  # Returns list of DatasetMeta
"""

from __future__ import annotations

from .base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

_ADAPTERS: dict[str, type[BaseDatasetAdapter]] = {}


def register_adapter(dataset_id: str):
    """Class decorator to register a dataset adapter."""
    def decorator(cls: type[BaseDatasetAdapter]) -> type[BaseDatasetAdapter]:
        _ADAPTERS[dataset_id] = cls
        return cls
    return decorator


def get_adapter(dataset_id: str) -> BaseDatasetAdapter:
    """Instantiate an adapter by dataset ID."""
    if dataset_id not in _ADAPTERS:
        available = ", ".join(sorted(_ADAPTERS.keys()))
        raise ValueError(f"Unknown dataset '{dataset_id}'. Available: {available}")
    return _ADAPTERS[dataset_id]()


def list_datasets() -> list[DatasetMeta]:
    """Return metadata for all registered datasets."""
    return [_ADAPTERS[did]().get_meta() for did in sorted(_ADAPTERS.keys())]


def list_dataset_ids() -> list[str]:
    """Return all registered dataset IDs."""
    return sorted(_ADAPTERS.keys())


# Import all adapter modules to trigger registration
from . import edgar  # noqa: E402, F401
from . import pubmed  # noqa: E402, F401
from . import patents  # noqa: E402, F401
from . import comtrade  # noqa: E402, F401
from . import climate  # noqa: E402, F401
