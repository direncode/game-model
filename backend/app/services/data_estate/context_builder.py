"""Builds estate context snapshot for AI interactions."""
from __future__ import annotations


def build_estate_context(
    modules: list[dict],
    submissions: list[dict],
    ledger_entries: list[dict],
    pending_allocations: list[dict],
) -> str:
    sections: list[str] = []

    by_type = {"attractor": 0, "cycle": 0, "boundary": 0}
    for m in modules:
        mtype = m.get("module_type", "attractor")
        by_type[mtype] = by_type.get(mtype, 0) + 1
    sections.append(
        f"ESTATE TOPOLOGY: {len(modules)} crystallized modules "
        f"({by_type['attractor']} stable/H0, {by_type['cycle']} evolving/H1, "
        f"{by_type['boundary']} gaps/H2)."
    )

    by_status = {}
    for s in submissions:
        st = s.get("status", "pending")
        by_status[st] = by_status.get(st, 0) + 1
    status_str = ", ".join(f"{k}: {v}" for k, v in by_status.items())
    sections.append(f"SUBMISSIONS: {len(submissions)} total ({status_str}).")

    if ledger_entries:
        total = sum(e.get("amount", 0) for e in ledger_entries)
        categories = set(e.get("category_tag", "") for e in ledger_entries)
        sections.append(f"ALLOCATION LEDGER: ${total:,.2f} across {len(categories)} categories, {len(ledger_entries)} line items.")

    if pending_allocations:
        total_pending = sum(a.get("amount", 0) for a in pending_allocations)
        sections.append(f"PENDING ALLOCATION REQUESTS: {len(pending_allocations)} requests totaling ${total_pending:,.2f}.")

    top_modules = sorted(modules, key=lambda m: m.get("quality_score", 0), reverse=True)[:5]
    if top_modules:
        module_lines = []
        for m in top_modules:
            desc = m.get("description", m.get("id", "unnamed"))
            module_lines.append(f"  - {desc} (type={m.get('module_type')}, purity={m.get('purity', 0):.2f}, members={len(m.get('members', []))})")
        sections.append("TOP MODULES:\n" + "\n".join(module_lines))

    gaps = [m for m in modules if m.get("module_type") == "boundary"]
    if gaps:
        sections.append(f"DETECTED GAPS: {len(gaps)} boundary modules indicating areas needing attention.")

    return "\n\n".join(sections)
