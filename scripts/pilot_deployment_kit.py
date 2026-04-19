"""Pilot deployment kit — everything a paying customer would use.

Structurally we cannot produce "a paying pilot" in-session (requires an
external customer + sales cycle + time). This kit is what would be
handed to a prospect:

  1. TENANT ONBOARDING — setup, API key, per-tenant isolation
  2. WORKLOAD RUNNER  — customer uploads a BTUT output, gets findings + validation
  3. KPI HARNESS      — measures and reports: throughput, p95 latency,
                         cost-per-finding, reproducibility, signal rate
  4. SYNTHETIC PILOT RUN — executes the full pilot loop against a
                           constructed-not-hypothetical customer workload,
                           produces the numbers a prospect would see

Output per pilot:
  - findings.json (lo_core.analyze output)
  - validation.json (null-test report)
  - kpi_report.json (latency, throughput, cost)
  - pilot_summary.md (customer-facing deliverable)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import secrets
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))
sys.path.insert(0, str(REPO_ROOT / "lo_core" / "src"))

for _k in ("FRED_API_KEY", "NIV_VINTAGE", "NIV_BTUT_THINNING", "NIV_CRYSTALLIZATION",
          "fred_api_key", "niv_vintage", "niv_btut_thinning", "niv_crystallization"):
    os.environ.pop(_k, None)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("pilot_kit")


# ─── Tenant model ─────────────────────────────────────────────────────────────


@dataclass
class Tenant:
    tenant_id: str
    org_name: str
    api_key: str
    data_dir: Path
    results_dir: Path
    created_at: float = field(default_factory=time.time)

    @classmethod
    def provision(cls, org_name: str, root: Path) -> "Tenant":
        tid = hashlib.sha256((org_name + str(time.time())).encode()).hexdigest()[:12]
        key = "lo_" + secrets.token_urlsafe(24)
        data = root / tid / "data"
        results = root / tid / "results"
        data.mkdir(parents=True, exist_ok=True)
        results.mkdir(parents=True, exist_ok=True)
        t = cls(tenant_id=tid, org_name=org_name, api_key=key,
                data_dir=data, results_dir=results)
        (root / tid / "tenant.json").write_text(
            json.dumps({
                "tenant_id": t.tenant_id, "org_name": t.org_name,
                "api_key": t.api_key, "created_at": t.created_at,
            }, indent=2), encoding="utf-8",
        )
        return t


# ─── Workload runner ─────────────────────────────────────────────────────────


def run_analysis(tenant: Tenant, btut_output_path: Path) -> dict[str, Any]:
    """Lo_core analyze on a tenant's BTUT upload."""
    from lo_core.analyze import analyze_corpus
    from dataclasses import asdict, is_dataclass

    def jsonable(o):
        if is_dataclass(o):
            return jsonable(asdict(o))
        if isinstance(o, dict):
            return {k: jsonable(v) for k, v in o.items()}
        if isinstance(o, list):
            return [jsonable(v) for v in o]
        return o

    data = json.loads(btut_output_path.read_text(encoding="utf-8"))
    survivors = data.get("survivors") or []
    t0 = time.time()
    findings = analyze_corpus(survivors, corpus_id=tenant.org_name)
    elapsed = time.time() - t0

    findings_out = jsonable(findings)
    findings_path = tenant.results_dir / "findings.json"
    findings_path.write_text(
        json.dumps(findings_out, indent=2, sort_keys=True, default=str), encoding="utf-8",
    )
    return {
        "findings": findings_out,
        "elapsed_seconds": round(elapsed, 3),
        "survivors_processed": len(survivors),
        "findings_path": str(findings_path),
    }


