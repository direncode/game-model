"""Shared SDK-client helpers for the `lo` CLI surface and `lo.demo`.

Pulled out of [main.py](cli/lo/main.py) so the demo module can import the
client constructor without importing the entire typer app surface.
"""
from __future__ import annotations

import json
import os
from pathlib import Path


def get_client():
    """Build a Latent Ocean SDK client from env vars or `~/.latentocean/config.json`.

    Raises ImportError if the `latentocean` SDK isn't installed. Raises a
    plain RuntimeError if no API key can be resolved — callers decide
    whether that's fatal (production use) or non-fatal (demo without
    cloud-replay).
    """
    from latentocean import Client  # type: ignore[import-not-found]

    api_key = os.environ.get("LO_API_KEY", "")
    base_url = os.environ.get("LO_BASE_URL", "https://api.latentocean.io")

    if not api_key:
        config_path = Path.home() / ".latentocean" / "config.json"
        if config_path.exists():
            cfg = json.loads(config_path.read_text())
            api_key = cfg.get("api_key", "")
            base_url = cfg.get("base_url", base_url)

    if not api_key:
        raise RuntimeError(
            "No API key found. Set LO_API_KEY or run `lo configure`."
        )
    return Client(api_key=api_key, base_url=base_url)


__all__ = ["get_client"]
