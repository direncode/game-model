"""UN Comtrade global trade adapter — countries, commodities, trade flows."""

from __future__ import annotations

import json
import os
import time
from urllib.request import Request, urlopen
from urllib.parse import urlencode

from . import register_adapter
from .base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

COMTRADE_BASE = "https://comtradeapi.un.org/data/v1/get/C/A"
REQUEST_DELAY = 1.0  # Conservative rate limit


def _comtrade_get(url: str) -> dict | None:
    time.sleep(REQUEST_DELAY)
    api_key = os.environ.get("COMTRADE_API_KEY", "")
    headers = {"User-Agent": "LatentOcean/1.0"}
    if api_key:
        headers["Ocp-Apim-Subscription-Key"] = api_key
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


# ISO country codes for major trading nations
TOP_COUNTRIES = [
    ("USA", "842"), ("CHN", "156"), ("DEU", "276"), ("JPN", "392"),
    ("GBR", "826"), ("FRA", "251"), ("KOR", "410"), ("IND", "699"),
    ("BRA", "076"), ("CAN", "124"), ("ITA", "381"), ("MEX", "484"),
    ("AUS", "036"), ("NLD", "528"), ("SGP", "702"), ("CHE", "756"),
    ("SAU", "682"), ("TUR", "792"), ("IDN", "360"), ("THA", "764"),
    ("ARE", "784"), ("MYS", "458"), ("VNM", "704"), ("PHL", "608"),
    ("ZAF", "710"), ("NGA", "566"), ("EGY", "818"), ("CHL", "152"),
    ("COL", "170"), ("ARG", "032"),
]


@register_adapter("comtrade")
class ComtradeAdapter(BaseDatasetAdapter):

    def get_meta(self) -> DatasetMeta:
        return DatasetMeta(
            dataset_id="comtrade",
            display_name="UN Comtrade",
            description="Global trade flows between countries — exports, imports, commodities, and trade balances",
            entity_types=[
                EntityTypeConfig("country", "#00d4ff", "country_name", "country_code", ["region", "gdp_rank"]),
                EntityTypeConfig("commodity", "#3fb950", "commodity_name", "hs_code", ["section", "chapter"]),
                EntityTypeConfig("trade_flow", "#a371f7", "description", "trade_value", ["reporter", "partner", "year"]),
            ],
            lookup_field="country_code",
            lookup_label="Country",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        entities = []
        commodities_seen = set()

        # Create country entities
        for iso, code in TOP_COUNTRIES:
            entities.append({
                "name": f"country_{iso}",
                "type": "country",
                "attributes": json.dumps({
                    "country_code": iso,
                    "country_name": iso,  # Will be enriched if API available
                    "un_code": code,
                }),
            })

        # Try to fetch trade data from Comtrade
        api_key = os.environ.get("COMTRADE_API_KEY", "")
        if api_key:
            for iso, code in TOP_COUNTRIES[:10]:
                params = urlencode({
                    "reporterCode": code,
                    "period": "2023",
                    "flowCode": "X",  # Exports
                    "cmdCode": "TOTAL,27,84,85,87",  # Total, Fuels, Machinery, Electronics, Vehicles
                })
                url = f"{COMTRADE_BASE}?{params}"
                data = _comtrade_get(url)

                if not data or "data" not in data:
                    continue

                for record in data["data"][:50]:
                    partner_code = record.get("partnerCode", "")
                    cmd_code = record.get("cmdCode", "")
                    trade_val = record.get("primaryValue", 0)

                    if not partner_code or not trade_val:
                        continue

                    # Trade flow entity
                    flow_name = f"flow_{code}_{partner_code}_{cmd_code}"
                    entities.append({
                        "name": flow_name,
                        "type": "trade_flow",
                        "attributes": json.dumps({
                            "reporter": iso,
                            "partner": str(partner_code),
                            "commodity_code": cmd_code,
                            "trade_value": trade_val,
                            "year": "2023",
                            "flow_type": "export",
                            "description": f"{iso} exports {cmd_code} to {partner_code}",
                        }),
                    })

                    # Commodity entity
                    if cmd_code not in commodities_seen:
                        commodities_seen.add(cmd_code)
                        entities.append({
                            "name": f"commodity_{cmd_code}",
                            "type": "commodity",
                            "attributes": json.dumps({
                                "hs_code": cmd_code,
                                "commodity_name": record.get("cmdDesc", cmd_code)[:100],
                            }),
                        })

                if len(entities) >= limit:
                    break
        else:
            # No API key — generate structural entities from country pairs
            for i, (iso_a, _) in enumerate(TOP_COUNTRIES):
                for j, (iso_b, _) in enumerate(TOP_COUNTRIES):
                    if i >= j:
                        continue
                    entities.append({
                        "name": f"flow_{iso_a}_{iso_b}",
                        "type": "trade_flow",
                        "attributes": json.dumps({
                            "reporter": iso_a,
                            "partner": iso_b,
                            "description": f"{iso_a} <-> {iso_b} bilateral trade",
                        }),
                    })
                    if len(entities) >= limit:
                        break
                if len(entities) >= limit:
                    break

        return entities[:limit]

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        edges = []
        flows = [e for e in entities if e["type"] == "trade_flow"]
        countries = {json.loads(e["attributes"]).get("country_code", ""): e["name"]
                     for e in entities if e["type"] == "country"}

        for flow in flows:
            attrs = json.loads(flow.get("attributes", "{}"))
            reporter = attrs.get("reporter", "")
            partner = attrs.get("partner", "")

            if reporter in countries:
                edges.append({"source": countries[reporter], "target": flow["name"], "type": "exports", "weight": 0.9})
            if partner in countries:
                edges.append({"source": flow["name"], "target": countries[partner], "type": "imports_to", "weight": 0.9})

        return edges

    def get_anomaly_tags(self, record: dict, scores: dict, cluster_size: int, flips: int) -> list[dict]:
        tags = []
        attrs = record.get("attributes", {})
        entity_type = record.get("type", "")

        if entity_type == "trade_flow":
            trade_val = attrs.get("trade_value", 0)
            try:
                trade_val = float(trade_val)
            except (ValueError, TypeError):
                trade_val = 0
            if trade_val > 1e11:
                tags.append({
                    "tag": "MEGA_FLOW",
                    "severity": "high",
                    "description": f"Trade value exceeds $100B — major bilateral trade corridor.",
                })

        elif entity_type == "country":
            code = attrs.get("country_code", "")
            emerging = {"VNM", "IDN", "PHL", "NGA", "EGY", "COL", "THA", "MYS"}
            if code in emerging:
                tags.append({
                    "tag": "EMERGING_MARKET",
                    "severity": "info",
                    "description": f"{code} is an emerging market economy — structural trade patterns may differ from developed economies.",
                })

        return tags
