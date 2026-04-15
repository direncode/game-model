"""Engine connectors — pluggable data source adapters.

Provides the base connector interface, schema introspection types,
a simple registry for discovering and instantiating connectors,
and a universal ``connect()`` function for auto-detection.

Usage:
    from engine.connectors import connect

    # Auto-detect source type:
    adapter = connect("postgresql://user:pass@host/db")
    adapter = connect("/path/to/data.csv")
    adapter = connect("s3://bucket/data.parquet")
    adapter = connect("mongodb://user:pass@host/db")
    adapter = connect("https://api.example.com/v1/data")
"""
from .base import (
    BaseConnector,
    BaseDatasetAdapter,
    ColumnInfo,
    ConnectorConfig,
    DatasetMeta,
    EntityTypeConfig,
    RelationshipSuggestion,
    SchemaMap,
    TableInfo,
)
from .registry import (
    get_connector,
    list_connectors,
    register_connector,
    unregister_connector,
)
from .drivers import (
    PostgreSQLConnector,
    CSVConnector,
    JSONConnector,
    S3Connector,
    MongoDBConnector,
    APIConnector,
    ParquetConnector,
    ExcelConnector,
    KafkaConnector,
    MySQLConnector,
    SnowflakeConnector,
)


def connect(source: str, **kwargs) -> BaseDatasetAdapter:
    """Universal connector — auto-detect source type and return appropriate adapter.

    This is the single entry point for connecting the Latent Ocean engine to
    any data source. It inspects the ``source`` string and delegates to the
    correct driver.

    Args:
        source: Connection string, file path, URL, or S3 URI.
        **kwargs: Extra keyword arguments forwarded to the specific connector.

    Returns:
        A ``BaseDatasetAdapter`` (or ``BaseConnector``) instance ready for
        ``fetch_entities()`` / ``fetch_edges()``.

    Examples::

        connect("postgresql://user:pass@host/db")
        connect("mysql://user:pass@host/db")
        connect("mongodb://user:pass@host/db")
        connect("snowflake://user:pass@account/db/schema?warehouse=wh")
        connect("s3://bucket/path/to/data.parquet")
        connect("https://api.example.com/v1/data")
        connect("kafka://localhost:9092/topic")
        connect("/path/to/data.csv")
        connect("/path/to/data.json")
        connect("/path/to/data.jsonl")
        connect("/path/to/data.parquet")
        connect("/path/to/data.xlsx")

    Raises:
        ValueError: If the source type cannot be determined.
    """
    s = source.strip()
    s_lower = s.lower()

    # ── Database connection strings ──────────────────────────────────
    if s_lower.startswith(("postgresql://", "postgres://")):
        return PostgreSQLConnector(source, **kwargs)

    if s_lower.startswith("mysql://") or s_lower.startswith("mysql+"):
        return MySQLConnector(source, **kwargs)

    if s_lower.startswith("mongodb://") or s_lower.startswith("mongodb+srv://"):
        return MongoDBConnector(source, **kwargs)

    if s_lower.startswith("snowflake://"):
        return SnowflakeConnector(connection_string=source, **kwargs)

    # ── Object storage ───────────────────────────────────────────────
    if s_lower.startswith("s3://"):
        return S3Connector(source, **kwargs)

    # ── Streaming ────────────────────────────────────────────────────
    if s_lower.startswith("kafka://"):
        # Parse kafka://host:port/topic1,topic2
        from urllib.parse import urlparse
        parsed = urlparse(source)
        bootstrap = f"{parsed.hostname}:{parsed.port or 9092}"
        topics_str = parsed.path.lstrip("/")
        topics = [t.strip() for t in topics_str.split(",") if t.strip()] if topics_str else []
        return KafkaConnector(
            bootstrap_servers=bootstrap,
            topics=topics,
            **kwargs,
        )

    # ── HTTP APIs ────────────────────────────────────────────────────
    if s_lower.startswith(("http://", "https://")):
        return APIConnector(url=source, **kwargs)

    # ── File-based connectors (by extension) ─────────────────────────
    if s_lower.endswith((".csv", ".tsv")):
        delimiter = "\t" if s_lower.endswith(".tsv") else ","
        return CSVConnector(source, delimiter=delimiter, **kwargs)

    if s_lower.endswith((".json", ".jsonl")):
        fmt = "jsonl" if s_lower.endswith(".jsonl") else None
        return JSONConnector(source, format=fmt, **kwargs)

    if s_lower.endswith(".parquet"):
        return ParquetConnector(source, **kwargs)

    if s_lower.endswith((".xlsx", ".xls")):
        return ExcelConnector(source, **kwargs)

    # ── Fallback ─────────────────────────────────────────────────────
    raise ValueError(
        f"Cannot auto-detect connector for source: {source!r}\n"
        f"Supported formats:\n"
        f"  Databases:  postgresql://, mysql://, mongodb://, snowflake://\n"
        f"  Storage:    s3://\n"
        f"  Streaming:  kafka://\n"
        f"  HTTP APIs:  http://, https://\n"
        f"  Files:      .csv, .tsv, .json, .jsonl, .parquet, .xlsx, .xls\n"
        f"\n"
        f"You can also instantiate connectors directly:\n"
        f"  from engine.connectors.drivers import CSVConnector\n"
        f"  connector = CSVConnector('/path/to/data.csv')"
    )


__all__ = [
    # Base classes
    "BaseConnector",
    "BaseDatasetAdapter",
    # Config / schema types
    "ConnectorConfig",
    "DatasetMeta",
    "EntityTypeConfig",
    "ColumnInfo",
    "TableInfo",
    "SchemaMap",
    "RelationshipSuggestion",
    # Registry
    "register_connector",
    "get_connector",
    "list_connectors",
    "unregister_connector",
    # Drivers
    "PostgreSQLConnector",
    "CSVConnector",
    "JSONConnector",
    "S3Connector",
    "MongoDBConnector",
    "APIConnector",
    "ParquetConnector",
    "ExcelConnector",
    "KafkaConnector",
    "MySQLConnector",
    "SnowflakeConnector",
    # Universal entry point
    "connect",
]
