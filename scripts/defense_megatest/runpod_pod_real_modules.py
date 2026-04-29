"""Provision a RunPod GPU pod, run real TCD-JEPA recursive loop on cuda, capture modules.

Bypasses the project's serverless handler (which silently falls through
to simulation for module extraction). Provisions a one-shot pod that:
  1. Clones tcd-jepa from its public GitHub mirror
  2. Installs ripser + persim for persistent homology
  3. Downloads NSL-KDD (DARPA / MIT Lincoln Lab modernized 2009)
  4. Runs RecursiveLoop.step() iteratively on cuda
  5. Computes per-module attack-subtype alignment (post-hoc, with labels)
  6. Prints a single self-delimited JSON blob to stdout
  7. Sleeps to keep the pod alive long enough to fetch logs

Then this orchestrator polls the pod's logs via RunPod GraphQL until
the marker shows up, extracts the JSON, terminates the pod, and saves
the result to data/validation/runpod_tcd_real_gpu_modules.json.

Usage on EC2:
    cd /opt/latentocean
    set -a && source .env && set +a
    python3 scripts/defense_megatest/runpod_pod_real_modules.py
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
GRAPHQL = "https://api.runpod.io/graphql"
PYTORCH_IMAGE = "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04"


# ────────────────────────────────────────────────────────────────────
# The script that runs ON THE POD. Self-contained, prints JSON to stdout.
# ────────────────────────────────────────────────────────────────────
POD_SCRIPT = r'''
import sys, os, json, csv, time, urllib.request, random
from pathlib import Path
from collections import Counter

print("=== TCD-JEPA real GPU run beginning ===", flush=True)

# Install / clone tcd-jepa
os.system("apt-get update -qq && apt-get install -qq -y git curl > /dev/null 2>&1")
os.system("pip install -q ripser persim numpy pandas scikit-learn 2>&1 | tail -3")
os.system("cd /tmp && git clone --depth=1 https://github.com/direncode/tcd-jepa.git > /dev/null 2>&1 || true")
os.system("pip install -q -e /tmp/tcd-jepa 2>&1 | tail -3")
sys.path.insert(0, "/tmp/tcd-jepa")

import torch
import numpy as np
import pandas as pd

print(f"torch={torch.__version__} cuda_avail={torch.cuda.is_available()} dev={torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}", flush=True)

from tcd_jepa.core.recursive_loop import RecursiveLoop

# Download NSL-KDD
NSL = "/tmp/nsl_kdd.txt"
if not os.path.exists(NSL):
    urllib.request.urlretrieve("https://raw.githubusercontent.com/defcom17/NSL_KDD/master/KDDTrain%2B.txt", NSL)

COLUMNS = ["duration","protocol_type","service","flag","src_bytes","dst_bytes","land","wrong_fragment","urgent","hot","num_failed_logins","logged_in","num_compromised","root_shell","su_attempted","num_root","num_file_creations","num_shells","num_access_files","num_outbound_cmds","is_host_login","is_guest_login","count","srv_count","serror_rate","srv_serror_rate","rerror_rate","srv_rerror_rate","same_srv_rate","diff_srv_rate","srv_diff_host_rate","dst_host_count","dst_host_srv_count","dst_host_same_srv_rate","dst_host_diff_srv_rate","dst_host_same_src_port_rate","dst_host_srv_diff_host_rate","dst_host_serror_rate","dst_host_srv_serror_rate","dst_host_rerror_rate","dst_host_srv_rerror_rate","attack_label","difficulty_level"]
CATEGORICAL = {"protocol_type", "service", "flag"}

# Load + encode
N = int(os.environ.get("N_RECORDS", "10000"))
EMB = int(os.environ.get("EMBED_DIM", "128"))
ITERS = int(os.environ.get("N_ITERATIONS", "20"))
TARGET_S = int(os.environ.get("TARGET_SURVIVORS", "200"))
MAX_MODULES = int(os.environ.get("MAX_MODULES", "32"))
SEED = 42

print(f"=== params: n_records={N}, embed_dim={EMB}, n_iterations={ITERS}, max_modules={MAX_MODULES} ===", flush=True)

df = pd.read_csv(NSL, names=COLUMNS, header=None)
df = df.sample(n=min(N, len(df)), random_state=SEED).reset_index(drop=True)
is_attack = (df["attack_label"] != "normal").to_numpy()
attack_subtype = df["attack_label"].to_numpy()

X_df = df.drop(columns=["attack_label","difficulty_level"])
X_df = pd.get_dummies(X_df, columns=["protocol_type","service","flag"], drop_first=False)
X = X_df.to_numpy().astype(np.float32)
X = (X - X.mean(axis=0)) / (X.std(axis=0) + 1e-8)

rng = np.random.default_rng(SEED)
proj = rng.standard_normal((X.shape[1], EMB)).astype(np.float32) / np.sqrt(EMB)
Z = X @ proj
Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
z = torch.from_numpy(Z).float().to(device)
print(f"=== embeddings on {device}: {tuple(z.shape)}, attacks={int(is_attack.sum())}/{len(is_attack)} ===", flush=True)

normal_centroid = z[torch.from_numpy(~is_attack).to(device)].mean(dim=0).detach()
def energy_fn(zq):
    return (zq - normal_centroid).pow(2).sum(dim=-1)

torch.manual_seed(SEED)
loop = RecursiveLoop(
    embed_dim=EMB,
    explore_every=1,
    crystallize_every=2,
    langevin_steps=30,
    max_modules=MAX_MODULES,
    device=device,
)

t0 = time.time()
all_modules = []
history = []

for epoch in range(ITERS):
    ep_t0 = time.time()
    result = loop.step(z, energy_fn, epoch=epoch)
    ep_wall = time.time() - ep_t0
    entry = {
        "iteration": result["iteration"],
        "explored": result["explored"],
        "crystallized": result["crystallized"],
        "num_modules_after": loop.num_modules,
        "convergence_score": round(result["convergence"]["convergence_score"], 6),
        "wall_seconds": round(ep_wall, 3),
    }
    if result.get("crystallized"):
        cr = result.get("crystallization", {})
        entry["new_modules_count"] = len(cr.get("new_modules", []))
        for mid, mod, feat_type_str in result.get("new_module_objects", []):
            rec = loop.crystallizer.registry._modules.get(mid)
            feat = rec.feature if rec else None
            info = {
                "iteration": result["iteration"],
                "module_id": str(mid),
                "module_class": mod.__class__.__name__,
                "module_type": str(feat_type_str),
            }
            if feat is not None:
                info["topology"] = {
                    "homology_dim": int(feat.dim),
                    "birth": round(float(feat.birth), 4),
                    "death": round(float(feat.death), 4),
                    "persistence": round(float(feat.persistence), 4),
                }
            if hasattr(mod, "centroid"):
                c = mod.centroid.detach().cpu().numpy()
                info["centroid_stats"] = {
                    "mean": round(float(np.mean(c)), 4),
                    "std": round(float(np.std(c)), 4),
                    "norm": round(float(np.linalg.norm(c)), 4),
                    "dim": int(c.shape[0]),
                }
            if hasattr(mod, "log_radius"):
                info["radius"] = round(float(mod.log_radius.exp().item()), 4)
            if hasattr(mod, "frequencies"):
                f = mod.frequencies.detach().cpu().numpy()
                info["frequencies_summary"] = {
                    "min": round(float(np.min(f)), 4),
                    "max": round(float(np.max(f)), 4),
                    "mean": round(float(np.mean(f)), 4),
                    "n": int(len(f)),
                }
            all_modules.append(info)
    history.append(entry)
    print(f"  iter {epoch+1}: explored={entry['explored']} cryst={entry['crystallized']} mods={entry['num_modules_after']} conv={entry['convergence_score']:.4f} {ep_wall:.2f}s", flush=True)

total_wall = time.time() - t0

# Per-module attack-subtype alignment
print("=== computing per-module alignment ===", flush=True)
z_np = Z
for module_info in all_modules:
    mid = module_info["module_id"]
    rec = loop.crystallizer.registry._modules.get(mid)
    if rec is None or not hasattr(rec.module, "centroid"):
        continue
    centroid = rec.module.centroid.detach().cpu().numpy()
    dists = np.linalg.norm(z_np - centroid, axis=1)
    nearest_idx = np.argsort(dists)[:50]
    nearest_subtypes = attack_subtype[nearest_idx]
    nearest_is_attack = is_attack[nearest_idx]
    subtype_counts = Counter(nearest_subtypes.tolist())
    attack_ct = int(nearest_is_attack.sum())
    top3 = subtype_counts.most_common(3)
    dom_st, dom_n = top3[0] if top3 else ("?", 0)
    module_info["alignment"] = {
        "k_nearest": 50,
        "attack_count": attack_ct,
        "attack_share": round(attack_ct/50, 3),
        "dominant_subtype": dom_st,
        "dominant_share": round(dom_n/50, 3),
        "top3_subtypes": [{"subtype": s, "count": n, "share": round(n/50, 3)} for s,n in top3],
        "all_subtype_counts": dict(subtype_counts),
    }

by_class = {}
by_dom = {}
for m in all_modules:
    by_class[m["module_class"]] = by_class.get(m["module_class"], 0) + 1
    a = m.get("alignment") or {}
    if a:
        ds = a["dominant_subtype"]
        by_dom[ds] = by_dom.get(ds, 0) + 1

result_doc = {
    "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "config": {
        "n_records": N,
        "embed_dim": EMB,
        "n_iterations": ITERS,
        "max_modules": MAX_MODULES,
        "device": str(device),
        "cuda_device_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "seed": SEED,
    },
    "encoding": "standardize -> one-hot(protocol_type/service/flag) -> JL random projection -> L2 normalize",
    "energy_fn": "||z - normal_centroid||^2",
    "result_summary": {
        "wall_seconds": round(total_wall, 2),
        "final_active_modules": int(loop.num_modules),
        "is_converged": bool(loop.is_converged),
        "modules_formed_total": len(all_modules),
        "modules_by_class": by_class,
        "modules_by_dominant_subtype": by_dom,
    },
    "modules_formed": all_modules,
    "history": history,
}

print("=== RESULT_JSON_BEGIN ===", flush=True)
print(json.dumps(result_doc, indent=2, default=str), flush=True)
print("=== RESULT_JSON_END ===", flush=True)

# Keep pod alive long enough to fetch logs
time.sleep(900)
'''


def graphql_call(api_key: str, query: str, variables: dict) -> dict:
    body = json.dumps({"query": query, "variables": variables}).encode()
    # Cloudflare on api.runpod.io blocks default urllib UA; use a browser-style UA.
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://www.runpod.io",
        "Referer": "https://www.runpod.io/",
    }
    req = urllib.request.Request(GRAPHQL, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.loads(r.read().decode())
    if "errors" in resp:
        raise RuntimeError(f"GraphQL: {resp['errors']}")
    return resp.get("data") or {}


PROVISION_MUTATION = """
mutation ProvisionPod($input: PodFindAndDeployOnDemandInput!) {
  podFindAndDeployOnDemand(input: $input) {
    id
    desiredStatus
    machineId
    imageName
  }
}
"""

POD_QUERY = """
query Pod($id: String!) {
  pod(input: {podId: $id}) {
    id
    desiredStatus
    runtime {
      uptimeInSeconds
      ports { ip publicPort privatePort type }
    }
  }
}
"""

POD_LOGS_QUERY = """
query PodLogs($id: String!) {
  pod(input: {podId: $id}) {
    id
    podLogs {
      logType
      message
      time
    }
  }
}
"""

TERMINATE_MUTATION = """
mutation TerminatePod($input: PodTerminateInput!) {
  podTerminate(input: $input)
}
"""


def provision_pod(api_key: str, gpu_type_id: str = "NVIDIA GeForce RTX 4090") -> dict:
    docker_args = f"bash -c 'python3 -c \"import base64, sys; exec(base64.b64decode(sys.argv[1]).decode())\" {base64.b64encode(POD_SCRIPT.encode()).decode()}'"
    variables = {
        "input": {
            "cloudType": "COMMUNITY",
            "gpuCount": 1,
            "volumeInGb": 0,
            "containerDiskInGb": 30,
            "gpuTypeId": gpu_type_id,
            "name": f"latentocean-tcd-real-modules-{int(time.time())}",
            "imageName": PYTORCH_IMAGE,
            "dockerArgs": docker_args,
            "ports": "8888/http,22/tcp",
            "volumeMountPath": "/workspace",
        }
    }
    data = graphql_call(api_key, PROVISION_MUTATION, variables)
    pod = data.get("podFindAndDeployOnDemand") or {}
    return pod


def get_pod_logs(api_key: str, pod_id: str) -> str:
    data = graphql_call(api_key, POD_LOGS_QUERY, {"id": pod_id})
    pod = data.get("pod") or {}
    logs = pod.get("podLogs") or []
    return "\n".join((entry.get("message") or "") for entry in logs)


def get_pod_status(api_key: str, pod_id: str) -> dict:
    data = graphql_call(api_key, POD_QUERY, {"id": pod_id})
    return data.get("pod") or {}


def terminate_pod(api_key: str, pod_id: str) -> None:
    graphql_call(api_key, TERMINATE_MUTATION, {"input": {"podId": pod_id}})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpu", default="NVIDIA GeForce RTX 4090")
    ap.add_argument("--n-records", type=int, default=10000)
    ap.add_argument("--embed-dim", type=int, default=128)
    ap.add_argument("--n-iterations", type=int, default=20)
    ap.add_argument("--max-modules", type=int, default=32)
    ap.add_argument("--max-wait-seconds", type=int, default=900)
    ap.add_argument("--output", default=str(REPO_ROOT / "data" / "validation" / "runpod_tcd_real_gpu_modules.json"))
    args = ap.parse_args()

    api_key = os.environ.get("RUNPOD_API_KEY")
    if not api_key:
        print("ERROR: RUNPOD_API_KEY not set", file=sys.stderr)
        return 2

    print(f"[pod_run] provisioning pod ({args.gpu}) ...")
    pod = provision_pod(api_key, gpu_type_id=args.gpu)
    pod_id = pod.get("id")
    if not pod_id:
        print(f"[pod_run] FAIL: no pod id; response: {pod}", file=sys.stderr)
        return 3
    print(f"[pod_run] pod_id={pod_id}, image={pod.get('imageName')}")

    try:
        # Poll for the result-JSON markers in pod logs
        start = time.time()
        last_log_len = 0
        while time.time() - start < args.max_wait_seconds:
            time.sleep(20)
            try:
                logs = get_pod_logs(api_key, pod_id)
            except Exception as e:
                print(f"[pod_run]   logs poll error: {e}")
                continue

            new = logs[last_log_len:]
            if new.strip():
                print(f"[pod_run]   --- new log ({len(new)} chars) ---")
                print(new[-2000:])
                last_log_len = len(logs)

            if "RESULT_JSON_END" in logs:
                print("[pod_run] RESULT_JSON_END marker found, extracting JSON")
                pre, _, rest = logs.partition("=== RESULT_JSON_BEGIN ===")
                json_blob, _, _ = rest.partition("=== RESULT_JSON_END ===")
                json_blob = json_blob.strip()
                try:
                    parsed = json.loads(json_blob)
                except json.JSONDecodeError as e:
                    print(f"[pod_run] JSON parse error: {e}", file=sys.stderr)
                    print(f"[pod_run] First 500 chars of blob: {json_blob[:500]}", file=sys.stderr)
                    return 5

                # Save full record
                full = {
                    "submitted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "pod_id": pod_id,
                    "gpu_type_requested": args.gpu,
                    "image": PYTORCH_IMAGE,
                    "log_size": len(logs),
                    "result": parsed,
                }
                out = Path(args.output)
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_text(json.dumps(full, indent=2, default=str), encoding="utf-8")
                print(f"[pod_run] result saved: {out}")
                return 0

        print(f"[pod_run] TIMEOUT after {args.max_wait_seconds}s — last log:")
        print(get_pod_logs(api_key, pod_id)[-3000:])
        return 4

    finally:
        try:
            print(f"[pod_run] terminating pod {pod_id}")
            terminate_pod(api_key, pod_id)
        except Exception as e:
            print(f"[pod_run] terminate error (continue anyway): {e}")


if __name__ == "__main__":
    raise SystemExit(main())
