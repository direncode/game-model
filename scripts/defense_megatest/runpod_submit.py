"""Submit a TCD-JEPA crystallization job to the live RunPod serverless endpoint.

Stdlib-only. Designed to run on the production EC2 box where
RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID are loaded into the env from
/opt/latentocean/.env. Builds a real corpus of NSL-KDD intrusion
records (DARPA / MIT Lincoln Lab origin), encodes them to BTUT entity
format, submits the job, polls until completion, and saves the response.

Usage on EC2:
    cd /opt/latentocean
    set -a && source .env && set +a
    python3 scripts/defense_megatest/runpod_submit.py \
        --n-records 8000 \
        --output /tmp/runpod_tcd_result.json

Usage anywhere with creds in env:
    export RUNPOD_API_KEY=rpa_...
    export RUNPOD_ENDPOINT_ID=...
    python3 scripts/defense_megatest/runpod_submit.py
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

NSL_KDD_URL = "https://raw.githubusercontent.com/defcom17/NSL_KDD/master/KDDTrain%2B.txt"

NSL_KDD_COLUMNS = [
    "duration", "protocol_type", "service", "flag", "src_bytes",
    "dst_bytes", "land", "wrong_fragment", "urgent", "hot",
    "num_failed_logins", "logged_in", "num_compromised", "root_shell",
    "su_attempted", "num_root", "num_file_creations", "num_shells",
    "num_access_files", "num_outbound_cmds", "is_host_login", "is_guest_login",
    "count", "srv_count", "serror_rate", "srv_serror_rate", "rerror_rate",
    "srv_rerror_rate", "same_srv_rate", "diff_srv_rate", "srv_diff_host_rate",
    "dst_host_count", "dst_host_srv_count", "dst_host_same_srv_rate",
    "dst_host_diff_srv_rate", "dst_host_same_src_port_rate",
    "dst_host_srv_diff_host_rate", "dst_host_serror_rate",
    "dst_host_srv_serror_rate", "dst_host_rerror_rate",
    "dst_host_srv_rerror_rate", "attack_label", "difficulty_level",
]

# Numeric vs categorical (per feature naming convention; categorical = strings)
CATEGORICAL = {"protocol_type", "service", "flag"}


def fetch_nsl_kdd(cache_path: Path) -> Path:
    """Fetch NSL-KDD train+ CSV to a local cache path. Returns the path."""
    if cache_path.exists() and cache_path.stat().st_size > 1_000_000:
        return cache_path
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[runpod_submit] Downloading NSL-KDD train+ from {NSL_KDD_URL} ...")
    urllib.request.urlretrieve(NSL_KDD_URL, cache_path)
    sz = cache_path.stat().st_size / 1_000_000
    print(f"[runpod_submit]   saved {sz:.1f} MB to {cache_path}")
    return cache_path


def load_entities(cache_path: Path, n_records: int, seed: int = 42) -> tuple[list[dict], dict]:
    """Load NSL-KDD records into BTUT entity dicts.

    Returns (entities, label_meta). label_meta is held back for post-hoc
    alignment analysis on returned modules.
    """
    rows: list[dict] = []
    with cache_path.open("r", encoding="utf-8") as f:
        rdr = csv.reader(f)
        for raw in rdr:
            if len(raw) != len(NSL_KDD_COLUMNS):
                continue
            row = dict(zip(NSL_KDD_COLUMNS, raw))
            # Type-cast numerics; strings for categoricals
            cleaned: dict = {}
            for k, v in row.items():
                if k == "attack_label" or k == "difficulty_level":
                    cleaned[k] = v
                elif k in CATEGORICAL:
                    cleaned[k] = v
                else:
                    try:
                        f_val = float(v)
                        cleaned[k] = int(f_val) if f_val.is_integer() else f_val
                    except (ValueError, TypeError):
                        cleaned[k] = v
            rows.append(cleaned)

    rng = random.Random(seed)
    rng.shuffle(rows)
    rows = rows[:n_records]

    entities: list[dict] = []
    labels: dict[str, dict] = {}
    attack_subtypes: dict[str, int] = {}
    n_attacks = 0
    for i, r in enumerate(rows):
        attack_label = r.pop("attack_label", "normal")
        difficulty_level = r.pop("difficulty_level", 0)
        is_attack = attack_label != "normal"
        if is_attack:
            n_attacks += 1
        attack_subtypes[attack_label] = attack_subtypes.get(attack_label, 0) + 1
        proto = r.get("protocol_type", "unknown")
        if not isinstance(proto, str):
            proto = str(proto)
        name = f"flow_{i:06d}"
        entities.append({
            "name": name,
            "type": proto,
            "attributes": r,
        })
        labels[name] = {
            "is_attack": is_attack,
            "attack_label": attack_label,
            "difficulty_level": difficulty_level,
        }

    label_meta = {
        "n_records": len(entities),
        "n_attacks": n_attacks,
        "attack_rate": round(n_attacks / max(1, len(entities)), 4),
        "attack_subtypes_in_sample": attack_subtypes,
        "labels": labels,
    }
    return entities, label_meta


def submit_job(api_key: str, endpoint_id: str, payload: dict, timeout: int = 60) -> dict:
    """POST to /v2/<endpoint_id>/run and return the run-submit response."""
    url = f"https://api.runpod.ai/v2/{endpoint_id}/run"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    print(f"[runpod_submit] POST {url}  ({len(body) / 1024:.1f} KB payload)")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        resp = json.loads(r.read().decode("utf-8"))
    return resp


def poll_status(api_key: str, endpoint_id: str, job_id: str, max_wait: int = 1500, interval: int = 15) -> dict:
    """Poll /v2/<endpoint_id>/status/<job_id> until terminal status."""
    url = f"https://api.runpod.ai/v2/{endpoint_id}/status/{job_id}"
    start = time.time()
    last_status = None
    while time.time() - start < max_wait:
        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                resp = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print(f"[runpod_submit]   poll HTTPError {e.code}: {e.reason}")
            time.sleep(interval)
            continue
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"[runpod_submit]   poll URLError: {e}")
            time.sleep(interval)
            continue

        status = resp.get("status", "UNKNOWN")
        delay = resp.get("delayTime")
        exec_t = resp.get("executionTime")
        if status != last_status:
            t_in = int(time.time() - start)
            print(f"[runpod_submit]   t={t_in:>4d}s  status={status}  delay={delay}  exec_t={exec_t}")
            last_status = status

        if status in {"COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"}:
            return resp

        time.sleep(interval)

    raise TimeoutError(f"Job {job_id} did not complete within {max_wait}s")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-records", type=int, default=8000,
                    help="Number of NSL-KDD records to submit (after random sample, seed=42)")
    ap.add_argument("--cache-path", default="data/cache/nsl_kdd_train.txt")
    ap.add_argument("--output", default="data/validation/runpod_tcd_intrusion_result.json")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--epochs", type=int, default=80,
                    help="TCD-JEPA training epochs (handler default if unspecified)")
    ap.add_argument("--embedding-dim", type=int, default=192)
    ap.add_argument("--max-modules", type=int, default=24)
    ap.add_argument("--max-wait-seconds", type=int, default=1500)
    ap.add_argument("--dataset-id", default="nsl_kdd_capability")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print payload size and skip submission")
    args = ap.parse_args()

    api_key = os.environ.get("RUNPOD_API_KEY")
    endpoint_id = os.environ.get("RUNPOD_ENDPOINT_ID")
    if not api_key or not endpoint_id:
        print("ERROR: RUNPOD_API_KEY and/or RUNPOD_ENDPOINT_ID not set.", file=sys.stderr)
        return 2

    cache_path = Path(args.cache_path)
    fetch_nsl_kdd(cache_path)

    print(f"[runpod_submit] Loading {args.n_records} NSL-KDD records ...")
    entities, label_meta = load_entities(cache_path, n_records=args.n_records, seed=args.seed)
    print(f"[runpod_submit]   {label_meta['n_records']} flows, "
          f"{label_meta['n_attacks']} attacks "
          f"({100 * label_meta['attack_rate']:.1f}% rate), "
          f"{len(label_meta['attack_subtypes_in_sample'])} subtypes present")

    job_id_local = f"tcd_nslkdd_{int(time.time())}"
    payload = {
        "input": {
            "entities": entities,
            "edges": [],
            "config": {
                "epochs": args.epochs,
                "embedding_dim": args.embedding_dim,
                "max_modules": args.max_modules,
                "btut_enabled": True,
                "btut_budget_dollars": 30.0,
            },
            "dataset_id": args.dataset_id,
            "job_id": job_id_local,
        }
    }
    payload_bytes = len(json.dumps(payload).encode("utf-8"))
    print(f"[runpod_submit] Payload size: {payload_bytes / 1024 / 1024:.2f} MB")

    if args.dry_run:
        print("[runpod_submit] --dry-run; not submitting")
        return 0

    print(f"[runpod_submit] Endpoint: {endpoint_id}")
    submit_resp = submit_job(api_key, endpoint_id, payload)
    job_id = submit_resp.get("id")
    if not job_id:
        print(f"[runpod_submit] ERROR: submit response missing 'id': {submit_resp}", file=sys.stderr)
        return 3
    print(f"[runpod_submit] Job submitted: id={job_id}")
    print(f"[runpod_submit] Polling (max {args.max_wait_seconds}s) ...")

    final = poll_status(api_key, endpoint_id, job_id, max_wait=args.max_wait_seconds)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    full_record = {
        "submitted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "endpoint_id": endpoint_id,
        "job_id_remote": job_id,
        "job_id_local": job_id_local,
        "n_entities_submitted": len(entities),
        "label_meta_summary": {
            "n_records": label_meta["n_records"],
            "n_attacks": label_meta["n_attacks"],
            "attack_rate": label_meta["attack_rate"],
            "attack_subtypes_in_sample": label_meta["attack_subtypes_in_sample"],
        },
        "config_sent": payload["input"]["config"],
        "runpod_response": final,
    }
    out_path.write_text(json.dumps(full_record, indent=2, default=str), encoding="utf-8")
    print(f"[runpod_submit] Wrote: {out_path}")

    status = final.get("status")
    if status == "COMPLETED":
        # Output is a list of yielded records; the last one with status=completed has modules
        out = final.get("output")
        if isinstance(out, list):
            for entry in reversed(out):
                if isinstance(entry, dict) and entry.get("status") == "completed":
                    modules = entry.get("modules") or []
                    print(f"[runpod_submit] COMPLETED: {len(modules)} modules returned, "
                          f"final_loss={entry.get('final_loss')}, "
                          f"device={entry.get('device')}, "
                          f"training_time_s={entry.get('training_time_seconds')}")
                    break
        elif isinstance(out, dict):
            modules = out.get("modules") or []
            print(f"[runpod_submit] COMPLETED: {len(modules)} modules returned, "
                  f"device={out.get('device')}, "
                  f"final_loss={out.get('final_loss')}")
        return 0

    print(f"[runpod_submit] Final status: {status}")
    return 1 if status != "COMPLETED" else 0


if __name__ == "__main__":
    raise SystemExit(main())
