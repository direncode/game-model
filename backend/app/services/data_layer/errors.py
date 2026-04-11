"""Exceptions raised by LatentOceanDataLayer. Fail-fast, no silent fallbacks."""
from __future__ import annotations


class DataLayerError(Exception):
    """Base class for all data layer exceptions."""


class UnknownSourceError(DataLayerError):
    """ingest() received a source id not registered with btut.adapters."""


class NoIngestError(DataLayerError):
    """apply_btut_tuner() called before ingest()."""


class NoBTUTResultError(DataLayerError):
    """project_to_manifold() called before apply_btut_tuner()."""


class NoManifoldError(DataLayerError):
    """get_survivors() / export_for_vertical() / link_causally() called
    before project_to_manifold()."""


class UnknownVerticalError(DataLayerError):
    """export_for_vertical() received an unknown vertical name."""