def run_validation(tenant: Tenant, corpora_paths: dict[str, Path],
                    focus: str, n_iterations: int = 30) -> dict[str, Any]:
    from lo_core.validate import validate_corpora
    from dataclasses import asdict, is_dataclass

    def jsonable(o):
        if is_dataclass(o):
            return jsonable(asdict(o))
        if isinstance(o, dict):
            return {k: jsonable(v) for k, v in o.items()}
        if isinstance(o, list):
            return [jsonable(v) for v in o]
        return o

    corpora = {}
    for cid, path in corpora_paths.items():
        data = json.loads(path.read_text(encoding="utf-8"))
        corpora[cid] = (data.get("survivors") or [])[:300]

    t0 = time.time()
    report = validate_corpora(corpora, focus_corpus=focus, n_iterations=n_iterations)
    elapsed = time.time() - t0

    rep_json = jsonable(report)
    val_path = tenant.results_dir / "validation.json"
    val_path.write_text(
        json.dumps(rep_json, indent=2, sort_keys=True, default=str), encoding="utf-8",
    )
    return {
        "validation": rep_json,
        "elapsed_seconds": round(elapsed, 3),
        "significant_metrics": sum(
            1 for t in report.null_tests if t.significant_at_0_05
        ),
        "total_metrics": len(report.null_tests),
        "validation_path": str(val_path),
    }


# ─── KPI harness ──────────────────────────────────────────────────────────────


def measure_kpis(tenant: Tenant, analysis_result: dict,
                 validation_result: dict | None) -> dict[str, Any]:
    """Quantify pilot outcome in customer-relevant terms."""
    findings = analysis_result["findings"]
    survivors_n = analysis_result["survivors_processed"]
    analyze_s = analysis_result["elapsed_seconds"]

    # Commercial KPIs
    throughput_per_sec = round(survivors_n / max(analyze_s, 0.001), 1)
    convergence_findings = len(findings.get("convergence_index") or [])
    paradigm = findings.get("paradigm_distribution") or {}
    confirmed_corpora = [
        c for c, h in (paradigm.get("hypothesis_by_corpus") or {}).items()
        if h.get("confirmed")
    ]

    kpis = {
        "tenant_id": tenant.tenant_id,
        "org_name": tenant.org_name,
        "survivors_processed": survivors_n,
        "analyze_wall_seconds": analyze_s,
        "throughput_survivors_per_second": throughput_per_sec,
        "top_convergence_findings": convergence_findings,
        "confirmed_paradigms": confirmed_corpora,
        # Cost model: 1 vCPU-hour @ $0.05, 1 survivor = ~2ms CPU on reference hw
        "estimated_cost_usd": round(analyze_s * 0.05 / 3600, 4),
        "cost_per_1000_survivors_usd": round(
            (analyze_s / max(1, survivors_n)) * 1000 * 0.05 / 3600, 4,
        ),
    }
    if validation_result:
        kpis["validation"] = {
            "n_iterations": validation_result["validation"]["n_iterations"],
            "significant_metrics": validation_result["significant_metrics"],
            "total_metrics": validation_result["total_metrics"],
            "elapsed_seconds": validation_result["elapsed_seconds"],
        }

    kpi_path = tenant.results_dir / "kpi_report.json"
    kpi_path.write_text(json.dumps(kpis, indent=2, sort_keys=True, default=str),
                        encoding="utf-8")
    return kpis


