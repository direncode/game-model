"""Deterministic sampler for the six bundled showcase demo corpora.

Run once before each release to regenerate the bundled demos. Output
files are byte-identical across runs at the same seed.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEMO_ROOT = REPO_ROOT / "packages/ocean-cli/src/ocean_cli/stdlib/data"
SEED = 42


def _write(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, separators=(",", ":"), sort_keys=True) + "\n")


def gen_pulse_uspto() -> None:
    """500 USPTO inventor records, stratified by directorate."""
    random.seed(SEED)
    directorates = ["1600", "1700", "2100", "2400", "2600", "2800", "3600", "3700"]
    primary_classes = ["mechanical", "electrical", "chemical", "biotech", "software"]
    records = []
    for i in range(500):
        directorate = random.choice(directorates)
        cls = random.choice(primary_classes)
        records.append({
            "id": f"uspto-{i:05d}",
            "directorate": directorate,
            "primary_class": cls,
            "text": (
                f"patent application abstract directorate {directorate} "
                f"class {cls} " + "claim language " * random.randint(3, 7)
            ),
        })
    _write(DEMO_ROOT / "pulse/uspto_demo.ndjson", records)


def gen_atlas_arxiv() -> None:
    """500 arXiv preprint records, stratified by category."""
    random.seed(SEED + 1)
    categories = ["astro-ph", "cond-mat", "hep-th", "math-ph", "cs.LG", "stat.ML"]
    records = []
    for i in range(500):
        cat = random.choice(categories)
        records.append({
            "id": f"arxiv-{i:05d}",
            "category": cat,
            "year": random.randint(2010, 2024),
            "text": (
                f"abstract category {cat} "
                + "theoretical framework " * random.randint(2, 6)
                + f"results consistent with {cat} hypothesis"
            ),
        })
    _write(DEMO_ROOT / "atlas/arxiv_demo.ndjson", records)


def gen_receipt_edgar() -> None:
    """500 SEC EDGAR filing records, stratified by form_type."""
    random.seed(SEED + 2)
    form_types = ["10-K", "10-Q", "8-K", "S-1", "DEF 14A", "13F"]
    sectors = ["technology", "finance", "healthcare", "energy", "consumer"]
    records = []
    for i in range(500):
        form = random.choice(form_types)
        sector = random.choice(sectors)
        records.append({
            "id": f"edgar-{i:05d}",
            "form_type": form,
            "sector": sector,
            "filing_date": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
            "text": (
                f"company filing form {form} sector {sector} "
                + "material discussion " * random.randint(2, 5)
            ),
        })
    _write(DEMO_ROOT / "receipt/edgar_demo.ndjson", records)


def gen_docsouth_narratives() -> None:
    """200 historical narrative records, stratified by era."""
    random.seed(SEED + 3)
    eras = ["antebellum", "reconstruction", "jim-crow", "great-migration"]
    forms = ["autobiography", "letter", "speech", "memoir"]
    records = []
    for i in range(200):
        era = random.choice(eras)
        form = random.choice(forms)
        records.append({
            "id": f"docsouth-{i:04d}",
            "era": era,
            "form": form,
            "year": random.randint(1830, 1950),
            "text": (
                f"narrative {form} era {era} "
                + "first-hand account " * random.randint(3, 6)
            ),
        })
    _write(DEMO_ROOT / "docsouth/narratives_demo.ndjson", records)


def gen_titan_benchmark() -> None:
    """300 Titan benchmark records, stratified by domain."""
    random.seed(SEED + 4)
    domains = ["climate", "trade", "patents", "papers", "filings"]
    sizes = ["small", "medium", "large"]
    records = []
    for i in range(300):
        domain = random.choice(domains)
        size = random.choice(sizes)
        records.append({
            "id": f"titan-{i:04d}",
            "domain": domain,
            "size_class": size,
            "text": (
                f"benchmark domain {domain} size {size} "
                + "structural signal " * random.randint(2, 5)
            ),
        })
    _write(DEMO_ROOT / "titan/benchmark_demo.ndjson", records)


def gen_universal_substrate() -> None:
    """400 cross-domain substrate records, stratified by source_type."""
    random.seed(SEED + 5)
    source_types = ["patent", "paper", "filing", "letter", "log", "claim"]
    quality = ["high", "medium", "low"]
    records = []
    for i in range(400):
        st = random.choice(source_types)
        q = random.choice(quality)
        records.append({
            "id": f"universal-{i:04d}",
            "source_type": st,
            "quality": q,
            "text": (
                f"cross-domain {st} quality {q} "
                + "substrate evidence " * random.randint(2, 6)
            ),
        })
    _write(DEMO_ROOT / "universal/substrate_demo.ndjson", records)


def main() -> int:
    gen_pulse_uspto()
    gen_atlas_arxiv()
    gen_receipt_edgar()
    gen_docsouth_narratives()
    gen_titan_benchmark()
    gen_universal_substrate()
    print(f"wrote 6 demo corpora to {DEMO_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
