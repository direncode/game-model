"""SEC EDGAR dataset adapter — companies, filings, XBRL financial facts.

Deep pull: fetches submissions (filings) and companyfacts (XBRL) for
each company, creating a rich heterogeneous entity graph.
Rate limited at 10 req/sec per EDGAR policy.
"""

from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from urllib.request import Request, urlopen

from . import register_adapter
from .base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

logger = logging.getLogger(__name__)

EDGAR_UA = "Diren Kumaratilleke direnavk@outlook.com"
EDGAR_BASE = "https://data.sec.gov"
REQUEST_DELAY = 0.105  # Just under 10 req/sec


def _edgar_get(url: str) -> dict | None:
    """Rate-limited EDGAR API request."""
    time.sleep(REQUEST_DELAY)
    req = Request(url, headers={
        "User-Agent": EDGAR_UA,
        "Accept": "application/json",
    })
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


@register_adapter("edgar")
class EdgarAdapter(BaseDatasetAdapter):

    def get_meta(self) -> DatasetMeta:
        return DatasetMeta(
            dataset_id="edgar",
            display_name="SEC EDGAR",
            description="All 10,426 public companies with filings, XBRL financial facts, and industry relationships",
            entity_types=[
                EntityTypeConfig("company", "#00d4ff", "company_name", "ticker", ["cik", "sic", "state"]),
                EntityTypeConfig("filing", "#a371f7", "description", "form", ["date", "company_cik"]),
                EntityTypeConfig("financial_fact", "#3fb950", "concept", "value", ["unit", "period_end", "form"]),
            ],
            lookup_field="ticker",
            lookup_label="Ticker",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        """Full deep pull: tickers + submissions (filings) + XBRL facts.

        At limit > 10,426: fetches filings and XBRL for companies.
        At limit <= 10,426: just the tickers list.
        """
        # Step 1: Get all company tickers (instant, 1 API call)
        req = Request(
            "https://www.sec.gov/files/company_tickers.json",
            headers={"User-Agent": EDGAR_UA, "Accept": "application/json"},
        )
        try:
            with urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return []

        companies = []
        for key, entry in data.items():
            companies.append({
                "cik": str(entry.get("cik_str", "")),
                "ticker": entry.get("ticker", ""),
                "name": entry.get("title", ""),
            })

        entities = []
        edges_data = {"sic_groups": defaultdict(list)}

        # Company entities (all of them)
        for comp in companies:
            entities.append({
                "name": f"company_{comp['cik']}",
                "type": "company",
                "attributes": json.dumps({
                    "cik": comp["cik"],
                    "ticker": comp["ticker"],
                    "company_name": comp["name"],
                }),
            })

        # If limit > tickers count, do deep pull for filings + XBRL
        if limit > len(companies):
            # Determine how many companies to deep-pull
            # Budget: (limit - len(companies)) entities to fill with filings + facts
            # Average ~30 entities per company (20 filings + 10 facts)
            n_deep = min(len(companies), (limit - len(companies)) // 30 + 1)

            # Decide how many get XBRL (first half) vs filings-only (second half)
            n_xbrl = min(n_deep, n_deep // 2 + 1)

            logger.info(
                "EDGAR deep pull: %d companies total, %d deep (%d with XBRL)",
                len(companies), n_deep, n_xbrl,
            )

            for i, comp in enumerate(companies[:n_deep]):
                fetch_xbrl = (i < n_xbrl)
                new_ents, sic = self._fetch_company_detail(
                    comp, filings_per_company=20, fetch_xbrl=fetch_xbrl,
                )
                entities.extend(new_ents)

                if sic:
                    edges_data["sic_groups"][sic].append(f"company_{comp['cik']}")

                if i % 200 == 0 and i > 0:
                    logger.info(
                        "EDGAR deep pull: %d/%d companies, %d entities so far",
                        i, n_deep, len(entities),
                    )

                if len(entities) >= limit:
                    break

        # Store edges data for fetch_edges
        self._edges_data = edges_data

        return entities[:limit]

    def _fetch_company_detail(
        self, comp: dict, filings_per_company: int = 20, fetch_xbrl: bool = True,
    ) -> tuple[list[dict], str]:
        """Fetch filings + XBRL facts for one company. Returns (entities, sic_code)."""
        entities = []
        cik = comp["cik"]
        padded = cik.zfill(10)
        sic = ""

        # Fetch submissions (filing metadata)
        submissions = _edgar_get(f"{EDGAR_BASE}/submissions/CIK{padded}.json")
        if submissions:
            sic = submissions.get("sic", "")

            # Update company attributes with submission metadata
            # (Not modifying the company entity — enrichment happens in query engine)

            recent = submissions.get("filings", {}).get("recent", {})
            accessions = recent.get("accessionNumber", [])[:filings_per_company]
            forms = recent.get("form", [])[:filings_per_company]
            dates = recent.get("filingDate", [])[:filings_per_company]
            descriptions = recent.get("primaryDocDescription", [])[:filings_per_company]

            prev_filing = None
            for j in range(len(accessions)):
                filing_name = f"filing_{accessions[j].replace('-', '')}"
                entities.append({
                    "name": filing_name,
                    "type": "filing",
                    "attributes": json.dumps({
                        "accession": accessions[j],
                        "form": forms[j] if j < len(forms) else "",
                        "date": dates[j] if j < len(dates) else "",
                        "description": descriptions[j] if j < len(descriptions) else "",
                        "company_cik": cik,
                        "company_name": comp["name"],
                    }),
                })

        # Fetch XBRL facts
        if fetch_xbrl:
            facts = _edgar_get(f"{EDGAR_BASE}/api/xbrl/companyfacts/CIK{padded}.json")
            if facts:
                us_gaap = facts.get("facts", {}).get("us-gaap", {})
                for concept, concept_data in list(us_gaap.items())[:30]:
                    units = concept_data.get("units", {})
                    usd_values = units.get("USD", [])
                    if not usd_values:
                        continue
                    latest = usd_values[-1]
                    val = latest.get("val")
                    if val is None:
                        continue

                    entities.append({
                        "name": f"fact_{cik}_{concept}",
                        "type": "financial_fact",
                        "attributes": json.dumps({
                            "concept": concept,
                            "value": val,
                            "unit": "USD",
                            "period_end": latest.get("end", ""),
                            "form": latest.get("form", ""),
                            "company_cik": cik,
                            "filed": latest.get("filed", ""),
                            "label": concept_data.get("label", concept),
                        }),
                    })

        return entities, sic

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        """Build edges: filed_by, temporal_neighbor, same_sic, shared_concept."""
        edges = []

        # Filing -> company edges
        company_names = {json.loads(e["attributes"]).get("cik", ""): e["name"]
                         for e in entities if e["type"] == "company"}

        prev_filing_by_company: dict[str, str] = {}
        for e in entities:
            if e["type"] == "filing":
                attrs = json.loads(e["attributes"])
                cik = attrs.get("company_cik", "")
                if cik in company_names:
                    edges.append({
                        "source": e["name"], "target": company_names[cik],
                        "type": "filed_by", "weight": 1.0,
                    })
                # Temporal neighbor
                if cik in prev_filing_by_company:
                    edges.append({
                        "source": prev_filing_by_company[cik], "target": e["name"],
                        "type": "temporal_neighbor", "weight": 0.8,
                    })
                prev_filing_by_company[cik] = e["name"]

            elif e["type"] == "financial_fact":
                attrs = json.loads(e["attributes"])
                cik = attrs.get("company_cik", "")
                if cik in company_names:
                    edges.append({
                        "source": company_names[cik], "target": e["name"],
                        "type": "reports_fact", "weight": 0.9,
                    })

        # SIC industry edges
        sic_groups = getattr(self, "_edges_data", {}).get("sic_groups", {})
        for sic, members in sic_groups.items():
            for i in range(min(len(members), 30)):
                for j in range(i + 1, min(len(members), 30)):
                    edges.append({
                        "source": members[i], "target": members[j],
                        "type": "same_sic", "weight": 0.7,
                    })

        # Shared XBRL concept edges
        concept_companies: dict[str, list[str]] = defaultdict(list)
        for e in entities:
            if e["type"] == "financial_fact":
                attrs = json.loads(e["attributes"])
                concept = attrs.get("concept", "")
                cik = attrs.get("company_cik", "")
                if concept and cik and cik in company_names:
                    concept_companies[concept].append(company_names[cik])

        for concept, members in concept_companies.items():
            unique = list(set(members))
            for i in range(min(len(unique), 20)):
                for j in range(i + 1, min(len(unique), 20)):
                    edges.append({
                        "source": unique[i], "target": unique[j],
                        "type": "shared_concept", "weight": 0.5,
                    })

        return edges

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