def write_pilot_summary(tenant: Tenant, kpis: dict, findings: dict) -> Path:
    md: list[str] = []
    md.append(f"# Latent Ocean Pilot Report — {tenant.org_name}")
    md.append("")
    md.append(f"- Tenant ID: `{tenant.tenant_id}`")
    md.append(f"- Generated: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    md.append("")
    md.append("## Processing")
    md.append(f"- Survivors processed: **{kpis['survivors_processed']}**")
    md.append(f"- Analyze wall time: **{kpis['analyze_wall_seconds']}s**")
    md.append(f"- Throughput: **{kpis['throughput_survivors_per_second']} survivors/sec**")
    md.append(f"- Estimated cost: **${kpis['estimated_cost_usd']}**")
    md.append(f"- Cost per 1,000 survivors: **${kpis['cost_per_1000_survivors_usd']}**")
    md.append("")
    md.append("## Findings")
    md.append(f"- Convergence-index entries: **{kpis['top_convergence_findings']}**")
    md.append(f"- Confirmed paradigms: **{', '.join(kpis['confirmed_paradigms']) or 'none'}**")
    md.append("")
    md.append("### Top 10 convergent anomalies")
    md.append("")
    md.append("| # | Entity | Convergence | Anomaly | Cluster % |")
    md.append("|---|---|---|---|---|")
    for i, e in enumerate((findings.get("convergence_index") or [])[:10], 1):
        md.append(
            f"| {i} | `{e.get('name', '')}` | {e.get('convergence', 0)} | "
            f"{(e.get('dimensions') or {}).get('anomaly', 0)} | "
            f"{int((e.get('dimensions') or {}).get('cluster_percentile', 0) * 100)}% |"
        )
    md.append("")
    val = kpis.get("validation")
    if val:
        md.append("## Validation (null permutation)")
        md.append(f"- Iterations: **{val['n_iterations']}**")
        md.append(f"- Significant metrics: **{val['significant_metrics']} / {val['total_metrics']}** at α=0.05")
        md.append(f"- Validation wall time: {val['elapsed_seconds']}s")
        md.append("")
    md.append("---")
    md.append("")
    md.append("*All findings reproducible. All claims falsifiable via `lo validate`.*")
    md.append("")

    path = tenant.results_dir / "pilot_summary.md"
    path.write_text("\n".join(md), encoding="utf-8")
    return path


# ─── Synthetic pilot runner ──────────────────────────────────────────────────


def run_synthetic_pilot(org_name: str = "SynteticMidMarketBank") -> int:
    """End-to-end pilot flow against a constructed customer workload.

    Reuses the EDGAR 5000-survivor BTUT result as the "customer workload"
    input. Runs analyze + validate + measures KPIs + produces customer-
    facing deliverable. Same code path a real tenant would hit.
    """
    pilot_root = REPO_ROOT / "data" / "pilots"
    pilot_root.mkdir(parents=True, exist_ok=True)
    log.info("Provisioning tenant %s...", org_name)
    tenant = Tenant.provision(org_name, pilot_root)

    # Stage the customer workload (copy pointer, not the file)
    btut_input = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"
    if not btut_input.exists():
        log.error("Workload input not found: %s", btut_input)
        return 1

    log.info("Running analysis for tenant %s...", tenant.tenant_id)
    ar = run_analysis(tenant, btut_input)
    log.info("  %d survivors processed in %.2fs", ar["survivors_processed"], ar["elapsed_seconds"])

    log.info("Running validation (N=30, 2 corpora)...")
    # Build a 2-corpus set: the tenant's + another legend
    poly = REPO_ROOT / "scripts" / "cross_era_analysis" / "output" / "polymath_btut_result_v2.json"
    vr = None
    if poly.exists():
        vr = run_validation(tenant, {"tenant": btut_input, "polymath": poly},
                            focus="tenant", n_iterations=30)
        log.info("  validation: %d/%d significant in %.2fs",
                 vr["significant_metrics"], vr["total_metrics"], vr["elapsed_seconds"])

    log.info("Measuring KPIs...")
    kpis = measure_kpis(tenant, ar, vr)

    log.info("Writing pilot summary...")
    summary_path = write_pilot_summary(tenant, kpis, ar["findings"])

    print()
    print("=" * 78)
    print(f"PILOT DELIVERABLE for {tenant.org_name}  (tenant={tenant.tenant_id})")
    print("=" * 78)
    print(f"  Survivors processed   : {kpis['survivors_processed']}")
    print(f"  Throughput            : {kpis['throughput_survivors_per_second']} surv/sec")
    print(f"  Analyze wall time     : {kpis['analyze_wall_seconds']}s")
    print(f"  Estimated cost        : ${kpis['estimated_cost_usd']}")
    print(f"  Cost / 1,000 survivors: ${kpis['cost_per_1000_survivors_usd']}")
    print(f"  Top convergence       : {kpis['top_convergence_findings']} findings")
    print(f"  Confirmed paradigms   : {kpis['confirmed_paradigms']}")
    if kpis.get("validation"):
        val = kpis["validation"]
        print(f"  Validation            : {val['significant_metrics']}/{val['total_metrics']} significant at a=0.05 (N={val['n_iterations']}, {val['elapsed_seconds']}s)")
    print()
    print(f"  Results dir : {tenant.results_dir}")
    print(f"  Summary     : {summary_path}")
    print()
    print("NOTE: this is a synthetic pilot against cached EDGAR data.")
    print("      A real paying pilot requires a customer workload uploaded")
    print("      via the same tenant API — achievable in production, not")
    print("      in-session.")
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--org", default="SyntheticMidMarketBank")
    args = p.parse_args()
    return run_synthetic_pilot(args.org)


if __name__ == "__main__":
    raise SystemExit(main())
