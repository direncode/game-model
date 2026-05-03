"""SPU performance simulator.

Pulls real numbers from our actual TNA + NSL-KDD pipeline runs and
projects them onto the SPU microarchitecture via per-unit throughput
models. Emits a side-by-side comparison of CPU, GPU, and SPU on
the same workload.

Wall times for CPU are *measured* (from runs we did this session).
GPU wall times are *modeled* using published H100 / A100 throughputs
for matmul + a memory-bound penalty for the irregular ops.
SPU wall times are *modeled* from §3 of docs/SPU_ARCHITECTURE.md.

Output is a Markdown report. Run:

    python scripts/spu/simulator.py --workload tna --report
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path


# ── SPU architectural parameters (from spec §3) ────────────────────────

class SPUArch:
    HASH_RATE_HZ           = 4_000_000_000    # 4 G hashes/sec aggregate
    SBMU_BIT_OPS_PER_S     = 16.4e12          # 16.4 TB/s of bit ops
    CAM_LOOKUPS_PER_S      = 16_000_000_000   # 16 G/s aggregate (16 ports)
    SGE_BANDWIDTH_GBPS     = 256              # Scatter-gather engines, 256 GB/s
    MMU_TOPS_INT8          = 8_000_000_000_000   # 8 TOPS
    MMU_TFLOPS_FP16        = 4_000_000_000_000
    L1_SRAM_BANDWIDTH_GBPS = 4096             # 4 TB/s aggregate
    HBM_BANDWIDTH_GBPS     = 256
    PCIE_BANDWIDTH_GBPS    = 64
    POWER_W                = 20
    L1_SRAM_BYTES          = 64 * 1024 * 1024  # 64 MB on-die


# ── Reference architectures for comparison ──────────────────────────────

class CPUArch:
    """Conservative model of a single Xeon Platinum / EPYC core."""
    HASH_RATE_HZ           = 250_000_000      # ~250 M hashes/sec/core (SHA-NI accelerated)
    POWER_W                = 100              # whole-CPU, since the workload uses many threads
    NAME                   = "32-core Xeon (whole CPU)"


class GPUArch:
    """NVIDIA H100 SXM model."""
    MMU_TFLOPS_FP16        = 989e12           # H100 fp16 with sparsity: 1979 TFLOPS, dense: 989
    HBM_BANDWIDTH_GBPS     = 3350
    POWER_W                = 700
    # GPU performance on irregular ops degrades to ~1-5% of peak.
    IRREGULAR_EFFICIENCY   = 0.03
    NAME                   = "NVIDIA H100 (700 W)"


# ── Workload definitions — measured from real OCEAN runs ───────────────

@dataclass
class WorkloadOp:
    name:           str
    n_records:      int
    op_count:       int           # primary unit of work (hashes, MACs, bit-ops...)
    op_kind:        str           # 'hash' | 'sbmu' | 'cam' | 'sge' | 'mmu' | 'rli'
    bytes_touched:  int           # bytes of memory traffic
    cpu_wall_s:     float         # measured on CPU
    note:           str = ""


def workload_tna_500() -> list[WorkloadOp]:
    """The TNA pipeline at 500 records, as we ran it. Measured wall times
    from data/validation/tna_btut_then_tcd.json + later .json runs."""
    return [
        WorkloadOp(name="source.ndjson",
                   n_records=500, op_count=500,
                   op_kind="sge", bytes_touched=2_000_000,
                   cpu_wall_s=0.04,
                   note="NDJSON load + stratified sample"),
        WorkloadOp(name="embed.tfidf_jl",
                   n_records=500, op_count=500_000,
                   op_kind="hash", bytes_touched=10_000_000,
                   cpu_wall_s=1.4,
                   note="TF-IDF vocab build + JL projection (500 × 128)"),
        WorkloadOp(name="cluster.tcd_recursive_loop",
                   n_records=500, op_count=500 * 500 * 16,  # pairwise × iters
                   op_kind="sge", bytes_touched=4_000_000_000,  # 4 GB of pair traffic
                   cpu_wall_s=113.0,
                   note="16-iter TCD recursive loop, 500 × 500 pair distances per iter"),
        WorkloadOp(name="align.module",
                   n_records=500, op_count=500 * 14,  # records × modules
                   op_kind="cam", bytes_touched=500_000,
                   cpu_wall_s=0.01,
                   note="50-NN per module × 14 modules"),
        WorkloadOp(name="align.dispersion",
                   n_records=500, op_count=500 * 14,
                   op_kind="cam", bytes_touched=500_000,
                   cpu_wall_s=0.006,
                   note="Each record's nearest module assignment"),
        WorkloadOp(name="persist.json",
                   n_records=500, op_count=1,
                   op_kind="sge", bytes_touched=200_000,
                   cpu_wall_s=0.014,
                   note="JSON serialize + write"),
    ]


def workload_tna_2169() -> list[WorkloadOp]:
    """Full TNA corpus. Measured from data/validation/tna_dispersion_full_seed42.json."""
    return [
        WorkloadOp(name="source.ndjson",
                   n_records=2169, op_count=2169,
                   op_kind="sge", bytes_touched=10_000_000,
                   cpu_wall_s=0.05),
        WorkloadOp(name="embed.tfidf_jl",
                   n_records=2169, op_count=2_500_000,
                   op_kind="hash", bytes_touched=50_000_000,
                   cpu_wall_s=2.0),
        WorkloadOp(name="cluster.tcd_recursive_loop",
                   n_records=2169, op_count=2169 * 2169 * 14,
                   op_kind="sge", bytes_touched=80_000_000_000,
                   cpu_wall_s=85.0,
                   note="At full scale, runs went 80-110s; using 85s representative"),
        WorkloadOp(name="align.module",
                   n_records=2169, op_count=2169 * 12,
                   op_kind="cam", bytes_touched=2_500_000,
                   cpu_wall_s=0.05),
        WorkloadOp(name="align.dispersion",
                   n_records=2169, op_count=2169 * 12,
                   op_kind="cam", bytes_touched=2_500_000,
                   cpu_wall_s=0.04),
        WorkloadOp(name="persist.json",
                   n_records=2169, op_count=1,
                   op_kind="sge", bytes_touched=500_000,
                   cpu_wall_s=0.05),
    ]


def workload_nslkdd_9000() -> list[WorkloadOp]:
    """NSL-KDD intrusion pipeline at 9000 records. Measured from
    data/validation/btut_then_tcd_nslkdd.json (CPU run that produced 15 modules)."""
    return [
        WorkloadOp(name="source.csv",
                   n_records=9000, op_count=9000,
                   op_kind="sge", bytes_touched=20_000_000,
                   cpu_wall_s=0.5),
        WorkloadOp(name="reduce.btut",
                   n_records=9000, op_count=9000 * 8,  # 8-tier BTUT
                   op_kind="hash", bytes_touched=100_000_000,
                   cpu_wall_s=7.9,
                   note="BTUT 9000 → 299 survivors, 8-tier structural fingerprint"),
        WorkloadOp(name="cluster.tcd_recursive_loop",
                   n_records=299, op_count=299 * 299 * 16,
                   op_kind="sge", bytes_touched=10_000_000,
                   cpu_wall_s=84.6,
                   note="TCD on the 299 BTUT survivors"),
        WorkloadOp(name="align.module",
                   n_records=299, op_count=299 * 15,
                   op_kind="cam", bytes_touched=200_000,
                   cpu_wall_s=0.01),
    ]


# ── Performance models ─────────────────────────────────────────────────

def spu_wall_seconds(op: WorkloadOp) -> float:
    """Model SPU wall time given the op's primary work and memory footprint."""
    if op.op_kind == "hash":
        compute_s = op.op_count / SPUArch.HASH_RATE_HZ
    elif op.op_kind == "sbmu":
        compute_s = op.op_count / SPUArch.SBMU_BIT_OPS_PER_S
    elif op.op_kind == "cam":
        compute_s = op.op_count / SPUArch.CAM_LOOKUPS_PER_S
    elif op.op_kind == "sge":
        # Memory-bound; throughput governed by SGE/HBM bandwidth.
        compute_s = op.bytes_touched / (SPUArch.SGE_BANDWIDTH_GBPS * 1e9)
    elif op.op_kind == "mmu":
        compute_s = op.op_count / SPUArch.MMU_TOPS_INT8
    elif op.op_kind == "rli":
        compute_s = op.op_count * 7e-9  # 7 ns worst-case
    else:
        compute_s = 0.0

    # Memory traffic ceiling: an op can't run faster than its bytes through L1 SRAM
    if op.bytes_touched > 0:
        mem_floor_s = op.bytes_touched / (SPUArch.L1_SRAM_BANDWIDTH_GBPS * 1e9)
    else:
        mem_floor_s = 0.0

    # Add a fixed dispatch + interconnect overhead — 1 µs per op is generous
    overhead_s = 1e-6

    return max(compute_s, mem_floor_s) + overhead_s


