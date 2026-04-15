"""Container orchestration abstraction.

Provides a clean interface for managing containers that can be implemented
by Docker (docker-py) or Kubernetes (kubernetes-client) backends.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class ContainerStatus(str, Enum):
    CREATING = "creating"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"
    NOT_FOUND = "not_found"


@dataclass
class ContainerConfig:
    image: str
    name: str
    environment: dict[str, str] = field(default_factory=dict)
    ports: dict[int, int] = field(default_factory=dict)  # container_port -> host_port
    volumes: dict[str, str] = field(default_factory=dict)  # host_path -> container_path
    labels: dict[str, str] = field(default_factory=dict)
    memory_limit: str = "2g"
    cpu_limit: float = 2.0
    restart_policy: str = "unless-stopped"
    healthcheck_cmd: str = ""
    healthcheck_interval: int = 30  # seconds
    healthcheck_timeout: int = 10
    healthcheck_retries: int = 3


@dataclass
class ContainerInfo:
    id: str
    name: str
    status: ContainerStatus
    image: str
    ports: dict[int, int]
    created_at: datetime | None = None
    started_at: datetime | None = None
    health: str = "unknown"
    ip_address: str = ""


@dataclass
class ExecResult:
    exit_code: int
    stdout: str
    stderr: str


class ContainerOrchestrator(ABC):
    """Abstract container orchestrator.

    Implementations must handle the full lifecycle of containers:
    create, start, stop, remove, exec, logs, health checks, and listing.
    All methods are async to support non-blocking I/O in FastAPI services.
    """

    @abstractmethod
    async def create(self, config: ContainerConfig) -> ContainerInfo: ...

    @abstractmethod
    async def start(self, container_id: str) -> ContainerInfo: ...

    @abstractmethod
    async def stop(self, container_id: str, timeout: int = 30) -> ContainerInfo: ...

    @abstractmethod
    async def remove(self, container_id: str, force: bool = False) -> bool: ...

    @abstractmethod
    async def get_info(self, container_id: str) -> ContainerInfo: ...

    @abstractmethod
    async def exec_command(
        self, container_id: str, command: list[str], timeout: int = 60
    ) -> ExecResult: ...

    @abstractmethod
    async def get_logs(self, container_id: str, tail: int = 100) -> str: ...

    @abstractmethod
    async def wait_healthy(
        self, container_id: str, timeout: int = 120
    ) -> bool: ...

    @abstractmethod
    async def list_containers(
        self, labels: dict[str, str] | None = None
    ) -> list[ContainerInfo]: ...
