"""Build the OCEAN Handbook as a single PDF.

Reads `docs/handbook/*.md` in canonical order, converts each to HTML with
the markdown library, concatenates the results inside a print-shaped
HTML wrapper, and renders the whole thing to PDF via xhtml2pdf.

The output is `frontend/public/ocean-handbook.pdf` so it ships as a
static asset of the Next.js site and can be linked from anywhere.

Usage:
    python -m scripts.handbook.build_pdf
    python -m scripts.handbook.build_pdf --output frontend/public/ocean-handbook.pdf

Exit codes:
    0   PDF generated successfully
    1   Source file missing or unreadable
    2   PDF rendering failed
"""
from __future__ import annotations

import argparse
import html as html_lib
import io
import re
import sys
from pathlib import Path

import markdown
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from xhtml2pdf import pisa


def _register_unicode_fonts() -> str | None:
    """Register an OS-available Unicode TTF font so chars like sigma render.

    Returns the CSS font-family name to use, or None if no font found.
    Tries Arial first (Windows / macOS), then DejaVu Sans (Linux).
    """
    candidates = [
        ("Arial", [
            "C:/Windows/Fonts/arial.ttf",
            "/Library/Fonts/Arial.ttf",
        ], "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/ariali.ttf", "C:/Windows/Fonts/arialbi.ttf"),
        ("DejaVu Sans", [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        ], "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
           "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
           "/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf"),
    ]
    for name, regulars, bold, italic, bolditalic in candidates:
        regular_path = next((p for p in regulars if Path(p).exists()), None)
        if regular_path is None:
            continue
        try:
            pdfmetrics.registerFont(TTFont(name, regular_path))
            if Path(bold).exists():
                pdfmetrics.registerFont(TTFont(f"{name}-Bold", bold))
            if Path(italic).exists():
                pdfmetrics.registerFont(TTFont(f"{name}-Italic", italic))
            if Path(bolditalic).exists():
                pdfmetrics.registerFont(TTFont(f"{name}-BoldItalic", bolditalic))
            pdfmetrics.registerFontFamily(
                name,
                normal=name,
                bold=f"{name}-Bold" if Path(bold).exists() else name,
                italic=f"{name}-Italic" if Path(italic).exists() else name,
                boldItalic=f"{name}-BoldItalic" if Path(bolditalic).exists() else name,
            )
            return name
        except Exception:
            continue
    return None


HANDBOOK_DIR = Path("docs/handbook")
DEFAULT_OUTPUT = Path("frontend/public/ocean-handbook.pdf")

# Canonical reading order. Front matter, then chapters by number, then
# appendices in lettered order. Index is omitted because its content is
# the table of contents that this PDF already builds front and centre.
ORDER = [
    "00-preface.md",
    "01-what-ocean-is.md",
    "02-your-first-pipeline.md",
    "03-source-files-and-tokens.md",
    "04-the-pipeline-types.md",
    "05-load-and-records.md",
    "06-embed-and-z.md",
    "07-cluster-and-modules.md",
    "08-align-and-find.md",
    "09-save-and-the-determinism-contract.md",
    "10-control-flow.md",
    "11-functions-modules-stdlib.md",
    "12-tooling-and-the-lsp.md",
    "13-effective-ocean.md",
    "14-interfacing-ocean.md",
    "app-a-grammar.md",
    "app-b-operator-catalog.md",
    "app-c-primitive-spec-companion.md",
    "app-d-glossary.md",
    "app-e-reference-card.md",
    "app-f-exercise-solutions.md",
]

_FRONTMATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)
_TITLE_RE = re.compile(r"^title:\s*['\"]?(.+?)['\"]?\s*$", re.MULTILINE)