def gpu_wall_seconds(op: WorkloadOp) -> float:
    """Model GPU wall time. GPU is good at dense matmul, bad at the rest."""
    if op.op_kind == "mmu":
        # Dense matmul — use H100 fp16 throughput
        return op.op_count / GPUArch.MMU_TFLOPS_FP16
    if op.op_kind == "sge":
        # Irregular memory access — GPU runs at 1-5% efficiency
        eff_bw = GPUArch.HBM_BANDWIDTH_GBPS * 1e9 * GPUArch.IRREGULAR_EFFICIENCY
        return op.bytes_touched / eff_bw
    if op.op_kind == "hash":
        # GPU does have hash kernels but they're branchy; ~10% of theoretical
        # H100 has ~14 G hash/s peak via cooperative-groups, but ~1.4 G in practice
        return op.op_count / 1.4e9
    if op.op_kind == "cam":
        # No CAM on GPU — emulate with hash table at ~100 ns/lookup
        return op.op_count * 100e-9
    if op.op_kind == "sbmu":
        # GPU bit ops via warp shuffles — ~20% of SPU SBMU
        return op.op_count / (SPUArch.SBMU_BIT_OPS_PER_S * 0.2)
    return 0.0


# ── Power and energy ──────────────────────────────────────────────────

def joules(wall_s: float, watts: float) -> float:
    return wall_s * watts


