"""SEC EDGAR dataset adapter — companies, filings, XBRL financial facts."""

from __future__ import annotations

import json
import time
from urllib.request import Request, urlopen

from . import register_adapter
from .base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

EDGAR_UA = "Diren Kumaratilleke direnavk@outlook.com"


@register_adapter("edgar")
class EdgarAdapter(BaseDatasetAdapter):

    def get_meta(self) -> DatasetMeta:
        return DatasetMeta(
            dataset_id="edgar",
            display_name="SEC EDGAR",
            description="10,426 public companies with filings, XBRL financial facts, and industry relationships",
            entity_types=[
                EntityTypeConfig("company", "#00d4ff", "company_name", "ticker", ["cik", "sic", "state"]),
                EntityTypeConfig("filing", "#a371f7", "description", "form", ["date", "company_cik"]),
                EntityTypeConfig("financial_fact", "#3fb950", "concept", "value", ["unit", "period_end", "form"]),
            ],
            lookup_field="ticker",
            lookup_label="Ticker",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        """Fetch company tickers from EDGAR. For full fetch with filings/facts, use edgar_deep_pull.py."""
        req = Request(
            "https://www.sec.gov/files/company_tickers.json",
            headers={"User-Agent": EDGAR_UA, "Accept": "application/json"},
        )
        try:
            with urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return []

        entities = []
        for key, entry in list(data.items())[:limit]:
            entities.append({
                "name": f"company_{entry.get('cik_str', '')}",
                "type": "company",
                "attributes": json.dumps({
                    "cik": str(entry.get("cik_str", "")),
                    "ticker": entry.get("ticker", ""),
                    "company_name": entry.get("title", ""),
                }),
            })
        return entities

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        """Minimal edge set from entity list. Full edges require submission fetching."""
        return []

    def get_anomaly_tags(self, record: dict, scores: dict, cluster_size: int, flips: int) -> list[dict]:
        tags = []
        entity_type = record.get("type", "")
        attrs = record.get("attributes", {})

        if entity_type == "company":
            cik = attrs.get("cik", "")
            try:
                cik_int = int(cik) if cik else 0
            except (ValueError, TypeError):
                cik_int = 0

            if cik_int > 1900000:
                tags.append({
                    "tag": "RECENT_CIK",
                    "severity": "info",
                    "description": f"CIK {cik} is very recent (post-2022). Likely a SPAC, IPO, or newly formed entity.",
                })
            elif 0 < cik_int < 100000:
                tags.append({
                    "tag": "LEGACY_CIK",
                    "severity": "info",
                    "description": f"CIK {cik} dates to the early SEC era. Long-lived entity with extensive filing history.",
                })

        elif entity_type == "filing":
            form = attrs.get("form", "")
            if form in ("4", "3", "5"):
                tags.append({
                    "tag": "INSIDER_FILING",
                    "severity": "medium",
                    "description": f"Form {form} insider transaction. Structurally outlier filings often indicate unusual insider activity.",
                })
            elif form == "8-K":
                tags.append({
                    "tag": "MATERIAL_EVENT",
                    "severity": "medium",
                    "description": "Form 8-K material event filing. Structurally anomalous 8-Ks often signal significant corporate events.",
                })

        return tags

    def get_data_quality_signals(self, record: dict) -> list[str]:
        entity_type = record.get("type", "")
        attrs = record.get("attributes", {})
        signals = []

        if entity_type == "company":
            if not attrs.get("ticker"):
                signals.append("MISSING_TICKER: No ticker symbol -- may be OTC, foreign, or delisted")
            if attrs.get("cik") and not attrs.get("company_name"):
                signals.append("MISSING_NAME: Has CIK but no company name")
        elif entity_type == "filing":
            if not attrs.get("form"):
                signals.append("MISSING_FORM_TYPE: Filing without form type classification")
            if not attrs.get("date"):
                signals.append("MISSING_DATE: Filing without date stamp")
        elif entity_type == "financial_fact":
            if not attrs.get("concept"):
                signals.append("MISSING_CONCEPT: Financial fact without XBRL concept name")

        return signals if signals else ["CLEAN: All expected attributes present"]
