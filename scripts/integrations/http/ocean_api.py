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

# ── /v1/ocean/* — playground + CLI surface ──────────────────────────────
#
# These endpoints back the in-browser playground at
# frontend/public/ocean-demo/ AND the `lo cmd` desktop CLI's catalog.
# They live in this service (ocean_api) because nginx already routes
# /v1/* here and this container already has the full operator runtime
# pre-installed in its image.
#
# Mirrors the catalog declared in backend/app/api/v1/ocean_run.py so the
# two services agree on what an "operator" looks like even though they
# run in separate processes. Drift is caught by handbook Appendix B's
# AUTO-GENERATED catalog block, which is the canonical source.

import hashlib as _hashlib
import json as _json
import shutil as _shutil
import tempfile as _tempfile

try:
    from fastapi import File, Form, UploadFile  # noqa: E402
except ImportError:
    pass


_OPERATOR_CATALOG: list[dict] = [
    {"kind": "source.ndjson", "verb": "load", "tier": "free", "icon": "□",
     "input": "Path", "output": "Records",
     "summary": "Load an NDJSON corpus from disk, optionally stratifying the sample.",
     "snippet": "load corpus.ndjson take 100 records balanced by label label field is label"},
    {"kind": "embed.tfidf_jl", "verb": "embed", "tier": "free", "icon": "▤",
     "input": "Records", "output": "Z",
     "summary": "TF-IDF + Johnson-Lindenstrauss random projection to a dense Z.",
     "snippet": "embed text into 64 dimensions using tf-idf"},
    {"kind": "embed.transformer.minilm_l6", "verb": "embed", "tier": "free", "icon": "▤",
     "input": "Records", "output": "Z",
     "summary": "MiniLM-L6 sentence-transformer at 384 dims native.",
     "snippet": "embed text into 384 dimensions using transformer minilm_l6"},
    {"kind": "embed.onehot_numeric", "verb": "embed", "tier": "free", "icon": "▤",
     "input": "Records", "output": "Z",
     "summary": "One-hot encoder for numeric / categorical record fields.",
     "snippet": "embed text using one-hot numeric"},
    {"kind": "embed.content_fp48", "verb": "embed", "tier": "premium", "icon": "▦",
     "input": "Records", "output": "Z_FP48",
     "summary": "Bloom-style 48-bit content fingerprints. Pairs with cluster.hamming.",
     "snippet": "embed text using content fingerprint"},
    {"kind": "reduce.stratified", "verb": "reduce", "tier": "free", "icon": "▼",
     "input": "Records", "output": "Records",
     "summary": "Deterministic stratified-by-label sample. Free-tier substitute for BTUT.",
     "snippet": "reduce to 100 records using stratified"},
    {"kind": "reduce.btut", "verb": "reduce", "tier": "premium", "icon": "▼",
     "input": "(Z, Records)", "output": "(Z, Records)",
     "summary": "8-tier BTUT lattice-threading reduction.",
     "snippet": "reduce records using btut target 300 survivors budget $5"},
    {"kind": "cluster.kmeans", "verb": "cluster", "tier": "free", "icon": "◉",
     "input": "Z", "output": "Modules",
     "summary": "sklearn KMeans with deterministic random_state.",
     "snippet": "cluster for 8 rounds max 8 modules using kmeans"},
    {"kind": "cluster.hamming", "verb": "cluster", "tier": "free", "icon": "◉",
     "input": "Z_FP48", "output": "Modules",
     "summary": "Bit-vector Hamming clustering for content_fp48 fingerprints.",
     "snippet": "cluster using hamming"},
    {"kind": "cluster.tcd_recursive_loop", "verb": "cluster", "tier": "premium", "icon": "◉",
     "input": "Z", "output": "Modules",
     "summary": "TCD-JEPA recursive loop with persistent-homology crystallization.",
     "snippet": "cluster for 16 rounds max 24 modules using tcd recursive loop"},
    {"kind": "align.module", "verb": "align", "tier": "free", "icon": "◇",
     "input": "(Modules, Records, Z)", "output": "Aligned",
     "summary": "Per-module K-nearest-records alignment with dominant-label tally.",
     "snippet": "align modules using 10 nearest records"},
    {"kind": "align.dispersion", "verb": "align", "tier": "premium", "icon": "◇",
     "input": "(Modules, Records, Z)", "output": "Aligned",
     "summary": "Dispersion-weighted alignment with module-quality scoring.",
     "snippet": "align modules using 10 nearest records (premium)"},
    {"kind": "find.dispersion_per_label", "verb": "find", "tier": "free", "icon": "◈",
     "input": "(Aligned, Records, Z)", "output": "Dispersion",
     "summary": "Per-label routing: where do each label's records land?",
     "snippet": "find dispersion of each label"},
    {"kind": "narrate.plain_english", "verb": "narrate", "tier": "free", "icon": "▶",
     "input": "Aligned", "output": "Aligned",
     "summary": "Deterministic per-module template narration. Zero-LLM.",
     "snippet": "narrate every module using plain english"},
    {"kind": "narrate.llm_summary", "verb": "narrate", "tier": "free", "icon": "▶",
     "input": "Aligned", "output": "Aligned",
     "summary": "Anthropic-API narration. Requires ANTHROPIC_API_KEY; falls back to template.",
     "snippet": "narrate every module using llm"},
    {"kind": "persist.json", "verb": "save", "tier": "free", "icon": "↧",
     "input": "Any", "output": "Artifact",
     "summary": "Write pipeline state as JSON with SHA-256 manifest.",
     "snippet": "save to result.json"},
]


