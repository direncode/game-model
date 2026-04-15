"""Primary Sourcing RAG Engine — fetch, chunk, and index source documents.

Pulls real primary source documents for BTUT survivors:
- SEC EDGAR: 10-K filing text, 8-K material events
- PubMed: Full abstracts, citation context
- Patents: Abstract + claims (when API available)

Documents are chunked (500 words, 100 overlap) and indexed in Elasticsearch
for BM25 retrieval. The RAGSynthesizer then uses the top-K chunks with
Claude to produce grounded analysis.

Ported from app.services.btut.rag_engine. Changes from original:
  - Removed ``from app.config import settings`` dependency.
  - ``RAGEngine.__init__`` requires an explicit ``es_url`` parameter
    (no fallback to app settings).
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

EDGAR_UA = "Diren Kumaratilleke direnavk@outlook.com"
EDGAR_BASE = "https://data.sec.gov"
PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
ES_INDEX = "btut_rag_chunks"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class RawDocument:
    source_type: str  # "10-K", "8-K", "abstract", "claims"
    source_id: str  # Accession number, PMID, patent number
    source_url: str
    text: str
    section: str = "full"
    filed_date: str = ""
    metadata: dict = field(default_factory=dict)


@dataclass
class RAGChunk:
    chunk_text: str
    source_type: str
    source_id: str
    source_url: str
    section: str
    chunk_index: int
    score: float = 0.0


@dataclass
class SourceManifest:
    entity_key: str
    dataset_id: str
    chunk_count: int = 0
    source_ids: list[str] = field(default_factory=list)
    source_types: list[str] = field(default_factory=list)
    indexed_at: str = ""
    freshness_hours: float = 0.0


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _rate_limited_get(url: str, headers: dict, delay: float = 0.11) -> str | None:
    """Rate-limited HTTP GET returning response text."""
    time.sleep(delay)
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        logger.warning("HTTP fetch failed: %s -> %s", url[:80], e)
        return None


def _edgar_get(url: str) -> str | None:
    return _rate_limited_get(url, {"User-Agent": EDGAR_UA, "Accept": "application/json"}, 0.11)


def _edgar_get_html(url: str) -> str | None:
    return _rate_limited_get(url, {"User-Agent": EDGAR_UA, "Accept": "text/html"}, 0.11)


def _pubmed_get(url: str) -> str | None:
    return _rate_limited_get(url, {"User-Agent": "LatentOcean/1.0"}, 0.35)


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_from_html(html: str) -> str:
    """Extract clean text from SEC filing HTML. Falls back to regex if BS4 unavailable."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "table", "sup", "sub"]):
            tag.decompose()
        text = soup.get_text(separator="\n")
    except ImportError:
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)

    lines = (line.strip() for line in text.splitlines())
    text = "\n".join(line for line in lines if line)

    return text[:100_000]


