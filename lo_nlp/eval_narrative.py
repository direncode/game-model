"""Evaluation harness for the narrative-enhancement layer.

Grades narratives along four automatic dimensions and reports agreement
with hand-labeled gold truth:

    numeric_fidelity  — every number in the narrative traces to the bundle
    length_ok         — 2 to 3 sentences as promised in the prompt
    marketing_free    — no hype words (unprecedented / groundbreaking / ...)
    entity_grounded   — the bundle's resolved entity appears in the narrative

Fixture shape: list of {id, bundle, narrative, gold_label, gold_reason}.
gold_label is one of "good" / "acceptable" / "hallucinated".

Usage:
    python -m lo_nlp.eval_narrative                    # summary
    python -m lo_nlp.eval_narrative --verbose          # per-bundle rows
    python -m lo_nlp.eval_narrative --json out.json    # dump stats
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Optional

FIXTURE_PATH = Path(__file__).resolve().parent / "data" / "eval_narrative_fixture.json"

# Marketing / hype words that the prompt explicitly forbids. Kept strict
# to common hype; ambiguous words like "exceptional" / "truly" are left
# off because they appear in legitimate analyst prose ("not exceptional",
# "truly representative"), and context-free matching over-fires.
MARKETING_WORDS = [
    "unprecedented", "groundbreaking", "revolutionary", "remarkable",
    "stunning", "world-class", "extraordinary",
    "game-changing", "paradigm-shift", "best-in-class",
]

# Causation phrases that the prompt explicitly forbids ("do NOT speculate
# about causation, motive, or external events"). An LLM that satisfies
# the numeric-fidelity check can still invent causal stories; this
# catches the pattern.
#
# "driven by" was deliberately DROPPED from this list after the prod
# round-trip revealed the deterministic template uses it analytically
# ("driven by isolation from peer fingerprint space" — attributes cause
# to an intrinsic bundle property, not an external event). The list
# below targets phrases that almost always lead into dated events or
# external actors.
CAUSATION_PHRASES = [
    "stems from", "in response to", "following the",
    "caused by", "due to the", "because of the",
    "reflects the post-", "echoes the post-", "as a result of",
    "in the wake of", "attributable to", "on the back of",
    "owing to the",
]
_CAUSATION_RE = re.compile(
    r"\b(" + "|".join(re.escape(p) for p in CAUSATION_PHRASES) + r")\b",
    re.IGNORECASE,
)
_MARKETING_RE = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in MARKETING_WORDS) + r")\b",
    re.IGNORECASE,
)

# Numbers in the narrative that should trace to the bundle. Mirrors
# validateCitations() in frontend/lib/narrativeClient.ts.
_NUM_RE = re.compile(r"-?\d+(?:\.\d+)?")

# Sentence split: full-stop / question / exclamation followed by space.
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def _bundle_number_set(bundle: dict) -> set[str]:
    """All numeric facts the narrative is allowed to cite."""
    nums: set[str] = set()

    def add(n):
        if isinstance(n, (int, float)):
            # 1, 2, 3 decimal forms cover analyst-rounded citations
            nums.add(f"{n:.1f}")
            nums.add(f"{n:.2f}")
            nums.add(f"{n:.3f}")
            nums.add(str(int(round(n))))
            if 0 <= n <= 1:
                nums.add(str(int(round(n * 100))))

    for key in ("composite", "anomaly", "reconstruction", "diversity"):
        v = bundle.get(key)
        if v is not None:
            add(float(v))
    for key in ("peer_rank", "universe_size", "cluster_rank", "cluster_size"):
        v = bundle.get(key)
        if v is not None:
            nums.add(str(v))
    # Derived statistics the template is allowed to compute and cite:
    #   "top N%" = round(peer_rank / universe_size * 100)
    # Prod round-trip revealed the deterministic template uses this
    # phrasing; it's a legitimate derivation, not fabrication.
    pr = bundle.get("peer_rank")
    us = bundle.get("universe_size")
    if pr and us and us > 0:
        pct = pr / us * 100
        nums.add(str(int(round(pct))))
        nums.add(f"{pct:.1f}")
        # Analyst-rounded "top 1%" when actual is < 1
        if pct < 1:
            nums.add("1")
    cr = bundle.get("cluster_rank")
    cs = bundle.get("cluster_size")
    if cr and cs and cs > 0:
        pct = cr / cs * 100
        nums.add(str(int(round(pct))))
        nums.add(f"{pct:.1f}")
    nt = bundle.get("null_test") or {}
    if nt.get("z_score") is not None:
        add(float(nt["z_score"]))
    if nt.get("iterations") is not None:
        nums.add(str(nt["iterations"]))
    return nums


def check_numeric_fidelity(narrative: str, bundle: dict) -> tuple[bool, list[str]]:
    """Return (all-cited, list-of-uncited-numbers). Years 1900-2100 and
    trivially-small ints (0-1) get a pass — they're rarely fabrications."""
    allowed = _bundle_number_set(bundle)
    found = _NUM_RE.findall(narrative)
    uncited: list[str] = []
    for raw in found:
        try:
            n = float(raw)
        except ValueError:
            continue
        # Year tokens are context, not fabrication
        if n.is_integer() and 1900 <= n <= 2100:
            continue
        # 0 and 1 as abstract quantifiers are fine
        if raw in ("0", "1"):
            continue
        if raw in allowed:
            continue
        uncited.append(raw)
    return (len(uncited) == 0, uncited)