# ── Simulation runner ─────────────────────────────────────────────────

def simulate(workload: list[WorkloadOp]) -> dict:
    """Run the simulation. Returns a dict suitable for JSON / Markdown."""
    rows = []
    cpu_total_s = 0.0
    gpu_total_s = 0.0
    spu_total_s = 0.0
    for op in workload:
        cpu_s = op.cpu_wall_s
        gpu_s = gpu_wall_seconds(op)
        spu_s = spu_wall_seconds(op)
        rows.append({
            "operator":      op.name,
            "n_records":     op.n_records,
            "op_count":      op.op_count,
            "op_kind":       op.op_kind,
            "bytes":         op.bytes_touched,
            "cpu_wall_s":    cpu_s,
            "gpu_wall_s":    gpu_s,
            "spu_wall_s":    spu_s,
            "cpu_vs_spu_x":  cpu_s / max(spu_s, 1e-9),
            "gpu_vs_spu_x":  gpu_s / max(spu_s, 1e-9),
            "note":          op.note,
        })
        cpu_total_s += cpu_s
        gpu_total_s += gpu_s
        spu_total_s += spu_s

    return {
        "rows":            rows,
        "cpu_total_s":     cpu_total_s,
        "gpu_total_s":     gpu_total_s,
        "spu_total_s":     spu_total_s,
        "cpu_total_J":     joules(cpu_total_s, CPUArch.POWER_W),
        "gpu_total_J":     joules(gpu_total_s, GPUArch.POWER_W),
        "spu_total_J":     joules(spu_total_s, SPUArch.POWER_W),
        "speedup_cpu":     cpu_total_s / max(spu_total_s, 1e-9),
        "speedup_gpu":     gpu_total_s / max(spu_total_s, 1e-9),
        "energy_ratio_cpu": joules(cpu_total_s, CPUArch.POWER_W) / max(joules(spu_total_s, SPUArch.POWER_W), 1e-9),
        "energy_ratio_gpu": joules(gpu_total_s, GPUArch.POWER_W) / max(joules(spu_total_s, SPUArch.POWER_W), 1e-9),
    }


# ── Pricing models — back-of-envelope cloud cost per pipeline run ─────

# Public list prices, USD/hour, 2026
AWS_C7I_8XLARGE_PER_HR = 1.71      # 32 vCPU, 64 GB RAM
AWS_P5_H100_PER_HR     = 98.0      # 1× H100, 80 GB HBM
SPU_TARGET_PER_HR      = 0.50      # speculative — what we'd price a hosted SPU at


def cost_per_run(seconds: float, dollars_per_hour: float) -> float:
    return seconds / 3600 * dollars_per_hour


# ── Markdown report ───────────────────────────────────────────────────

