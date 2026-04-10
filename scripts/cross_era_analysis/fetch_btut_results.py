"""Fetch BTUT convergent results directly from production DB.

The BTUT engine writes survivor data to a table. This script pulls it
out so we can analyze the lattice fingerprints and check whether the
cross-era physics regimes were captured at the multi-resolution lattice
level.
"""

import asyncio
import json
import os
from pathlib import Path


async def main():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy import text

    engine = create_async_engine(os.environ["DATABASE_URL"], echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    dataset_id = "6c3c2dda-0878-4a7d-bfcd-be0fe9bd88d7"

    try:
        async with SessionLocal() as db:
            # Find BTUT tables
            result = await db.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name LIKE '%btut%'
                ORDER BY table_name
            """))
            btut_tables = [row[0] for row in result.fetchall()]
            print(f"BTUT tables: {btut_tables}")

            # Check for survivor data
            for table in btut_tables:
                try:
                    count_result = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = count_result.scalar()
                    print(f"  {table}: {count} rows")
                except Exception as e:
                    print(f"  {table}: error {e}")

            # Try to get BTUT runs for this dataset
            try:
                result = await db.execute(text("""
                    SELECT id, dataset_id, entity_count, survivor_count,
                           reduction_ratio, quality_score, created_at
                    FROM btut_runs
                    ORDER BY created_at DESC LIMIT 5
                """))
                for row in result.fetchall():
                    print(f"BTUT run: {row}")
            except Exception as e:
                print(f"No btut_runs table: {e}")

            # Try to get survivor data
            try:
                result = await db.execute(text("""
                    SELECT entity_key, entity_type, analysis, lineage
                    FROM btut_survivors
                    WHERE dataset_id = :did
                    LIMIT 300
                """), {"did": dataset_id})
                rows = result.fetchall()
                print(f"Found {len(rows)} survivors")

                # Save to JSON
                survivors = []
                for row in rows:
                    survivors.append({
                        "entity_key": row[0],
                        "entity_type": row[1],
                        "analysis": row[2] if isinstance(row[2], dict) else json.loads(row[2]) if row[2] else {},
                        "lineage": row[3] if isinstance(row[3], dict) else json.loads(row[3]) if row[3] else {},
                    })

                output = {
                    "dataset": "cross_era_physics",
                    "count": len(survivors),
                    "convergent_metadata": survivors,
                }
                out_path = Path("/tmp/btut_crossera_output.json")
                with open(out_path, "w") as f:
                    json.dump(output, f, indent=2)
                print(f"Saved to {out_path}")
            except Exception as e:
                print(f"No btut_survivors table: {e}")
                # Try alternative column names
                try:
                    result = await db.execute(text("""
                        SELECT column_name FROM information_schema.columns
                        WHERE table_name = 'btut_survivors'
                    """))
                    cols = [row[0] for row in result.fetchall()]
                    print(f"btut_survivors columns: {cols}")
                except:
                    pass
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
