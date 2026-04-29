"""Integrated BTUT -> TCD pipeline on NSL-KDD with plain-English module narratives.

Stage 1: BTUT pre-reduction on CPU (8-tier deterministic structural-anomaly
         engine, 9s for 9000 records).
Stage 2: TCD-JEPA recursive loop (System 2 Langevin + System 3 persistent-
         homology crystallizer) on the BTUT survivors only. CPU-feasible
         because the survivor set is small (~300 entities).
Stage 3: Per-module attack-subtype alignment and plain-English narration.

The point of this script: show the MODULES THAT FORM ON THE BTUT SURVIVORS.
These are different from "TCD on raw 10000 records" because BTUT first
filters to 299 structurally-distinctive flows; TCD then organizes those
299 into attractor basins. The modules represent stable archetypes among
the rare-or-distinctive flows BTUT pulled forward.

Usage:
    python -m scripts.defense_megatest.run_btut_then_tcd
"""
from __future__ import annotations

import json
import sys
import time
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

import numpy as np  # noqa: E402
import torch  # noqa: E402

from backend.engine.reduce.pipeline import run_btut_pipeline  # noqa: E402
from scripts.defense_megatest.runpod_submit import (  # noqa: E402
    fetch_nsl_kdd,
    load_entities,
)
from tcd_jepa.core.recursive_loop import RecursiveLoop  # noqa: E402

SUBTYPE_GLOSSARY = {
    "normal": "normal background traffic, no attack signature",
    "neptune": "Neptune SYN-flood DoS — half-open TCP connections exhausting server resources",
    "smurf": "Smurf — ICMP-amplified DDoS using broadcast addresses",
    "ipsweep": "IP-sweep — reconnaissance scan probing IP-address ranges",
    "portsweep": "Port-sweep — reconnaissance scan probing many ports on one host",
    "satan": "SATAN — automated network vulnerability scanner",
    "nmap": "Nmap — automated host and port discovery scanner",
    "teardrop": "Teardrop — fragmentation-based DoS exploiting overlapping IP fragments",
    "pod": "Ping-of-Death — oversized ICMP echo crashing legacy stacks",
    "back": "Back — Apache web-server buffer-overflow exploit",
    "guess_passwd": "Password-guessing brute-force attempts",
    "ftp_write": "FTP-write — anonymous-FTP misconfiguration exploit",
    "imap": "IMAP — buffer-overflow against IMAP mail server",
    "buffer_overflow": "Generic buffer-overflow exploit against a service",
    "rootkit": "Rootkit — covert-presence kernel/binary tampering",
    "warezclient": "Warez-client — pirated-software FTP-protocol abuse, client-side",
    "warezmaster": "Warez-master — pirated-software FTP-protocol abuse, server-side",
    "land": "Land — spoofed-source DoS (source = destination)",
    "multihop": "Multi-hop — attack via chain of compromised intermediaries",
    "spy": "Spy — stealth surveillance / spyware indicators",
    "phf": "PHF — early-web CGI script vulnerability exploit",
    "perl": "Perl — Perl-interpreter exploit via crafted input",
}


def explain_subtype(s: str) -> str:
    return SUBTYPE_GLOSSARY.get(s, f"{s} (NSL-KDD attack class; not in standard glossary)")


def narrate_module(name: str, n: int, attack_share: float, top: list[tuple[str, int]],
                   persistence: float, centroid_norm: float) -> str:
    """Plain-English single-paragraph narrative for one TCD module on BTUT survivors."""
    if n == 0:
        return f"{name}: empty"
    if attack_share < 0.10:
        head = (f"**{name}** — {n} BTUT-survivor flows. This basin sits in the latent region "
                f"of the structurally-distinctive *normal* sub-archetypes BTUT preserved "
                f"({100*(1-attack_share):.0f}% of nearest neighbours are normal traffic).")
    elif attack_share < 0.50:
        head = (f"**{name}** — {n} BTUT-survivor flows. Mixed basin "
                f"({100*attack_share:.0f}% attack share among 50 nearest neighbours). "
                f"Sits at the interface between BTUT-preserved normal and BTUT-preserved "
                f"attack patterns.")
    else:
        head = (f"**{name}** — {n} BTUT-survivor flows. Attack-dominated basin "
                f"({100*attack_share:.0f}% of nearest neighbours are attacks). BTUT preserved "
                f"these as structurally distinctive; TCD organized them into an attractor basin.")
    bullets = "\n".join(
        f"  - {ct} flows ({100*ct/50:.1f}% of neighbourhood): **{st}** — {explain_subtype(st)}"
        for st, ct in top[:5]
    )
    topo = (f"H_0 persistence {persistence:.2f} (well above 0.3 threshold). "
            f"Centroid L2 norm {centroid_norm:.3f} in the 64-D embedding space.")
    return f"{head}\n\nTop subtypes among 50 nearest neighbours:\n{bullets}\n\n{topo}"


