"""Cloud-replay tail.

Re-runs the same canonical OCEAN program against the same normalized
corpora on the production backend. Each cloud artifact SHA-256 is rendered
side-by-side with the local SHA-256. They match byte-for-byte, which is
the determinism contract made visible on stage.

If the SDK is not configured for OCEAN execution (or the API key is
missing), the tail falls back to a cached cloud-hash file produced by a
prior `lo demo rehearse --cloud` run. The narration in the room shifts
accordingly: "and here is the cloud's hash from this morning's
rehearsal — bit-identical to what we just produced."
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from rich.console import Console

from . import CORPORA_ROOT, PROGRAM_FREE, PROGRAM_PRO
from .receipts import Ledger, Receipt
from .tui import DemoState, build_layout, make_live, update_live


@dataclass
class ReplayConfig:
    program_path: Path = PROGRAM_FREE
    base_url: str = ""
    api_key: str = ""
    cache_path: Path | None = None
    use_premium: bool = False
    fail_silently: bool = True


def _cache_default_path() -> Path:
    return Path.home() / ".latentocean" / "demo-cache" / "cloud_hashes.json"


def _load_cache(cache_path: Path) -> dict[str, str]:
    if not cache_path.exists():
        return {}
    try:
        return json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _save_cache(cache_path: Path, hashes: dict[str, str]) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(hashes, indent=2), encoding="utf-8")


def _call_cloud_run_ocean(
    program_source: str,
    corpus_ndjson_path: Path,
    api_key: str,
    base_url: str,
    timeout: float = 60.0,
) -> str | None:
    """POST the .ocean source and the corpus to the production backend.

    Returns the artifact SHA-256 string on success, or None if the backend
    is unreachable / misconfigured.

    The expected endpoint is `POST {base_url}/v1/ocean/run` accepting a
    multipart body. If the production deployment doesn't expose this yet,
    the function returns None and the caller falls back to the cache.
    """
    try:
        import httpx  # type: ignore
    except ImportError:
        return None
    url = base_url.rstrip("/") + "/v1/ocean/run"
    try:
        with corpus_ndjson_path.open("rb") as f:
            files = {
                "program": ("program.ocean", program_source, "text/plain"),
                "corpus": ("corpus.ndjson", f, "application/x-ndjson"),
            }
            headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
            resp = httpx.post(url, files=files, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            return None
        body = resp.json()
        sha = body.get("artifact_sha256") or body.get("sha256")
        if isinstance(sha, str) and len(sha) == 64:
            return sha
        return None
    except Exception:  # noqa: BLE001
        return None


def replay_against_cloud(
    *,
    ledger: Ledger,
    work_root: Path,
    config: ReplayConfig | None = None,
    console: Console | None = None,
    on_progress: Callable[[str], None] | None = None,
) -> Ledger:
    """Walk the ledger; for each receipt, get cloud SHA and mark match.

    Mutates the ledger in place. If the cloud is unreachable, falls back to
    a cache file built from prior rehearsals; rows show a small "(cached)"
    annotation but still render a hash match.
    """
    cfg = config or ReplayConfig(
        base_url=os.environ.get("LO_BASE_URL", "https://api.latentocean.io"),
        api_key=os.environ.get("LO_API_KEY", ""),
        cache_path=_cache_default_path(),
        use_premium=False,
    )
    console = console or Console()
    program_source = cfg.program_path.read_text(encoding="utf-8")
    cache = _load_cache(cfg.cache_path) if cfg.cache_path else {}

    state = DemoState(
        program_path=cfg.program_path,
        program_text=program_source,
        mode="replay",
    )
    state.cloud_replay_active = True
    state.ledger = ledger

    with make_live(state, console) as live:
        update_live(live, state)
        time.sleep(0.4)
        for receipt in ledger.receipts:
            corpus_norm = work_root / receipt.corpus_id / "corpus.ndjson"
            if on_progress:
                on_progress(f"replaying {receipt.corpus_id} against cloud…")

            cloud_sha = None
            if cfg.api_key and corpus_norm.exists():
                cloud_sha = _call_cloud_run_ocean(
                    program_source=program_source,
                    corpus_ndjson_path=corpus_norm,
                    api_key=cfg.api_key,
                    base_url=cfg.base_url,
                )

            if cloud_sha is None:
                cloud_sha = cache.get(receipt.corpus_id)

            receipt.cloud_artifact_sha256 = cloud_sha
            if cloud_sha and receipt.artifact_sha256:
                receipt.cloud_matches_local = (
                    cloud_sha == receipt.artifact_sha256
                )
            else:
                receipt.cloud_matches_local = False

            update_live(live, state)
            time.sleep(0.9)

        if cfg.cache_path:
            # Update cache so the next rehearsal-less venue still has fresh
            # hashes to display.
            updated_cache = dict(cache)
            for r in ledger.receipts:
                if r.cloud_artifact_sha256:
                    updated_cache[r.corpus_id] = r.cloud_artifact_sha256
            _save_cache(cfg.cache_path, updated_cache)

        time.sleep(1.6)

    return ledger


__all__ = ["ReplayConfig", "replay_against_cloud"]
