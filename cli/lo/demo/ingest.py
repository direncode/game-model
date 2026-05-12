"""Format-aware ingest. Normalizes any supported raw input to a temporary
`corpus.ndjson` with exactly three fields per record: `id`, `text`, `label`.

The canonical OCEAN program reads `corpus.ndjson` and is identical across
every corpus in the gauntlet. The audience sees the absence of per-corpus
schema configuration — that's the substrate-status proof.

Supported input formats for the "and-now-yours" client-data path:
    .ndjson, .jsonl, .json, .csv, .tsv, .txt, .md, .pdf, .html

Pre-staged gauntlet corpora are already NDJSON; the adapter renames their
domain-specific label field to the universal `label`.
"""
from __future__ import annotations

import csv
import hashlib
import json
import mimetypes
import re
from dataclasses import dataclass
from pathlib import Path


SUPPORTED_FORMATS = (
    ".ndjson", ".jsonl", ".json", ".csv", ".tsv", ".txt", ".md", ".pdf", ".html", ".htm",
)


class IngestError(RuntimeError):
    """Raised when a source file cannot be normalized to a usable corpus."""


@dataclass
class IngestReport:
    """Summary of what the adapter did to produce a corpus.ndjson."""
    source_path: Path
    detected_format: str
    n_records_in: int
    n_records_out: int
    label_field_original: str
    label_field_renamed_to: str
    output_path: Path
    output_sha256: str

    def short_summary(self) -> str:
        return (
            f"{self.detected_format} · {self.n_records_in} → {self.n_records_out} records "
            f"· label '{self.label_field_original}' → '{self.label_field_renamed_to}'"
        )


def _detect_format(path: Path) -> str:
    """File-extension detection first, content-shape fallback second."""
    ext = path.suffix.lower()
    if ext in SUPPORTED_FORMATS:
        return ext
    mt, _ = mimetypes.guess_type(str(path))
    if mt == "application/pdf":
        return ".pdf"
    if mt in ("text/csv", "application/csv"):
        return ".csv"
    if mt in ("text/tab-separated-values",):
        return ".tsv"
    if mt in ("application/json",):
        return ".json"
    return ".txt"


