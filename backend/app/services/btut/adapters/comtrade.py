"""UN Comtrade global trade adapter — real trade data via comtradeapicall.

Uses the official comtradeapicall Python package for accessing UN Comtrade data.
Free tier: previewFinalData (500 records per call, no key needed).
Premium tier: getFinalData with subscription key (250K records).
"""

from __future__ import annotations

import json
import logging
import time
from collections import defaultdict

from . import register_adapter
from .base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

logger = logging.getLogger(__name__)

# Top trading nations with ISO3 and M49 codes
REPORTERS = [
    ("USA", "842", "United States"), ("CHN", "156", "China"),
    ("DEU", "276", "Germany"), ("JPN", "392", "Japan"),
    ("GBR", "826", "United Kingdom"), ("FRA", "251", "France"),
    ("KOR", "410", "South Korea"), ("IND", "699", "India"),
    ("BRA", "076", "Brazil"), ("CAN", "124", "Canada"),
    ("ITA", "381", "Italy"), ("MEX", "484", "Mexico"),
    ("AUS", "036", "Australia"), ("NLD", "528", "Netherlands"),
    ("SGP", "702", "Singapore"), ("CHE", "756", "Switzerland"),
    ("SAU", "682", "Saudi Arabia"), ("TUR", "792", "Turkey"),
    ("IDN", "360", "Indonesia"), ("THA", "764", "Thailand"),
    ("ARE", "784", "UAE"), ("MYS", "458", "Malaysia"),
    ("VNM", "704", "Vietnam"), ("PHL", "608", "Philippines"),
    ("ZAF", "710", "South Africa"), ("NGA", "566", "Nigeria"),
    ("EGY", "818", "Egypt"), ("CHL", "152", "Chile"),
    ("COL", "170", "Colombia"), ("ARG", "032", "Argentina"),
    ("POL", "616", "Poland"), ("SWE", "752", "Sweden"),
    ("NOR", "578", "Norway"), ("DNK", "208", "Denmark"),
    ("FIN", "246", "Finland"), ("IRL", "372", "Ireland"),
    ("ISR", "376", "Israel"), ("NZL", "554", "New Zealand"),
    ("PER", "604", "Peru"), ("BGD", "050", "Bangladesh"),
]

# Key commodity codes (HS 2-digit)
COMMODITIES = {
    "27": "Mineral fuels, oils", "84": "Machinery, mechanical appliances",
    "85": "Electrical machinery", "87": "Vehicles",
    "71": "Precious stones, metals", "30": "Pharmaceutical products",
    "39": "Plastics", "72": "Iron and steel",
    "90": "Optical, medical instruments", "29": "Organic chemicals",
    "73": "Iron/steel articles", "76": "Aluminium",
    "88": "Aircraft, spacecraft", "26": "Ores, slag, ash",
    "10": "Cereals", "02": "Meat",
}