def to_markdown(result: dict, workload_name: str) -> str:
    lines = [
        f"# SPU simulation report — workload: {workload_name}",
        "",
        "## Per-operator breakdown",
        "",
        "| Operator | N | Op count | Kind | CPU wall | GPU wall | SPU wall | CPU/SPU | GPU/SPU |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for r in result["rows"]:
        lines.append(
            f"| `{r['operator']}` | {r['n_records']:,} | {r['op_count']:,} | "
            f"{r['op_kind']} | {_fmt_s(r['cpu_wall_s'])} | {_fmt_s(r['gpu_wall_s'])} | "
            f"{_fmt_s(r['spu_wall_s'])} | {r['cpu_vs_spu_x']:,.0f}× | {r['gpu_vs_spu_x']:,.0f}× |"
        )

    cpu_s = result["cpu_total_s"]
    gpu_s = result["gpu_total_s"]
    spu_s = result["spu_total_s"]

    lines += [
        "",
        "## Pipeline totals",
        "",
        "| Metric | CPU (32-core Xeon) | GPU (H100, 700 W) | SPU (20 W) |",
        "|---|---|---|---|",
        f"| Wall time | {_fmt_s(cpu_s)} | {_fmt_s(gpu_s)} | {_fmt_s(spu_s)} |",
        f"| Energy per run | {_fmt_J(result['cpu_total_J'])} | {_fmt_J(result['gpu_total_J'])} | {_fmt_J(result['spu_total_J'])} |",
        f"| Speedup vs SPU | 1× | {gpu_s/cpu_s:.2f}× | — |",
        f"| Speedup of SPU vs each | **{result['speedup_cpu']:,.0f}×** | **{result['speedup_gpu']:,.0f}×** | 1× |",
        f"| Energy efficiency vs SPU | 1× | {result['gpu_total_J']/result['cpu_total_J']:.2f}× | — |",
        f"| **Energy efficiency of SPU** | **{result['energy_ratio_cpu']:,.0f}× better** | **{result['energy_ratio_gpu']:,.0f}× better** | 1× |",
        "",
        "## Cloud-cost model (USD per pipeline run)",
        "",
        "| Platform | Wall time | $/hour | $ per run |",
        "|---|---|---|---|",
        f"| AWS c7i.8xlarge (CPU) | {_fmt_s(cpu_s)} | ${AWS_C7I_8XLARGE_PER_HR:.2f} | ${cost_per_run(cpu_s, AWS_C7I_8XLARGE_PER_HR):.4f} |",
        f"| AWS p5 (1× H100)      | {_fmt_s(gpu_s)} | ${AWS_P5_H100_PER_HR:.2f}     | ${cost_per_run(gpu_s, AWS_P5_H100_PER_HR):.4f} |",
        f"| SPU (hosted, target)  | {_fmt_s(spu_s)} | ${SPU_TARGET_PER_HR:.2f}     | ${cost_per_run(spu_s, SPU_TARGET_PER_HR):.6f} |",
        "",
        "## Throughput at scale",
        "",
        f"- A single SPU runs **{1/spu_s:,.0f} pipelines/sec** on this workload.",
        f"- At 20 W each, a 1 kW power budget = 50 SPUs = **{50/spu_s:,.0f} pipelines/sec**.",
        f"- That same 1 kW on H100 = ~1.4 H100s = **{1.4/gpu_s:,.0f} pipelines/sec**.",
        f"- Throughput-per-watt advantage of SPU: **{result['energy_ratio_gpu']:,.0f}×** over GPU.",
        "",
        "## Caveats",
        "",
        "- CPU wall times are MEASURED from real runs in `data/validation/`.",
        "- GPU wall times are MODELED using H100 published throughputs + a memory-bound penalty for irregular ops (3% of peak HBM bandwidth on scatter-gather).",
        "- SPU wall times are MODELED from per-unit throughputs in §3 of `docs/SPU_ARCHITECTURE.md`. Treat as upper bounds modulo memory contention and thermal effects.",
        "- The SPU wins because the workload is dominated by scatter-gather + hashing + CAM lookups, all of which it has dedicated silicon for.",
    ]
    return "\n".join(lines)


def _fmt_s(seconds: float) -> str:
    if seconds < 1e-6:
        return f"{seconds*1e9:.2f} ns"
    if seconds < 1e-3:
        return f"{seconds*1e6:.2f} µs"
    if seconds < 1:
        return f"{seconds*1e3:.2f} ms"
    return f"{seconds:.2f} s"


def _fmt_J(joules: float) -> str:
    if joules < 1e-3:
        return f"{joules*1e6:.2f} µJ"
    if joules < 1:
        return f"{joules*1e3:.2f} mJ"
    return f"{joules:,.2f} J"


# ── Main ──────────────────────────────────────────────────────────────

WORKLOADS = {
    "tna":         (workload_tna_500,    "TNA HW catalogue, 500 records"),
    "tna_full":    (workload_tna_2169,   "TNA HW catalogue, 2169 records"),
    "nslkdd":      (workload_nslkdd_9000,"NSL-KDD intrusion, 9000 flows"),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workload", choices=list(WORKLOADS.keys()), default="tna")
    ap.add_argument("--report", action="store_true",
                    help="Emit a Markdown report instead of JSON")
    ap.add_argument("--output", type=Path,
                    help="Write to this file (default stdout)")
    args = ap.parse_args()

    fn, name = WORKLOADS[args.workload]
    result = simulate(fn())

    if args.report:
        text = to_markdown(result, name)
    else:
        text = json.dumps(result, indent=2, default=str)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
        print(f"wrote {args.output}")
    else:
        print(text)


if __name__ == "__main__":
    main()
