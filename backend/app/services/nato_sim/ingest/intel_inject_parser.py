"""Parse multi-message intel-inject pastes from the AWIS Discord channel.

The control team's Discord bot (Quiver) emits messages in a structured
format with a recurring marker:

    📡 INTEL INJECT
    EXERCISE [classification]
    FROM: [originator]
    TO: [recipients]
    SUBJECT: [subject]
    DTG: [date-time group]

    [body]

    [optional handling caveats]
    Sent by C2•Today at HH:MM AM

The operator typically pastes multiple injects at once (often with each
inject duplicated by Discord's threading). This module splits the paste
into discrete blocks, parses each, and dedupes by content hash.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass, field


# Marker can appear with or without the emoji depending on copy-paste.
_MARKER_RE = re.compile(r"(?:📡\s*)?INTEL\s+INJECT", re.IGNORECASE)

_FIELD_RES = {
    "classification": re.compile(r"EXERCISE\s+([^\n]+)", re.IGNORECASE),
    "from": re.compile(r"FROM\s*:\s*([^\n]+)", re.IGNORECASE),
    "to": re.compile(r"TO\s*:\s*([^\n]+)", re.IGNORECASE),
    "subject": re.compile(r"SUBJECT\s*:\s*([^\n]+)", re.IGNORECASE),
    "dtg": re.compile(r"DTG\s*:\s*([^\n]+)", re.IGNORECASE),
}

# Body is everything between DTG line and the "Sent by C2" footer
_BODY_RE = re.compile(
    r"DTG\s*:\s*[^\n]+\n+(.*?)(?:Sent by C2|Inter-team communication|$)",
    re.DOTALL | re.IGNORECASE,
)

_FOOTER_TS_RE = re.compile(r"Today at (\d{1,2}:\d{2}\s*[AP]M)", re.IGNORECASE)


@dataclass(frozen=True)
class IntelInject:
    classification: str
    source_from: str
    recipients: list[str]
    subject: str
    dtg: str
    body: str
    raw: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _split_blocks(text: str) -> list[str]:
    """Split a paste into individual INTEL INJECT blocks."""
    if not text or not text.strip():
        return []
    positions = [m.start() for m in _MARKER_RE.finditer(text)]
    if not positions:
        return [text]
    blocks: list[str] = []
    for i, start in enumerate(positions):
        end = positions[i + 1] if i + 1 < len(positions) else len(text)
        blocks.append(text[start:end])
    return blocks


def _parse_block(block: str) -> IntelInject | None:
    m_from = _FIELD_RES["from"].search(block)
    m_to = _FIELD_RES["to"].search(block)
    m_subject = _FIELD_RES["subject"].search(block)
    if not (m_from or m_to or m_subject):
        return None  # not a valid inject

    m_class = _FIELD_RES["classification"].search(block)
    m_dtg = _FIELD_RES["dtg"].search(block)
    body_match = _BODY_RE.search(block)
    body = body_match.group(1).strip() if body_match else ""

    to_text = m_to.group(1).strip() if m_to else ""
    # Recipients are comma- or slash-separated; strip any bracketed sections.
    to_text = re.sub(r"\[[^\]]*\]", "", to_text)
    recipients = [r.strip(" ()[]") for r in re.split(r"[,/]", to_text) if r.strip(" ()[]")]

    return IntelInject(
        classification=(m_class.group(1).strip() if m_class else "").strip(),
        source_from=(m_from.group(1).strip() if m_from else "").strip(),
        recipients=recipients,
        subject=(m_subject.group(1).strip() if m_subject else "").strip(),
        dtg=(m_dtg.group(1).strip() if m_dtg else "").strip(),
        body=body,
        raw=block.strip(),
    )


def parse_paste(text: str) -> list[IntelInject]:
    """Parse a multi-inject paste, deduping by content."""
    blocks = _split_blocks(text)
    out: list[IntelInject] = []
    seen: set[str] = set()
    for block in blocks:
        parsed = _parse_block(block)
        if not parsed:
            continue
        key_src = f"{parsed.subject}|{parsed.dtg}|{parsed.body[:300]}"
        key = hashlib.sha256(key_src.encode("utf-8", errors="ignore")).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        out.append(parsed)
    return out


def classify_level(classification: str) -> str:
    """Map a classification string to a normalized level for UI tagging."""
    c = (classification or "").upper()
    if "TOP SECRET" in c or "TS//" in c:
        return "TS"
    if "SECRET" in c:
        return "S"
    if "CONFIDENTIAL" in c or "CUI" in c or "FOUO" in c:
        return "CUI"
    if "OPEN SOURCE" in c or "OSINT" in c or "UNCLASS" in c:
        return "U"
    return "U"


def source_kind(classification: str, source_from: str) -> str:
    """Heuristic: SIGINT, HUMINT, GEOINT, OSINT, MASINT, SOCIAL, OFFICIAL."""
    c = (classification or "").upper() + " " + (source_from or "").upper()
    if "HUMINT" in c or "CHS" in c:
        return "HUMINT"
    if "SIGINT" in c or "NSA" in c or "NSOC" in c:
        return "SIGINT"
    if "GEOINT" in c or "NGA" in c:
        return "GEOINT"
    if "MASINT" in c:
        return "MASINT"
    if "SOCIAL MEDIA" in c or "@" in (source_from or ""):
        return "SOCIAL"
    if "OPEN SOURCE" in c or "OSINT" in c or "OSE" in c or "OSC" in c:
        return "OSINT"
    if "STATE" in c or "DEPARTMENT" in c or "MINISTRY" in c:
        return "OFFICIAL"
    return "OTHER"
