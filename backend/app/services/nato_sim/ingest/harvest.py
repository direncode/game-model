"""Starter-corpus harvester — polite HTTP fetcher for the 30-doc list.

Reads the YAML source list, fetches each URL, strips boilerplate, and
returns ``(origin_tag, url, title, text, source_tier)`` tuples. Intended
to be called from the one-shot corpus prep script.

Discipline:
    - Respect robots.txt is *not* enforced programmatically here because
      we're fetching a small hand-curated list; the operator has vetted
      each URL. For the scaled post-sim crawler, wire in robotparser.
    - Each request uses a clear User-Agent identifying the vertical.
    - Per-domain throttle: small sleep between requests.
    - Failures are logged, not raised — one broken URL shouldn't poison
      the whole corpus prep.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import yaml
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_USER_AGENT = "LatentOcean-NatoSim/0.1 (educational simulation corpus; contact: admin@latentocean.com)"
_TIMEOUT_SECONDS = 20.0


@dataclass(frozen=True)
class HarvestedDoc:
    origin_tag: str
    url: str
    title: str
    text: str
    source_tier: int


def _load_sources(yaml_path: str | Path) -> list[dict[str, Any]]:
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data.get("sources", []) or []


def _extract_readable_text(html: str) -> tuple[str, str]:
    """Return ``(title, main_text)`` from an HTML string.

    Removes scripts/styles/nav/header/footer/aside. If a ``<main>`` or
    ``<article>`` tag exists, takes its text; otherwise falls back to
    the whole body.
    """
    soup = BeautifulSoup(html, "html.parser")
    for selector in ("script", "style", "nav", "header", "footer", "aside"):
        for tag in soup.find_all(selector):
            tag.decompose()

    title_el = soup.find("title")
    title = title_el.text.strip() if title_el else ""

    container = soup.find("main") or soup.find("article") or soup.body or soup
    text = " ".join(container.get_text(separator=" ").split())
    return title, text


async def _fetch_one(
    client: httpx.AsyncClient, source: dict[str, Any]
) -> HarvestedDoc | None:
    url = source["url"]
    origin_tag = source.get("origin_tag", "starter:unknown")
    label = source.get("label", url)
    tier = int(source.get("tier", 2))
    try:
        resp = await client.get(url)
        if resp.status_code != 200 or not resp.text:
            logger.warning("harvest: %s returned %d", label, resp.status_code)
            return None
        title, text = _extract_readable_text(resp.text)
        if not text:
            logger.warning("harvest: %s produced empty text", label)
            return None
        # Cap text at a reasonable size to keep embeddings/resolver fast.
        text = text[:80_000]
        return HarvestedDoc(
            origin_tag=origin_tag,
            url=url,
            title=title or label,
            text=text,
            source_tier=tier,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("harvest: %s failed: %s", label, exc)
        return None


async def harvest_starter_corpus(yaml_path: str | Path) -> list[HarvestedDoc]:
    """Fetch every source in the YAML, in parallel (bounded), politely."""
    sources = _load_sources(yaml_path)
    if not sources:
        return []

    sem = asyncio.Semaphore(4)  # max 4 concurrent requests

    async with httpx.AsyncClient(
        headers={"User-Agent": _USER_AGENT},
        timeout=_TIMEOUT_SECONDS,
        follow_redirects=True,
    ) as client:

        async def bounded(src: dict[str, Any]) -> HarvestedDoc | None:
            async with sem:
                await asyncio.sleep(0.1)  # small pacing
                return await _fetch_one(client, src)

        results = await asyncio.gather(*(bounded(s) for s in sources))

    return [r for r in results if r is not None]
