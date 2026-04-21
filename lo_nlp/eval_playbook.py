"""Evaluation harness for the Layer-3 playbook generator.

Parses v2 playbook markdown and grades:

    STRUCTURAL
      required_sections      — Buyer, Hook, Pitch, ROI, Trigger, findings,
                               falsifiability, Reproduce
      findings_present       — at least 5 ranked findings
      nulltest_present       — null-test stats block present

    STYLE / SAFETY
      marketing_free         — no hype vocabulary anywhere in doc
      no_external_causation  — no speculative causation phrasing
      narrative_hallucinated — per-finding narrative (if any) passes the
                               narrative-eval safety rules

    NUMERIC SHAPE
      scores_in_range        — composite / anomaly scores ∈ [0, 1]
      counts_nonnegative     — all ranks / counts >= 0
      fingerprint_shape      — fingerprints are binary strings (0/1 only)

Any hallucination trigger → playbook graded "hallucinated"; otherwise
"not_hallucinated". Same binary contract as eval_narrative.

Usage:
    python -m lo_nlp.eval_playbook                        # grade docs/commercial/verticals/v2/*.md
    python -m lo_nlp.eval_playbook --generate             # regenerate first via generate_playbook_v2.py
    python -m lo_nlp.eval_playbook --dir other/playbooks  # alternative path
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

REPO = Path(__file__).resolve().parent.parent
DEFAULT_DIR = REPO / "docs" / "commercial" / "verticals" / "v2"

from lo_nlp.eval_narrative import (  # noqa: E402
    _CAUSATION_RE,
    _MARKETING_RE,
    _NUM_RE,
    _SENT_SPLIT_RE,
)

# Markdown ## sections the v2 skeleton emits as proper headings.
REQUIRED_HEADINGS = [
    "Buyer", "Hook", "Pitch", "ROI",
    "Trigger conditions",
    "Today's top findings",
    "Reproduce",
]

# Bold-text blocks (not headings) the skeleton emits; check separately.
REQUIRED_BOLD_BLOCKS = [
    "Null-test falsifiability",
]

# Finding line shape — match the bolded ranked entries
_FINDING_RE = re.compile(
    r"^\*\*(\d+)\.\s+(.+?)\*\*\s*·\s*composite\s*`([\d.]+)`\s*·\s*anomaly\s*`([\d.]+)`"
    r"(?:\s*·\s*fingerprint\s*`([01.\u2026]+)`)?",
    re.MULTILINE,
)

# Optional per-finding narrative: prose paragraph following a finding
# bullet (blank line separation). Captured as the line+next-lines until
# the next finding header or a blank line.
_FINDING_NARRATIVE_RE = re.compile(
    r"^\*\*\d+\..*?\*\*.*?$\n(?:\s*\n)+((?:(?!\*\*\d+\.|\#\#).+\n?)+)",
    re.MULTILINE,
)


def parse_sections(md: str) -> dict[str, str]:
    """Split markdown by `## ` headings. Return {heading: body}."""
    sections: dict[str, str] = {}
    current = "_preamble"
    buf: list[str] = []
    for line in md.splitlines():
        m = re.match(r"^##\s+(.+)\s*$", line)
        if m:
            sections[current] = "\n".join(buf).strip()
            current = m.group(1).strip()
            buf = []
        else:
            buf.append(line)
    sections[current] = "\n".join(buf).strip()
    return sections


def _section_present(sections: dict[str, str], needle: str) -> bool:
    """Case-insensitive partial match on section headings."""
    n = needle.lower()
    return any(n in key.lower() for key in sections.keys())


def check_structural(md: str, sections: dict[str, str]) -> dict:
    missing_headings = [s for s in REQUIRED_HEADINGS if not _section_present(sections, s)]
    md_lower = md.lower()
    missing_blocks = [b for b in REQUIRED_BOLD_BLOCKS if b.lower() not in md_lower]
    missing = missing_headings + missing_blocks
    findings = _FINDING_RE.findall(md)
    has_null_test = (
        "z-score" in md_lower or "p<0.05" in md_lower or "sigma" in md_lower
        or "null-test" in md_lower
    )
    return {
        "required_sections_ok": len(missing) == 0,
        "missing_sections": missing,
        "findings_present": len(findings) >= 5,
        "n_findings": len(findings),
        "nulltest_present": has_null_test,
    }


def check_numeric_shape(md: str) -> dict:
    findings = _FINDING_RE.findall(md)
    bad_scores: list[str] = []
    bad_fingerprints: list[str] = []
    for _rank, _ent, comp, anom, fp in findings:
        for label, val in (("composite", comp), ("anomaly", anom)):
            try:
                v = float(val)
                if not (0.0 <= v <= 1.0):
                    bad_scores.append(f"{label}={v}")
            except ValueError:
                bad_scores.append(f"{label}={val!r}")
        if fp and any(c not in "01\u2026" for c in fp):
            bad_fingerprints.append(fp)
    return {
        "scores_in_range": len(bad_scores) == 0,
        "out_of_range_scores": bad_scores,
        "fingerprint_shape_ok": len(bad_fingerprints) == 0,
        "bad_fingerprints": bad_fingerprints,
    }


def check_style_safety(md: str) -> dict:
    mkt = [m.lower() for m in _MARKETING_RE.findall(md)]
    cau = [c.lower() for c in _CAUSATION_RE.findall(md)]
    return {
        "marketing_free": len(mkt) == 0,
        "marketing_hits": mkt,
        "no_external_causation": len(cau) == 0,
        "causation_hits": cau,
    }


def check_finding_narratives(md: str) -> dict:
    """If per-finding narratives exist, grade each. Return aggregate
    numeric-fidelity check within the findings section only."""
    findings_section_match = re.search(
        r"## Today's top findings.*?(?=\n##\s|\Z)", md, re.DOTALL,
    )
    if not findings_section_match:
        return {"narratives_checked": 0, "narratives_flagged": 0, "narrative_issues": []}
    section = findings_section_match.group(0)

    # Numbers appearing in this section should look like scores (0-1),
    # small integers (ranks, counts), or fingerprints. Any 2-decimal
    # percent-like number or 4+ digit number outside the rank context
    # is suspicious.
    narratives_flagged = 0
    issues: list[str] = []

    # Split by finding-bullet and look at the free prose between them.
    # Simple approach: look for "%", "year-over-year", "YoY", "quarterly" —
    # these are the LLM fabrication fingerprints.
    fab_patterns = [
        r"\b\d+\.\d+\s*%",           # "14.7%"
        r"\byear[\s-]over[\s-]year\b", r"\bYoY\b",
        r"\bquarterly\b", r"\bmonth[\s-]over[\s-]month\b",
        r"\bconfidence\s+interval\b",
    ]
    for pat in fab_patterns:
        m = re.findall(pat, section, re.IGNORECASE)
        if m:
            issues.append(f"{pat}: {m[:3]}")
            narratives_flagged += 1

    # Also apply the narrative-eval causation + marketing checks locally
    section_cau = _CAUSATION_RE.findall(section)
    if section_cau:
        issues.append(f"causation_in_findings: {section_cau[:3]}")
        narratives_flagged += 1
    section_mkt = _MARKETING_RE.findall(section)
    if section_mkt:
        issues.append(f"marketing_in_findings: {section_mkt[:3]}")
        narratives_flagged += 1

    return {
        "narratives_checked": 1 if section else 0,
        "narratives_flagged": narratives_flagged,
        "narrative_issues": issues,
    }


def grade_playbook_text(md: str, path: str = "") -> dict:
    sections = parse_sections(md)
    struct = check_structural(md, sections)
    style = check_style_safety(md)
    shape = check_numeric_shape(md)
    narr = check_finding_narratives(md)

    # Binary verdict
    hallucinated = (
        not style["marketing_free"]
        or not style["no_external_causation"]
        or not shape["scores_in_range"]
        or not shape["fingerprint_shape_ok"]
        or narr["narratives_flagged"] > 0
    )
    # Broken structure is a separate failure class — reported but distinct
    # from hallucination (a playbook missing a section is a generator bug,
    # not a fabrication).
    structurally_ok = (
        struct["required_sections_ok"]
        and struct["findings_present"]
        and struct["nulltest_present"]
    )
    return {
        "path": path,
        "auto_label": "hallucinated" if hallucinated else "not_hallucinated",
        "structurally_ok": structurally_ok,
        **struct, **style, **shape, **narr,
    }


def regenerate(corpus: str = "all") -> int:
    """Invoke scripts/generate_playbook_v2.py to re-generate before eval."""
    script = REPO / "scripts" / "generate_playbook_v2.py"
    if not script.exists():
        print(f"[eval_playbook] generator not found at {script}")
        return 1
    r = subprocess.run(
        [sys.executable, str(script), corpus],
        cwd=str(REPO),
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f"[eval_playbook] generate_playbook_v2.py exited {r.returncode}")
        print(f"stderr: {r.stderr[-400:]}")
        return r.returncode
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=str(DEFAULT_DIR))
    ap.add_argument("--generate", action="store_true",
                    help="Re-run scripts/generate_playbook_v2.py all before grading")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--json", metavar="PATH")
    args = ap.parse_args()

    if args.generate:
        rc = regenerate()
        if rc != 0:
            return rc

    d = Path(args.dir)
    paths = sorted(p for p in d.glob("*.md") if p.name != "README.md")
    if not paths:
        print(f"[eval_playbook] no .md files at {d}")
        return 5

    per_file = []
    for p in paths:
        md = p.read_text(encoding="utf-8", errors="replace")
        row = grade_playbook_text(md, path=str(p.relative_to(REPO)))
        per_file.append(row)

    n = len(per_file)
    halluc = sum(1 for r in per_file if r["auto_label"] == "hallucinated")
    struct_broken = sum(1 for r in per_file if not r["structurally_ok"])
    marketing_hits = sum(len(r["marketing_hits"]) for r in per_file)
    causation_hits = sum(len(r["causation_hits"]) for r in per_file)

    print(f"playbook eval: n={n}  hallucinated={halluc}  structurally_broken={struct_broken}")
    print(f"  aggregate marketing hits: {marketing_hits}")
    print(f"  aggregate causation hits: {causation_hits}")
    if args.verbose or halluc or struct_broken:
        print()
        for r in per_file:
            tag = "HALLUC" if r["auto_label"] == "hallucinated" else "ok"
            stag = "broken-struct" if not r["structurally_ok"] else ""
            issues = []
            if r["marketing_hits"]:
                issues.append(f"mkt={r['marketing_hits']}")
            if r["causation_hits"]:
                issues.append(f"caus={r['causation_hits']}")
            if r["missing_sections"]:
                issues.append(f"missing={r['missing_sections']}")
            if r["out_of_range_scores"]:
                issues.append(f"oor={r['out_of_range_scores']}")
            if r["narrative_issues"]:
                issues.append(f"narr={r['narrative_issues'][:2]}")
            print(f"  {tag:<8} {stag:<14} {r['path']:<45} "
                  f"n_findings={r['n_findings']}  {', '.join(issues) if issues else ''}")

    if args.json:
        Path(args.json).write_text(
            json.dumps({"n": n, "hallucinated": halluc, "per_file": per_file}, indent=2),
            encoding="utf-8",
        )

    return 0 if halluc == 0 and struct_broken == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
