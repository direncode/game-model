"""Build / validate the OCEAN Handbook.

Runs all seven validators against `docs/handbook/`:

  1. parse          — every chapter parses
  2. skeleton       — required sections + frontmatter present
  3. snippets       — every runnable OCEAN block compiles
  4. corpora        — every runnable block uses a sanctioned toy corpus
  5. glossary       — every italicized term has a glossary entry
  6. exercises      — every exercise has a solution in Appendix F
  7. voice          — no first-person, no projections / finance acronyms

Usage:
    python -m scripts.handbook.build --check
    python -m scripts.handbook.build --emit-content frontend/lib/handbook-content.ts
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from backend.handbook_runner.premium_gate import OPERATOR_REGISTRY, OperatorSpec
from scripts.handbook.parse_chapter import ParseChapterError, parse_chapter
from scripts.handbook.validate_corpora import validate_corpora
from scripts.handbook.validate_exercises import validate_exercises
from scripts.handbook.validate_glossary import validate_glossary
from scripts.handbook.validate_skeleton import validate_skeleton
from scripts.handbook.validate_snippets import validate_snippets
from scripts.handbook.validate_voice import validate_voice

REPO_ROOT = Path(__file__).resolve().parents[2]
HANDBOOK_DIR = REPO_ROOT / "docs" / "handbook"
SOLUTIONS_FILENAME = "app-f-exercise-solutions.md"
GLOSSARY_FILENAME = "app-d-glossary.md"
APP_B_FILENAME = "app-b-operator-catalog.md"

# AUTO-GENERATED region markers in app-b-operator-catalog.md. Two pairs:
# one for the free / open-core table, one for the premium table. Each pair
# is generated independently so a tier-flip in the registry only diffs the
# affected table.
_FREE_BEGIN = "<!-- AUTO-GENERATED:catalog-begin -->"
_FREE_END = "<!-- AUTO-GENERATED:catalog-end -->"
_PREMIUM_BEGIN = "<!-- AUTO-GENERATED:premium-begin -->"
_PREMIUM_END = "<!-- AUTO-GENERATED:premium-end -->"


def _discover_chapter_paths(handbook_dir: Path) -> list[Path]:
    return sorted(p for p in handbook_dir.glob("*.md") if p.is_file())


def _emit_error(msg: str) -> None:
    print(f"ERROR: {msg}")


# ─── Catalog generation (Plan C, Task 8) ─────────────────────────────
#
# The operator catalog in Appendix B is generated from the runtime registry
# at `backend.handbook_runner.premium_gate.OPERATOR_REGISTRY`. Two tables
# live in the doc — one for the free tier, one for the premium tier —
# each wrapped in its own AUTO-GENERATED marker pair.
#
# `regenerate_catalog_table()` rewrites both tables in place. It is
# idempotent: running it twice produces the same file bytes.
#
# `validate_catalog()` re-generates the tables in memory and compares the
# resulting file content to what's on disk. Any drift is reported as an
# error so CI catches a hand-edited catalog or a registry change that
# wasn't committed alongside the doc.


def _escape_md_cell(text: str) -> str:
    """Escape characters that would break a markdown table cell.

    Pipes split columns; backslashes / newlines break formatting. We
    flatten newlines to spaces and escape pipe characters.
    """
    cleaned = text.replace("\r", " ").replace("\n", " ").strip()
    return cleaned.replace("|", r"\|")


def _format_schema(schema: dict[str, str]) -> str:
    """Render the per-operator schema dict as a single-cell summary.

    Keys are listed in their dict-insertion order (which is the order the
    author wrote them). Each parameter is rendered as `name`: description.
    """
    if not schema:
        return "(none)"
    parts = [f"`{k}`: {_escape_md_cell(v)}" for k, v in schema.items()]
    return "; ".join(parts)


def _render_table(specs: list[OperatorSpec]) -> str:
    """Render a markdown table for the given operator specs."""
    if not specs:
        return "_(none)_\n"
    header = (
        "| Operator | Signature | Summary | Parameters |\n"
        "| --- | --- | --- | --- |\n"
    )
    rows = []
    for spec in specs:
        rows.append(
            "| `{name}` | `{sig}` | {summary} | {schema} |".format(
                name=_escape_md_cell(spec.name),
                sig=_escape_md_cell(spec.signature),
                summary=_escape_md_cell(spec.summary),
                schema=_format_schema(spec.schema),
            )
        )
    return header + "\n".join(rows) + "\n"


def _split_registry() -> tuple[list[OperatorSpec], list[OperatorSpec]]:
    """Partition the registry into (free, premium), each sorted by name."""
    free: list[OperatorSpec] = []
    premium: list[OperatorSpec] = []
    for spec in OPERATOR_REGISTRY.values():
        if spec.tier == "free":
            free.append(spec)
        else:
            premium.append(spec)
    free.sort(key=lambda s: s.name)
    premium.sort(key=lambda s: s.name)
    return free, premium


def _replace_marker_region(
    content: str, begin: str, end: str, body: str
) -> tuple[str, str | None]:
    """Replace text between `begin` and `end` markers (inclusive of markers).

    Returns (new_content, error). If a marker is missing or out of order,
    returns (content, error_message) leaving content unchanged.
    """
    pattern = re.compile(
        re.escape(begin) + r".*?" + re.escape(end), flags=re.DOTALL
    )
    replacement = f"{begin}\n{body.rstrip()}\n{end}"
    new_content, n = pattern.subn(replacement, content, count=1)
    if n == 0:
        return content, (
            f"missing AUTO-GENERATED region: '{begin}' ... '{end}'"
        )
    return new_content, None


def _build_expected_content(current: str) -> tuple[str, list[str]]:
    """Apply both marker substitutions to `current`. Returns (new, errors)."""
    free, premium = _split_registry()
    free_table = _render_table(free)
    premium_table = _render_table(premium)
    errors: list[str] = []
    updated, err = _replace_marker_region(
        current, _FREE_BEGIN, _FREE_END, free_table
    )
    if err is not None:
        errors.append(err)
    updated, err = _replace_marker_region(
        updated, _PREMIUM_BEGIN, _PREMIUM_END, premium_table
    )
    if err is not None:
        errors.append(err)
    return updated, errors


def regenerate_catalog_table(app_b_path: Path) -> list[str]:
    """Rewrite the AUTO-GENERATED regions in `app_b_path` to match the registry.

    Returns a list of error messages (empty on success). Marker absence is
    surfaced as an error rather than silently inserted, so an accidental
    deletion of the markers fails CI rather than landing a duplicate.
    """
    if not app_b_path.is_file():
        return [f"{app_b_path}: catalog file not found"]
    current = app_b_path.read_text(encoding="utf-8")
    updated, errors = _build_expected_content(current)
    if errors:
        return [f"{app_b_path}: {e}" for e in errors]
    if updated != current:
        app_b_path.write_text(updated, encoding="utf-8")
    return []


def validate_catalog(app_b_path: Path) -> list[str]:
    """Check the catalog tables match the registry byte-for-byte.

    Used as a tripwire — if `regenerate_catalog_table` was called at the
    start of the build, this should always pass on the same run; the
    primary purpose is to catch a manually-edited catalog that wasn't
    re-generated.
    """
    if not app_b_path.is_file():
        return [f"{app_b_path}: catalog file not found"]
    current = app_b_path.read_text(encoding="utf-8")
    expected, errors = _build_expected_content(current)
    if errors:
        return [f"{app_b_path}: {e}" for e in errors]
    if expected != current:
        return [
            f"{app_b_path}: catalog tables drift from the registry; "
            f"run `python -m scripts.handbook.build --check` to re-generate"
        ]
    return []


def run_check(handbook_dir: Path) -> int:
    """Return number of errors discovered."""
    errors_total = 0

    # 0. Regenerate Appendix B's operator catalog from the runtime
    #    registry. Doing this BEFORE parsing means downstream validators
    #    (e.g. snippets, voice) see the fresh content. validate_catalog
    #    near the end of the build catches drift if the file is somehow
    #    inconsistent after the regen step (e.g. missing markers).
    app_b_path = handbook_dir / APP_B_FILENAME
    for err in regenerate_catalog_table(app_b_path):
        _emit_error(err)
        errors_total += 1

    chapter_paths = _discover_chapter_paths(handbook_dir)
    if not chapter_paths:
        _emit_error(f"no markdown files found in {handbook_dir}")
        return 1

    # 1. parse
    chapters = []
    for cp in chapter_paths:
        try:
            chapters.append(parse_chapter(cp))
        except ParseChapterError as exc:
            _emit_error(str(exc))
            errors_total += 1
    if not chapters:
        return errors_total

    # 2. skeleton
    for chap in chapters:
        for err in validate_skeleton(chap):
            _emit_error(err)
            errors_total += 1

    # 3. snippets
    for chap in chapters:
        try:
            for err in validate_snippets(chap):
                _emit_error(err)
                errors_total += 1
        except Exception as exc:  # noqa: BLE001 - never crash the build
            _emit_error(f"{chap.path}: snippet validator crashed: {exc}")
            errors_total += 1

    # 4. corpora
    for chap in chapters:
        for err in validate_corpora(chap):
            _emit_error(err)
            errors_total += 1

    # 5. glossary
    glossary_path = handbook_dir / GLOSSARY_FILENAME
    for err in validate_glossary(chapters, glossary_path):
        _emit_error(err)
        errors_total += 1

    # 6. exercises
    solutions_path = handbook_dir / SOLUTIONS_FILENAME
    for err in validate_exercises(chapters, solutions_path):
        _emit_error(err)
        errors_total += 1

    # 7. voice
    for chap in chapters:
        for err in validate_voice(chap):
            _emit_error(err)
            errors_total += 1

    # 8. catalog drift — re-validate after the regen at step 0 to catch
    #    pathological cases (e.g. missing markers re-introduced by a
    #    parallel writer) before the build claims OK.
    for err in validate_catalog(app_b_path):
        _emit_error(err)
        errors_total += 1

    return errors_total


def run_emit_content(handbook_dir: Path, out_path: Path) -> int:
    chapter_paths = _discover_chapter_paths(handbook_dir)
    entries = []
    for cp in chapter_paths:
        try:
            chap = parse_chapter(cp)
        except ParseChapterError as exc:
            _emit_error(str(exc))
            return 1
        entries.append(
            {
                "slug": chap.frontmatter.get("slug"),
                "number": chap.frontmatter.get("number"),
                "title": chap.frontmatter.get("title"),
                "promise": chap.frontmatter.get("promise"),
                "status": chap.frontmatter.get("status"),
                "path": str(cp.relative_to(REPO_ROOT)).replace("\\", "/"),
                "body": chap.body,
            }
        )
    payload = json.dumps(entries, indent=2)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        "// Generated by scripts/handbook/build.py — do not edit by hand.\n"
        f"export const handbookContent = {payload} as const;\n",
        encoding="utf-8",
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scripts.handbook.build")
    parser.add_argument("--check", action="store_true", help="validate and exit 1 on errors")
    parser.add_argument(
        "--emit-content",
        metavar="PATH",
        help="emit a generated TS module summarising chapters",
    )
    parser.add_argument(
        "--handbook-dir",
        default=str(HANDBOOK_DIR),
        help="override the handbook directory (default: docs/handbook)",
    )
    args = parser.parse_args(argv)
    hb_dir = Path(args.handbook_dir)

    if args.check:
        errors = run_check(hb_dir)
        if errors:
            print(f"\n{errors} error(s) found.", file=sys.stderr)
            return 1
        print("OK")
        return 0

    if args.emit_content:
        return run_emit_content(hb_dir, Path(args.emit_content))

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
