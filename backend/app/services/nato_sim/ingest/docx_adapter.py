"""DOCX → text for the NATO Simulation corpus prep.

Uses python-docx, which is already installed in the LO backend. Returns
a list of non-empty paragraphs in reading order.
"""

from __future__ import annotations

from pathlib import Path


def extract_docx_paragraphs(path: str | Path) -> list[str]:
    """Return all non-empty paragraphs from a .docx file.

    Section and style metadata is intentionally discarded — the resolver
    works on plain text, and text ordering is the only structure that
    matters for graph construction.
    """
    import docx  # local import so the module loads even if python-docx is missing

    doc = docx.Document(str(path))
    return [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]


def docx_as_single_document(path: str | Path) -> str:
    """Return the entire document as one newline-joined string."""
    return "\n".join(extract_docx_paragraphs(path))
