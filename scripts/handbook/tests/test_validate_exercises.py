"""Tests for validate_exercises."""

from pathlib import Path

from scripts.handbook.parse_chapter import parse_chapter
from scripts.handbook.validate_exercises import validate_exercises

FIXTURES = Path(__file__).parent / "fixtures"


def test_exercise_without_solution_is_error(tmp_path: Path):
    chap_path = FIXTURES / "good_chapter.md"
    solutions = tmp_path / "app-f.md"
    solutions.write_text(
        "---\n"
        "slug: app-f-exercise-solutions\n"
        "number: null\n"
        "title: Solutions\n"
        "promise: \"(placeholder)\"\n"
        "status: draft\n"
        "---\n\n"
        "# Solutions\n",
        encoding="utf-8",
    )
    chap = parse_chapter(chap_path)
    errors = validate_exercises([chap], solutions)
    assert errors
    joined = " | ".join(errors)
    assert "example-chapter-1" in joined
    assert "example-chapter-2" in joined


def test_exercises_with_em_dash_solutions_pass(tmp_path: Path):
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    sol = tmp_path / "app-f.md"
    sol.write_text(
        "---\nslug: x\nnumber: null\ntitle: t\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Solutions\n\n"
        "## example-chapter — 1\n\nfoo\n\n"
        "## example-chapter — 2\n\nbar\n",
        encoding="utf-8",
    )
    assert validate_exercises([chap], sol) == []


def test_exercises_with_double_hyphen_solutions_pass(tmp_path: Path):
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    sol = tmp_path / "app-f.md"
    sol.write_text(
        "---\nslug: x\nnumber: null\ntitle: t\npromise: \"x\"\nstatus: draft\n---\n\n"
        "# Solutions\n\n"
        "## example-chapter -- 1\n\nfoo\n\n"
        "## example-chapter -- 2\n\nbar\n",
        encoding="utf-8",
    )
    assert validate_exercises([chap], sol) == []


def test_missing_solutions_file_reported(tmp_path: Path):
    chap = parse_chapter(FIXTURES / "good_chapter.md")
    missing = tmp_path / "does-not-exist.md"
    errors = validate_exercises([chap], missing)
    assert errors
    assert "missing" in errors[0]