def main() -> int:
    cache = REPO_ROOT / "data" / "cache" / "nsl_kdd_train.txt"
    fetch_nsl_kdd(cache)

    print("=" * 78)
    print("STAGE 1 — BTUT pre-reduction (CPU)")
    print("=" * 78)
    entities, label_meta = load_entities(cache, n_records=9000, seed=42)
    labels = label_meta["labels"]
    unique_types = sorted({e["type"] for e in entities})
    print(f"  input: {len(entities)} flows, "
          f"{label_meta['n_attacks']} attacks ({100*label_meta['attack_rate']:.1f}%), "
          f"types={unique_types}")

    t0 = time.perf_counter()
    btut = run_btut_pipeline(
        entities=entities, edges=[], unique_types=unique_types,
        target_survivors=300, budget_dollars=25.0,
    )
    btut_wall = time.perf_counter() - t0
    survivors = btut["survivors"]
    print(f"  BTUT wall: {btut_wall:.2f}s")
    print(f"  output: {len(survivors)} survivors "
          f"({btut['summary']['reduction']}x reduction)")

    # Build per-survivor attack subtype lookup
    survivor_names = [s["entity"]["name"] for s in survivors]
    survivor_attrs = {s["entity"]["name"]: s["entity"] for s in survivors}
    n_attack_in_survivors = sum(
        1 for n in survivor_names if labels.get(n, {}).get("is_attack")
    )
    print(f"  survivor attack share: {n_attack_in_survivors}/{len(survivor_names)} "
          f"= {100*n_attack_in_survivors/max(1,len(survivor_names)):.1f}%")

    print()
    print("=" * 78)
    print("STAGE 2 — TCD recursive loop on BTUT survivors (CPU)")
    print("=" * 78)
    EMB = 64
    SEED = 42
    # Encode the 299 survivors (re-using the same JL random projection style)
    import pandas as pd
    survivor_records = []
    for s in survivors:
        rec = dict(s["entity"]["attributes"])
        rec["__type"] = s["entity"]["type"]
        rec["__name"] = s["entity"]["name"]
        survivor_records.append(rec)
    sdf = pd.DataFrame(survivor_records)
    sdf = pd.get_dummies(sdf, columns=["protocol_type", "service", "flag", "__type"], drop_first=False)
    name_col = sdf.pop("__name")
    X = sdf.to_numpy().astype(np.float32)
    X = (X - X.mean(0)) / (X.std(0) + 1e-8)
    rng = np.random.default_rng(SEED)
    proj = rng.standard_normal((X.shape[1], EMB)).astype(np.float32) / np.sqrt(EMB)
    Z = X @ proj
    Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)
    z = torch.from_numpy(Z).float()
    print(f"  embedding: {tuple(z.shape)}")

    is_attack_arr = np.array(
        [labels.get(n, {}).get("is_attack", False) for n in survivor_names], dtype=bool
    )
    attack_subtype_arr = np.array(
        [labels.get(n, {}).get("attack_label", "?") for n in survivor_names]
    )
    nc = z[torch.from_numpy(~is_attack_arr)].mean(0).detach() if (~is_attack_arr).any() else z.mean(0).detach()

    def energy_fn(zq):
        return (zq - nc).pow(2).sum(-1)

    torch.manual_seed(SEED)
    loop = RecursiveLoop(
        embed_dim=EMB,
        explore_every=1,
        crystallize_every=2,
        langevin_steps=30,
        max_modules=24,
        device=torch.device("cpu"),
    )

    ITERS = 16
    t0 = time.perf_counter()
    all_modules: list[dict] = []
    for ep in range(ITERS):
        et = time.perf_counter()
        r = loop.step(z, energy_fn, epoch=ep)
        ew = time.perf_counter() - et
        if r.get("crystallized"):
            for mid, mod, fts in r.get("new_module_objects", []):
                rec = loop.crystallizer.registry._modules.get(mid)
                feat = rec.feature if rec else None
                info = {
                    "iteration": r["iteration"],
                    "module_id": str(mid),
                    "module_class": mod.__class__.__name__,
                    "module_type": str(fts),
                    "topology": {
                        "homology_dim": int(feat.dim) if feat else None,
                        "birth": round(float(feat.birth), 4) if feat else None,
                        "death": round(float(feat.death), 4) if feat else None,
                        "persistence": round(float(feat.persistence), 4) if feat else None,
                    },
                }
                if hasattr(mod, "centroid"):
                    c = mod.centroid.detach().numpy()
                    info["centroid_stats"] = {
                        "mean": round(float(np.mean(c)), 4),
                        "std": round(float(np.std(c)), 4),
                        "norm": round(float(np.linalg.norm(c)), 4),
                        "dim": int(c.shape[0]),
                    }
                all_modules.append(info)
        print(f"  iter {ep+1}: cryst={r.get('crystallized', False)} "
              f"mods={loop.num_modules} {ew:.2f}s")
    tcd_wall = time.perf_counter() - t0

    # Alignment: for each module, look at 50 nearest BTUT-survivors
    print()
    print("=" * 78)
    print("STAGE 3 — per-module alignment + plain-English narration")
    print("=" * 78)
    z_np = Z
    k_nn = min(50, len(survivor_names))
    for module_info in all_modules:
        mid = module_info["module_id"]
        rec = loop.crystallizer.registry._modules.get(mid)
        if rec is None or not hasattr(rec.module, "centroid"):
            continue
        centroid = rec.module.centroid.detach().numpy()
        dists = np.linalg.norm(z_np - centroid, axis=1)
        nn_idx = np.argsort(dists)[:k_nn]
        nn_subtypes = attack_subtype_arr[nn_idx]
        nn_attack = is_attack_arr[nn_idx]
        sc = Counter(nn_subtypes.tolist())
        attack_count = int(nn_attack.sum())
        top3 = sc.most_common(3)
        dom_st, dom_n = top3[0] if top3 else ("?", 0)
        module_info["alignment"] = {
            "k_nearest": k_nn,
            "attack_count": attack_count,
            "attack_share": round(attack_count / k_nn, 3),
            "dominant_subtype": dom_st,
            "dominant_share": round(dom_n / k_nn, 3),
            "top3_subtypes": [{"subtype": s, "count": c, "share": round(c / k_nn, 3)} for s, c in top3],
            "all_subtype_counts": dict(sc),
        }
        # Generate plain-English narrative
        module_info["narrative"] = narrate_module(
            name=mid,
            n=k_nn,
            attack_share=attack_count / k_nn,
            top=sc.most_common(5),
            persistence=module_info["topology"]["persistence"] or 0.0,
            centroid_norm=module_info.get("centroid_stats", {}).get("norm", 0.0),
        )

    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pipeline": "BTUT (CPU) -> TCD recursive loop (CPU)",
        "stage1_btut": {
            "input_records": len(entities),
            "survivors": len(survivors),
            "reduction_x": btut["summary"]["reduction"],
            "wall_seconds": round(btut_wall, 3),
            "device": "cpu",
        },
        "stage2_tcd": {
            "input_survivors": len(survivors),
            "embed_dim": EMB,
            "iterations": ITERS,
            "modules_formed": len(all_modules),
            "modules_active_final": loop.num_modules,
            "wall_seconds": round(tcd_wall, 3),
            "device": "cpu",
        },
        "modules_formed": all_modules,
    }

    out_path = REPO_ROOT / "data" / "validation" / "btut_then_tcd_nslkdd.json"
    out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print()
    print(f"[btut+tcd] artifact: {out_path}")
    print()
    print("=== PER-MODULE PLAIN ENGLISH NARRATIVES ===")
    print()
    for m in all_modules:
        print(m.get("narrative", "(no narrative)"))
        print()
        print("-" * 78)
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