def _hash_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _write_corpus(records: list[dict], output_path: Path) -> str:
    """Write records as NDJSON with deterministic key order. Returns SHA-256.

    Key order is fixed (`id`, `text`, `label`) and JSON keys are sorted so
    that the same input yields a byte-identical output every time, on every
    machine. This is the input side of OCEAN's determinism contract.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as f:
        for rec in records:
            line = json.dumps(
                {"id": rec["id"], "text": rec["text"], "label": rec["label"]},
                ensure_ascii=False,
                sort_keys=False,
            )
            f.write(line.encode("utf-8") + b"\n")
    return _hash_file(output_path)


def normalize_bundled_corpus(
    source_path: Path,
    label_field: str,
    output_path: Path,
) -> IngestReport:
    """Rename a pre-staged NDJSON corpus's label field to `label`.

    Used by the gauntlet: each of the five bundled corpora arrives in
    NDJSON shape with a domain-specific label (e.g. `primary_class` for
    patents). This adapter projects the three universal fields and writes
    a temporary corpus.ndjson the OCEAN program will load.
    """
    if not source_path.exists():
        raise IngestError(f"bundled corpus missing: {source_path}")

    records: list[dict] = []
    with source_path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                raise IngestError(f"{source_path}:{i + 1}: bad JSON: {e}") from e
            if "id" not in obj or "text" not in obj:
                raise IngestError(
                    f"{source_path}:{i + 1}: missing required field id/text"
                )
            if label_field not in obj:
                raise IngestError(
                    f"{source_path}:{i + 1}: declared label field "
                    f"'{label_field}' not present"
                )
            records.append({
                "id": str(obj["id"]),
                "text": str(obj["text"]),
                "label": str(obj[label_field]),
            })

    out_sha = _write_corpus(records, output_path)
    return IngestReport(
        source_path=source_path,
        detected_format=".ndjson",
        n_records_in=len(records),
        n_records_out=len(records),
        label_field_original=label_field,
        label_field_renamed_to="label",
        output_path=output_path,
        output_sha256=out_sha,
    )


def _records_from_ndjson(path: Path) -> list[dict]:
    out: list[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            out.append(json.loads(line))
    return out


def _records_from_json(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "records" in data:
        return list(data["records"])
    raise IngestError(
        f"{path}: top-level JSON must be a list or have a 'records' array"
    )


def _records_from_csv(path: Path, delim: str) -> list[dict]:
    out: list[dict] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=delim)
        for i, row in enumerate(reader):
            out.append({"_csv_row_index": i, **row})
    return out


_PARAGRAPH_RE = re.compile(r"\n\s*\n")


def _records_from_text(path: Path) -> list[dict]:
    """One record per paragraph, stratified into ~5 length buckets as label."""
    text = path.read_text(encoding="utf-8", errors="replace")
    paras = [p.strip() for p in _PARAGRAPH_RE.split(text) if p.strip()]
    out: list[dict] = []
    for i, p in enumerate(paras):
        out.append({"_para_index": i, "_text": p})
    return out


def _records_from_pdf(path: Path) -> list[dict]:
    """One record per page. Soft-fails if pdfplumber is unavailable."""
    try:
        import pdfplumber  # type: ignore[import-not-found]
    except ImportError as e:
        raise IngestError(
            "PDF ingest requires `pdfplumber` (pip install pdfplumber)"
        ) from e
    out: list[dict] = []
    with pdfplumber.open(str(path)) as pdf:
        for i, page in enumerate(pdf.pages):
            txt = (page.extract_text() or "").strip()
            if txt:
                out.append({"_page_index": i, "_text": txt})
    return out


def _records_from_html(path: Path) -> list[dict]:
    """Best-effort: split by <p>, fall back to text-extract."""
    html = path.read_text(encoding="utf-8", errors="replace")
    # Cheap split: strip tags between paragraphs. Good enough for demo.
    bodies = re.findall(r"<p[^>]*>(.*?)</p>", html, flags=re.DOTALL | re.IGNORECASE)
    if bodies:
        cleaned = [re.sub(r"<[^>]+>", " ", b).strip() for b in bodies]
        return [
            {"_html_p_index": i, "_text": c}
            for i, c in enumerate(cleaned) if c
        ]
    stripped = re.sub(r"<[^>]+>", " ", html)
    stripped = re.sub(r"\s+", " ", stripped).strip()
    return [{"_para_index": 0, "_text": stripped}]


def _pick_text_field(rec: dict) -> str:
    """Find the best text field in a heterogeneous record."""
    for key in ("text", "body", "content", "description", "abstract", "_text"):
        v = rec.get(key)
        if isinstance(v, str) and v.strip():
            return v
    # Concatenate every string value as a last resort.
    parts: list[str] = []
    for v in rec.values():
        if isinstance(v, str) and v.strip():
            parts.append(v)
    return " ".join(parts) if parts else "(empty)"


def _pick_or_synthesize_label(rec: dict) -> str:
    """Pick an existing label field if present; otherwise synthesize one
    from byte-bucketing the text (so stratified sampling still works)."""
    for key in ("label", "category", "class", "type", "source_type", "sector",
                "era", "primary_class", "form_type", "directorate", "form"):
        v = rec.get(key)
        if isinstance(v, (str, int, float)) and str(v).strip():
            return str(v)
    txt = _pick_text_field(rec)
    bucket = (len(txt) // 100) % 5  # 5 synthetic buckets by length
    return f"bucket_{bucket}"


def normalize_client_file(source_path: Path, output_path: Path) -> IngestReport:
    """The "and-now-yours" path. Auto-detect format, extract records,
    normalize to id/text/label, write a corpus.ndjson.
    """
    if not source_path.exists():
        raise IngestError(f"file not found: {source_path}")
    if source_path.stat().st_size == 0:
        raise IngestError(f"file is empty: {source_path}")

    fmt = _detect_format(source_path)
    raw: list[dict]
    if fmt in (".ndjson", ".jsonl"):
        raw = _records_from_ndjson(source_path)
    elif fmt == ".json":
        raw = _records_from_json(source_path)
    elif fmt == ".csv":
        raw = _records_from_csv(source_path, ",")
    elif fmt == ".tsv":
        raw = _records_from_csv(source_path, "\t")
    elif fmt in (".txt", ".md"):
        raw = _records_from_text(source_path)
    elif fmt == ".pdf":
        raw = _records_from_pdf(source_path)
    elif fmt in (".html", ".htm"):
        raw = _records_from_html(source_path)
    else:
        raise IngestError(
            f"format '{fmt}' is not supported by the gauntlet adapter. "
            f"Supported: {', '.join(SUPPORTED_FORMATS)}."
        )

    if not raw:
        raise IngestError(f"no records extracted from {source_path}")
    if len(raw) < 20:
        raise IngestError(
            f"only {len(raw)} records extracted from {source_path}; "
            f"need ≥ 20 for substrate clustering to be meaningful"
        )

    # Pick the label key from the first record's apparent schema.
    first_label = _pick_or_synthesize_label(raw[0])
    label_origin = "(synthesized)"
    for key in ("label", "category", "class", "type", "source_type", "sector",
                "era", "primary_class", "form_type", "directorate", "form"):
        if key in raw[0] and isinstance(raw[0].get(key), (str, int, float)):
            label_origin = key
            break

    records: list[dict] = []
    for i, rec in enumerate(raw):
        rec_id = str(rec.get("id") or rec.get("_para_index") or
                     rec.get("_page_index") or rec.get("_html_p_index") or
                     rec.get("_csv_row_index") or i)
        records.append({
            "id": f"client-{rec_id}",
            "text": _pick_text_field(rec),
            "label": _pick_or_synthesize_label(rec),
        })
    _ = first_label  # explicit: we use per-record labels, first_label is just probe

    out_sha = _write_corpus(records, output_path)
    return IngestReport(
        source_path=source_path,
        detected_format=fmt,
        n_records_in=len(raw),
        n_records_out=len(records),
        label_field_original=label_origin,
        label_field_renamed_to="label",
        output_path=output_path,
        output_sha256=out_sha,
    )
