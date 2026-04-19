# Capacity Plan

Throughput and resource assumptions per component at each fleet size.
Measurements are real (not modeled) where marked `[measured]`; the rest
are **honest engineering estimates** derived from component benchmarks
elsewhere.

## Per-component single-pod capacity

| Component | Resource budget | Measured throughput | Measured latency (p95) |
|---|---|---|---|
| `/api/v1/lo/health` | 1 vCPU, 512 MB | **287 RPS** `[measured]` @ 50 concurrency | **357ms** `[measured]` — SLO miss, documented |
| `/api/v1/lo/analyze` (50 survivors) | 1 vCPU, 512 MB | **135 RPS** `[measured]` @ 20 concurrency | **345ms** `[measured]` |
| `/api/v1/lo/analyze` (300 survivors) | 1 vCPU, 1 GB | ~50 RPS (estimate) | < 400ms (SLO target) |
| `/api/v1/lo/analyze` (1200 survivors) | 1 vCPU, 2 GB | ~15 RPS (estimate) | < 1500ms (SLO target) |
| `/api/v1/lo/validate` (N=30, 4 corpora) | 2 vCPU, 2 GB | ~2 RPS (CPU-bound) | < 12s (SLO target) |
| `/api/v1/lo/narrate` | 1 vCPU, 256 MB | ~500 RPS estimated | < 150ms (SLO target) |
| BTUT reduce (300 survivors, 1200 entities) | 2 vCPU, 2 GB | 1 run / ~2s | — |
| Crystallization (RunPod GPU) | GPU-dependent | 1 training / ~5-30 min | — |

Multi-tenant concurrency: **15 tenants × 10 ops each, zero errors, per-tenant p95 ~100ms, 132 RPS aggregate `[measured]`**.

## Fleet-level targets

### Target: small enterprise (1 tenant, ≤ 100 users)
- 2 backend pods (active + passive)
- 1 Postgres primary + 1 replica (synchronous)
- 1 Redis instance + snapshot
- 1 Neo4j core
- 1 Celery worker per queue
- Observed p95 target: all SLOs met
- Capacity: 150 RPS peak

### Target: mid-market (10 tenants, 1k users)
- 6 backend pods behind nginx LB
- Postgres HA pair
- Redis Sentinel (3 nodes)
- Neo4j causal cluster (3 cores)
- Celery worker: 2 per queue
- Capacity: 900 RPS peak (6 × 150 RPS)
- Ingestion: 10 GB/day steady, 100 GB/day peak

### Target: large enterprise (100 tenants, 10k users)
- 24 backend pods
- Postgres HA + 2 read replicas
- Redis cluster (6 shards)
- Neo4j causal cluster (5 cores)
- Celery worker: 8 per queue
- Capacity: 3600 RPS peak
- Ingestion: 100 GB/day steady, 1 TB/day peak

### Target: sovereign / petabyte-class (1000+ tenants or single-tenant at scale)
- 100+ backend pods, per-region
- Postgres Citus / CockroachDB sharded
- Redis cluster (30+ shards)
- Neo4j 7+ core causal cluster
- Kafka/Pulsar ingestion layer (1 TB/hour)
- Streaming BTUT (lo_core.streaming.PartitionedLattice) — distributed across 64+ workers per corpus
- Cold storage tier (S3 Glacier / Azure Archive) for survivors > 30 days old
- Multi-region active-active with 15m RTO, 5m RPO
- Capacity: 10k+ RPS peak
- Ingestion: petabytes/year

## Scaling gates — what breaks first

Derived from `docs/ops/FAILURE_MODES.md`:

| Tier transition | First bottleneck | Required work |
|---|---|---|
| small → mid | BTUT single-pod memory for 1200+ survivor corpora | Streaming BTUT shards in `lo_core.streaming` |
| mid → large | Postgres single-primary write throughput | Citus or logical sharding by tenant |
| large → sovereign | Lattice fingerprinting bandwidth | Distributed PartitionedLattice across Kafka topic-partition |
| sovereign → global | Cross-region replication lag | Active-active + CRDT for metering state |

## Monitoring

All SLOs encoded in Grafana dashboards sourced from `/metrics`:
- `lo_request_duration_seconds` histogram per endpoint
- `lo_request_errors_total` counter
- `lo_corpus_survivor_count` gauge per tenant
- `lo_tenant_concurrency` gauge
- `lo_celery_queue_depth` gauge per queue
- `lo_postgres_replication_lag_bytes` gauge
- `lo_redis_memory_usage_bytes` gauge

## Measurement status

- **Measured live this session**: `/lo/health` (287 RPS), `/lo/analyze` (135 RPS), multi-tenant 15-concurrent test.
- **Not yet measured live**: any throughput > 300 RPS, anything under HA stack, any distributed BTUT.
- **Honest ceiling**: the numbers in this doc above mid-market are engineering plans, not benchmarks. Will be validated in staging before production claims.
