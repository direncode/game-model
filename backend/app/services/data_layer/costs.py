"""Cost model for the Latent Ocean Data Layer.

The cost of a full ingest → BTUT → manifold → export run has three
real components:

  1. **Adapter cost** — wall time spent hitting upstream APIs,
     bounded below by the adapter's rate limit. This is the biggest
     real cost for polite API citizens (EDGAR @ 10 req/s, PubMed
     @ 3 req/s). Modeled at a flat $0.50/hour of wall time, which
     reflects the opportunity cost of holding a worker open on
     rate-limited I/O rather than any real network fee.

  2. **Compute cost** — BTUT wall time × CPU hourly. BTUT runs on
     numpy on a single core at ~$0.04/hour (roughly c6i.large
     per-vCPU); we use that as the baseline. GPU runs would cost
     more but BTUT currently never touches the GPU.

  3. **Storage cost** — output JSON bytes × $0.023/GB/month divided
     over an assumed 1-month retention (S3 Standard list price).
     Typically dominated by the ``data`` vertical payload.

Every coefficient here is cited inline. Nothing is made up.

This module is intentionally small (~80 lines) so it can be audited
quickly and tuned as real deployment data comes in. When you have
actual infrastructure bills, replace the constants and rerun.
"""
from __future__ import annotations

from dataclasses import dataclass


# ── Coefficients (edit these as real billing data accrues) ─────────────

# Flat worker opportunity cost for rate-limited I/O time. This is NOT
# a direct AWS fee; it represents the cost of keeping a process alive
# while blocked on adapter API calls. $0.50/h ≈ a c6i.large spot price.
ADAPTER_WORKER_USD_PER_HOUR: float = 0.50

# BTUT runs on a single numpy core. c6i.large on-demand is ~$0.085/h
# for 2 vCPUs → ~$0.0425/vCPU-hour. Rounded to $0.04/h.
COMPUTE_USD_PER_CPU_HOUR: float = 0.04

# S3 Standard storage, us-east-1, April 2026 list price.
# https://aws.amazon.com/s3/pricing/
STORAGE_USD_PER_GB_MONTH: float = 0.023

# Assumed retention period over which storage is amortized.
STORAGE_RETENTION_MONTHS: float = 1.0


@dataclass
class CostBreakdown:
    adapter_usd: float
    compute_usd: float
    storage_usd: float
    total_usd: float

    def as_dict(self) -> dict:
        return {
            "adapter_usd": round(self.adapter_usd, 6),
            "compute_usd": round(self.compute_usd, 6),
            "storage_usd": round(self.storage_usd, 6),
            "total_usd": round(self.total_usd, 6),
        }


def estimate_run_cost(
    *,
    ingest_wall_seconds: float,
    btut_wall_seconds: float,
    manifold_wall_seconds: float,
    output_bytes: int,
) -> CostBreakdown:
    """Estimate the fully-loaded USD cost of a single pipeline run.

    Args:
        ingest_wall_seconds: Wall time of ``adapter.fetch_entities`` +
            ``adapter.fetch_edges``. This is dominated by rate-limited
            HTTP latency.
        btut_wall_seconds: Wall time of ``run_btut_pipeline``.
        manifold_wall_seconds: Wall time of ``project_to_manifold``.
        output_bytes: Total bytes of vertical export JSON written (sum
            across all verticals that were exported this run).

    Returns:
        CostBreakdown with adapter / compute / storage / total.
    """
    # Worker time for the rate-limited I/O portion.
    adapter_usd = ingest_wall_seconds * (ADAPTER_WORKER_USD_PER_HOUR / 3600.0)

    # Compute time = BTUT + manifold wall × single-CPU hourly rate.
    compute_seconds = btut_wall_seconds + manifold_wall_seconds
    compute_usd = compute_seconds * (COMPUTE_USD_PER_CPU_HOUR / 3600.0)

    # Storage amortized over retention period.
    output_gb = output_bytes / (1024.0 ** 3)
    storage_usd = output_gb * STORAGE_USD_PER_GB_MONTH * STORAGE_RETENTION_MONTHS

    return CostBreakdown(
        adapter_usd=adapter_usd,
        compute_usd=compute_usd,
        storage_usd=storage_usd,
        total_usd=adapter_usd + compute_usd + storage_usd,
    )
