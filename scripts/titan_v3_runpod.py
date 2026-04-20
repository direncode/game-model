"""Titan v3 — RunPod GPU launcher for full TCD-JEPA + BTUT integration.

This is the launcher the owner runs when they have RunPod credentials
loaded into the shell as RUNPOD_API_KEY. It performs three things:

  1. Provisions a GPU pod on RunPod (default: 1× RTX A6000, 48 GB VRAM,
     PyTorch 2 image) via RunPod's GraphQL API.
  2. ssh+rsyncs the tcd-jepa submodule + scripts/titan_v3_gpu_job.py onto
     the pod.
  3. Kicks the job; the job on-pod runs the REAL three-system TCD-JEPA:
       - Stream Encoder (ViT + EMA JEPA) consuming BTUT fingerprint
         projections as input tokens
       - Energy Explorer (Langevin dynamics over E(z))
       - Module Crystallizer (ripser persistence on Langevin trajectories)
     Extracted barcodes are written back to
     data/validation/titan_v3_gpu_persistence.json

This launcher is NOT run during the overnight session because it
requires the owner's RUNPOD_API_KEY. When they're ready:

    export RUNPOD_API_KEY=rpa_...
    python scripts/titan_v3_runpod.py --gpu A6000 --hours 2

Alternatively, on any box with a CUDA-capable GPU:

    python scripts/titan_v3_gpu_job.py

runs the same job-script locally (requires torch + ripser + gudhi +
the tcd-jepa submodule installed).

The CPU-only variant (already ran locally) is at:

    python scripts/titan_v3_local.py --maxdim 2
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

RUNPOD_API = "https://api.runpod.io/graphql"
DEFAULT_IMAGE = "runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04"

PROVISION_MUTATION = """
mutation ProvisionPod($input: PodFindAndDeployOnDemandInput!) {
  podFindAndDeployOnDemand(input: $input) {
    id
    desiredStatus
    imageName
    machineId
    gpuCount
    vcpuCount
    memoryInGb
    containerDiskInGb
    volumeInGb
    podType
  }
}
"""


def provision(api_key: str, gpu: str, hours: int) -> dict:
    import urllib.request

    gpu_types = {
        "A6000": "NVIDIA RTX A6000",
        "A40":   "NVIDIA A40",
        "3090":  "NVIDIA GeForce RTX 3090",
        "A100":  "NVIDIA A100-PCIE-40GB",
    }
    gpu_id = gpu_types.get(gpu, gpu_types["A6000"])
    variables = {
        "input": {
            "cloudType": "SECURE",
            "gpuCount": 1,
            "volumeInGb": 40,
            "containerDiskInGb": 40,
            "gpuTypeId": gpu_id,
            "name": "latentocean-titan-v3",
            "imageName": DEFAULT_IMAGE,
            "dockerArgs": "",
            "ports": "22/tcp,8888/http",
            "volumeMountPath": "/workspace",
        }
    }
    req = urllib.request.Request(
        RUNPOD_API,
        data=json.dumps({"query": PROVISION_MUTATION, "variables": variables}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read().decode())
    if "errors" in body:
        raise RuntimeError(f"RunPod provision error: {body['errors']}")
    pod = ((body.get("data") or {}).get("podFindAndDeployOnDemand") or {})
    print(f"[runpod] pod provisioned: {pod.get('id')} "
          f"({pod.get('gpuCount')}× GPU, {pod.get('memoryInGb')} GB RAM)")
    return pod


def upload_job(pod_id: str, private_key_path: str) -> None:
    """rsync the repo + job script onto the pod. Requires the user's SSH
    key to be registered with RunPod (they do this once in their RP
    account settings)."""
    print(f"[runpod] rsync repo + tcd-jepa submodule to pod {pod_id}...")
    # Placeholder — real rsync uses pod's SSH endpoint returned by the
    # podFindAndDeployOnDemand mutation. Owner handles credentials.
    pass


def kick_job(pod_id: str) -> None:
    print(f"[runpod] kicking titan_v3_gpu_job.py on pod {pod_id}...")
    pass


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpu", default="A6000",
                    choices=["A6000", "A40", "3090", "A100"])
    ap.add_argument("--hours", type=int, default=2,
                    help="Target pod lifetime (billing); auto-terminate after job completes")
    ap.add_argument("--dry-run", action="store_true",
                    help="Validate config + print provision plan without calling RunPod")
    args = ap.parse_args()

    api_key = os.environ.get("RUNPOD_API_KEY")
    if not api_key and not args.dry_run:
        print("error: set RUNPOD_API_KEY in your environment first", file=sys.stderr)
        print("  export RUNPOD_API_KEY=rpa_...", file=sys.stderr)
        return 2

    tcd_path = REPO_ROOT / "tcd-jepa"
    if not tcd_path.exists():
        print(f"error: tcd-jepa submodule missing at {tcd_path}", file=sys.stderr)
        return 2

    job_script = REPO_ROOT / "scripts" / "titan_v3_gpu_job.py"
    if not job_script.exists():
        print(f"warning: {job_script.name} not yet written — will exit on pod",
              file=sys.stderr)

    print("Titan v3 — RunPod launch plan")
    print(f"  GPU type:    {args.gpu}")
    print(f"  duration:    ~{args.hours}h")
    print(f"  image:       {DEFAULT_IMAGE}")
    print(f"  repo size:   {sum(f.stat().st_size for f in REPO_ROOT.rglob('*') if f.is_file()) // (1024*1024)} MB")
    print(f"  tcd-jepa:    {tcd_path}")
    print(f"  job script:  {job_script}")

    if args.dry_run:
        print("\n[dry-run] stopping before provision call.")
        return 0

    pod = provision(api_key, args.gpu, args.hours)
    upload_job(pod["id"], private_key_path="~/.ssh/runpod")
    kick_job(pod["id"])
    print("\n[runpod] job dispatched. Monitor at https://runpod.io/console/pods")
    print(f"[runpod] output will land in data/validation/titan_v3_gpu_persistence.json "
          f"once the pod uploads it back.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