def check_length_ok(narrative: str) -> tuple[bool, int]:
    """2 or 3 sentences. Allow 2-4 with a soft-fail at 1 or 5+."""
    parts = [p.strip() for p in _SENT_SPLIT_RE.split(narrative.strip()) if p.strip()]
    n = len(parts)
    return (2 <= n <= 3, n)


def check_marketing_free(narrative: str) -> tuple[bool, list[str]]:
    hits = _MARKETING_RE.findall(narrative)
    return (len(hits) == 0, [h.lower() for h in hits])


def check_no_external_causation(narrative: str) -> tuple[bool, list[str]]:
    """The prompt forbids speculating about causation/motive/external
    events. Detect the phrasal shape of such claims."""
    hits = _CAUSATION_RE.findall(narrative)
    return (len(hits) == 0, [h.lower() for h in hits])


def _concept_tokens(bundle: dict) -> list[str]:
    """Extract the *concept* half of the entity (e.g. 'Goodwill' from
    'fact_19617_Goodwill' or 'JPMORGAN CHASE & CO \u00b7 Goodwill')."""
    out: list[str] = []
    raw = bundle.get("entity_raw") or ""
    tail = re.sub(r"^fact_\d+_", "", raw)
    if tail and tail != raw:
        out.append(tail)
    resolved = bundle.get("entity_resolved") or ""
    if "\u00b7" in resolved:
        # Everything after the middle-dot is the concept side
        tail2 = resolved.split("\u00b7", 1)[1].strip()
        if tail2:
            out.append(tail2)
    tlc = bundle.get("top_line_concept")
    if tlc:
        out.append(tlc)
    return out


def _split_camel(s: str) -> str:
    """'AssetRetirementObligation' -> 'Asset Retirement Obligation'."""
    return re.sub(r"([a-z])([A-Z])", r"\1 \2", s)


