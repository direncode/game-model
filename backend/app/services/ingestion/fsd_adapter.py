"""Franklin Street Data → ParsedGraph adapter.

Fetches venue data from the FSD API at multiple hours, builds a multi-hour
entity-relationship graph with spatial proximity and busyness correlation edges,
and outputs a ParsedGraph compatible with the awakening pipeline.
"""

from __future__ import annotations

import logging
import math
from statistics import mean, stdev

import httpx

from app.config import settings
from app.services.ingestion.csv_adapter import (
    ParsedEntity,
    ParsedGraph,
    ParsedRelationship,
)

logger = logging.getLogger(__name__)

HOUR_LABELS = {8: "8am", 12: "12pm", 18: "6pm", 22: "10pm"}


async def fetch_spots(hour: int) -> list[dict]:
    """Fetch venue spots from FSD API for a given hour."""
    url = f"{settings.FSD_API_URL}/spots?hour={hour}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    spots = data.get("spots", [])
    logger.info("Fetched %d spots for hour=%d", len(spots), hour)
    return spots


async def fetch_multi_hour(
    hours: list[int] | None = None,
) -> dict[int, list[dict]]:
    """Fetch spots for multiple hours."""
    hours = hours or settings.fsd_snapshot_hours_list
    result: dict[int, list[dict]] = {}
    for h in hours:
        result[h] = await fetch_spots(h)
    return result


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters between two lat/lon points."""
    R = 6_371_000  # Earth radius in meters
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def _pearson(x: list[float], y: list[float]) -> float:
    """Pearson correlation coefficient. Returns 0 if undefined."""
    n = len(x)
    if n < 2:
        return 0.0
    mx, my = mean(x), mean(y)
    sx, sy = stdev(x), stdev(y)
    if sx == 0 or sy == 0:
        return 0.0
    return sum((xi - mx) * (yi - my) for xi, yi in zip(x, y)) / ((n - 1) * sx * sy)


def build_entities(
    multi_hour: dict[int, list[dict]],
) -> list[ParsedEntity]:
    """Build venue entities with multi-hour busyness attributes."""
    # Index by venue name across all hours
    venue_hours: dict[str, dict] = {}

    for hour, spots in multi_hour.items():
        label = HOUR_LABELS.get(hour, f"{hour}h")
        for spot in spots:
            name = spot.get("name", "")
            if not name:
                continue
            if name not in venue_hours:
                venue_hours[name] = {"_spot": spot, "busyness_values": {}}
            venue_hours[name]["busyness_values"][label] = spot.get("busyness", 0)

    entities: list[ParsedEntity] = []
    for name, data in venue_hours.items():
        spot = data["_spot"]
        bv = data["busyness_values"]
        curve = [bv.get(HOUR_LABELS.get(h, f"{h}h"), 0) for h in sorted(multi_hour.keys())]

        # Compute peak hour and variance
        peak_idx = curve.index(max(curve)) if curve else 0
        sorted_hours = sorted(multi_hour.keys())
        peak_label = HOUR_LABELS.get(sorted_hours[peak_idx], str(sorted_hours[peak_idx]))
        variance = stdev(curve) if len(curve) > 1 else 0.0

        attrs = {
            "lat": spot.get("lat", 0),
            "lon": spot.get("lon", 0),
            "category": spot.get("category", ""),
            "cuisine": spot.get("cuisine", ""),
            "address": spot.get("address", ""),
            "brand": spot.get("brand", ""),
            "busyness_curve": curve,
            "peak_hour": peak_label,
            "daily_variance": round(variance, 2),
        }
        # Add per-hour busyness
        for label, val in bv.items():
            attrs[f"busyness_{label}"] = val

        entities.append(ParsedEntity(
            name=name,
            entity_type=spot.get("amenity_type", "venue"),
            attributes=attrs,
        ))

    logger.info("Built %d venue entities from %d hours", len(entities), len(multi_hour))
    return entities


def build_spatial_edges(
    entities: list[ParsedEntity],
    max_distance_m: float | None = None,
) -> list[ParsedRelationship]:
    """Build edges between venues within walking distance."""
    max_dist = max_distance_m or settings.FSD_PROXIMITY_RADIUS_M
    edges: list[ParsedRelationship] = []

    coords = [
        (e.attributes.get("lat", 0), e.attributes.get("lon", 0))
        for e in entities
    ]

    for i in range(len(entities)):
        for j in range(i + 1, len(entities)):
            dist = _haversine_m(coords[i][0], coords[i][1], coords[j][0], coords[j][1])
            if dist <= max_dist:
                weight = round(1.0 - (dist / max_dist), 4)
                edges.append(ParsedRelationship(
                    source=entities[i].name,
                    target=entities[j].name,
                    relationship_type="near",
                    weight=weight,
                    attributes={"distance_meters": round(dist, 1)},
                ))

    logger.info("Built %d spatial edges (radius=%.0fm)", len(edges), max_dist)
    return edges


def build_correlation_edges(
    entities: list[ParsedEntity],
    min_correlation: float | None = None,
) -> list[ParsedRelationship]:
    """Build edges between venues with correlated daily busyness curves."""
    threshold = min_correlation or settings.FSD_CORRELATION_THRESHOLD
    edges: list[ParsedRelationship] = []

    curves = [e.attributes.get("busyness_curve", []) for e in entities]

    for i in range(len(entities)):
        if not curves[i] or all(v == 0 for v in curves[i]):
            continue
        for j in range(i + 1, len(entities)):
            if not curves[j] or all(v == 0 for v in curves[j]):
                continue
            corr = _pearson(curves[i], curves[j])
            if corr >= threshold:
                edges.append(ParsedRelationship(
                    source=entities[i].name,
                    target=entities[j].name,
                    relationship_type="correlated",
                    weight=round(corr, 4),
                    attributes={"correlation_type": "temporal"},
                ))

    logger.info("Built %d correlation edges (threshold=%.2f)", len(edges), threshold)
    return edges


async def adapt(hours: list[int] | None = None) -> ParsedGraph:
    """Main entry point: fetch FSD data and build a ParsedGraph.

    Returns a graph compatible with AwakeningPipeline.run().
    """
    multi_hour = await fetch_multi_hour(hours)
    entities = build_entities(multi_hour)
    spatial = build_spatial_edges(entities)
    correlation = build_correlation_edges(entities)

    graph = ParsedGraph(
        entities=entities,
        relationships=spatial + correlation,
    )

    logger.info(
        "FSD adapter complete: %d entities, %d edges (%d spatial + %d correlation)",
        len(graph.entities),
        len(graph.relationships),
        len(spatial),
        len(correlation),
    )
    return graph