PRINT_CSS = """
@page {
    size: A4;
    margin: 2.5cm 2cm 2.5cm 2cm;
    @frame footer {
        -pdf-frame-content: footerContent;
        left: 2cm; right: 2cm;
        bottom: 1cm; height: 1cm;
    }
}

body {
    font-family: {{FONT_FAMILY}};
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1a1a1a;
}

h1 {
    font-size: 22pt;
    color: #047857;
    margin-top: 2em;
    margin-bottom: 0.4em;
    border-bottom: 1px solid #d4d4d8;
    padding-bottom: 0.2em;
    page-break-before: always;
    page-break-after: avoid;
}

h1:first-of-type {
    page-break-before: avoid;
}

h2 {
    font-size: 14pt;
    color: #115e59;
    margin-top: 1.6em;
    margin-bottom: 0.4em;
    page-break-after: avoid;
}

h3 {
    font-size: 11.5pt;
    color: #115e59;
    margin-top: 1.2em;
    margin-bottom: 0.3em;
    page-break-after: avoid;
}

p {
    margin-top: 0;
    margin-bottom: 0.7em;
    text-align: justify;
}

blockquote {
    border-left: 3px solid #10b981;
    background-color: #f0fdf4;
    padding: 0.4em 0.8em;
    margin-left: 0;
    margin-right: 0;
    font-style: italic;
}

ul, ol {
    margin-top: 0.3em;
    margin-bottom: 0.7em;
    padding-left: 1.4em;
}

li {
    margin-bottom: 0.15em;
}

code {
    font-family: "Courier New", monospace;
    font-size: 9pt;
    background-color: #f4f4f5;
    padding: 1px 3px;
    border-radius: 2px;
    color: #be185d;
}

pre {
    background-color: #f4f4f5;
    padding: 0.6em 0.8em;
    font-family: "Courier New", monospace;
    font-size: 8.5pt;
    line-height: 1.35;
    border-left: 2px solid #10b981;
    margin: 0.6em 0;
    page-break-inside: avoid;
}

pre code {
    background: none;
    padding: 0;
    color: #1a1a1a;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.6em 0;
    font-size: 9.5pt;
}

th, td {
    border: 1px solid #d4d4d8;
    padding: 4px 8px;
    text-align: left;
}

th {
    background-color: #f4f4f5;
    font-weight: bold;
}

a {
    color: #047857;
    text-decoration: none;
}

hr {
    border: none;
    border-top: 1px solid #d4d4d8;
    margin: 1.5em 0;
}

em {
    color: #be185d;
    font-style: italic;
}

strong {
    font-weight: bold;
    color: #0c0a09;
}

.cover {
    text-align: center;
    margin-top: 6cm;
}

.cover h1 {
    font-size: 36pt;
    border-bottom: none;
    page-break-before: avoid;
    margin-bottom: 0.3em;
}

.cover .subtitle {
    font-size: 14pt;
    color: #525252;
    margin-bottom: 4cm;
}

.cover .footer {
    font-size: 10pt;
    color: #525252;
    margin-top: 6cm;
}

.toc {
    page-break-before: always;
    page-break-after: always;
}

.toc h1 {
    page-break-before: avoid;
}

.toc-entry {
    display: block;
    margin-bottom: 0.3em;
}

.toc-entry .num {
    display: inline-block;
    width: 2em;
    color: #525252;
}

.section-anchor {
    page-break-before: always;
}
"""

COVER_HTML = """
<div class="cover">
    <h1>The OCEAN Handbook</h1>
    <div class="subtitle">Foundations-up reference for the OCEAN substrate-clustering language</div>
    <div class="footer">
        Version 1.0 &nbsp;|&nbsp; LatentOcean Platform
    </div>
</div>
"""

FOOTER_HTML = """
<div id="footerContent" style="font-size: 9pt; color: #71717a; text-align: center;">
    The OCEAN Handbook &nbsp;|&nbsp; page <pdf:pagenumber /> of <pdf:pagecount />
</div>
"""


def _strip_frontmatter(text: str) -> tuple[str, str]:
    """Return (title, body_markdown_without_frontmatter)."""
    fm_match = _FRONTMATTER_RE.match(text)
    title = ""
    if fm_match is not None:
        frontmatter = fm_match.group(0)
        title_match = _TITLE_RE.search(frontmatter)
        if title_match is not None:
            title = title_match.group(1).strip()
        body = text[fm_match.end():]
    else:
        body = text
    return title, body


