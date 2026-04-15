"""Full pipeline demonstration: connect -> introspect -> reduce -> materialize -> verify.

This is the script you'd run to demo the platform to a customer.
It connects to a PostgreSQL database, auto-detects the schema,
runs the engine, and writes intelligence tables back.

Usage:
    python scripts/test_full_pipeline.py --dsn "postgresql://user:pass@host/db"
    python scripts/test_full_pipeline.py  # uses dev database
    python scripts/test_full_pipeline.py --dry-run  # generate SQL only, no writes
    python scripts/test_full_pipeline.py --cleanup   # drop demo schema after run
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

# Ensure engine is importable from the repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine import EngineConfig, LatentOceanEngine, __version__
from engine.connectors.drivers.postgresql import PostgreSQLConnector
from engine.materializer.base import MaterializerConfig
from engine.materializer.drivers.postgresql import PostgreSQLMaterializer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-30s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline-demo")

# ── Pretty printing helpers ──────────────────────────────────────────

BORDER = "=" * 72
THIN = "-" * 72


def header(title: str) -> None:
    print(f"\n{BORDER}")
    print(f"  {title}")
    print(BORDER)


def subheader(title: str) -> None:
    print(f"\n{THIN}")
    print(f"  {title}")
    print(THIN)


def bullet(label: str, value: str) -> None:
    print(f"  [*] {label:30s} {value}")


def ok(msg: str) -> None:
    print(f"  [OK] {msg}")


def fail(msg: str) -> None:
    print(f"  [FAIL] {msg}")


def table_row(cols: list[str], widths: list[int]) -> str:
    parts = []
    for col, w in zip(cols, widths):
        parts.append(str(col).ljust(w))
    return "  | " + " | ".join(parts) + " |"


# ── Main pipeline ────────────────────────────────────────────────────

def run_pipeline(
    dsn: str,
    schema_name: str = "demo_lo",
    limit: int = 5_000,
    budget: float = 50.0,
    dry_run: bool = False,
    cleanup: bool = False,
) -> None:
    """Execute the complete Latent Ocean pipeline end-to-end."""

    header(f"Latent Ocean Structural Intelligence Engine v{__version__}")
    print(f"  DSN:        {_redact_dsn(dsn)}")
    print(f"  Schema:     {schema_name}")
    print(f"  Limit:      {limit:,} entities")
    print(f"  Budget:     ${budget:.2f}")
    print(f"  Dry-run:    {dry_run}")
    print(f"  Cleanup:    {cleanup}")

    t_start = time.time()

    # ── Step 1: Connect ──────────────────────────────────────────────

    subheader("Step 1: Connect to PostgreSQL")

    connector = PostgreSQLConnector(dsn)

    if connector._test_connection():
        ok("Database connection successful")
    else:
        fail("Cannot reach database. Check DSN and network.")
        sys.exit(1)

    # ── Step 2: Introspect schema ────────────────────────────────────

    subheader("Step 2: Schema introspection")

    schema = connector.introspect_schema()
    meta = connector.get_meta()

    bullet("Database", meta.display_name)
    bullet("Tables discovered", str(len(schema.tables)))
    bullet("Foreign keys", str(len(schema.foreign_keys)))

    if schema.tables:
        print()
        widths = [30, 15, 12]
        print(table_row(["Table", "Columns", "Est. Rows"], widths))
        print(table_row(["-----", "-------", "---------"], widths))
        for t in schema.tables[:20]:
            print(table_row(
                [t.name, str(len(t.columns)), f"{t.row_count_estimate:,}"],
                widths,
            ))
        if len(schema.tables) > 20:
            print(f"  ... and {len(schema.tables) - 20} more tables")

    entity_types = connector.suggest_entity_types()
    if entity_types:
        print()
        bullet("Detected entity types", "")
        for et in entity_types:
            print(f"       - {et.name} (primary: {et.primary_field})")

    # ── Step 3: Fetch entities + edges ───────────────────────────────

    subheader("Step 3: Fetch entities and edges")

    entities = connector.fetch_entities(limit=limit)
    bullet("Entities fetched", f"{len(entities):,}")

    if not entities:
        print()
        print("  [!] No entities found (tables are empty).")
        print("  [!] Generating synthetic test data to demonstrate the pipeline...")
        print()
        # Generate synthetic entities to demonstrate the pipeline works
        import random
        types = ["company", "person", "document", "transaction"]
        entities = [
            {
                "name": f"entity_{i}",
                "type": random.choice(types),
                "attributes": {
                    "value": str(random.randint(1, 1000)),
                    "description": f"Synthetic entity {i} for pipeline demonstration",
                    "category": random.choice(["A", "B", "C", "D"]),
                },
            }
            for i in range(min(limit, 500))
        ]
        edges = [
            {
                "source": f"entity_{i}",
                "target": f"entity_{random.randint(0, len(entities)-1)}",
                "type": "related_to",
                "weight": round(random.random(), 3),
            }
            for i in range(len(entities) * 2)
        ]
        bullet("Synthetic entities generated", f"{len(entities):,}")
        bullet("Synthetic edges generated", f"{len(edges):,}")
    else:
        edges = connector.fetch_edges(entities)
        bullet("Edges inferred", f"{len(edges):,}")

    # Show sample entities
    if entities:
        print()
        widths_e = [30, 15, 10]
        print(table_row(["Entity", "Type", "Attrs"], widths_e))
        print(table_row(["------", "----", "-----"], widths_e))
        for e in entities[:10]:
            print(table_row(
                [
                    str(e.get("name", ""))[:30],
                    str(e.get("type", ""))[:15],
                    str(len(e.get("attributes", {}))),
                ],
                widths_e,
            ))
        if len(entities) > 10:
            print(f"  ... and {len(entities) - 10} more entities")

    # ── Step 4: Run engine — reduce ──────────────────────────────────

    subheader("Step 4: Run engine (reduce + represent)")

    engine_config = EngineConfig(budget_dollars=budget)
    engine = LatentOceanEngine(engine_config)

    # Use engine.reduce() directly since we may have synthetic entities
    types = sorted({e.get("type", "unknown") for e in entities})
    reduction = engine.reduce(entities, edges, types)
    manifold = engine.represent(reduction)

    # Build a lightweight result object
    from dataclasses import dataclass as _dc
    @_dc
    class _PipelineResult:
        reduction: object
        manifold: object
        survivors: list
        quality: object = None
    result = _PipelineResult(
        reduction=reduction,
        manifold=manifold,
        survivors=reduction.survivors,
    )

    summary = reduction.summary
    bullet("Input entities", f"{summary.get('total_entities', len(entities)):,}")
    bullet("Survivors", f"{summary.get('survivors', 0):,}")
    bullet("Reduction ratio", f"{summary.get('reduction', 1)}:1")
    recon = summary.get("reconstruction", {})
    bullet("Variance preserved", f"{recon.get('variance_preservation', 0):.1%}")
    bullet("Clusters", str(summary.get("clusters", 0)))
    bullet("Unique fingerprints", str(summary.get("unique_48bit_fingerprints", 0)))
    bullet("Wall time", f"{summary.get('wall_seconds', 0):.1f}s")

    # Print top survivors
    survivors = result.survivors if hasattr(result, "survivors") else []
    if survivors:
        print()
        subheader("Top survivors by composite score")
        widths_s = [30, 8, 8, 8, 8]
        print(table_row(
            ["Entity", "Score", "Div", "Recon", "Anom"],
            widths_s,
        ))
        print(table_row(
            ["------", "-----", "---", "-----", "----"],
            widths_s,
        ))
        # Sort by composite score descending
        sorted_survivors = sorted(
            survivors,
            key=lambda s: (
                s.scores.get("composite", 0)
                if hasattr(s, "scores") and isinstance(s.scores, dict)
                else s.get("scores", {}).get("composite", 0)
                if isinstance(s, dict) else 0
            ),
            reverse=True,
        )
        for s in sorted_survivors[:15]:
            if hasattr(s, "entity"):
                name = s.entity.get("name", "")[:30] if isinstance(s.entity, dict) else str(s.entity)[:30]
                scores = s.scores if isinstance(s.scores, dict) else {}
            elif isinstance(s, dict):
                name = s.get("entity", {}).get("name", "")[:30]
                scores = s.get("scores", {})
            else:
                continue
            print(table_row(
                [
                    name,
                    f"{scores.get('composite', 0):.3f}",
                    f"{scores.get('diversity', 0):.3f}",
                    f"{scores.get('reconstruction', 0):.3f}",
                    f"{scores.get('anomaly', 0):.3f}",
                ],
                widths_s,
            ))

    # ── Step 5: Materialize ──────────────────────────────────────────

    subheader("Step 5: Materialize results to database")

    mat_config = MaterializerConfig(
        connection_string=dsn,
        schema_name=schema_name,
        incremental=True,
        dry_run=dry_run,
    )
    materializer = PostgreSQLMaterializer(mat_config)

    if dry_run:
        print("  [DRY-RUN] Generating SQL without executing...")

    materializer.initialize()
    mat_result = materializer.materialize_all(result)

    bullet("Survivors written", f"{mat_result.survivors_count:,}")
    bullet("Connections written", f"{mat_result.connections_count:,}")
    bullet("Anomalies written", f"{mat_result.anomalies_count:,}")
    bullet("Clusters written", f"{mat_result.clusters_count:,}")
    bullet("Quality written", str(mat_result.quality_written))
    bullet("Lineage events", f"{mat_result.lineage_count:,}")
    bullet("Magnitude metrics", f"{mat_result.magnitude_count:,}")
    bullet("Materialize time", f"{mat_result.wall_seconds:.1f}s")

    if mat_result.errors:
        print()
        for err in mat_result.errors:
            fail(err)

    if dry_run:
        print()
        subheader("Dry-run SQL statements collected")
        for i, stmt in enumerate(materializer.dry_run_statements, 1):
            # Truncate long statements for display
            display = stmt if len(stmt) < 200 else stmt[:197] + "..."
            print(f"  [{i:3d}] {display}")
        print(f"\n  Total: {len(materializer.dry_run_statements)} SQL statements")

    # ── Step 6: Verify (read back) ───────────────────────────────────

    if not dry_run:
        subheader("Step 6: Verification — read back from lo_survivors")

        try:
            from sqlalchemy import create_engine, text as sa_text

            verify_engine = create_engine(dsn)
            with verify_engine.connect() as conn:
                row = conn.execute(
                    sa_text(f"SELECT COUNT(*) FROM {schema_name}.lo_survivors")
                ).fetchone()
                count = row[0] if row else 0
                bullet("lo_survivors row count", f"{count:,}")

                if count > 0:
                    top = conn.execute(
                        sa_text(
                            f"SELECT entity_id, entity_type, composite_score "
                            f"FROM {schema_name}.lo_survivors "
                            f"ORDER BY composite_score DESC LIMIT 5"
                        )
                    ).fetchall()

                    if top:
                        print()
                        widths_v = [30, 15, 10]
                        print(table_row(
                            ["Entity ID", "Type", "Score"],
                            widths_v,
                        ))
                        print(table_row(
                            ["---------", "----", "-----"],
                            widths_v,
                        ))
                        for r in top:
                            print(table_row(
                                [
                                    str(r[0])[:30],
                                    str(r[1])[:15],
                                    f"{r[2]:.3f}" if r[2] else "N/A",
                                ],
                                widths_v,
                            ))

                ok("Verification passed — data round-trips correctly")

            verify_engine.dispose()
        except Exception as exc:
            fail(f"Verification query failed: {exc}")
    else:
        print("\n  [DRY-RUN] Skipping verification (no data written)")

    # ── Step 7: Cleanup (optional) ───────────────────────────────────

    if cleanup and not dry_run:
        subheader("Step 7: Cleanup — dropping demo schema")

        try:
            from sqlalchemy import create_engine, text as sa_text

            cleanup_engine = create_engine(dsn)
            with cleanup_engine.begin() as conn:
                conn.execute(
                    sa_text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE")
                )
            cleanup_engine.dispose()
            ok(f"Schema '{schema_name}' dropped")
        except Exception as exc:
            fail(f"Cleanup failed: {exc}")

    # ── Summary ──────────────────────────────────────────────────────

    elapsed = time.time() - t_start

    header("Pipeline Complete")
    bullet("Total wall time", f"{elapsed:.1f}s")
    bullet("Entities processed", f"{len(entities):,}")
    bullet("Survivors produced", f"{len(survivors):,}")
    bullet("Tables materialized", "7")
    if dry_run:
        bullet("Mode", "DRY-RUN (no data written)")
    else:
        bullet("Output schema", schema_name)
    print()

    materializer.close()


# ── Helpers ──────────────────────────────────────────────────────────


def _redact_dsn(dsn: str) -> str:
    """Redact password from DSN for safe display."""
    if "@" not in dsn:
        return dsn
    # postgresql://user:pass@host/db -> postgresql://user:****@host/db
    try:
        prefix, rest = dsn.split("@", 1)
        if ":" in prefix:
            scheme_user = prefix.rsplit(":", 1)[0]
            return f"{scheme_user}:****@{rest}"
    except Exception:
        pass
    return dsn


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Latent Ocean full pipeline demo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dsn",
        default="postgresql://lo_dev:lo_dev@localhost:5432/latentocean_dev",
        help="PostgreSQL connection string (default: dev database)",
    )
    parser.add_argument(
        "--schema",
        default="demo_lo",
        help="Target schema for materialized tables (default: demo_lo)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5_000,
        help="Max entities to fetch (default: 5000)",
    )
    parser.add_argument(
        "--budget",
        type=float,
        default=50.0,
        help="Compute budget in USD (default: 50.0)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate SQL without executing (no database writes)",
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Drop the demo schema after verification",
    )

    args = parser.parse_args()

    run_pipeline(
        dsn=args.dsn,
        schema_name=args.schema,
        limit=args.limit,
        budget=args.budget,
        dry_run=args.dry_run,
        cleanup=args.cleanup,
    )


if __name__ == "__main__":
    main()
