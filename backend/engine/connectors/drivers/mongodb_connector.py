"""MongoDB connector — read from any MongoDB database."""
from __future__ import annotations

import logging
from typing import Any

from ..base import (
    BaseConnector,
    ColumnInfo,
    ConnectorConfig,
    DatasetMeta,
    EntityTypeConfig,
    SchemaMap,
    TableInfo,
)

logger = logging.getLogger(__name__)


def _singularize(name: str) -> str:
    if not name:
        return name
    lower = name.lower()
    if lower.endswith("ies") and len(lower) > 3:
        return name[:-3] + "y"
    if lower.endswith("s") and not lower.endswith("ss"):
        return name[:-1]
    return name


# Map Python / BSON types to generic dtype strings
_BSON_TYPE_MAP = {
    "str": "text",
    "int": "integer",
    "float": "float",
    "bool": "boolean",
    "datetime": "timestamp",
    "list": "array",
    "dict": "object",
    "ObjectId": "objectid",
    "NoneType": "null",
}


class MongoDBConnector(BaseConnector):
    """Connect to MongoDB and auto-detect collections as entity types.

    Each collection becomes an entity type. Documents become entities.
    References (ObjectId fields) become edges.

    Requires ``pymongo``. Install with: ``pip install pymongo``

    Usage::

        connector = MongoDBConnector("mongodb://user:pass@host:27017/mydb")
    """

    def __init__(
        self,
        connection_string: str,
        config: ConnectorConfig | None = None,
        database: str | None = None,
        collections: list[str] | None = None,
        sample_size: int = 100,
    ) -> None:
        try:
            import pymongo  # noqa: F401
            self._pymongo = pymongo
        except ImportError:
            raise ImportError(
                "pymongo is required for MongoDB support. "
                "Install with: pip install pymongo"
            )

        self._dsn = connection_string
        self._explicit_collections = collections
        self._sample_size = sample_size
        self._schema: SchemaMap | None = None

        _config = config or ConnectorConfig(
            name="mongodb",
            driver="mongodb",
            connection_string=connection_string,
        )
        super().__init__(_config)

        # Connect
        self._client = self._pymongo.MongoClient(connection_string, serverSelectionTimeoutMS=10000)

        # Determine database name
        if database:
            self._db_name = database
        else:
            # Extract from connection string
            from urllib.parse import urlparse
            parsed = urlparse(connection_string)
            self._db_name = parsed.path.lstrip("/").split("?")[0] or "test"

        self._db = self._client[self._db_name]

    # ------------------------------------------------------------------ #
    #  Schema introspection
    # ------------------------------------------------------------------ #

    def introspect_schema(self) -> SchemaMap:
        if self._schema is not None:
            return self._schema

        collection_names = self._explicit_collections or self._db.list_collection_names()
        # Filter out system collections
        collection_names = [c for c in collection_names if not c.startswith("system.")]

        tables: list[TableInfo] = []
        foreign_keys: list[dict] = []

        for coll_name in collection_names:
            coll = self._db[coll_name]

            # Sample documents to infer schema
            sample_docs = list(coll.find().limit(self._sample_size))
            if not sample_docs:
                continue

            # Aggregate field info across samples
            field_types: dict[str, set[str]] = {}
            for doc in sample_docs:
                for key, value in doc.items():
                    type_name = type(value).__name__
                    field_types.setdefault(key, set()).add(type_name)

            columns: list[ColumnInfo] = []
            for field_name, types in field_types.items():
                # Pick the most common/reasonable type
                primary_type = _pick_primary_type(types)
                is_pk = field_name == "_id"
                is_fk = (
                    "ObjectId" in types
                    and field_name != "_id"
                    and field_name.endswith(("_id", "Id", "_ref"))
                )

                # If it looks like an ObjectId reference, try to find the target
                references = ""
                if is_fk:
                    ref_coll = _guess_ref_collection(field_name, collection_names)
                    if ref_coll:
                        references = f"{ref_coll}._id"
                        foreign_keys.append({
                            "from_table": coll_name,
                            "from_col": field_name,
                            "to_table": ref_coll,
                            "to_col": "_id",
                        })

                columns.append(
                    ColumnInfo(
                        name=field_name,
                        dtype=primary_type,
                        nullable=field_name != "_id",
                        is_primary_key=is_pk,
                        is_foreign_key=is_fk,
                        references=references,
                    )
                )

            # Estimate count
            try:
                row_count = coll.estimated_document_count()
            except Exception:
                row_count = len(sample_docs)

            tables.append(
                TableInfo(
                    name=coll_name,
                    schema="default",
                    columns=columns,
                    row_count_estimate=row_count,
                )
            )

        self._schema = SchemaMap(tables=tables, foreign_keys=foreign_keys)
        logger.info(
            "Introspected MongoDB: %d collections, %d foreign keys",
            len(tables),
            len(foreign_keys),
        )
        return self._schema

    # ------------------------------------------------------------------ #
    #  DatasetMeta
    # ------------------------------------------------------------------ #

    def get_meta(self) -> DatasetMeta:
        schema = self.introspect_schema()
        entity_types = self.suggest_entity_types()

        return DatasetMeta(
            dataset_id=f"mongo:{self._db_name}",
            display_name=f"MongoDB: {self._db_name}",
            description=f"Auto-detected schema with {len(schema.tables)} collections",
            entity_types=entity_types,
            lookup_field="name",
            lookup_label="Entity",
        )

    # ------------------------------------------------------------------ #
    #  Entity fetching
    # ------------------------------------------------------------------ #

    def fetch_entities(self, limit: int = 10_000) -> list[dict]:
        schema = self.introspect_schema()
        all_entities: list[dict] = []

        # Distribute limit across collections
        total_rows = sum(t.row_count_estimate for t in schema.tables) or 1
        for table in schema.tables:
            if len(all_entities) >= limit:
                break

            coll_limit = max(50, int(limit * (table.row_count_estimate / total_rows)))
            coll_limit = min(coll_limit, limit - len(all_entities))

            coll = self._db[table.name]
            entity_type = _singularize(table.name)

            # Find a good name field
            name_field = self._pick_name_field(table)

            try:
                for doc in coll.find().limit(coll_limit):
                    # Build entity name
                    if name_field and name_field in doc:
                        name = str(doc[name_field])
                    elif "_id" in doc:
                        name = f"{entity_type}:{doc['_id']}"
                    else:
                        name = f"{entity_type}:{len(all_entities)}"

                    # Build attributes, converting ObjectId to string
                    attributes: dict[str, Any] = {}
                    for key, value in doc.items():
                        if key == "_id":
                            attributes["_id"] = str(value)
                            continue
                        if hasattr(value, "__str__") and type(value).__name__ == "ObjectId":
                            attributes[key] = str(value)
                        elif isinstance(value, (dict, list)):
                            import json
                            attributes[key] = json.dumps(value, default=str)
                        elif value is not None:
                            attributes[key] = value

                    all_entities.append({
                        "name": name,
                        "type": entity_type,
                        "attributes": attributes,
                    })
            except Exception:
                logger.exception("Failed to fetch from collection %s", table.name)

        logger.info("Fetched %d entities from MongoDB", len(all_entities))
        return all_entities

    def _pick_name_field(self, table: TableInfo) -> str:
        """Pick a display name field from the collection schema."""
        priority = ["name", "title", "label", "username", "email", "slug"]
        col_names = {c.name.lower(): c.name for c in table.columns}
        for candidate in priority:
            if candidate in col_names:
                return col_names[candidate]
        # Pick first text column that is not _id
        for col in table.columns:
            if col.dtype == "text" and col.name != "_id":
                return col.name
        return ""

    # ------------------------------------------------------------------ #
    #  Edge fetching
    # ------------------------------------------------------------------ #

    def fetch_edges(self, entities: list[dict]) -> list[dict]:
        schema = self.introspect_schema()

        # Build entity index
        entity_index: dict[tuple[str, str], str] = {}
        for ent in entities:
            ename = ent["name"]
            etype = ent["type"]
            entity_index[(etype, ename)] = ename
            for k, v in ent.get("attributes", {}).items():
                if isinstance(v, (str, int, float)):
                    entity_index[(etype, str(v))] = ename

        edges: list[dict] = []
        for fk in schema.foreign_keys:
            from_type = _singularize(fk["from_table"])
            to_type = _singularize(fk["to_table"])
            edge_type = f"{from_type}_to_{to_type}"

            for ent in entities:
                if ent["type"] != from_type:
                    continue
                ref_value = ent["attributes"].get(fk["from_col"])
                if ref_value is None:
                    continue
                target_key = (to_type, str(ref_value))
                # Also check by _id attribute
                target_name = entity_index.get(target_key)
                if not target_name:
                    # Try matching against _id attribute
                    for e in entities:
                        if e["type"] == to_type and e.get("attributes", {}).get("_id") == str(ref_value):
                            target_name = e["name"]
                            break
                if target_name and target_name != ent["name"]:
                    edges.append({
                        "source": ent["name"],
                        "target": target_name,
                        "type": edge_type,
                        "weight": 1.0,
                    })

        logger.info("Inferred %d edges from MongoDB references", len(edges))
        return edges

    # ------------------------------------------------------------------ #
    #  Anomaly tags
    # ------------------------------------------------------------------ #

    def get_anomaly_tags(
        self,
        record: dict,
        scores: dict,
        cluster_size: int,
        flips: int,
    ) -> list[dict]:
        from .csv_connector import _generic_anomaly_tags
        return _generic_anomaly_tags(record, scores, cluster_size, flips)


# ── Helpers ────────────────────────────────────────────────────────────


def _pick_primary_type(types: set[str]) -> str:
    """Pick the most representative type from a set of observed types."""
    # Remove NoneType
    types = types - {"NoneType"}
    if not types:
        return "text"
    if len(types) == 1:
        return _BSON_TYPE_MAP.get(next(iter(types)), "text")
    # Multiple types — prefer text as it's the most flexible
    if "str" in types:
        return "text"
    return _BSON_TYPE_MAP.get(next(iter(types)), "text")


def _guess_ref_collection(field_name: str, collection_names: list[str]) -> str:
    """Guess which collection an ObjectId field references.

    ``user_id`` -> ``users``, ``authorId`` -> ``authors``
    """
    # Strip suffixes
    base = field_name
    for suffix in ("_id", "Id", "_ref"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break

    # Try plural forms
    candidates = [base, base + "s", base + "es"]
    for candidate in candidates:
        if candidate in collection_names:
            return candidate
        # Case-insensitive
        for coll in collection_names:
            if coll.lower() == candidate.lower():
                return coll

    return ""
