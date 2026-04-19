# Failure-Mode Catalogue

Enumerates what breaks at 10x / 100x / 1000x current tested load, with
mitigation path for each. Not a rumor list — each row has a concrete
failure symptom + a documented fix.

## Legend

- **Current tested load** = 1,851-entity heterogeneous corpus, 1,195 polymath survivors, 150 concurrent ops across 15 tenants, 287 RPS `/health`, 135 RPS `/lo/analyze`.
- **10x** = ~18,000 entities / ~12,000 survivors / 150 tenants × 100 ops / 1,350 RPS `/lo/analyze`
- **100x** = ~180,000 entities / ~120,000 survivors / 1,500 tenants / 13,500 RPS
- **1000x** = ~1.8M entities / ~1.2M survivors / 15,000 tenants / 135,000 RPS

## Failure-mode table

| # | Subsystem | Failure at ~10x | Failure at ~100x | Failure at ~1000x | Mitigation |
|---|---|---|---|---|---|
| 1 | BTUT pipeline (`run_btut_pipeline`) | Memory pressure on single-process numpy arrays ~500 MB peak | OOM kill on 16 GB pod; pipeline aborts | Infeasible — in-memory model broken | **Streaming BTUT** (`lo_core.streaming.ChunkedSurvivorStream`) + **PartitionedLattice** (deterministic 64-way) |
| 2 | Lattice fingerprint merge | O(N²) pairwise comparison slows to ~seconds | Minutes per merge; user-visible | Fails SLO entirely | Partitioned merge: `PartitionedLattice.merge()` O(N/P) per partition |
| 3 | BTUT embedder model load | Cold start adds ~2s to first request | Thundering-herd retraining from disk | 5xx during rolling restart | Preload at pod-start; pin model to ephemeral volume |
| 4 | Postgres (single-instance) | p95 query latency rises from 15ms → 80ms | Connection pool exhaustion (>200 conns) | Write storm; replica lag > 1min | **HA pair** (`docker-compose.ha.yml`) + read-replica routing + PgBouncer |
| 5 | Redis single-instance | Eviction pressure; cache-hit % drops | Full memory; commands fail | Hard failure; no session state | **Redis Sentinel** (3 nodes) + per-tenant key prefix + bounded TTL |
| 6 | Neo4j single-core | Query planner slowdown | Lock contention; write stalls | Cluster split brain | **Causal cluster** (3 cores); route reads to followers |
| 7 | MinIO single-node | Backpressure; object PUT 4xx | Disk full; service unavailable | Multi-drive failure unrecoverable | Distributed MinIO (4+ drives), erasure coding 2+2 |
| 8 | FastAPI backend (single pod) | CPU-bound; event loop stalls | Timeout cascade | Pod crash-loop | Horizontal scale (6+ pods) + nginx `least_conn` |
| 9 | Celery crystallization queue | Queue depth > 100 | Task backlog; hour-long delay | RunPod GPU budget exhausted | Queue per priority; autoscale workers; GPU budget alarm |
| 10 | `lo_analyze` endpoint | p95 rises 345 → 1200ms | Timeout at 30s default | Uvicorn worker exhaustion | Move large corpora to async job endpoint (`POST /lo/analyze/async` → 202 + Celery) |
| 11 | `lo_validate` endpoint | N=30 iterations = 30s at 4 corpora; timeout risk | Order-of-minutes; must be async | Infeasible inline | Always async; return job_id; fan-out null iterations as map-reduce |
| 12 | Fork-template provisioning | Docker pull per tenant creates registry pressure | Registry rate-limited; new-tenant onboarding delays 10+ min | Kubernetes API rate-limit | Image pre-pull DaemonSet; fork-template base image cached; provision-ahead pool |
| 13 | Billing / metering aggregation | Hourly aggregation window grows | Aggregation job OOMs | Skew between billing + usage | Stream aggregation (per-minute windows) into materialized view |
| 14 | Prometheus `/metrics` scrape | Label cardinality explodes per tenant | Prometheus OOM | Cardinality bomb | Hash tenant_id to 256 buckets in label; per-tenant metrics in a separate long-term store (Cortex/Mimir) |
| 15 | WebSocket pool (`ws.py`) | Per-pod socket count > 10k | Kernel fd exhaustion | HA broadcast fan-out becomes O(N²) | Dedicated WS pods + Redis pub/sub for fan-out |
| 16 | Auth / JWT validation | CPU-bound signature verification | Cache miss on JWKS | Rotation storm | JWT cache per pod (1 min TTL); HSM for signing; signing key rotation runbook |
| 17 | Audit log (`edge/security/immutable_audit.py`) | Log file grows GB/hour | File locking contention | Write amplification | Append-only segmented log; forward to WORM storage (S3 Object Lock) |
| 18 | Feature flag lookup | Database query per request | p95 rises 20ms | Cache stampede | Unleash/ConfigCat with local cache + push invalidation |
| 19 | CORS middleware | Allow-origin list scans | Same perf | OK | n/a — no scale issue |
| 20 | Dataset ingestion adapters | Connection leak on long-running import | Source-side rate-limit | Upstream saturation | Backpressure + Kafka as buffer for > 1 GB/s sustained |

## Chaos injection coverage

Proposed chaos experiments (tracked in `tests/chaos/` — to be run quarterly):

| Experiment | Injection | Expected recovery |
|---|---|---|
| `pg_primary_kill` | `docker kill postgres-primary` | Replica promoted < 30s; no data loss |
| `redis_master_kill` | `docker kill redis-1` | Sentinel failover < 5s |
| `neo4j_core_kill` | `docker kill neo4j-core-1` | Leader re-election < 10s |
| `backend_random_kill` | Kill one of 6 backends every 30s | LB routes around; zero 5xx |
| `network_partition_50%` | tc netem delay/loss 50% between app + data networks | Client retries; no data corruption |
| `cpu_exhaust` | stress-ng --cpu 100% on one backend | Autoscaler scales out; p95 remains < 2x SLO |
| `memory_exhaust` | stress-ng --vm 95% on one backend | OOMKiller terminates; pod restarts; no cascade |
| `disk_fill_minio` | fill MinIO data volume | Object PUTs return 507; alerts fire |
| `celery_worker_hang` | SIGSTOP one worker | Task redelivered to peer within visibility_timeout |
| `slow_query_storm` | 100 expensive queries | Connection pool backpressure; circuit breaker isolates |

## Status

- Items 1-2 have **working prototype code** in `lo_core/streaming.py` with **5/5 passing tests**.
- Items 4-7 have **infrastructure templates** in `docker-compose.ha.yml`.
- Items 8, 10-12 are **engineering plans, not yet stood up** in a production environment.
- Chaos experiments 1-10 are **specified, not yet automated**. Each blocks on the HA stack standing up in staging.
