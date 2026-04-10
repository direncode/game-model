"""Corpus loading, chunking, and entity generation for CET."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None


@dataclass
class DocumentEntry:
    """A single document in the corpus manifest."""
    id: str
    title: str
    year: int | None
    regime: str
    file: str  # relative path to document text file


@dataclass
class RegimeDefinition:
    """A physics/math regime definition with paradigm-specific keyword groups."""
    name: str
    description: str
    keyword_groups: dict[str, list[str]]


@dataclass
class CETConfig:
    """Configuration for a CET analysis run."""
    corpus_name: str
    documents: list[DocumentEntry]
    regimes: list[RegimeDefinition]
    chunk_target_words: int = 15
    btut_enabled: bool = True
    btut_target_survivors: int = 500

    @property
    def regime_names(self) -> list[str]:
        return [r.name for r in self.regimes]


def load_config(corpus_dir: Path) -> CETConfig:
    """Load manifest.yaml and config.yaml from a corpus directory.

    Corpus layout:
        corpus_dir/
            manifest.yaml
            config.yaml
            documents/
                *.txt
    """
    if yaml is None:
        raise RuntimeError(
            "PyYAML is required for CET. Install with: pip install pyyaml"
        )

    corpus_dir = Path(corpus_dir)
    manifest_path = corpus_dir / "manifest.yaml"
    config_path = corpus_dir / "config.yaml"

    if not manifest_path.exists():
        raise FileNotFoundError(f"manifest.yaml not found in {corpus_dir}")
    if not config_path.exists():
        raise FileNotFoundError(f"config.yaml not found in {corpus_dir}")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = yaml.safe_load(f)
    with open(config_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    documents = [
        DocumentEntry(
            id=d["id"],
            title=d["title"],
            year=d.get("year"),
            regime=d["regime"],
            file=d["file"],
        )
        for d in manifest.get("documents", [])
    ]

    regimes = [
        RegimeDefinition(
            name=r["name"],
            description=r.get("description", ""),
            keyword_groups=r.get("keyword_groups", {}),
        )
        for r in cfg.get("regimes", [])
    ]

    return CETConfig(
        corpus_name=manifest.get("corpus_name", "Unnamed Corpus"),
        documents=documents,
        regimes=regimes,
        chunk_target_words=cfg.get("chunk_target_words", 15),
        btut_enabled=cfg.get("btut", {}).get("enabled", True),
        btut_target_survivors=cfg.get("btut", {}).get("target_survivors", 500),
    )


def strip_header(text: str) -> str:
    """Remove SOURCE/CITATION header lines from a document body."""
    lines = text.split("\n", 3)
    if len(lines) >= 3 and lines[0].startswith("SOURCE:"):
        return lines[2] if len(lines) >= 3 else ""
    return text


def chunk_text(text: str, target_words: int = 15) -> list[str]:
    """Chunk text into fixed-size word chunks. Returns chunks with 5+ words."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), target_words):
        chunk = " ".join(words[i : i + target_words])
        if len(chunk.split()) >= 5:
            chunks.append(chunk)
    return chunks


def load_document(doc: DocumentEntry, corpus_dir: Path) -> str:
    """Load a document's body text (with header stripped)."""
    doc_path = corpus_dir / doc.file
    if not doc_path.exists():
        raise FileNotFoundError(f"Document file not found: {doc_path}")
    with open(doc_path, "r", encoding="utf-8") as f:
        text = f.read()
    return strip_header(text)


def build_entities_and_edges(
    config: CETConfig, corpus_dir: Path
) -> tuple[list[dict], list[dict]]:
    """Chunk all documents and build entity + relationship lists for BTUT.

    Returns (entities, relationships) ready for run_btut_pipeline.
    """
    entities = []
    relationships = []

    chunks_by_doc = {}

    for doc in config.documents:
        try:
            text = load_document(doc, corpus_dir)
        except FileNotFoundError:
            continue

        chunks = chunk_text(text, target_words=config.chunk_target_words)
        if not chunks:
            continue

        chunk_ids = []
        for i, chunk_text_ in enumerate(chunks):
            chunk_id = f"{doc.id}__c{i:03d}"
            entities.append({
                "name": chunk_id,
                "type": "document_chunk",
                "attributes": {
                    "text": chunk_text_,
                    "parent_document": doc.id,
                    "document_title": doc.title,
                    "document_year": doc.year,
                    "physics_regime": doc.regime,
                    "chunk_index": i,
                },
            })
            chunk_ids.append(chunk_id)

        chunks_by_doc[doc.id] = chunk_ids

        # Sequential edges within document
        for i in range(len(chunk_ids) - 1):
            relationships.append({
                "source": chunk_ids[i],
                "target": chunk_ids[i + 1],
                "type": "next_chunk",
                "weight": 0.9,
            })

    return entities, relationships
