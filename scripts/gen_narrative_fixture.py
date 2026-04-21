"""Expand the narrative eval fixture with templated, label-preserving
variants.

Takes a seed set of entities × concepts × failure-modes and stamps out
bundles + narratives that exercise each failure mode across diverse
subjects. Deterministic under seed=42.

Usage:
    python scripts/gen_narrative_fixture.py \
        --seed-fixture lo_nlp/data/eval_narrative_fixture.json \
        --out lo_nlp/data/eval_narrative_fixture_large.json

Result includes the seed bundles plus ~60 synthetic ones, covering:
  - good (correct, analyst-tone)
  - acceptable (correct but thin)
  - hallucinated:numbers
  - hallucinated:entity
  - hallucinated:causation
  - hallucinated:marketing
  - hallucinated:wrong_concept
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# ── entity pool (CIK, display name, abbreviation) ───────────────────
ENTITIES = [
    ("320193", "Apple Inc.", "AAPL"),
    ("789019", "MICROSOFT CORP", "MSFT"),
    ("1045810", "NVIDIA CORP", "NVDA"),
    ("1018724", "AMAZON COM INC", "AMZN"),
    ("1652044", "Alphabet Inc.", "GOOGL"),
    ("1326801", "Meta Platforms Inc.", "META"),
    ("1318605", "Tesla Inc.", "TSLA"),
    ("4904", "AMERICAN ELECTRIC POWER CO INC", "AEP"),
    ("886982", "GOLDMAN SACHS GROUP INC", "GS"),
    ("19617", "JPMORGAN CHASE & CO", "JPM"),
    ("70858", "BANK OF AMERICA CORP", "BAC"),
    ("51143", "INTERNATIONAL BUSINESS MACHINES CORP", "IBM"),
    ("1751788", "Dow Inc.", "DOW"),
    ("1109357", "Exelon Corporation", "EXC"),
    ("1166691", "Comcast Corporation", "CMCSA"),
]

# ── concept pool (XBRL line, display name, related gloss) ──────────
CONCEPTS = [
    ("Revenue", "Revenue", None),
    ("Goodwill", "Goodwill", None),
    ("CapitalExpenditures", "Capital Expenditures", None),
    ("ResearchAndDevelopmentExpense", "Research and Development Expense", None),
    ("LongTermDebt", "Long-Term Debt", None),
    ("InventoryNet", "Net Inventory", None),
    ("AccountsReceivableNet", "Accounts Receivable", None),
    ("OperatingIncomeLoss", "Operating Income", None),
    ("AssetRetirementObligation", "Asset Retirement Obligation",
     "decommissioning-estimate line \u2014 audit-sensitive and prone to material revision"),
]


def score_tuple(rng: random.Random) -> tuple[float, float, float, float, int, int]:
    composite = round(rng.uniform(0.55, 0.92), 3)
    anomaly = round(rng.uniform(0.55, 1.0), 2)
    reconstruction = round(rng.uniform(0.55, 0.92), 3)
    diversity = round(rng.uniform(0.55, 0.92), 3)
    universe_size = rng.choice([500, 642, 500, 1000])
    peer_rank = rng.randint(1, min(100, universe_size // 3))
    return composite, anomaly, reconstruction, diversity, peer_rank, universe_size


def make_bundle(entity, concept, rng):
    cik, display, _ticker = entity
    xbrl, concept_display, gloss = concept
    composite, anomaly, reconstruction, diversity, peer_rank, universe_size = score_tuple(rng)
    b = {
        "entity_raw": f"fact_{cik}_{xbrl}",
        "entity_resolved": f"{display} \u00b7 {concept_display}",
        "composite": composite, "anomaly": anomaly,
        "reconstruction": reconstruction, "diversity": diversity,
        "peer_rank": peer_rank, "universe_size": universe_size,
        "corpus_id": "edgar_5000",
        "corpus_domain": "SEC EDGAR financial filings",
        "top_line_concept": xbrl,
    }
    if gloss:
        b["concept_gloss"] = gloss
    return b


def tmpl_good(b):
    return (
        f"{b['entity_resolved'].split(chr(0x00b7))[0].strip()}'s "
        f"{b['entity_resolved'].split(chr(0x00b7))[1].strip()} "
        f"fact scores {b['composite']:.3f} composite in the SEC EDGAR corpus, "
        f"ranking {b['peer_rank']} of {b['universe_size']}. "
        f"The anomaly dimension ({b['anomaly']:.2f}) and reconstruction "
        f"({b['reconstruction']:.3f}) together suggest a filing pattern that "
        f"materially differs from peer entities in the universe."
    )


def tmpl_acceptable_thin(b):
    org = b['entity_resolved'].split(chr(0x00b7))[0].strip()
    cx = b['entity_resolved'].split(chr(0x00b7))[1].strip()
    return (
        f"{org}'s {cx} shows a composite of {b['composite']:.3f}. "
        f"Rank {b['peer_rank']} of {b['universe_size']}."
    )


def tmpl_acceptable_listy(b):
    org = b['entity_resolved'].split(chr(0x00b7))[0].strip()
    cx = b['entity_resolved'].split(chr(0x00b7))[1].strip()
    return (
        f"{org}'s {cx} scored {b['composite']:.3f} composite at rank "
        f"{b['peer_rank']} of {b['universe_size']}. Diversity was "
        f"{b['diversity']:.3f}, reconstruction {b['reconstruction']:.3f}, "
        f"and anomaly {b['anomaly']:.2f}."
    )


def tmpl_hallucinated_numbers(b, rng):
    org = b['entity_resolved'].split(chr(0x00b7))[0].strip()
    cx = b['entity_resolved'].split(chr(0x00b7))[1].strip()
    fake_ci = round(rng.uniform(89, 99.5), 1)
    fake_delta = round(rng.uniform(5, 45), 1)
    return (
        f"{org}'s {cx} posts composite {b['composite']:.3f} at rank "
        f"{b['peer_rank']} of {b['universe_size']}. With a {fake_ci}% "
        f"confidence interval and a year-over-year delta of {fake_delta}%, "
        f"the finding represents a statistically robust anomaly."
    )


def tmpl_hallucinated_entity(b):
    org = b['entity_resolved'].split(chr(0x00b7))[0].strip()
    cx = b['entity_resolved'].split(chr(0x00b7))[1].strip()
    return (
        f"{org}'s {cx} at {b['composite']:.3f} composite reflects the "
        f"post-GPT-4 AI inference boom, ranking them {b['peer_rank']} of "
        f"{b['universe_size']} against legacy peers including Intel, AMD, "
        f"and Qualcomm. The reconstruction score of {b['reconstruction']:.3f} "
        f"indicates their expansion into data-center accelerators."
    )


def tmpl_hallucinated_causation(b, rng):
    org = b['entity_resolved'].split(chr(0x00b7))[0].strip()
    cx = b['entity_resolved'].split(chr(0x00b7))[1].strip()
    fake_year = rng.choice([2023, 2024])
    fake_event = rng.choice([
        f"{fake_year} EPA coal-ash rule update",
        f"{fake_year} FASB revenue recognition amendment",
        f"{fake_year} SEC climate disclosure rule",
        f"{fake_year} DOE battery tax credit",
    ])
    return (
        f"{org}'s {cx} extreme ranking at {b['composite']:.3f} composite "
        f"stems from the {fake_event} that forced issuers to restate. "
        f"Anomaly at {b['anomaly']:.2f} reflects this one-time "
        f"regulatory reclassification rather than a structural pattern."
    )


def tmpl_marketing(b):
    org = b['entity_resolved'].split(chr(0x00b7))[0].strip()
    cx = b['entity_resolved'].split(chr(0x00b7))[1].strip()
    return (
        f"{org}'s {cx} delivers a revolutionary composite of "
        f"{b['composite']:.3f}, a groundbreaking result that places the "
        f"filing at a remarkable rank {b['peer_rank']} of {b['universe_size']}. "
        f"The anomaly dimension of {b['anomaly']:.2f} is unprecedented."
    )


def tmpl_wrong_concept(b):
    """Bundle is about concept X but narrative names concept Y."""
    org = b['entity_resolved'].split(chr(0x00b7))[0].strip()
    actual_cx = b['entity_resolved'].split(chr(0x00b7))[1].strip()
    # Pick some different concept to narrate about
    others = [c[1] for c in CONCEPTS if c[1] != actual_cx]
    wrong_cx = others[hash(actual_cx) % len(others)]
    return (
        f"{org}'s {wrong_cx} line posts composite {b['composite']:.3f} at rank "
        f"{b['peer_rank']} of {b['universe_size']}, with reconstruction "
        f"leading at {b['reconstruction']:.3f}. The filing pattern is "
        f"structurally typical but numerically elevated."
    )


PATTERNS = [
    ("good", tmpl_good, "good", "Correct citation; analyst tone; 2 sentences"),
    ("acc_thin", tmpl_acceptable_thin, "acceptable",
     "Correct numbers but thin; single fact per sentence; no interpretation"),
    ("acc_listy", tmpl_acceptable_listy, "acceptable",
     "Correct but lists dimensions without interpreting them"),
    ("hall_num", tmpl_hallucinated_numbers, "hallucinated",
     "Fabricates confidence-interval and YoY-delta numbers not in bundle"),
    ("hall_ent", tmpl_hallucinated_entity, "hallucinated",
     "Invents peer entities (Intel, AMD, Qualcomm) and GPT-4 context"),
    ("hall_cause", tmpl_hallucinated_causation, "hallucinated",
     "Invents regulatory causation narrative not supported by bundle"),
    ("marketing", tmpl_marketing, "hallucinated",
     "Hype language (revolutionary, groundbreaking, remarkable, unprecedented)"),
    ("wrong_cx", tmpl_wrong_concept, "hallucinated",
     "Narrates the wrong concept (entity grounding fails)"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed-fixture",
                    default=str(REPO / "lo_nlp" / "data" / "eval_narrative_fixture.json"))
    ap.add_argument("--out",
                    default=str(REPO / "lo_nlp" / "data" / "eval_narrative_fixture_large.json"))
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--per-pattern", type=int, default=8,
                    help="How many synthetic bundles to generate per label pattern")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    seed_fixture = json.loads(Path(args.seed_fixture).read_text(encoding="utf-8"))
    synthetic: list[dict] = []

    for pattern_id, tmpl, gold_label, gold_reason in PATTERNS:
        for i in range(args.per_pattern):
            entity = rng.choice(ENTITIES)
            concept = rng.choice(CONCEPTS)
            b = make_bundle(entity, concept, rng)
            # Call template with or without rng depending on its sig
            try:
                text = tmpl(b, rng)
            except TypeError:
                text = tmpl(b)
            synthetic.append({
                "id": f"synth_{pattern_id}_{i+1:02d}",
                "bundle": b,
                "narrative": text,
                "gold_label": gold_label,
                "gold_reason": gold_reason,
            })

    combined = list(seed_fixture) + synthetic
    Path(args.out).write_text(
        json.dumps(combined, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {args.out}  seed={len(seed_fixture)}  synth={len(synthetic)}  total={len(combined)}")
    # Label distribution
    from collections import Counter
    c = Counter(x["gold_label"] for x in combined)
    for label, n in c.most_common():
        print(f"  {label:<16} {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
