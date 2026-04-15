"""Engine API — direct access to structural intelligence primitives.

These endpoints expose the LatentOceanEngine directly, bypassing the
data_layer facade. Used by the SDK and CLI.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engine import LatentOceanEngine, EngineConfig
from engine.connectors import list_connectors
from engine.connectors.drivers.postgresql import PostgreSQLConnector
from engine.materializer.base import MaterializerConfig
from engine.materializer.drivers.postgresql import PostgreSQLMaterializer
from engine.materializer.table_schemas import get_table_names
from engine.materializer.writer import SQLWriter

router = APIRouter(prefix="/engine", tags=["engine"])
logger = logging.getLogger(__name__)


# ── Request / Response models ────────────────────────────────────────


class ReduceRequest(BaseModel):
    entities: list[dict]
    edges: list[dict] = []
    entity_types: list[str] = []
    budget_dollars: float = 50.0
    target_survivors: int = 300


class ReduceResponse(BaseModel):
    summary: dict
    survivors: list[dict]
    survivor_count: int
    reduction_ratio: int
    wall_seconds: float


class ConnectRequest(BaseModel):
    connection_string: str
    schema: str = "public"
    limit: int = 10_000


class ConnectResponse(BaseModel):
    tables_found: int
    entity_types: list[dict]
    relationship_types: list[dict]
    estimated_entities: int


class MaterializeRequest(BaseModel):
    connection_string: str
    schema: str = "latent_ocean"
    dry_run: bool = False


class MaterializeResponse(BaseModel):
    tables_created: int
    rows_written: dict  # table_name -> count
    sql_statements: list[str] = []  # Only populated in dry_run mode


class StatusResponse(BaseModel):
    engine_version: str
    available_connectors: list[str]
    materializer_tables: list[str]
    modules_loaded: int


class InferRequest(BaseModel):
    """The one-call API -- connect, reduce, materialize in one shot."""
    source_connection_string: str
    source_schema: str = "public"
    output_connection_string: Optional[str] = None  # defaults to source
    output_schema: str = "latent_ocean"
    limit: int = 10_000
    budget_dollars: float = 50.0
    target_survivors: int = 300
    dry_run: bool = False


class InferResponse(BaseModel):
    summary: dict
    survivor_count: int
    reduction_ratio: int
    tables_materialized: list[str]
    wall_seconds: float
    cost_usd: float
    sql_statements: list[str] = []


# ── Endpoints ────────────────────────────────────────────────────────


@router.get("/status")
async def get_status() -> StatusResponse:
    """Engine status and capabilities."""
    import engine as engine_pkg

    return StatusResponse(
        engine_version=engine_pkg.__version__,
        available_connectors=list_connectors(),
        materializer_tables=get_table_names(),
        modules_loaded=len(list_connectors()),
    )


@router.post("/reduce")
async def reduce(request: ReduceRequest) -> ReduceResponse:
    """Run the reduce primitive on provided entities."""
    if not request.entities:
        raise HTTPException(status_code=422, detail="entities list must not be empty")

    engine = LatentOceanEngine(EngineConfig(
        budget_dollars=request.budget_dollars,
        target_survivors=request.target_survivors,
    ))

    entity_types = request.entity_types or sorted(
        {e.get("type", "unknown") for e in request.entities}
    )

    try:
        result = engine.reduce(
            entities=request.entities,
            edges=request.edges,
            types=entity_types,
        )
    except Exception as exc:
        logger.exception("reduce failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    n_input = int(result.summary.get("total_entities", len(request.entities)))
    n_surv = len(result.survivors)
    reduction_ratio = int(result.summary.get(
        "reduction", max(n_input // max(n_surv, 1), 1)
    ))

    return ReduceResponse(
        summary=result.summary,
        survivors=result.survivors,
        survivor_count=n_surv,
        reduction_ratio=reduction_ratio,
        wall_seconds=round(result.wall_seconds, 3),
    )


@router.post("/connect")
async def connect(request: ConnectRequest) -> ConnectResponse:
    """Connect to a database and introspect the schema."""
    try:
        connector = PostgreSQLConnector(
            connection_string=request.connection_string,
        )
        connector._db_schema = request.schema

        schema_map = connector.introspect_schema()
        entity_types = connector.suggest_entity_types()
        relationships = connector.suggest_relationships()

        estimated_entities = sum(t.row_count_estimate for t in schema_map.tables)

    except Exception as exc:
        logger.exception("connect failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ConnectResponse(
        tables_found=len(schema_map.tables),
        entity_types=[
            {
                "name": et.name,
                "color": et.color,
                "primary_field": et.primary_field,
                "secondary_field": et.secondary_field,
            }
            for et in entity_types
        ],
        relationship_types=[
            {
                "from_table": r.from_table,
                "from_column": r.from_column,
                "to_table": r.to_table,
                "to_column": r.to_column,
                "confidence": r.confidence,
                "basis": r.basis,
            }
            for r in relationships
        ],
        estimated_entities=estimated_entities,
    )


@router.post("/materialize")
async def materialize(request: MaterializeRequest) -> MaterializeResponse:
    """Initialize materializer tables (dry-run supported)."""
    try:
        config = MaterializerConfig(
            connection_string=request.connection_string,
            schema_name=request.schema,
            dry_run=request.dry_run,
        )
        materializer = PostgreSQLMaterializer(config)

        if request.dry_run:
            # Generate all DDL statements without executing
            writer = SQLWriter()
            statements = writer.generate_create_all(request.schema)
            return MaterializeResponse(
                tables_created=len(get_table_names()),
                rows_written={},
                sql_statements=statements,
            )

        materializer.initialize()

        return MaterializeResponse(
            tables_created=len(get_table_names()),
            rows_written={},
            sql_statements=[],
        )

    except Exception as exc:
        logger.exception("materialize failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/infer")
async def infer(request: InferRequest) -> InferResponse:
    """One-call API: connect -> reduce -> materialize.

    This is THE endpoint. The whole product in one API call.
    """
    wall_start = time.time()

    # 1. Connect + introspect + fetch
    try:
        connector = PostgreSQLConnector(
            connection_string=request.source_connection_string,
        )
        connector._db_schema = request.source_schema
    except Exception as exc:
        logger.exception("infer: connect failed")
        raise HTTPException(
            status_code=500, detail=f"Connection failed: {exc}"
        ) from exc

    # 2. Reduce via the engine
    engine = LatentOceanEngine(EngineConfig(
        budget_dollars=request.budget_dollars,
        target_survivors=request.target_survivors,
    ))

    try:
        full_result = engine.run(connector, limit=request.limit)
    except Exception as exc:
        logger.exception("infer: engine.run failed")
        raise HTTPException(
            status_code=500, detail=f"Engine run failed: {exc}"
        ) from exc

    quality = full_result.quality
    reduction = full_result.reduction

    # 3. Materialize
    output_dsn = request.output_connection_string or request.source_connection_string
    tables_materialized: list[str] = []
    sql_statements: list[str] = []

    try:
        mat_config = MaterializerConfig(
            connection_string=output_dsn,
            schema_name=request.output_schema,
            dry_run=request.dry_run,
        )
        materializer = PostgreSQLMaterializer(mat_config)

        if request.dry_run:
            writer = SQLWriter()
            sql_statements = writer.generate_create_all(request.output_schema)
            tables_materialized = get_table_names()
        else:
            materializer.initialize()
            mat_result = materializer.materialize_all(full_result)
            tables_materialized = get_table_names()
            if mat_result.errors:
                logger.warning(
                    "infer: materialize had %d errors: %s",
                    len(mat_result.errors),
                    mat_result.errors,
                )
    except Exception as exc:
        logger.exception("infer: materialize failed")
        raise HTTPException(
            status_code=500, detail=f"Materialization failed: {exc}"
        ) from exc

    wall_seconds = time.time() - wall_start

    return InferResponse(
        summary=reduction.summary,
        survivor_count=quality.n_survivors,
        reduction_ratio=quality.reduction_ratio,
        tables_materialized=tables_materialized,
        wall_seconds=round(wall_seconds, 3),
        cost_usd=quality.estimated_cost_usd,
        sql_statements=sql_statements,
    )
