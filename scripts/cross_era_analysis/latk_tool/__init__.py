"""LATK: Lineage Atlas of Technical Knowledge.

Extends the CET tool with ingestion adapters, a novelty query module,
and scaling infrastructure for the LATK program.

LATK is the structural atlas of all preserved human technical knowledge,
computed by running the BTUT + CET pipeline validated across five
independent domains on the full heterogeneous corpus of historical and
modern technical writing.

Phases
------
Phase 0: Foundations (scaffolding, ingestion adapters, novelty query,
         multi-domain scaling test at ~8000 entities)
Phase 1: Physics at scale (~5-20M entities from arXiv + USPTO + historical)
Phase 2: STEM-complete (~200-500M entities from arXiv + PubMed + patents)
Phase 3: All-knowledge (~2-5B entities including multilingual historical)

See docs/plans/2026-04-10-latk-design.md and
docs/plans/2026-04-10-latk-implementation-plan.md
"""

__version__ = "0.1.0"
