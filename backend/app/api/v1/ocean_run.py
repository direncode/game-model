"""POST /v1/ocean/run — the cloud-replay endpoint.

This is the server side of the determinism contract the demo's "and
here's the cloud's hash" tail relies on. The client uploads the
canonical .ocean source plus a normalized corpus.ndjson; the server
runs the same operator chain the local CLI runs and returns the
canonical artifact SHA-256.

Determinism contract (must hold for the demo's reveal to land):
    Same (program bytes, corpus bytes, seed) ⇒ same artifact_sha256.

The server strips the same wall-clock fields the local runner strips
(``_meta.generated_at``, ``_meta.wall_seconds``, ``_meta.started_at``)
before hashing the artifact. Sum-reduction order is pinned single-thread
via ``OMP_NUM_THREADS=1 / MKL_NUM_THREADS=1`` so this server's BLAS
matches the laptop's BLAS exactly.

The endpoint is mounted at ``/v1/ocean/run`` (not ``/api/v1/...``) to
match the public contract documented in ``cli/lo/demo/replay.py``.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

# Force single-thread BLAS BEFORE any numerical operator imports. Mirrors
# cli/lo/_bootstrap.py so the server SHA reproduces the laptop SHA.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/ocean", tags=["ocean-run"])


# ── Auth: bearer token gate ─────────────────────────────────────────────

def _verify_bearer(authorization: Optional[str] = Header(None)) -> str:
    """Accept any non-empty bearer for now; tightening to the real
    api-key store is one config-line change away. Returns the raw
    token for logging."""
    if not authorization:
        raise HTTPException(status_code=401, detail="missing Authorization header")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="expected Bearer scheme")
    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="empty bearer token")
    # NOTE: hook into app.api.v1.api_keys for production verification.
    return token


# ── Canonical SHA — must match cli/lo/demo/runner._deterministic_artifact_sha ──

def _canonical_artifact_sha(artifact_path: Path) -> str:
    """Strip wall-clock fields, re-serialize with sorted keys, SHA-256.

    Identical to the client-side runner's hash so local and cloud
    artifacts match byte-for-byte.
    """
    try:
        data = json.loads(artifact_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        # Fall back to raw-bytes hash; never a match against client's
        # canonical hash but at least the response is well-formed.
        h = hashlib.sha256()
        with artifact_path.open("rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    if isinstance(data.get("_meta"), dict):
        data["_meta"].pop("generated_at", None)
        data["_meta"].pop("wall_seconds", None)
        data["_meta"].pop("started_at", None)
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


# ── Operator execution ──────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[4]


def _ensure_operators_on_path() -> None:
    """Make ``scripts.operators`` importable. Idempotent."""
    repo = str(REPO_ROOT)
    if repo not in sys.path:
        sys.path.insert(0, repo)


def _run_ocean_locally(program_source: str, corpus_path: Path, seed: int) -> dict:
    """Compile + execute the OCEAN program against the corpus.

    Returns a dict with ``artifact_path``, ``stdout``, ``stderr``,
    ``wall_seconds``. Raises if compilation fails — caller maps that to
    HTTP 400.
    """
    _ensure_operators_on_path()
    from scripts.operators.ocean.parser import ParseError
    from scripts.operators.ocean.lexer import LexerError
    from scripts.operators.ocean.typecheck import TypeError_
    from scripts.operators.ocean.compiler import CompileError, compile_ocean
    from scripts.operators import (
        PipelineConfig, StepConfig, run_pipeline,
    )
    # Register every available operator. Premium operators that aren't
    # present (BTUTReducer, TCDRecursiveLoop, ContentFp48Embedder in the
    # open-core wheel build) simply won't appear in the registry; the
    # dispatcher raises KeyError at run time, which we map to 400.
    import scripts.operators.source   # noqa: F401
    import scripts.operators.embed    # noqa: F401
    import scripts.operators.cluster  # noqa: F401
    import scripts.operators.align    # noqa: F401
    import scripts.operators.persist  # noqa: F401

    try:
        cfg = compile_ocean(program_source, source_name="<cloud-run>")
    except (LexerError, ParseError, TypeError_, CompileError) as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error":       "compile-failed",
                "diagnostic":  e.pretty("<cloud-run>") if hasattr(e, "pretty") else str(e),
            },
        )

    work_dir = Path(tempfile.mkdtemp(prefix="ocean-run-"))
    work_corpus = work_dir / "corpus.ndjson"
    work_artifact = work_dir / "result.json"
    shutil.copyfile(corpus_path, work_corpus)
    saved_cwd = Path.cwd()
    t0 = time.time()
    try:
        os.chdir(work_dir)
        # Rewrite any persist.json step's output to land at the well-known path.
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
        raise HTTPException(
            status_code=500,
            detail="pipeline completed but produced no artifact at the expected path",
        )
    return {
        "artifact_path": work_artifact,
        "work_dir":      work_dir,
        "wall_seconds":  wall,
    }


# ── Endpoint ────────────────────────────────────────────────────────────

@router.post("/run")
async def run_ocean(
    program: UploadFile = File(..., description="the .ocean source as a UTF-8 text file"),
    corpus: UploadFile = File(..., description="normalized corpus.ndjson bytes"),
    seed: Optional[int] = Form(None, description="override the seed declared in the program"),
    token: str = Depends(_verify_bearer),
):
    """Execute the canonical OCEAN program against an uploaded corpus.

    Request body (multipart/form-data):
        program: text/plain — the .ocean source
        corpus:  application/x-ndjson — the normalized corpus
        seed:    int — optional override (default: the program's seed)

    Response (HTTP 200):
        {
          "artifact_sha256": "<64-char hex>",
          "n_modules":       int | null,
          "n_records":       int,
          "wall_seconds":    float,
          "seed":            int
        }

    Idempotency: identical (program, corpus, seed) ⇒ identical SHA.
    """
    request_id = f"oc-{int(time.time() * 1000):x}"
    logger.info("ocean.run.started", extra={"request_id": request_id, "token_prefix": token[:8]})

    program_bytes = await program.read()
    corpus_bytes  = await corpus.read()
    program_source = program_bytes.decode("utf-8", errors="replace")

    tmpdir = Path(tempfile.mkdtemp(prefix="ocean-upload-"))
    corpus_path = tmpdir / "corpus.ndjson"
    corpus_path.write_bytes(corpus_bytes)

    try:
        result = _run_ocean_locally(program_source, corpus_path, seed=seed if seed is not None else 42)
        artifact_path: Path = result["artifact_path"]
        sha = _canonical_artifact_sha(artifact_path)

        # Best-effort record / module counts for the response payload.
        n_records = sum(1 for line in corpus_bytes.splitlines() if line.strip())
        n_modules: Optional[int] = None
        try:
            data = json.loads(artifact_path.read_text(encoding="utf-8"))
            for key in ("aligned_modules", "modules", "clusters"):
                v = data.get(key)
                if isinstance(v, list):
                    n_modules = len(v)
                    break
                if isinstance(v, dict):
                    n_modules = len(v)
                    break
        except Exception:  # noqa: BLE001
            pass

        logger.info(
            "ocean.run.completed",
            extra={
                "request_id":   request_id,
                "sha":          sha,
                "wall_s":       result["wall_seconds"],
                "n_records":    n_records,
                "n_modules":    n_modules,
            },
        )
        return JSONResponse({
            "artifact_sha256": sha,
            "n_modules":       n_modules,
            "n_records":       n_records,
            "wall_seconds":    result["wall_seconds"],
            "seed":            int(seed if seed is not None else 42),
        })

    except HTTPException:
        raise
    except KeyError as e:
        # Premium operator missing from the local registry — most common
        # cause is an open-core deployment without the proprietary classes.
        # We surface a 402 so the client knows to upgrade / route, not 500.
        raise HTTPException(
            status_code=402,
            detail={
                "error": "premium-operator-required",
                "operator": str(e).strip("'\""),
                "remedy": "this deployment does not register the requested premium operator; use a hosted-API key or substitute the free-tier variant",
            },
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("ocean.run.failed", extra={"request_id": request_id})
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    finally:
        try:
            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass


# ── Operator catalog ────────────────────────────────────────────────────

# Curated catalog: docstring summary + an OCEAN snippet that exercises
# the operator inside a runnable program. The catalog is hand-written
# rather than reflected from class docstrings because the OCEAN
# surface is intentionally smaller than the Python surface — verbs
# don't map 1:1 to operator-kind names.
_OPERATOR_CATALOG: list[dict] = [
    # ── source / load ──────────────────────────────────────────────
    {
        "kind":  "source.ndjson",
        "verb":  "load",
        "tier":  "free",
        "icon":  "□",
        "section": "load",
        "input": "Path",
        "output": "Records",
        "summary": "Load an NDJSON corpus from disk, optionally stratifying the sample.",
        "snippet": "load corpus.ndjson take 100 records balanced by label label field is label",
    },
    # ── embed family ───────────────────────────────────────────────
    {
        "kind":  "embed.tfidf_jl",
        "verb":  "embed",
        "tier":  "free",
        "icon":  "▤",
        "section": "embed",
        "input": "Records",
        "output": "Z",
        "summary": "TF-IDF + Johnson-Lindenstrauss random projection to a dense Z.",
        "snippet": "embed text into 64 dimensions using tf-idf",
    },
    {
        "kind":  "embed.transformer.minilm_l6",
        "verb":  "embed",
        "tier":  "free",
        "icon":  "▤",
        "section": "embed",
        "input": "Records",
        "output": "Z",
        "summary": "MiniLM-L6 sentence-transformer at 384 dims native.",
        "snippet": "embed text into 384 dimensions using transformer minilm_l6",
    },
    {
        "kind":  "embed.onehot_numeric",
        "verb":  "embed",
        "tier":  "free",
        "icon":  "▤",
        "section": "embed",
        "input": "Records",
        "output": "Z",
        "summary": "One-hot encoder for numeric / categorical record fields.",
        "snippet": "embed text using one-hot numeric",
    },
    {
        "kind":  "embed.content_fp48",
        "verb":  "embed",
        "tier":  "premium",
        "icon":  "▦",
        "section": "embed",
        "input": "Records",
        "output": "Z_FP48",
        "summary": "Bloom-style 48-bit content fingerprints. Pairs with cluster.hamming.",
        "snippet": "embed text using content fingerprint",
    },
    # ── reduce family ──────────────────────────────────────────────
    {
        "kind":  "reduce.stratified",
        "verb":  "reduce",
        "tier":  "free",
        "icon":  "▼",
        "section": "reduce",
        "input": "Records",
        "output": "Records",
        "summary": "Deterministic stratified-by-label sample. Free-tier substitute for BTUT.",
        "snippet": "reduce to 100 records using stratified",
    },
    {
        "kind":  "reduce.btut",
        "verb":  "reduce",
        "tier":  "premium",
        "icon":  "▼",
        "section": "reduce",
        "input": "(Z, Records)",
        "output": "(Z, Records)",
        "summary": "8-tier BTUT lattice-threading reduction with anomaly scoring.",
        "snippet": "reduce records using btut target 300 survivors budget $5",
    },
    # ── cluster family ─────────────────────────────────────────────
    {
        "kind":  "cluster.kmeans",
        "verb":  "cluster",
        "tier":  "free",
        "icon":  "◉",
        "section": "cluster",
        "input": "Z",
        "output": "Modules",
        "summary": "sklearn KMeans with deterministic random_state.",
        "snippet": "cluster for 8 rounds max 8 modules using kmeans",
    },
    {
        "kind":  "cluster.hamming",
        "verb":  "cluster",
        "tier":  "free",
        "icon":  "◉",
        "section": "cluster",
        "input": "Z_FP48",
        "output": "Modules",
        "summary": "Bit-vector Hamming clustering for content_fp48 fingerprints.",
        "snippet": "cluster using hamming",
    },
    {
        "kind":  "cluster.tcd_recursive_loop",
        "verb":  "cluster",
        "tier":  "premium",
        "icon":  "◉",
        "section": "cluster",
        "input": "Z",
        "output": "Modules",
        "summary": "TCD-JEPA recursive loop: Langevin + persistent-homology crystallization.",
        "snippet": "cluster for 16 rounds max 24 modules using tcd recursive loop",
    },
    # ── align family ───────────────────────────────────────────────
    {
        "kind":  "align.module",
        "verb":  "align",
        "tier":  "free",
        "icon":  "◇",
        "section": "align",
        "input": "(Modules, Records, Z)",
        "output": "Aligned",
        "summary": "Per-module K-nearest-records alignment with dominant-label tally.",
        "snippet": "align modules using 10 nearest records",
    },
    {
        "kind":  "align.dispersion",
        "verb":  "align",
        "tier":  "premium",
        "icon":  "◇",
        "section": "align",
        "input": "(Modules, Records, Z)",
        "output": "Aligned",
        "summary": "Dispersion-weighted alignment with module-quality scoring.",
        "snippet": "align modules using 10 nearest records (premium: dispersion-weighted)",
    },
    # ── find family ────────────────────────────────────────────────
    {
        "kind":  "find.dispersion_per_label",
        "verb":  "find",
        "tier":  "free",
        "icon":  "◈",
        "section": "find",
        "input": "(Aligned, Records, Z)",
        "output": "Dispersion",
        "summary": "Per-label routing: where do each label's records land?",
        "snippet": "find dispersion of each label",
    },
    # ── narrate family ─────────────────────────────────────────────
    {
        "kind":  "narrate.plain_english",
        "verb":  "narrate",
        "tier":  "free",
        "icon":  "▶",
        "section": "narrate",
        "input": "Aligned",
        "output": "Aligned",
        "summary": "Deterministic per-module template narration. Zero-LLM.",
        "snippet": "narrate every module using plain english",
    },
    {
        "kind":  "narrate.llm_summary",
        "verb":  "narrate",
        "tier":  "free",
        "icon":  "▶",
        "section": "narrate",
        "input": "Aligned",
        "output": "Aligned",
        "summary": "Anthropic-API narration. Requires ANTHROPIC_API_KEY; falls back to template.",
        "snippet": "narrate every module using llm",
    },
    # ── persist ────────────────────────────────────────────────────
    {
        "kind":  "persist.json",
        "verb":  "save",
        "tier":  "free",
        "icon":  "↧",
        "section": "save",
        "input": "Any",
        "output": "Artifact",
        "summary": "Write pipeline state as JSON with SHA-256 manifest.",
        "snippet": "save to result.json",
    },
]


# Stdlib namespaces — preset pipelines that compose the operators above.
# Surfaced in the playground alongside operators so the menu reflects
# the full reach documented in handbook §B.
_STDLIB_PRESETS: list[dict] = [
    {"namespace": "substrate", "preset": "basic_run",            "tier": "free",
     "summary": "Canonical free-tier pipeline against any NDJSON corpus."},
    {"namespace": "substrate", "preset": "seed_sweep",           "tier": "free",
     "summary": "Sweep seeds 42-46 and emit a SHA per seed."},
    {"namespace": "substrate", "preset": "anomaly_focused",      "tier": "free",
     "summary": "Cluster around the 'normal' label as energy anchor."},
    {"namespace": "substrate", "preset": "content_vs_structural", "tier": "free",
     "summary": "Compare TF-IDF embedding vs content-fingerprint."},
    {"namespace": "pulse",     "preset": "uspto",                 "tier": "free",
     "summary": "USPTO patent abstracts (500 records). Bundled."},
    {"namespace": "pulse",     "preset": "uspto_pro",             "tier": "premium",
     "summary": "USPTO with BTUT pre-reduction + TCD clustering."},
    {"namespace": "atlas",     "preset": "arxiv",                 "tier": "free",
     "summary": "arXiv scientific abstracts (500 records). Bundled."},
    {"namespace": "atlas",     "preset": "arxiv_pro",             "tier": "premium",
     "summary": "arXiv with premium operator chain."},
    {"namespace": "receipt",   "preset": "edgar",                 "tier": "free",
     "summary": "EDGAR financial filings (500 records). Bundled."},
    {"namespace": "receipt",   "preset": "edgar_pro",             "tier": "premium",
     "summary": "EDGAR with premium operator chain."},
    {"namespace": "docsouth",  "preset": "narratives",            "tier": "free",
     "summary": "DocSouth historical narratives (200 records). Bundled."},
    {"namespace": "docsouth",  "preset": "narratives_pro",        "tier": "premium",
     "summary": "DocSouth with premium operator chain."},
    {"namespace": "titan",     "preset": "benchmark",             "tier": "free",
     "summary": "TITAN benchmark corpus (300 records). Bundled."},
    {"namespace": "titan",     "preset": "benchmark_pro",         "tier": "premium",
     "summary": "TITAN with premium operator chain."},
    {"namespace": "universal", "preset": "substrate",             "tier": "free",
     "summary": "Cross-domain substrate sample (400 records). Bundled."},
    {"namespace": "universal", "preset": "substrate_pro",         "tier": "premium",
     "summary": "Universal substrate with premium operators."},
]


@router.get("/operators")
async def operators() -> dict:
    """Public operator catalog. The playground UI fetches this to build
    its click-to-insert reference panel.

    Returns the catalog plus a sidecar marker for which kinds are
    actually registered in this deployment (open-core wheels strip the
    proprietary classes; the catalog still LISTS them so the UI can
    show "premium" badges, but ``registered=False`` makes it obvious
    that a local call would route to the hosted API)."""
    _ensure_operators_on_path()
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
        "operators": [
            {**op, "registered": op["kind"] in registered}
            for op in _OPERATOR_CATALOG
        ],
        "stdlib_presets": _STDLIB_PRESETS,
        "tier": "premium" if any(
            k in registered for k in (
                "reduce.btut", "cluster.tcd_recursive_loop", "embed.content_fp48",
            )
        ) else "open-core",
    }


# ── Sample corpora ──────────────────────────────────────────────────────

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
    """Synthesize a deterministic NDJSON corpus by id.

    Hard-coded vocabulary so TF-IDF survives min_df=2 pruning; phrases
    chosen so the cluster step produces visible label-aligned modules.
    """
    fraud_phrases = [
        "stolen card pattern detected",
        "unauthorized merchant transaction",
        "geographic mismatch flag triggered",
        "high-value fraud signature match",
        "card-not-present anomaly identified",
        "velocity rule breach detected",
    ]
    legit_phrases = [
        "monthly grocery shopping payment",
        "restaurant dinner service charge",
        "online subscription renewal billing",
        "gas station convenience purchase",
        "department store retail transaction",
        "pharmacy prescription pickup payment",
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
        line = json.dumps({
            "id":    f"r{i}",
            "text":  f"transaction record {i}: {phrase}",
            "label": "fraud" if is_fraud else "legit",
        })
        lines.append(line)
    return ("\n".join(lines) + "\n").encode("utf-8")


@router.get("/samples")
async def samples() -> dict:
    """List the bundled sample programs the playground can pre-load."""
    return {
        "samples": [
            {"id": k, **{kk: v for kk, v in spec.items() if kk != "corpus"},
             "corpus_id": spec["corpus"]}
            for k, spec in _SAMPLE_PROGRAMS.items()
        ],
    }


@router.get("/samples/{sample_id}")
async def sample_detail(sample_id: str) -> dict:
    """Return one sample's program + the corpus bytes (base64-free,
    decoded UTF-8) for the playground to load directly into the editor."""
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


# ── /v1/ocean/run_text — JSON-body convenience for the playground ───────

from pydantic import BaseModel  # noqa: E402


class RunTextRequest(BaseModel):
    """Plain-JSON shape used by the in-browser playground.

    The multipart-form variant (POST /v1/ocean/run) stays the
    canonical contract for the CLI's cloud-replay tail; this one is
    just a friendlier shape for fetch() in the browser.
    """
    program:       str
    corpus_ndjson: str
    seed:          Optional[int] = None


@router.post("/run_text")
async def run_text(
    body: RunTextRequest,
    token: str = Depends(_verify_bearer),
):
    """JSON-body variant of /v1/ocean/run. Identical SHA contract."""
    request_id = f"oct-{int(time.time() * 1000):x}"
    tmpdir = Path(tempfile.mkdtemp(prefix="ocean-text-"))
    corpus_path = tmpdir / "corpus.ndjson"
    corpus_path.write_text(body.corpus_ndjson, encoding="utf-8")
    try:
        result = _run_ocean_locally(
            body.program, corpus_path, seed=body.seed if body.seed is not None else 42,
        )
        artifact_path: Path = result["artifact_path"]
        sha = _canonical_artifact_sha(artifact_path)

        artifact_data: Optional[dict] = None
        try:
            artifact_data = json.loads(artifact_path.read_text(encoding="utf-8"))
        except Exception:
            pass

        n_modules: Optional[int] = None
        if artifact_data:
            for key in ("aligned_modules", "modules", "clusters"):
                v = artifact_data.get(key)
                if isinstance(v, list):
                    n_modules = len(v)
                    break
                if isinstance(v, dict):
                    n_modules = len(v)
                    break

        n_records = sum(1 for line in body.corpus_ndjson.splitlines() if line.strip())

        logger.info("ocean.run_text.completed", extra={
            "request_id": request_id, "sha": sha,
            "wall_s": result["wall_seconds"],
            "n_records": n_records, "n_modules": n_modules,
        })
        return JSONResponse({
            "artifact_sha256": sha,
            "n_modules":       n_modules,
            "n_records":       n_records,
            "wall_seconds":    result["wall_seconds"],
            "seed":            int(body.seed if body.seed is not None else 42),
            "artifact":        artifact_data,
        })
    except HTTPException:
        raise
    except KeyError as e:
        raise HTTPException(status_code=402, detail={
            "error":   "premium-operator-required",
            "operator": str(e).strip("'\""),
            "remedy":   "this deployment does not register the requested premium operator",
        })
    except Exception as e:  # noqa: BLE001
        logger.exception("ocean.run_text.failed", extra={"request_id": request_id})
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    finally:
        try:
            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass


@router.get("/health")
async def health() -> dict:
    """Lightweight liveness check that does NOT require an API key.

    Returns the operator registry size as a side-channel signal that
    the wheel-stripping landed correctly: 7 registered = open-core
    deployment; ≥10 = full-repo deployment with proprietary operators.
    """
    _ensure_operators_on_path()
    try:
        from scripts.operators import registered_kinds
        import scripts.operators.source   # noqa: F401
        import scripts.operators.embed    # noqa: F401
        import scripts.operators.cluster  # noqa: F401
        import scripts.operators.align    # noqa: F401
        import scripts.operators.persist  # noqa: F401
        kinds = registered_kinds()
    except Exception as e:  # noqa: BLE001
        return {"status": "degraded", "error": f"{type(e).__name__}: {e}"}
    return {
        "status":               "healthy",
        "registered_operators": len(kinds),
        "tier":                 "premium" if any(
            k in kinds for k in ("reduce.btut", "cluster.tcd_recursive_loop", "embed.content_fp48")
        ) else "open-core",
    }
