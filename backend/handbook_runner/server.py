"""FastAPI server exposing POST /api/handbook/run and /api/handbook/validate.

Flow for /api/handbook/run:
    1. Validate source size (<= 16 KB) and known corpus.
    2. Rate-limit per client IP.
    3. Compile + type-check using scripts.operators.ocean.
    4. Scan parsed AST for premium operator references; if any, return
       a friendly diagnostic without executing.
    5. Otherwise, run the program in a sandboxed subprocess against a
       working directory containing only the requested toy corpus (as
       _toy_corpora/<name>.ndjson).
    6. Parse step timings from the subprocess output and return them.
"""
from __future__ import annotations

import re
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field

from backend.handbook_runner.premium_gate import (
    OPERATOR_REGISTRY,
    diagnostic_for_premium_op,
    is_premium,
)
from backend.handbook_runner.rate_limit import RateLimiter
from backend.handbook_runner.sandbox import (
    SandboxError,
    SandboxTimeoutError,
    run_sandboxed,
)

MAX_SOURCE_BYTES = 16 * 1024
KNOWN_CORPORA = {"toy_tna_50", "toy_nslkdd_200", "toy_climate_100"}
CORPUS_ROOT = Path(__file__).parent / "corpora"

# Map the human-readable phrasing of `using <variant>` (or the operator's
# default if no `using` is supplied) to a canonical operator name in the
# registry. The OCEAN parser already collapses 'content fingerprint' to
# kind='embed.content_fp48' on VerbStmt.operator_kind, so the walker mostly
# consults that directly. The variant map is retained for cases where the
# AST shape evolves or premium ops appear by phrasing alone.
VARIANT_TO_OP = {
    "tf-idf": "embed.tfidf_jl",
    "tfidf": "embed.tfidf_jl",
    "content fingerprint": "embed.content_fp48",
    "one-hot numeric": "embed.tfidf_jl",
    "transformer minilm_l6": "embed.transformer.minilm_l6",
    "tcd recursive loop": "cluster.tcd_recursive_loop",
    "btut": "reduce.btut",
}


class RunRequest(BaseModel):
    source: str = Field(..., max_length=20_000)
    corpus: str


class ValidateRequest(BaseModel):
    source: str = Field(..., max_length=20_000)


def _classify_error(exc: Exception) -> str:
    """Map a compiler exception to one of: syntax | type | name | runtime."""
    name = type(exc).__name__.lower()
    if "parse" in name or "syntax" in name or "lex" in name or "tokeniz" in name:
        return "syntax"
    if "type" in name:
        return "type"
    if "name" in name or "unbound" in name or "resolution" in name:
        return "name"
    # Inspect message text as a fallback.
    msg = str(exc).lower()
    if "unexpected" in msg or "expected" in msg:
        return "syntax"
    if "undefined" in msg or "unbound" in msg or "unknown name" in msg:
        return "name"
    if "type mismatch" in msg or "expected type" in msg:
        return "type"
    return "syntax"


def _compile_and_type_check(source: str) -> tuple[Any, dict | None]:
    """Returns (program_ast, error_or_None). Error is a JSON-ready dict."""
    from scripts.operators.ocean.parser import parse_ocean
    from scripts.operators.ocean.typecheck import typecheck

    try:
        program = parse_ocean(source)
    except Exception as e:
        cat = _classify_error(e)
        line = getattr(getattr(e, "token", None), "line", 1) or 1
        col = getattr(getattr(e, "token", None), "col", 1) or 1
        token = getattr(getattr(e, "token", None), "value", "") or ""
        suggestion = getattr(e, "suggestion", "") or ""
        return None, {
            "ok": False,
            "category": cat,
            "diagnostic": {
                "line": int(line),
                "col": int(col),
                "token": str(token),
                "message": str(e),
                "hint": str(suggestion),
            },
        }

    try:
        typecheck(program)
    except Exception as e:
        cat = _classify_error(e)
        # typecheck exceptions may not have a token attribute.
        msg = str(e)
        line_match = re.search(r"line\s+(\d+)", msg)
        col_match = re.search(r"col\s+(\d+)", msg)
        return None, {
            "ok": False,
            "category": cat if cat != "syntax" else "type",
            "diagnostic": {
                "line": int(line_match.group(1)) if line_match else 1,
                "col": int(col_match.group(1)) if col_match else 1,
                "token": "",
                "message": msg,
                "hint": "",
            },
        }

    return program, None


