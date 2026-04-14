"""Hugging Face Hub integration — search, preview, and import datasets.

Uses the HF API for search/metadata and the `datasets` library for downloads.
Converts tabular HF datasets into ParsedGraph objects for the AwakeningPipeline.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.neo4j import Neo4jConnection
from app.models.dataset import Dataset
from app.services.hub.schema_mapper import SchemaMapper
from app.services.ingestion.awakening_pipeline import AwakeningPipeline
from app.services.ingestion.csv_adapter import ParsedEntity, ParsedGraph, ParsedRelationship

logger = logging.getLogger(__name__)

HF_API_BASE = "https://huggingface.co/api"

# ─── Featured datasets curated for TCD-JEPA ─────────────────────────────────

FEATURED_DATASETS = [
    # Finance (rich tabular data with many entities)
    {
        "id": "financial_phrasebank",
        "name": "Financial PhraseBank",
        "description": "4,840 financial news sentences with sentiment labels. Rich entity extraction for financial graphs.",
        "tags": ["finance", "sentiment-analysis"],
        "category": "Finance",
    },
    {
        "id": "zeroshot/twitter-financial-news-sentiment",
        "name": "Twitter Financial News",
        "description": "11,932 financial tweets with sentiment. Company mentions, market events, entity relationships.",
        "tags": ["finance", "twitter", "sentiment"],
        "category": "Finance",
    },
    # Scientific (citation networks, papers)
    {
        "id": "cora",
        "name": "Cora Citation Network",
        "description": "2,708 papers with 5,429 citation links across 7 classes. Classic graph dataset.",
        "tags": ["graph", "citation-network", "node-classification"],
        "category": "Scientific",
    },
    {
        "id": "citation_intent",
        "name": "Citation Intent",
        "description": "1,969 citation sentences with intent labels. Academic relationship discovery.",
        "tags": ["text-classification", "citations", "graph"],
        "category": "Scientific",
    },
    {
        "id": "sciQ",
        "name": "SciQ Science QA",
        "description": "13,679 science exam questions with support text. Entity-rich scientific knowledge.",
        "tags": ["science", "question-answering"],
        "category": "Scientific",
    },
    # Healthcare
    {
        "id": "medical_questions_pairs",
        "name": "Medical Question Pairs",
        "description": "3,048 medical question pairs with similarity labels. Healthcare entity relationships.",
        "tags": ["healthcare", "medical", "similarity"],
        "category": "Healthcare",
    },
    {
        "id": "health_fact",
        "name": "Health Fact Checking",
        "description": "12,288 health claims with veracity labels. Medical misinformation entity graphs.",
        "tags": ["healthcare", "fact-checking"],
        "category": "Healthcare",
    },
    # NLP / Text
    {
        "id": "ag_news",
        "name": "AG News",
        "description": "120,000 news articles across 4 categories. Massive entity extraction for news graphs.",
        "tags": ["text-classification", "news"],
        "category": "NLP",
    },
    {
        "id": "conll2003",
        "name": "CoNLL-2003 NER",
        "description": "22,137 sentences with named entity annotations (PER, ORG, LOC, MISC). Pre-tagged entities.",
        "tags": ["ner", "named-entity-recognition"],
        "category": "NLP",
    },
    {
        "id": "SetFit/20_newsgroups",
        "name": "20 Newsgroups",
        "description": "18,846 newsgroup posts across 20 topics. Rich for topic-based entity clustering.",
        "tags": ["text-classification", "topic-modeling"],
        "category": "NLP",
    },
    # Social Networks
    {
        "id": "tweets_hate_speech_detection",
        "name": "Hate Speech Detection",
        "description": "31,962 tweets with hate speech labels. Social network entity patterns.",
        "tags": ["social-media", "text-classification"],
        "category": "Social Networks",
    },
    {
        "id": "amazon_polarity",
        "name": "Amazon Reviews",
        "description": "3.6M Amazon reviews with polarity. Product/reviewer entity relationships at scale.",
        "tags": ["sentiment", "reviews", "commerce"],
        "category": "Social Networks",
    },
    # Government / Legal
    {
        "id": "lex_glue",
        "name": "LexGLUE Legal",
        "description": "Legal document classification across multiple courts. Entity-rich legal graphs.",
        "tags": ["legal", "text-classification"],
        "category": "Government",
    },
]

# Minimum entities required for meaningful crystallization
MIN_ENTITIES_FOR_IMPORT = 50

CATEGORIES = [
    {"name": "Finance", "tags": ["finance", "financial", "stock", "trading", "economics"]},
    {"name": "Healthcare", "tags": ["healthcare", "medical", "biomedical", "clinical", "health"]},
    {"name": "Social Networks", "tags": ["social", "network", "graph", "twitter", "reddit"]},
    {"name": "NLP", "tags": ["text", "nlp", "language", "sentiment", "ner"]},
    {"name": "Supply Chain", "tags": ["supply-chain", "logistics", "manufacturing", "procurement"]},
    {"name": "Government", "tags": ["government", "policy", "legal", "regulation", "public"]},
    {"name": "Scientific", "tags": ["science", "research", "citation", "academic", "biology"]},
    {"name": "Computer Vision", "tags": ["image", "vision", "object-detection", "segmentation"]},
]


# ─── Search & Metadata ───────────────────────────────────────────────────────

async def search_datasets(
    query: str,
    limit: int = 20,
    offset: int = 0,
    category: str | None = None,
) -> list[dict[str, Any]]:
    """Search Hugging Face datasets by keyword and optional category tag."""
    params: dict[str, Any] = {
        "search": query,
        "limit": limit,
        "offset": offset,
        "sort": "downloads",
        "direction": -1,
    }

    # If category specified, find matching tags and add as filter
    if category:
        cat_tags = next((c["tags"] for c in CATEGORIES if c["name"] == category), None)
        if cat_tags:
            params["search"] = f"{query} {cat_tags[0]}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{HF_API_BASE}/datasets", params=params)
        resp.raise_for_status()
        raw = resp.json()

    results = []
    for item in raw:
        results.append({
            "id": item.get("id", ""),
            "name": item.get("id", "").split("/")[-1],
            "author": item.get("author", ""),
            "description": item.get("description", "") or item.get("cardData", {}).get("description", ""),
            "downloads": item.get("downloads", 0),
            "likes": item.get("likes", 0),
            "tags": item.get("tags", []),
            "last_modified": item.get("lastModified", ""),
        })

    return results


async def get_dataset_info(dataset_id: str) -> dict[str, Any]:
    """Get detailed information about a specific HF dataset."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{HF_API_BASE}/datasets/{dataset_id}")
        resp.raise_for_status()
        info = resp.json()

    # Try to get the first available config and split info
    configs = []
    splits = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            split_resp = await client.get(
                f"https://datasets-server.huggingface.co/splits",
                params={"dataset": dataset_id},
            )
            if split_resp.status_code == 200:
                split_data = split_resp.json()
                for s in split_data.get("splits", []):
                    config = s.get("config", "default")
                    split_name = s.get("split", "train")
                    if config not in configs:
                        configs.append(config)
                    if split_name not in splits:
                        splits.append(split_name)
    except Exception:
        configs = ["default"]
        splits = ["train"]

    # Try to get column info from first rows
    columns = []
    sample_rows = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            rows_resp = await client.get(
                f"https://datasets-server.huggingface.co/first-rows",
                params={
                    "dataset": dataset_id,
                    "config": configs[0] if configs else "default",
                    "split": splits[0] if splits else "train",
                },
            )
            if rows_resp.status_code == 200:
                rows_data = rows_resp.json()
                for feat in rows_data.get("features", []):
                    columns.append({
                        "name": feat.get("column", {}).get("name", feat.get("name", "")),
                        "type": feat.get("column", {}).get("type", feat.get("type", "unknown")),
                    })
                for row in rows_data.get("rows", [])[:5]:
                    sample_rows.append(row.get("row", row))
    except Exception:
        pass

    return {
        "id": info.get("id", dataset_id),
        "name": info.get("id", dataset_id).split("/")[-1],
        "author": info.get("author", ""),
        "description": info.get("description", ""),
        "downloads": info.get("downloads", 0),
        "likes": info.get("likes", 0),
        "tags": info.get("tags", []),
        "configs": configs,
        "splits": splits,
        "columns": columns,
        "sample_rows": sample_rows[:5],
        "last_modified": info.get("lastModified", ""),
    }


