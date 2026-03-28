#!/usr/bin/env python3
"""Seed demo datasets for Latent Intelligence.

Loads three validated domains:
1. Semiconductor Supply Chain (Georgetown ETO CSET) - 519 entities
2. GDELT Global Events - 380 entities, 16 modules
3. SEC EDGAR 10-K Filings - 9,725 entities, 3.9M edges

Usage:
    python scripts/seed_demo_data.py
"""
import asyncio
import uuid
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

async def seed_demo_user(session):
    """Create a demo admin user."""
    from app.core.auth import hash_password
    from app.models.user import User, Organization

    org = Organization(
        id=uuid.uuid4(),
        name="Latent Intelligence Demo",
        slug="li-demo",
        plan="enterprise",
        max_datasets=100,
        max_entities=1000000,
        max_users=50,
    )
    session.add(org)

    user = User(
        id=uuid.uuid4(),
        email="admin@latentintelligence.ai",
        name="Demo Admin",
        password_hash=hash_password("demo2024!"),
        role="admin",
        organization_id=org.id,
    )
    session.add(user)
    await session.flush()
    return user

async def seed_semiconductor_dataset(session, user_id):
    """Seed Georgetown ETO Semiconductor Supply Chain dataset."""
    from app.models.dataset import Dataset, EntityType

    dataset = Dataset(
        id=uuid.uuid4(),
        name="Semiconductor Supply Chain (Georgetown CSET)",
        description="519 entities from Georgetown ETO Chip Explorer. Supply chain relationships between chips, tools, materials, processes, companies, and countries.",
        owner_id=user_id,
        status="complete",
        entity_count=519,
        edge_count=2847,
        density=0.021,
    )
    session.add(dataset)

    entity_types = [
        ("Company", 187, {"attributes": ["revenue", "country", "sector"]}),
        ("Chip", 89, {"attributes": ["type", "process_node", "application"]}),
        ("Tool", 72, {"attributes": ["type", "manufacturer"]}),
        ("Material", 63, {"attributes": ["type", "purity"]}),
        ("Process", 58, {"attributes": ["type", "node_size"]}),
        ("Country", 50, {"attributes": ["region", "gdp"]}),
    ]

    for name, count, attrs in entity_types:
        et = EntityType(
            dataset_id=dataset.id,
            name=name,
            count=count,
            attributes=attrs,
        )
        session.add(et)

    await session.flush()
    return dataset

async def seed_gdelt_dataset(session, user_id):
    """Seed GDELT Global Events dataset."""
    from app.models.dataset import Dataset, EntityType

    dataset = Dataset(
        id=uuid.uuid4(),
        name="GDELT Global Events",
        description="380 entities from GDELT event streams. 16 crystallized modules with 15/15 purity in government and magistrate clusters.",
        owner_id=user_id,
        status="complete",
        entity_count=380,
        edge_count=4521,
        density=0.063,
    )
    session.add(dataset)

    entity_types = [
        ("Government", 98, {"attributes": ["country", "branch"]}),
        ("Military", 67, {"attributes": ["country", "branch"]}),
        ("Organization", 54, {"attributes": ["type", "sector"]}),
        ("Media", 45, {"attributes": ["type", "country"]}),
        ("Education", 38, {"attributes": ["type", "country"]}),
        ("Civilian", 42, {"attributes": ["type", "country"]}),
        ("Religious", 36, {"attributes": ["type", "country"]}),
    ]

    for name, count, attrs in entity_types:
        et = EntityType(dataset_id=dataset.id, name=name, count=count, attributes=attrs)
        session.add(et)

    await session.flush()
    return dataset