def _build_toc_html(chapter_info: list[tuple[str, str, str]]) -> str:
    """Build the table of contents page.

    chapter_info: list of (filename, title, html_id) tuples in canonical order.
    """
    chapter_entries: list[str] = []
    appendix_entries: list[str] = []
    front_entries: list[str] = []

    for filename, title, _html_id in chapter_info:
        safe_title = html_lib.escape(title)
        if filename == "00-preface.md":
            front_entries.append(
                f'<div class="toc-entry"><span class="num"></span>{safe_title}</div>'
            )
        elif filename.startswith("app-"):
            appendix_entries.append(
                f'<div class="toc-entry"><span class="num"></span>{safe_title}</div>'
            )
        else:
            m = re.match(r"(\d+)-", filename)
            num = m.group(1).lstrip("0") or "0" if m else ""
            chapter_entries.append(
                f'<div class="toc-entry"><span class="num">{num}.</span>{safe_title}</div>'
            )

    parts = ['<div class="toc">', "<h1>Contents</h1>"]
    parts.extend(front_entries)
    parts.append('<h3 style="margin-top:1.5em;">Chapters</h3>')
    parts.extend(chapter_entries)
    parts.append('<h3 style="margin-top:1.5em;">Appendices</h3>')
    parts.extend(appendix_entries)
    parts.append("</div>")
    return "\n".join(parts)


def _render_chapter(filename: str, text: str) -> tuple[str, str, str]:
    """Convert one chapter to HTML. Returns (title, html_id, body_html)."""
    title, body = _strip_frontmatter(text)
    md = markdown.Markdown(
        extensions=["fenced_code", "tables", "sane_lists"],
        output_format="xhtml",
    )
    html = md.convert(body)

    html_id = re.sub(r"\.md$", "", filename)
    # Wrap so each chapter starts on a new page.
    wrapper = f'<div class="section-anchor" id="{html_id}">{html}</div>'
    return title, html_id, wrapper


def build_pdf(handbook_dir: Path, output: Path) -> int:
    if not handbook_dir.exists():
        print(f"error: handbook directory not found: {handbook_dir}", file=sys.stderr)
        return 1

    font_family = _register_unicode_fonts()
    if font_family is None:
        print(
            "warning: no Unicode TTF font found; some characters (sigma, "
            "middle-dot, multiplication sign) may render as boxes",
            file=sys.stderr,
        )
        font_css = '"Helvetica", "Arial", sans-serif'
    else:
        font_css = f'"{font_family}", "Helvetica", "Arial", sans-serif'

    chapter_info: list[tuple[str, str, str]] = []
    bodies: list[str] = []

    for filename in ORDER:
        path = handbook_dir / filename
        if not path.exists():
            print(f"error: missing chapter file: {path}", file=sys.stderr)
            return 1
        text = path.read_text(encoding="utf-8")
        title, html_id, body_html = _render_chapter(filename, text)
        chapter_info.append((filename, title, html_id))
        bodies.append(body_html)

    toc_html = _build_toc_html(chapter_info)
    body_html = "\n".join(bodies)

    styled_css = PRINT_CSS.replace("{{FONT_FAMILY}}", font_css)

    full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>The OCEAN Handbook</title>
    <style>{styled_css}</style>
</head>
<body>
{COVER_HTML}
{toc_html}
{body_html}
{FOOTER_HTML}
</body>
</html>
"""

    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "wb") as f:
        result = pisa.CreatePDF(full_html, dest=f, encoding="utf-8")

    if result.err:
        print(f"error: PDF rendering failed with {result.err} errors", file=sys.stderr)
        return 2

    size_kb = output.stat().st_size / 1024
    print(f"wrote {output} ({size_kb:.1f} KB, {len(chapter_info)} chapters)")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the OCEAN Handbook as a PDF.")
    parser.add_argument(
        "--source",
        type=Path,
        default=HANDBOOK_DIR,
        help=f"handbook source directory (default: {HANDBOOK_DIR})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"output PDF path (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args(argv)
    return build_pdf(args.source, args.output)


if __name__ == "__main__":
    sys.exit(main())
