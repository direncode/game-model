"""
Aggregate the overnight substrate campaign results into a phase diagram +
publishable text tables.

Reads:
    data/validation/overnight/<phase>_<test_id>.json
    data/validation/overnight_summary_<date>.json

Writes:
    docs/commercial/SUBSTRATE_PHASE_DIAGRAM.md  (publishable writeup)
    Markdown tables per phase + headline + boundary findings.
"""
from __future__ import annotations

import glob
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean, stdev


def load_results():
    files = sorted(glob.glob("data/validation/overnight/*.json"))
    out = []
    for f in files:
        try:
            out.append(json.loads(Path(f).read_text(encoding="utf-8")))
        except Exception:
            continue
    return out


def fmt_purity(p):
    if p is None:
        return "—"
    if p >= 0.999:
        return f"**{p:.4f}**"
    if p >= 0.9:
        return f"{p:.4f}"
    if p >= 0.5:
        return f"~{p:.3f}"
    return f"`{p:.3f}`"  # backtick = below 0.5 = clear breakage


def effective_purity(r):
    """Coverage-aware purity. Penalizes when the substrate caps at fewer
    modules than ground-truth classes (so unrepresented classes count as 0).
    """
    if r is None or "error" in r:
        return None
    pur = r.get("mean_module_purity") or 0.0
    n_in = r.get("n_classes_input") or 0
    n_disc = r.get("n_modules_discovered") or 0
    if n_in <= 0:
        return pur
    coverage = min(1.0, n_disc / n_in)
    return pur * coverage


def grid_table(results, phase, x_axis, y_axis, x_label="x", y_label="y", metric="effective"):
    """Build a grid table for two-axis phases. Returns a markdown table string.

    metric:
        "effective" — coverage-aware purity (mean_purity * coverage)
        "mean_module_purity" — raw purity (overstates when classes > module cap)
        "n_modules_discovered" — module count
        "coverage" — n_modules_discovered / n_classes_input (capped at 1.0)
    """
    cells = defaultdict(dict)
    for r in results:
        if r["phase"] != phase:
            continue
        if "error" in r:
            continue
        x = r["params"].get(x_axis)
        y = r["params"].get(y_axis)
        if x is None or y is None:
            continue
        cells[y][x] = r

    if not cells:
        return f"\n_No data for phase {phase}._\n"

    x_vals = sorted({x for ycells in cells.values() for x in ycells.keys()})
    y_vals = sorted(cells.keys())

    header = f"| {y_label} \\ {x_label} | " + " | ".join(str(x) for x in x_vals) + " |"
    sep = "| " + " | ".join(["---"] * (len(x_vals) + 1)) + " |"
    rows = [header, sep]
    for y in y_vals:
        cell_strs = []
        for x in x_vals:
            r = cells[y].get(x)
            if r is None:
                cell_strs.append("—")
            elif metric == "effective":
                cell_strs.append(fmt_purity(effective_purity(r)))
            elif metric == "n_modules_discovered":
                cell_strs.append(str(r.get("n_modules_discovered", "—")))
            elif metric == "coverage":
                n_in = r.get("n_classes_input", 0)
                n_disc = r.get("n_modules_discovered", 0)
                cov = min(1.0, n_disc / n_in) if n_in > 0 else 0
                cell_strs.append(fmt_purity(cov))
            else:
                cell_strs.append(fmt_purity(r.get(metric)))
        rows.append(f"| {y} | " + " | ".join(cell_strs) + " |")
    return "\n".join(rows)


