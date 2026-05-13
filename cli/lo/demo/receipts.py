"""Receipts ledger: SHA-256 hashes, cost accumulator, oceanlog metadata.

Every corpus run produces an artifact JSON plus a `.sha256` sidecar. The
ledger collects these as the demo proceeds. The cloud-replay tail compares
local hashes to cloud hashes from this ledger.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from pathlib import Path


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_of_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass
class Receipt:
    """One corpus's worth of evidence after the canonical program runs."""
    corpus_id: str
    display_name: str
    corpus_sha256: str         # hash of the normalized corpus.ndjson
    artifact_sha256: str        # hash of result.json
    wall_seconds: float
    estimated_cost_usd: float
    n_records: int
    n_modules: int | None = None
    cloud_artifact_sha256: str | None = None  # set during replay tail
    cloud_matches_local: bool | None = None
    # ``cloud_source`` records *where* the cloud hash came from so the TUI
    # and downstream consumers can distinguish a live cloud round-trip
    # from a cached hash from this morning's rehearsal. Values:
    #   "live"   — fresh response from /v1/ocean/run
    #   "cached" — read from ~/.latentocean/demo-cache/cloud_hashes.json
    #   "absent" — neither live nor cached; cloud_artifact_sha256 is None
    cloud_source: str = "absent"
    cloud_cached_at: str | None = None  # ISO date string of cache origin

    def short_sha(self) -> str:
        """Truncated render for the TUI ledger pane: `7c3a...b41f`."""
        if not self.artifact_sha256:
            return "—"
        return f"{self.artifact_sha256[:4]}...{self.artifact_sha256[-4:]}"

    def short_cloud_sha(self) -> str:
        if not self.cloud_artifact_sha256:
            return "—"
        return f"{self.cloud_artifact_sha256[:4]}...{self.cloud_artifact_sha256[-4:]}"

    def cloud_status_label(self) -> str:
        """Short audience-readable label for the cloud column.

        ``live``    rendered green so the audience sees a real cloud
                    round-trip when it lands. ``cached`` rendered yellow
                    with the date so it's obvious this isn't a live hit.
                    ``absent`` rendered dim, conveying the demo is in
                    local-only mode and the determinism reveal still
                    holds (local hashes pin to themselves)."""
        if self.cloud_source == "live":
            return "live"
        if self.cloud_source == "cached":
            if self.cloud_cached_at:
                return f"cached @ {self.cloud_cached_at[:10]}"
            return "cached"
        return "local only"


@dataclass
class Ledger:
    """Accumulating list of receipts across the gauntlet."""
    receipts: list[Receipt] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)

    def add(self, receipt: Receipt) -> None:
        self.receipts.append(receipt)

    def find(self, corpus_id: str) -> Receipt | None:
        for r in self.receipts:
            if r.corpus_id == corpus_id:
                return r
        return None

    def total_cost(self) -> float:
        return sum(r.estimated_cost_usd for r in self.receipts)

    def total_wall(self) -> float:
        return sum(r.wall_seconds for r in self.receipts)

    def total_records(self) -> int:
        return sum(r.n_records for r in self.receipts)

    def all_cloud_matched(self) -> bool:
        return bool(self.receipts) and all(
            r.cloud_matches_local is True for r in self.receipts
        )

    def to_dict(self) -> dict:
        return {
            "started_at": self.started_at,
            "total_cost_usd": self.total_cost(),
            "total_wall_seconds": self.total_wall(),
            "total_records": self.total_records(),
            "receipts": [
                {
                    "corpus_id": r.corpus_id,
                    "display_name": r.display_name,
                    "corpus_sha256": r.corpus_sha256,
                    "artifact_sha256": r.artifact_sha256,
                    "cloud_artifact_sha256": r.cloud_artifact_sha256,
                    "cloud_matches_local": r.cloud_matches_local,
                    "cloud_source": r.cloud_source,
                    "cloud_cached_at": r.cloud_cached_at,
                    "wall_seconds": r.wall_seconds,
                    "estimated_cost_usd": r.estimated_cost_usd,
                    "n_records": r.n_records,
                    "n_modules": r.n_modules,
                }
                for r in self.receipts
            ],
        }

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")


def estimate_cost_usd(n_records: int, wall_seconds: float) -> float:
    """Rough $-per-corpus estimate for the demo's cost meter.

    The number that surfaces in the TUI bottom-bar. Linear in records and
    wall-time so the audience sees it tick visibly per corpus.

    Calibration: 500 records of free-tier TF-IDF + k-means on a laptop
    runs in ~3-5 seconds and represents about $0.001 of equivalent
    Snowflake/Databricks compute. The displayed dollar figure is the
    *equivalent commodity-compute cost*, not the operator's electric
    bill — that framing is what makes "$200 for 3000 TB" land later.
    """
    per_record = 0.00001
    per_second = 0.001
    return round(n_records * per_record + wall_seconds * per_second, 4)
