"""
RunPod dispatcher for the AI substrate campaign GPU phase.

Submits jobs to the existing serverless endpoint (BTUT -> TCD-JEPA), polls
for completion, returns the result. Self-imposed budget cap and per-job
timeout to prevent runaway spend.

Usage (as a library):
    from scripts.experiments.runpod_dispatch import submit_and_wait
    result = submit_and_wait(entities, edges, config={"btut_budget_dollars": 5})

Direct smoke test:
    python scripts/experiments/runpod_dispatch.py --smoke
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import urllib.request
import urllib.error


# ---------- guards --------------------------------------------------------
HARD_CAP_DOLLARS = 30.0
PER_JOB_TIMEOUT_SECONDS = 600  # 10 minutes per job
COOLDOWN_SECONDS = 5
SPEND_LOG = Path("tmp/runpod_local_spend.json")
GPU_COST_PER_SECOND = 0.04 / 60  # ~$0.04/min approximation for serverless A100
# --------------------------------------------------------------------------


def load_credentials():
    env = {}
    for line in Path(".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    api_key = env.get("RUNPOD_API_KEY")
    endpoint_id = env.get("RUNPOD_ENDPOINT_ID")
    if not api_key or not endpoint_id:
        sys.exit("missing RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID in .env")
    return api_key, endpoint_id


def load_spend() -> float:
    if SPEND_LOG.exists():
        return json.loads(SPEND_LOG.read_text())["spent_dollars"]
    return 0.0


def add_spend(amount_dollars: float, job_id: str, exec_seconds: float):
    SPEND_LOG.parent.mkdir(parents=True, exist_ok=True)
    if SPEND_LOG.exists():
        prev = json.loads(SPEND_LOG.read_text())
    else:
        prev = {"spent_dollars": 0.0, "history": []}
    prev["spent_dollars"] += amount_dollars
    prev["history"].append({
        "ts": time.time(),
        "job_id": job_id,
        "amount_dollars": round(amount_dollars, 4),
        "exec_seconds": round(exec_seconds, 2),
    })
    SPEND_LOG.write_text(json.dumps(prev, indent=2))


def check_budget(estimated_cost_dollars: float):
    spent = load_spend()
    projected = spent + estimated_cost_dollars
    if projected > HARD_CAP_DOLLARS:
        sys.exit(
            f"budget guard: would exceed hard cap ${HARD_CAP_DOLLARS} "
            f"(spent=${spent:.2f}, projected=${projected:.2f}). "
            f"Edit HARD_CAP_DOLLARS or clear {SPEND_LOG} to continue."
        )
    print(f"[budget] spent=${spent:.2f}  projected=${projected:.2f}  cap=${HARD_CAP_DOLLARS}")


def http_post(url: str, headers: dict, body: dict, timeout: float = 30) -> dict:
    payload_bytes = json.dumps(body).encode()
    print(f"[http_post] {len(payload_bytes)/1024/1024:.2f} MB payload to {url}")
    req = urllib.request.Request(
        url,
        data=payload_bytes,
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors="replace")[:500]
        print(f"[http_post] HTTP {e.code} {e.reason}: {body_text}")
        raise


def http_get(url: str, headers: dict, timeout: float = 30) -> dict:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def submit_and_wait(
    entities: list[dict],
    edges: list[dict],
    config: dict | None = None,
    job_id: str | None = None,
    estimated_cost_dollars: float = 0.10,
    poll_interval: float = 4.0,
) -> dict:
    """Submit a job to the RunPod serverless endpoint and wait for completion."""
    api_key, endpoint_id = load_credentials()
    check_budget(estimated_cost_dollars)

    job_id = job_id or f"campaign_{int(time.time())}"
    base = f"https://api.runpod.ai/v2/{endpoint_id}"
    headers = {"Authorization": f"Bearer {api_key}"}

    payload = {
        "input": {
            "entities": entities,
            "edges": edges,
            "config": config or {},
            "dataset_id": "ai_substrate_campaign",
            "job_id": job_id,
        }
    }

    print(f"[submit] entities={len(entities)} edges={len(edges)} config={config}")
    t0 = time.time()
    submit = http_post(f"{base}/run", headers, payload)
    runpod_id = submit.get("id")
    print(f"[submit] runpod_id={runpod_id} status={submit.get('status')}")

    last_status = None
    final = None
    while True:
        if time.time() - t0 > PER_JOB_TIMEOUT_SECONDS:
            print(f"[timeout] cancelling job {runpod_id}")
            try:
                http_post(f"{base}/cancel/{runpod_id}", headers, {})
            except Exception:
                pass
            return {"error": "per-job timeout exceeded", "runpod_id": runpod_id}

        try:
            status = http_get(f"{base}/status/{runpod_id}", headers)
        except urllib.error.HTTPError as e:
            print(f"[poll] HTTP {e.code} — retrying in {poll_interval}s")
            time.sleep(poll_interval)
            continue

        s = status.get("status")
        if s != last_status:
            print(f"[poll] status={s}  elapsed={time.time()-t0:.1f}s")
            last_status = s
        if s in ("COMPLETED", "FAILED", "CANCELLED"):
            final = status
            break
        time.sleep(poll_interval)

    elapsed = time.time() - t0
    output = final.get("output") if final else None
    # output may be a dict, a list of dicts (yielded progress + final), or None
    exec_ms = None
    if isinstance(output, dict):
        exec_ms = output.get("exec_ms") or output.get("delay_ms")
    elif isinstance(output, list):
        # walk in reverse, find last dict with exec_ms
        for item in reversed(output):
            if isinstance(item, dict):
                exec_ms = item.get("exec_ms") or item.get("delay_ms")
                if exec_ms:
                    break
    if not exec_ms:
        exec_ms = int(elapsed * 1000)
    cost = (exec_ms / 1000) * GPU_COST_PER_SECOND
    add_spend(cost, runpod_id, exec_ms / 1000)
    print(f"[done] elapsed={elapsed:.1f}s  exec_ms={exec_ms}  cost~${cost:.4f}")

    time.sleep(COOLDOWN_SECONDS)
    return final


def smoke_test():
    """Submit a tiny job to verify the dispatch path works end-to-end."""
    import random
    rng = random.Random(42)
    n = 250
    entities = []
    for i in range(n):
        archetype = i % 5
        entities.append({
            "name": f"e{i}",
            "type": f"archetype_{archetype}",
            "attributes": {
                "title": f"Document {i} archetype {archetype}",
                "text": f"keyword_{archetype} content {rng.randint(0, 1000)}",
            },
        })
    edges = []
    for i in range(n):
        for _ in range(4):
            j = rng.randrange(n)
            if j != i:
                edges.append({
                    "source": f"e{i}",
                    "target": f"e{j}",
                    "type": "knn",
                    "weight": rng.random(),
                })
    print(f"smoke: n={n}, edges={len(edges)}, archetypes=5")
    result = submit_and_wait(
        entities, edges,
        config={"btut_enabled": True, "btut_budget_dollars": 1.0, "epochs": 20},
        estimated_cost_dollars=0.20,
    )
    print()
    print("=" * 80)
    print("SMOKE RESULT (top-level keys):")
    if isinstance(result, dict):
        for k in result.keys():
            v = result[k]
            if isinstance(v, (dict, list)):
                print(f"  {k}: {type(v).__name__} len={len(v)}")
            else:
                print(f"  {k}: {repr(v)[:120]}")
        out = result.get("output")
        if isinstance(out, list):
            print(f"OUTPUT is a list with {len(out)} items")
            for i, item in enumerate(out):
                if isinstance(item, dict):
                    print(f"  [{i}] keys: {list(item.keys())}")
                else:
                    print(f"  [{i}] {type(item).__name__}: {repr(item)[:120]}")
        elif isinstance(out, dict):
            print("OUTPUT keys:")
            for k in out.keys():
                v = out[k]
                if isinstance(v, (dict, list)):
                    print(f"    {k}: {type(v).__name__} len={len(v)}")
                else:
                    print(f"    {k}: {repr(v)[:200]}")
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--smoke", action="store_true")
    args = ap.parse_args()
    if args.smoke:
        result = smoke_test()
        Path("data/validation/runpod_smoke.json").write_text(
            json.dumps(result, indent=2), encoding="utf-8"
        )
        print("saved: data/validation/runpod_smoke.json")
    else:
        print("nothing to do — pass --smoke")


if __name__ == "__main__":
    main()
