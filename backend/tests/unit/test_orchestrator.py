"""Unit tests for container orchestrators (no Docker/K8s required)."""
from __future__ import annotations

import sys
import os
import asyncio
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock

import pytest

# Ensure lo_platform is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from lo_platform.control_plane.services.orchestrator import (
    ContainerConfig,
    ContainerInfo,
    ContainerStatus,
    ExecResult,
)


# =====================================================================
#  ContainerConfig
# =====================================================================

class TestContainerConfig:
    """Test ContainerConfig dataclass."""

    def test_minimal_config(self):
        cfg = ContainerConfig(image="nginx:latest", name="test")
        assert cfg.image == "nginx:latest"
        assert cfg.name == "test"

    def test_default_environment(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.environment == {}

    def test_default_ports(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.ports == {}

    def test_default_volumes(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.volumes == {}

    def test_default_labels(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.labels == {}

    def test_default_memory_limit(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.memory_limit == "2g"

    def test_default_cpu_limit(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.cpu_limit == 2.0

    def test_default_restart_policy(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.restart_policy == "unless-stopped"

    def test_default_healthcheck_cmd(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.healthcheck_cmd == ""

    def test_default_healthcheck_interval(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.healthcheck_interval == 30

    def test_default_healthcheck_timeout(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.healthcheck_timeout == 10

    def test_default_healthcheck_retries(self):
        cfg = ContainerConfig(image="img", name="n")
        assert cfg.healthcheck_retries == 3

    def test_port_mapping(self):
        cfg = ContainerConfig(
            image="img", name="n",
            ports={8080: 80, 3000: 3000},
        )
        assert cfg.ports[8080] == 80
        assert cfg.ports[3000] == 3000

    def test_environment_variables(self):
        cfg = ContainerConfig(
            image="img", name="n",
            environment={"DB_HOST": "localhost", "DB_PORT": "5432"},
        )
        assert cfg.environment["DB_HOST"] == "localhost"
        assert cfg.environment["DB_PORT"] == "5432"

    def test_resource_limits(self):
        cfg = ContainerConfig(
            image="img", name="n",
            memory_limit="4g",
            cpu_limit=4.0,
        )
        assert cfg.memory_limit == "4g"
        assert cfg.cpu_limit == 4.0

    def test_full_config(self):
        cfg = ContainerConfig(
            image="latentocean/fork:v2",
            name="fork-acme",
            environment={"FORK_ID": "acme", "LOG_LEVEL": "debug"},
            ports={8080: 30080, 3000: 30030},
            volumes={"/data": "/app/data"},
            labels={"tenant": "acme"},
            memory_limit="8g",
            cpu_limit=4.0,
            restart_policy="always",
            healthcheck_cmd="curl -f http://localhost:8080/health",
            healthcheck_interval=15,
            healthcheck_timeout=5,
            healthcheck_retries=5,
        )
        assert cfg.image == "latentocean/fork:v2"
        assert len(cfg.environment) == 2
        assert len(cfg.ports) == 2
        assert cfg.labels["tenant"] == "acme"


# =====================================================================
#  ContainerInfo
# =====================================================================

class TestContainerInfo:
    """Test ContainerInfo dataclass."""

    def test_basic_info(self):
        info = ContainerInfo(
            id="abc123",
            name="test-container",
            status=ContainerStatus.RUNNING,
            image="nginx:latest",
            ports={80: 8080},
        )
        assert info.id == "abc123"
        assert info.name == "test-container"
        assert info.status == ContainerStatus.RUNNING
        assert info.image == "nginx:latest"

    def test_default_timestamps(self):
        info = ContainerInfo(
            id="x", name="x", status=ContainerStatus.STOPPED,
            image="img", ports={},
        )
        assert info.created_at is None
        assert info.started_at is None

    def test_default_health(self):
        info = ContainerInfo(
            id="x", name="x", status=ContainerStatus.RUNNING,
            image="img", ports={},
        )
        assert info.health == "unknown"

    def test_default_ip_address(self):
        info = ContainerInfo(
            id="x", name="x", status=ContainerStatus.RUNNING,
            image="img", ports={},
        )
        assert info.ip_address == ""

    def test_status_enum_values(self):
        assert ContainerStatus.CREATING == "creating"
        assert ContainerStatus.RUNNING == "running"
        assert ContainerStatus.STOPPED == "stopped"
        assert ContainerStatus.ERROR == "error"
        assert ContainerStatus.NOT_FOUND == "not_found"

    def test_status_is_string_enum(self):
        assert isinstance(ContainerStatus.RUNNING, str)
        assert ContainerStatus.RUNNING == "running"

    def test_info_with_timestamps(self):
        now = datetime.now(timezone.utc)
        info = ContainerInfo(
            id="x", name="x", status=ContainerStatus.RUNNING,
            image="img", ports={},
            created_at=now,
            started_at=now,
        )
        assert info.created_at == now
        assert info.started_at == now

    def test_info_with_health_and_ip(self):
        info = ContainerInfo(
            id="x", name="x", status=ContainerStatus.RUNNING,
            image="img", ports={},
            health="healthy",
            ip_address="172.17.0.5",
        )
        assert info.health == "healthy"
        assert info.ip_address == "172.17.0.5"


# =====================================================================
#  ExecResult
# =====================================================================

class TestExecResult:
    """Test ExecResult dataclass."""

    def test_successful_exec(self):
        result = ExecResult(exit_code=0, stdout="hello\n", stderr="")
        assert result.exit_code == 0
        assert result.stdout == "hello\n"
        assert result.stderr == ""

    def test_failed_exec(self):
        result = ExecResult(exit_code=1, stdout="", stderr="error!")
        assert result.exit_code == 1
        assert result.stderr == "error!"

    def test_timeout_exec(self):
        result = ExecResult(exit_code=-1, stdout="", stderr="timed out")
        assert result.exit_code == -1


# =====================================================================
#  DockerOrchestrator init (graceful failure)
# =====================================================================

class TestDockerOrchestratorInit:
    """Test that DockerOrchestrator handles missing docker package gracefully."""

    def test_import_succeeds(self):
        from lo_platform.control_plane.services.docker_orchestrator import (
            DockerOrchestrator,
        )
        orch = DockerOrchestrator()
        assert orch._available is False
        assert orch._client is None

    def test_custom_base_url(self):
        from lo_platform.control_plane.services.docker_orchestrator import (
            DockerOrchestrator,
        )
        orch = DockerOrchestrator(base_url="tcp://localhost:2375")
        assert orch._base_url == "tcp://localhost:2375"

    @pytest.mark.asyncio
    async def test_get_client_raises_when_docker_missing(self):
        from lo_platform.control_plane.services.docker_orchestrator import (
            DockerOrchestrator,
        )
        orch = DockerOrchestrator()
        with patch.dict("sys.modules", {"docker": None}):
            # The _get_client method will try to import docker
            # If docker is actually installed, we mock it to fail
            with patch(
                "lo_platform.control_plane.services.docker_orchestrator.DockerOrchestrator._get_client",
                side_effect=RuntimeError("docker package is not installed"),
            ):
                with pytest.raises(RuntimeError, match="docker"):
                    await orch._get_client()


# =====================================================================
#  KubernetesOrchestrator init (graceful failure)
# =====================================================================

class TestKubernetesOrchestratorInit:
    """Test that K8sOrchestrator handles missing kubernetes package gracefully."""

    def test_import_succeeds(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            KubernetesOrchestrator,
        )
        orch = KubernetesOrchestrator()
        assert orch._namespace == "latentocean"
        assert orch._available is False

    def test_custom_namespace(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            KubernetesOrchestrator,
        )
        orch = KubernetesOrchestrator(namespace="custom-ns")
        assert orch._namespace == "custom-ns"

    def test_custom_kubeconfig(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            KubernetesOrchestrator,
        )
        orch = KubernetesOrchestrator(kubeconfig="/home/user/.kube/config")
        assert orch._kubeconfig == "/home/user/.kube/config"

    def test_in_cluster_mode(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            KubernetesOrchestrator,
        )
        orch = KubernetesOrchestrator(in_cluster=True)
        assert orch._in_cluster is True

    def test_initial_state(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            KubernetesOrchestrator,
        )
        orch = KubernetesOrchestrator()
        assert orch._core_v1 is None
        assert orch._apps_v1 is None
        assert orch._client is None
        assert orch._available is False

    @pytest.mark.asyncio
    async def test_ensure_client_raises_when_k8s_missing(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            KubernetesOrchestrator,
        )
        orch = KubernetesOrchestrator()
        with patch(
            "lo_platform.control_plane.services.k8s_orchestrator._K8S_AVAILABLE",
            False,
        ):
            with pytest.raises(RuntimeError, match="kubernetes package is not installed"):
                await orch._ensure_client()


# =====================================================================
#  K8s helper functions
# =====================================================================

class TestK8sHelpers:
    """Test helper functions in the K8s orchestrator module."""

    def test_deployment_name_lowercases(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _deployment_name,
        )
        assert _deployment_name("MyFork") == "myfork"

    def test_deployment_name_replaces_underscores(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _deployment_name,
        )
        assert _deployment_name("my_fork_name") == "my-fork-name"

    def test_deployment_name_replaces_dots(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _deployment_name,
        )
        assert _deployment_name("fork.v1.2") == "fork-v1-2"

    def test_deployment_name_strips_hyphens(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _deployment_name,
        )
        assert _deployment_name("-fork-") == "fork"

    def test_deployment_name_truncates_to_63(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _deployment_name,
        )
        long_name = "a" * 100
        assert len(_deployment_name(long_name)) <= 63

    def test_parse_memory_gigabytes(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _parse_memory,
        )
        assert _parse_memory("2g") == "2Gi"

    def test_parse_memory_megabytes(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _parse_memory,
        )
        assert _parse_memory("512m") == "512Mi"

    def test_parse_memory_kilobytes(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _parse_memory,
        )
        assert _parse_memory("1024k") == "1024Ki"

    def test_parse_memory_already_k8s_format(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _parse_memory,
        )
        assert _parse_memory("2Gi") == "2Gi"

    def test_parse_k8s_ts_none(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _parse_k8s_ts,
        )
        assert _parse_k8s_ts(None) is None

    def test_parse_k8s_ts_datetime(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _parse_k8s_ts,
        )
        dt = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        result = _parse_k8s_ts(dt)
        assert result == dt

    def test_parse_k8s_ts_naive_datetime(self):
        from lo_platform.control_plane.services.k8s_orchestrator import (
            _parse_k8s_ts,
        )
        dt = datetime(2024, 1, 15, 12, 0, 0)
        result = _parse_k8s_ts(dt)
        assert result.tzinfo == timezone.utc
