"""Server-side script: ingest Tesla convergent survivors and trigger crystallization.

Run on production server:
    cd /opt/latentocean
    python scripts/server_crystallize_tesla.py

Requires: DATABASE_URL, NEO4J_*, RUNPOD_* in .env
"""

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

# Load .env
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


async def main():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy import text
    from neo4j import AsyncGraphDatabase

    db_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://li:li@localhost:5432/latent_intelligence")
    neo4j_uri = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user = os.environ.get("NEO4J_USER", "neo4j")
    neo4j_pass = os.environ.get("NEO4J_PASSWORD", "latentintelligence")

    # Load upload data
    upload_path = Path(__file__).parent / "tesla_upload.json"
    with open(upload_path, "r") as f:
        upload_data = json.load(f)

    entities = upload_data["entities"]
    relationships = upload_data["relationships"]
    print(f"Loaded {len(entities)} entities, {len(relationships)} relationships")

    # Connect to DB
    engine = create_async_engine(db_url, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    # Connect to Neo4j
    neo4j_driver = AsyncGraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_pass))

    try:
        async with SessionLocal() as db:
            # Step 1: Get owner user
            result = await db.execute(text("SELECT id FROM users WHERE is_active = true LIMIT 1"))
            row = result.fetchone()
            if not row:
                print("ERROR: No active user found in database")
                return
            owner_id = row[0]
            print(f"Using owner: {owner_id}")

            # Step 2: Check if Tesla dataset already exists
            result = await db.execute(text("SELECT id FROM datasets WHERE name = 'Nikola Tesla BTUT Convergent'"))
            existing = result.fetchone()
            if existing:
                dataset_id = str(existing[0])
                print(f"Tesla dataset already exists: {dataset_id}")
                # Update status to ready for re-crystallization
                await db.execute(text(
                    "UPDATE datasets SET status = 'ready' WHERE id = :id"
                ), {"id": dataset_id})
                await db.commit()
            else:
                dataset_id = str(uuid.uuid4())
                await db.execute(text("""
                    INSERT INTO datasets (id, name, description, owner_id, status, entity_count, edge_count, created_at)
                    VALUES (:id, :name, :desc, :owner_id, 'ready', :entity_count, :edge_count, :now)
                """), {
                    "id": dataset_id,
                    "name": "Nikola Tesla BTUT Convergent",
                    "desc": "416 convergent survivors from BTUT engine processing Tesla corpus (112 patents, 60 writings, 24 events). Full lattice fingerprints, anomaly scores, and 7-step lineage provenance.",
                    "owner_id": str(owner_id),
                    "entity_count": len(entities),
                    "edge_count": len(relationships),
                    "now": datetime.utcnow(),
                })
                await db.commit()
                print(f"Created dataset: {dataset_id}")

            # Step 3: Store entities in Neo4j
            dataset_label = dataset_id.replace("-", "_")
            print(f"Storing in Neo4j with label: {dataset_label}")

            # Clear existing entities for this dataset
            async with neo4j_driver.session() as session:
                await session.run(
                    f"MATCH (n:Entity:`{dataset_label}`) DETACH DELETE n"
                )
                print("Cleared existing Neo4j data")

                # Create entities in batches
                batch_size = 50
                for i in range(0, len(entities), batch_size):
                    batch = entities[i:i + batch_size]
                    for ent in batch:
                        name = ent["name"]
                        etype = ent.get("type", "unknown")
                        # Everything except name and type goes into attributes
                        attrs = {k: v for k, v in ent.items() if k not in ("name", "type")}
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
                    print(f"  Entities: {min(i + batch_size, len(entities))}/{len(entities)}")

                # Create relationships in batches
                for i in range(0, len(relationships), batch_size):
                    batch = relationships[i:i + batch_size]
                    for rel in batch:
                        await session.run(
                            f"""
                            MATCH (a:Entity:`{dataset_label}` {{name: $source}})
                            MATCH (b:Entity:`{dataset_label}` {{name: $target}})
                            CREATE (a)-[:RELATES_TO {{type: $rel_type, weight: $weight}}]->(b)
                            """,
                            source=rel["source"],
                            target=rel["target"],
                            rel_type=rel["type"],
                            weight=rel.get("weight", 1.0),
                        )
                    print(f"  Relationships: {min(i + batch_size, len(relationships))}/{len(relationships)}")

            print("Neo4j storage complete")

            # Step 4: Create crystallization job
            job_id = str(uuid.uuid4())
            await db.execute(text("""
                INSERT INTO crystallization_jobs (id, dataset_id, status, config, created_by, created_at)
                VALUES (:id, :dataset_id, 'queued', :config, :owner_id, :now)
            """), {
                "id": job_id,
                "dataset_id": dataset_id,
                "config": json.dumps({
                    "epochs": 100,
                    "btut_enabled": False,  # Already BTUT-reduced
                }),
                "owner_id": str(owner_id),
                "now": datetime.utcnow(),
            })
            await db.commit()
            print(f"Created crystallization job: {job_id}")

            # Step 5: Dispatch to Celery
            try:
                from celery import Celery
                redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
                celery_app = Celery("latent_intelligence", broker=redis_url)
                celery_app.send_task(
                    "crystallization.run",
                    args=[job_id],
                    queue="crystallization",
                )
                print(f"Dispatched crystallization task to Celery queue")
                print(f"\nJob ID: {job_id}")
                print(f"Dataset ID: {dataset_id}")
                print(f"Monitor: SELECT status, module_count, error_message FROM crystallization_jobs WHERE id = '{job_id}';")
            except Exception as e:
                print(f"Celery dispatch failed: {e}")
                print("Falling back to direct RunPod submission...")

                # Direct RunPod call
                import httpx
                api_key = os.environ.get("RUNPOD_API_KEY")
                endpoint_id = os.environ.get("RUNPOD_ENDPOINT_ID")
                if not api_key or not endpoint_id:
                    print("ERROR: RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID required")
                    return

                # Format entities for RunPod
                runpod_entities = [
                    {"name": e["name"], "type": e.get("type", "unknown"),
                     "attributes": {k: v for k, v in e.items() if k not in ("name", "type")}}
                    for e in entities
                ]
                runpod_edges = [
                    {"source": r["source"], "target": r["target"],
                     "type": r["type"], "weight": r.get("weight", 1.0)}
                    for r in relationships
                ]

                payload = {
                    "input": {
                        "entities": runpod_entities,
                        "edges": runpod_edges,
                        "config": {
                            "epochs": 100,
                            "btut_enabled": False,
                            "embedding_dim": 128,
                        },
                        "dataset_id": dataset_id,
                        "job_id": job_id,
                    }
                }

                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"https://api.runpod.ai/v2/{endpoint_id}/run",
                        json=payload,
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                    )
                    resp.raise_for_status()
                    result = resp.json()
                    runpod_id = result.get("id")
                    print(f"RunPod job submitted: {runpod_id}")
                    print(f"Poll: curl -H 'Authorization: Bearer {api_key}' https://api.runpod.ai/v2/{endpoint_id}/status/{runpod_id}")

    finally:
        await neo4j_driver.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
