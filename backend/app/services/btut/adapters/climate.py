"""NOAA Climate dataset adapter — real weather station data via api.weather.gov.

NOAA's API is free and open — only requires a User-Agent header for identification.
No API key needed. Uses api.weather.gov for stations and observations.
"""

from __future__ import annotations

import json
import time
from urllib.request import Request, urlopen
from collections import defaultdict

from . import register_adapter
from .base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

NOAA_STATIONS_URL = "https://api.weather.gov/stations"
NOAA_UA = "LatentOcean/1.0 (direnavk@outlook.com)"
REQUEST_DELAY = 0.12  # ~8 req/sec, well within limits


def _noaa_get(url: str) -> dict | None:
    time.sleep(REQUEST_DELAY)
    req = Request(url, headers={
        "User-Agent": NOAA_UA,
        "Accept": "application/geo+json",
    })
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


# US state names for region entities
US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}


@register_adapter("climate")
class ClimateAdapter(BaseDatasetAdapter):

    def get_meta(self) -> DatasetMeta:
        return DatasetMeta(
            dataset_id="climate",
            display_name="NOAA Climate",
            description="Real US weather stations with coordinates, elevation, and observation metadata from api.weather.gov",
            entity_types=[
                EntityTypeConfig("station", "#00d4ff", "station_name", "station_id",
                                 ["latitude", "longitude", "elevation_m", "state", "county"]),
                EntityTypeConfig("region", "#a371f7", "region_name", "state_code", ["station_count"]),
            ],
            lookup_field="station_id",
            lookup_label="Station",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        entities = []
        state_counts: dict[str, int] = defaultdict(int)

        # Create region entities
        for code, name in US_STATES.items():
            entities.append({
                "name": f"region_{code}",
                "type": "region",
                "attributes": json.dumps({
                    "region_name": name,
                    "state_code": code,
                }),
            })

        # Fetch real stations from NOAA
        # api.weather.gov/stations returns paginated GeoJSON
        url = f"{NOAA_STATIONS_URL}?limit=500"
        page = 0
        max_pages = (limit // 500) + 1

        while url and page < max_pages and len(entities) < limit:
            data = _noaa_get(url)
            if not data:
                break

            features = data.get("features", [])
            if not features:
                break

            for feature in features:
                props = feature.get("properties", {})
                geo = feature.get("geometry", {})
                coords = geo.get("coordinates", [0, 0])

                station_id = props.get("stationIdentifier", "")
                if not station_id:
                    continue

                name = props.get("name", "")
                state = props.get("state", "") or ""
                county = props.get("county", "")
                # Extract state code from county URL if available
                if not state and county:
                    # county format: https://api.weather.gov/zones/county/XXC001
                    parts = county.split("/")
                    if parts:
                        zone_code = parts[-1]
                        if len(zone_code) >= 2:
                            state = zone_code[:2]

                elevation = props.get("elevation", {})
                elev_val = elevation.get("value", 0) if isinstance(elevation, dict) else 0

                timezone = props.get("timeZone", "")

                entities.append({
                    "name": f"station_{station_id}",
                    "type": "station",
                    "attributes": json.dumps({
                        "station_id": station_id,
                        "station_name": name[:100],
                        "latitude": round(coords[1], 4) if len(coords) > 1 else 0,
                        "longitude": round(coords[0], 4) if coords else 0,
                        "elevation_m": round(elev_val, 1) if elev_val else 0,
                        "state": state,
                        "county": county.split("/")[-1] if county else "",
                        "timezone": timezone,
                    }),
                })

                if state:
                    state_counts[state] += 1

            # Pagination
            pagination = data.get("pagination", {})
            url = pagination.get("next", None)
            if not url:
                # Try @context links
                links = data.get("@context", [])
                if isinstance(links, list):
                    for link in links:
                        if isinstance(link, dict) and "next" in link:
                            url = link["next"]
                            break
                # Or try observationStations pattern
                if not url:
                    break

            page += 1

        # Update region entities with station counts
        for ent in entities:
            if ent["type"] == "region":
                attrs = json.loads(ent["attributes"])
                code = attrs["state_code"]
                attrs["station_count"] = state_counts.get(code, 0)
                ent["attributes"] = json.dumps(attrs)

        return entities[:limit]

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        edges = []
        stations = [e for e in entities if e["type"] == "station"]
        regions = {}
        for e in entities:
            if e["type"] == "region":
                attrs = json.loads(e["attributes"])
                regions[attrs["state_code"]] = e["name"]

        # Station-region edges
        for station in stations:
            attrs = json.loads(station.get("attributes", "{}"))
            state = attrs.get("state", "")
            if state in regions:
                edges.append({
                    "source": station["name"],
                    "target": regions[state],
                    "type": "in_region",
                    "weight": 1.0,
                })

        # Spatial neighbor edges: connect stations in same state
        by_state: dict[str, list[str]] = defaultdict(list)
        for station in stations:
            attrs = json.loads(station.get("attributes", "{}"))
            state = attrs.get("state", "")
            if state:
                by_state[state].append(station["name"])

        for state, members in by_state.items():
            for i in range(min(len(members), 15)):
                for j in range(i + 1, min(len(members), 15)):
                    edges.append({
                        "source": members[i],
                        "target": members[j],
                        "type": "spatial_neighbor",
                        "weight": 0.6,
                    })

        return edges

    def get_anomaly_tags(self, record: dict, scores: dict, cluster_size: int, flips: int) -> list[dict]:
        tags = []
        attrs = record.get("attributes", {})
        entity_type = record.get("type", "")

        if entity_type == "station":
            elev = attrs.get("elevation_m", 0)
            try:
                elev = float(elev)
            except (ValueError, TypeError):
                elev = 0

            if elev > 2000:
                tags.append({
                    "tag": "HIGH_ELEVATION",
                    "severity": "info",
                    "description": f"Station at {elev:.0f}m elevation -- alpine/mountain station with unique microclimate.",
                })
            elif elev < -10:
                tags.append({
                    "tag": "BELOW_SEA_LEVEL",
                    "severity": "medium",
                    "description": f"Station at {elev:.0f}m -- below sea level, unusual geographic position.",
                })

            lat = attrs.get("latitude", 0)
            try:
                lat = float(lat)
            except (ValueError, TypeError):
                lat = 40

            if lat > 65:
                tags.append({
                    "tag": "ARCTIC_STATION",
                    "severity": "medium",
                    "description": f"Station at latitude {lat:.1f}N -- arctic/subarctic climate zone.",
                })
            elif lat < 20:
                tags.append({
                    "tag": "TROPICAL_STATION",
                    "severity": "info",
                    "description": f"Station at latitude {lat:.1f}N -- tropical climate zone.",
                })

        elif entity_type == "region":
            count = attrs.get("station_count", 0)
            try:
                count = int(count)
            except (ValueError, TypeError):
                count = 0
            if count == 0:
                tags.append({
                    "tag": "NO_STATIONS",
                    "severity": "high",
                    "description": "Region with no weather stations in the dataset -- data coverage gap.",
                })
            elif count > 100:
                tags.append({
                    "tag": "HIGH_DENSITY_REGION",
                    "severity": "info",
                    "description": f"{count} stations in region -- dense observation network.",
                })

        return tags