def check_entity_grounded(narrative: str, bundle: dict) -> bool:
    """Both the organisation AND the concept must appear in the narrative.
    Wrong-concept cases (e.g. narrative calls Goodwill 'Revenue') fail
    here."""
    lower_narrative = narrative.lower()

    # ── organisation side (issuer name / ticker) ────────────────────
    name = bundle.get("entity_resolved") or ""
    parts = re.split(r"\s*\u00b7\s*|\s*-\s*", name)
    org_candidates = [c.strip() for c in parts if c.strip()]
    org_hit = False
    for c in org_candidates:
        if c.lower() in lower_narrative:
            org_hit = True
            break
        tokens = [t for t in re.split(r"\s+", c) if len(t) > 2]
        for i in range(len(tokens) - 1):
            if f"{tokens[i]} {tokens[i+1]}".lower() in lower_narrative:
                org_hit = True
                break
        if org_hit:
            break
        for t in tokens:
            if t.isupper() and len(t) >= 3 and t.lower() in lower_narrative:
                org_hit = True
                break
        if org_hit:
            break

    # ── concept side (the XBRL line item being discussed) ──────────
    concept_hit = False
    for cand in _concept_tokens(bundle):
        if not cand:
            continue
        variants = {cand, _split_camel(cand)}
        for v in variants:
            if v.lower() in lower_narrative:
                concept_hit = True
                break
            # Match any substantive word from the concept (e.g. "Goodwill"
            # from "Goodwill" or "Revenue" from "Revenue")
            for word in re.findall(r"[A-Za-z]{4,}", v):
                if word.lower() in lower_narrative:
                    concept_hit = True
                    break
            if concept_hit:
                break
        if concept_hit:
            break

    # When we have no org name and no concept tokens, fall back to raw
    if not org_candidates and not concept_hit:
        raw = bundle.get("entity_raw") or ""
        if raw and raw.lower() in lower_narrative:
            return True
        return False

    return org_hit and concept_hit


def auto_label(
    numeric_ok: bool,
    length_ok: bool,
    marketing_free: bool,
    entity_grounded: bool,
    no_external_causation: bool,
) -> str:
    """Binary safety verdict: 'hallucinated' or 'not_hallucinated'.

    Five automatic signals. Four trigger hallucination on any failure;
    length is style-only and does not.

    Hallucination triggers (any):
        - fabricated number(s) not in bundle
        - wrong or missing entity / concept grounding
        - marketing / hype language
        - external-causation claim (prompt forbids speculating)
    """
    if (not numeric_ok or not entity_grounded
            or not marketing_free or not no_external_causation):
        return "hallucinated"
    return "not_hallucinated"


def _gold_binary(gold: str) -> str:
    """Map 3-class gold labels onto the binary auto-label space."""
    if gold == "hallucinated":
        return "hallucinated"
    # Both 'good' and 'acceptable' are considered safe (not hallucinated)
    return "not_hallucinated"


def score_narrative(item: dict) -> dict:
    bundle = item["bundle"]
    narrative = item["narrative"]
    gold = item.get("gold_label", "")

    numeric_ok, uncited_nums = check_numeric_fidelity(narrative, bundle)
    length_ok, n_sents = check_length_ok(narrative)
    marketing_free, marketing_hits = check_marketing_free(narrative)
    entity_grounded = check_entity_grounded(narrative, bundle)
    no_causation, causation_hits = check_no_external_causation(narrative)

    predicted = auto_label(numeric_ok, length_ok, marketing_free, entity_grounded, no_causation)
    gold_bin = _gold_binary(gold)
    agrees = predicted == gold_bin

    return {
        "id": item.get("id"),
        "gold_label": gold,
        "gold_binary": gold_bin,
        "auto_label": predicted,
        "agrees": agrees,
        "numeric_fidelity": numeric_ok,
        "uncited_numbers": uncited_nums,
        "length_ok": length_ok,
        "n_sentences": n_sents,
        "marketing_free": marketing_free,
        "marketing_hits": marketing_hits,
        "entity_grounded": entity_grounded,
        "no_external_causation": no_causation,
        "causation_hits": causation_hits,
    }


