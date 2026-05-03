"""OCEAN language conformance tests.

Each test exercises one feature of the language. Tests cover:
  - lex
  - parse
  - typecheck
  - compile
  - error diagnostics

Run via `pytest tests/ocean/`.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.compiler import compile_ocean
from scripts.operators.ocean.parser import parse_ocean, ParseError
from scripts.operators.ocean.lexer import LexerError, tokenize
from scripts.operators.ocean.typecheck import TypeError_


# ── Lex ─────────────────────────────────────────────────────────────────

def test_lex_basic_keywords():
    tokens = tokenize("seed 42")
    assert tokens[0].value == "seed"
    assert tokens[1].value == "42"


def test_lex_path():
    tokens = tokenize("load tmp/x.ndjson")
    assert any(t.value == "tmp/x.ndjson" for t in tokens)


def test_lex_string_with_escape():
    tokens = tokenize('let s = "hello\\nworld"')
    string_tokens = [t for t in tokens if t.type.name == "STRING"]
    assert len(string_tokens) == 1
    assert string_tokens[0].value == "hello\nworld"


def test_lex_numeric_with_underscores():
    tokens = tokenize("let n = 10_000")
    int_tokens = [t for t in tokens if t.type.name == "INT"]
    assert int_tokens[0].value == "10000"


def test_lex_comparison_operators():
    tokens = tokenize("if x >= 5 then return true end")
    op_tokens = [t for t in tokens if t.type.name == "OP"]
    assert ">=" in [t.value for t in op_tokens]


def test_lex_unterminated_string_errors():
    with pytest.raises(LexerError):
        tokenize('let s = "unterminated')


# ── Parse ───────────────────────────────────────────────────────────────

def test_parse_basic_pipeline():
    prog = parse_ocean(
        "load tmp/x.ndjson take 100 records\n"
        "embed text into 64 dimensions\n"
        "cluster for 8 rounds\n"
    )
    assert len(prog.statements) == 3
    assert prog.statements[0].verb == "load"
    assert prog.statements[0].args["target"] == 100


def test_parse_let_binding():
    prog = parse_ocean("let raw = load tmp/x.ndjson take 100 records")
    assert len(prog.statements) == 1
    let = prog.statements[0]
    assert let.name == "raw"
    assert let.expr.verb == "load"


def test_parse_let_with_type_annotation():
    prog = parse_ocean(
        "load tmp/x.ndjson\n"
        "let z : Z = embed text into 64 dimensions\n"
    )
    let = prog.statements[1]
    assert getattr(let, "type_ann", None) is not None
    assert let.type_ann.name == "Z"


def test_parse_sweep():
    prog = parse_ocean(
        "sweep s from 1 to 3 do\n"
        "  load tmp/x.ndjson\n"
        "end"
    )
    sweep = prog.statements[0]
    assert sweep.var == "s"
    assert sweep.start == 1
    assert sweep.end == 3


def test_parse_if_else():
    prog = parse_ocean(
        "load tmp/x.ndjson\n"
        "if 5 > 3 then\n"
        "  embed text into 64 dimensions\n"
        "else\n"
        "  embed text into 32 dimensions\n"
        "end"
    )
    if_stmt = prog.statements[1]
    assert len(if_stmt.then_body) == 1
    assert if_stmt.else_body is not None
    assert len(if_stmt.else_body) == 1


def test_parse_if_elif():
    prog = parse_ocean(
        "load tmp/x.ndjson\n"
        "if 1 > 2 then\n"
        "  embed text into 32 dimensions\n"
        "elif 2 > 1 then\n"
        "  embed text into 64 dimensions\n"
        "end"
    )
    if_stmt = prog.statements[1]
    assert len(if_stmt.elif_branches) == 1


def test_parse_define_no_params():
    prog = parse_ocean(
        "define basic_run do\n"
        "  load tmp/x.ndjson\n"
        "  embed text into 64 dimensions\n"
        "end"
    )
    assert "basic_run" in prog.defines
    d = prog.defines["basic_run"]
    assert d.params == []
    assert len(d.body) == 2


def test_parse_define_with_params():
    prog = parse_ocean(
        "define run(target = 500, dims : Number = 128) do\n"
        "  load tmp/x.ndjson take 100 records\n"
        "end"
    )
    d = prog.defines["run"]
    assert len(d.params) == 2
    assert d.params[0].name == "target"
    assert d.params[1].type_ann.name == "Number"


def test_parse_import():
    prog = parse_ocean('import "presets/atlas.ocean" as atlas')
    assert len(prog.imports) == 1
    assert prog.imports[0].path == "presets/atlas.ocean"
    assert prog.imports[0].alias == "atlas"


def test_parse_require_decl():
    prog = parse_ocean("require ocean 1.0\nseed 42")
    assert prog.require_version == (1, 0, 0)


def test_parse_unknown_verb_errors():
    with pytest.raises(ParseError) as excinfo:
        parse_ocean("embedd text into 64 dimensions")
    assert "embedd" in excinfo.value.message or "embedd" in str(excinfo.value)


def test_parse_missing_end_errors():
    with pytest.raises(ParseError):
        parse_ocean("sweep s from 1 to 3 do\n  load x.ndjson")


# ── Typecheck ───────────────────────────────────────────────────────────

def test_typecheck_basic_pipeline_passes():
    cfg = compile_ocean(
        "load tmp/x.ndjson\n"
        "embed text into 64 dimensions\n"
        "cluster for 8 rounds\n"
    )
    assert len(cfg["steps"]) == 3


def test_typecheck_cluster_without_embed_errors():
    with pytest.raises(TypeError_) as excinfo:
        compile_ocean(
            "load tmp/x.ndjson\n"
            "cluster for 8 rounds\n"
        )
    msg = str(excinfo.value).lower()
    assert "cluster" in msg and ("embed" in msg or "z" in msg)


def test_typecheck_align_without_cluster_errors():
    with pytest.raises(TypeError_):
        compile_ocean(
            "load tmp/x.ndjson\n"
            "embed text into 64 dimensions\n"
            "align modules using 50 nearest records\n"
        )


def test_typecheck_let_annotation_mismatch_errors():
    with pytest.raises(TypeError_):
        compile_ocean(
            "load tmp/x.ndjson as raw\n"
            "let z : Z = embed text into 64 dimensions\n"
            "let bad : Records = z\n"  # z is Z, not Records
        )


def test_typecheck_if_condition_must_be_bool():
    with pytest.raises(TypeError_):
        compile_ocean(
            "load tmp/x.ndjson\n"
            "if 42 then\n"   # 42 is Number, not Bool
            "  embed text into 64 dimensions\n"
            "end\n"
        )


def test_typecheck_compare_arms_must_match():
    # Both arms produce Z — fine
    cfg = compile_ocean(
        "load tmp/x.ndjson as raw\n"
        "compare\n"
        "    embed text from raw into 64 dimensions\n"
        "against\n"
        "    embed text from raw into 128 dimensions\n"
    )
    assert any(s["kind"] == "meta.compare" for s in cfg["steps"])


# ── Compile ─────────────────────────────────────────────────────────────

def test_compile_emits_correct_step_count():
    cfg = compile_ocean(
        "load tmp/x.ndjson\n"
        "embed text into 64 dimensions\n"
        "cluster for 8 rounds\n"
        "align modules using 30 nearest records\n"
        "find dispersion of each label\n"
        "save to /tmp/out.json\n"
    )
    assert len(cfg["steps"]) == 6


def test_compile_sweep_expands_to_n_branches():
    cfg = compile_ocean(
        "sweep s from 1 to 3 do\n"
        "  load tmp/x.ndjson\n"
        "  embed text into 64 dimensions\n"
        "end"
    )
    # 2 statements * 3 sweep values = 6 steps
    assert len(cfg["steps"]) == 6


def test_compile_path_interpolation_in_save():
    cfg = compile_ocean(
        "sweep n from 1 to 2 do\n"
        "  load tmp/x.ndjson\n"
        "  embed text into 64 dimensions\n"
        "  cluster for 8 rounds\n"
        "  align modules using 30 nearest records\n"
        "  find dispersion of each label\n"
        "  save to data/out_${n}.json\n"
        "end"
    )
    saves = [s for s in cfg["steps"] if s["kind"] == "persist.json"]
    outputs = [s["config"]["output"] for s in saves]
    assert "data/out_1.json" in outputs
    assert "data/out_2.json" in outputs


def test_compile_load_includes_content_sha_when_file_exists(tmp_path):
    f = tmp_path / "tiny.ndjson"
    f.write_text('{"paper_id":"x","archive":"a","text":"hello"}\n', encoding="utf-8")
    cfg = compile_ocean(f"load {f.as_posix()} take 1 records")
    load_step = cfg["steps"][0]
    assert "_content_sha256" in load_step["config"]
    assert len(load_step["config"]["_content_sha256"]) == 16


def test_compile_define_decl():
    cfg = compile_ocean(
        "define basic do\n"
        "  load tmp/x.ndjson\n"
        "  embed text into 64 dimensions\n"
        "end\n"
    )
    # Defines aren't emitted as DAG steps directly; they live in the program.
    # The compiler returns the top-level statements (none in this case).
    assert len(cfg["steps"]) == 0


# ── End-to-end smoke test ──────────────────────────────────────────────

def test_full_program_with_all_features_compiles(tmp_path):
    f = tmp_path / "corpus.ndjson"
    f.write_text('{"paper_id":"x","archive":"a","text":"hello"}\n', encoding="utf-8")
    src = f"""require ocean 1.0
seed 42

define run_basic(target : Number = 100) do
    load {f.as_posix()} take target records
    embed text into 64 dimensions
    cluster for 8 rounds max 12 modules energy = corpus mean
    align modules using 30 nearest records
    find dispersion of each label
    save to data/out.json
end

if 5 > 3 then
    load {f.as_posix()} take 50 records
    embed text into 64 dimensions
    cluster for 8 rounds
    align modules using 20 nearest records
    find dispersion of each label
    save to data/test.json
end
"""
    cfg = compile_ocean(src)
    # The 'if' branch contributes 6 steps; defines don't.
    assert len(cfg["steps"]) >= 6
    assert any(s["kind"] == "source.ndjson" for s in cfg["steps"])
    assert any(s["kind"] == "persist.json" for s in cfg["steps"])
