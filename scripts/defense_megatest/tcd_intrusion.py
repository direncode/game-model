"""TCD-JEPA capability test on real intrusion-detection data.

Capability test, not a sales demo. Runs the TCD-JEPA recursive loop
(System 1 / 2 / 3) on NSL-KDD network intrusion records to observe
what *modules* the System 3 crystallizer forms when given real
defense-themed traffic with labeled attacks.

NSL-KDD = the cleaned, modernized version of KDDCUP99 (University of
New Brunswick, 2009). Same DARPA / MIT Lincoln Laboratory origin,
better balanced class distribution, deduplicated. Public download.

What the loop does on this data:
  1. Encode 41-feature flow records (mixed numeric + categorical) to
     a fixed-dim embedding via standardize → one-hot encode → random
     projection (Johnson-Lindenstrauss). No training of a model.
  2. Define energy E(z) = ||z - normal_centroid||^2 so attack flows
     occupy higher-energy regions of the latent space.
  3. Run RecursiveLoop.step() repeatedly. System 2 (Energy Explorer)
     samples Langevin trajectories biased toward high-uncertainty /
     blank regions of the energy landscape. System 3 (Module
     Crystallizer) computes Vietoris-Rips persistent homology on the
     trajectory point clouds and crystallizes:
       - H_0 (connected components) → AttractorModule
       - H_1 (loops)                → CycleModule
       - H_2 (voids)                → BoundaryModule
  4. Output: the list of modules formed, their types, and which
     iteration each appeared in.

Local CPU-scale demo. Production runs benefit from GPU; see
`scripts/defense_megatest/runpod_deploy.py` for the RunPod scale-up
manifest.

Usage:
    python -m scripts.defense_megatest.tcd_intrusion
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
import torch

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TCD_PATH = REPO_ROOT / "tcd-jepa"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(TCD_PATH) not in sys.path:
    sys.path.insert(0, str(TCD_PATH))

from tcd_jepa.core.recursive_loop import RecursiveLoop  # noqa: E402

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


def download_nsl_kdd(cache_path: Path) -> None:
    """Fetch NSL-KDD train+ corpus to a local cache path if not present."""
    if cache_path.exists():
        return
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[tcd_intrusion] Downloading NSL-KDD train+ from {NSL_KDD_URL} ...")
    urllib.request.urlretrieve(NSL_KDD_URL, cache_path)
    sz = cache_path.stat().st_size / 1_000_000
    print(f"[tcd_intrusion]   saved {sz:.1f} MB to {cache_path}")


def load_and_encode(
    cache_path: Path,
    n_samples: int = 2000,
    embed_dim: int = 64,
    seed: int = 42,
) -> tuple[torch.Tensor, np.ndarray, np.ndarray, dict[str, Any]]:
    """Load NSL-KDD records and encode them to a (N, embed_dim) tensor.

    Encoding: per-feature standardize → one-hot for categoricals → random
    projection (Johnson-Lindenstrauss style) → L2 normalize.

    Returns (z, is_attack, attack_subtype, meta).
    """
    import pandas as pd

    rng = np.random.default_rng(seed)

    df = pd.read_csv(cache_path, names=NSL_KDD_COLUMNS, header=None)

    # Stratified sample: roughly preserve attack/normal balance
    df = df.sample(n=min(n_samples, len(df)), random_state=seed).reset_index(drop=True)

    is_attack = (df["attack_label"] != "normal").to_numpy()
    attack_subtype = df["attack_label"].to_numpy()

    X_df = df.drop(columns=["attack_label", "difficulty_level"])
    X_df = pd.get_dummies(X_df, columns=["protocol_type", "service", "flag"], drop_first=False)
    X = X_df.to_numpy().astype(np.float32)

    # Standardize
    X = (X - X.mean(axis=0)) / (X.std(axis=0) + 1e-8)

    # Random projection to embed_dim (Johnson-Lindenstrauss)
    in_dim = X.shape[1]
    proj = rng.standard_normal((in_dim, embed_dim)).astype(np.float32) / np.sqrt(embed_dim)
    Z = X @ proj

    # L2 normalize so embeddings live on a sphere
    Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)

    z = torch.from_numpy(Z).float()
    meta = {
        "n_samples": int(len(z)),
        "n_attacks": int(is_attack.sum()),
        "n_normal": int((~is_attack).sum()),
        "in_dim_after_one_hot": int(in_dim),
        "embed_dim": int(embed_dim),
        "encoding": "standardize → one-hot(protocol_type/service/flag) → JL random projection → L2 normalize",
        "attack_subtypes_present": sorted(set(attack_subtype.tolist())),
        "attack_rate": round(float(is_attack.mean()), 4),
    }
    return z, is_attack, attack_subtype, meta


def build_energy_fn(z: torch.Tensor, is_attack: np.ndarray):
    """Energy E(z) = ||z - normal_centroid||^2.

    Attack flows have higher energy under this definition, so System 2's
    Langevin sampler will preferentially explore the attack-occupied
    regions of the latent space.
    """
    normal_mask = torch.from_numpy(~is_attack)
    normal_centroid = z[normal_mask].mean(dim=0).detach()

    def energy_fn(z_query: torch.Tensor) -> torch.Tensor:
        return (z_query - normal_centroid).pow(2).sum(dim=-1)

    return energy_fn, normal_centroid


def run_capability_test(
    n_samples: int = 2000,
    embed_dim: int = 64,
    n_iterations: int = 12,
    explore_every: int = 1,
    crystallize_every: int = 2,
    langevin_steps: int = 30,
    max_modules: int = 16,
    seed: int = 42,
) -> dict[str, Any]:
    """Run the TCD-JEPA recursive loop on NSL-KDD and capture modules formed."""
    cache_path = REPO_ROOT / "data" / "cache" / "nsl_kdd_train.txt"
    download_nsl_kdd(cache_path)

    print(f"[tcd_intrusion] Loading and encoding {n_samples} flow records "
          f"to {embed_dim}-D embeddings ...")
    z, is_attack, attack_subtype, encoding_meta = load_and_encode(
        cache_path, n_samples=n_samples, embed_dim=embed_dim, seed=seed,
    )
    print(f"[tcd_intrusion]   {encoding_meta['n_samples']} flows, "
          f"{encoding_meta['n_attacks']} attacks "
          f"({100 * encoding_meta['attack_rate']:.1f}% attack rate)")
    print(f"[tcd_intrusion]   embedding shape: {tuple(z.shape)}")
    print(f"[tcd_intrusion]   attack subtypes: {len(encoding_meta['attack_subtypes_present'])} present")

    energy_fn, normal_centroid = build_energy_fn(z, is_attack)
    print(f"[tcd_intrusion] Energy fn: ||z - normal_centroid||^2  "
          f"(attack mean energy: "
          f"{float(energy_fn(z[torch.from_numpy(is_attack)]).mean()):.4f}, "
          f"normal mean energy: "
          f"{float(energy_fn(z[torch.from_numpy(~is_attack)]).mean()):.4f})")

    # Build the recursive loop
    print(f"[tcd_intrusion] Initializing RecursiveLoop "
          f"(embed_dim={embed_dim}, langevin_steps={langevin_steps}, "
          f"max_modules={max_modules}) ...")
    torch.manual_seed(seed)
    loop = RecursiveLoop(
        embed_dim=embed_dim,
        explore_every=explore_every,
        crystallize_every=crystallize_every,
        langevin_steps=langevin_steps,
        max_modules=max_modules,
        device=torch.device("cpu"),
    )

    history: list[dict[str, Any]] = []
    all_modules_formed: list[dict[str, Any]] = []
    t0 = time.perf_counter()

    for epoch in range(n_iterations):
        ep_t0 = time.perf_counter()
        result = loop.step(z, energy_fn, epoch=epoch)
        ep_wall = time.perf_counter() - ep_t0

        entry = {
            "iteration": result["iteration"],
            "explored": result["explored"],
            "crystallized": result["crystallized"],
            "num_modules_after": loop.num_modules,
            "convergence_score": round(result["convergence"]["convergence_score"], 6),
            "is_converged": result["convergence"]["is_converged"],
            "wall_seconds": round(ep_wall, 3),
        }
        if result["explored"]:
            entry["exploration"] = result.get("exploration", {})
        if result["crystallized"]:
            cr = result.get("crystallization", {})
            entry["crystallization"] = {
                "new_modules_count": len(cr.get("new_modules", [])),
                "pruned_modules_count": len(cr.get("pruned_modules", [])),
                "num_active_modules": cr.get("num_active_modules"),
                "total_persistence": round(float(cr.get("total_persistence", 0.0)), 4),
            }
            for mid, mod, feat_type_str in result.get("new_module_objects", []):
                # `feat_type_str` is the module-type string (e.g. "attractor",
                # "cycle", "boundary") — not the TopologicalFeature object.
                # The full feature is stored in the registry's ModuleRecord.
                rec = loop.crystallizer.registry._modules.get(mid)
                feat_obj = rec.feature if rec is not None else None
                module_info: dict[str, Any] = {
                    "iteration": result["iteration"],
                    "module_id": str(mid),
                    "module_class": mod.__class__.__name__,
                    "module_type": str(feat_type_str),
                }
                if feat_obj is not None:
                    module_info["topology"] = {
                        "homology_dim": int(feat_obj.dim),
                        "birth": round(float(feat_obj.birth), 4),
                        "death": round(float(feat_obj.death), 4),
                        "persistence": round(float(feat_obj.persistence), 4),
                    }
                # Introspect module-specific learnable parameters
                if hasattr(mod, "centroid"):
                    c = mod.centroid.detach().numpy()
                    module_info["centroid_stats"] = {
                        "mean": round(float(np.mean(c)), 4),
                        "std": round(float(np.std(c)), 4),
                        "norm": round(float(np.linalg.norm(c)), 4),
                        "dim": int(c.shape[0]) if c.ndim == 1 else list(c.shape),
                    }
                if hasattr(mod, "log_radius"):
                    module_info["radius"] = round(float(mod.log_radius.exp().item()), 4)
                if hasattr(mod, "frequencies"):
                    f = mod.frequencies.detach().numpy()
                    module_info["frequencies_summary"] = {
                        "min": round(float(np.min(f)), 4),
                        "max": round(float(np.max(f)), 4),
                        "mean": round(float(np.mean(f)), 4),
                        "n": int(len(f)),
                    }
                all_modules_formed.append(module_info)

        history.append(entry)
        marker = "" if not entry["crystallized"] else \
            f"  +{entry['crystallization']['new_modules_count']} module(s)"
        print(f"  iter {epoch + 1:2d}: explored={entry['explored']}, "
              f"crystallized={entry['crystallized']}, "
              f"active_modules={entry['num_modules_after']}, "
              f"conv={entry['convergence_score']:.4f}, "
              f"{ep_wall:.2f}s{marker}")

    total_wall = time.perf_counter() - t0

    # Final module summary by class and by topological-feature type
    by_class: dict[str, int] = {}
    by_topo: dict[str, int] = {}
    for m in all_modules_formed:
        by_class[m["module_class"]] = by_class.get(m["module_class"], 0) + 1
        by_topo[m["module_type"]] = by_topo.get(m["module_type"], 0) + 1

    print()
    print(f"[tcd_intrusion] Total wall: {total_wall:.1f}s; final active modules: {loop.num_modules}")
    print(f"[tcd_intrusion] Modules formed during run, by class: {by_class}")
    print(f"[tcd_intrusion] Modules formed during run, by topological feature: {by_topo}")

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dataset": {
            "name": "NSL-KDD train+",
            "provenance": "DARPA Intrusion Detection Evaluation, MIT Lincoln Laboratory; modernized 2009 by University of New Brunswick",
            "url": NSL_KDD_URL,
            "encoding": encoding_meta,
        },
        "tcd_config": {
            "embed_dim": embed_dim,
            "n_samples": n_samples,
            "n_iterations": n_iterations,
            "explore_every": explore_every,
            "crystallize_every": crystallize_every,
            "langevin_steps": langevin_steps,
            "max_modules": max_modules,
            "seed": seed,
            "device": "cpu",
        },
        "result_summary": {
            "wall_seconds": round(total_wall, 2),
            "final_active_modules": int(loop.num_modules),
            "is_converged": bool(loop.is_converged),
            "modules_formed_total": len(all_modules_formed),
            "modules_by_class": by_class,
            "modules_by_topological_feature": by_topo,
        },
        "modules_formed": all_modules_formed,
        "history": history,
    }


def main() -> int:
    print("=" * 78)
    print("TCD-JEPA CAPABILITY TEST ON REAL INTRUSION DATA (NSL-KDD)")
    print("=" * 78)
    print()
    out = run_capability_test()
    out_path = REPO_ROOT / "data" / "validation" / "tcd_intrusion_modules.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"\n[tcd_intrusion] Artifact: {out_path}")
    print(f"[tcd_intrusion] Final active modules: {out['result_summary']['final_active_modules']}")
    print(f"[tcd_intrusion] Modules formed: {out['result_summary']['modules_formed_total']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
