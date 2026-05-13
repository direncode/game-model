"""Standalone uvicorn entry point for the ``/v1/ocean/run`` endpoint.

The full backend (``backend/app/main.py``) pulls postgres, celery,
prometheus, ws, sso, and a dozen other things. For dev demos and
preview environments we only need the cloud-replay endpoint and a
tiny HTML page to show it working — so this file imports the
endpoint module directly into a minimal FastAPI app.

Run:
    uvicorn backend.ocean_run_standalone:app --reload --port 8787

Production note: this is NOT the production deployment surface. The
production endpoint should live inside the main backend app so it
inherits real auth, rate-limiting, audit logging, and observability.
This standalone file is for: dev, preview, and the static-page demo.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Pin BLAS to single-thread BEFORE numpy / scipy / sklearn touch the
# process. Matches cli/lo/_bootstrap.py so server-side SHAs reproduce
# the laptop SHAs.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
for p in (str(REPO_ROOT), str(BACKEND_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.ocean_run import router as ocean_run_router


app = FastAPI(
    title="Latent Ocean / cloud-replay",
    description="Standalone host for POST /v1/ocean/run plus a demo page.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ocean_run_router)


# ── Demo page ───────────────────────────────────────────────────────────

DEMO_DIR = REPO_ROOT / "frontend" / "public" / "ocean-demo"


@app.get("/", response_class=HTMLResponse)
def index() -> FileResponse:
    """The Claude-CLI-styled demo viewer."""
    idx = DEMO_DIR / "index.html"
    if not idx.exists():
        return HTMLResponse(
            "<h1>demo page not built yet</h1>"
            f"<p>expected at {idx}</p>",
            status_code=404,
        )
    return FileResponse(idx, media_type="text/html")


# Static assets (CSS, fonts, JS modules) live alongside index.html.
if DEMO_DIR.exists():
    app.mount("/static", StaticFiles(directory=DEMO_DIR), name="demo-static")


@app.get("/health")
def standalone_health() -> dict:
    return {"status": "healthy", "service": "ocean-run-standalone"}
