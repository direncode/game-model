"""LSC (Latent Stretcher Center) services.

Layer 4 (compute abstraction) + Layer 5 (backend providers) + Layer 8
(billing / metering) for the public substrate API.

Public surface:
    CostAwareRouter, BackendUnavailable
        — multi-cloud backend routing with spot-price awareness.
    record_job_usage
        — persist per-job usage record for billing rollup.
"""
from .backends import CostAwareRouter, BackendUnavailable
from .metering import record_job_usage

__all__ = ["CostAwareRouter", "BackendUnavailable", "record_job_usage"]
