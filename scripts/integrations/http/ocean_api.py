"""OCEAN HTTP API — FastAPI service exposing OCEAN as REST endpoints.

The third protocol-level distribution channel (after MCP server and
Postgres extension). This is for any HTTP-speaking caller: OpenAI Custom
GPTs, Gemini tools, Mistral function-calling, internal microservices, n8n
workflows, Zapier-style automation, plain `curl` from a shell script.

Endpoints (auto-discoverable via /docs as OpenAPI 3.1):

    POST /v1/compile      → DAG config from .ocean source
    POST /v1/validate     → typecheck-only diagnostics
    POST /v1/run          → compile + execute, return artifact
    POST /v1/format       → canonicalize source
    POST /v1/lint         → style + dead-code analysis
    GET  /v1/operators    → operator catalog with English-labeled schemas
    GET  /v1/operators/{kind} → schema for a specific operator
    GET  /v1/stdlib       → stdlib functions with docs
    GET  /v1/stdlib/{file} → raw .ocean source of a stdlib file
    GET  /v1/health       → service health
    GET  /openapi.json    → full OpenAPI 3.1 spec (FastAPI auto-generated)

Auth: API key via `Authorization: Bearer <key>` header. Free tier gets
free-tier limits on /v1/run for free-tier operators; premium operators
(BTUT, TCD-JEPA, content_fp48) require a paid key. The metering hook is
in the dispatch path; no enforcement in the open-source build.

Run:
    pip install fastapi uvicorn
    uvicorn scripts.integrations.http.ocean_api:app --reload --port 8080

Then:
    curl -X POST http://localhost:8080/v1/compile \\
         -H 'Content-Type: application/json' \\
         -d '{"source":"load tmp/x.ndjson take 100 records"}'
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# Pre-load torch to dodge sklearn/torch DLL clash
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
try:
    import torch  # noqa: F401
except Exception:
    pass

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from typing import Any, Optional

try:
    from fastapi import FastAPI, HTTPException, Header, Depends
    from fastapi.responses import PlainTextResponse, JSONResponse
    from pydantic import BaseModel, Field
except ImportError:
    print("FastAPI not installed. Run: pip install fastapi uvicorn")
    raise

from scripts.operators.ocean.compiler import compile_ocean, CompileError
from scripts.operators.ocean.parser import parse_ocean, ParseError
from scripts.operators.ocean.lexer import LexerError
from scripts.operators.ocean.typecheck import TypeError_
from scripts.operators.schema import all_schemas, SCHEMAS, schema_to_dict


# ── App + metadata ────────────────────────────────────────────────────

app = FastAPI(
    title="OCEAN HTTP API",
    description=(
        "Protocol-level interface for the OCEAN substrate-clustering language. "
        "Sister to the MCP server and Postgres extension. Designed for any "
        "HTTP-speaking AI agent or microservice."
    ),
    version="1.1.0",
    contact={"name": "LatentOcean", "url": "https://latentocean.com"},
    license_info={"name": "Open core (MIT for language; commercial for premium operators)"},
)


# ── Request / response models ─────────────────────────────────────────

class SourceIn(BaseModel):
    source: str = Field(..., description="OCEAN program source code")


class RunIn(SourceIn):
    seed: Optional[int] = Field(None, description="Override the program's seed")


class CompileOut(BaseModel):
    ok:     bool
    config: Optional[dict] = None
    error:  Optional[str]  = None


class ValidateOut(BaseModel):
    ok:          bool
    diagnostics: list[dict]


class RunOut(BaseModel):
    ok:            bool
    error:         Optional[str]    = None
    timings:       Optional[list]   = None
    artifact_path: Optional[str]    = None
    artifact:      Optional[dict]   = None


class HealthOut(BaseModel):
    status:  str
    version: str
    uptime_s: float


# ── Auth / metering hook ──────────────────────────────────────────────

PREMIUM_OPERATORS = {
    "embed.content_fp48",
    "cluster.tcd_recursive_loop",
    "reduce.btut",
    "align.dispersion",
}


def _verify_key(authorization: Optional[str] = Header(None)) -> dict:
    """Stub: return an info dict for the key, including tier.

    In a deployed service this hits a key-management backend. Here it returns
    a permissive default so the open-source build runs without setup.
    """
    if authorization is None:
        return {"tier": "free", "key": None, "allowed_premium": False}
    # Placeholder: any 'Bearer <something>' is treated as premium-paid in dev.
    if authorization.lower().startswith("bearer "):
        return {"tier": "premium", "key": authorization[7:],
                "allowed_premium": True}
    return {"tier": "free", "key": None, "allowed_premium": False}


def _meter_call(key_info: dict, endpoint: str, payload_size: int):
    """Hook for billing. In production this writes to Kafka/Redis/etc.;
    in the open build it's a no-op stub."""
    # print(f"[meter] tier={key_info['tier']} endpoint={endpoint} bytes={payload_size}")
    pass


