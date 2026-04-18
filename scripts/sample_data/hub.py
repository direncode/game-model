"""Hub: HF featured + categories extracted via AST (no import side effects).

The live `hf_importer` module transitively imports `app.db.neo4j` which fails
if the deployment `.env` has extra keys. To stay offline and side-effect-free
we parse `hf_importer.py` with `ast` and evaluate only the two static module
constants we need (`FEATURED_DATASETS`, `CATEGORIES`). Those are literal lists
so `ast.literal_eval` is safe.
"""
from __future__ import annotations

import ast
from datetime import datetime, timezone
from pathlib import Path

from sample_data._common import (
    BACKEND_ROOT,
    ManifestEntry,
    add_file,
    add_interact,
    write_json,
)


_HF_IMPORTER_PATH = BACKEND_ROOT / "app" / "services" / "hub" / "hf_importer.py"


def _extract_literal(source_path: Path, names: set[str]) -> dict[str, object]:
    """Parse a .py file and return a dict of top-level literal assignments matching `names`."""
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    out: dict[str, object] = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id in names:
                try:
                    out[target.id] = ast.literal_eval(node.value)
                except Exception:
                    continue
    return out


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="hub", mode="real")

    extracted = _extract_literal(_HF_IMPORTER_PATH, {"FEATURED_DATASETS", "CATEGORIES"})
    featured = extracted.get("FEATURED_DATASETS") or []
    categories = extracted.get("CATEGORIES") or []

    p_feat = out_dir / "hf_featured.json"
    write_json(p_feat, {"featured": featured, "count": len(featured)})
    add_file(entry, p_feat, "output", "Featured HF datasets (AST-extracted from hf_importer.py)")

    p_cat = out_dir / "hf_categories.json"
    write_json(p_cat, {"categories": categories, "count": len(categories)})
    add_file(entry, p_cat, "output", "HF categories (AST-extracted from hf_importer.py)")

    stub = {
        "dataset_id": "sample/latent-ocean-demo",
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "rows_imported": 1234,
        "columns": ["id", "text", "label"],
        "schema_inferred": True,
        "graph_nodes": 512,
        "graph_edges": 1723,
        "note": "Stubbed import result; no live HuggingFace call.",
    }
    p_imp = out_dir / "hf_import_result.json"
    write_json(p_imp, stub)
    add_file(entry, p_imp, "output", "Stubbed HF import result (offline)")

    add_interact(entry, "Read featured datasets", "Read", "data/samples/hub/hf_featured.json")
    add_interact(entry, "Read import result", "Read", "data/samples/hub/hf_import_result.json")
    return entry
