"""Docker SDK implementation of ContainerOrchestrator."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from .orchestrator import (
    ContainerConfig,
    ContainerInfo,
    ContainerOrchestrator,
    ContainerStatus,
    ExecResult,
)

logger = logging.getLogger(__name__)


class DockerOrchestrator(ContainerOrchestrator):
    """Docker-based container orchestration using docker-py.

    Falls back gracefully if the ``docker`` package is not installed or the
    Docker daemon is not running.  All blocking Docker SDK calls are
    dispatched to a thread-pool executor so the async event-loop is never
    blocked.
    """

    def __init__(self, base_url: str | None = None):
        self._base_url = base_url  # None lets docker-py auto-detect
        self._client = None
        self._available = False

    # ── internal helpers ─────────────────────────────────────────────

    async def _get_client(self):
        """Lazy-initialise the Docker client with a connection test."""
        if self._client is not None:
            return self._client

        try:
            import docker  # noqa: F811
        except ImportError as exc:
            raise RuntimeError(
                "docker package is not installed. "
                "Install it with: pip install docker"
            ) from exc

        loop = asyncio.get_running_loop()

        def _connect():
            if self._base_url:
                client = docker.DockerClient(base_url=self._base_url)
            else:
                client = docker.from_env()
            client.ping()
            return client

        try:
            self._client = await loop.run_in_executor(None, _connect)
            self._available = True
            logger.info("Docker daemon connected")
        except Exception as exc:
            self._available = False
            raise RuntimeError(f"Docker not available: {exc}") from exc

        return self._client

    async def _run(self, fn, *args, **kwargs):
        """Run a blocking callable in the default executor."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    def _parse_container(self, container) -> ContainerInfo:
        """Build a ``ContainerInfo`` from a docker-py Container object."""
        attrs = container.attrs or {}
        state = attrs.get("State", {})
        network = attrs.get("NetworkSettings", {})

        # Determine status
        if state.get("Running"):
            status = ContainerStatus.RUNNING
        elif state.get("Error"):
            status = ContainerStatus.ERROR
        else:
            status = ContainerStatus.STOPPED

        # Parse port mappings
        ports: dict[int, int] = {}
        for raw_port, bindings in (network.get("Ports") or {}).items():
            if bindings:
                container_port = int(raw_port.split("/")[0])
                host_port = int(bindings[0].get("HostPort", 0))
                if host_port:
                    ports[container_port] = host_port

        # Parse timestamps
        created_at = _parse_docker_ts(attrs.get("Created"))
        started_at = _parse_docker_ts(state.get("StartedAt"))

        # Health
        health_state = state.get("Health", {})
        health = health_state.get("Status", "unknown") if health_state else "unknown"

        # IP address
        ip_address = ""
        networks = network.get("Networks", {})
        if networks:
            first_net = next(iter(networks.values()), {})
            ip_address = first_net.get("IPAddress", "")

        return ContainerInfo(
            id=container.id,
            name=container.name,
            status=status,
            image=str(container.image.tags[0]) if container.image.tags else "",
            ports=ports,
            created_at=created_at,
            started_at=started_at,
            health=health,
            ip_address=ip_address,
        )

    # ── public API ───────────────────────────────────────────────────

    async def create(self, config: ContainerConfig) -> ContainerInfo:
        """Create (but do not start) a container from *config*."""
        client = await self._get_client()

        # Build port bindings: {container_port: host_port}
        port_bindings = {
            f"{cp}/tcp": hp for cp, hp in config.ports.items()
        }
        exposed_ports = {f"{cp}/tcp": {} for cp in config.ports}

        # Build volume bindings
        volumes = {
            host: {"bind": cont, "mode": "rw"}
            for host, cont in config.volumes.items()
        }

        # Healthcheck
        healthcheck = None
        if config.healthcheck_cmd:
            healthcheck = {
                "Test": ["CMD-SHELL", config.healthcheck_cmd],
                "Interval": config.healthcheck_interval * 10**9,  # ns
                "Timeout": config.healthcheck_timeout * 10**9,
                "Retries": config.healthcheck_retries,
            }

        # Restart policy
        restart_map = {
            "unless-stopped": {"Name": "unless-stopped"},
            "always": {"Name": "always"},
            "on-failure": {"Name": "on-failure", "MaximumRetryCount": 5},
            "no": {"Name": ""},
        }
        restart = restart_map.get(
            config.restart_policy, {"Name": "unless-stopped"}
        )

        # Nano-cpus (docker expects int nanocpus)
        nano_cpus = int(config.cpu_limit * 1e9)

        try:
            container = await self._run(
                client.containers.create,
                image=config.image,
                name=config.name,
                environment=config.environment,
                ports=port_bindings,
                volumes=volumes or None,
                labels=config.labels,
                mem_limit=config.memory_limit,
                nano_cpus=nano_cpus,
                restart_policy=restart,
                healthcheck=healthcheck,
                detach=True,
            )
            logger.info(
                "Container created: %s (%s)", config.name, container.short_id
            )
            # Reload to get full attrs
            await self._run(container.reload)
            return self._parse_container(container)
        except Exception as exc:
            _raise_descriptive(exc, config.name)

    async def start(self, container_id: str) -> ContainerInfo:
        """Start a created or stopped container."""
        client = await self._get_client()
        try:
            container = await self._run(client.containers.get, container_id)
            await self._run(container.start)
            await self._run(container.reload)
            logger.info("Container started: %s", container.short_id)
            return self._parse_container(container)
        except Exception as exc:
            _raise_descriptive(exc, container_id)

    async def stop(self, container_id: str, timeout: int = 30) -> ContainerInfo:
        """Stop a running container."""
        client = await self._get_client()
        try:
            container = await self._run(client.containers.get, container_id)
            await self._run(container.stop, timeout=timeout)
            await self._run(container.reload)
            logger.info("Container stopped: %s", container.short_id)
            return self._parse_container(container)
        except Exception as exc:
            _raise_descriptive(exc, container_id)

    async def remove(self, container_id: str, force: bool = False) -> bool:
        """Remove a container.  Returns True on success."""
        client = await self._get_client()
        try:
            container = await self._run(client.containers.get, container_id)
            await self._run(container.remove, force=force)
            logger.info("Container removed: %s", container_id[:12])
            return True
        except Exception as exc:
            logger.warning("Failed to remove container %s: %s", container_id[:12], exc)
            return False

    async def get_info(self, container_id: str) -> ContainerInfo:
        """Return current info for a container."""
        client = await self._get_client()
        try:
            container = await self._run(client.containers.get, container_id)
            await self._run(container.reload)
            return self._parse_container(container)
        except Exception as exc:
            # If container not found, return a NOT_FOUND stub
            import docker.errors  # type: ignore[import-untyped]

            if isinstance(exc, docker.errors.NotFound):
                return ContainerInfo(
                    id=container_id,
                    name="",
                    status=ContainerStatus.NOT_FOUND,
                    image="",
                    ports={},
                )
            _raise_descriptive(exc, container_id)

    async def exec_command(
        self, container_id: str, command: list[str], timeout: int = 60
    ) -> ExecResult:
        """Execute a command inside a running container."""
        client = await self._get_client()

        async def _exec():
            container = await self._run(client.containers.get, container_id)
            result = await self._run(
                container.exec_run, cmd=command, demux=True
            )
            exit_code = result.exit_code
            stdout = (result.output[0] or b"").decode("utf-8", errors="replace") if isinstance(result.output, tuple) else (result.output or b"").decode("utf-8", errors="replace")
            stderr = (result.output[1] or b"").decode("utf-8", errors="replace") if isinstance(result.output, tuple) else ""
            return ExecResult(exit_code=exit_code, stdout=stdout, stderr=stderr)

        try:
            return await asyncio.wait_for(_exec(), timeout=timeout)
        except asyncio.TimeoutError:
            return ExecResult(
                exit_code=-1,
                stdout="",
                stderr=f"Command timed out after {timeout}s",
            )
        except Exception as exc:
            _raise_descriptive(exc, container_id)

    async def get_logs(self, container_id: str, tail: int = 100) -> str:
        """Return the last *tail* lines of container logs."""
        client = await self._get_client()
        try:
            container = await self._run(client.containers.get, container_id)
            raw = await self._run(container.logs, tail=tail)
            return raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
        except Exception as exc:
            logger.warning("Failed to get logs for %s: %s", container_id[:12], exc)
            return ""

    async def wait_healthy(
        self, container_id: str, timeout: int = 120
    ) -> bool:
        """Poll container health until healthy or *timeout* seconds elapse.

        If the container has no healthcheck configured, this falls back to
        checking that the container is in the ``running`` state.
        """
        client = await self._get_client()
        deadline = asyncio.get_event_loop().time() + timeout
        interval = 2

        while asyncio.get_event_loop().time() < deadline:
            try:
                container = await self._run(client.containers.get, container_id)
                await self._run(container.reload)
                state = container.attrs.get("State", {})

                # If there's a healthcheck, wait for "healthy"
                health = state.get("Health", {})
                if health:
                    if health.get("Status") == "healthy":
                        return True
                    if health.get("Status") == "unhealthy":
                        logger.warning(
                            "Container %s is unhealthy", container_id[:12]
                        )
                        return False
                else:
                    # No healthcheck — just confirm it's running
                    if state.get("Running"):
                        return True

            except Exception as exc:
                logger.debug(
                    "Health poll error for %s: %s", container_id[:12], exc
                )

            await asyncio.sleep(interval)
            # Exponential backoff capped at 10s
            interval = min(interval * 1.5, 10)

        logger.warning(
            "Container %s did not become healthy within %ds",
            container_id[:12],
            timeout,
        )
        return False

    async def list_containers(
        self, labels: dict[str, str] | None = None
    ) -> list[ContainerInfo]:
        """List containers, optionally filtered by labels."""
        client = await self._get_client()
        filters: dict = {}
        if labels:
            filters["label"] = [f"{k}={v}" for k, v in labels.items()]

        try:
            containers = await self._run(
                client.containers.list, all=True, filters=filters
            )
            results = []
            for c in containers:
                await self._run(c.reload)
                results.append(self._parse_container(c))
            return results
        except Exception as exc:
            logger.warning("Failed to list containers: %s", exc)
            return []