def _gate_premium(cfg: dict, key_info: dict):
    """If the program uses premium operators, require a premium key."""
    if key_info.get("allowed_premium"):
        return
    used_premium = [s["kind"] for s in cfg.get("steps", [])
                    if s["kind"] in PREMIUM_OPERATORS]
    if used_premium:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "premium operators require a paid API key",
                "operators": sorted(set(used_premium)),
                "docs": "https://latentocean.com/pricing",
            },
        )


# ── Compile/Validate/Run ──────────────────────────────────────────────

_started_at = time.time()


@app.get("/v1/health", response_model=HealthOut, tags=["meta"])
def health():
    return HealthOut(status="ok", version=app.version,
                     uptime_s=round(time.time() - _started_at, 2))


@app.post("/v1/compile", response_model=CompileOut, tags=["compile"])
def compile_endpoint(body: SourceIn,
                     key_info: dict = Depends(_verify_key)):
    _meter_call(key_info, "compile", len(body.source))
    try:
        cfg = compile_ocean(body.source, source_name="<http>")
        return CompileOut(ok=True, config=cfg)
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        return CompileOut(ok=False, error=e.pretty("<http>"))


@app.post("/v1/validate", response_model=ValidateOut, tags=["compile"])
def validate_endpoint(body: SourceIn,
                      key_info: dict = Depends(_verify_key)):
    _meter_call(key_info, "validate", len(body.source))
    diags = []
    try:
        compile_ocean(body.source, source_name="<http>")
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        diags.append({
            "severity": "error",
            "category": type(e).__name__,
            "line":     getattr(e, "line", 0) or
                        getattr(getattr(e, "token", None), "line", 0),
            "col":      getattr(e, "col", 0) or
                        getattr(getattr(e, "token", None), "col", 0),
            "message":  getattr(e, "message", str(e)),
            "suggestion": getattr(e, "suggestion", None),
        })
    return ValidateOut(ok=True, diagnostics=diags)


@app.post("/v1/run", response_model=RunOut, tags=["execute"])
def run_endpoint(body: RunIn,
                 key_info: dict = Depends(_verify_key)):
    _meter_call(key_info, "run", len(body.source))
    try:
        cfg = compile_ocean(body.source, source_name="<http>")
        if body.seed is not None:
            cfg["seed"] = body.seed
        _gate_premium(cfg, key_info)

        from scripts.operators import run_pipeline, PipelineConfig, StepConfig
        import scripts.operators.source   # noqa: F401
        import scripts.operators.embed    # noqa: F401
        import scripts.operators.cluster  # noqa: F401
        import scripts.operators.align    # noqa: F401
        import scripts.operators.persist  # noqa: F401

        pipeline = PipelineConfig(
            seed=cfg["seed"],
            steps=[StepConfig(**{k: v for k, v in s.items()
                                 if k in {"name", "kind", "inputs", "config"}})
                   for s in cfg["steps"]],
        )
        state = run_pipeline(pipeline, verbose=False)
        timings = state.get("_pipeline.timings", [])
        artifact_path = next(
            (v for k, v in state.items() if k.endswith(".output_path")),
            None,
        )
        artifact = None
        if artifact_path:
            try:
                import json as _json
                artifact = _json.loads(Path(artifact_path).read_text(encoding="utf-8"))
            except Exception:
                pass
        return RunOut(ok=True, timings=timings,
                      artifact_path=artifact_path, artifact=artifact)
    except HTTPException:
        raise
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        return RunOut(ok=False, error=e.pretty("<http>"))
    except Exception as e:
        return RunOut(ok=False, error=f"{type(e).__name__}: {e}")


