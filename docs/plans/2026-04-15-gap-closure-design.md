# Gap Closure Design: Production-Readiness Push

## Date: 2026-04-15

## Context
226 files built across 10 packages. Engine is functional. Three critical gaps identified plus 7 additional gaps discovered during exploration. This design closes all 10.

## Section 1: PostgreSQL Integration Tests + Edge Case Fixes
- Test connector against dev PostgreSQL (latent_intelligence DB, 20+ existing tables)
- Test materializer creates lo_* tables in test schema, writes UPSERT data
- Fix: tables with no PKs, empty tables, JSON columns, case-sensitive schemas
- Full customer flow: connect → introspect → reduce → materialize → verify

## Section 2: Docker SDK Provisioner
- Replace 6 subprocess.run() calls with docker-py SDK
- Create ContainerOrchestrator ABC with DockerOrchestrator implementation
- Proper retry logic, streaming logs, health check verification
- KubernetesOrchestrator stub for future

## Section 3: Frontend Module Wiring
- Register module_marketplace router in app/api/v1/__init__.py
- Refactor Sidebar.tsx: core sections hardcoded + dynamic modules from registry
- Add ModuleProvider to app/layout.tsx
- Verify manifest.ts exists and types are correct

## Section 4: Engine Package Distribution
- Create backend/engine/pyproject.toml for standalone pip install
- Declare numpy, scikit-learn as dependencies (no FastAPI, no SQLAlchemy)

## Section 5: Additional Hardening
- Materializer error handling for partial failures
- Connector edge cases (no PK fallback, JSON serialization, schema case)
- Dry-run mode for materializer