def get_featured() -> list[dict[str, Any]]:
    """Return curated featured datasets for TCD-JEPA."""
    return FEATURED_DATASETS


def get_categories() -> list[dict[str, str | list[str]]]:
    """Return available dataset categories with their HF tag mappings."""
    return CATEGORIES


# ─── Import Pipeline ─────────────────────────────────────────────────────────

async def import_dataset(
    hf_dataset_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
    neo4j: Neo4jConnection,
    minio_client: Any | None = None,
    name: str | None = None,
    config: str | None = None,
    split: str | None = None,
    max_rows: int = 10000,
) -> dict[str, Any]:
    """Import a Hugging Face dataset into the platform.

    1. Download via the `datasets` library
    2. Auto-detect schema mapping
    3. Convert to ParsedGraph
    4. Create Dataset record in PostgreSQL
    5. Run AwakeningPipeline for Neo4j ingestion + profiling

    Returns:
        Dict with dataset_id and import summary.
    """
    logger.info("Importing HF dataset: %s (config=%s, split=%s)", hf_dataset_id, config, split)

    # Step 1: Download dataset
    from datasets import load_dataset

    load_kwargs: dict[str, Any] = {"path": hf_dataset_id}
    if config:
        load_kwargs["name"] = config
    if split:
        load_kwargs["split"] = split
    else:
        load_kwargs["split"] = "train"

    hf_ds = None
    try:
        hf_ds = load_dataset(**load_kwargs)
    except Exception as e:
        err_str = str(e)
        # If split not found, try to auto-detect available splits
        if "Unknown split" in err_str and not split:
            logger.info("Split 'train' not found for %s, auto-detecting...", hf_dataset_id)
            try:
                from datasets import get_dataset_split_names
                available_splits = get_dataset_split_names(
                    hf_dataset_id, config_name=config,
                )
                if available_splits:
                    fallback_split = available_splits[0]
                    logger.info("Using fallback split '%s' for %s", fallback_split, hf_dataset_id)
                    load_kwargs["split"] = fallback_split
                    hf_ds = load_dataset(**load_kwargs)
                else:
                    raise
            except ImportError:
                # Older datasets library — try common split names
                for fallback in ["test", "validation", "dev"]:
                    try:
                        load_kwargs["split"] = fallback
                        hf_ds = load_dataset(**load_kwargs)
                        logger.info("Using fallback split '%s' for %s", fallback, hf_dataset_id)
                        break
                    except Exception:
                        continue
                else:
                    raise ValueError(f"Failed to download dataset '{hf_dataset_id}': {e}") from e
        # If config/subset is required, try the dataset ID as config name
        elif "Config name is missing" in err_str or "specify a configuration" in err_str.lower():
            logger.info("Config required for %s, trying dataset name as config...", hf_dataset_id)
            base_name = hf_dataset_id.split("/")[-1]
            load_kwargs["name"] = base_name
            try:
                hf_ds = load_dataset(**load_kwargs)
            except Exception:
                # Try 'default' config
                load_kwargs["name"] = "default"
                try:
                    hf_ds = load_dataset(**load_kwargs)
                except Exception:
                    raise ValueError(f"Failed to download dataset '{hf_dataset_id}': {e}") from e
        else:
            logger.error("Failed to download HF dataset %s: %s", hf_dataset_id, e)
            raise ValueError(f"Failed to download dataset '{hf_dataset_id}': {e}") from e

    if hf_ds is None:
        raise ValueError(f"Failed to load dataset '{hf_dataset_id}': no data returned")

    # Convert to pandas DataFrame
    df = hf_ds.to_pandas()
    if len(df) > max_rows:
        logger.info("Truncating dataset from %d to %d rows", len(df), max_rows)
        df = df.head(max_rows)

    # Drop columns with unhashable types (images, dicts, lists, bytes)
    drop_cols = []
    for col in df.columns:
        try:
            sample = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else None
            if sample is not None and isinstance(sample, (dict, list, bytes, bytearray)):
                drop_cols.append(col)
            elif sample is not None and hasattr(sample, "mode"):  # PIL Image
                drop_cols.append(col)
        except Exception:
            drop_cols.append(col)

    if drop_cols:
        logger.info("Dropping non-serializable columns: %s", drop_cols)
        df = df.drop(columns=drop_cols)

    if df.empty or len(df.columns) == 0:
        raise ValueError(
            f"Dataset '{hf_dataset_id}' has no usable columns after removing "
            f"images/binary data. Dropped: {drop_cols}"
        )

    # Step 2: Auto-detect schema
    mapper = SchemaMapper()
    schema = mapper.detect(df)

    # Step 3: Convert to ParsedGraph
    graph = _dataframe_to_graph(df, schema)

    if not graph.entities:
        raise ValueError(
            f"No entities could be extracted from '{hf_dataset_id}'. "
            "The dataset may not have suitable columns for graph conversion."
        )

    if len(graph.entities) < MIN_ENTITIES_FOR_IMPORT:
        raise ValueError(
            f"Dataset '{hf_dataset_id}' produced only {len(graph.entities)} entities "
            f"(minimum {MIN_ENTITIES_FOR_IMPORT} required for meaningful crystallization). "
            "Try a larger dataset or adjust max_rows."
        )

    # Step 4: Create Dataset record
    dataset_name = name or hf_dataset_id.split("/")[-1].replace("-", " ").title()
    dataset = Dataset(
        name=dataset_name,
        description=f"Imported from Hugging Face: {hf_dataset_id}",
        owner_id=user_id,
        status="profiling",
    )
    db.add(dataset)
    await db.flush()
    await db.refresh(dataset)

    # Step 5: Convert graph to JSON bytes (preserves entity types + attributes)
    json_bytes = _graph_to_json_bytes(graph)
    pipeline = AwakeningPipeline(db=db, neo4j=neo4j, minio_client=minio_client)

    result = await pipeline.run(
        dataset_id=dataset.id,
        user_id=user_id,
        file_content=json_bytes,
        file_name=f"{hf_dataset_id.replace('/', '_')}.json",
        content_type="json",
    )

    logger.info(
        "HF dataset '%s' imported as dataset_id=%s: %d entities, %d relationships",
        hf_dataset_id,
        dataset.id,
        len(graph.entities),
        len(graph.relationships),
    )

    # Step 6: Auto-trigger crystallization
    job_id = None
    if result.get("status") == "ready":
        try:
            from app.models.crystallization import CrystallizationJob
            from app.celery_app import celery_app

            job = CrystallizationJob(
                dataset_id=dataset.id,
                status="queued",
                config={},
                created_by=user_id,
            )
            db.add(job)
            await db.flush()
            job_id = str(job.id)

            celery_app.send_task(
                "crystallization.run",
                args=[job_id],
                queue="crystallization",
            )
            logger.info("Auto-triggered crystallization job=%s for HF dataset '%s'", job_id, hf_dataset_id)
        except Exception:
            logger.warning("Could not auto-trigger crystallization for %s", hf_dataset_id, exc_info=True)

    return {
        "dataset_id": str(dataset.id),
        "dataset_name": dataset_name,
        "hf_dataset_id": hf_dataset_id,
        "entity_count": len(graph.entities),
        "relationship_count": len(graph.relationships),
        "status": result.get("status", "ready"),
        "job_id": job_id,
    }


