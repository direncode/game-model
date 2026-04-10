"""Command-line interface for CET."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from .corpus import load_config, build_entities_and_edges
from .discriminator import classify_corpus, classification_accuracy


def cmd_validate(args) -> int:
    """Validate a corpus directory's manifest and config."""
    corpus_dir = Path(args.corpus_dir)
    try:
        config = load_config(corpus_dir)
    except FileNotFoundError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"ERROR: Failed to load config: {e}", file=sys.stderr)
        return 1

    print(f"Corpus: {config.corpus_name}")
    print(f"Documents in manifest: {len(config.documents)}")
    print(f"Regimes defined:       {len(config.regimes)}")
    print()

    # Check file existence
    missing = []
    for doc in config.documents:
        doc_path = corpus_dir / doc.file
        if not doc_path.exists():
            missing.append(doc.file)

    if missing:
        print(f"MISSING FILES ({len(missing)}):")
        for m in missing:
            print(f"  {m}")
        return 1

    # Check regime references
    defined_regime_names = set(config.regime_names)
    for doc in config.documents:
        if doc.regime not in defined_regime_names:
            print(
                f"WARNING: document {doc.id} uses regime '{doc.regime}' "
                f"not defined in config.yaml"
            )

    print("Manifest and config are valid.")

    # Print regime summary
    regime_counts = Counter(d.regime for d in config.documents)
    print()
    print("Documents per regime:")
    for r, c in sorted(regime_counts.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}")

    return 0


def cmd_classify(args) -> int:
    """Run the keyword discriminator only (no BTUT)."""
    corpus_dir = Path(args.corpus_dir)
    config = load_config(corpus_dir)

    print(f"CET Classify — {config.corpus_name}")
    print(f"Running keyword discriminator on {len(config.documents)} documents...")
    print()

    classifications = classify_corpus(config, corpus_dir)

    if not classifications:
        print("ERROR: No documents could be loaded or classified.")
        return 1

    print(f"{'Document':45s} {'Year':>6} {'Expected':>25} {'Predicted':>25} {'Margin':>8}")
    print("-" * 115)
    for c in classifications:
        correct = "[OK]" if c.predicted_regime == c.expected_regime else "[NO]"
        print(
            f"{c.doc_id[:45]:45s} {c.year!s:>6} "
            f"{c.expected_regime[:25]:>25} {c.predicted_regime[:25]:>25} "
            f"{c.margin:>7.1f}x {correct}"
        )

    correct, total, accuracy = classification_accuracy(classifications)
    print()
    print(f"Accuracy: {correct}/{total} ({accuracy:.1f}%)")

    # Save report
    report = {
        "corpus": config.corpus_name,
        "accuracy": {
            "correct": correct,
            "total": total,
            "percentage": accuracy,
        },
        "classifications": [
            {
                "id": c.doc_id,
                "title": c.title,
                "year": c.year,
                "expected": c.expected_regime,
                "predicted": c.predicted_regime,
                "margin": c.margin,
                "scores": c.scores_by_regime,
                "correct": c.predicted_regime == c.expected_regime,
            }
            for c in classifications
        ],
    }

    out_path = corpus_dir / "cet_classify_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Report saved to {out_path}")
    return 0


def cmd_build(args) -> int:
    """Build BTUT entity + relationship files from corpus."""
    corpus_dir = Path(args.corpus_dir)
    config = load_config(corpus_dir)

    print(f"CET Build — {config.corpus_name}")
    print(f"Chunking at {config.chunk_target_words} words per chunk...")

    entities, relationships = build_entities_and_edges(config, corpus_dir)

    print(f"Entities generated: {len(entities)}")
    print(f"Relationships generated: {len(relationships)}")

    regime_counts = Counter(e["attributes"]["physics_regime"] for e in entities)
    print()
    print("Entities per regime:")
    for r, c in sorted(regime_counts.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}")

    out_path = corpus_dir / "cet_btut_input.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"entities": entities, "relationships": relationships}, f, indent=2)
    print()
    print(f"BTUT input written to {out_path}")
    print(
        f"Entities: {len(entities)} (BTUT full-signal threshold: 1000+)"
    )
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="cet",
        description="Cross-Era Technology Detection Tool",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_val = sub.add_parser("validate", help="Validate manifest and config")
    p_val.add_argument("corpus_dir", help="Path to corpus directory")
    p_val.set_defaults(func=cmd_validate)

    p_cls = sub.add_parser("classify", help="Run keyword discriminator only")
    p_cls.add_argument("corpus_dir", help="Path to corpus directory")
    p_cls.set_defaults(func=cmd_classify)

    p_bld = sub.add_parser("build", help="Build BTUT entity + edge files")
    p_bld.add_argument("corpus_dir", help="Path to corpus directory")
    p_bld.set_defaults(func=cmd_build)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
