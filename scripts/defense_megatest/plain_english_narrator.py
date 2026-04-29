"""Plain-English narrator for TCD-JEPA / RunPod module results.

Reads `data/validation/runpod_tcd_mammoth_raw.json` (the RunPod /status
response for the 9k-record GPU run) and produces:
  1. A markdown table of modules with attack-subtype distributions
  2. A plain-English paragraph per module
  3. A reproducibility-preserving JSON summary at
     `data/validation/runpod_tcd_mammoth_summary.json`

Honest scope: the per-module *purity_score* and *internal_density* values
come from the production handler's simulation fallback (the handler did
not surface real TCD-JEPA crystallizer output in this code path). Cluster
membership and attack-subtype counts ARE real, computed from the actual
NSL-KDD ground-truth labels carried in via the entity attributes.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts" / "defense_megatest"))


# Plain-English glossary for NSL-KDD attack subtypes
SUBTYPE_GLOSSARY = {
    "normal": "normal background traffic, no attack signature",
    "neptune": "Neptune — SYN-flood denial-of-service that opens half-complete TCP connections to exhaust server resources",
    "smurf": "Smurf — ICMP-amplified DDoS using broadcast addresses to overwhelm the target",
    "ipsweep": "IP-sweep — reconnaissance scan probing a range of IP addresses to find live hosts",
    "portsweep": "Port-sweep — reconnaissance scan probing many ports on a single host",
    "satan": "SATAN — automated network vulnerability scanner",
    "nmap": "Nmap — automated host and port discovery scanner",
    "teardrop": "Teardrop — fragmentation-based DoS exploiting overlapping IP fragment offsets",
    "pod": "Ping-of-Death — oversized ICMP echo request crashing legacy stacks",
    "back": "Back — Apache web-server buffer-overflow exploit",
    "guess_passwd": "Password guessing — brute-force login attempts against a service",
    "ftp_write": "FTP-write — anonymous-FTP misconfiguration exploit",
    "imap": "IMAP exploit — buffer-overflow against IMAP mail server",
    "buffer_overflow": "Buffer-overflow — generic stack-overrun exploit against a network service",
    "rootkit": "Rootkit — covert-presence indicators (kernel-module or binary tampering)",
    "warezclient": "Warez client — pirated-software sharing, FTP-protocol abuse from the client side",
    "warezmaster": "Warez master — pirated-software sharing, FTP-server-side abuse",
    "land": "Land attack — spoofed-source DoS where source and destination are identical",
    "multihop": "Multi-hop — attack staged through a chain of compromised intermediaries",
    "spy": "Spy — stealth surveillance / spyware-installation indicators",
    "phf": "PHF — early-web CGI script vulnerability exploit",
    "perl": "Perl — Perl-interpreter exploit via crafted input",
}

PROTOCOL_PLAIN = {
    "tcp": "TCP traffic — reliable connection-oriented flows (web, mail, SSH, file transfer, etc.)",
    "udp": "UDP traffic — connectionless datagrams (DNS, NTP, streaming, IoT telemetry, etc.)",
    "icmp": "ICMP traffic — control-plane messages (ping, traceroute, error reports — and several DDoS / scanning protocols hide in here)",
}


def explain_subtype(s: str) -> str:
    return SUBTYPE_GLOSSARY.get(s, f"{s} (NSL-KDD attack class; detail not in standard glossary)")


def explain_protocol(p: str) -> str:
    return PROTOCOL_PLAIN.get(p, f"{p} traffic")


def narrate_module(
    name: str,
    dominant_type: str,
    n_total: int,
    attack_count: int,
    subtype_counts: Counter,
    purity_score: float | None,
    internal_density: float | None,
    purity_is_real: bool,
) -> str:
    """One paragraph in plain English describing this cluster."""
    attack_share = attack_count / max(1, n_total)
    top = subtype_counts.most_common(5)
    proto_explain = explain_protocol(dominant_type)

    # Headline sentence
    if attack_share < 0.10:
        headline = (
            f"{name}: {n_total:,} {dominant_type.upper()} flows. "
            f"This cluster is mostly normal {dominant_type.upper()} background traffic "
            f"({100 * (1 - attack_share):.1f}% benign)."
        )
    elif attack_share < 0.50:
        headline = (
            f"{name}: {n_total:,} {dominant_type.upper()} flows. "
            f"This is a mixed cluster — roughly half normal, half attack "
            f"({100 * attack_share:.1f}% of flows are attacks)."
        )
    else:
        headline = (
            f"{name}: {n_total:,} {dominant_type.upper()} flows. "
            f"This cluster is dominated by attacks "
            f"({100 * attack_share:.1f}% of flows are attacks vs only "
            f"{100 * (1 - attack_share):.1f}% normal)."
        )

    proto_para = f"What is {dominant_type.upper()}? {proto_explain}."

    # Subtype breakdown
    if not top:
        subtype_para = "No subtype information available for this cluster."
    else:
        bullets = []
        for st, ct in top:
            share = 100 * ct / n_total
            bullets.append(f"  - {ct:,} flows ({share:.1f}%): **{st}** — {explain_subtype(st)}")
        subtype_para = "Top attack-subtype breakdown in this cluster:\n" + "\n".join(bullets)

    # Density / purity caveat
    if purity_is_real:
        density_para = (
            f"Internal density {internal_density:.3f}, purity {purity_score:.3f} — "
            f"these are real measurements from TCD-JEPA's module crystallizer."
        )
    else:
        density_para = (
            f"*Note on purity ({purity_score}) and internal density ({internal_density}): "
            f"these specific numbers come from the production handler's simulation-fallback "
            f"path because real TCD crystallizer output was not surfaced in this code path. "
            f"The cluster membership and attack-subtype counts above ARE real (computed from "
            f"ground-truth NSL-KDD labels). The handler-side density / purity values are not.*"
        )

    # Closing analyst-relevant sentence
    if attack_share >= 0.50:
        close = (
            f"**Analyst takeaway:** this cluster is the high-attack-density basin for "
            f"{dominant_type.upper()} flows in this corpus. An operator drilling into "
            f"{name} immediately surfaces {sum(c for s, c in top if s != 'normal'):,} "
            f"attack flows across "
            f"{len([s for s in subtype_counts if s != 'normal'])} distinct attack archetypes."
        )
    elif attack_share >= 0.30:
        close = (
            f"**Analyst takeaway:** mixed-traffic basin. Worth monitoring — the attack "
            f"subtypes mixed in here ({', '.join(s for s, _ in top[:3] if s != 'normal')}) "
            f"are typical co-occurrences with normal {dominant_type.upper()} traffic and "
            f"may indicate reconnaissance or low-rate probing among legitimate flows."
        )
    else:
        close = (
            f"**Analyst takeaway:** this is the legitimate-traffic basin for "
            f"{dominant_type.upper()}. Confirms the corpus has a stable normal-traffic "
            f"signature on this protocol — useful as a reference background against which "
            f"future shifts can be measured."
        )

    return "\n\n".join([headline, proto_explain, subtype_para, density_para, close])


def main() -> int:
    raw_path = REPO_ROOT / "data" / "validation" / "runpod_tcd_mammoth_raw.json"
    if not raw_path.exists():
        print(f"ERROR: {raw_path} not found", file=sys.stderr)
        return 2

    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    final = raw["output"][-1]
    modules = final.get("modules") or []

    # Re-derive labels using the same submission seed/n_records
    from runpod_submit import fetch_nsl_kdd, load_entities  # type: ignore
    cache = REPO_ROOT / "data" / "cache" / "nsl_kdd_train.txt"
    fetch_nsl_kdd(cache)
    entities, label_meta = load_entities(cache, n_records=9000, seed=42)
    labels = label_meta["labels"]

    summary: dict[str, Any] = {
        "source_artifact": "data/validation/runpod_tcd_mammoth_raw.json",
        "runpod_job_id": raw.get("id"),
        "worker_id": raw.get("workerId"),
        "device": final.get("device"),
        "delay_ms": raw.get("delayTime"),
        "exec_ms": raw.get("executionTime"),
        "training_metrics": {
            "final_auc": final.get("final_auc"),
            "final_knn": final.get("final_knn"),
            "final_loss": final.get("final_loss"),
            "total_epochs": final.get("total_epochs"),
        },
        "honesty_note": (
            "Per-module purity_score and internal_density values are simulation-"
            "fallback random outputs from the production handler (see "
            "runpod/handler.py:_extract_modules lines 397-460). Cluster "
            "membership and attack-subtype counts ARE real from ground-truth "
            "NSL-KDD labels. Training metrics (AUC, KNN, loss) above are real "
            "H100 training output."
        ),
        "modules": [],
    }

    narratives: list[str] = []
    for m in modules:
        name = m["name"]
        dom = m["dominant_type"]
        ents = m.get("entities") or []
        subtype_counts: Counter = Counter()
        n_attack = 0
        for e in ents:
            ent_name = e.get("name") if isinstance(e, dict) else e
            lab = labels.get(ent_name)
            if not lab:
                continue
            if lab.get("is_attack"):
                n_attack += 1
            subtype_counts[lab.get("attack_label", "?")] += 1

        n_total = m.get("entity_count", len(ents))
        purity = m.get("purity_score")
        density = m.get("internal_density")
        narrative = narrate_module(
            name=name,
            dominant_type=dom,
            n_total=n_total,
            attack_count=n_attack,
            subtype_counts=subtype_counts,
            purity_score=purity,
            internal_density=density,
            purity_is_real=False,  # determined from handler-source inspection
        )
        narratives.append(narrative)
        summary["modules"].append({
            "name": name,
            "dominant_type": dom,
            "entity_count": n_total,
            "attack_count": n_attack,
            "attack_share": round(n_attack / max(1, n_total), 4),
            "subtype_counts": dict(subtype_counts.most_common()),
            "purity_score_handler_simulation": purity,
            "internal_density_handler_simulation": density,
            "narrative_plain_english": narrative,
        })

    summary["aggregate_attack_subtypes"] = dict(
        Counter({s: sum(m["subtype_counts"].get(s, 0) for m in summary["modules"])
                 for m in summary["modules"] for s in m["subtype_counts"]}).most_common()
    )

    out_path = REPO_ROOT / "data" / "validation" / "runpod_tcd_mammoth_summary.json"
    out_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")

    print("=" * 78)
    print("PLAIN-ENGLISH MODULE NARRATIVES")
    print("=" * 78)
    print()
    print(f"GPU run: {summary['runpod_job_id']}")
    print(f"Device: {summary['device']}, worker {summary['worker_id']}")
    m = summary["training_metrics"]
    print(f"Training (real H100 output): AUC {m['final_auc']:.4f}, "
          f"kNN {m['final_knn']:.4f}, loss {m['final_loss']:.4f}, "
          f"epochs {m['total_epochs']}")
    print()
    for nar in narratives:
        print(nar)
        print()
        print("-" * 78)
        print()

    print(f"Summary written to: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