_STDLIB_PRESETS: list[dict] = [
    {"namespace": "substrate", "preset": "basic_run",             "tier": "free",
     "summary": "Canonical free-tier pipeline against any NDJSON corpus."},
    {"namespace": "substrate", "preset": "seed_sweep",            "tier": "free",
     "summary": "Sweep seeds 42-46 and emit a SHA per seed."},
    {"namespace": "substrate", "preset": "anomaly_focused",       "tier": "free",
     "summary": "Cluster around the 'normal' label as energy anchor."},
    {"namespace": "substrate", "preset": "content_vs_structural", "tier": "free",
     "summary": "Compare TF-IDF embedding vs content-fingerprint."},
    {"namespace": "pulse",     "preset": "uspto",                  "tier": "free",
     "summary": "USPTO patent abstracts (500 records). Bundled."},
    {"namespace": "pulse",     "preset": "uspto_pro",              "tier": "premium",
     "summary": "USPTO with BTUT + TCD chain (premium)."},
    {"namespace": "atlas",     "preset": "arxiv",                  "tier": "free",
     "summary": "arXiv scientific abstracts (500 records). Bundled."},
    {"namespace": "atlas",     "preset": "arxiv_pro",              "tier": "premium",
     "summary": "arXiv with premium operator chain."},
    {"namespace": "receipt",   "preset": "edgar",                  "tier": "free",
     "summary": "EDGAR financial filings (500 records). Bundled."},
    {"namespace": "receipt",   "preset": "edgar_pro",              "tier": "premium",
     "summary": "EDGAR with premium operator chain."},
    {"namespace": "docsouth",  "preset": "narratives",             "tier": "free",
     "summary": "DocSouth historical narratives (200 records). Bundled."},
    {"namespace": "docsouth",  "preset": "narratives_pro",         "tier": "premium",
     "summary": "DocSouth with premium operator chain."},
    {"namespace": "titan",     "preset": "benchmark",              "tier": "free",
     "summary": "TITAN benchmark corpus (300 records). Bundled."},
    {"namespace": "titan",     "preset": "benchmark_pro",          "tier": "premium",
     "summary": "TITAN with premium operator chain."},
    {"namespace": "universal", "preset": "substrate",              "tier": "free",
     "summary": "Cross-domain substrate sample (400 records). Bundled."},
    {"namespace": "universal", "preset": "substrate_pro",          "tier": "premium",
     "summary": "Universal substrate with premium operators."},
]


