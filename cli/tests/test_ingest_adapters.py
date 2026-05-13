"""Unit tests for the ingest adapters.

The "and-now-yours" path lives or dies on these functions. A customer
drops a file at the demo terminal and the adapter has microseconds to
normalize it into a deterministic ``corpus.ndjson``. We test:

* Format detection on extension + MIME fallback.
* NDJSON / JSON / CSV / TSV / text / HTML round-trips produce ≥ 1
  record and the right id/text/label triple.
* Bundled-corpus normalization preserves byte-identity across runs.
* Bad inputs raise :class:`IngestError` cleanly (no traceback escape).
"""
from __future__ import annotations

import csv
import json
import textwrap
from pathlib import Path

import pytest

from lo.demo import ingest


# ── format detection ────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "name,expected",
    [
        ("a.ndjson", ".ndjson"),
        ("a.jsonl", ".jsonl"),
        ("a.json", ".json"),
        ("a.csv", ".csv"),
        ("a.tsv", ".tsv"),
        ("a.txt", ".txt"),
        ("a.md", ".md"),
        ("a.html", ".html"),
        ("a.htm", ".htm"),
        ("a.pdf", ".pdf"),
        # Unknown extensions degrade to .txt rather than raising.
        ("noext", ".txt"),
        ("a.bogus", ".txt"),
    ],
)
def test_detect_format(tmp_path: Path, name: str, expected: str) -> None:
    p = tmp_path / name
    p.write_text("dummy", encoding="utf-8")
    assert ingest._detect_format(p) == expected


# ── bundled-corpus normalization (deterministic) ────────────────────────

def test_normalize_bundled_corpus_deterministic(tmp_path: Path) -> None:
    """Same input + same label_field => byte-identical output every run."""
    src = tmp_path / "src.ndjson"
    src.write_text(
        "\n".join([
            json.dumps({"id": "r1", "text": "hello world", "archive": "A"}),
            json.dumps({"id": "r2", "text": "second line", "archive": "B"}),
            json.dumps({"id": "r3", "text": "third row",   "archive": "A"}),
        ]) + "\n",
        encoding="utf-8",
    )
    out1 = tmp_path / "out1.ndjson"
    out2 = tmp_path / "out2.ndjson"
    r1 = ingest.normalize_bundled_corpus(src, "archive", out1)
    r2 = ingest.normalize_bundled_corpus(src, "archive", out2)
    assert out1.read_bytes() == out2.read_bytes()
    assert r1.output_sha256 == r2.output_sha256
    assert r1.n_records_out == 3
    assert r1.label_field_renamed_to == "label"


def test_normalize_bundled_corpus_rejects_missing_label(tmp_path: Path) -> None:
    src = tmp_path / "src.ndjson"
    src.write_text(
        json.dumps({"id": "r1", "text": "x"}) + "\n",
        encoding="utf-8",
    )
    out = tmp_path / "out.ndjson"
    with pytest.raises(ingest.IngestError, match="not present"):
        ingest.normalize_bundled_corpus(src, "missing_field", out)


def test_normalize_bundled_corpus_rejects_bad_json(tmp_path: Path) -> None:
    src = tmp_path / "src.ndjson"
    src.write_text("{not even json}\n", encoding="utf-8")
    out = tmp_path / "out.ndjson"
    with pytest.raises(ingest.IngestError, match="bad JSON"):
        ingest.normalize_bundled_corpus(src, "label", out)


# ── client-file normalization across formats ────────────────────────────

@pytest.fixture
def thirty_paragraph_text() -> str:
    """≥ 20 records required by ``normalize_client_file``."""
    return "\n\n".join(
        f"This is paragraph number {i} with enough length to register as a record."
        for i in range(1, 31)
    )


def test_normalize_client_file_ndjson(tmp_path: Path) -> None:
    src = tmp_path / "client.ndjson"
    src.write_text(
        "\n".join(
            json.dumps({"id": f"r{i}", "text": f"row {i}", "category": "A"})
            for i in range(25)
        ) + "\n",
        encoding="utf-8",
    )
    out = tmp_path / "out.ndjson"
    report = ingest.normalize_client_file(src, out)
    assert report.detected_format == ".ndjson"
    assert report.n_records_out == 25
    assert report.label_field_original == "category"
    # Every output record has exactly {id, text, label}.
    for line in out.read_text(encoding="utf-8").splitlines():
        rec = json.loads(line)
        assert set(rec.keys()) == {"id", "text", "label"}
        assert rec["id"].startswith("client-")