def summarize_real(results, phase, label_field):
    rows = [r for r in results if r["phase"] == phase and "error" not in r]
    if not rows:
        return f"_No data for {phase}._"
    lines = ["| test | n_entities | classes | modules | mean_purity | mean_basin | AUC | exec_ms |",
             "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for r in rows:
        lines.append(f"| {r['test_id']} | {r['n_entities']} | {r['n_classes_input']} | "
                     f"{r['n_modules_discovered']} | "
                     f"{fmt_purity(r['mean_module_purity'])} | "
                     f"{fmt_purity(r['mean_class_self_basin'])} | "
                     f"{r.get('final_auc') or '—'} | "
                     f"{r.get('gpu_exec_ms', '—')} |")
    return "\n".join(lines)


def burst_summary(results):
    rows = [r for r in results if r["phase"] == "p6_throughput_burst" and "error" not in r]
    if not rows:
        return "_No throughput burst data._"
    rows.sort(key=lambda r: r["params"]["burst_index"])
    purities = [r["mean_module_purity"] for r in rows]
    execs = [r["gpu_exec_ms"] for r in rows if r.get("gpu_exec_ms")]
    walls = [r["wall_seconds"] for r in rows]
    n_entities = rows[0]["n_entities"] if rows else 0
    avg_exec = mean(execs) if execs else 0
    avg_wall = mean(walls) if walls else 0
    sd_exec = stdev(execs) if len(execs) > 1 else 0
    throughput_mean = (n_entities / (avg_exec / 1000)) if avg_exec > 0 else 0
    perfect = sum(1 for p in purities if p >= 0.999)
    return (f"\n- 20 sequential 5K-entity / 8-class jobs against the warm worker.\n"
            f"- Mean GPU exec: {avg_exec:.0f} ms (σ {sd_exec:.0f})\n"
            f"- Mean wall: {avg_wall:.1f} s\n"
            f"- Sustained throughput: **{throughput_mean:,.0f} entities / sec / H100**\n"
            f"- Perfect-purity runs: {perfect} / {len(rows)}\n")


def find_boundaries(results, phase, axes):
    """Identify boundary of perfect EFFECTIVE purity (coverage-aware)."""
    by_axis = defaultdict(list)
    for r in results:
        if r["phase"] != phase or "error" in r:
            continue
        ep = effective_purity(r)
        for ax in axes:
            v = r["params"].get(ax)
            if v is not None and ep is not None:
                by_axis[ax].append((v, ep))
    out = {}
    for ax, lst in by_axis.items():
        lst.sort(key=lambda x: x[0])
        first_break = next((v for v, p in lst if p < 0.999), None)
        last_perfect = next((v for v, p in reversed(lst) if p >= 0.999), None)
        out[ax] = {"first_break_at": first_break, "last_perfect_at": last_perfect}
    return out


def main():
    results = load_results()
    if not results:
        print("no results yet")
        return 0

    errored = sum(1 for r in results if "error" in r)
    completed = len(results) - errored
    total_cost = sum(r.get("cost_dollars", 0) for r in results if "error" not in r)
    # raw purity (overstates) vs effective purity (coverage-aware)
    perfect_raw = sum(1 for r in results if "error" not in r and r.get("mean_module_purity", 0) >= 0.999)
    perfect_effective = sum(1 for r in results if "error" not in r
                            and effective_purity(r) is not None
                            and effective_purity(r) >= 0.999)

    md = []
    md.append("# Substrate Phase Diagram — Overnight Campaign\n")
    md.append(f"Generated: {datetime.utcnow().isoformat()}Z\n")
    md.append(f"Total tests recorded: **{len(results)}**  (completed: {completed}, errors: {errored})")
    md.append(f"Perfect EFFECTIVE-purity (coverage-aware): **{perfect_effective} / {completed}** ({perfect_effective/max(1,completed)*100:.1f}%)")
    md.append(f"Perfect raw module purity (uncorrected for coverage): **{perfect_raw} / {completed}**")
    md.append(f"Cumulative GPU cost: **${total_cost:.4f}**\n")
    md.append("> Effective purity = `mean_module_purity × min(1, n_modules_discovered / n_classes_input)`. "
              "When the substrate produces fewer modules than ground-truth classes, the missing classes' "
              "entities are not represented in any module — raw purity overstates fidelity. Effective purity "
              "is the coverage-corrected number.\n")

    md.append("## Phase 1 — scale × class_count")
    md.append("Mean module purity at each (scale, class_count). Target: 1.000 perfect.")
    md.append("")
    md.append(grid_table(results, "p1_scale_class", "n_classes", "n_entities",
                         x_label="classes", y_label="entities"))
    b = find_boundaries(results, "p1_scale_class", ["n_entities", "n_classes"])
    md.append("\n**Boundaries:**")
    for ax, info in b.items():
        md.append(f"- {ax}: last perfect = {info['last_perfect_at']}, first break = {info['first_break_at']}")

    md.append("\n## Phase 2 — class × noise level")
    md.append("Noise = fraction of class signature tokens replaced with random-pool tokens.")
    md.append("")
    md.append(grid_table(results, "p2_class_noise", "noise_level", "n_classes",
                         x_label="noise", y_label="classes"))
    b = find_boundaries(results, "p2_class_noise", ["noise_level"])
    md.append("\n**Boundaries:**")
    for ax, info in b.items():
        md.append(f"- {ax}: last perfect = {info['last_perfect_at']}, first break = {info['first_break_at']}")

    md.append("\n## Phase 3 — class × imbalance ratio")
    md.append("Imbalance ratio = largest class size / smallest class size (geometric distribution).")
    md.append("")
    md.append(grid_table(results, "p3_class_imbalance", "imbalance_ratio", "n_classes",
                         x_label="imbalance", y_label="classes"))
    b = find_boundaries(results, "p3_class_imbalance", ["imbalance_ratio"])
    md.append("\n**Boundaries:**")
    for ax, info in b.items():
        md.append(f"- {ax}: last perfect = {info['last_perfect_at']}, first break = {info['first_break_at']}")

    md.append("\n## Phase 4 — class × signature overlap")
    md.append("Overlap = fraction of signature tokens shared between classes.")
    md.append("")
    md.append(grid_table(results, "p4_class_overlap", "overlap_frac", "n_classes",
                         x_label="overlap", y_label="classes"))
    b = find_boundaries(results, "p4_class_overlap", ["overlap_frac"])
    md.append("\n**Boundaries:**")
    for ax, info in b.items():
        md.append(f"- {ax}: last perfect = {info['last_perfect_at']}, first break = {info['first_break_at']}")

    md.append("\n## Phase 5 — Real-data suite")
    md.append("\n### TNA SIGINT (real)")
    md.append(summarize_real(results, "p5_real_tna", "n_per_archive"))
    md.append("\n### NSL-KDD intrusion (real)")
    md.append(summarize_real(results, "p5_real_nslkdd", "n_per_class"))

    md.append("\n## Phase 6 — Throughput burst")
    md.append(burst_summary(results))

    md.append("\n## Headline")
    md.append(f"- {perfect_effective} of {completed} tests at perfect (≥0.999) EFFECTIVE purity.")
    md.append(f"- {perfect_raw} of {completed} tests at perfect raw purity (uncorrected for coverage).")
    md.append(f"- Total GPU spend: **${total_cost:.4f}**.")
    md.append(f"- Boundary discovery: see Phase 2 (noise tolerance), Phase 3 (rare-class detection),")
    md.append(f"  Phase 4 (signature overlap) for the first-break / last-perfect axis values.")

    out_path = Path("docs/commercial/SUBSTRATE_PHASE_DIAGRAM.md")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(md), encoding="utf-8")
    print(f"wrote: {out_path}")
    print(f"  {len(results)} results, {perfect_effective} perfect-effective, "
          f"{perfect_raw} perfect-raw, ${total_cost:.4f} spent")


if __name__ == "__main__":
    main()