def _dataframe_to_graph(df: pd.DataFrame, schema) -> ParsedGraph:
    """Convert a DataFrame to a ParsedGraph using the detected schema mapping."""
    entities: dict[str, ParsedEntity] = {}
    relationships: list[ParsedRelationship] = []

    if schema.is_edge_list:
        # Edge list: source and target columns directly form the graph
        src_col = schema.source_column
        tgt_col = schema.target_column
        type_col = schema.relationship_type_column
        entity_type_col = schema.entity_type_column

        for _, row in df.iterrows():
            src = str(row.get(src_col, "")).strip()
            tgt = str(row.get(tgt_col, "")).strip()
            if not src or not tgt:
                continue

            etype = str(row.get(entity_type_col, "")) if entity_type_col else None
            if src not in entities:
                entities[src] = ParsedEntity(name=src, entity_type=etype, attributes={})
            if tgt not in entities:
                entities[tgt] = ParsedEntity(name=tgt, entity_type=etype, attributes={})

            rel_type = str(row.get(type_col, "related_to")) if type_col else "related_to"
            weight = 1.0
            if schema.weight_column:
                try:
                    weight = float(row.get(schema.weight_column, 1.0))
                except (ValueError, TypeError):
                    weight = 1.0

            relationships.append(ParsedRelationship(
                source=src,
                target=tgt,
                relationship_type=rel_type,
                weight=weight,
            ))
    else:
        # Entity table: each row is an entity, relationships from shared categorical values
        id_col = schema.entity_id_column or schema.entity_name_column or df.columns[0]
        name_col = schema.entity_name_column or id_col
        type_col = schema.entity_type_column

        for _, row in df.iterrows():
            entity_id = str(row.get(id_col, "")).strip()
            if not entity_id:
                continue

            entity_name = str(row.get(name_col, entity_id)).strip()
            entity_type = str(row.get(type_col, "entity")) if type_col else "entity"

            attrs = {}
            for col in schema.attribute_columns:
                val = row.get(col)
                if pd.notna(val):
                    attrs[col] = str(val)

            entities[entity_id] = ParsedEntity(
                name=entity_name,
                entity_type=entity_type,
                attributes=attrs,
            )

        # Build relationships from explicit relationship columns
        for rel_col in schema.relationship_columns:
            for _, row in df.iterrows():
                src = str(row.get(id_col, "")).strip()
                tgt = str(row.get(rel_col, "")).strip()
                if src and tgt and src in entities and tgt in entities:
                    relationships.append(ParsedRelationship(
                        source=src,
                        target=tgt,
                        relationship_type=rel_col,
                    ))

        # Build edges from ALL categorical columns (not just type_col)
        categorical_cols = [type_col] if type_col else []
        for col in df.columns:
            if col in {id_col, name_col} or col in categorical_cols:
                continue
            if df[col].dtype == "object":
                n_unique = df[col].nunique()
                if 2 <= n_unique <= max(50, len(df) * 0.05):
                    categorical_cols.append(col)

        for cat_col in categorical_cols:
            _build_categorical_relationships(df, id_col, cat_col, entities, relationships)

        # Fallback: if graph is too sparse, add attribute-similarity edges
        entity_list = list(entities.keys())
        if entity_list and len(relationships) < len(entity_list):
            _build_similarity_edges(entities, relationships, k=5)

    return ParsedGraph(entities=list(entities.values()), relationships=relationships)


