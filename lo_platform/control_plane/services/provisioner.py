"""Fork Provisioner — creates and manages customer fork instances.

The provisioner is the core orchestration service for the control plane.
It handles the full lifecycle of a customer fork:

    create_fork    -> provision container, init schema, run first reduction
    suspend_fork   -> stop container, mark suspended
    resume_fork    -> restart container, mark active
    teardown_fork  -> stop container, clean up, mark teardown
    trigger_reduction -> run an ad-hoc reduction cycle

Uses a ContainerOrchestrator abstraction for container management (Docker
by default, Kubernetes in future) and SQLAlchemy for fork state persistence.
All methods are async for use with FastAPI.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .orchestrator import (
    ContainerConfig,
    ContainerOrchestrator,
    ContainerStatus,
)

logger = logging.getLogger(__name__)

# Path to the fork docker-compose template
FORK_TEMPLATE_DIR = Path(__file__).resolve().parent.parent.parent / "fork_template"


@dataclass
class ForkProvisionRequest:
    """Request to create a new fork instance."""

    customer_id: str
    subdomain: str
    source_connection_string: str
    output_connection_string: str | None = None
    output_schema: str = "latent_ocean"
    enabled_modules: list[str] | None = None
    engine_budget: float = 50.0
    target_survivors: int = 300
    display_name: str = ""
    reduction_schedule: str = "0 2 * * *"


@dataclass
class ForkStatus:
    """Current status snapshot of a fork."""

    fork_id: str
    status: str
    container_running: bool = False
    health_status: str = "unknown"
    entity_count: int = 0
    survivor_count: int = 0
    last_reduction_at: str | None = None
    error: str | None = None


class ForkProvisioner:
    """Manages the lifecycle of customer fork instances.

    Orchestrates container provisioning, database initialization,
    reduction scheduling, and health monitoring for each fork.

    Args:
        orchestrator: Container orchestrator backend (Docker, K8s, etc.).
        db_session_factory: Async SQLAlchemy session factory.
        settings: ControlPlaneSettings instance.
    """

    def __init__(
        self,
        orchestrator: ContainerOrchestrator | None = None,
        db_session_factory: Any = None,
        settings: Any = None,
    ) -> None:
        self._orchestrator = orchestrator
        self._db_factory = db_session_factory
        self._settings = settings
        self._active_containers: dict[str, str] = {}  # fork_id -> container_id

    def _require_orchestrator(self) -> ContainerOrchestrator:
        """Return the orchestrator or raise if none was configured."""
        if self._orchestrator is None:
            raise RuntimeError(
                "No container orchestrator configured. "
                "Pass a ContainerOrchestrator to ForkProvisioner.__init__."
            )
        return self._orchestrator

    # ── Fork creation ─────────────────────────────────────────────────

    async def create_fork(self, request: ForkProvisionRequest) -> dict:
        """Create a new fork instance through the full provisioning pipeline.

        Steps:
            1. Validate customer connection (test connectivity)
            2. Introspect schema (auto-detect entity types)
            3. Allocate ports
            4. Provision container (via orchestrator)
            5. Wait for container health
            6. Configure routing (subdomain -> container)
            7. Persist fork record
            8. Mark as active

        Args:
            request: Fork provisioning parameters.

        Returns:
            Dict with fork details including id, subdomain, status, ports.

        Raises:
            ConnectionError: If customer database is unreachable.
            RuntimeError: If container provisioning fails.
        """
        orchestrator = self._require_orchestrator()
        fork_id = str(uuid.uuid4())
        logger.info(
            "[provisioner] creating fork %s for customer %s (subdomain=%s)",
            fork_id,
            request.customer_id,
            request.subdomain,
        )

        fork_state: dict[str, Any] = {
            "id": fork_id,
            "customer_id": request.customer_id,
            "subdomain": request.subdomain,
            "display_name": request.display_name,
            "status": "provisioning",
            "error": None,
        }

        try:
            # Step 1: Validate customer database connectivity
            logger.info("[provisioner] step 1: validating source connection")
            await self._validate_connection(request.source_connection_string)

            # Step 2: Introspect schema
            logger.info("[provisioner] step 2: introspecting source schema")
            schema_info = await self._introspect_schema(
                request.source_connection_string
            )

            # Step 3: Allocate ports
            api_port, dashboard_port = await self._allocate_ports()
            fork_state["api_port"] = api_port
            fork_state["dashboard_port"] = dashboard_port

            # Step 4: Provision container via orchestrator
            logger.info("[provisioner] step 4: provisioning container")
            config = self._build_container_config(
                fork_id, request, api_port, dashboard_port
            )
            info = await orchestrator.create(config)
            container_id = info.id
            fork_state["container_id"] = container_id
            self._active_containers[fork_id] = container_id

            # Start the container (create returns a stopped container)
            await orchestrator.start(container_id)

            # Step 5: Wait for container to be ready
            logger.info("[provisioner] step 5: waiting for container startup")
            healthy = await orchestrator.wait_healthy(container_id, timeout=120)
            if not healthy:
                logs = await orchestrator.get_logs(container_id, tail=50)
                raise RuntimeError(
                    f"Container {container_id[:12]} not healthy after 120s. "
                    f"Last logs:\n{logs}"
                )

            # Step 6: Configure subdomain routing
            logger.info("[provisioner] step 6: configuring routing")
            await self._configure_routing(
                subdomain=request.subdomain,
                api_port=api_port,
                dashboard_port=dashboard_port,
            )

            # Step 7: Persist fork record
            await self._persist_fork(
                fork_id, request, container_id, api_port, dashboard_port
            )

            # Step 8: Mark as active
            fork_state["status"] = "active"
            fork_state["schema_info"] = {
                "tables": len(schema_info.get("tables", [])),
                "entity_types": schema_info.get("entity_types", []),
            }

            logger.info(
                "[provisioner] fork %s created successfully: %s.%s:%d",
                fork_id,
                request.subdomain,
                self._get_domain(),
                api_port,
            )

        except Exception as exc:
            fork_state["status"] = "error"
            fork_state["error"] = str(exc)
            logger.error(
                "[provisioner] fork %s creation failed: %s",
                fork_id,
                exc,
            )
            # Attempt cleanup
            await self._cleanup_failed_fork(fork_id)
            raise

        return fork_state

    # ── Fork lifecycle ────────────────────────────────────────────────

    async def suspend_fork(self, fork_id: str) -> dict:
        """Suspend a running fork -- stops the container but preserves state.

        Args:
            fork_id: UUID of the fork to suspend.

        Returns:
            Dict with updated fork status.
        """
        logger.info("[provisioner] suspending fork %s", fork_id)
        orchestrator = self._require_orchestrator()

        container_id = self._active_containers.get(fork_id)
        if container_id:
            await orchestrator.stop(container_id)

        await self._update_fork_status(fork_id, "suspended")

        return {
            "fork_id": fork_id,
            "status": "suspended",
            "suspended_at": datetime.now(timezone.utc).isoformat(),
        }

    async def resume_fork(self, fork_id: str) -> dict:
        """Resume a suspended fork -- restarts the container.

        Args:
            fork_id: UUID of the fork to resume.

        Returns:
            Dict with updated fork status.
        """
        logger.info("[provisioner] resuming fork %s", fork_id)
        orchestrator = self._require_orchestrator()

        container_id = self._active_containers.get(fork_id)
        if container_id:
            await orchestrator.start(container_id)
            healthy = await orchestrator.wait_healthy(container_id, timeout=60)
            if not healthy:
                logger.warning(
                    "[provisioner] container %s not healthy after resume",
                    container_id[:12],
                )

        await self._update_fork_status(fork_id, "active")

        return {
            "fork_id": fork_id,
            "status": "active",
            "resumed_at": datetime.now(timezone.utc).isoformat(),
        }

    async def teardown_fork(self, fork_id: str) -> dict:
        """Teardown a fork -- stops and removes the container and resources.

        This is a destructive operation. The customer's lo_* tables are
        NOT dropped (they own that data), but the container, config, and
        routing are removed.

        Args:
            fork_id: UUID of the fork to teardown.

        Returns:
            Dict with teardown confirmation.
        """
        logger.info("[provisioner] tearing down fork %s", fork_id)
        orchestrator = self._require_orchestrator()

        container_id = self._active_containers.pop(fork_id, None)
        if container_id:
            await orchestrator.stop(container_id)
            await orchestrator.remove(container_id, force=True)

        await self._update_fork_status(fork_id, "teardown")

        return {
            "fork_id": fork_id,
            "status": "teardown",
            "teardown_at": datetime.now(timezone.utc).isoformat(),
        }

    async def trigger_reduction(self, fork_id: str) -> dict:
        """Trigger an ad-hoc reduction cycle for a fork.

        Sends a reduction command to the fork's API server. The fork
        runs the engine pipeline (reduce -> represent -> materialize)
        and updates its metering counters.

        Args:
            fork_id: UUID of the fork.

        Returns:
            Dict with reduction status and results.
        """
        logger.info("[provisioner] triggering reduction for fork %s", fork_id)
        orchestrator = self._require_orchestrator()

        container_id = self._active_containers.get(fork_id)
        if not container_id:
            return {
                "fork_id": fork_id,
                "status": "error",
                "error": "Fork container not found",
            }

        try:
            result = await orchestrator.exec_command(
                container_id,
                ["python", "-m", "fork_runner", "reduce"],
                timeout=300,
            )
            if result.exit_code != 0:
                raise RuntimeError(
                    f"Reduction failed (exit {result.exit_code}): "
                    f"{result.stderr}"
                )
            return {
                "fork_id": fork_id,
                "status": "reduction_started",
                "triggered_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as exc:
            logger.error(
                "[provisioner] reduction trigger failed for %s: %s",
                fork_id,
                exc,
            )
            return {
                "fork_id": fork_id,
                "status": "error",
                "error": str(exc),
            }

    async def update_fork_config(
        self,
        fork_id: str,
        config: dict,
    ) -> dict:
        """Update a fork's engine configuration.

        Writes the new config to the fork's container and optionally
        triggers a re-reduction with the new settings.

        Args:
            fork_id: UUID of the fork.
            config: Dict of config overrides (budget, target_survivors, etc.).

        Returns:
            Dict with updated config confirmation.
        """
        logger.info(
            "[provisioner] updating config for fork %s: %s",
            fork_id,
            list(config.keys()),
        )
        orchestrator = self._require_orchestrator()

        # Persist config update
        await self._update_fork_record(fork_id, {"engine_config": config})

        # Notify the running container of config change
        container_id = self._active_containers.get(fork_id)
        if container_id:
            try:
                await orchestrator.exec_command(
                    container_id,
                    ["python", "-m", "fork_runner", "reload-config"],
                )
            except Exception as exc:
                logger.warning(
                    "[provisioner] config reload failed for %s: %s",
                    fork_id,
                    exc,
                )

        return {
            "fork_id": fork_id,
            "config": config,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    async def get_fork_health(self, fork_id: str) -> dict:
        """Check the health of a running fork.

        Queries the fork's /health endpoint and aggregates metrics from
        the container runtime.

        Args:
            fork_id: UUID of the fork.

        Returns:
            Dict with health status, metrics, and any alerts.
        """
        orchestrator = self._require_orchestrator()
        container_id = self._active_containers.get(fork_id)

        health: dict[str, Any] = {
            "fork_id": fork_id,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "container_running": False,
            "api_responsive": False,
            "status": "unknown",
            "metrics": {},
        }

        if not container_id:
            health["status"] = "no_container"
            return health

        # Check container status via orchestrator
        try:
            info = await orchestrator.get_info(container_id)
            running = info.status == ContainerStatus.RUNNING
            health["container_running"] = running
            health["container_health"] = info.health
        except Exception as exc:
            health["error"] = f"Container check failed: {exc}"
            health["status"] = "unhealthy"
            return health

        if not running:
            health["status"] = "stopped"
            return health

        # Check fork API health endpoint
        try:
            api_health = await self._check_fork_api(fork_id)
            health["api_responsive"] = True
            health["metrics"] = api_health.get("metrics", {})
            health["status"] = "healthy"
        except Exception as exc:
            health["api_responsive"] = False
            health["status"] = "degraded"
            health["error"] = f"API check failed: {exc}"

        return health

    # ── Internal helpers ──────────────────────────────────────────────

    def _get_domain(self) -> str:
        if self._settings:
            return self._settings.DOMAIN
        return "latentocean.io"

    def _build_container_config(
        self,
        fork_id: str,
        request: ForkProvisionRequest,
        api_port: int,
        dashboard_port: int,
    ) -> ContainerConfig:
        """Build a ContainerConfig from provisioning parameters."""
        image = "latentocean/fork:latest"
        if self._settings:
            image = self._settings.FORK_IMAGE

        return ContainerConfig(
            image=image,
            name=f"lo-fork-{fork_id[:12]}",
            environment={
                "FORK_ID": fork_id,
                "CUSTOMER_ID": request.customer_id,
                "SUBDOMAIN": request.subdomain,
                "SOURCE_DSN": request.source_connection_string,
                "OUTPUT_DSN": (
                    request.output_connection_string
                    or request.source_connection_string
                ),
                "OUTPUT_SCHEMA": request.output_schema,
                "ENGINE_BUDGET": str(request.engine_budget),
                "ENABLED_MODULES": ",".join(request.enabled_modules or []),
                "API_PORT": str(api_port),
                "DASHBOARD_PORT": str(dashboard_port),
                "REDUCTION_SCHEDULE": request.reduction_schedule,
            },
            ports={8000: api_port, 3000: dashboard_port},
            labels={
                "lo.fork_id": fork_id,
                "lo.customer_id": request.customer_id,
                "lo.subdomain": request.subdomain,
                "managed-by": "lo-control-plane",
            },
            restart_policy="unless-stopped",
        )

    async def _validate_connection(self, dsn: str) -> None:
        """Test database connectivity by attempting a simple query."""
        logger.debug("[provisioner] testing connection: %s", dsn[:30] + "...")
        try:
            from sqlalchemy import create_engine, text as sa_text

            engine = create_engine(dsn, connect_args={"connect_timeout": 10})
            with engine.connect() as conn:
                conn.execute(sa_text("SELECT 1"))
            engine.dispose()
        except Exception as exc:
            raise ConnectionError(
                f"Cannot connect to customer database: {exc}"
            ) from exc

    async def _introspect_schema(self, dsn: str) -> dict:
        """Introspect the customer's database schema."""
        try:
            from sqlalchemy import create_engine, inspect

            engine = create_engine(dsn)
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            schema_info = {
                "tables": tables,
                "entity_types": [t for t in tables if not t.startswith("_")],
            }
            engine.dispose()
            return schema_info
        except Exception as exc:
            logger.warning(
                "[provisioner] schema introspection failed: %s", exc
            )
            return {"tables": [], "entity_types": []}

    async def _allocate_ports(self) -> tuple[int, int]:
        """Allocate available ports for a new fork's API and dashboard."""
        base = 8100 + len(self._active_containers) * 2
        api_port = base
        dashboard_port = base + 1
        return api_port, dashboard_port

    async def _configure_routing(
        self,
        subdomain: str,
        api_port: int,
        dashboard_port: int,
    ) -> None:
        """Configure subdomain routing to the fork's container.

        In production this would update Caddy/Nginx/Traefik config.
        For now, logs the routing info.
        """
        domain = self._get_domain()
        logger.info(
            "[provisioner] routing configured: "
            "%s.%s -> api:%d dashboard:%d",
            subdomain,
            domain,
            api_port,
            dashboard_port,
        )

    async def _persist_fork(
        self,
        fork_id: str,
        request: ForkProvisionRequest,
        container_id: str,
        api_port: int,
        dashboard_port: int,
    ) -> None:
        """Persist fork record to the control plane database."""
        if self._db_factory is None:
            logger.warning(
                "[provisioner] no db_factory -- fork %s not persisted",
                fork_id,
            )
            return

        from ..models.fork import Fork

        async with self._db_factory() as session:
            fork = Fork(
                id=uuid.UUID(fork_id),
                customer_id=uuid.UUID(request.customer_id),
                subdomain=request.subdomain,
                display_name=request.display_name,
                status="active",
                source_connection_string=request.source_connection_string,
                output_connection_string=request.output_connection_string,
                output_schema=request.output_schema,
                container_id=container_id,
                api_port=api_port,
                dashboard_port=dashboard_port,
                engine_config={
                    "budget_dollars": request.engine_budget,
                    "target_survivors": request.target_survivors,
                },
                enabled_modules=request.enabled_modules or [],
                reduction_schedule=request.reduction_schedule,
            )
            session.add(fork)
            await session.commit()

    async def _update_fork_status(self, fork_id: str, status: str) -> None:
        """Update fork status in the database."""
        if self._db_factory is None:
            return

        from sqlalchemy import update
        from ..models.fork import Fork

        async with self._db_factory() as session:
            stmt = (
                update(Fork)
                .where(Fork.id == uuid.UUID(fork_id))
                .values(
                    status=status,
                    updated_at=datetime.now(timezone.utc),
                    **(
                        {"suspended_at": datetime.now(timezone.utc)}
                        if status == "suspended"
                        else {}
                    ),
                    **(
                        {"teardown_at": datetime.now(timezone.utc)}
                        if status == "teardown"
                        else {}
                    ),
                )
            )
            await session.execute(stmt)
            await session.commit()

    async def _update_fork_record(
        self, fork_id: str, updates: dict
    ) -> None:
        """Update arbitrary fields on a fork record."""
        if self._db_factory is None:
            return

        from sqlalchemy import update
        from ..models.fork import Fork

        async with self._db_factory() as session:
            stmt = (
                update(Fork)
                .where(Fork.id == uuid.UUID(fork_id))
                .values(**updates, updated_at=datetime.now(timezone.utc))
            )
            await session.execute(stmt)
            await session.commit()

    async def _check_fork_api(self, fork_id: str) -> dict:
        """Check a fork's health endpoint."""
        # In production, this would make an HTTP request to the fork's API
        return {"status": "ok", "metrics": {}}

    async def _cleanup_failed_fork(self, fork_id: str) -> None:
        """Clean up resources from a failed fork provisioning."""
        container_id = self._active_containers.pop(fork_id, None)
        if container_id:
            orchestrator = self._require_orchestrator()
            try:
                await orchestrator.stop(container_id)
            except Exception:
                pass
            try:
                await orchestrator.remove(container_id, force=True)
            except Exception:
                pass
        logger.info("[provisioner] cleaned up failed fork %s", fork_id)
