"""Server-side script: ingest cross-era corpus and trigger BTUT crystallization.

Run on production:
    cd /opt/latentocean && docker compose exec -T api python /app/scripts/upload_and_crystallize.py
"""

import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path


async def main():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy import text
    from neo4j import AsyncGraphDatabase

    db_url = os.environ["DATABASE_URL"]
    neo4j_uri = os.environ["NEO4J_URI"]
    neo4j_user = os.environ["NEO4J_USER"]
    neo4j_pass = os.environ["NEO4J_PASSWORD"]

    payload_path = Path("/app/scripts/crossera_upload.json")
    with open(payload_path, "r") as f:
        data = json.load(f)

    entities = data["entities"]
    relationships = data["relationships"]
    print(f"Loaded {len(entities)} entities, {len(relationships)} relationships")

    engine = create_async_engine(db_url, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    neo4j_driver = AsyncGraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_pass))

    try:
        async with SessionLocal() as db:
            r = await db.execute(text("SELECT id FROM users WHERE is_active = true LIMIT 1"))
            owner_id = str(r.fetchone()[0])
            print(f"Owner: {owner_id}")

            # Check/create dataset
            result = await db.execute(text("SELECT id FROM datasets WHERE name = 'Cross-Era Physics Regime Corpus'"))
            existing = result.fetchone()
            if existing:
                dataset_id = str(existing[0])
                print(f"Dataset exists: {dataset_id}")
                await db.execute(text("UPDATE datasets SET status = 'ready' WHERE id = :id"), {"id": dataset_id})
                await db.commit()
            else:
                dataset_id = str(uuid.uuid4())
                await db.execute(text("""
                    INSERT INTO datasets (id, name, description, owner_id, status, entity_count, edge_count, created_at)
                    VALUES (:id, :name, :desc, :owner_id, 'ready', :ec, :rc, :now)
                """), {
                    "id": dataset_id,
                    "name": "Cross-Era Physics Regime Corpus",
                    "desc": "12 patents from 1887-2020 spanning 3 physics regimes (surface wave, inductive near-field, radiative) chunked into 231 entities. Cross-era validation test for BTUT structural signature detection.",
                    "owner_id": owner_id,
                    "ec": len(entities),
                    "rc": len(relationships),
                    "now": datetime.utcnow(),
                })
                await db.commit()
                print(f"Created dataset: {dataset_id}")

            dataset_label = dataset_id.replace("-", "_")
            print(f"Neo4j label: {dataset_label}")

            async with neo4j_driver.session() as session:
                await session.run(f"MATCH (n:Entity:`{dataset_label}`) DETACH DELETE n")
                print("Cleared Neo4j state")

                # Insert entities in batches
                for i in range(0, len(entities), 50):
                    batch = entities[i:i + 50]
                    for ent in batch:
                        name = ent["name"]
                        etype = ent["type"]
                        attrs = ent.get("attributes", {})
                        attrs_json = json.dumps(attrs)
                        await session.run(
                            f"""
                            CREATE (n:Entity:`{dataset_label}` {{
                                name: $name,
                                entity_type: $etype,
                                attributes: $attrs
                            }})
                            """,
                            name=name, etype=etype, attrs=attrs_json,
                        )
                    print(f"  Entities {min(i+50, len(entities))}/{len(entities)}")

                # Insert relationships in batches
                for i in range(0, len(relationships), 100):
                    batch = relationships[i:i + 100]
                    for rel in batch:
                        await session.run(
                            f"""
                            MATCH (a:Entity:`{dataset_label}` {{name: $source}})
                            MATCH (b:Entity:`{dataset_label}` {{name: $target}})
                            CREATE (a)-[:RELATES_TO {{type: $rtype, weight: $weight}}]->(b)
                            """,
                            source=rel["source"], target=rel["target"],
                            rtype=rel.get("type", "related"), weight=rel.get("weight", 1.0),
                        )
                    print(f"  Relationships {min(i+100, len(relationships))}/{len(relationships)}")

            print("Neo4j storage complete")

            # Create crystallization job with BTUT enabled
            job_id = str(uuid.uuid4())
            await db.execute(text("""
                INSERT INTO crystallization_jobs (id, dataset_id, status, config, created_by, created_at)
                VALUES (:id, :did, 'queued', :config, :uid, :now)
            """), {
                "id": job_id,
                "did": dataset_id,
                "config": json.dumps({"epochs": 50, "btut_enabled": True, "btut_budget_dollars": 5.0}),
                "uid": owner_id,
                "now": datetime.utcnow(),
            })
            await db.commit()
            print(f"Job created: {job_id}")

            # Dispatch
            from celery import Celery
            celery = Celery("li", broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
            celery.send_task("crystallization.run", args=[job_id], queue="crystallization")
            print(f"Dispatched to Celery")
            print()
            print(f"Job ID: {job_id}")
            print(f"Dataset ID: {dataset_id}")

    finally:
        await neo4j_driver.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
