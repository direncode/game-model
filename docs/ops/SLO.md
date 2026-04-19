# Service Level Objectives

Targets for the production Latent Ocean backend. Enforced via `/metrics` + Prometheus alerting.

## Availability targets

| Service | Target | Measurement window |
|---|---|---|
| `/api/v1/lo/health` | 99.95% | 30 days |
| `/api/v1/lo/analyze` | 99.9% | 30 days |
| `/api/v1/lo/validate` | 99.5% | 30 days (long-running, N iterations) |
| `/api/v1/lo/narrate` | 99.9% | 30 days |
| `/engine` (frontend static) | 99.95% | 30 days |
| `POST /api/v1/btut/reduce` | 99.5% | 30 days |
| `POST /api/v1/crystallization/*` | 99% | 30 days (GPU worker dependency) |

## Latency targets (p95)

| Endpoint | p50 | p95 | p99 |
|---|---|---|---|
| `GET /api/v1/lo/health` | 5ms | 30ms | 100ms |
| `POST /api/v1/lo/analyze` (300 survivors) | 120ms | 400ms | 1000ms |
| `POST /api/v1/lo/analyze` (1200 survivors) | 400ms | 1500ms | 3000ms |
| `POST /api/v1/lo/validate` (N=30, 4 corpora) | 4s | 12s | 25s |
| `POST /api/v1/lo/narrate` | 50ms | 150ms | 400ms |

## Throughput targets

| Endpoint | RPS (single backend pod) | RPS (6-pod fleet) |
|---|---|---|
| `/api/v1/lo/health` | 2000 | 12,000 |
| `/api/v1/lo/analyze` (300 survivors) | 50 | 300 |
| `/api/v1/lo/narrate` | 500 | 3000 |
| `/api/v1/lo/validate` | 2 (CPU-bound) | 12 |

## Error budget

- **0.1% error rate** ceiling for `lo/analyze` and `lo/narrate`
- **0.5% error rate** ceiling for `lo/validate` (allows longer runs + timeout)
- Error = 5xx response, timeout, or dependency failure

## Dependency SLOs (downstream contributions)

| Dependency | Availability | p95 latency |
|---|---|---|
| Postgres (HA pair) | 99.95% | < 20ms read |
| Redis (Sentinel) | 99.9% | < 2ms |
| Neo4j | 99.5% | < 50ms |
| RunPod GPU workers | 99% | job dispatch < 5s |
| MinIO | 99.9% | < 100ms object GET |

## Alerting thresholds

| Severity | Condition |
|---|---|
| `critical` | p95 latency > 2x target for 5 min |
| `critical` | error rate > 2x SLO ceiling for 10 min |
| `critical` | `/metrics` endpoint returns 5xx or unreachable |
| `warn` | p95 latency > 1.5x target for 10 min |
| `warn` | error budget burn rate > 10x |
| `info` | p99 latency > target |

## Status

As of 2026-04-19: **load-tested locally, not yet SLO-validated in a sovereign production environment.** The targets above are engineering commitments, not attested measurements.
