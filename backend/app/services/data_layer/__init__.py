"""Latent Ocean Data Layer — unified spine over ingest → BTUT → manifold → verticals.

This package is a *thin facade* over the existing BTUT engine and dataset
adapters. It does not replace any code in ``app.services.btut``,
``app.services.ingestion``, or ``app.services.crystallization``. It
routes calls through them and adds:

  1. A single entry point (``LatentOceanDataLayer``) matching the
     requested API: ingest / apply_btut_tuner / project_to_manifold /
     get_survivors / export_for_vertical / run.
  2. Manifold projection: 8D unit hypersphere (compute) + 3D S² (display).
  3. Four-signal causal linking scaffold (cosine wired, 3 stubs).
  4. Vertical export contracts for niv / tcd_jepa / data.
"""
from __future__ import annotations

from .core import LatentOceanDataLayer
from .orchestrator import OceanOrchestrator

__all__ = ["LatentOceanDataLayer", "OceanOrchestrator"]