_SAMPLE_PROGRAMS: dict[str, dict] = {
    "intro": {
        "title": "Intro — load → embed → cluster → align → find → save",
        "summary": "The canonical pipeline. Loads a fraud/legit corpus and finds two clusters.",
        "program": "\n".join([
            "seed 42",
            "load corpus.ndjson take 40 records balanced by label label field is label",
            "embed text into 32 dimensions using tf-idf",
            "cluster for 4 rounds max 4 modules using kmeans",
            "align modules using 5 nearest records",
            "find dispersion of each label",
            "save to result.json",
        ]) + "\n",
        "corpus": "fraud-legit-small",
    },
    "narrate": {
        "title": "Narrate — add a template summary at the tail",
        "summary": "Same as intro plus narrate.plain_english on the aligned modules.",
        "program": "\n".join([
            "seed 42",
            "load corpus.ndjson take 40 records balanced by label label field is label",
            "embed text into 32 dimensions using tf-idf",
            "cluster for 4 rounds max 4 modules using kmeans",
            "align modules using 5 nearest records",
            "narrate every module using plain english",
            "save to result.json",
        ]) + "\n",
        "corpus": "fraud-legit-small",
    },
    "reduce": {
        "title": "Reduce — stratified sample before embed",
        "summary": "Downsample 80 records to 24 by label-stratified hashing, then cluster.",
        "program": "\n".join([
            "seed 42",
            "load corpus.ndjson take 80 records balanced by label label field is label",
            "reduce to 24 records using stratified",
            "embed text into 32 dimensions using tf-idf",
            "cluster for 4 rounds max 3 modules using kmeans",
            "align modules using 4 nearest records",
            "find dispersion of each label",
            "save to result.json",
        ]) + "\n",
        "corpus": "fraud-legit-large",
    },
}


def _generate_sample_corpus(corpus_id: str) -> bytes:
    fraud_phrases = [
        "stolen card pattern detected", "unauthorized merchant transaction",
        "geographic mismatch flag triggered", "high-value fraud signature match",
        "card-not-present anomaly identified", "velocity rule breach detected",
    ]
    legit_phrases = [
        "monthly grocery shopping payment", "restaurant dinner service charge",
        "online subscription renewal billing", "gas station convenience purchase",
        "department store retail transaction", "pharmacy prescription pickup payment",
    ]
    if corpus_id == "fraud-legit-small":
        n = 40
    elif corpus_id == "fraud-legit-large":
        n = 80
    else:
        raise HTTPException(status_code=404, detail=f"unknown sample corpus {corpus_id!r}")
    lines = []
    for i in range(n):
        is_fraud = (i % 2 == 0)
        phrase = (fraud_phrases if is_fraud else legit_phrases)[i % 6]
        lines.append(_json.dumps({
            "id":    f"r{i}",
            "text":  f"transaction record {i}: {phrase}",
            "label": "fraud" if is_fraud else "legit",
        }))
    return ("\n".join(lines) + "\n").encode("utf-8")


