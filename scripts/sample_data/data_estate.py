"""Data Estate: real ScoringEngine over a synthetic asset inventory.

`ScoringEngine.score` is async; we wrap it with `asyncio.run`. Model router
left as None so no external model is called (the `model` evaluator would
route to Claude — we avoid that by not including it in the templates).
"""
from __future__ import annotations

import asyncio
from pathlib import Path

from sample_data._common import (
    ManifestEntry,
    add_file,
    add_interact,
    round_floats,
    write_json,
)


def _synthetic_inventory() -> list[dict]:
    kinds = ["table", "model", "dataset", "dashboard", "notebook"]
    return [
        {
            "asset_id": f"asset_{i:03d}",
            "kind": kinds[i % len(kinds)],
            "owner_team": f"team_{i % 4}",
            "amount": 1000.0 + i * 250.0,
            "justification": f"Quarterly budget increase for {kinds[i % len(kinds)]} pipeline #{i}",
            "category_tag": kinds[i % len(kinds)],
            "created_at": f"2026-0{(i % 4) + 1}-15",
        }
        for i in range(50)
    ]


def _templates() -> list[dict]:
    return [
        {
            "name": "budget_range",
            "evaluator_type": "range",
            "evaluator_config": {"min": 500.0, "max": 5000.0, "ideal": 2500.0},
            "weight": 1.0,
            "is_active": True,
        },
        {
            "name": "justification_keywords",
            "evaluator_type": "keyword",
            "evaluator_config": {
                "keywords": {"pipeline": 10, "budget": 5, "urgent": -10}
            },
            "weight": 1.5,
            "is_active": True,
        },
    ]


def run(out_dir: Path) -> ManifestEntry:
    entry = ManifestEntry(name="data_estate", mode="real")

    inventory = _synthetic_inventory()
    templates = _templates()
    p_inv = out_dir / "asset_inventory.json"
    write_json(p_inv, {"assets": inventory, "count": len(inventory)})
    add_file(entry, p_inv, "input", "50-asset synthetic inventory")

    from app.services.data_estate.scoring_engine import ScoringEngine

    engine = ScoringEngine(model_router=None)

    async def score_all():
        out = []
        for asset in inventory:
            res = await engine.score(
                amount=asset["amount"],
                justification=asset["justification"],
                category_tag=asset["category_tag"],
                templates=templates,
                recent_requests=[],
            )
            out.append(
                {
                    "asset_id": asset["asset_id"],
                    "total": res.total,
                    "recommendation": res.recommendation,
                    "factors": [
                        {
                            "name": f.name,
                            "score": f.score,
                            "weight": f.weight,
                            "detail": f.detail,
                        }
                        for f in res.factors
                    ],
                }
            )
        return out

    scored = asyncio.run(score_all())
    p_scored = out_dir / "scored_assets.json"
    write_json(p_scored, round_floats({"scored": scored, "count": len(scored)}))
    add_file(entry, p_scored, "output", "Scored assets via real ScoringEngine")

    recs: dict[str, int] = {}
    for s in scored:
        recs[s["recommendation"]] = recs.get(s["recommendation"], 0) + 1
    p_route = out_dir / "routing_decisions.json"
    write_json(
        p_route,
        {
            "decisions_by_recommendation": recs,
            "total_scored": len(scored),
            "mean_total": round(sum(s["total"] for s in scored) / max(1, len(scored)), 3),
        },
    )
    add_file(entry, p_route, "output", "Aggregated routing decisions")

    add_interact(entry, "Read scored assets", "Read", "data/samples/data_estate/scored_assets.json")
    add_interact(
        entry, "Read routing decisions", "Read", "data/samples/data_estate/routing_decisions.json"
    )
    return entry