def test_normalize_client_file_csv(tmp_path: Path) -> None:
    src = tmp_path / "client.csv"
    with src.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "text", "label"])
        for i in range(25):
            w.writerow([f"id{i}", f"text {i}", f"L{i % 3}"])
    out = tmp_path / "out.ndjson"
    report = ingest.normalize_client_file(src, out)
    assert report.detected_format == ".csv"
    assert report.n_records_out == 25


def test_normalize_client_file_text(tmp_path: Path, thirty_paragraph_text: str) -> None:
    src = tmp_path / "client.txt"
    src.write_text(thirty_paragraph_text, encoding="utf-8")
    out = tmp_path / "out.ndjson"
    report = ingest.normalize_client_file(src, out)
    assert report.detected_format == ".txt"
    assert report.n_records_out >= 25
    first = json.loads(out.read_text(encoding="utf-8").splitlines()[0])
    assert first["text"]


def test_normalize_client_file_html(tmp_path: Path) -> None:
    paras = "\n".join(
        f"<p>Paragraph {i} with content that should land as a record.</p>"
        for i in range(1, 26)
    )
    src = tmp_path / "client.html"
    src.write_text(f"<html><body>{paras}</body></html>", encoding="utf-8")
    out = tmp_path / "out.ndjson"
    report = ingest.normalize_client_file(src, out)
    assert report.detected_format == ".html"
    assert report.n_records_out >= 20


# ── malformed / hostile input fuzz ──────────────────────────────────────

def test_empty_file_rejected(tmp_path: Path) -> None:
    src = tmp_path / "empty.ndjson"
    src.write_text("", encoding="utf-8")
    out = tmp_path / "out.ndjson"
    with pytest.raises(ingest.IngestError, match="empty"):
        ingest.normalize_client_file(src, out)


def test_too_few_records_rejected(tmp_path: Path) -> None:
    src = tmp_path / "client.ndjson"
    src.write_text(
        "\n".join(json.dumps({"id": f"r{i}", "text": f"row {i}"}) for i in range(5)) + "\n",
        encoding="utf-8",
    )
    out = tmp_path / "out.ndjson"
    with pytest.raises(ingest.IngestError, match="need"):
        ingest.normalize_client_file(src, out)


def test_unsupported_format_rejected(tmp_path: Path) -> None:
    src = tmp_path / "client.xyz"
    src.write_text("blah", encoding="utf-8")
    # `.xyz` falls through detect_format to `.txt`, but the file has no
    # paragraphs, so we expect an empty-records error after parsing.
    out = tmp_path / "out.ndjson"
    with pytest.raises(ingest.IngestError):
        ingest.normalize_client_file(src, out)


def test_nonexistent_file_rejected(tmp_path: Path) -> None:
    out = tmp_path / "out.ndjson"
    with pytest.raises(ingest.IngestError, match="not found"):
        ingest.normalize_client_file(tmp_path / "doesnotexist.ndjson", out)


def test_pdf_without_pdfplumber_raises_cleanly(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """If the user dumps a PDF and pdfplumber isn't installed, we want a
    legible error, not a bare ImportError leaked from the adapter."""
    src = tmp_path / "client.pdf"
    src.write_bytes(b"%PDF-1.4\nfake pdf bytes\n")
    out = tmp_path / "out.ndjson"

    # Pretend pdfplumber import fails.
    import builtins
    real_import = builtins.__import__

    def fake_import(name: str, *a, **kw):
        if name == "pdfplumber":
            raise ImportError("pretend it's missing")
        return real_import(name, *a, **kw)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    with pytest.raises(ingest.IngestError, match="pdfplumber"):
        ingest.normalize_client_file(src, out)


# ── injection / weird content fuzz ──────────────────────────────────────

@pytest.mark.parametrize(
    "raw",
    [
        '{"id":"r1","text":"a\\u0000b","label":"x"}',
        '{"id":"r1","text":"' + ("x" * 100_000) + '","label":"x"}',
        '{"id":"r1","text":"\\u202eRTLO\\u202c \\ud83d\\ude00","label":"\\u4e2d\\u6587"}',
    ],
    ids=["nul-bytes", "100k-text", "rtl-and-cjk-emoji"],
)
def test_bundled_corpus_handles_pathological_records(tmp_path: Path, raw: str) -> None:
    src = tmp_path / "src.ndjson"
    src.write_text("\n".join([raw] * 5) + "\n", encoding="utf-8")
    out = tmp_path / "out.ndjson"
    report = ingest.normalize_bundled_corpus(src, "label", out)
    assert report.n_records_out == 5