@register_adapter("comtrade")
class ComtradeAdapter(BaseDatasetAdapter):

    def get_meta(self) -> DatasetMeta:
        return DatasetMeta(
            dataset_id="comtrade",
            display_name="UN Comtrade",
            description="Real international trade flows between 40 nations across 16 commodity sectors from UN Comtrade",
            entity_types=[
                EntityTypeConfig("country", "#00d4ff", "country_name", "country_code",
                                 ["un_code", "region"]),
                EntityTypeConfig("commodity", "#3fb950", "commodity_name", "hs_code",
                                 ["section"]),
                EntityTypeConfig("trade_flow", "#a371f7", "description", "trade_value_usd",
                                 ["reporter", "partner", "year", "flow_type", "commodity"]),
            ],
            lookup_field="country_code",
            lookup_label="Country",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        entities = []
        commodities_added = set()

        # Country entities
        for iso, code, name in REPORTERS:
            entities.append({
                "name": f"country_{iso}",
                "type": "country",
                "attributes": json.dumps({
                    "country_code": iso,
                    "country_name": name,
                    "un_code": code,
                }),
            })

        # Commodity entities
        for hs_code, desc in COMMODITIES.items():
            entities.append({
                "name": f"commodity_{hs_code}",
                "type": "commodity",
                "attributes": json.dumps({
                    "hs_code": hs_code,
                    "commodity_name": desc,
                }),
            })
            commodities_added.add(hs_code)

        # Try to fetch real trade data via comtradeapicall
        real_data_fetched = False
        try:
            import comtradeapicall

            logger.info("Fetching real Comtrade data via comtradeapicall...")
            flow_count = 0

            for iso, code, name in REPORTERS[:15]:  # Top 15 reporters
                try:
                    df = comtradeapicall.previewFinalData(
                        typeCode="C", freqCode="A", clCode="HS",
                        period="2023",
                        reporterCode=code,
                        cmdCode=",".join(COMMODITIES.keys()),
                        flowCode="X",  # Exports
                        partnerCode=None,
                        partner2Code=None, customsCode=None, motCode=None,
                        maxRecords=500,
                        format_output="JSON",
                        aggregateBy=None, breakdownMode="classic",
                        countOnly=None, includeDesc=True,
                    )

                    if df is not None and len(df) > 0:
                        real_data_fetched = True
                        for _, row in df.iterrows():
                            partner = str(row.get("partnerCode", ""))
                            partner_desc = str(row.get("partnerDesc", partner))
                            cmd = str(row.get("cmdCode", ""))
                            cmd_desc = str(row.get("cmdDesc", ""))
                            trade_val = row.get("primaryValue", 0)
                            qty = row.get("netWgt", 0)

                            if not partner or not trade_val:
                                continue

                            flow_name = f"flow_{code}_{partner}_{cmd}"
                            entities.append({
                                "name": flow_name,
                                "type": "trade_flow",
                                "attributes": json.dumps({
                                    "reporter": iso,
                                    "reporter_name": name,
                                    "partner": partner,
                                    "partner_name": partner_desc[:50],
                                    "commodity": cmd,
                                    "commodity_name": cmd_desc[:60],
                                    "trade_value_usd": trade_val,
                                    "net_weight_kg": qty,
                                    "year": "2023",
                                    "flow_type": "export",
                                    "description": f"{name} exports {cmd_desc[:30]} to {partner_desc[:30]}: ${trade_val:,.0f}",
                                }),
                            })
                            flow_count += 1

                    time.sleep(1.5)  # Rate limit

                except Exception as e:
                    logger.warning(f"Comtrade fetch failed for {iso}: {e}")
                    continue

                if len(entities) >= limit:
                    break

            logger.info(f"Fetched {flow_count} real trade flows from Comtrade")

        except ImportError:
            logger.warning("comtradeapicall not installed, using structural fallback")

        # Fallback: if no real data, create structural trade flow entities
        if not real_data_fetched:
            logger.info("Using structural fallback for trade flows")
            for i, (iso_a, _, name_a) in enumerate(REPORTERS):
                for j, (iso_b, _, name_b) in enumerate(REPORTERS):
                    if i >= j:
                        continue
                    for hs_code, desc in list(COMMODITIES.items())[:4]:
                        entities.append({
                            "name": f"flow_{iso_a}_{iso_b}_{hs_code}",
                            "type": "trade_flow",
                            "attributes": json.dumps({
                                "reporter": iso_a,
                                "reporter_name": name_a,
                                "partner": iso_b,
                                "partner_name": name_b,
                                "commodity": hs_code,
                                "commodity_name": desc,
                                "description": f"{name_a} <-> {name_b}: {desc}",
                                "flow_type": "bilateral",
                            }),
                        })
                    if len(entities) >= limit:
                        break
                if len(entities) >= limit:
                    break

        return entities[:limit]

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        edges = []
        countries = {}
        commodities = {}
        for e in entities:
            attrs = json.loads(e.get("attributes", "{}"))
            if e["type"] == "country":
                countries[attrs.get("country_code", "")] = e["name"]
                countries[attrs.get("un_code", "")] = e["name"]
            elif e["type"] == "commodity":
                commodities[attrs.get("hs_code", "")] = e["name"]

        for e in entities:
            if e["type"] != "trade_flow":
                continue
            attrs = json.loads(e.get("attributes", "{}"))

            reporter = attrs.get("reporter", "")
            partner = attrs.get("partner", "")
            commodity = attrs.get("commodity", "")

            if reporter in countries:
                edges.append({"source": countries[reporter], "target": e["name"], "type": "exports", "weight": 0.9})
            if partner in countries:
                edges.append({"source": e["name"], "target": countries[partner], "type": "imports_to", "weight": 0.9})
            if commodity in commodities:
                edges.append({"source": e["name"], "target": commodities[commodity], "type": "trades_commodity", "weight": 0.7})

        # Country co-export edges (same commodity)
        country_commodities: dict[str, set] = defaultdict(set)
        for e in entities:
            if e["type"] == "trade_flow":
                attrs = json.loads(e.get("attributes", "{}"))
                reporter = attrs.get("reporter", "")
                cmd = attrs.get("commodity", "")
                if reporter and cmd:
                    country_commodities[cmd].add(reporter)

        for cmd, exporters in country_commodities.items():
            exp_list = list(exporters)
            for i in range(min(len(exp_list), 10)):
                for j in range(i + 1, min(len(exp_list), 10)):
                    if exp_list[i] in countries and exp_list[j] in countries:
                        edges.append({
                            "source": countries[exp_list[i]],
                            "target": countries[exp_list[j]],
                            "type": "co_exports",
                            "weight": 0.5,
                        })

        return edges

    def get_anomaly_tags(self, record: dict, scores: dict, cluster_size: int, flips: int) -> list[dict]:
        tags = []
        attrs = record.get("attributes", {})
        entity_type = record.get("type", "")

        if entity_type == "trade_flow":
            trade_val = attrs.get("trade_value_usd", 0)
            try:
                trade_val = float(trade_val)
            except (ValueError, TypeError):
                trade_val = 0

            if trade_val > 1e11:
                tags.append({
                    "tag": "MEGA_FLOW",
                    "severity": "high",
                    "description": f"Trade value ${trade_val/1e9:.1f}B -- major bilateral trade corridor.",
                })
            elif trade_val > 1e10:
                tags.append({
                    "tag": "LARGE_FLOW",
                    "severity": "medium",
                    "description": f"Trade value ${trade_val/1e9:.1f}B -- significant trade relationship.",
                })

        elif entity_type == "country":
            code = attrs.get("country_code", "")
            emerging = {"VNM", "IDN", "PHL", "NGA", "EGY", "COL", "THA", "MYS", "BGD", "PER"}
            if code in emerging:
                tags.append({
                    "tag": "EMERGING_MARKET",
                    "severity": "info",
                    "description": f"{attrs.get('country_name', code)} -- emerging market with distinctive trade structure.",
                })

            petro = {"SAU", "ARE", "NOR", "NGA"}
            if code in petro:
                tags.append({
                    "tag": "PETRO_ECONOMY",
                    "severity": "info",
                    "description": "Major petroleum exporter -- trade profile dominated by mineral fuels.",
                })

        return tags
