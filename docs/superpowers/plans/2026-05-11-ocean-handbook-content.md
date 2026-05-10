# OCEAN Handbook — Content Plan (Plan A of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the markdown source of the OCEAN Handbook — 15 chapters and 6 appendices in `docs/handbook/` — plus the build/validation script that turns it into a CI-checked artifact.

**Architecture:** Each chapter is a standalone markdown file following a binding skeleton (promise → concepts → body → wider system → exercises → what's next). Every fenced `.ocean` snippet is parsed at build time, run through the existing OCEAN compiler's lexer/parser/typechecker, and a build failure trips CI. Glossary terms, exercise-solution pairs, and toy-corpus references are cross-validated. The plan is sequenced so the build/validation script exists before chapter authoring, which means every chapter is verified as soon as it lands.

**Tech Stack:** Markdown + YAML frontmatter for source. Python for the build/validation script (calls into `scripts/operators/ocean/` directly). Pytest for the script's own tests. No new runtime dependencies.

**Companion docs:**
- Design spec: `docs/superpowers/specs/2026-05-11-ocean-handbook-design.md`
- Existing reference being supplemented (NOT replaced): `docs/OCEAN_LANG.md`
- Existing primitive spec (referenced from App C): `docs/PRIMITIVE_SPEC.md`
- Existing stdlib (referenced from Ch 11): `scripts/operators/ocean/stdlib/substrate.ocean`

---

## File Structure

```
docs/handbook/
  index.md                                              (TOC + reading paths)
  00-preface.md
  01-what-ocean-is.md
  02-your-first-pipeline.md
  03-source-files-and-tokens.md
  04-the-pipeline-types.md
  05-load-and-records.md
  06-embed-and-z.md
  07-cluster-and-modules.md
  08-align-and-find.md
  09-save-and-the-determinism-contract.md
  10-control-flow.md
  11-functions-modules-stdlib.md
  12-tooling-and-the-lsp.md
  13-effective-ocean.md
  14-interfacing-ocean.md
  app-a-grammar.md
  app-b-operator-catalog.md
  app-c-primitive-spec-companion.md
  app-d-glossary.md
  app-e-reference-card.md
  app-f-exercise-solutions.md
  _toy_corpora/                                         (read-only references)
    toy_tna_50.ndjson                                   (created in Plan C; referenced here)
    toy_nslkdd_200.ndjson
    toy_climate_100.ndjson

scripts/handbook/
  __init__.py
  build.py                                              (main build + validation entry)
  parse_chapter.py                                      (frontmatter + section extraction)
  validate_snippets.py                                  (run each ocean fence through typecheck)
  validate_skeleton.py                                  (enforce per-chapter skeleton from spec §3.3)
  validate_exercises.py                                 (exercise <-> solution pairing)
  validate_glossary.py                                  (italicized term <-> glossary entry)
  validate_corpora.py                                   (toy-corpus reference check)
  validate_voice.py                                     (no first-person, no banned phrases)
  tests/
    test_parse_chapter.py
    test_validate_snippets.py
    test_validate_skeleton.py
    test_validate_exercises.py
    test_validate_glossary.py
    test_validate_corpora.py
    test_validate_voice.py
    fixtures/
      good_chapter.md
      bad_skeleton.md
      bad_snippet.md
      bad_voice.md

.github/workflows/
  handbook.yml                                          (CI check that runs scripts/handbook/build.py --check)
```

Per-chapter file structure (the binding skeleton from spec §3.3):

```markdown
---
slug: 01-what-ocean-is
number: 1
title: "What OCEAN Is"
promise: "After this chapter you can answer the question 'why does OCEAN exist?' in three sentences."
---

# Ch 1 — What OCEAN Is

> {{ promise from frontmatter }}

## Concepts in this chapter
- bullet 1
- bullet 2

## [Body sections, code-first, each ending with a working snippet]

## Wider system
[2-3 paragraphs readable standalone]

## Exercises
1. ...
2. ...

## What's next
[One sentence pointing to the next chapter]
```

Preface, index, and appendices have a relaxed skeleton documented in Task 0.

---

## Task 0: Bootstrap — directory, skeleton files, build script

**Files:**
- Create: `docs/handbook/` (directory)
- Create: `docs/handbook/index.md`, `00-preface.md`, `01-what-ocean-is.md` ... `14-interfacing-ocean.md`, `app-a-grammar.md` ... `app-f-exercise-solutions.md` (22 empty files with frontmatter only)
- Create: `scripts/handbook/__init__.py`, `build.py`, `parse_chapter.py`, `validate_snippets.py`, `validate_skeleton.py`, `validate_exercises.py`, `validate_glossary.py`, `validate_corpora.py`, `validate_voice.py`
- Create: `scripts/handbook/tests/test_parse_chapter.py`, `test_validate_snippets.py`, `test_validate_skeleton.py`, `test_validate_exercises.py`, `test_validate_glossary.py`, `test_validate_corpora.py`, `test_validate_voice.py`
- Create: `scripts/handbook/tests/fixtures/good_chapter.md`, `bad_skeleton.md`, `bad_snippet.md`, `bad_voice.md`

- [ ] **Step 1: Create the handbook directory and 22 skeleton files**

```bash
mkdir -p docs/handbook
```

For each of the 22 files, write only the YAML frontmatter and an H1 title. Example, `docs/handbook/01-what-ocean-is.md`:

```markdown
---
slug: 01-what-ocean-is
number: 1
title: "What OCEAN Is"
promise: "(placeholder — fill in Task 2)"
status: draft
---

# Ch 1 — What OCEAN Is
```

Use these exact `slug`, `number`, `title` values:

| File                                            | slug                                          | number | title                                       |
|-------------------------------------------------|-----------------------------------------------|--------|---------------------------------------------|
| `index.md`                                      | `index`                                       | null   | "The OCEAN Handbook"                        |
| `00-preface.md`                                 | `00-preface`                                  | 0      | "Preface"                                   |
| `01-what-ocean-is.md`                           | `01-what-ocean-is`                            | 1      | "What OCEAN Is"                             |
| `02-your-first-pipeline.md`                     | `02-your-first-pipeline`                      | 2      | "Your First Pipeline"                       |
| `03-source-files-and-tokens.md`                 | `03-source-files-and-tokens`                  | 3      | "Source Files and Tokens"                   |
| `04-the-pipeline-types.md`                      | `04-the-pipeline-types`                       | 4      | "The Pipeline Types"                        |
| `05-load-and-records.md`                        | `05-load-and-records`                         | 5      | "`load` and `Records`"                      |
| `06-embed-and-z.md`                             | `06-embed-and-z`                              | 6      | "`embed` and `Z`"                           |
| `07-cluster-and-modules.md`                     | `07-cluster-and-modules`                      | 7      | "`cluster` and `Modules`"                   |
| `08-align-and-find.md`                          | `08-align-and-find`                           | 8      | "`align` and `find`"                        |
| `09-save-and-the-determinism-contract.md`       | `09-save-and-the-determinism-contract`        | 9      | "`save` and the Determinism Contract"       |
| `10-control-flow.md`                            | `10-control-flow`                             | 10     | "Control Flow"                              |
| `11-functions-modules-stdlib.md`                | `11-functions-modules-stdlib`                 | 11     | "Functions, Modules, the Stdlib"            |
| `12-tooling-and-the-lsp.md`                     | `12-tooling-and-the-lsp`                      | 12     | "Tooling and the LSP"                       |
| `13-effective-ocean.md`                         | `13-effective-ocean`                          | 13     | "Effective OCEAN"                           |
| `14-interfacing-ocean.md`                       | `14-interfacing-ocean`                        | 14     | "Interfacing OCEAN"                         |
| `app-a-grammar.md`                              | `app-a-grammar`                               | null   | "Appendix A — Grammar (EBNF)"               |
| `app-b-operator-catalog.md`                     | `app-b-operator-catalog`                      | null   | "Appendix B — Operator Catalog"             |
| `app-c-primitive-spec-companion.md`             | `app-c-primitive-spec-companion`              | null   | "Appendix C — Primitive Spec Companion"     |
| `app-d-glossary.md`                             | `app-d-glossary`                              | null   | "Appendix D — Glossary"                     |
| `app-e-reference-card.md`                       | `app-e-reference-card`                        | null   | "Appendix E — Reference Card"               |
| `app-f-exercise-solutions.md`                   | `app-f-exercise-solutions`                    | null   | "Appendix F — Exercise Solutions"           |

- [ ] **Step 2: Write the failing test for `parse_chapter`**

Create `scripts/handbook/tests/test_parse_chapter.py`:

```python
"""Tests for parse_chapter: extracts frontmatter, body, sections, snippets."""
from __future__ import annotations
from pathlib import Path
import pytest

from scripts.handbook.parse_chapter import parse_chapter, ChapterParseError

FIXTURES = Path(__file__).parent / "fixtures"


def test_parse_good_chapter_returns_expected_structure():
    parsed = parse_chapter(FIXTURES / "good_chapter.md")

    assert parsed.frontmatter["slug"] == "test-good"
    assert parsed.frontmatter["number"] == 1
    assert parsed.frontmatter["title"] == "Good Chapter"
    assert parsed.promise.startswith("After this chapter")

    section_titles = [s.title for s in parsed.sections]
    assert "Concepts in this chapter" in section_titles
    assert "Wider system" in section_titles
    assert "Exercises" in section_titles
    assert "What's next" in section_titles

    assert len(parsed.snippets) == 2
    assert parsed.snippets[0].language == "ocean"
    assert parsed.snippets[0].runnable is False
    assert parsed.snippets[1].language == "ocean"
    assert parsed.snippets[1].runnable is True
    assert parsed.snippets[1].corpus == "toy_tna_50"

    assert len(parsed.exercises) == 2
    assert parsed.exercises[0].number == 1


def test_parse_missing_frontmatter_raises():
    with pytest.raises(ChapterParseError, match="missing frontmatter"):
        parse_chapter(FIXTURES / "bad_skeleton.md")


def test_parse_missing_promise_raises():
    bad = FIXTURES / "missing_promise.md"
    bad.write_text("---\nslug: x\nnumber: 1\ntitle: x\n---\n# x\n")
    try:
        with pytest.raises(ChapterParseError, match="missing.*promise"):
            parse_chapter(bad)
    finally:
        bad.unlink()
```

- [ ] **Step 3: Create the test fixture `good_chapter.md`**

Create `scripts/handbook/tests/fixtures/good_chapter.md`:

````markdown
---
slug: test-good
number: 1
title: "Good Chapter"
promise: "After this chapter you can write a fixture."
status: draft
---

# Ch 1 — Good Chapter

> After this chapter you can write a fixture.

## Concepts in this chapter
- fixtures
- parsing

## A first idea

Here is an OCEAN snippet that does not run:

```ocean
require ocean 1.0
seed 42
```

And here is one that does:

```ocean run corpus=toy_tna_50
load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
embed text into 32 dimensions using tf-idf
save to /tmp/test.json
```

## Wider system

This is a sidebar that stands alone. It explains how parsing relates to
the determinism contract: every chapter compiles deterministically because
the snippet validator runs the same lexer and parser as the production
compiler.

## Exercises

1. Modify the second snippet to take 25 records instead of 50.
2. Add a `cluster` step between embed and save.

## What's next

Next, the validator runs each snippet through the typechecker.
````

- [ ] **Step 4: Create the test fixture `bad_skeleton.md`**

Create `scripts/handbook/tests/fixtures/bad_skeleton.md`:

```markdown
# A chapter with no frontmatter

This file is broken on purpose. It has no YAML frontmatter, so
parse_chapter must raise ChapterParseError.
```

- [ ] **Step 5: Run test to verify it fails (no implementation yet)**

Run: `cd C:/Users/diren/Desktop/lsx-latentocean && python -m pytest scripts/handbook/tests/test_parse_chapter.py -v`

Expected: FAIL with `ModuleNotFoundError: scripts.handbook.parse_chapter`

- [ ] **Step 6: Implement `parse_chapter`**

Create `scripts/handbook/__init__.py` (empty file is fine).

Create `scripts/handbook/parse_chapter.py`:

```python
"""Parses one handbook chapter file: frontmatter, sections, snippets, exercises.

A chapter is a markdown file with YAML frontmatter and a specific skeleton
defined in docs/superpowers/specs/2026-05-11-ocean-handbook-design.md §3.3.
This module only extracts structure; skeleton validation lives in
validate_skeleton.py.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


class ChapterParseError(Exception):
    """Raised when a chapter file is malformed at the syntactic level."""


@dataclass
class Snippet:
    language: str
    code: str
    runnable: bool
    corpus: str | None
    static: bool
    line: int


@dataclass
class Section:
    title: str
    body: str
    line: int


@dataclass
class Exercise:
    number: int
    prompt: str
    line: int


@dataclass
class ParsedChapter:
    path: Path
    frontmatter: dict[str, Any]
    promise: str
    sections: list[Section] = field(default_factory=list)
    snippets: list[Snippet] = field(default_factory=list)
    exercises: list[Exercise] = field(default_factory=list)


_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)
_PROMISE_RE = re.compile(r"^>\s+(.+)$", re.MULTILINE)
_SECTION_RE = re.compile(r"^##\s+(.+)$", re.MULTILINE)
_FENCE_RE = re.compile(
    r"^```(\S+)([^\n]*)\n(.*?)\n```$",
    re.MULTILINE | re.DOTALL,
)
_EXERCISE_LINE_RE = re.compile(r"^(\d+)\.\s+(.+)$", re.MULTILINE)


def parse_chapter(path: Path) -> ParsedChapter:
    text = path.read_text(encoding="utf-8")
    fm_match = _FRONTMATTER_RE.match(text)
    if not fm_match:
        raise ChapterParseError(f"{path}: missing frontmatter")

    try:
        frontmatter = yaml.safe_load(fm_match.group(1)) or {}
    except yaml.YAMLError as e:
        raise ChapterParseError(f"{path}: invalid YAML frontmatter: {e}") from e

    body = fm_match.group(2)
    promise_match = _PROMISE_RE.search(body)
    if not promise_match:
        raise ChapterParseError(f"{path}: missing promise (no '> ...' blockquote)")
    promise = promise_match.group(1).strip()

    sections = []
    for sec_match in _SECTION_RE.finditer(body):
        title = sec_match.group(1).strip()
        start = sec_match.end()
        next_match = _SECTION_RE.search(body, start)
        end = next_match.start() if next_match else len(body)
        section_body = body[start:end].strip()
        line = body[:sec_match.start()].count("\n") + 1
        sections.append(Section(title=title, body=section_body, line=line))

    snippets = []
    for fence_match in _FENCE_RE.finditer(body):
        info = (fence_match.group(2) or "").strip()
        if fence_match.group(1) != "ocean":
            continue
        runnable = info.startswith("run")
        static = info == "static"
        corpus = None
        for tok in info.split():
            if tok.startswith("corpus="):
                corpus = tok.split("=", 1)[1]
        line = body[:fence_match.start()].count("\n") + 1
        snippets.append(Snippet(
            language="ocean",
            code=fence_match.group(3),
            runnable=runnable,
            corpus=corpus,
            static=static,
            line=line,
        ))

    exercises = []
    exercises_section = next((s for s in sections if s.title == "Exercises"), None)
    if exercises_section is not None:
        for ex_match in _EXERCISE_LINE_RE.finditer(exercises_section.body):
            exercises.append(Exercise(
                number=int(ex_match.group(1)),
                prompt=ex_match.group(2).strip(),
                line=exercises_section.line + exercises_section.body[:ex_match.start()].count("\n"),
            ))

    return ParsedChapter(
        path=path,
        frontmatter=frontmatter,
        promise=promise,
        sections=sections,
        snippets=snippets,
        exercises=exercises,
    )
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd C:/Users/diren/Desktop/lsx-latentocean && python -m pytest scripts/handbook/tests/test_parse_chapter.py -v`

Expected: PASS (3 tests).

- [ ] **Step 8: Write the failing test for `validate_snippets`**

Create `scripts/handbook/tests/test_validate_snippets.py`:

```python
"""Tests for validate_snippets: every ocean fence parses + typechecks."""
from __future__ import annotations
from pathlib import Path
import pytest

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_snippets import validate_snippets, SnippetValidationError

FIXTURES = Path(__file__).parent / "fixtures"


def test_good_snippets_pass():
    parsed = parse_chapter(FIXTURES / "good_chapter.md")
    # Both snippets in good_chapter are syntactically and type-correct
    errors = validate_snippets(parsed)
    assert errors == []


def test_bad_snippet_returns_typed_error():
    parsed = parse_chapter(FIXTURES / "bad_snippet.md")
    errors = validate_snippets(parsed)
    assert len(errors) == 1
    assert errors[0].category in ("syntax", "type", "name")
    assert errors[0].chapter_line > 0
    assert "cluster" in errors[0].message.lower() or "type" in errors[0].message.lower()
```

- [ ] **Step 9: Create `bad_snippet.md` fixture**

Create `scripts/handbook/tests/fixtures/bad_snippet.md`:

````markdown
---
slug: test-bad-snippet
number: 99
title: "Bad Snippet"
promise: "After this chapter the validator fails."
status: draft
---

# Ch 99 — Bad Snippet

> After this chapter the validator fails.

## Concepts in this chapter
- failure

## A broken snippet

```ocean
load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive as raw
cluster raw using tcd recursive loop
```

## Wider system

This snippet has a type error: cluster wants Z, gets Records.

## Exercises

1. Fix the type error.

## What's next

Nothing.
````

- [ ] **Step 10: Run test to verify it fails**

Run: `python -m pytest scripts/handbook/tests/test_validate_snippets.py -v`

Expected: FAIL with `ModuleNotFoundError: scripts.handbook.validate_snippets`

- [ ] **Step 11: Implement `validate_snippets`**

Create `scripts/handbook/validate_snippets.py`:

```python
"""Run every ocean fence in a parsed chapter through the OCEAN typechecker.

Uses scripts.operators.ocean directly — no subprocess. Returns a list of
SnippetValidationError; empty list means all snippets validated.

Static fences (info string '```ocean static') are skipped because they
are grammar excerpts, not whole programs.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from scripts.handbook.parse_chapter import ParsedChapter, Snippet
from scripts.operators.ocean.lexer import lex
from scripts.operators.ocean.parser import parse
from scripts.operators.ocean.typecheck import typecheck


@dataclass
class SnippetValidationError:
    chapter_path: str
    chapter_line: int          # absolute line in the chapter file
    snippet_index: int          # 0-based snippet position in the chapter
    category: str               # 'syntax' | 'type' | 'name'
    message: str
    snippet_line: int           # line inside the snippet


def validate_snippets(parsed: ParsedChapter) -> list[SnippetValidationError]:
    errors: list[SnippetValidationError] = []
    for i, snippet in enumerate(parsed.snippets):
        if snippet.static:
            continue
        err = _validate_one(snippet, parsed.path, i)
        if err is not None:
            errors.append(err)
    return errors


def _validate_one(
    snippet: Snippet, chapter_path: Any, index: int
) -> SnippetValidationError | None:
    try:
        tokens = lex(snippet.code)
        program = parse(tokens)
        typecheck(program)
    except Exception as exc:
        category = _categorize(exc)
        snippet_line, message = _extract_location(exc)
        return SnippetValidationError(
            chapter_path=str(chapter_path),
            chapter_line=snippet.line + snippet_line,
            snippet_index=index,
            category=category,
            message=message,
            snippet_line=snippet_line,
        )
    return None


def _categorize(exc: Exception) -> str:
    name = type(exc).__name__.lower()
    if "syntax" in name:
        return "syntax"
    if "type" in name:
        return "type"
    if "name" in name:
        return "name"
    return "runtime"


def _extract_location(exc: Exception) -> tuple[int, str]:
    msg = str(exc)
    # Lexer/parser/typecheck exceptions carry line info in their message.
    # Defensive fallback: line 1.
    import re
    m = re.search(r"line\s+(\d+)", msg)
    line = int(m.group(1)) if m else 1
    return line, msg
```

- [ ] **Step 12: Run test to verify it passes**

Run: `python -m pytest scripts/handbook/tests/test_validate_snippets.py -v`

Expected: PASS (2 tests). If the OCEAN compiler module names differ from `lex`/`parse`/`typecheck`, adjust the import lines until it passes — these symbols already exist in `scripts/operators/ocean/`.

- [ ] **Step 13: Write the failing test for `validate_skeleton`**

Create `scripts/handbook/tests/test_validate_skeleton.py`:

```python
"""Tests for validate_skeleton: enforces the binding per-chapter skeleton."""
from __future__ import annotations
from pathlib import Path
import pytest

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_skeleton import validate_skeleton

FIXTURES = Path(__file__).parent / "fixtures"


def test_good_chapter_passes():
    parsed = parse_chapter(FIXTURES / "good_chapter.md")
    errors = validate_skeleton(parsed)
    assert errors == []


def test_missing_wider_system_fails():
    parsed = parse_chapter(FIXTURES / "good_chapter.md")
    parsed.sections = [s for s in parsed.sections if s.title != "Wider system"]
    errors = validate_skeleton(parsed)
    assert any("Wider system" in e for e in errors)


def test_missing_concepts_fails():
    parsed = parse_chapter(FIXTURES / "good_chapter.md")
    parsed.sections = [s for s in parsed.sections if s.title != "Concepts in this chapter"]
    errors = validate_skeleton(parsed)
    assert any("Concepts" in e for e in errors)


def test_index_and_appendices_use_relaxed_skeleton():
    # index.md and app-*.md have null `number` in frontmatter and don't
    # need 'Concepts in this chapter' / 'Wider system' / 'Exercises' /
    # 'What\'s next' sections.
    parsed = parse_chapter(FIXTURES / "good_chapter.md")
    parsed.frontmatter["number"] = None
    parsed.frontmatter["slug"] = "app-a-grammar"
    parsed.sections = []  # appendices may have arbitrary sections
    errors = validate_skeleton(parsed)
    assert errors == []
```

- [ ] **Step 14: Run test to verify it fails**

Run: `python -m pytest scripts/handbook/tests/test_validate_skeleton.py -v`

Expected: FAIL with `ModuleNotFoundError: scripts.handbook.validate_skeleton`

- [ ] **Step 15: Implement `validate_skeleton`**

Create `scripts/handbook/validate_skeleton.py`:

```python
"""Enforce the binding chapter skeleton from spec §3.3.

Numbered chapters (number 1..14) must have all of:
    'Concepts in this chapter', 'Wider system', 'Exercises', "What's next"
plus a non-empty promise blockquote.

Preface (number 0) must have a promise but does NOT need the above sections.

Index and appendices (number null) use a relaxed skeleton: only the H1
title is required.
"""
from __future__ import annotations

from scripts.handbook.parse_chapter import ParsedChapter

REQUIRED_SECTIONS = [
    "Concepts in this chapter",
    "Wider system",
    "Exercises",
    "What's next",
]


def validate_skeleton(parsed: ParsedChapter) -> list[str]:
    errors: list[str] = []
    number = parsed.frontmatter.get("number")
    slug = parsed.frontmatter.get("slug", "")

    if not parsed.promise.strip():
        errors.append(f"{parsed.path}: empty promise blockquote")

    is_numbered_chapter = isinstance(number, int) and 1 <= number <= 14
    is_preface = number == 0

    if is_numbered_chapter:
        present = {s.title for s in parsed.sections}
        for required in REQUIRED_SECTIONS:
            if required not in present:
                errors.append(
                    f"{parsed.path}: numbered chapter missing required "
                    f"section '{required}'"
                )

    # Preface: only needs promise (already checked above).
    # Index/appendices (number is None): no section requirements.

    return errors
```

- [ ] **Step 16: Run test to verify it passes**

Run: `python -m pytest scripts/handbook/tests/test_validate_skeleton.py -v`

Expected: PASS (4 tests).

- [ ] **Step 17: Write the failing test for `validate_exercises`**

Create `scripts/handbook/tests/test_validate_exercises.py`:

```python
"""Tests for validate_exercises: every exercise has a solution in app-f."""
from __future__ import annotations
from pathlib import Path
import pytest

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_exercises import validate_exercises

FIXTURES = Path(__file__).parent / "fixtures"


def test_unmatched_exercise_fails(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text((FIXTURES / "good_chapter.md").read_text())

    app_f = tmp_path / "app-f-exercise-solutions.md"
    app_f.write_text(
        "---\nslug: app-f-exercise-solutions\nnumber: null\n"
        "title: \"App F\"\npromise: \"sols\"\nstatus: draft\n---\n"
        "# App F\n\n> sols\n\n"
        "## test-good — 1\nSolution to 1.\n"
        # no solution for #2
    )
    errors = validate_exercises([chapter], app_f)
    assert any("test-good — 2" in e or "missing solution" in e for e in errors)


def test_orphan_solution_fails(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text((FIXTURES / "good_chapter.md").read_text())

    app_f = tmp_path / "app-f-exercise-solutions.md"
    app_f.write_text(
        "---\nslug: app-f-exercise-solutions\nnumber: null\n"
        "title: \"App F\"\npromise: \"sols\"\nstatus: draft\n---\n"
        "# App F\n\n> sols\n\n"
        "## test-good — 1\nSolution.\n"
        "## test-good — 2\nSolution.\n"
        "## test-good — 3\nOrphan solution.\n"  # no exercise 3
    )
    errors = validate_exercises([chapter], app_f)
    assert any("test-good — 3" in e or "orphan" in e for e in errors)


def test_complete_pairing_passes(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text((FIXTURES / "good_chapter.md").read_text())

    app_f = tmp_path / "app-f-exercise-solutions.md"
    app_f.write_text(
        "---\nslug: app-f-exercise-solutions\nnumber: null\n"
        "title: \"App F\"\npromise: \"sols\"\nstatus: draft\n---\n"
        "# App F\n\n> sols\n\n"
        "## test-good — 1\nSolution.\n"
        "## test-good — 2\nSolution.\n"
    )
    errors = validate_exercises([chapter], app_f)
    assert errors == []
```

- [ ] **Step 18: Run test to verify it fails**

Run: `python -m pytest scripts/handbook/tests/test_validate_exercises.py -v`

Expected: FAIL with `ModuleNotFoundError: scripts.handbook.validate_exercises`

- [ ] **Step 19: Implement `validate_exercises`**

Create `scripts/handbook/validate_exercises.py`:

```python
"""Verify every exercise has a solution and every solution has an exercise.

Solution headings in app-f-exercise-solutions.md follow the pattern:
    ## <chapter-slug> — <exercise-number>

For example: '## 01-what-ocean-is — 1' is the solution to exercise 1
of chapter 01-what-ocean-is.
"""
from __future__ import annotations

import re
from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter

_SOLUTION_HEADING_RE = re.compile(
    r"^##\s+([a-z0-9-]+)\s+(?:—|--)\s+(\d+)\s*$",
    re.MULTILINE,
)


def validate_exercises(chapter_paths: list[Path], app_f_path: Path) -> list[str]:
    errors: list[str] = []

    # Collect exercises across all chapters: (slug, number) tuples.
    exercises: set[tuple[str, int]] = set()
    for chapter_path in chapter_paths:
        parsed = parse_chapter(chapter_path)
        slug = parsed.frontmatter.get("slug")
        for ex in parsed.exercises:
            if slug:
                exercises.add((slug, ex.number))

    # Collect solutions from app-f.
    app_f_text = app_f_path.read_text(encoding="utf-8")
    solutions = set()
    for match in _SOLUTION_HEADING_RE.finditer(app_f_text):
        solutions.add((match.group(1), int(match.group(2))))

    for ex_slug, ex_num in sorted(exercises):
        if (ex_slug, ex_num) not in solutions:
            errors.append(
                f"missing solution for {ex_slug} — {ex_num} in app-f"
            )

    for sol_slug, sol_num in sorted(solutions):
        if (sol_slug, sol_num) not in exercises:
            errors.append(
                f"orphan solution {sol_slug} — {sol_num} in app-f "
                f"(no matching exercise)"
            )

    return errors
```

- [ ] **Step 20: Run test to verify it passes**

Run: `python -m pytest scripts/handbook/tests/test_validate_exercises.py -v`

Expected: PASS (3 tests).

- [ ] **Step 21: Write the failing test for `validate_glossary`**

Create `scripts/handbook/tests/test_validate_glossary.py`:

```python
"""Tests for validate_glossary: every italicized term has a glossary entry."""
from __future__ import annotations
from pathlib import Path
import pytest

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_glossary import validate_glossary, GLOSSARY_TERM_RE


def test_term_with_entry_passes(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text(
        "---\nslug: test-glossary\nnumber: 1\ntitle: \"X\"\n"
        "promise: \"learn\"\nstatus: draft\n---\n# Ch 1 — X\n"
        "> learn\n\n## Concepts in this chapter\n- x\n\n"
        "A _substrate_ is a thing.\n\n"
        "## Wider system\nstuff\n\n## Exercises\n1. Do x.\n\n"
        "## What's next\nnext\n"
    )

    glossary = tmp_path / "app-d-glossary.md"
    glossary.write_text(
        "---\nslug: app-d-glossary\nnumber: null\ntitle: \"App D\"\n"
        "promise: \"defs\"\nstatus: draft\n---\n# App D\n\n> defs\n\n"
        "## substrate\nA substrate is...\n"
    )

    errors = validate_glossary([chapter], glossary)
    assert errors == []


def test_term_without_entry_fails(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text(
        "---\nslug: test-glossary\nnumber: 1\ntitle: \"X\"\n"
        "promise: \"learn\"\nstatus: draft\n---\n# Ch 1 — X\n"
        "> learn\n\n## Concepts in this chapter\n- x\n\n"
        "A _gadzook_ is undefined.\n\n"
        "## Wider system\nstuff\n\n## Exercises\n1. Do x.\n\n"
        "## What's next\nnext\n"
    )

    glossary = tmp_path / "app-d-glossary.md"
    glossary.write_text(
        "---\nslug: app-d-glossary\nnumber: null\ntitle: \"App D\"\n"
        "promise: \"defs\"\nstatus: draft\n---\n# App D\n\n> defs\n"
    )

    errors = validate_glossary([chapter], glossary)
    assert any("gadzook" in e for e in errors)
```

- [ ] **Step 22: Run test to verify it fails**

Run: `python -m pytest scripts/handbook/tests/test_validate_glossary.py -v`

Expected: FAIL with `ModuleNotFoundError: scripts.handbook.validate_glossary`

- [ ] **Step 23: Implement `validate_glossary`**

Create `scripts/handbook/validate_glossary.py`:

```python
"""Verify every italicized glossary candidate term has an entry in app-d.

A 'glossary candidate' is any single-word italicized term: `_word_` or
`*word*`. Multi-word phrases and emphasis on common words are ignored
by maintaining a stop list.

Glossary entries in app-d-glossary.md are H2 sections: '## term'.
"""
from __future__ import annotations

import re
from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter

GLOSSARY_TERM_RE = re.compile(r"(?<![\w*])(?:_|\*)([a-z][a-z0-9_-]{2,})(?:_|\*)(?![\w*])")
_GLOSSARY_HEADING_RE = re.compile(r"^##\s+([a-z][a-z0-9_ -]+)\s*$", re.MULTILINE)

_STOPLIST: set[str] = {
    "the", "and", "but", "for", "with", "this", "that", "from", "into",
    "very", "such", "more", "less", "only", "also", "than", "then",
    "true", "false", "must", "will", "would", "could", "should",
}


def validate_glossary(chapter_paths: list[Path], glossary_path: Path) -> list[str]:
    errors: list[str] = []

    glossary_text = glossary_path.read_text(encoding="utf-8")
    defined = {
        m.group(1).strip().lower()
        for m in _GLOSSARY_HEADING_RE.finditer(glossary_text)
    }

    seen_terms: set[str] = set()
    for chapter_path in chapter_paths:
        parsed = parse_chapter(chapter_path)
        body = "\n\n".join(s.body for s in parsed.sections)
        for match in GLOSSARY_TERM_RE.finditer(body):
            term = match.group(1).lower()
            if term in _STOPLIST or term in seen_terms:
                continue
            seen_terms.add(term)
            if term not in defined:
                errors.append(
                    f"{chapter_path}: italicized term '{term}' has no "
                    f"entry in app-d-glossary.md"
                )

    return errors
```

- [ ] **Step 24: Run test to verify it passes**

Run: `python -m pytest scripts/handbook/tests/test_validate_glossary.py -v`

Expected: PASS (2 tests).

- [ ] **Step 25: Write the failing test for `validate_corpora`**

Create `scripts/handbook/tests/test_validate_corpora.py`:

```python
"""Tests for validate_corpora: runnable snippets reference known toy corpora."""
from __future__ import annotations
from pathlib import Path
import pytest

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_corpora import validate_corpora


def test_known_corpus_passes(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text(
        "---\nslug: test-corpora\nnumber: 1\ntitle: \"X\"\n"
        "promise: \"learn\"\nstatus: draft\n---\n# Ch 1 — X\n"
        "> learn\n\n## Concepts in this chapter\n- x\n\n"
        "```ocean run corpus=toy_tna_50\n"
        "load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive\n"
        "save to /tmp/t.json\n"
        "```\n\n"
        "## Wider system\nstuff\n\n## Exercises\n1. Do x.\n\n"
        "## What's next\nnext\n"
    )
    errors = validate_corpora([chapter])
    assert errors == []


def test_unknown_corpus_fails(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text(
        "---\nslug: test-corpora\nnumber: 1\ntitle: \"X\"\n"
        "promise: \"learn\"\nstatus: draft\n---\n# Ch 1 — X\n"
        "> learn\n\n## Concepts in this chapter\n- x\n\n"
        "```ocean run corpus=nonexistent_corpus\n"
        "load _toy_corpora/whatever.ndjson take 50 records\n"
        "save to /tmp/t.json\n"
        "```\n\n"
        "## Wider system\nstuff\n\n## Exercises\n1. Do x.\n\n"
        "## What's next\nnext\n"
    )
    errors = validate_corpora([chapter])
    assert any("nonexistent_corpus" in e for e in errors)
```

- [ ] **Step 26: Run test to verify it fails**

Run: `python -m pytest scripts/handbook/tests/test_validate_corpora.py -v`

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 27: Implement `validate_corpora`**

Create `scripts/handbook/validate_corpora.py`:

```python
"""Verify every runnable snippet references one of the three known toy corpora.

The toy corpora are defined in spec §5.4 and bundled by Plan C. Their
canonical names are fixed.
"""
from __future__ import annotations

from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter

TOY_CORPORA: set[str] = {
    "toy_tna_50",
    "toy_nslkdd_200",
    "toy_climate_100",
}


def validate_corpora(chapter_paths: list[Path]) -> list[str]:
    errors: list[str] = []
    for chapter_path in chapter_paths:
        parsed = parse_chapter(chapter_path)
        for i, snippet in enumerate(parsed.snippets):
            if not snippet.runnable:
                continue
            if snippet.corpus is None:
                errors.append(
                    f"{chapter_path}: runnable snippet {i} has no "
                    f"corpus= argument (use 'corpus=toy_tna_50' etc.)"
                )
            elif snippet.corpus not in TOY_CORPORA:
                errors.append(
                    f"{chapter_path}: runnable snippet {i} references "
                    f"unknown corpus '{snippet.corpus}' "
                    f"(must be one of: {sorted(TOY_CORPORA)})"
                )
    return errors
```

- [ ] **Step 28: Run test to verify it passes**

Run: `python -m pytest scripts/handbook/tests/test_validate_corpora.py -v`

Expected: PASS (2 tests).

- [ ] **Step 29: Write the failing test for `validate_voice`**

Create `scripts/handbook/tests/test_validate_voice.py`:

```python
"""Tests for validate_voice: enforces voice rules from spec §3.4."""
from __future__ import annotations
from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_voice import validate_voice


def test_first_person_fails(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text(
        "---\nslug: test-voice\nnumber: 1\ntitle: \"X\"\n"
        "promise: \"we will learn things together\"\nstatus: draft\n---\n"
        "# Ch 1 — X\n> we will learn things together\n\n"
        "## Concepts in this chapter\n- x\n\n"
        "Our pipeline does things. We then save it.\n\n"
        "## Wider system\nstuff\n\n## Exercises\n1. Do x.\n\n"
        "## What's next\nnext\n"
    )
    errors = validate_voice([chapter])
    assert any("first-person" in e.lower() for e in errors)


def test_revenue_projection_fails(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text(
        "---\nslug: test-voice\nnumber: 1\ntitle: \"X\"\n"
        "promise: \"learn\"\nstatus: draft\n---\n# Ch 1 — X\n> learn\n\n"
        "## Concepts in this chapter\n- x\n\n"
        "By Q3 ARR will grow 40% MRR is up 12 percent year over year.\n\n"
        "## Wider system\nstuff\n\n## Exercises\n1. Do x.\n\n"
        "## What's next\nnext\n"
    )
    errors = validate_voice([chapter])
    assert any("projection" in e.lower() or "arr" in e.lower() or "mrr" in e.lower() for e in errors)


def test_clean_text_passes(tmp_path):
    chapter = tmp_path / "01-x.md"
    chapter.write_text(
        "---\nslug: test-voice\nnumber: 1\ntitle: \"X\"\n"
        "promise: \"learn things\"\nstatus: draft\n---\n# Ch 1 — X\n"
        "> learn things\n\n"
        "## Concepts in this chapter\n- x\n\n"
        "The pipeline runs. You then save the artifact.\n\n"
        "## Wider system\nstuff\n\n## Exercises\n1. Do x.\n\n"
        "## What's next\nnext\n"
    )
    errors = validate_voice([chapter])
    assert errors == []
```

- [ ] **Step 30: Run test to verify it fails**

Run: `python -m pytest scripts/handbook/tests/test_validate_voice.py -v`

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 31: Implement `validate_voice`**

Create `scripts/handbook/validate_voice.py`:

```python
"""Enforce voice rules from spec §3.4.

  - No first-person: 'we', 'our', 'us', 'ours', 'I' (case-insensitive,
    word-boundary anchored, ignoring code blocks).
  - No revenue projections / monthly forecasts: 'ARR', 'MRR', and
    '<digit>% growth/projection/forecast' patterns.

Code blocks (```...```) are skipped — operator names like 'us' inside
a snippet are fine.
"""
from __future__ import annotations

import re
from pathlib import Path

_FIRST_PERSON_RE = re.compile(
    r"\b(we|our|us|ours|i)\b",
    re.IGNORECASE,
)
_FORBIDDEN_FINANCE_RE = re.compile(
    r"\b(ARR|MRR|month-over-month|year-over-year|YoY|MoM)\b"
    r"|\b\d+\s*%\s*(growth|projection|forecast|increase)",
    re.IGNORECASE,
)
_CODE_BLOCK_RE = re.compile(r"```.*?```", re.DOTALL)


def validate_voice(chapter_paths: list[Path]) -> list[str]:
    errors: list[str] = []
    for chapter_path in chapter_paths:
        text = chapter_path.read_text(encoding="utf-8")
        prose = _CODE_BLOCK_RE.sub("", text)
        # Drop the YAML frontmatter — slug/promise/title prose is exempt.
        prose = re.sub(r"^---.*?---", "", prose, count=1, flags=re.DOTALL)

        for match in _FIRST_PERSON_RE.finditer(prose):
            line = prose[:match.start()].count("\n") + 1
            errors.append(
                f"{chapter_path}:{line}: first-person word "
                f"'{match.group(0)}' — rewrite using 'you', "
                f"'the program', or 'OCEAN'"
            )

        for match in _FORBIDDEN_FINANCE_RE.finditer(prose):
            line = prose[:match.start()].count("\n") + 1
            errors.append(
                f"{chapter_path}:{line}: forbidden financial-projection "
                f"phrase '{match.group(0)}' — spec §3.4 forbids "
                f"revenue projections, MRR/ARR, and "
                f"month-over-month forecasts"
            )

    return errors
```

- [ ] **Step 32: Run test to verify it passes**

Run: `python -m pytest scripts/handbook/tests/test_validate_voice.py -v`

Expected: PASS (3 tests).

- [ ] **Step 33: Implement the top-level `build.py`**

Create `scripts/handbook/build.py`:

```python
"""Top-level handbook build and validation.

Modes:
    python -m scripts.handbook.build --check
        Run all validators. Exit 0 on success, 1 on any error.
        Used in CI.

    python -m scripts.handbook.build --emit-content frontend/lib/handbook-content.generated.ts
        Run validators; if all pass, emit the generated TypeScript content
        module for the frontend. Used at frontend build time.

The validators run in this order; later ones depend on earlier ones
succeeding:
    1. parse every chapter
    2. validate_skeleton (structure)
    3. validate_snippets (ocean compile)
    4. validate_corpora (toy-corpus references)
    5. validate_glossary (italicized term coverage)
    6. validate_exercises (exercise <-> solution pairing)
    7. validate_voice (style rules)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter, ChapterParseError
from scripts.handbook.validate_skeleton import validate_skeleton
from scripts.handbook.validate_snippets import validate_snippets
from scripts.handbook.validate_corpora import validate_corpora
from scripts.handbook.validate_glossary import validate_glossary
from scripts.handbook.validate_exercises import validate_exercises
from scripts.handbook.validate_voice import validate_voice


HANDBOOK_DIR = Path("docs/handbook")


def collect_chapter_paths() -> list[Path]:
    if not HANDBOOK_DIR.exists():
        return []
    return sorted(
        p for p in HANDBOOK_DIR.glob("*.md")
        if p.name not in {"app-d-glossary.md", "app-f-exercise-solutions.md"}
    )


def run_validators() -> list[str]:
    errors: list[str] = []
    chapter_paths = collect_chapter_paths()

    parsed_chapters = []
    for p in chapter_paths:
        try:
            parsed_chapters.append(parse_chapter(p))
        except ChapterParseError as e:
            errors.append(str(e))

    if errors:
        return errors

    for parsed in parsed_chapters:
        errors.extend(validate_skeleton(parsed))
        errors.extend(
            f"{e.chapter_path}:{e.chapter_line}: {e.category}: {e.message}"
            for e in validate_snippets(parsed)
        )

    errors.extend(validate_corpora(chapter_paths))
    errors.extend(validate_glossary(chapter_paths, HANDBOOK_DIR / "app-d-glossary.md"))
    errors.extend(validate_exercises(chapter_paths, HANDBOOK_DIR / "app-f-exercise-solutions.md"))
    errors.extend(validate_voice(chapter_paths + [HANDBOOK_DIR / "app-d-glossary.md", HANDBOOK_DIR / "app-f-exercise-solutions.md"]))

    return errors


def emit_content(output_path: Path) -> None:
    chapter_paths = sorted(HANDBOOK_DIR.glob("*.md"))
    chapters = []
    for p in chapter_paths:
        parsed = parse_chapter(p)
        chapters.append({
            "slug": parsed.frontmatter.get("slug"),
            "number": parsed.frontmatter.get("number"),
            "title": parsed.frontmatter.get("title"),
            "promise": parsed.promise,
            "concepts": [
                line.lstrip("- ").strip()
                for s in parsed.sections
                if s.title == "Concepts in this chapter"
                for line in s.body.splitlines()
                if line.strip().startswith("-")
            ],
            "outline": [
                {"id": s.title.lower().replace(" ", "-"), "text": s.title, "level": 2}
                for s in parsed.sections
            ],
            "snippets": [
                {
                    "code": sn.code,
                    "runnable": sn.runnable,
                    "corpus": sn.corpus,
                    "line": sn.line,
                }
                for sn in parsed.snippets
            ],
            "exercises": [
                {"number": ex.number, "prompt": ex.prompt}
                for ex in parsed.exercises
            ],
        })

    ts_content = (
        "// Generated by scripts/handbook/build.py — DO NOT EDIT.\n"
        "// Source of truth: docs/handbook/*.md\n\n"
        "export const handbookChapters = "
        + json.dumps(chapters, indent=2, ensure_ascii=False)
        + " as const;\n"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(ts_content, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="run validators, exit non-zero on error")
    parser.add_argument("--emit-content", type=Path, default=None, help="write generated TS content module to this path")
    args = parser.parse_args(argv)

    errors = run_validators()
    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1

    if args.emit_content is not None:
        emit_content(args.emit_content)
        print(f"wrote {args.emit_content}")

    if args.check:
        print(f"handbook: {len(collect_chapter_paths())} chapters validated, 0 errors")

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 34: Run the full validator against the empty skeletons**

Run: `cd C:/Users/diren/Desktop/lsx-latentocean && python -m scripts.handbook.build --check`

Expected: many errors (every chapter file is just a stub with a placeholder promise; the skeleton, snippet, glossary, exercise, and voice validators will all fire). This is normal — chapters get filled in tasks 1-22 and errors disappear as each chapter is authored. **Do not proceed to the next task if the validator crashes (Python traceback). Errors printed as `ERROR: ...` are expected and fine.**

- [ ] **Step 35: Commit the bootstrap**

```bash
git add docs/handbook scripts/handbook
git commit -m "handbook: bootstrap directory, skeleton files, build script and validators"
```

---

## Tasks 1-22: Author each chapter and appendix

Each of these tasks follows the same shape. The body of each task names which file, gives the binding outline (concepts, section list, the snippets that must appear, exercise prompts), and ends with the validate + commit steps.

**General authoring rules** (apply to every chapter task — do not repeat in each task body):

- Use the binding skeleton from spec §3.3. Numbered chapters MUST have all four sections: `Concepts in this chapter`, `Wider system`, `Exercises`, `What's next`. Preface and appendices use the relaxed skeleton.
- Body sections come between `Concepts in this chapter` and `Wider system`. They are H2 sections. Use as many or as few as the material needs.
- Every concept is introduced by a code snippet *before* it is explained.
- Snippets use the bundled toy corpora (`toy_tna_50`, `toy_nslkdd_200`, `toy_climate_100`). Snippets that need to demonstrate file structure but don't need to run use a fictional path like `tmp/corpus.ndjson` and the fence info `ocean static`.
- Italicize a term on first introduction (`_substrate_`, `_module_`, etc.) and add a glossary entry in Task 19.
- Exercises are numbered and must each have a solution written in Task 21.
- No first-person. No revenue projections. Em dashes OK.
- After authoring, **always** run `python -m scripts.handbook.build --check` and fix everything the validator complains about *for this chapter* before committing. Errors about other chapters that haven't been authored yet are fine to leave.

**Per-task step template** (used by every chapter task):

```
- [ ] Step 1: Outline the chapter in a scratch note (concepts list, body section titles, snippets to include, exercise prompts).
- [ ] Step 2: Write the snippets first; paste each into a temporary `.ocean` file under `tmp/handbook-drafts/<slug>.ocean` and confirm `python -m scripts.operators.ocean.typecheck tmp/handbook-drafts/<slug>.ocean` passes. (For multi-snippet chapters, do this per snippet.)
- [ ] Step 3: Draft the chapter body in `docs/handbook/<slug>.md`, surrounding the snippets with prose. Code-first: snippet → explanation.
- [ ] Step 4: Draft the `Wider system` sidebar. Read it standalone — does it make sense without the body?
- [ ] Step 5: Draft the `Exercises` section. Verify each is solvable using only material introduced through this chapter.
- [ ] Step 6: Draft the `What's next` section (one sentence pointing to the next chapter).
- [ ] Step 7: Run `python -m scripts.handbook.build --check` and fix anything the validator reports for this chapter.
- [ ] Step 8: Commit with message `handbook: author Ch <N> — <title>`.
```

The per-chapter task body below names the slug and supplies the binding outline (concepts, section list, snippet requirements, exercise prompts). The eight steps are not re-listed.

---

### Task 1: Author `00-preface.md`

**File:** `docs/handbook/00-preface.md`

**Binding outline:**
- Promise: "After reading this preface you know what background the book assumes, the three reading paths through it, and where the canonical OCEAN reference lives."
- This file uses the **relaxed skeleton** — no Concepts/Wider system/Exercises/What's next sections required.
- Sections (H2):
  - "Who this book is for" — names the primary audience (general programmer who has not run a clustering pipeline) and the secondary audience (domain expert reading the "Wider system" sidebars).
  - "What this book is not" — names `docs/OCEAN_LANG.md` as the formal reference, `docs/PRIMITIVE_SPEC.md` as the lo_fingerprint primitive spec, and `packages/ocean-mcp/README.md` as the agent-tool README. This book complements them.
  - "Three reading paths" — quotes the three paths from spec §1.3 verbatim.
  - "Conventions" — fenced `.ocean` blocks, italicized first-introduction terms, the "Run" button on snippets, the toy-corpus card in Appendix B.
- No snippets required.
- Apply the per-task step template above. Skip steps 4-6 (no Wider system / Exercises / What's next for this relaxed-skeleton file).

---

### Task 2: Author `01-what-ocean-is.md`

**File:** `docs/handbook/01-what-ocean-is.md`

**Binding outline:**
- Promise: "After this chapter you can answer the question 'why does OCEAN exist?' in three sentences."
- Concepts: "DSL vs library", "deterministic by construction", "substrate-clustering", "open-core operator catalog".
- Body sections (H2):
  - "A language for one job"
  - "Determinism is the contract"
  - "What 'substrate-clustering' means"
  - "Open-core: what's free, what's paid"
- Snippets:
  - One `ocean static` snippet showing the six-line canonical pipeline (load → embed → cluster → align → find → save), unannotated, to anchor the chapter visually.
- "Wider system": Frames OCEAN against Postgres, dbt, Stripe — verticalless infrastructure with metered premium operators. Cites the deployment surface list (Postgres extension, MCP server, HTTP API, CLI). Two paragraphs.
- Exercises:
  1. Find one line in the six-line snippet that names a free-tier operator and one line that names a premium operator. (Both are present.)
  2. In your own words, write the difference between "deterministic" and "reproducible" as the chapter uses them. (Glossary lookup is allowed.)
- What's next: "Chapter 2 runs this six-line pipeline end-to-end on a toy corpus and reads its output."

---

### Task 3: Author `02-your-first-pipeline.md`

**File:** `docs/handbook/02-your-first-pipeline.md`

**Binding outline:**
- Promise: "After this chapter you have run a complete OCEAN pipeline and read its output."
- Concepts: "loading NDJSON", "embedding text", "clustering into modules", "aligning modules to records", "dispersion", "the JSON artifact".
- Body sections:
  - "The toy_tna_50 corpus" (one paragraph + a 3-record JSON example from `_toy_corpora/toy_tna_50.ndjson`)
  - "Six lines that run" (the canonical pipeline as a runnable snippet)
  - "Reading the output artifact" (a truncated example of the resulting JSON)
  - "What the six lines mean" (high-level explanation; the precise grammar is deferred to later chapters)
- Snippets:
  - One `ocean run corpus=toy_tna_50` snippet:
    ```
    load _toy_corpora/toy_tna_50.ndjson take 50 records balanced by archive
    embed text into 64 dimensions using tf-idf
    cluster for 8 rounds max 6 modules energy = corpus mean
    align modules using 5 nearest records
    find dispersion of each label
    save to /tmp/first_pipeline.json
    ```
  - This snippet must validate AND run in under 5 seconds against `toy_tna_50`.
- Wider system: Why OCEAN is a single line of `load` rather than a multi-step ingest pipeline. Comparable to `SELECT ... FROM table` in SQL: one verb that does an enormous amount. Includes the substrate-status note that OCEAN's vocabulary (load, embed, cluster, align, find, save) is meant to leak into how readers describe future problems they encounter.
- Exercises:
  1. Change `dimensions` from 64 to 128 and re-run. Does dispersion go up or down?
  2. Change `max 6 modules` to `max 12 modules`. How does the artifact change?
- What's next: "Chapter 3 zooms in on the lexical level — what counts as a token, an identifier, a literal."

---

### Task 4: Author `03-source-files-and-tokens.md`

**File:** `docs/handbook/03-source-files-and-tokens.md`

**Binding outline:**
- Promise: "After this chapter you can read any OCEAN source file at the lexical level: every comment, identifier, literal, and keyword."
- Concepts: "UTF-8 source", "statement-significant newlines", "reserved words vs verbs", "identifier rules", "literal classes (int, float, string, path, bool, interpolation)".
- Body sections:
  - "Source encoding and line endings"
  - "Comments"
  - "Identifiers"
  - "Literals" (int, float, string, path, bool, ${interp})
  - "Reserved words and verbs" (a table reproducing OCEAN_LANG.md §1.3, §1.4)
  - "Operators" (=, ==, !=, <, >, <=, >=, +, -, *, /, plus the keyword booleans `and`/`or`/`not`)
- Snippets:
  - Several short `ocean static` snippets demonstrating each literal class. None need to run.
- Wider system: How being statement-significant on newlines (rather than semicolons) matches OCEAN's pipeline-shape: each line is a step. Comparison to make/Makefile (newline-significant) and shell (newline-significant).
- Exercises:
  1. Write the simplest legal OCEAN program. (Answer: empty file.)
  2. Spot the lexical error in a one-line snippet that uses `&&` instead of `and`.
- What's next: "Chapter 4 introduces the seven pipeline types — what flows through the pipeline lines."

---

### Task 5: Author `04-the-pipeline-types.md`

**File:** `docs/handbook/04-the-pipeline-types.md`

**Binding outline:**
- Promise: "After this chapter you can name the seven pipeline types, the verb that produces each, and the verb that consumes each."
- Concepts: "Records, Z, Modules, Aligned, Dispersion, Artifact, Pipeline", "static typing", "the producer/consumer table", "subtyping (Aligned <: Modules)".
- Body sections:
  - "Why static types in a pipeline language"
  - "The seven pipeline types" (table from OCEAN_LANG.md §3.2)
  - "Operator signatures" (table from §3.3)
  - "Subtyping: Aligned is a Modules"
  - "Reading a type error" (an example diagnostic; reuse OCEAN_LANG.md §3.6)
- Snippets:
  - One `ocean static` snippet showing a type error visually (paste of the diagnostic from OCEAN_LANG.md §3.6).
- Wider system: The seven types are deliberately fewer than would arise from a general data-flow language. Compare to Spark RDDs vs DataFrames: fewer types = clearer guarantees. The substrate-status angle: the type names (`Records`, `Z`, `Modules`, `Dispersion`) are part of OCEAN's vocabulary; when developers say "I want to see the dispersion of this label" they are speaking OCEAN even if they don't run the language.
- Exercises:
  1. Given a program that calls `cluster` directly after `load`, write the type error the compiler will produce.
  2. Name the verbs that consume `Dispersion`.
- What's next: "Chapter 5 starts the verb-by-verb tour with `load`."

---

### Task 6: Author `05-load-and-records.md`

**File:** `docs/handbook/05-load-and-records.md`

**Binding outline:**
- Promise: "After this chapter you can load any NDJSON corpus, stratify the sample, and choose which fields are text and label."
- Concepts: "NDJSON shape", "`take N records`", "`balanced by FIELD`", "`text field is`", "`label field is`", "the Records value".
- Body sections:
  - "NDJSON: one JSON object per line"
  - "Sampling: `take` and `balanced by`"
  - "Pointing at the right fields: `text field is` and `label field is`"
  - "What a Records value contains"
- Snippets (all `ocean run corpus=toy_tna_50` unless marked otherwise):
  - Minimal load (one line)
  - Load with `take 30 records balanced by archive`
  - Load with explicit `text field is body` (use a fictional field name; this must be `ocean static`)
- Wider system: How OCEAN's load contracts compare to dbt sources and Postgres `COPY`. Note: the `balanced by` knob is the most underrated knob in the language — it's the difference between accidentally training on one class and discovering structural patterns across classes.
- Exercises:
  1. Load `toy_nslkdd_200` taking 100 records balanced by `type`.
  2. What happens if `take N` is greater than the corpus size?
- What's next: "Chapter 6 covers `embed` — turning Records into Z (the latent space)."

---

### Task 7: Author `06-embed-and-z.md`

**File:** `docs/handbook/06-embed-and-z.md`

**Binding outline:**
- Promise: "After this chapter you can choose between three embedder variants and pick a sensible dimension."
- Concepts: "TF-IDF + JL projection", "MiniLM-L6 transformer embedder", "one-hot numeric", "the premium `content fingerprint` variant (referenced, not run)", "choosing `into N dimensions`".
- Body sections:
  - "What `embed` produces: the Z space"
  - "`tf-idf` — the default, free-tier"
  - "`embed.transformer minilm_l6` — when the corpus is short, semantic"
  - "`one-hot numeric` — when the corpus is non-text"
  - "`content fingerprint` — premium variant, when structural shape matters more than content" (NOT runnable; explain the grammar and refer to Appendix B for the operator card)
  - "Choosing dimensions"
- Snippets:
  - `ocean run corpus=toy_tna_50`: tf-idf embed at 128 dims
  - `ocean run corpus=toy_climate_100`: transformer embed at 384 dims (MiniLM-L6 native size)
  - `ocean run corpus=toy_nslkdd_200`: one-hot numeric at 64 dims
  - `ocean static`: a content-fingerprint snippet showing the grammar (the runner will gate this at execution time)
- Wider system: The split between TF-IDF and the content fingerprint is the open-core boundary made visible. TF-IDF is well-understood mathematics; content_fp48 is the proprietary structural primitive. The substrate-status angle: the verb `embed` is the same regardless of which variant — that uniformity is what lets readers' mental models survive a tier change.
- Exercises:
  1. Embed `toy_climate_100` at 64 vs 256 dimensions and compare run times.
  2. Why does `one-hot numeric` work poorly on `toy_tna_50` (a text corpus)?
- What's next: "Chapter 7 takes Z and clusters it into Modules."

---

### Task 8: Author `07-cluster-and-modules.md`

**File:** `docs/handbook/07-cluster-and-modules.md`

**Binding outline:**
- Promise: "After this chapter you can run a clustering pass with sensible defaults and explain why the defaults are sensible."
- Concepts: "k-means (free-tier baseline)", "tcd recursive loop (premium)", "`energy = corpus mean` vs `energy = normal anchored on LABEL`", "`for N rounds`", "`max M modules`", "`crystallize every K`".
- Body sections:
  - "What a module is"
  - "`cluster.kmeans` — the free-tier baseline" (runnable)
  - "`cluster.tcd_recursive_loop` — the premium variant" (grammar only; gated at runtime)
  - "Energy functions: `corpus mean` and `normal anchored`"
  - "Loop parameters: rounds, max modules, crystallize"
- Snippets:
  - `ocean run corpus=toy_tna_50`: k-means cluster at 8 modules, 12 rounds
  - `ocean run corpus=toy_nslkdd_200`: k-means with `energy = normal anchored on type` (where `normal` is one of the type labels)
  - `ocean static`: tcd recursive loop with crystallize every 4
- Wider system: Why the TCD recursive loop is the part of OCEAN that took the longest to design — it's the proprietary clustering algorithm whose guarantees (determinism, monotone module energy, bounded modules) are what made the substrate provable. The substrate-status angle: customers who use the free-tier k-means and the premium tcd_recursive_loop hot-swap them by changing one word.
- Exercises:
  1. Run k-means cluster on `toy_climate_100` with `max 4 modules`. How many records are in each module?
  2. What does `crystallize every K` mean and why would you set K to a small number?
- What's next: "Chapter 8 connects modules back to records (`align`) and measures the result (`find`)."

---

### Task 9: Author `08-align-and-find.md`

**File:** `docs/handbook/08-align-and-find.md`

**Binding outline:**
- Promise: "After this chapter you can read a dispersion artifact and explain what it claims about a corpus."
- Concepts: "module-to-record alignment via k-nearest", "`fine label field`", "`find dispersion of each label`", "what dispersion measures (a single normalized score per label per module)".
- Body sections:
  - "`align` — putting records back next to their modules"
  - "`find dispersion of each label`"
  - "Reading the dispersion artifact"
- Snippets:
  - `ocean run corpus=toy_tna_50`: full pipeline ending in find dispersion of each label, showing the artifact
  - `ocean static`: snippet showing `fine label field is FIELD` syntax
- Wider system: Dispersion is the "did this actually work?" gauge. It is the single number a buyer looks at. It is also intentionally ungameable: a high dispersion on a shuffled corpus (see `lo_null_test` in Appendix C) is the falsifiability test that backs the commercial commitment in the primitive spec.
- Exercises:
  1. Add `narrate modules` between align and find. Does the artifact differ?
  2. Run the same pipeline twice with the same seed. Are the dispersion values byte-identical?
- What's next: "Chapter 9 makes the determinism contract explicit — how OCEAN guarantees byte-identical artifacts."

---

### Task 10: Author `09-save-and-the-determinism-contract.md`

**File:** `docs/handbook/09-save-and-the-determinism-contract.md`

**Binding outline:**
- Promise: "After this chapter you understand exactly what 'deterministic' means for an OCEAN program, and why a re-run produces a byte-identical artifact."
- Concepts: "`save` writes JSON + sha256", "the file-content sha256 baked into `load`", "the operator purity contract", "deterministic `sweep` expansion", "the seed".
- Body sections:
  - "`save` and what it writes"
  - "The four pillars of determinism" (reproducing OCEAN_LANG.md §4.2 in handbook voice)
  - "The seed and how to pick one"
  - "How to verify a re-run is identical" (`sha256sum` the artifact)
- Snippets:
  - `ocean run corpus=toy_tna_50`: full pipeline saving to two paths; the chapter walks the reader through `sha256sum` of both
  - `ocean static`: snippet with `seed 42` and `seed 43` showing they produce different (but each deterministic) artifacts
- Wider system: Determinism is the commercial spine — it's the thing the primitive spec's commercial commitment in §11 depends on. Without bit-identical artifacts, "we retract the claim" cannot be tested. Comparison: how Stripe's idempotency keys turn retries into determinism for payments; OCEAN's seed turns reruns into determinism for analysis.
- Exercises:
  1. Re-run the pipeline from Ch 2 with the same seed. Compute `sha256sum` of the artifact. Compare to a friend's.
  2. Change the seed and re-run. Does the dispersion change a lot or a little?
- What's next: "Chapter 10 adds control flow — let, if, sweep, parallel, compare."

---

### Task 11: Author `10-control-flow.md`

**File:** `docs/handbook/10-control-flow.md`

**Binding outline:**
- Promise: "After this chapter you can write conditional pipelines, parameter sweeps, methodology comparisons, and parallel branches."
- Concepts: "`let` (named bindings)", "`if/elif/else`", "`sweep` (parametric expansion)", "`parallel` (independent branches)", "`compare A against B on FINDING`".
- Body sections:
  - "Named bindings: `let`"
  - "`if`, `elif`, `else`"
  - "Parametric sweeps"
  - "`parallel` blocks"
  - "Methodology comparison: `compare ... against ... on ...`"
- Snippets:
  - `ocean run corpus=toy_tna_50`: a sweep over `seed` from 42 to 44
  - `ocean run corpus=toy_tna_50`: a compare between tf-idf and another tf-idf at half the dimensions (since content fingerprint isn't free-tier)
  - `ocean static`: parallel block with two independent saves
- Wider system: Why control flow is restricted — no general loops, no recursion, no Turing-completeness. The pipeline is always a finite DAG with a known number of branches at compile time. This is the same restriction SQL imposes and for the same reason: it lets the planner reason about cost.
- Exercises:
  1. Write a sweep that varies `dimensions` from 32 to 128 in steps of 32.
  2. Write a compare between `tf-idf` and `embed.transformer minilm_l6` on `find dispersion of each label`.
- What's next: "Chapter 11 covers reusable named pipelines: `define`, `import`, and the stdlib."

---

### Task 12: Author `11-functions-modules-stdlib.md`

**File:** `docs/handbook/11-functions-modules-stdlib.md`

**Binding outline:**
- Promise: "After this chapter you can read `stdlib/substrate.ocean`, call its functions, and write your own."
- Concepts: "`define` with default parameters", "`return`", "`import \"path\" as name`", "calling stdlib functions", "writing your own stdlib".
- Body sections:
  - "Defining a function"
  - "Calling a function: stdlib's `basic_run`"
  - "Default parameters"
  - "Imports and namespacing"
  - "When to author a stdlib function"
- Snippets:
  - `ocean run corpus=toy_tna_50`: import `substrate.ocean as substrate`, call `substrate.basic_run(corpus=...)` with target=50
  - `ocean static`: a user-defined function `define my_run(corpus, target=100) do ... end`
- Wider system: The stdlib is where the substrate-status play shows most plainly — every preset (`basic_run`, `seed_sweep`, `anomaly_focused`, `content_vs_structural`) is a pattern that customers describe in their own work even if they don't import the stdlib. When a customer says "we did a seed sweep" they have already adopted OCEAN's vocabulary.
- Exercises:
  1. Call `substrate.seed_sweep` with `first_seed=42`, `last_seed=43`.
  2. Define a function `my_anomaly(corpus, output)` that wraps `anomaly_focused` with `target=100`.
- What's next: "Chapter 12 covers the tooling around the language — REPL, formatter, linter, LSP, and the MCP server."

---

### Task 13: Author `12-tooling-and-the-lsp.md`

**File:** `docs/handbook/12-tooling-and-the-lsp.md`

**Binding outline:**
- Promise: "After this chapter you can compile, run, format, lint, and edit OCEAN with full IDE support and as an LLM tool."
- Concepts: "the compiler/runner CLI", "the REPL", "the formatter", "the linter and its rules", "the LSP", "the MCP server".
- Body sections:
  - "Compile and run: `python -m scripts.run_universal_pipeline --config x.ocean`"
  - "REPL: `python -m scripts.operators.ocean.repl`"
  - "Format: `python -m scripts.operators.ocean.format`"
  - "Lint: `python -m scripts.operators.ocean.lint`"
  - "LSP: VS Code, Cursor, Goose"
  - "MCP: OCEAN as an agent tool" (refers reader to `packages/ocean-mcp/README.md`)
- Snippets:
  - All `ocean static` — the chapter is about CLI usage, not language semantics.
- Wider system: Why a tiny DSL needs its own LSP and MCP server: vocabulary capture only happens if the language is at the agent's fingertips. The first time an agent autocompletes `cluster for 16 rounds`, OCEAN has won a token-level adoption point.
- Exercises:
  1. Run the linter on the snippet from Ch 2. What does it warn about?
  2. Start the REPL and run two let-bindings; verify the second can reference the first.
- What's next: "Chapter 13 is the idioms chapter — patterns and anti-patterns drawn from the stdlib."

---

### Task 14: Author `13-effective-ocean.md`

**File:** `docs/handbook/13-effective-ocean.md`

**Binding outline:**
- Promise: "After this chapter you write OCEAN the way an experienced OCEAN author writes it."
- Concepts: idioms and anti-patterns. Roughly modeled on Scott Meyers' *Effective C++*.
- Body sections:
  - "Idiom: name your bindings"
  - "Idiom: small seeds before sweeps"
  - "Idiom: prefer `compare` over duplicate pipelines"
  - "Idiom: put `narrate` last, never between cluster and align"
  - "Anti-pattern: re-`embed` per branch in a sweep"
  - "Anti-pattern: hidden upstream dependencies via positional defaults"
  - "Anti-pattern: tuning dimensions before checking dispersion"
- Snippets:
  - For each idiom and anti-pattern, one `ocean static` snippet showing the pattern (or its inverse).
- Wider system: This chapter is where most readers learn the *culture* of OCEAN, not just the syntax. A language acquires substrate status partly through a shared sense of which patterns are "the right way."
- Exercises:
  1. Rewrite a given anti-pattern snippet into idiomatic OCEAN.
  2. Identify which of three snippets uses each anti-pattern in this chapter.
- What's next: "Chapter 14 connects OCEAN to the rest of your system: Postgres, MCP, HTTP, CLI, agent loops."

---

### Task 15: Author `14-interfacing-ocean.md`

**File:** `docs/handbook/14-interfacing-ocean.md`

**Binding outline:**
- Promise: "After this chapter you can invoke OCEAN from Postgres, the HTTP API, the MCP server, the CLI, and an agent loop."
- Concepts: "`pg_latentocean` Postgres extension", "the HTTP API", "the MCP server with Claude/Cursor/Goose", "the OCEAN CLI", "the agent-loop pattern".
- Body sections:
  - "`pg_latentocean`: OCEAN inside Postgres" (refers to existing extension code)
  - "The HTTP API"
  - "MCP: OCEAN as an LLM tool" (concrete examples of `ocean_compile`, `ocean_validate`, `ocean_run` tool calls)
  - "The CLI"
  - "Agent loop: compose, validate, run, iterate"
- Snippets:
  - `ocean static` snippets only — this chapter is about external surfaces, not new OCEAN syntax.
- Wider system: The deployment-surface list — Postgres, MCP, HTTP, CLI — is the substrate-status play made tangible. Each surface lowers the activation energy for a new user to find OCEAN already inside the tool they were going to use anyway. Comparable to how `psql` ships in every Linux distro: ubiquity is the moat.
- Exercises:
  1. Write a `psql` query that calls `lo_fingerprint` on a row.
  2. Configure the MCP server in Claude Desktop and run a `ocean_compile` on the Ch 2 snippet through it.
- What's next: "The appendices: grammar, operator catalog, primitive spec companion, glossary, reference card, exercise solutions."

---

### Task 16: Author `app-a-grammar.md`

**File:** `docs/handbook/app-a-grammar.md`

**Binding outline:**
- Promise: "This appendix is the complete EBNF grammar of OCEAN 1.0, identical to `docs/OCEAN_LANG.md` §2 but reformatted for skim-reading."
- Relaxed skeleton; no Concepts / Wider system / Exercises.
- Body section: "Grammar (EBNF)" — paste the exact EBNF block from `docs/OCEAN_LANG.md` §2 into a fenced code block with `ebnf` info string. Above it, one paragraph noting that this is normative and that any disagreement with the spec is a bug against the handbook, not against OCEAN.
- No snippets (the grammar block is `ebnf`, not `ocean`).

---

### Task 17: Author `app-b-operator-catalog.md`

**File:** `docs/handbook/app-b-operator-catalog.md`

**Binding outline:**
- Promise: "This appendix lists every operator OCEAN ships, its English-labeled parameter schema, and whether it is free-tier or premium."
- Relaxed skeleton.
- Body sections:
  - "Open-core operators" (free-tier; runnable from the handbook sandbox)
  - "Premium operators" (parsed and type-checked but require an API key to execute)
  - "Toy corpora card" (the three toy corpora — fields, labels, record count, total size)
- The catalog **table** in this appendix is generated by `scripts/handbook/build.py` from the registry that ships with Plan C (`backend/handbook_runner/premium_gate.py`). Until Plan C lands, write a hand-stub table for the eight operators visible in the existing codebase: `load.ndjson`, `embed.tfidf_jl`, `embed.transformer.minilm_l6`, `cluster.kmeans`, `align.module`, `find.dispersion_per_label`, `persist.json`, and the four premium ops named in spec §5.5. Mark the table with an HTML comment `<!-- AUTO-GENERATED: do not edit by hand once Plan C lands -->`.

---

### Task 18: Author `app-c-primitive-spec-companion.md`

**File:** `docs/handbook/app-c-primitive-spec-companion.md`

**Binding outline:**
- Promise: "This appendix is a handbook-voice summary of the `lo_fingerprint` primitive spec; the normative source is `docs/PRIMITIVE_SPEC.md`."
- Relaxed skeleton.
- Body sections (mirror PRIMITIVE_SPEC.md structure, but condensed):
  - "Domain and range" (one paragraph from PRIMITIVE_SPEC §1)
  - "Fingerprint construction in one paragraph"
  - "The score vector" (table of {anomaly, reconstruction, diversity, composite} with the reading-by-a-data-buyer column)
  - "The null test" (`lo_null_test`)
  - "Algebraic operations on the primitive" (table from PRIMITIVE_SPEC §5)
  - "What the primitive does NOT promise" (the falsifiability discipline)
  - "Where to find the normative spec" (link to `docs/PRIMITIVE_SPEC.md`)
- No snippets.

---

### Task 19: Author `app-d-glossary.md`

**File:** `docs/handbook/app-d-glossary.md`

**Binding outline:**
- Promise: "An alphabetical glossary of every italicized term introduced in the handbook."
- Relaxed skeleton.
- Each entry is an H2 (`## term`) followed by 1-3 sentences. Terms must cover (at minimum): `align`, `aligned`, `anchored`, `archive`, `artifact`, `btut`, `cluster`, `compare`, `corpus`, `crystallize`, `define`, `determinism`, `dimension`, `dispersion`, `embed`, `energy`, `fingerprint`, `fine`, `gold`, `import`, `label`, `latent`, `let`, `load`, `lsp`, `mcp`, `mean`, `module`, `narrate`, `normal`, `ocean`, `parallel`, `pipeline`, `premium`, `record`, `records`, `reduce`, `reproducibility`, `save`, `seed`, `sha256`, `substrate`, `sweep`, `tcd`, `tf-idf`, `tier`, `verb`, `z`.
- Author this AFTER chapters 1-15 are done so that every italicized term in the manuscript is captured. The `validate_glossary` check will catch any term you missed.

---

### Task 20: Author `app-e-reference-card.md`

**File:** `docs/handbook/app-e-reference-card.md`

**Binding outline:**
- Promise: "A one-page printable summary of every verb, control-flow form, and type."
- Relaxed skeleton; no Concepts / Wider system / Exercises.
- Body sections (each is one column on the printed page):
  - "Verbs" — eight verbs each with their one-line signature
  - "Types" — seven pipeline types and what produces each
  - "Control flow" — `let`, `if/elif/else`, `sweep`, `parallel`, `compare`, `define`, `import`
  - "Reserved words" — alphabetical list
  - "Tooling commands" — six CLI invocations on one line each
- Target ~100 lines total. Optimized for a single-screen view.

---

### Task 21: Author `app-f-exercise-solutions.md`

**File:** `docs/handbook/app-f-exercise-solutions.md`

**Binding outline:**
- Promise: "Worked solutions to every exercise in the handbook."
- Relaxed skeleton.
- Each solution is an H2 with the heading pattern `## <chapter-slug> — <exercise-number>`. The body is a code snippet (if the exercise asks for code), a short prose explanation, or both.
- Author this AFTER chapters 1-15 are done so all exercise prompts are settled. The `validate_exercises` check catches missing or orphan solutions.

---

### Task 22: Author `index.md`

**File:** `docs/handbook/index.md`

**Binding outline:**
- Promise: "After reading the index you know which chapters and appendices exist and which one to read first."
- Relaxed skeleton.
- Body sections:
  - "Table of contents" (linked list of all 22 files)
  - "Reading paths" (the three paths from spec §1.3, with a one-line description and the chapter sequence under each)
  - "Where to find the canonical reference" (links to `docs/OCEAN_LANG.md`, `docs/PRIMITIVE_SPEC.md`, and `packages/ocean-mcp/README.md`)
- No snippets. No exercises.

---

## Task 23: Wire up CI

**Files:**
- Create: `.github/workflows/handbook.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/handbook.yml`:

```yaml
name: handbook

on:
  push:
    paths:
      - "docs/handbook/**"
      - "scripts/handbook/**"
      - "scripts/operators/ocean/**"
      - ".github/workflows/handbook.yml"
  pull_request:
    paths:
      - "docs/handbook/**"
      - "scripts/handbook/**"
      - "scripts/operators/ocean/**"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install pyyaml pytest
          # Install whatever the existing OCEAN compiler depends on
          if [ -f requirements.txt ]; then pip install -r requirements.txt; fi

      - name: Run validator unit tests
        run: python -m pytest scripts/handbook/tests -v

      - name: Validate handbook
        run: python -m scripts.handbook.build --check
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/handbook.yml
git commit -m "ci: validate handbook on push and PR"
```

---

## Task 24: Final cross-reference and snippet-runtime sweep

**Files:** all `docs/handbook/*.md`

- [ ] **Step 1: Run the full validator one more time**

Run: `python -m scripts.handbook.build --check`

Expected: zero errors. If any error remains, fix it in the relevant chapter and re-run.

- [ ] **Step 2: For every runnable snippet, run it end-to-end against the toy corpus**

This step depends on Plan C (the sandboxed runner) being far enough along that runnable snippets actually execute. If Plan C is not yet live, run each snippet locally:

```bash
for chapter in docs/handbook/*.md; do
  python -c "
import sys
from scripts.handbook.parse_chapter import parse_chapter
parsed = parse_chapter(sys.argv[1])
for i, snip in enumerate(parsed.snippets):
    if snip.runnable:
        with open('/tmp/snip.ocean', 'w') as f:
            f.write(snip.code)
        print(f'  snippet {i} ({snip.corpus}):')
        import subprocess
        subprocess.run(['python', '-m', 'scripts.run_universal_pipeline', '--config', '/tmp/snip.ocean'], check=True)
" "$chapter"
done
```

Expected: every snippet runs to completion in under 10 seconds. If any snippet exceeds 5 seconds, reduce `take N` or `dimensions` and re-author the affected chapter.

- [ ] **Step 3: Manual voice-and-flow read**

Read every chapter top-to-bottom in one sitting. Look for:
- Sentences that say "we" or "our" the validator missed (e.g., inside YAML frontmatter)
- Forward references (Chapter 5 referencing material from Chapter 8 without the reader being told)
- Tone consistency: same level of formality throughout
- The "Wider system" sidebar in each chapter is genuinely standalone — try reading just the sidebars in order and see whether they form a coherent narrative

Fix any issues found.

- [ ] **Step 4: Commit final polish**

```bash
git add docs/handbook
git commit -m "handbook: final voice and cross-reference sweep"
```

- [ ] **Step 5: Tag the handbook**

```bash
git tag -a handbook-1.0.0 -m "OCEAN Handbook 1.0.0 — content complete"
```

---

## Self-review notes

After writing this plan, the following spec sections are covered:

- §1 audience and reading paths — Task 22 (index.md), Task 1 (preface)
- §2 deliverables — this plan covers deliverable §2.1 (markdown source); Plans B and C cover §2.2 and §2.3
- §3 chapter outline — Tasks 1-22 map 1:1 to the 22 files in spec §3.1
- §3.3 per-chapter skeleton — enforced by `validate_skeleton` (Task 0, Steps 13-16), per-chapter task bodies reiterate the binding outline
- §3.4 voice rules — enforced by `validate_voice` (Task 0, Steps 29-32) and re-asserted in the per-task step template
- §4 frontend renderer — out of scope; Plan B
- §5 sandboxed runner — out of scope; Plan C; this plan references Plan C's toy corpora and operator registry
- §6.1 single source of truth for catalog — Task 17 includes the hand-stub pending Plan C; the CI hookup to fail on drift is in Plan C
- §6.2 snippet validation — `validate_snippets` (Task 0, Steps 8-12), CI in Task 23
- §6.3 toy-corpus references — `validate_corpora` (Task 0, Steps 25-28)
- §6.4 exercise solutions — `validate_exercises` (Task 0, Steps 17-20), Task 21 authors the file
- §6.5 glossary terms — `validate_glossary` (Task 0, Steps 21-24), Task 19 authors the file
- §8 done criteria — Task 24 final sweep enforces criteria 1-3, 9-10; criteria 4 and 6 require Plan C; criteria 5 require Plan B; criteria 7-8 require Plan C

No placeholders. Every function signature in a later task matches the one defined earlier (e.g., `parse_chapter(path: Path) -> ParsedChapter` is used consistently).

The only deferred work is Task 17 (Appendix B's auto-generated table) and Task 24 Step 2 (sandbox-based snippet execution), both of which depend on Plan C and are explicitly called out as such.