def _canonical_artifact_sha(artifact_path: Path) -> str:
    """Mirror of cli/lo/demo/runner._deterministic_artifact_sha so server
    and laptop SHAs match byte-for-byte."""
    try:
        data = _json.loads(artifact_path.read_text(encoding="utf-8"))
    except (OSError, _json.JSONDecodeError):
        h = _hashlib.sha256()
        with artifact_path.open("rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    if isinstance(data.get("_meta"), dict):
        data["_meta"].pop("generated_at", None)
        data["_meta"].pop("wall_seconds", None)
        data["_meta"].pop("started_at", None)
    canonical = _json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return _hashlib.sha256(canonical).hexdigest()


def _run_ocean_with_corpus(program_source: str, corpus_bytes: bytes,
                           seed: Optional[int]) -> dict:
    """Compile + run a program against a corpus, return artifact + SHA."""
    from scripts.operators import run_pipeline, PipelineConfig, StepConfig
    import scripts.operators.source   # noqa: F401
    import scripts.operators.embed    # noqa: F401
    import scripts.operators.cluster  # noqa: F401
    import scripts.operators.align    # noqa: F401
    import scripts.operators.persist  # noqa: F401
    try:
        import scripts.operators.reduce   # noqa: F401
    except Exception:
        pass
    try:
        import scripts.operators.narrate  # noqa: F401
    except Exception:
        pass

    try:
        cfg = compile_ocean(program_source, source_name="<ocean-run>")
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        raise HTTPException(status_code=400, detail={
            "error":      "compile-failed",
            "diagnostic": e.pretty("<ocean-run>") if hasattr(e, "pretty") else str(e),
        })

    work_dir = Path(_tempfile.mkdtemp(prefix="ocean-run-"))
    work_corpus = work_dir / "corpus.ndjson"
    work_artifact = work_dir / "result.json"
    work_corpus.write_bytes(corpus_bytes)

    saved_cwd = Path.cwd()
    t0 = time.time()
    try:
        os.chdir(work_dir)
        steps = []
        for s in cfg.get("steps", []):
            kept = {k: v for k, v in s.items() if k in {"name", "kind", "inputs", "config"}}
            if kept.get("kind") == "persist.json":
                kept.setdefault("config", {})
                kept["config"] = {**kept["config"], "output": str(work_artifact)}
            steps.append(StepConfig(**kept))
        pipeline = PipelineConfig(
            seed=int(seed if seed is not None else cfg.get("seed", 42)),
            steps=steps,
        )
        run_pipeline(pipeline, verbose=False)
    finally:
        os.chdir(saved_cwd)
    wall = round(time.time() - t0, 3)
    if not work_artifact.exists():
        _shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=500,
                            detail="pipeline ran but no artifact at expected path")
    sha = _canonical_artifact_sha(work_artifact)
    artifact_data = None
    try:
        artifact_data = _json.loads(work_artifact.read_text(encoding="utf-8"))
    except Exception:
        pass
    _shutil.rmtree(work_dir, ignore_errors=True)
    n_modules = None
    if artifact_data:
        for key in ("aligned_modules", "modules", "clusters"):
            v = artifact_data.get(key)
            if isinstance(v, list):
                n_modules = len(v); break
            if isinstance(v, dict):
                n_modules = len(v); break
    return {
        "artifact_sha256": sha,
        "n_modules":       n_modules,
        "wall_seconds":    wall,
        "seed":            int(seed if seed is not None else 42),
        "artifact":        artifact_data,
    }


class RunTextIn(BaseModel):
    program:       str
    corpus_ndjson: str
    seed:          Optional[int] = None


@app.get("/v1/ocean/health", tags=["ocean-playground"])
def ocean_health(key_info: dict = Depends(_verify_key)):
    """Lightweight health + tier signal for the playground."""
    try:
        from scripts.operators import registered_kinds
        import scripts.operators.source   # noqa: F401
        import scripts.operators.embed    # noqa: F401
        import scripts.operators.cluster  # noqa: F401
        import scripts.operators.align    # noqa: F401
        import scripts.operators.persist  # noqa: F401
        kinds = registered_kinds()
    except Exception as e:
        return {"status": "degraded", "error": f"{type(e).__name__}: {e}"}
    return {
        "status":               "healthy",
        "registered_operators": len(kinds),
        "tier": "premium" if any(
            k in kinds for k in ("reduce.btut", "cluster.tcd_recursive_loop", "embed.content_fp48")
        ) else "open-core",
    }