async def seed_sec_edgar_dataset(session, user_id):
    """Seed SEC EDGAR 10-K Filings dataset."""
    from app.models.dataset import Dataset, EntityType

    dataset = Dataset(
        id=uuid.uuid4(),
        name="SEC EDGAR 10-K Filings (S&P 500)",
        description="9,725 entities from SEC 10-K filings. Dense financial network with 3.9M edges. Balanced entity representations across company, industry, and financial relationship types.",
        owner_id=user_id,
        status="complete",
        entity_count=9725,
        edge_count=3900000,
        density=0.082,
    )
    session.add(dataset)

    entity_types = [
        ("Company", 500, {"attributes": ["ticker", "sector", "market_cap"]}),
        ("Filing", 2500, {"attributes": ["type", "date", "period"]}),
        ("Paragraph", 5000, {"attributes": ["section", "topic"]}),
        ("Industry", 225, {"attributes": ["sector", "sub_sector"]}),
        ("Executive", 1500, {"attributes": ["title", "company"]}),
    ]

    for name, count, attrs in entity_types:
        et = EntityType(dataset_id=dataset.id, name=name, count=count, attributes=attrs)
        session.add(et)

    await session.flush()
    return dataset

async def seed_demo_modules(session, dataset, num_modules, user_id):
    """Seed demo crystallization job and modules for a dataset."""
    from app.models.crystallization import CrystallizationJob
    from app.models.module import Module
    import random

    job = CrystallizationJob(
        id=uuid.uuid4(),
        dataset_id=dataset.id,
        status="completed",
        config={"module_count": num_modules, "epochs": 100, "learning_rate": 0.001},
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        final_link_auc=0.92 + random.uniform(0, 0.07),
        final_knn_accuracy=0.88 + random.uniform(0, 0.10),
        module_count=num_modules,
        training_log={"epochs_completed": 100},
        created_by=user_id,
    )
    session.add(job)

    type_names = ["Company", "Government", "Organization", "Military", "Media"]

    for i in range(num_modules):
        module = Module(
            id=uuid.uuid4(),
            job_id=job.id,
            dataset_id=dataset.id,
            module_index=i,
            name=f"Module {i}",
            description=f"Auto-generated demo module {i} for {dataset.name}",
            entity_count=random.randint(10, 50),
            dominant_type="Government" if random.random() > 0.5 else "Company",
            purity_score=random.uniform(0.65, 1.0),
            type_distribution={"primary": random.randint(10, 30), "secondary": random.randint(0, 10)},
            anchor_entities=[f"entity_{j}" for j in range(5)],
            internal_density=random.uniform(0.3, 0.9),
            confidence=random.choice(["high", "medium", "low"]),
        )
        session.add(module)

    await session.flush()
    return job

async def main():
    from app.db.session import async_session_factory, engine
    from app.models.user import User
    from app.models.dataset import EntityType
    from sqlalchemy import select

    print("Seeding Latent Intelligence demo data...")

    async with async_session_factory() as session:
        async with session.begin():
            # Find existing user or create demo user
            result = await session.execute(select(User).where(User.email == "diren@latentocean.com"))
            user = result.scalar_one_or_none()

            if user is None:
                user = await seed_demo_user(session)
                print(f"  Created demo user: {user.email}")
            else:
                print(f"  Using existing user: {user.email}")

            semi = await seed_semiconductor_dataset(session, user.id)
            print(f"  Created dataset: {semi.name}")
            await seed_demo_modules(session, semi, 7, user.id)
            print(f"    → 7 modules seeded")

            gdelt = await seed_gdelt_dataset(session, user.id)
            print(f"  Created dataset: {gdelt.name}")
            await seed_demo_modules(session, gdelt, 16, user.id)
            print(f"    → 16 modules seeded")

            edgar = await seed_sec_edgar_dataset(session, user.id)
            print(f"  Created dataset: {edgar.name}")
            await seed_demo_modules(session, edgar, 12, user.id)
            print(f"    → 12 modules seeded")

    print("\nDemo data seeded successfully!")
    print("3 datasets with 35 total modules ready to explore.")

if __name__ == "__main__":
    asyncio.run(main())