# ── module-level helpers ─────────────────────────────────────────────


def _parse_docker_ts(raw: str | None) -> datetime | None:
    """Parse a Docker timestamp string into a datetime."""
    if not raw or raw == "0001-01-01T00:00:00Z":
        return None
    try:
        # Docker uses RFC 3339 with variable fractional-second precision
        cleaned = raw.split(".")[0]  # drop fractional seconds
        return datetime.strptime(cleaned, "%Y-%m-%dT%H:%M:%S").replace(
            tzinfo=timezone.utc
        )
    except (ValueError, TypeError):
        return None


def _raise_descriptive(exc: Exception, context: str) -> None:
    """Re-raise Docker exceptions with clearer messages."""
    try:
        import docker.errors  # type: ignore[import-untyped]
    except ImportError:
        raise exc

    if isinstance(exc, docker.errors.NotFound):
        raise RuntimeError(f"Container not found: {context}") from exc
    if isinstance(exc, docker.errors.APIError):
        msg = str(exc)
        if "port is already allocated" in msg:
            raise RuntimeError(
                f"Port conflict for {context}: {msg}"
            ) from exc
        if "OOM" in msg or "out of memory" in msg.lower():
            raise RuntimeError(
                f"Container {context} killed by OOM: {msg}"
            ) from exc
        raise RuntimeError(
            f"Docker API error for {context}: {msg}"
        ) from exc
    if isinstance(exc, docker.errors.ImageNotFound):
        raise RuntimeError(
            f"Image not found for {context}: {exc}"
        ) from exc
    raise exc
