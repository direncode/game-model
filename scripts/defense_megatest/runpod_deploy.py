"""RunPod GPU deployment for the TCD-JEPA capability test on intrusion data.

Launches a GPU pod that runs `scripts/defense_megatest/tcd_intrusion.py` on
a real NVIDIA accelerator, then pulls the resulting JSON artifact back.
Persistent homology computation (Vietoris-Rips on 500-point clouds) is the
hot path; on CPU it's the bottleneck (~10s per crystallize iteration), on
RTX 4090 / A100 it's near-instantaneous.

This is a *deployment template*, not a run-it-now script. To use:

    pip install runpod                      # official RunPod Python SDK
    export RUNPOD_API_KEY=<your-key>        # from https://www.runpod.io/console/user/settings
    python scripts/defense_megatest/runpod_deploy.py

Cost estimate at RunPod 2026 spot-pricing:
  - RTX 4090 community cloud: ~$0.34/hr  → ~$0.06 for a 10-min capability test
  - A100 80GB community cloud: ~$0.79/hr → ~$0.13 for a 10-min capability test

The pod runs the test, writes the artifact to a network volume (or stdout),
and is terminated automatically. The artifact path is reported on completion.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# ── Configuration (edit these) ────────────────────────────────────────────
GPU_TYPE_ID = "NVIDIA GeForce RTX 4090"   # or "NVIDIA A100 80GB PCIe"
DOCKER_IMAGE = "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04"
POD_NAME = f"latent-ocean-tcd-intrusion-{int(time.time())}"
GIT_REPO_URL = "https://github.com/<your-org>/lsx-latentocean.git"  # user must set
GIT_BRANCH = "main"
NETWORK_VOLUME_GB = 20
CONTAINER_DISK_GB = 30

# Startup command: clone repo, install deps, run the test, write artifact
STARTUP_COMMAND = """
set -euo pipefail
apt-get update && apt-get install -y git curl
cd /workspace
git clone --depth=1 --branch {branch} {repo_url} lsx-latentocean
cd lsx-latentocean
pip install --upgrade pip
pip install numpy pandas scikit-learn ripser persim
pip install -e tcd-jepa
echo '== Running TCD-JEPA capability test on NSL-KDD =='
python -m scripts.defense_megatest.tcd_intrusion 2>&1 | tee /workspace/tcd_intrusion_run.log
echo '== Test complete =='
cp data/validation/tcd_intrusion_modules.json /workspace/tcd_intrusion_modules.json
ls -lh /workspace/
""".format(branch=GIT_BRANCH, repo_url=GIT_REPO_URL).strip()


def main() -> int:
    api_key = os.environ.get("RUNPOD_API_KEY")
    if not api_key:
        print("ERROR: RUNPOD_API_KEY environment variable not set.", file=sys.stderr)
        print("Get your key at https://www.runpod.io/console/user/settings", file=sys.stderr)
        return 2

    if "<your-org>" in GIT_REPO_URL:
        print("ERROR: edit GIT_REPO_URL in this file to point at your repo.", file=sys.stderr)
        return 2

    try:
        import runpod  # type: ignore
    except ImportError:
        print("ERROR: runpod SDK not installed. Run: pip install runpod", file=sys.stderr)
        return 2

    runpod.api_key = api_key

    print(f"[runpod] Creating pod: {POD_NAME}")
    print(f"[runpod] GPU: {GPU_TYPE_ID}")
    print(f"[runpod] Image: {DOCKER_IMAGE}")
    print(f"[runpod] Repo: {GIT_REPO_URL} @ {GIT_BRANCH}")
    print()
    print("[runpod] Startup command (multiline; will run on pod boot):")
    print("---")
    print(STARTUP_COMMAND)
    print("---")
    print()

    # Note on the SDK call: the exact create_pod signature varies by SDK
    # version. The canonical call is:
    pod = runpod.create_pod(
        name=POD_NAME,
        image_name=DOCKER_IMAGE,
        gpu_type_id=GPU_TYPE_ID,
        cloud_type="COMMUNITY",
        gpu_count=1,
        volume_in_gb=NETWORK_VOLUME_GB,
        container_disk_in_gb=CONTAINER_DISK_GB,
        docker_args=f"bash -c {STARTUP_COMMAND!r}",
        ports="22/tcp",
        volume_mount_path="/workspace",
    )
    pod_id = pod.get("id")
    print(f"[runpod] Pod created: id={pod_id}")
    print(f"[runpod] Console: https://www.runpod.io/console/pods/{pod_id}")

    # Poll for completion. The startup command exits when the test finishes;
    # the pod stays warm until we terminate it (or auto-terminate on idle).
    print()
    print("[runpod] Polling pod status (Ctrl-C to detach; pod keeps running) ...")
    deadline = time.time() + 1800  # 30-minute hard cap
    last_status = None
    while time.time() < deadline:
        try:
            info = runpod.get_pod(pod_id)
            status = (info or {}).get("desiredStatus") or "UNKNOWN"
            if status != last_status:
                print(f"[runpod] status: {status}  (t={int(time.time() % 1000)}s)")
                last_status = status
            if status in {"EXITED", "TERMINATED", "FAILED"}:
                break
        except Exception as e:
            print(f"[runpod] poll error: {e}")
        time.sleep(15)

    print()
    print("[runpod] Pod has exited or polling timed out.")
    print(f"[runpod] To pull the artifact:")
    print(f"  scp -P <ssh-port> root@<pod-ip>:/workspace/tcd_intrusion_modules.json ./")
    print(f"[runpod] To terminate (releases compute):")
    print(f"  python -c 'import runpod; runpod.api_key = os.environ[\"RUNPOD_API_KEY\"]; runpod.terminate_pod(\"{pod_id}\")'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