@app.get("/v1/ocean/operators", tags=["ocean-playground"])
def ocean_operators(key_info: dict = Depends(_verify_key)):
    """Rich catalog used by the playground UI (web + lo cmd)."""
    registered: set[str] = set()
    try:
        from scripts.operators import registered_kinds
        import scripts.operators.source   # noqa: F401
        import scripts.operators.embed    # noqa: F401
        import scripts.operators.cluster  # noqa: F401
        import scripts.operators.align    # noqa: F401
        import scripts.operators.persist  # noqa: F401
        try:
            import scripts.operators.reduce   # noqa: F401
        except Exception:
            pass
        try:
            import scripts.operators.narrate  # noqa: F401
        except Exception:
            pass
        registered = set(registered_kinds())
    except Exception:
        pass
    return {
        "operators": [{**op, "registered": op["kind"] in registered} for op in _OPERATOR_CATALOG],
        "stdlib_presets": _STDLIB_PRESETS,
        "tier": "premium" if any(
            k in registered for k in ("reduce.btut", "cluster.tcd_recursive_loop", "embed.content_fp48")
        ) else "open-core",
    }


@app.get("/v1/ocean/samples", tags=["ocean-playground"])
def ocean_samples(key_info: dict = Depends(_verify_key)):
    return {
        "samples": [
            {"id": k, **{kk: v for kk, v in spec.items() if kk != "corpus"},
             "corpus_id": spec["corpus"]}
            for k, spec in _SAMPLE_PROGRAMS.items()
        ],
    }


@app.get("/v1/ocean/samples/{sample_id}", tags=["ocean-playground"])
def ocean_sample_detail(sample_id: str, key_info: dict = Depends(_verify_key)):
    spec = _SAMPLE_PROGRAMS.get(sample_id)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"unknown sample {sample_id!r}")
    corpus_bytes = _generate_sample_corpus(spec["corpus"])
    return {
        "id":            sample_id,
        "title":         spec["title"],
        "summary":       spec["summary"],
        "program":       spec["program"],
        "corpus_id":     spec["corpus"],
        "corpus_ndjson": corpus_bytes.decode("utf-8"),
        "n_records":     sum(1 for line in corpus_bytes.splitlines() if line.strip()),
    }


@app.post("/v1/ocean/run", tags=["ocean-playground"])
async def ocean_run(
    program: UploadFile = File(...),
    corpus:  UploadFile = File(...),
    seed:    Optional[int] = Form(None),
    key_info: dict = Depends(_verify_key),
):
    """Multipart variant of /v1/run for the CLI's cloud-replay tail.

    Same canonical SHA semantics as cli/lo/demo/runner._deterministic_artifact_sha,
    so a laptop SHA and a server SHA match byte-for-byte for the same
    (program, corpus, seed).
    """
    program_bytes = await program.read()
    corpus_bytes  = await corpus.read()
    program_source = program_bytes.decode("utf-8", errors="replace")
    _meter_call(key_info, "ocean.run", len(program_bytes) + len(corpus_bytes))
    try:
        cfg = compile_ocean(program_source, source_name="<ocean-run>")
        _gate_premium(cfg, key_info)
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        raise HTTPException(status_code=400, detail=e.pretty("<ocean-run>"))
    result = _run_ocean_with_corpus(program_source, corpus_bytes, seed=seed)
    result["n_records"] = sum(1 for line in corpus_bytes.splitlines() if line.strip())
    return JSONResponse(result)


@app.post("/v1/ocean/run_text", tags=["ocean-playground"])
def ocean_run_text(body: RunTextIn, key_info: dict = Depends(_verify_key)):
    """JSON-body variant used by the in-browser playground."""
    _meter_call(key_info, "ocean.run_text", len(body.program) + len(body.corpus_ndjson))
    try:
        cfg = compile_ocean(body.program, source_name="<ocean-run-text>")
        _gate_premium(cfg, key_info)
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        raise HTTPException(status_code=400, detail=e.pretty("<ocean-run-text>"))
    result = _run_ocean_with_corpus(
        body.program, body.corpus_ndjson.encode("utf-8"), seed=body.seed,
    )
    result["n_records"] = sum(1 for line in body.corpus_ndjson.splitlines() if line.strip())
    return JSONResponse(result)


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
