"""One-shot corpus prep for the NATO Simulation vertical.

Populates ``data/nato-sim.db`` with:

    1. The AWIS briefing book (docx)
    2. The Friday Introduction deck (pptx)
    3. ~30 hand-curated starter think-tank / government sources
    4. A resolved knowledge graph built from all of the above
    5. Canonical analytical products:
         - 1 Daily Read
         - 15 Country / Actor Cards for major scenario actors

Run it ONCE tonight after the env vars are set. Expect ~5–10 minutes
(mostly LLM latency). Re-running is safe — ingestion is idempotent on
content hashes and entity canonical names — but it will spend API tokens
regenerating findings.

Usage (from the repo root):

    python backend/scripts/prep_nato_corpus.py \\
        --briefing "C:/Users/diren/Downloads/THE 2026 BRIEFING BOOK NATO 2030.docx" \\
        --friday  "C:/Users/diren/Downloads/Friday_Introduction.pptx"

Or with defaults (briefing + friday resolved from ~/Downloads):

    python backend/scripts/prep_nato_corpus.py

Fast-iteration mode (skips the 30-doc harvest):

    python backend/scripts/prep_nato_corpus.py --skip-starter

Environment required:
    ANTHROPIC_API_KEY
    NATO_SIM_MODEL_ROUTINE  (optional; default claude-sonnet-4-5)
    NATO_SIM_MODEL_DEEP     (optional; default claude-opus-4-1)
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import logging
import sys
from pathlib import Path

# Bootstrap sys.path so `from app.services.nato_sim...` works whether
# this script is run as `python backend/scripts/prep_nato_corpus.py`
# from the repo root, or as `python scripts/prep_nato_corpus.py` from
# inside backend/, or as `python -m scripts.prep_nato_corpus`.
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("prep_nato_corpus")


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# Major actors for which we pre-generate Country/Actor Cards.
# These map 1:1 with entity canonical_names that the resolver is expected
# to produce on the briefing text. If a name here doesn't appear in the
# briefing, the card for that actor will be produced with zero evidence
# and flagged LOW confidence.
MAJOR_ACTORS = [
    "Russia",
    "Ukraine",
    "Belarus",
    "Turkey",
    "United States",
    "NATO",
    "China",
    "Iran",
    "Finland",
    "Estonia",
    "Latvia",
    "Lithuania",
    "Poland",
    "Germany",
    "France",
]


async def main(args: argparse.Namespace) -> None:
    # Imports are deferred so the script can print its help without loading
    # the whole LO backend.
    from app.services.nato_sim import db
    from app.services.nato_sim.connection_finder import (
        find_hidden_connections,
        summarize_path,
    )
    from app.services.nato_sim.graph import (
        get_entity_by_name,
        top_entities_by_degree,
    )
    from app.services.nato_sim.ingest.docx_adapter import extract_docx_paragraphs
    from app.services.nato_sim.ingest.pptx_adapter import extract_pptx_slides
    from app.services.nato_sim.ingest.harvest import harvest_starter_corpus
    from app.services.nato_sim.ingest.pipeline import ingest_message
    from app.services.nato_sim.synthesizer import (
        EvidenceItem,
        SynthesizeInput,
        synthesize,
    )

    db.init_db()
    logger.info("database initialized")

    # ── 1. Briefing book ─────────────────────────────────────────────
    briefing_path = Path(args.briefing)
    if briefing_path.exists():
        paragraphs = extract_docx_paragraphs(briefing_path)
        logger.info("briefing: %d paragraphs", len(paragraphs))
        briefing_text = "\n".join(paragraphs)
        db.insert(
            "corpus_docs",
            origin="briefing",
            url=None,
            content_hash=_hash(briefing_text),
            title="NATO 2030 Briefing Book",
            text=briefing_text,
            source_tier=1,
        )
        # Feed the briefing through the ingest pipeline one chunk at a time
        # so the resolver builds the knowledge graph incrementally.
        chunks = _chunk(briefing_text, target=2000)
        logger.info("briefing: resolving %d chunks via LLM", len(chunks))
        for i, ch in enumerate(chunks):
            await ingest_message(source="briefing", content=ch)
            if (i + 1) % 5 == 0:
                logger.info("  … %d/%d briefing chunks ingested", i + 1, len(chunks))
    else:
        logger.warning("briefing file not found: %s (skipping)", briefing_path)
        paragraphs = []

    # ── 2. Friday deck ───────────────────────────────────────────────
    friday_path = Path(args.friday)
    if friday_path.exists():
        slides = extract_pptx_slides(friday_path)
        logger.info("friday deck: %d slides", len(slides))
        deck_text = "\n\n".join(f"[Slide {s.number}]\n{s.text}" for s in slides)
        db.insert(
            "corpus_docs",
            origin="friday-deck",
            url=None,
            content_hash=_hash(deck_text),
            title="Friday Introduction Deck",
            text=deck_text,
            source_tier=1,
        )
        # Resolve as one document — it's short enough.
        await ingest_message(source="friday-deck", content=deck_text)
    else:
        logger.warning("friday deck not found: %s (skipping)", friday_path)

    # ── 3. Starter corpus ────────────────────────────────────────────
    if args.skip_starter:
        logger.info("skipping starter corpus (--skip-starter)")
    else:
        starter_path = Path(args.starter)
        logger.info("harvesting starter corpus from %s", starter_path)
        harvested = await harvest_starter_corpus(starter_path)
        logger.info("starter: %d docs harvested", len(harvested))
        for doc in harvested:
            db.insert(
                "corpus_docs",
                origin=doc.origin_tag,
                url=doc.url,
                content_hash=_hash(doc.text),
                title=doc.title,
                text=doc.text,
                source_tier=doc.source_tier,
            )
        if args.resolve_starter:
            logger.info("resolving starter docs (this is slow; skip with --no-resolve-starter)")
            for doc in harvested:
                for ch in _chunk(doc.text, target=2000, max_chunks=3):
                    await ingest_message(source="crawler", content=ch, channel=doc.origin_tag)

    # ── 4. Canonical analyses ────────────────────────────────────────
    if paragraphs:
        logger.info("generating Daily Read")
        daily_evidence = [
            EvidenceItem(text=p, source=f"briefing ¶{i + 1}")
            for i, p in enumerate(paragraphs[:25])
        ]
        daily = await synthesize(
            SynthesizeInput(
                kind="daily-read",
                topic="NATO Eastern Flank — 1 April 2030 posture",
                evidence=daily_evidence,
                confidence="HIGH",
                use_deep_model=True,
            )
        )
        db.insert(
            "findings",
            topic="daily-read",
            kind="daily-read",
            text=daily,
            confidence="HIGH",
            citations=[e.source for e in daily_evidence],
        )
        logger.info("Daily Read generated (%d chars)", len(daily))

        logger.info("generating %d actor cards", len(MAJOR_ACTORS))
        for actor in MAJOR_ACTORS:
            evidence = [
                EvidenceItem(text=p, source=f"briefing ¶{i + 1}")
                for i, p in enumerate(paragraphs)
                if actor.lower() in p.lower()
            ][:10]
            if not evidence:
                logger.warning("no evidence for actor=%s; skipping card", actor)
                continue
            card = await synthesize(
                SynthesizeInput(
                    kind="actor-card",
                    topic=actor,
                    evidence=evidence,
                    confidence="MEDIUM",
                )
            )
            db.insert(
                "findings",
                topic=actor,
                kind="actor-card",
                text=card,
                confidence="MEDIUM",
                citations=[e.source for e in evidence],
            )
            logger.info("  ✓ %s", actor)

    # ── 6. Watchboard items (10 indicators) ───────────────────────────
    if paragraphs and not args.skip_watchboard:
        logger.info("generating Watchboard items")
        watchboard_topics = [
            ("Russian armor near Suwałki corridor", "russia"),
            ("Belarus succession + Russian forward presence", "belarus"),
            ("Turkish position on Article 5 / Black Sea", "turkey"),
            ("Latgale / Daugavpils unrest", "daugavpils"),
            ("Riga blackout + GPS jamming northeastern Latvia", "riga"),
            ("Neptun Deep platform sabotage status", "neptun"),
            ("Oreshnik IRBM + tactical nuke posture in Belarus", "oreshnik"),
            ("Ukrainian armistice durability", "armistice"),
            ("Hungarian government stance post-Magyar", "hungary"),
            ("NATO Baltic Defense Line readiness", "baltic"),
        ]
        for topic, key in watchboard_topics:
            try:
                evidence = [
                    EvidenceItem(text=p, source=f"briefing ¶{i + 1}")
                    for i, p in enumerate(paragraphs)
                    if key.lower() in p.lower()
                ][:6]
                if not evidence:
                    evidence = [
                        EvidenceItem(text=p, source=f"briefing ¶{i + 1}")
                        for i, p in enumerate(paragraphs[:30])
                    ][:3]
                item = await synthesize(
                    SynthesizeInput(
                        kind="watchboard-item",
                        topic=topic,
                        evidence=evidence,
                        confidence="MEDIUM",
                    )
                )
                db.insert(
                    "findings",
                    topic=topic,
                    kind="watchboard-item",
                    text=item,
                    confidence="MEDIUM",
                    citations=[e.source for e in evidence],
                )
                logger.info("  ✓ watchboard: %s", topic)
            except Exception as exc:  # noqa: BLE001
                logger.warning("  fail watchboard %s: %s", topic, exc)

    # ── 7. Dissent / Alternative View blocks ──────────────────────────
    if paragraphs and not args.skip_dissents:
        logger.info("generating Alternative View dissent blocks")
        dissent_topics = [
            "Russia is not committed to invading Latvia — military movements are coercive signaling",
            "The Belarus succession crisis is a Russian opportunity, not a Russian operation",
            "Turkey's hedging is principled neutrality, not Russian alignment",
            "Latgale unrest reflects domestic Latvian failure, not Russian active measures",
            "The Article 5 invocation will be operationally hollow without Turkish concurrence on the Black Sea",
        ]
        for topic in dissent_topics:
            try:
                evidence = [
                    EvidenceItem(text=p, source=f"briefing ¶{i + 1}")
                    for i, p in enumerate(paragraphs[:20])
                ][:6]
                d = await synthesize(
                    SynthesizeInput(
                        kind="dissent",
                        topic=topic,
                        evidence=evidence,
                        confidence="LOW",
                    )
                )
                db.insert(
                    "findings",
                    topic=topic,
                    kind="dissent",
                    text=d,
                    confidence="LOW",
                    citations=[e.source for e in evidence],
                )
                logger.info("  ✓ dissent: %s", topic[:60])
            except Exception as exc:  # noqa: BLE001
                logger.warning("  fail dissent %s: %s", topic[:50], exc)

    # ── 8. Hidden Connections (BFS through the resolved graph) ────────
    if not args.skip_hidden_connections:
        logger.info("scanning for Hidden Connections")
        # Pick the top-5 most-connected actors as roots.
        try:
            top = top_entities_by_degree(limit=5)
            for entity, deg in top:
                if entity.type != "actor":
                    continue
                paths = find_hidden_connections(
                    start_id=entity.id, max_hops=3, limit=3
                )
                if not paths:
                    continue
                # Build a finding describing each non-obvious chain.
                evidence = [
                    EvidenceItem(
                        text=f"{entity.canonical_name} {summarize_path(p)}",
                        source=f"graph:{entity.canonical_name}",
                    )
                    for p in paths[:3]
                ]
                hc = await synthesize(
                    SynthesizeInput(
                        kind="hidden-connection",
                        topic=f"Indirect linkages from {entity.canonical_name}",
                        evidence=evidence,
                        confidence="LOW",
                    )
                )
                db.insert(
                    "findings",
                    topic=entity.canonical_name,
                    kind="hidden-connection",
                    text=hc,
                    confidence="LOW",
                    citations=[e.source for e in evidence],
                )
                logger.info("  ✓ hidden-connection: %s (%d paths)", entity.canonical_name, len(paths))
        except Exception as exc:  # noqa: BLE001
            logger.warning("  fail hidden-connection scan: %s", exc)

    logger.info("prep complete.")


def _chunk(text: str, *, target: int = 2000, max_chunks: int | None = None) -> list[str]:
    """Split ``text`` into chunks of ~``target`` characters, on paragraph breaks.

    Preserves paragraph integrity where possible so the resolver gets
    semantically coherent inputs.
    """
    paras = [p.strip() for p in text.split("\n") if p.strip()]
    out: list[str] = []
    buf: list[str] = []
    size = 0
    for p in paras:
        if size + len(p) > target and buf:
            out.append("\n".join(buf))
            buf = [p]
            size = len(p)
            if max_chunks and len(out) >= max_chunks:
                break
        else:
            buf.append(p)
            size += len(p)
    if buf and (not max_chunks or len(out) < max_chunks):
        out.append("\n".join(buf))
    return out


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--briefing",
        default=str(Path.home() / "Downloads" / "THE 2026 BRIEFING BOOK NATO 2030.docx"),
        help="path to the AWIS briefing book .docx",
    )
    parser.add_argument(
        "--friday",
        default=str(Path.home() / "Downloads" / "Friday_Introduction.pptx"),
        help="path to the Friday Introduction .pptx (convert .ppt first)",
    )
    parser.add_argument(
        "--starter",
        default="backend/app/services/nato_sim/corpora/starter-nato-eastern-flank.yaml",
        help="path to the starter corpus YAML",
    )
    parser.add_argument(
        "--skip-starter",
        action="store_true",
        help="skip the 30-doc starter corpus harvest (fast iteration mode)",
    )
    parser.add_argument(
        "--resolve-starter",
        action="store_true",
        help="run the resolver over starter-doc text too (slow; adds ~5 minutes)",
    )
    parser.add_argument(
        "--skip-watchboard",
        action="store_true",
        help="skip generating the 10 Watchboard items (saves ~2 minutes)",
    )
    parser.add_argument(
        "--skip-dissents",
        action="store_true",
        help="skip generating Alternative View dissent blocks (saves ~1 minute)",
    )
    parser.add_argument(
        "--skip-hidden-connections",
        action="store_true",
        help="skip Hidden Connections scan (saves ~1 minute)",
    )
    parser.add_argument(
        "--findings-only",
        action="store_true",
        help="skip ingest+resolve; only regenerate findings against existing graph + corpus",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    try:
        asyncio.run(main(args))
    except KeyboardInterrupt:
        logger.warning("interrupted")
        sys.exit(130)
