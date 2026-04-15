"""Kubernetes orchestrator — manages fork pods via K8s API.

Each fork becomes a K8s Deployment + Service + optional Ingress.
The deployment runs the fork image with environment variables from the fork config.
The service exposes the API and dashboard ports.
The ingress (if enabled) handles subdomain routing.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from .orchestrator import (
    ContainerOrchestrator, ContainerConfig, ContainerInfo,
    ContainerStatus, ExecResult,
)

logger = logging.getLogger(__name__)

# Try importing the kubernetes package; gracefully handle absence.
try:
    from kubernetes import client as k8s_client, config as k8s_config
    from kubernetes.stream import stream as k8s_stream
    from kubernetes.client.exceptions import ApiException
    _K8S_AVAILABLE = True
except ImportError:
    _K8S_AVAILABLE = False
    k8s_client = None  # type: ignore[assignment]
    k8s_config = None  # type: ignore[assignment]
    k8s_stream = None  # type: ignore[assignment]
    ApiException = Exception  # type: ignore[assignment,misc]


def _parse_k8s_ts(ts) -> Optional[datetime]:
    """Convert a K8s datetime object to a Python datetime (UTC)."""
    if ts is None:
        return None
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts
    try:
        return datetime.fromisoformat(str(ts)).replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def _parse_memory(mem_str: str) -> str:
    """Normalise a memory string like '2g' or '512m' to K8s format (e.g. '2Gi')."""
    mem = mem_str.strip().lower()
    if mem.endswith("g"):
        return mem[:-1] + "Gi"
    if mem.endswith("m"):
        return mem[:-1] + "Mi"
    if mem.endswith("k"):
        return mem[:-1] + "Ki"
    # Already in K8s format or raw bytes
    return mem_str


def _deployment_name(config_name: str) -> str:
    """Derive a K8s-safe deployment name from a container config name."""
    # K8s names must be lowercase alphanumeric + '-', max 63 chars
    safe = config_name.lower().replace("_", "-").replace(".", "-")
    # Strip leading/trailing hyphens
    safe = safe.strip("-")
    return safe[:63]


class KubernetesOrchestrator(ContainerOrchestrator):
    """Kubernetes-based container orchestration.

    Creates a Deployment + Service per fork in a dedicated namespace.
    Supports:
    - Pod creation with resource limits, env vars, health checks
    - Service creation with NodePort or ClusterIP
    - Pod exec for running commands inside forks
    - Log retrieval
    - Health monitoring via readiness probes

    Falls back gracefully if kubernetes package is not installed
    or cluster is unreachable.
    """

    def __init__(self, namespace: str = "latentocean", kubeconfig: str = None,
                 in_cluster: bool = False):
        self._namespace = namespace
        self._kubeconfig = kubeconfig
        self._in_cluster = in_cluster
        self._client: object = None
        self._apps_v1 = None
        self._core_v1 = None
        self._available = False

    # ── internal helpers ─────────────────────────────────────────────

    async def _ensure_client(self):
        """Lazy-initialise the Kubernetes client APIs."""
        if self._core_v1 is not None:
            return

        if not _K8S_AVAILABLE:
            raise RuntimeError(
                "kubernetes package is not installed. "
                "Install it with: pip install kubernetes"
            )

        loop = asyncio.get_running_loop()

        def _connect():
            if self._in_cluster:
                k8s_config.load_incluster_config()
            elif self._kubeconfig:
                k8s_config.load_kube_config(config_file=self._kubeconfig)
            else:
                k8s_config.load_kube_config()

            core = k8s_client.CoreV1Api()
            apps = k8s_client.AppsV1Api()
            # Verify connectivity
            core.list_namespace(_request_timeout=10)
            return core, apps

        try:
            self._core_v1, self._apps_v1 = await loop.run_in_executor(
                None, _connect,
            )
            self._available = True
            logger.info("Kubernetes cluster connected (namespace=%s)", self._namespace)
        except Exception as exc:
            self._available = False
            raise RuntimeError(
                f"Kubernetes cluster not reachable: {exc}"
            ) from exc

        # Auto-create namespace if it does not exist
        await self._ensure_namespace()

    async def _ensure_namespace(self):
        """Create the target namespace if it doesn't exist."""
        loop = asyncio.get_running_loop()

        def _create_ns():
            try:
                self._core_v1.read_namespace(self._namespace)
            except ApiException as exc:
                if exc.status == 404:
                    ns = k8s_client.V1Namespace(
                        metadata=k8s_client.V1ObjectMeta(name=self._namespace),
                    )
                    self._core_v1.create_namespace(ns)
                    logger.info("Created namespace %s", self._namespace)
                else:
                    raise

        await loop.run_in_executor(None, _create_ns)

    async def _run(self, fn, *args, **kwargs):
        """Run a blocking callable in the default executor."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    def _make_labels(self, name: str) -> dict[str, str]:
        """Standard labels applied to all fork resources."""
        return {
            "app": "latentocean-fork",
            "fork-name": _deployment_name(name),
            "managed-by": "lo-k8s-orchestrator",
        }

    # ── K8s manifest builders ────────────────────────────────────────

    def _build_deployment(self, config: ContainerConfig) -> object:
        """Build a K8s Deployment manifest from a ContainerConfig."""
        dep_name = _deployment_name(config.name)
        labels = self._make_labels(config.name)
        labels.update(config.labels)

        # Environment variables
        env_vars = [
            k8s_client.V1EnvVar(name=k, value=v)
            for k, v in config.environment.items()
        ]

        # Resource limits
        resources = k8s_client.V1ResourceRequirements(
            limits={
                "memory": _parse_memory(config.memory_limit),
                "cpu": str(config.cpu_limit),
            },
            requests={
                "memory": _parse_memory(config.memory_limit),
                "cpu": str(min(config.cpu_limit, 0.5)),
            },
        )

        # Container ports
        container_ports = [
            k8s_client.V1ContainerPort(container_port=cp)
            for cp in config.ports.keys()
        ]

        # Liveness / readiness probes
        liveness_probe = None
        readiness_probe = None
        if config.healthcheck_cmd:
            probe = k8s_client.V1Probe(
                exec=k8s_client.V1ExecAction(
                    command=["sh", "-c", config.healthcheck_cmd],
                ),
                initial_delay_seconds=10,
                period_seconds=config.healthcheck_interval,
                timeout_seconds=config.healthcheck_timeout,
                failure_threshold=config.healthcheck_retries,
            )
            liveness_probe = probe
            readiness_probe = k8s_client.V1Probe(
                exec=k8s_client.V1ExecAction(
                    command=["sh", "-c", config.healthcheck_cmd],
                ),
                initial_delay_seconds=5,
                period_seconds=config.healthcheck_interval,
                timeout_seconds=config.healthcheck_timeout,
                failure_threshold=config.healthcheck_retries,
            )

        container = k8s_client.V1Container(
            name=dep_name,
            image=config.image,
            env=env_vars or None,
            resources=resources,
            ports=container_ports or None,
            liveness_probe=liveness_probe,
            readiness_probe=readiness_probe,
        )

        # Restart policy maps to pod spec (Always is default for deployments)
        restart_policy = "Always"

        template = k8s_client.V1PodTemplateSpec(
            metadata=k8s_client.V1ObjectMeta(labels=labels),
            spec=k8s_client.V1PodSpec(
                containers=[container],
                restart_policy=restart_policy,
            ),
        )

        spec = k8s_client.V1DeploymentSpec(
            replicas=1,
            selector=k8s_client.V1LabelSelector(match_labels={
                "app": "latentocean-fork",
                "fork-name": dep_name,
            }),
            template=template,
        )

        deployment = k8s_client.V1Deployment(
            api_version="apps/v1",
            kind="Deployment",
            metadata=k8s_client.V1ObjectMeta(
                name=dep_name,
                namespace=self._namespace,
                labels=labels,
            ),
            spec=spec,
        )

        return deployment

    def _build_service(self, config: ContainerConfig) -> object:
        """Build a K8s Service manifest from a ContainerConfig."""
        dep_name = _deployment_name(config.name)
        labels = self._make_labels(config.name)

        ports = []
        for container_port, host_port in config.ports.items():
            ports.append(
                k8s_client.V1ServicePort(
                    name=f"port-{container_port}",
                    port=container_port,
                    target_port=container_port,
                    node_port=host_port if host_port >= 30000 else None,
                )
            )

        # Use NodePort if any host port is in the NodePort range, else ClusterIP
        service_type = "ClusterIP"
        for hp in config.ports.values():
            if 30000 <= hp <= 32767:
                service_type = "NodePort"
                break

        service = k8s_client.V1Service(
            api_version="v1",
            kind="Service",
            metadata=k8s_client.V1ObjectMeta(
                name=dep_name,
                namespace=self._namespace,
                labels=labels,
            ),
            spec=k8s_client.V1ServiceSpec(
                selector={
                    "app": "latentocean-fork",
                    "fork-name": dep_name,
                },
                ports=ports or None,
                type=service_type,
            ),
        )

        return service

    # ── Pod helpers ──────────────────────────────────────────────────

    async def _get_pods_for_deployment(self, dep_name: str) -> list:
        """List pods belonging to a deployment via label selector."""
        label_selector = f"app=latentocean-fork,fork-name={dep_name}"
        pods = await self._run(
            self._core_v1.list_namespaced_pod,
            namespace=self._namespace,
            label_selector=label_selector,
        )
        return pods.items or []

    async def _get_first_pod(self, dep_name: str):
        """Return the first running pod for a deployment, or None."""
        pods = await self._get_pods_for_deployment(dep_name)
        # Prefer running pods
        for pod in pods:
            if pod.status and pod.status.phase == "Running":
                return pod
        return pods[0] if pods else None

    def _pod_to_info(self, pod, dep_name: str) -> ContainerInfo:
        """Convert a K8s Pod object to ContainerInfo."""
        status = ContainerStatus.CREATING
        health = "unknown"
        ip_address = ""
        started_at = None

        if pod.status:
            phase = (pod.status.phase or "").lower()
            if phase == "running":
                status = ContainerStatus.RUNNING
            elif phase == "succeeded":
                status = ContainerStatus.STOPPED
            elif phase in ("failed", "unknown"):
                status = ContainerStatus.ERROR
            elif phase == "pending":
                status = ContainerStatus.CREATING

            ip_address = pod.status.pod_ip or ""

            # Check container statuses for readiness
            if pod.status.container_statuses:
                cs = pod.status.container_statuses[0]
                if cs.ready:
                    health = "healthy"
                elif cs.state and cs.state.waiting:
                    reason = cs.state.waiting.reason or ""
                    health = f"waiting:{reason}"
                    if reason in ("ImagePullBackOff", "ErrImagePull",
                                  "CrashLoopBackOff"):
                        status = ContainerStatus.ERROR
                elif cs.state and cs.state.terminated:
                    health = "terminated"
                    status = ContainerStatus.STOPPED
                else:
                    health = "starting"

                if cs.state and cs.state.running:
                    started_at = _parse_k8s_ts(cs.state.running.started_at)

        # Image
        image = ""
        if pod.spec and pod.spec.containers:
            image = pod.spec.containers[0].image or ""

        # Ports
        ports: dict[int, int] = {}
        if pod.spec and pod.spec.containers:
            for cp in (pod.spec.containers[0].ports or []):
                if cp.container_port:
                    ports[cp.container_port] = cp.container_port

        return ContainerInfo(
            id=dep_name,
            name=dep_name,
            status=status,
            image=image,
            ports=ports,
            created_at=_parse_k8s_ts(pod.metadata.creation_timestamp) if pod.metadata else None,
            started_at=started_at,
            health=health,
            ip_address=ip_address,
        )

    # ── public API ───────────────────────────────────────────────────

    async def create(self, config: ContainerConfig) -> ContainerInfo:
        """Create a Deployment + Service for a fork.

        Maps ContainerConfig to K8s manifests:
        - Deployment with 1 replica, resource limits, env vars,
          liveness/readiness probes
        - Service with port mappings
        """
        await self._ensure_client()
        dep_name = _deployment_name(config.name)

        deployment = self._build_deployment(config)
        service = self._build_service(config)

        try:
            await self._run(
                self._apps_v1.create_namespaced_deployment,
                namespace=self._namespace,
                body=deployment,
            )
            logger.info("Deployment created: %s/%s", self._namespace, dep_name)
        except ApiException as exc:
            if exc.status == 409:
                logger.warning("Deployment %s already exists, updating", dep_name)
                await self._run(
                    self._apps_v1.replace_namespaced_deployment,
                    name=dep_name,
                    namespace=self._namespace,
                    body=deployment,
                )
            elif exc.status == 403:
                raise RuntimeError(
                    f"Resource quota exceeded or insufficient permissions "
                    f"for deployment {dep_name}: {exc.reason}"
                ) from exc
            else:
                raise RuntimeError(
                    f"Failed to create deployment {dep_name}: {exc.reason}"
                ) from exc

        # Create Service (ignore if already exists)
        if config.ports:
            try:
                await self._run(
                    self._core_v1.create_namespaced_service,
                    namespace=self._namespace,
                    body=service,
                )
                logger.info("Service created: %s/%s", self._namespace, dep_name)
            except ApiException as exc:
                if exc.status == 409:
                    logger.debug("Service %s already exists", dep_name)
                else:
                    logger.warning(
                        "Service creation failed for %s: %s", dep_name, exc.reason,
                    )

        # Wait a moment for the pod to be scheduled, then return info
        await asyncio.sleep(1)
        pod = await self._get_first_pod(dep_name)
        if pod:
            return self._pod_to_info(pod, dep_name)

        # No pod yet — return a CREATING stub
        return ContainerInfo(
            id=dep_name,
            name=dep_name,
            status=ContainerStatus.CREATING,
            image=config.image,
            ports=config.ports,
        )

    async def start(self, container_id: str) -> ContainerInfo:
        """Scale deployment to 1 replica (un-pause / resume)."""
        await self._ensure_client()
        dep_name = _deployment_name(container_id)

        try:
            dep = await self._run(
                self._apps_v1.read_namespaced_deployment,
                name=dep_name,
                namespace=self._namespace,
            )
            dep.spec.replicas = 1
            await self._run(
                self._apps_v1.replace_namespaced_deployment,
                name=dep_name,
                namespace=self._namespace,
                body=dep,
            )
            logger.info("Deployment scaled to 1: %s", dep_name)
        except ApiException as exc:
            if exc.status == 404:
                raise RuntimeError(
                    f"Deployment not found: {dep_name}"
                ) from exc
            raise RuntimeError(
                f"Failed to start deployment {dep_name}: {exc.reason}"
            ) from exc

        await asyncio.sleep(1)
        pod = await self._get_first_pod(dep_name)
        if pod:
            return self._pod_to_info(pod, dep_name)

        return ContainerInfo(
            id=dep_name,
            name=dep_name,
            status=ContainerStatus.CREATING,
            image=dep.spec.template.spec.containers[0].image if dep.spec.template.spec.containers else "",
            ports={},
        )

    async def stop(self, container_id: str, timeout: int = 30) -> ContainerInfo:
        """Scale deployment to 0 replicas (pause)."""
        await self._ensure_client()
        dep_name = _deployment_name(container_id)

        try:
            dep = await self._run(
                self._apps_v1.read_namespaced_deployment,
                name=dep_name,
                namespace=self._namespace,
            )
            dep.spec.replicas = 0
            await self._run(
                self._apps_v1.replace_namespaced_deployment,
                name=dep_name,
                namespace=self._namespace,
                body=dep,
            )
            logger.info("Deployment scaled to 0: %s", dep_name)
        except ApiException as exc:
            if exc.status == 404:
                raise RuntimeError(
                    f"Deployment not found: {dep_name}"
                ) from exc
            raise RuntimeError(
                f"Failed to stop deployment {dep_name}: {exc.reason}"
            ) from exc

        return ContainerInfo(
            id=dep_name,
            name=dep_name,
            status=ContainerStatus.STOPPED,
            image=dep.spec.template.spec.containers[0].image if dep.spec.template.spec.containers else "",
            ports={},
        )

    async def remove(self, container_id: str, force: bool = False) -> bool:
        """Delete Deployment + Service for a fork."""
        await self._ensure_client()
        dep_name = _deployment_name(container_id)
        success = True

        # Delete deployment
        try:
            propagation = "Foreground" if not force else "Background"
            await self._run(
                self._apps_v1.delete_namespaced_deployment,
                name=dep_name,
                namespace=self._namespace,
                body=k8s_client.V1DeleteOptions(
                    propagation_policy=propagation,
                ),
            )
            logger.info("Deployment deleted: %s", dep_name)
        except ApiException as exc:
            if exc.status != 404:
                logger.warning(
                    "Failed to delete deployment %s: %s", dep_name, exc.reason,
                )
                success = False

        # Delete service
        try:
            await self._run(
                self._core_v1.delete_namespaced_service,
                name=dep_name,
                namespace=self._namespace,
            )
            logger.info("Service deleted: %s", dep_name)
        except ApiException as exc:
            if exc.status != 404:
                logger.warning(
                    "Failed to delete service %s: %s", dep_name, exc.reason,
                )
                success = False

        return success

    async def get_info(self, container_id: str) -> ContainerInfo:
        """Read pod status, extract IP, health, timestamps."""
        await self._ensure_client()
        dep_name = _deployment_name(container_id)

        # Check deployment exists
        try:
            await self._run(
                self._apps_v1.read_namespaced_deployment,
                name=dep_name,
                namespace=self._namespace,
            )
        except ApiException as exc:
            if exc.status == 404:
                return ContainerInfo(
                    id=dep_name,
                    name=dep_name,
                    status=ContainerStatus.NOT_FOUND,
                    image="",
                    ports={},
                )
            raise RuntimeError(
                f"Failed to get deployment {dep_name}: {exc.reason}"
            ) from exc

        pod = await self._get_first_pod(dep_name)
        if pod:
            return self._pod_to_info(pod, dep_name)

        # Deployment exists but no pods (scaled to 0)
        return ContainerInfo(
            id=dep_name,
            name=dep_name,
            status=ContainerStatus.STOPPED,
            image="",
            ports={},
        )

    async def exec_command(
        self, container_id: str, command: list[str], timeout: int = 60
    ) -> ExecResult:
        """Use kubernetes.stream for pod exec."""
        await self._ensure_client()
        dep_name = _deployment_name(container_id)

        pod = await self._get_first_pod(dep_name)
        if not pod:
            return ExecResult(
                exit_code=-1,
                stdout="",
                stderr=f"No running pod found for deployment {dep_name}",
            )

        pod_name = pod.metadata.name

        async def _exec():
            resp = await self._run(
                k8s_stream,
                self._core_v1.connect_get_namespaced_pod_exec,
                pod_name,
                self._namespace,
                command=command,
                stderr=True,
                stdout=True,
                stdin=False,
                tty=False,
                _preload_content=False,
            )

            stdout_data = ""
            stderr_data = ""

            # Read all output
            while resp.is_open():
                resp.update(timeout=timeout)
                if resp.peek_stdout():
                    stdout_data += resp.read_stdout()
                if resp.peek_stderr():
                    stderr_data += resp.read_stderr()

            resp.close()
            exit_code = resp.returncode if hasattr(resp, "returncode") else 0
            return ExecResult(
                exit_code=exit_code,
                stdout=stdout_data,
                stderr=stderr_data,
            )

        try:
            return await asyncio.wait_for(_exec(), timeout=timeout)
        except asyncio.TimeoutError:
            return ExecResult(
                exit_code=-1,
                stdout="",
                stderr=f"Command timed out after {timeout}s",
            )
        except Exception as exc:
            return ExecResult(
                exit_code=-1,
                stdout="",
                stderr=f"Exec failed: {exc}",
            )

    async def get_logs(self, container_id: str, tail: int = 100) -> str:
        """Use read_namespaced_pod_log() to retrieve pod logs."""
        await self._ensure_client()
        dep_name = _deployment_name(container_id)

        pod = await self._get_first_pod(dep_name)
        if not pod:
            return ""

        pod_name = pod.metadata.name

        try:
            logs = await self._run(
                self._core_v1.read_namespaced_pod_log,
                pod_name,
                self._namespace,
                tail_lines=tail,
            )
            return logs or ""
        except ApiException as exc:
            logger.warning(
                "Failed to get logs for %s: %s", pod_name, exc.reason,
            )
            return ""

    async def wait_healthy(
        self, container_id: str, timeout: int = 120
    ) -> bool:
        """Poll pod conditions until Ready or timeout."""
        await self._ensure_client()
        dep_name = _deployment_name(container_id)

        deadline = asyncio.get_event_loop().time() + timeout
        interval = 2.0

        while asyncio.get_event_loop().time() < deadline:
            pod = await self._get_first_pod(dep_name)
            if pod and pod.status:
                # Check conditions for Ready
                for condition in (pod.status.conditions or []):
                    if condition.type == "Ready" and condition.status == "True":
                        logger.info("Pod %s is ready", dep_name)
                        return True

                # Check for terminal failure states
                if pod.status.container_statuses:
                    cs = pod.status.container_statuses[0]
                    if cs.state and cs.state.waiting:
                        reason = cs.state.waiting.reason or ""
                        if reason in ("ImagePullBackOff", "ErrImagePull",
                                      "CrashLoopBackOff", "InvalidImageName"):
                            logger.warning(
                                "Pod %s in terminal failure: %s",
                                dep_name, reason,
                            )
                            return False

            await asyncio.sleep(interval)
            interval = min(interval * 1.5, 10.0)

        logger.warning(
            "Pod %s did not become healthy within %ds", dep_name, timeout,
        )
        return False

    async def list_containers(
        self, labels: dict[str, str] | None = None
    ) -> list[ContainerInfo]:
        """List pods with label selector."""
        await self._ensure_client()

        selector_parts = ["app=latentocean-fork"]
        if labels:
            selector_parts.extend(f"{k}={v}" for k, v in labels.items())
        label_selector = ",".join(selector_parts)

        try:
            pods = await self._run(
                self._core_v1.list_namespaced_pod,
                namespace=self._namespace,
                label_selector=label_selector,
            )
            results = []
            for pod in (pods.items or []):
                # Derive deployment name from fork-name label
                pod_labels = pod.metadata.labels or {}
                dep_name = pod_labels.get("fork-name", pod.metadata.name)
                results.append(self._pod_to_info(pod, dep_name))
            return results
        except ApiException as exc:
            logger.warning("Failed to list pods: %s", exc.reason)
            return []
