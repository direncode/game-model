"""OCEAN REPL — interactive pipeline editor.

Each line is parsed + type-checked + (optionally) executed. State persists
across lines: let-bindings, defines, and the implicit upstream tracker
all carry forward between prompts.

Usage:
    python -m scripts.operators.ocean.repl

Commands (preceded by ':'):
    :help       show this message
    :show       print the accumulated program text
    :reset      clear all state
    :compile    compile the accumulated program (without running)
    :run        compile + run the program
    :type X     print the inferred type of name X
    :quit       exit
"""
from __future__ import annotations

import os
import sys
import traceback
from pathlib import Path

# Pre-load torch to dodge the sklearn/torch DLL clash
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
try:
    import torch  # noqa: F401
except Exception:
    pass

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.operators.ocean.lexer import LexerError
from scripts.operators.ocean.parser import ParseError, parse_ocean
from scripts.operators.ocean.compiler import compile_ocean, CompileError
from scripts.operators.ocean.typecheck import TypeChecker, TypeError_, typecheck

PROMPT  = "ocean> "
CONT    = "  ...  "


def repl():
    print("OCEAN REPL — interactive pipeline editor (v1.0)")
    print("type :help for commands, :quit to exit")
    print()

    accumulated: list[str] = []
    block_buffer: list[str] = []
    in_block = False

    while True:
        try:
            prompt = CONT if in_block else PROMPT
            line = input(prompt)
        except (EOFError, KeyboardInterrupt):
            print()
            break

        stripped = line.strip()

        # Commands
        if stripped.startswith(":") and not in_block:
            if not _handle_command(stripped, accumulated):
                break
            continue

        # Block tracking — keep reading until matching 'end'
        if any(stripped.startswith(kw) for kw in ("define ", "sweep ", "if ", "compare", "parallel ")) \
                and stripped.endswith("do") or stripped.endswith("then") \
                or stripped.startswith("compare"):
            in_block = True
        if stripped == "end":
            in_block = False
            block_buffer.append(line)
            full = "\n".join(block_buffer)
            block_buffer = []
            accumulated.append(full)
            _try_compile(accumulated)
            continue
        if in_block:
            block_buffer.append(line)
            continue

        if not stripped:
            continue
        accumulated.append(line)
        _try_compile(accumulated)


def _handle_command(cmd: str, accumulated: list[str]) -> bool:
    if cmd in (":quit", ":q"):
        return False
    if cmd == ":help":
        print(__doc__)
        return True
    if cmd == ":show":
        print("\n".join(accumulated) if accumulated else "(empty)")
        return True
    if cmd == ":reset":
        accumulated.clear()
        print("(state cleared)")
        return True
    if cmd == ":compile":
        try:
            cfg = compile_ocean("\n".join(accumulated), source_name="<repl>")
            import json
            print(json.dumps(cfg, indent=2)[:2000])
        except (LexerError, ParseError, TypeError_, CompileError) as e:
            print(e.pretty("<repl>"))
        return True
    if cmd == ":run":
        try:
            from scripts.operators import run_pipeline, PipelineConfig, StepConfig
            cfg = compile_ocean("\n".join(accumulated), source_name="<repl>")
            pipeline = PipelineConfig(
                seed=cfg["seed"],
                steps=[StepConfig(**{k: v for k, v in s.items()
                                     if k in {"name", "kind", "inputs", "config"}})
                       for s in cfg["steps"]],
            )
            # Pre-import operator submodules
            import scripts.operators.source   # noqa: F401
            import scripts.operators.embed    # noqa: F401
            import scripts.operators.cluster  # noqa: F401
            import scripts.operators.align    # noqa: F401
            import scripts.operators.persist  # noqa: F401
            run_pipeline(pipeline, verbose=True)
        except (LexerError, ParseError, TypeError_, CompileError) as e:
            print(e.pretty("<repl>"))
        except Exception as e:
            traceback.print_exc()
        return True
    if cmd.startswith(":type "):
        name = cmd[len(":type "):].strip()
        try:
            prog = parse_ocean("\n".join(accumulated), source_name="<repl>")
            checker = TypeChecker(prog.source_text.splitlines())
            checker.check_program(prog)
            t = checker.env.get(name)
            if t is None:
                print(f"name {name!r} not in scope; declared: {', '.join(sorted(checker.env)) or '(none)'}")
            else:
                print(f"{name} : {t}")
        except (LexerError, ParseError, TypeError_) as e:
            print(e.pretty("<repl>"))
        return True
    print(f"unknown command {cmd!r}; try :help")
    return True


def _try_compile(accumulated: list[str]):
    """Compile after each line — show errors but don't bail; lets the user
    incrementally build a program and see issues as they appear."""
    if not accumulated:
        return
    text = "\n".join(accumulated)
    try:
        compile_ocean(text, source_name="<repl>")
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        # Roll back the last line on error so the user can retry
        print(e.pretty("<repl>"))
        accumulated.pop()


if __name__ == "__main__":
    repl()
