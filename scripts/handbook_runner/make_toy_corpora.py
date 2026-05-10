"""One-time toy-corpus generator. Run once; commit the output."""
from __future__ import annotations

import json
import random
from pathlib import Path

OUT = Path("backend/handbook_runner/corpora")
OUT.mkdir(parents=True, exist_ok=True)


def gen_tna() -> None:
    """50 records, 2 archive labels, ~30 KB."""
    random.seed(42)
    archives = ["bombe", "tunny"]
    records = []
    for i in range(50):
        archive = random.choice(archives)
        records.append({
            "id": f"tna-{i:04d}",
            "archive": archive,
            "text": (
                "machine catalogue entry " * random.randint(3, 8)
                + f"{archive} unit {i}"
            ),
            "primary_category": random.choice(["mechanical", "electrical", "structural"]),
        })
    _write(OUT / "toy_tna_50.ndjson", records)


def gen_nslkdd() -> None:
    """200 records, normal/attack types, ~80 KB."""
    random.seed(43)
    types = ["normal", "neptune", "smurf", "back"]
    weights = [0.7, 0.15, 0.10, 0.05]
    records = []
    for i in range(200):
        t = random.choices(types, weights=weights, k=1)[0]
        records.append({
            "id": f"nsl-{i:04d}",
            "type": t,
            "duration": random.randint(0, 1000),
            "protocol": random.choice(["tcp", "udp", "icmp"]),
            "service": random.choice(["http", "smtp", "ssh", "private"]),
            "src_bytes": random.randint(0, 10000),
            "dst_bytes": random.randint(0, 10000),
        })
    _write(OUT / "toy_nslkdd_200.ndjson", records)


def gen_climate() -> None:
    """100 records, 4 regions, ~50 KB."""
    random.seed(44)
    regions = ["arctic", "temperate", "tropical", "antarctic"]
    records = []
    for i in range(100):
        r = random.choice(regions)
        records.append({
            "id": f"clim-{i:04d}",
            "region": r,
            "year": random.randint(1950, 2020),
            "temperature_anomaly": round(random.gauss(0.5, 1.0), 3),
            "text": f"Climate observation from {r} region year {1950 + (i % 71)}.",
        })
    _write(OUT / "toy_climate_100.ndjson", records)


def _write(path: Path, records: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, separators=(",", ":"), sort_keys=True) + "\n")


if __name__ == "__main__":
    gen_tna()
    gen_nslkdd()
    gen_climate()
    print("wrote 3 corpora to", OUT)
