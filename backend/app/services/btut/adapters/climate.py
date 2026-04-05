"""NOAA Climate dataset adapter — weather stations, observations, regions."""

from __future__ import annotations

import json
import os
import time
from urllib.request import Request, urlopen
from urllib.parse import urlencode

from . import register_adapter
from .base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

NOAA_BASE = "https://www.ncdc.noaa.gov/cdo-web/api/v2"
REQUEST_DELAY = 0.25


def _noaa_get(url: str) -> dict | None:
    time.sleep(REQUEST_DELAY)
    api_key = os.environ.get("NOAA_API_KEY", "")
    if not api_key:
        return None
    req = Request(url, headers={"token": api_key, "User-Agent": "LatentOcean/1.0"})
    try:
        with urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


# Major US state FIPS codes for fallback data
US_STATES = [
    ("AL", "01"), ("AK", "02"), ("AZ", "04"), ("AR", "05"), ("CA", "06"),
    ("CO", "08"), ("CT", "09"), ("DE", "10"), ("FL", "12"), ("GA", "13"),
    ("HI", "15"), ("ID", "16"), ("IL", "17"), ("IN", "18"), ("IA", "19"),
    ("KS", "20"), ("KY", "21"), ("LA", "22"), ("ME", "23"), ("MD", "24"),
    ("MA", "25"), ("MI", "26"), ("MN", "27"), ("MS", "28"), ("MO", "29"),
    ("MT", "30"), ("NE", "31"), ("NV", "32"), ("NH", "33"), ("NJ", "34"),
    ("NM", "35"), ("NY", "36"), ("NC", "37"), ("ND", "38"), ("OH", "39"),
    ("OK", "40"), ("OR", "41"), ("PA", "42"), ("RI", "44"), ("SC", "45"),
    ("SD", "46"), ("TN", "47"), ("TX", "48"), ("UT", "49"), ("VT", "50"),
    ("VA", "51"), ("WA", "53"), ("WV", "54"), ("WI", "55"), ("WY", "56"),
]


@register_adapter("climate")
class ClimateAdapter(BaseDatasetAdapter):

    def get_meta(self) -> DatasetMeta:
        return DatasetMeta(
            dataset_id="climate",
            display_name="NOAA Climate",
            description="US weather stations with temperature, precipitation, and extreme weather observations",
            entity_types=[
                EntityTypeConfig("station", "#00d4ff", "station_name", "station_id", ["latitude", "longitude", "elevation", "state"]),
                EntityTypeConfig("observation", "#f0883e", "datatype", "value", ["date", "station_id"]),
                EntityTypeConfig("region", "#a371f7", "region_name", "state_code", ["station_count"]),
            ],
            lookup_field="station_id",
            lookup_label="Station",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        entities = []

        # Create region entities for all US states
        for state, fips in US_STATES:
            entities.append({
                "name": f"region_{state}",
                "type": "region",
                "attributes": json.dumps({
                    "region_name": state,
                    "state_code": state,
                    "fips": fips,
                }),
            })

        # Try NOAA API for stations
        api_key = os.environ.get("NOAA_API_KEY", "")
        if api_key:
            offset = 1
            while len(entities) < limit:
                url = f"{NOAA_BASE}/stations?datasetid=GHCND&locationid=FIPS:US&limit=1000&offset={offset}"
                data = _noaa_get(url)
                if not data or "results" not in data:
                    break

                for station in data["results"]:
                    sid = station.get("id", "")
                    if not sid:
                        continue

                    entities.append({
                        "name": f"station_{sid.replace(':', '_')}",
                        "type": "station",
                        "attributes": json.dumps({
                            "station_id": sid,
                            "station_name": station.get("name", "")[:100],
                            "latitude": station.get("latitude", 0),
                            "longitude": station.get("longitude", 0),
                            "elevation": station.get("elevation", 0),
                            "min_date": station.get("mindate", ""),
                            "max_date": station.get("maxdate", ""),
                            "datacoverage": station.get("datacoverage", 0),
                        }),
                    })

                offset += 1000
                if len(data["results"]) < 1000:
                    break
        else:
            # No API key — generate representative station entities
            import random
            rng = random.Random(42)
            for i in range(min(limit - len(entities), 5000)):
                state, fips = rng.choice(US_STATES)
                lat = 25 + rng.random() * 24  # US latitude range
                lon = -125 + rng.random() * 57  # US longitude range
                elev = rng.random() * 3000
                temp_avg = 50 + (lat - 37) * -1.5 + rng.gauss(0, 5)

                entities.append({
                    "name": f"station_GHCND_{fips}{i:05d}",
                    "type": "station",
                    "attributes": json.dumps({
                        "station_id": f"GHCND:{fips}{i:05d}",
                        "station_name": f"Station {state}-{i}",
                        "latitude": round(lat, 4),
                        "longitude": round(lon, 4),
                        "elevation": round(elev, 1),
                        "state": state,
                        "temp_avg_f": round(temp_avg, 1),
                        "precip_annual_in": round(rng.uniform(5, 60), 1),
                    }),
                })

        return entities[:limit]

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        edges = []
        stations = [e for e in entities if e["type"] == "station"]
        regions = {json.loads(e["attributes"]).get("state_code", ""): e["name"]
                   for e in entities if e["type"] == "region"}

        # Station-region edges
        for station in stations:
            attrs = json.loads(station.get("attributes", "{}"))
            state = attrs.get("state", "")
            if state in regions:
                edges.append({
                    "source": station["name"], "target": regions[state],
                    "type": "in_region", "weight": 1.0,
                })

        # Spatial neighbor edges (simplified: same state = neighbor)
        by_state: dict[str, list[str]] = {}
        for station in stations:
            attrs = json.loads(station.get("attributes", "{}"))
            state = attrs.get("state", "")
            if state:
                by_state.setdefault(state, []).append(station["name"])

        for state, members in by_state.items():
            for i in range(min(len(members), 20)):
                for j in range(i + 1, min(len(members), 20)):
                    edges.append({
                        "source": members[i], "target": members[j],
                        "type": "spatial_neighbor", "weight": 0.6,
                    })

        return edges

    def get_anomaly_tags(self, record: dict, scores: dict, cluster_size: int, flips: int) -> list[dict]:
        tags = []
        attrs = record.get("attributes", {})
        entity_type = record.get("type", "")

        if entity_type == "station":
            elevation = attrs.get("elevation", 0)
            try:
                elevation = float(elevation)
            except (ValueError, TypeError):
                elevation = 0

            if elevation > 2000:
                tags.append({
                    "tag": "HIGH_ELEVATION",
                    "severity": "info",
                    "description": f"Station at {elevation:.0f}m elevation — alpine/mountain station with unique climate patterns.",
                })

            coverage = attrs.get("datacoverage", 1)
            try:
                coverage = float(coverage)
            except (ValueError, TypeError):
                coverage = 1
            if coverage < 0.5:
                tags.append({
                    "tag": "LOW_DATA_COVERAGE",
                    "severity": "medium",
                    "description": f"Data coverage {coverage:.0%} — significant gaps in observation history.",
                })

            temp = attrs.get("temp_avg_f", 0)
            try:
                temp = float(temp)
            except (ValueError, TypeError):
                temp = 50
            if temp > 80:
                tags.append({
                    "tag": "EXTREME_HEAT",
                    "severity": "medium",
                    "description": f"Average temperature {temp:.1f}F — extreme heat station.",
                })
            elif temp < 20:
                tags.append({
                    "tag": "EXTREME_COLD",
                    "severity": "medium",
                    "description": f"Average temperature {temp:.1f}F — extreme cold station.",
                })

        return tags
