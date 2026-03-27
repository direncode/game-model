"""GPU detection and management for TCD-JEPA training.

Provides device detection, memory monitoring, GPU allocation,
and graceful CPU fallback for environments without CUDA.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class GPUInfo:
    """Information about a single GPU device."""

    index: int
    name: str
    total_memory_mb: int
    free_memory_mb: int
    used_memory_mb: int
    utilization_percent: float
    temperature_celsius: float | None = None


@dataclass
class DeviceAllocation:
    """Result of GPU allocation request."""

    device: str  # "cuda:0", "cuda:1", or "cpu"
    gpu_info: GPUInfo | None = None
    is_cpu_fallback: bool = False
    reason: str | None = None


class GPUManager:
    """Manage GPU resources for crystallization training jobs."""

    def __init__(self) -> None:
        self._torch_available = False
        self._cuda_available = False
        self._initialize()

    def _initialize(self) -> None:
        """Detect PyTorch and CUDA availability."""
        try:
            import torch

            self._torch_available = True
            self._cuda_available = torch.cuda.is_available()

            if self._cuda_available:
                gpu_count = torch.cuda.device_count()
                logger.info(
                    "GPU manager initialized: %d CUDA device(s) available",
                    gpu_count,
                )
            else:
                logger.info(
                    "GPU manager initialized: no CUDA devices, CPU fallback mode"
                )
        except ImportError:
            logger.warning(
                "PyTorch not installed — GPU management unavailable"
            )

    @property
    def cuda_available(self) -> bool:
        """Whether CUDA GPUs are available."""
        return self._cuda_available

    @property
    def device_count(self) -> int:
        """Number of available CUDA devices."""
        if not self._cuda_available:
            return 0
        import torch

        return torch.cuda.device_count()

    def get_gpu_info(self, device_index: int = 0) -> GPUInfo | None:
        """Get detailed information about a specific GPU.

        Args:
            device_index: CUDA device index.

        Returns:
            GPUInfo or None if device not available.
        """
        if not self._cuda_available:
            return None

        try:
            import torch

            if device_index >= torch.cuda.device_count():
                return None

            props = torch.cuda.get_device_properties(device_index)
            total = props.total_mem // (1024 * 1024)

            torch.cuda.set_device(device_index)
            free, _ = torch.cuda.mem_get_info(device_index)
            free_mb = free // (1024 * 1024)
            used_mb = total - free_mb

            # Utilization: rough estimate from memory usage
            utilization = (used_mb / total * 100) if total > 0 else 0.0

            return GPUInfo(
                index=device_index,
                name=props.name,
                total_memory_mb=total,
                free_memory_mb=free_mb,
                used_memory_mb=used_mb,
                utilization_percent=round(utilization, 1),
            )

        except Exception:
            logger.exception("Failed to get GPU info for device %d", device_index)
            return None

    def list_gpus(self) -> list[GPUInfo]:
        """List all available GPUs with their current status.

        Returns:
            List of GPUInfo for each available device.
        """
        gpus: list[GPUInfo] = []
        for i in range(self.device_count):
            info = self.get_gpu_info(i)
            if info is not None:
                gpus.append(info)
        return gpus

    def allocate(
        self,
        min_memory_mb: int = 2048,
        preferred_device: int | None = None,
    ) -> DeviceAllocation:
        """Allocate a GPU for a training job.

        Selects the GPU with the most free memory that meets the minimum
        memory requirement. Falls back to CPU if no suitable GPU is found.

        Args:
            min_memory_mb: Minimum required free GPU memory in MB.
            preferred_device: Preferred GPU index (used if it meets requirements).

        Returns:
            DeviceAllocation with the selected device.
        """
        if not self._cuda_available:
            return DeviceAllocation(
                device="cpu",
                is_cpu_fallback=True,
                reason="No CUDA devices available",
            )

        # Check preferred device first
        if preferred_device is not None:
            info = self.get_gpu_info(preferred_device)
            if info and info.free_memory_mb >= min_memory_mb:
                logger.info(
                    "Allocated preferred GPU %d: %s (%d MB free)",
                    preferred_device,
                    info.name,
                    info.free_memory_mb,
                )
                return DeviceAllocation(
                    device=f"cuda:{preferred_device}",
                    gpu_info=info,
                )

        # Find GPU with most free memory
        best: GPUInfo | None = None
        for gpu in self.list_gpus():
            if gpu.free_memory_mb >= min_memory_mb:
                if best is None or gpu.free_memory_mb > best.free_memory_mb:
                    best = gpu

        if best is not None:
            logger.info(
                "Allocated GPU %d: %s (%d MB free)",
                best.index,
                best.name,
                best.free_memory_mb,
            )
            return DeviceAllocation(
                device=f"cuda:{best.index}",
                gpu_info=best,
            )

        # CPU fallback
        logger.warning(
            "No GPU with >= %d MB free memory; falling back to CPU",
            min_memory_mb,
        )
        return DeviceAllocation(
            device="cpu",
            is_cpu_fallback=True,
            reason=f"No GPU with >= {min_memory_mb} MB free memory",
        )

    def get_memory_usage(self, device_index: int = 0) -> dict[str, int] | None:
        """Get current memory usage for a GPU.

        Args:
            device_index: CUDA device index.

        Returns:
            Dictionary with allocated, reserved, and free memory in MB,
            or None if device not available.
        """
        if not self._cuda_available:
            return None

        try:
            import torch

            if device_index >= torch.cuda.device_count():
                return None

            torch.cuda.set_device(device_index)
            return {
                "allocated_mb": torch.cuda.memory_allocated(device_index) // (1024 * 1024),
                "reserved_mb": torch.cuda.memory_reserved(device_index) // (1024 * 1024),
                "max_allocated_mb": torch.cuda.max_memory_allocated(device_index) // (1024 * 1024),
                "free_mb": (
                    torch.cuda.mem_get_info(device_index)[0] // (1024 * 1024)
                ),
            }
        except Exception:
            logger.exception(
                "Failed to get memory usage for device %d", device_index
            )
            return None

    @staticmethod
    def clear_cache(device_index: int = 0) -> None:
        """Clear CUDA memory cache for a device.

        Args:
            device_index: CUDA device index.
        """
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.set_device(device_index)
                torch.cuda.empty_cache()
                logger.info("Cleared CUDA cache for device %d", device_index)
        except Exception:
            logger.exception(
                "Failed to clear CUDA cache for device %d", device_index
            )