# ── Format / Lint ─────────────────────────────────────────────────────

@app.post("/v1/format", response_class=PlainTextResponse, tags=["tools"])
def format_endpoint(body: SourceIn,
                    key_info: dict = Depends(_verify_key)):
    _meter_call(key_info, "format", len(body.source))
    from scripts.operators.ocean.format import format_program
    try:
        prog = parse_ocean(body.source, source_name="<http>")
        return format_program(prog)
    except (LexerError, ParseError) as e:
        raise HTTPException(status_code=400, detail=e.pretty("<http>"))


@app.post("/v1/lint", tags=["tools"])
def lint_endpoint(body: SourceIn,
                  key_info: dict = Depends(_verify_key)):
    _meter_call(key_info, "lint", len(body.source))
    from scripts.operators.ocean.lint import Linter
    try:
        prog = parse_ocean(body.source, source_name="<http>")
        linter = Linter(body.source.splitlines())
        lints = linter.lint_program(prog)
        return {"ok": True, "lints": [
            {"severity": l.severity, "line": l.line, "col": l.col,
             "code": l.code, "message": l.message}
            for l in lints
        ]}
    except (LexerError, ParseError) as e:
        raise HTTPException(status_code=400, detail=e.pretty("<http>"))


# ── Catalog endpoints ─────────────────────────────────────────────────

@app.get("/v1/operators", tags=["catalog"])
def list_operators(key_info: dict = Depends(_verify_key)):
    return {
        "ok":        True,
        "operators": all_schemas(),
        "premium":   sorted(PREMIUM_OPERATORS),
    }


@app.get("/v1/operators/{kind}", tags=["catalog"])
def operator_schema(kind: str, key_info: dict = Depends(_verify_key)):
    sch = SCHEMAS.get(kind)
    if sch is None:
        raise HTTPException(status_code=404,
                            detail=f"unknown operator kind: {kind}")
    return {
        "ok":      True,
        "kind":    kind,
        "schema":  schema_to_dict(sch),
        "premium": kind in PREMIUM_OPERATORS,
    }


@app.get("/v1/stdlib", tags=["catalog"])
def list_stdlib(key_info: dict = Depends(_verify_key)):
    stdlib_dir = REPO_ROOT / "scripts" / "operators" / "ocean" / "stdlib"
    out = []
    if stdlib_dir.exists():
        for f in sorted(stdlib_dir.glob("*.ocean")):
            try:
                from scripts.operators.ocean.docgen import extract_doc_comments
                docs = extract_doc_comments(f.read_text(encoding="utf-8"))
            except Exception:
                docs = []
            out.append({
                "file":      f.name,
                "functions": [{"name": d.name, "summary": d.summary,
                               "args":  d.args} for d in docs],
            })
    return {"ok": True, "files": out}


@app.get("/v1/stdlib/{file}", response_class=PlainTextResponse, tags=["catalog"])
def stdlib_file(file: str, key_info: dict = Depends(_verify_key)):
    p = REPO_ROOT / "scripts" / "operators" / "ocean" / "stdlib" / file
    if not p.exists() or ".." in file:
        raise HTTPException(status_code=404, detail=f"unknown stdlib file: {file}")
    return p.read_text(encoding="utf-8")


# ── OpenAPI customizations ────────────────────────────────────────────

@app.get("/", include_in_schema=False)
def root():
    return {
        "name":    "OCEAN HTTP API",
        "version": app.version,
        "docs":    "/docs",
        "openapi": "/openapi.json",
        "channels": {
            "mcp_server":         "scripts/operators/ocean/mcp.py",
            "postgres_extension": "scripts/integrations/postgres/ocean_pg.sql",
            "http_api":           "this service",
        },
    }