def _build_categorical_relationships(
    df: pd.DataFrame,
    id_col: str,
    cat_col: str,
    entities: dict[str, ParsedEntity],
    relationships: list[ParsedRelationship],
) -> None:
    """Create relationships between entities that share a categorical value."""
    grouped = df.groupby(cat_col)[id_col].apply(list)
    max_edges_per_group = 200
    for _val, members in grouped.items():
        member_strs = [str(m).strip() for m in members if str(m).strip() in entities]
        if len(member_strs) < 2:
            continue
        edge_count = 0
        for i, src in enumerate(member_strs):
            for tgt in member_strs[i + 1:]:
                if edge_count >= max_edges_per_group:
                    break
                relationships.append(ParsedRelationship(
                    source=src,
                    target=tgt,
                    relationship_type=f"shared_{cat_col}",
                    weight=1.0,
                ))
                edge_count += 1
            if edge_count >= max_edges_per_group:
                break


def _build_similarity_edges(
    entities: dict[str, ParsedEntity],
    relationships: list[ParsedRelationship],
    k: int = 5,
) -> None:
    """Connect entities by Jaccard similarity of attribute values.

    Fallback when categorical edges are too sparse — ensures every entity
    has at least some connections for meaningful crystallization.
    """
    names = list(entities.keys())
    if len(names) < 2:
        return

    # Build attribute fingerprints: set of "key=value" strings
    fingerprints: dict[str, set[str]] = {}
    for name, ent in entities.items():
        fp = set()
        if ent.entity_type:
            fp.add(f"__type__={ent.entity_type}")
        for attr_key, attr_val in (ent.attributes or {}).items():
            fp.add(f"{attr_key}={attr_val}")
        fingerprints[name] = fp

    existing = {(r.source, r.target) for r in relationships}
    existing |= {(r.target, r.source) for r in relationships}

    for name in names:
        fp = fingerprints[name]
        if not fp:
            continue
        # Score against all others
        scored = []
        for other in names:
            if other == name or (name, other) in existing:
                continue
            other_fp = fingerprints[other]
            if not other_fp:
                continue
            intersection = len(fp & other_fp)
            union = len(fp | other_fp)
            if union == 0:
                continue
            jaccard = intersection / union
            if jaccard > 0:
                scored.append((other, jaccard))

        # Take top-k most similar
        scored.sort(key=lambda x: -x[1])
        for other, sim in scored[:k]:
            if (name, other) not in existing:
                relationships.append(ParsedRelationship(
                    source=name,
                    target=other,
                    relationship_type="similar",
                    weight=round(sim, 3),
                ))
                existing.add((name, other))
                existing.add((other, name))


def _graph_to_json_bytes(graph: ParsedGraph) -> bytes:
    """Convert a ParsedGraph to JSON bytes preserving entities + relationships.

    Uses the same format as fsd_crystallize.py so the JSON adapter can parse it.
    """
    import json

    data = {
        "entities": [
            {"name": e.name, "type": e.entity_type, **(e.attributes or {})}
            for e in graph.entities
        ],
        "relationships": [
            {
                "source": r.source,
                "target": r.target,
                "type": r.relationship_type or "related_to",
                "weight": r.weight,
            }
            for r in graph.relationships
        ],
    }
    return json.dumps(data).encode("utf-8")