def _scan_for_premium(program: Any) -> dict | None:
    """Walk the AST and look for premium-operator references.

    The OCEAN parser resolves `using <variant>` directly into the
    `operator_kind` field on VerbStmt (e.g. 'content fingerprint' becomes
    'embed.content_fp48'). We therefore check `operator_kind` against the
    registry as the primary signal, and also walk any `args` keys to
    support future variant-by-phrasing fallbacks.
    """
    def walk(node: Any) -> dict | None:
        if node is None:
            return None
        # Direct check on a VerbStmt-like node.
        op_kind = getattr(node, "operator_kind", None)
        if isinstance(op_kind, str) and is_premium(op_kind):
            return diagnostic_for_premium_op(
                op_kind,
                line=getattr(node, "line", 1) or 1,
                col=getattr(node, "col", 1) or 1,
            )
        # Fallback variant attribute (handles future AST shapes).
        variant = getattr(node, "variant", None)
        if variant:
            if isinstance(variant, list):
                phrase = " ".join(str(v) for v in variant).lower()
            else:
                phrase = str(variant).lower()
            mapped = VARIANT_TO_OP.get(phrase)
            if mapped and is_premium(mapped):
                return diagnostic_for_premium_op(
                    mapped,
                    line=getattr(node, "line", 1) or 1,
                    col=getattr(node, "col", 1) or 1,
                )

        # Recurse through known child-bearing attributes.
        for attr in (
            "statements",
            "body",
            "then_body",
            "else_body",
            "handler",
            "arms",
            "elif_branches",
        ):
            children = getattr(node, attr, None)
            if children is None:
                continue
            if isinstance(children, list):
                for child in children:
                    # elif_branches is list[tuple[cond, list]] - flatten.
                    if isinstance(child, tuple):
                        for inner in child:
                            if isinstance(inner, list):
                                for sub in inner:
                                    r = walk(sub)
                                    if r is not None:
                                        return r
                            else:
                                r = walk(inner)
                                if r is not None:
                                    return r
                    else:
                        r = walk(child)
                        if r is not None:
                            return r
        # Some nodes nest a single statement under .expr (LetStmt).
        for attr in ("expr", "left", "right"):
            child = getattr(node, attr, None)
            if child is not None and not isinstance(
                child, (str, int, float, bool, bytes)
            ):
                r = walk(child)
                if r is not None:
                    return r
        return None

    return walk(program)


_STEP_RE = re.compile(
    r"\[step\s+(\d+)/(\d+)\]\s+(\w+)\s+(?:\xb7|·|…|\.{3})?\s*"
    r"(?:.*?)\s+(\d+)\s*ms(?:\s*[\xb7·]\s*(.+))?"
)


def _parse_step_timings(stdout: str) -> list[dict]:
    """Parse '[step N/M] verb ... Xms · summary' lines from stdout.

    The exact glyphs (ellipsis, middle-dot) may differ across runners. We
    accept any whitespace separator and an optional summary tail.
    """
    steps: list[dict] = []
    simple_re = re.compile(
        r"\[step\s+(\d+)/(\d+)\]\s+(\S+).*?(\d+)\s*ms(?:\s*[\xb7·•\-:]\s*(.+))?"
    )
    for line in stdout.splitlines():
        m = simple_re.search(line)
        if not m:
            continue
        steps.append({
            "verb": m.group(3),
            "duration_ms": int(m.group(4)),
            "summary": (m.group(5) or "").strip(),
        })
    return steps


def _first_json_artifact(workdir: Path) -> str:
    """Return the first 4 KB of any *.json file in workdir, or empty string."""
    for p in sorted(workdir.rglob("*.json")):
        if p.is_file():
            try:
                return p.read_text(encoding="utf-8")[:4096]
            except (OSError, UnicodeDecodeError):
                continue
    return ""