def chunk_document(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    """Split text into overlapping word chunks."""
    words = text.split()
    chunks = []
    start = 0

    while start < len(words) and len(chunks) < 100:
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if len(chunk) >= 50:
            chunks.append(chunk)
        start += chunk_size - overlap

    return chunks


# ---------------------------------------------------------------------------
# RAG Engine
# ---------------------------------------------------------------------------

class RAGEngine:
    """Fetch primary sources, chunk, index in Elasticsearch, and search.

    Parameters
    ----------
    es_url : str
        Elasticsearch connection URL (required -- no fallback to app settings).
    """

    def __init__(self, es_url: str):
        self._es_url = es_url
        self._es = None

    async def _get_es(self):
        """Lazy-init async Elasticsearch client."""
        if self._es is None:
            try:
                from elasticsearch import AsyncElasticsearch
                self._es = AsyncElasticsearch(self._es_url)
                await self._ensure_index()
            except Exception as e:
                logger.warning("Elasticsearch not available: %s", e)
                self._es = None
        return self._es

    async def _ensure_index(self):
        """Create the btut_rag_chunks index if it doesn't exist."""
        es = self._es
        if es is None:
            return

        try:
            exists = await es.indices.exists(index=ES_INDEX)
            if not exists:
                await es.indices.create(
                    index=ES_INDEX,
                    body={
                        "settings": {
                            "number_of_shards": 1,
                            "number_of_replicas": 0,
                            "analysis": {
                                "analyzer": {
                                    "filing_analyzer": {
                                        "type": "custom",
                                        "tokenizer": "standard",
                                        "filter": ["lowercase", "stop", "snowball"],
                                    }
                                }
                            },
                        },
                        "mappings": {
                            "properties": {
                                "entity_key": {"type": "keyword"},
                                "dataset_id": {"type": "keyword"},
                                "source_type": {"type": "keyword"},
                                "source_id": {"type": "keyword"},
                                "source_url": {"type": "keyword"},
                                "chunk_index": {"type": "integer"},
                                "chunk_text": {"type": "text", "analyzer": "filing_analyzer"},
                                "section": {"type": "keyword"},
                                "filed_date": {"type": "keyword"},
                                "indexed_at": {"type": "date"},
                            }
                        },
                    },
                )
                logger.info("Created Elasticsearch index: %s", ES_INDEX)
        except Exception as e:
            logger.warning("Failed to create ES index: %s", e)

    async def fetch_and_index(
        self,
        entity_key: str,
        dataset_id: str,
        entity_attrs: dict,
        entity_type: str,
        force_refresh: bool = False,
    ) -> SourceManifest:
        """Fetch primary sources, chunk, and index in Elasticsearch."""
        es = await self._get_es()

        if not force_refresh and es:
            manifest = await self.get_source_manifest(entity_key, dataset_id)
            if manifest and manifest.chunk_count > 0 and manifest.freshness_hours < 24:
                logger.info("Using cached sources for %s (%d chunks)", entity_key, manifest.chunk_count)
                return manifest

        documents: list[RawDocument] = []
        if dataset_id == "edgar":
            documents = self._fetch_edgar_sources(entity_key, entity_attrs, entity_type)
        elif dataset_id == "pubmed":
            documents = self._fetch_pubmed_sources(entity_key, entity_attrs, entity_type)
        else:
            attr_text = " ".join(str(v) for v in entity_attrs.values() if v)
            if attr_text:
                documents.append(RawDocument(
                    source_type="attributes", source_id=entity_key,
                    source_url="", text=attr_text,
                ))

        if not documents:
            logger.info("No sources found for %s", entity_key)
            return SourceManifest(entity_key=entity_key, dataset_id=dataset_id)

        total_chunks = 0
        source_ids = []
        source_types = []

        for doc in documents:
            chunks = chunk_document(doc.text)
            if not chunks:
                continue

            source_ids.append(doc.source_id)
            source_types.append(doc.source_type)

            if es:
                count = await self._index_chunks(
                    entity_key, dataset_id, doc, chunks,
                )
                total_chunks += count
            else:
                total_chunks += len(chunks)

        manifest = SourceManifest(
            entity_key=entity_key,
            dataset_id=dataset_id,
            chunk_count=total_chunks,
            source_ids=source_ids,
            source_types=source_types,
            indexed_at=datetime.utcnow().isoformat(),
        )

        logger.info(
            "Indexed %d chunks from %d documents for %s",
            total_chunks, len(documents), entity_key,
        )
        return manifest

    async def search_chunks(
        self,
        entity_key: str,
        dataset_id: str,
        query: str | None = None,
        top_k: int = 15,
    ) -> list[RAGChunk]:
        """Retrieve relevant chunks from Elasticsearch."""
        es = await self._get_es()
        if es is None:
            return []

        try:
            if query:
                body = {
                    "query": {
                        "bool": {
                            "must": [
                                {"match": {"chunk_text": query}},
                            ],
                            "filter": [
                                {"term": {"entity_key": entity_key}},
                                {"term": {"dataset_id": dataset_id}},
                            ],
                        }
                    },
                    "size": top_k,
                }
            else:
                body = {
                    "query": {
                        "bool": {
                            "filter": [
                                {"term": {"entity_key": entity_key}},
                                {"term": {"dataset_id": dataset_id}},
                            ],
                        }
                    },
                    "sort": [{"chunk_index": "asc"}],
                    "size": top_k,
                }

            result = await es.search(index=ES_INDEX, body=body)
            chunks = []
            for hit in result.get("hits", {}).get("hits", []):
                src = hit["_source"]
                chunks.append(RAGChunk(
                    chunk_text=src.get("chunk_text", ""),
                    source_type=src.get("source_type", ""),
                    source_id=src.get("source_id", ""),
                    source_url=src.get("source_url", ""),
                    section=src.get("section", ""),
                    chunk_index=src.get("chunk_index", 0),
                    score=hit.get("_score", 0),
                ))
            return chunks

        except Exception as e:
            logger.warning("ES search failed: %s", e)
            return []

    async def get_source_manifest(
        self, entity_key: str, dataset_id: str,
    ) -> SourceManifest | None:
        """Check if sources exist in ES for this entity."""
        es = await self._get_es()
        if es is None:
            return None

        try:
            result = await es.search(
                index=ES_INDEX,
                body={
                    "query": {
                        "bool": {
                            "filter": [
                                {"term": {"entity_key": entity_key}},
                                {"term": {"dataset_id": dataset_id}},
                            ],
                        }
                    },
                    "size": 0,
                    "aggs": {
                        "sources": {"terms": {"field": "source_id", "size": 20}},
                        "types": {"terms": {"field": "source_type", "size": 10}},
                        "latest": {"max": {"field": "indexed_at"}},
                    },
                },
            )

            total = result["hits"]["total"]["value"]
            if total == 0:
                return None

            aggs = result.get("aggregations", {})
            source_ids = [b["key"] for b in aggs.get("sources", {}).get("buckets", [])]
            source_types = [b["key"] for b in aggs.get("types", {}).get("buckets", [])]
            latest = aggs.get("latest", {}).get("value_as_string", "")

            freshness = 0.0
            if latest:
                try:
                    indexed_dt = datetime.fromisoformat(latest.replace("Z", "+00:00"))
                    freshness = (datetime.utcnow() - indexed_dt.replace(tzinfo=None)).total_seconds() / 3600
                except Exception:
                    pass

            return SourceManifest(
                entity_key=entity_key,
                dataset_id=dataset_id,
                chunk_count=total,
                source_ids=source_ids,
                source_types=source_types,
                indexed_at=latest,
                freshness_hours=freshness,
            )

        except Exception as e:
            logger.warning("ES manifest check failed: %s", e)
            return None

    # ------------------------------------------------------------------
    # Private: Elasticsearch indexing
    # ------------------------------------------------------------------

    async def _index_chunks(
        self,
        entity_key: str,
        dataset_id: str,
        doc: RawDocument,
        chunks: list[str],
    ) -> int:
        """Bulk-index chunks into Elasticsearch."""
        es = await self._get_es()
        if es is None:
            return 0

        now = datetime.utcnow().isoformat()
        actions = []

        for i, chunk_text in enumerate(chunks):
            actions.append({
                "entity_key": entity_key,
                "dataset_id": dataset_id,
                "source_type": doc.source_type,
                "source_id": doc.source_id,
                "source_url": doc.source_url,
                "chunk_index": i,
                "chunk_text": chunk_text,
                "section": doc.section,
                "filed_date": doc.filed_date,
                "indexed_at": now,
            })

        try:
            from elasticsearch.helpers import async_bulk

            await es.delete_by_query(
                index=ES_INDEX,
                body={
                    "query": {
                        "bool": {
                            "filter": [
                                {"term": {"entity_key": entity_key}},
                                {"term": {"source_id": doc.source_id}},
                            ]
                        }
                    }
                },
                ignore=[404],
            )

            success, errors = await async_bulk(
                es,
                [{"_index": ES_INDEX, "_source": a} for a in actions],
            )
            return success

        except Exception as e:
            logger.warning("ES bulk index failed: %s", e)
            return 0

    # ------------------------------------------------------------------
    # Private: Source fetchers
    # ------------------------------------------------------------------

    def _fetch_edgar_sources(
        self, entity_key: str, attrs: dict, entity_type: str,
    ) -> list[RawDocument]:
        """Fetch SEC EDGAR filing text for a company or filing entity."""
        documents = []
        cik = attrs.get("cik", "")
        if not cik and entity_type == "financial_fact":
            cik = attrs.get("company_cik", "")

        if not cik:
            return documents

        padded = str(cik).zfill(10)

        subs_raw = _edgar_get(f"{EDGAR_BASE}/submissions/CIK{padded}.json")
        if not subs_raw:
            return documents

        try:
            subs = json.loads(subs_raw) if isinstance(subs_raw, str) else subs_raw
        except (json.JSONDecodeError, TypeError):
            return documents

        recent = subs.get("filings", {}).get("recent", {})
        accessions = recent.get("accessionNumber", [])
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        primary_docs = recent.get("primaryDocument", [])

        ten_k_found = False
        eight_k_count = 0

        for i in range(min(len(accessions), 50)):
            form = forms[i] if i < len(forms) else ""
            accession = accessions[i]
            date = dates[i] if i < len(dates) else ""
            primary_doc = primary_docs[i] if i < len(primary_docs) else ""

            if form == "10-K" and not ten_k_found:
                doc = self._fetch_filing_text(cik, accession, primary_doc, form, date)
                if doc:
                    documents.append(doc)
                    ten_k_found = True

            elif form == "8-K" and eight_k_count < 2:
                doc = self._fetch_filing_text(cik, accession, primary_doc, form, date)
                if doc:
                    documents.append(doc)
                    eight_k_count += 1

            if ten_k_found and eight_k_count >= 2:
                break

        return documents

    def _fetch_filing_text(
        self, cik: str, accession: str, primary_doc: str, form: str, date: str,
    ) -> RawDocument | None:
        """Fetch and extract text from a specific SEC filing."""
        if not primary_doc:
            return None

        accession_nodash = accession.replace("-", "")
        url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_nodash}/{primary_doc}"

        html = _edgar_get_html(url)
        if not html or len(html) < 500:
            return None

        text = extract_text_from_html(html)
        if len(text) < 200:
            return None

        return RawDocument(
            source_type=form,
            source_id=accession,
            source_url=url,
            text=text,
            section="full",
            filed_date=date,
            metadata={"cik": cik, "primary_doc": primary_doc},
        )

    def _fetch_pubmed_sources(
        self, entity_key: str, attrs: dict, entity_type: str,
    ) -> list[RawDocument]:
        """Fetch PubMed abstract text."""
        documents = []
        pmid = attrs.get("pmid", "")

        if entity_type == "paper" and pmid:
            xml = _pubmed_get(f"{PUBMED_BASE}/efetch.fcgi?db=pubmed&id={pmid}&retmode=xml")
            if xml:
                try:
                    import xml.etree.ElementTree as ET
                    root = ET.fromstring(xml)
                    abstract_el = root.find(".//AbstractText")
                    title_el = root.find(".//ArticleTitle")

                    title = title_el.text if title_el is not None and title_el.text else ""
                    abstract = abstract_el.text if abstract_el is not None and abstract_el.text else ""

                    if title or abstract:
                        documents.append(RawDocument(
                            source_type="abstract",
                            source_id=pmid,
                            source_url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                            text=f"{title}\n\n{abstract}",
                            section="abstract",
                        ))
                except Exception:
                    pass

        elif entity_type == "author":
            author_name = attrs.get("author_name", "")
            if author_name:
                search_url = f"{PUBMED_BASE}/esearch.fcgi?db=pubmed&retmax=5&term={author_name}[Author]&retmode=json"
                search_raw = _pubmed_get(search_url)
                if search_raw:
                    try:
                        import xml.etree.ElementTree as ET
                        pmids = json.loads(search_raw).get("esearchresult", {}).get("idlist", [])
                        if pmids:
                            ids = ",".join(pmids[:5])
                            xml = _pubmed_get(f"{PUBMED_BASE}/efetch.fcgi?db=pubmed&id={ids}&retmode=xml")
                            if xml:
                                root = ET.fromstring(xml)
                                for article in root.findall(".//PubmedArticle")[:3]:
                                    title_el = article.find(".//ArticleTitle")
                                    abstract_el = article.find(".//AbstractText")
                                    pmid_el = article.find(".//PMID")
                                    if title_el is not None and title_el.text:
                                        documents.append(RawDocument(
                                            source_type="abstract",
                                            source_id=pmid_el.text if pmid_el is not None else "",
                                            source_url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid_el.text}/" if pmid_el is not None else "",
                                            text=f"{title_el.text}\n\n{abstract_el.text if abstract_el is not None and abstract_el.text else ''}",
                                            section="abstract",
                                        ))
                    except Exception:
                        pass

        return documents
