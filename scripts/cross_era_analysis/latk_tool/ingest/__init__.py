"""LATK ingestion adapters.

Each adapter produces a list of PaperRecord objects that can be fed
into the LATK entity builder to produce the heterogeneous entity
graph required by BTUT.

Available adapters:
- text_ingest: generic text directory ingestion (runnable now)
- arxiv_ingest: arXiv API adapter (requires network, scaffolded)
- uspto_ingest: USPTO bulk patent adapter (requires bulk download, scaffolded)
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class PaperRecord:
    """A normalized record of any technical writing ingested into LATK.

    All ingestion adapters produce this shape regardless of source
    (arXiv paper, USPTO patent, historical book chapter, etc.).
    """

    paper_id: str
    title: str
    abstract: str
    full_text: str
    authors: List[str] = field(default_factory=list)
    published_year: Optional[int] = None
    source: str = ""
    category: Optional[str] = None
    regime: Optional[str] = None
    url: Optional[str] = None
    extra: dict = field(default_factory=dict)