def create_app(redis: Any) -> FastAPI:
    app = FastAPI()
    limiter = RateLimiter(redis=redis)

    @app.post("/api/handbook/run")
    async def run_endpoint(
        req: RunRequest, request: Request, response: Response
    ) -> Any:
        # 1. Size check (16 KB hard cap on bytes).
        if len(req.source.encode("utf-8")) > MAX_SOURCE_BYTES:
            raise HTTPException(status_code=413, detail="source larger than 16 KB")

        # 2. Corpus check.
        if req.corpus not in KNOWN_CORPORA:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"unknown corpus '{req.corpus}'; must be one of "
                    f"{sorted(KNOWN_CORPORA)}"
                ),
            )

        # 3. Rate limit per client IP.
        client_ip = request.client.host if request.client else "0.0.0.0"
        decision = limiter.try_acquire(ip=client_ip)
        if not decision.allowed:
            response.headers["Retry-After"] = str(decision.retry_after_seconds)
            raise HTTPException(
                status_code=429, detail=f"rate limit: {decision.reason}"
            )

        try:
            # 4. Compile + type-check.
            program, error = _compile_and_type_check(req.source)
            if error is not None:
                response.status_code = 400
                return error

            # 5. Premium-op gate.
            premium_diag = _scan_for_premium(program)
            if premium_diag is not None:
                response.status_code = 400
                return premium_diag

            # 6. Sandboxed run.
            with tempfile.TemporaryDirectory(prefix="handbook-run-") as cwd:
                workdir = Path(cwd)
                # Stage the toy corpus.
                staging = workdir / "_toy_corpora"
                staging.mkdir()
                shutil.copy2(
                    CORPUS_ROOT / f"{req.corpus}.ndjson",
                    staging / f"{req.corpus}.ndjson",
                )
                # Write the program.
                program_path = workdir / "program.ocean"
                program_path.write_text(req.source, encoding="utf-8")

                try:
                    result = run_sandboxed(
                        script=[
                            sys.executable,
                            "-m",
                            "scripts.run_universal_pipeline",
                            "--config",
                            str(program_path),
                        ],
                        wall_seconds=10,
                        cpu_seconds=5,
                        rss_bytes=256 * 1024 * 1024,
                        cwd=str(workdir),
                    )
                except SandboxTimeoutError:
                    response.status_code = 400
                    return {
                        "ok": False,
                        "category": "runtime",
                        "diagnostic": {
                            "line": 1,
                            "col": 1,
                            "token": "",
                            "message": "execution exceeded 10s wall time",
                            "hint": "try a smaller take N or fewer dimensions",
                        },
                    }
                except SandboxError as e:
                    response.status_code = 503
                    return {
                        "ok": False,
                        "category": "runtime",
                        "diagnostic": {
                            "line": 1,
                            "col": 1,
                            "token": "",
                            "message": f"sandbox unavailable: {e}",
                            "hint": "copy this snippet and run in the REPL",
                        },
                    }

                if result.exit_code != 0:
                    response.status_code = 400
                    return {
                        "ok": False,
                        "category": "runtime",
                        "diagnostic": {
                            "line": 1,
                            "col": 1,
                            "token": "",
                            "message": (
                                f"runtime error (exit {result.exit_code}): "
                                f"{result.stderr.strip()[:500]}"
                            ),
                            "hint": "",
                        },
                    }

                steps = _parse_step_timings(result.stdout)
                artifact_preview = _first_json_artifact(workdir)

                return {
                    "ok": True,
                    "compile_ms": 0,
                    "run_ms": result.wall_ms,
                    "steps": steps,
                    "artifact_preview": artifact_preview,
                }
        finally:
            limiter.release(ip=client_ip)

    @app.post("/api/handbook/validate")
    async def validate_endpoint(
        req: ValidateRequest, response: Response
    ) -> Any:
        # Compile-only path used by the MCP `ocean_validate` tool and the
        # frontend's "check syntax" affordance. No corpus, no sandbox, no
        # rate limit (it's cheap; size cap is the only safety net).
        if len(req.source.encode("utf-8")) > MAX_SOURCE_BYTES:
            raise HTTPException(status_code=413, detail="source larger than 16 KB")
        _program, error = _compile_and_type_check(req.source)
        if error is not None:
            response.status_code = 400
            return error
        return {"ok": True}

    @app.get("/api/handbook/health")
    async def health() -> dict[str, Any]:
        return {"ok": True, "operators": len(OPERATOR_REGISTRY)}

    return app
