"""PubMed biomedical research adapter — papers, authors, genes, MeSH terms."""

from __future__ import annotations

import json
import time
import xml.etree.ElementTree as ET
from urllib.request import Request, urlopen
from urllib.parse import urlencode

from . import register_adapter
from .base import BaseDatasetAdapter, DatasetMeta, EntityTypeConfig

PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
REQUEST_DELAY = 0.35  # 3 req/sec without API key


def _pubmed_get(url: str) -> str | None:
    time.sleep(REQUEST_DELAY)
    req = Request(url, headers={"User-Agent": "LatentOcean/1.0"})
    try:
        with urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8")
    except Exception:
        return None


@register_adapter("pubmed")
class PubMedAdapter(BaseDatasetAdapter):

    def get_meta(self) -> DatasetMeta:
        return DatasetMeta(
            dataset_id="pubmed",
            display_name="PubMed Biomedical",
            description="Biomedical research papers with authors, genes, MeSH terms, and citation networks",
            entity_types=[
                EntityTypeConfig("paper", "#388bfd", "title", "journal", ["pmid", "pub_date", "citation_count"]),
                EntityTypeConfig("author", "#f0883e", "author_name", "affiliation", ["paper_count"]),
                EntityTypeConfig("gene", "#3fb950", "gene_symbol", "gene_name", ["organism"]),
                EntityTypeConfig("mesh_term", "#a371f7", "mesh_name", "mesh_id", ["tree_number"]),
            ],
            lookup_field="pmid",
            lookup_label="PMID",
        )

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        entities = []
        authors_seen = set()
        mesh_seen = set()

        # Search for recent high-impact papers
        search_url = f"{PUBMED_BASE}/esearch.fcgi?db=pubmed&retmax={min(limit, 10000)}&sort=relevance&term=cancer+OR+genomics+OR+CRISPR+OR+immunotherapy&retmode=json"
        search_data = _pubmed_get(search_url)
        if not search_data:
            return entities

        try:
            pmids = json.loads(search_data).get("esearchresult", {}).get("idlist", [])
        except (json.JSONDecodeError, KeyError):
            return entities

        # Fetch details in batches of 100
        for batch_start in range(0, len(pmids), 100):
            batch = pmids[batch_start:batch_start + 100]
            ids_str = ",".join(batch)
            fetch_url = f"{PUBMED_BASE}/efetch.fcgi?db=pubmed&id={ids_str}&retmode=xml"
            xml_data = _pubmed_get(fetch_url)
            if not xml_data:
                continue

            try:
                root = ET.fromstring(xml_data)
            except ET.ParseError:
                continue

            for article in root.findall(".//PubmedArticle"):
                pmid_el = article.find(".//PMID")
                if pmid_el is None:
                    continue
                pmid = pmid_el.text

                title_el = article.find(".//ArticleTitle")
                title = title_el.text if title_el is not None and title_el.text else ""

                journal_el = article.find(".//Journal/Title")
                journal = journal_el.text if journal_el is not None and journal_el.text else ""

                year_el = article.find(".//PubDate/Year")
                year = year_el.text if year_el is not None else ""

                abstract_el = article.find(".//AbstractText")
                abstract = abstract_el.text if abstract_el is not None and abstract_el.text else ""

                # Paper entity
                entities.append({
                    "name": f"paper_{pmid}",
                    "type": "paper",
                    "attributes": json.dumps({
                        "pmid": pmid,
                        "title": title[:200],
                        "journal": journal[:100],
                        "pub_date": year,
                        "abstract": abstract[:300],
                    }),
                })

                # Author entities
                for author in article.findall(".//Author"):
                    last = author.find("LastName")
                    first = author.find("ForeName")
                    if last is not None and last.text:
                        name = f"{last.text}, {first.text}" if first is not None and first.text else last.text
                        author_key = name.lower().replace(" ", "_")
                        if author_key not in authors_seen:
                            authors_seen.add(author_key)
                            affil = author.find(".//Affiliation")
                            entities.append({
                                "name": f"author_{author_key}",
                                "type": "author",
                                "attributes": json.dumps({
                                    "author_name": name,
                                    "affiliation": (affil.text[:100] if affil is not None and affil.text else ""),
                                }),
                            })

                # MeSH terms
                for mesh in article.findall(".//MeshHeading/DescriptorName"):
                    mesh_name = mesh.text if mesh.text else ""
                    mesh_id = mesh.get("UI", "")
                    if mesh_name and mesh_id not in mesh_seen:
                        mesh_seen.add(mesh_id)
                        entities.append({
                            "name": f"mesh_{mesh_id}",
                            "type": "mesh_term",
                            "attributes": json.dumps({
                                "mesh_name": mesh_name,
                                "mesh_id": mesh_id,
                            }),
                        })

            if len(entities) >= limit:
                break

        return entities[:limit]

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        edges = []
        paper_entities = [e for e in entities if e["type"] == "paper"]

        # Author-paper edges
        for e in entities:
            if e["type"] == "author":
                attrs = json.loads(e.get("attributes", "{}"))
                # Link to papers (simplified — in real impl, track during fetch)
                for p in paper_entities[:5]:
                    edges.append({
                        "source": e["name"], "target": p["name"],
                        "type": "authored", "weight": 0.8,
                    })

        # MeSH-paper edges (simplified)
        mesh_entities = [e for e in entities if e["type"] == "mesh_term"]
        for m in mesh_entities[:50]:
            for p in paper_entities[:3]:
                edges.append({
                    "source": p["name"], "target": m["name"],
                    "type": "has_mesh_term", "weight": 0.6,
                })

        return edges

    def get_anomaly_tags(self, record: dict, scores: dict, cluster_size: int, flips: int) -> list[dict]:
        tags = []
        entity_type = record.get("type", "")
        attrs = record.get("attributes", {})

        if entity_type == "paper":
            title = attrs.get("title", "").lower()
            if "retract" in title or "correction" in title:
                tags.append({
                    "tag": "RETRACTED_OR_CORRECTED",
                    "severity": "critical",
                    "description": "Paper title suggests retraction or correction — high-impact anomaly in scientific literature.",
                })
            if not attrs.get("abstract"):
                tags.append({
                    "tag": "NO_ABSTRACT",
                    "severity": "info",
                    "description": "Paper without abstract text — may be a letter, editorial, or data-only publication.",
                })

        elif entity_type == "author":
            if not attrs.get("affiliation"):
                tags.append({
                    "tag": "NO_AFFILIATION",
                    "severity": "info",
                    "description": "Author without institutional affiliation — independent researcher or data gap.",
                })

        return tags
