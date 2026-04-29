"""Provision a RunPod GPU pod, SSH in, run TCD recursive loop, pull result back.

Designed to be SCPed to EC2 and run there with RUNPOD_API_KEY in env.
Uses ephemeral SSH keypair at /tmp/podkey/id_ed25519 (must already exist).
Uses /tmp/pod_ssh_run.py as the script to scp + execute on the pod.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

GRAPHQL = "https://api.runpod.io/graphql"
HDRS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
}

API_KEY = os.environ.get("RUNPOD_API_KEY")
if not API_KEY:
    print("ERROR: RUNPOD_API_KEY not set", file=sys.stderr)
    sys.exit(2)
HDRS["Authorization"] = f"Bearer {API_KEY}"

PUBKEY_PATH = "/tmp/podkey/id_ed25519.pub"
PRIVKEY_PATH = "/tmp/podkey/id_ed25519"
RUN_SCRIPT_LOCAL = "/tmp/pod_ssh_run.py"


def gql(query, variables=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(GRAPHQL, data=body, headers=HDRS)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:600]}") from e
    if "errors" in d:
        raise RuntimeError(f"GraphQL: {d['errors']}")
    return d.get("data") or {}


def main():
    pubkey = open(PUBKEY_PATH).read().strip()

    # Setup script encoded as base64 so dockerArgs has no quoting issues
    setup = (
        f"mkdir -p /root/.ssh && "
        f"echo '{pubkey}' > /root/.ssh/authorized_keys && "
        f"chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys && "
        f"apt-get update -qq >/dev/null 2>&1 && "
        f"apt-get install -qq -y openssh-server >/dev/null 2>&1 && "
        f"mkdir -p /run/sshd && /usr/sbin/sshd && "
        f"sleep 1800"
    )
    b64 = base64.b64encode(setup.encode()).decode()
    docker_args = f"bash -c \"echo {b64} | base64 -d | bash\""

    print(f"[orch] dockerArgs len={len(docker_args)}", flush=True)

    print("[orch] provisioning RTX 4090 pod (community cloud)...", flush=True)
    mut = (
        "mutation P($i:PodFindAndDeployOnDemandInput!){"
        "podFindAndDeployOnDemand(input:$i){id desiredStatus imageName}}"
    )
    variables = {
        "i": {
            "cloudType": "COMMUNITY",
            "gpuCount": 1,
            "volumeInGb": 0,
            "containerDiskInGb": 30,
            "gpuTypeId": "NVIDIA GeForce RTX 4090",
            "name": f"lo-tcd-real-{int(time.time())}",
            "imageName": "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04",
            "dockerArgs": docker_args,
            "ports": "22/tcp",
            "volumeMountPath": "/workspace",
        }
    }
    try:
        pod = gql(mut, variables)["podFindAndDeployOnDemand"]
    except Exception as e:
        print(f"[orch] provision FAILED: {e}", flush=True)
        return 3

    pid = pod["id"]
    print(f"[orch] pod_id={pid} desiredStatus={pod.get('desiredStatus')}", flush=True)

    try:
        ssh_ip = None
        ssh_port = None
        for i in range(60):
            time.sleep(10)
            try:
                d = gql(
                    "query Q($i:String!){pod(input:{podId:$i}){id desiredStatus runtime{ports{ip publicPort privatePort type}}}}",
                    {"i": pid},
                )
            except Exception as e:
                print(f"[orch]   poll err: {e}", flush=True)
                continue
            p = d.get("pod") or {}
            st = p.get("desiredStatus")
            rt = p.get("runtime") or {}
            ports = (rt or {}).get("ports") or []
            print(f"[orch]   t={(i+1)*10}s status={st} ports={ports}", flush=True)
            for prt in ports:
                if prt.get("privatePort") == 22 and prt.get("ip") and prt.get("publicPort"):
                    ssh_ip = prt["ip"]
                    ssh_port = prt["publicPort"]
                    break
            if ssh_ip:
                break
        if not ssh_ip:
            raise RuntimeError("SSH port never bound after 600s")
        print(f"[orch] SSH ready: {ssh_ip}:{ssh_port}", flush=True)

        time.sleep(20)  # extra wait for sshd inside pod
        ssh_opts = [
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "ConnectTimeout=20",
            "-i", PRIVKEY_PATH,
        ]

        print("[orch] scp run script to pod", flush=True)
        r = subprocess.run(
            ["scp", "-P", str(ssh_port)] + ssh_opts +
            [RUN_SCRIPT_LOCAL, f"root@{ssh_ip}:/tmp/run.py"],
            capture_output=True, text=True, timeout=120,
        )
        print(f"[orch] scp rc={r.returncode}", flush=True)
        if r.stderr:
            print(f"[orch]   scp stderr: {r.stderr[:400]}", flush=True)
        if r.returncode != 0:
            return 4

        print("[orch] running on pod (GPU work begins; pod_ssh_run.py installs deps + runs recursive loop)", flush=True)
        r = subprocess.run(
            ["ssh", "-p", str(ssh_port)] + ssh_opts +
            [f"root@{ssh_ip}", "python3 -u /tmp/run.py 2>&1 | tail -200"],
            capture_output=True, text=True, timeout=900,
        )
        print(f"[orch] ssh-run rc={r.returncode}", flush=True)
        print(f"[orch] STDOUT (last 4000 chars):\n{r.stdout[-4000:]}", flush=True)
        if r.stderr:
            print(f"[orch] STDERR (last 1500 chars):\n{r.stderr[-1500:]}", flush=True)

        print("[orch] scp result back", flush=True)
        r2 = subprocess.run(
            ["scp", "-P", str(ssh_port)] + ssh_opts +
            [f"root@{ssh_ip}:/tmp/result.json", "/tmp/result_from_pod.json"],
            capture_output=True, text=True, timeout=120,
        )
        print(f"[orch] scp-back rc={r2.returncode}", flush=True)
        if r2.stderr:
            print(f"[orch]   scp-back stderr: {r2.stderr[:400]}", flush=True)
        if r2.returncode == 0:
            sz = os.path.getsize("/tmp/result_from_pod.json")
            print(f"[orch] result file: {sz} bytes", flush=True)
        return 0 if r2.returncode == 0 else 5

    finally:
        print(f"[orch] terminating pod {pid}", flush=True)
        try:
            gql(
                "mutation T($i:PodTerminateInput!){podTerminate(input:$i)}",
                {"i": {"podId": pid}},
            )
            print("[orch] pod terminated", flush=True)
        except Exception as e:
            print(f"[orch] terminate err: {e}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