def run_eval(fixture: Optional[list[dict]] = None) -> dict:
    if fixture is None:
        fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    per_item = [score_narrative(it) for it in fixture]

    n = len(per_item)
    agree = sum(1 for r in per_item if r["agrees"])

    # Binary confusion: gold_binary vs auto_label.
    # Off-diagonal is the interesting number:
    #   false negatives = gold=hallucinated but auto=not_hallucinated (BAD)
    #   false positives = gold=not_hallucinated but auto=hallucinated (noisy)
    bin_labels = ["not_hallucinated", "hallucinated"]
    confusion = {g: {a: 0 for a in bin_labels} for g in bin_labels}
    for r in per_item:
        g = r["gold_binary"]
        a = r["auto_label"]
        if g in confusion and a in confusion[g]:
            confusion[g][a] += 1

    # Precision/recall specifically for the hallucination-detection task
    tp = confusion["hallucinated"]["hallucinated"]
    fp = confusion["not_hallucinated"]["hallucinated"]
    fn = confusion["hallucinated"]["not_hallucinated"]
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0

    # Per-dimension pass rates
    dims = {
        "numeric_fidelity": sum(1 for r in per_item if r["numeric_fidelity"]) / n,
        "length_ok": sum(1 for r in per_item if r["length_ok"]) / n,
        "marketing_free": sum(1 for r in per_item if r["marketing_free"]) / n,
        "entity_grounded": sum(1 for r in per_item if r["entity_grounded"]) / n,
        "no_external_causation": sum(1 for r in per_item if r["no_external_causation"]) / n,
    }

    return {
        "n": n,
        "agreement": round(agree / n, 3),
        "hallucination_precision": round(precision, 3),
        "hallucination_recall": round(recall, 3),
        "confusion_gold_x_auto": confusion,
        "dim_pass_rates": {k: round(v, 3) for k, v in dims.items()},
        "per_item": per_item,
    }


def format_summary(stats: dict) -> str:
    lines = [
        f"n={stats['n']}  agreement={stats['agreement']:.3f}  "
        f"(hallucination P={stats['hallucination_precision']:.3f} "
        f"R={stats['hallucination_recall']:.3f})",
        f"dim_pass_rates  {stats['dim_pass_rates']}",
        "",
        "confusion (rows=gold_binary, cols=auto_label):",
        f"  {'':<18} {'not_hallucinated':>18} {'hallucinated':>14}",
    ]
    for g in ("not_hallucinated", "hallucinated"):
        row = stats["confusion_gold_x_auto"][g]
        lines.append(
            f"  {g:<18} {row['not_hallucinated']:>18} {row['hallucinated']:>14}"
        )
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Evaluate narrative-enhancement layer")
    ap.add_argument("--fixture", default=str(FIXTURE_PATH))
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--json", metavar="PATH", help="Dump full stats JSON")
    args = ap.parse_args()

    fixture = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    stats = run_eval(fixture=fixture)
    print(format_summary(stats))

    if args.verbose:
        print()
        hdr = f"  {'agree':>5}  {'gold':<13}  {'auto':<13}  {'id':<32} issues"
        print(hdr)
        print("-" * len(hdr))
        for r in stats["per_item"]:
            issues = []
            if not r["numeric_fidelity"]:
                issues.append(f"uncited_nums={r['uncited_numbers']}")
            if not r["length_ok"]:
                issues.append(f"n_sents={r['n_sentences']}")
            if not r["marketing_free"]:
                issues.append(f"marketing={r['marketing_hits']}")
            if not r["entity_grounded"]:
                issues.append("entity_not_grounded")
            if not r["no_external_causation"]:
                issues.append(f"causation={r['causation_hits']}")
            print(
                f"  {'YES' if r['agrees'] else 'no':>5}  "
                f"{r['gold_label']:<13}  {r['auto_label']:<13}  "
                f"{(r['id'] or '-'):<32} {', '.join(issues) if issues else '-'}"
            )

    if args.json:
        Path(args.json).write_text(json.dumps(stats, indent=2), encoding="utf-8")

    return 0 if stats["agreement"] >= 0.75 else 2


if __name__ == "__main__":
    raise SystemExit(main())
