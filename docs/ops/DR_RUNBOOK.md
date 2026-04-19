# Disaster Recovery Runbook

Operational procedures for Latent Ocean production. Refer to `SLO.md` for
targets and `CAPACITY.md` for sizing. Practiced quarterly.

## RTO / RPO targets

| Scenario | RTO | RPO |
|---|---|---|
| Single backend pod crash | 0s (load-balancer removes) | 0 |
| Postgres primary failure | 30s (replica promoted) | ≤ 5s (synchronous_commit=on) |
| Redis primary failure | 5s (Sentinel failover) | ≤ 1s |
| Neo4j core failure | 10s (causal cluster quorum) | 0 |
| Full region loss | 15m | 5m (continuous WAL shipping to DR region) |
| MinIO drive failure | 0s (erasure coding, 2 drives can fail) | 0 |
| Full data-loss event | 4h | 24h (daily snapshot + WAL) |

## Runbook 01 — Postgres primary failure

**Detection:** Prometheus alert `postgres_primary_unreachable` fires OR
health-check on `postgres-primary` fails 3 consecutive times.

**Procedure:**
1. On-call engineer ACKs the page within 5 minutes.
2. Run `scripts/ops/pg_promote_replica.sh` — this:
   a. Verifies replica lag < 5s via `SELECT pg_last_wal_receive_lsn()`
   b. Runs `pg_ctl promote` on the replica
   c. Updates DNS `postgres-primary.internal` → replica IP
   d. Notifies backend pods via Consul/etcd to re-resolve
3. Confirm `/health` returns 200 on all backends within 60s.
4. Open incident ticket, start RCA.
5. Provision new standby replica (automated via Terraform):
   - `cd infra/terraform && terraform apply -var standby_count=1`
6. Validate replica WAL catches up within 10 minutes.

**Rollback:** If promotion fails, restore from last snapshot (see Runbook 05).

## Runbook 02 — Redis Sentinel failover

**Detection:** Sentinel majority declares primary down → Redis clients
auto-reconnect to new primary. No manual action typically needed.

**If sentinels lose quorum (e.g. network partition):**
1. Identify reachable sentinel majority.
2. Restart partitioned sentinels with `docker compose restart redis-sentinel-N`.
3. Verify quorum restored: `redis-cli -p 26379 sentinel ckquorum mymaster` returns `OK 3 voters`.

## Runbook 03 — Neo4j causal cluster loss of quorum

**Detection:** Neo4j write operations fail with `NotALeaderError` or
`Unavailable`.

**Procedure:**
1. Check cluster state: `CALL dbms.cluster.overview()`.
2. If ≥ 2 of 3 cores are healthy, leader election recovers automatically.
3. If only 1 core: manually add replacement core:
   - `docker compose up -d neo4j-core-replacement`
   - Seed from snapshot: `neo4j-admin restore --from=/backups/latest`
4. Wait for Raft quorum re-establishment (~2 minutes).

## Runbook 04 — Full region failure (DR region activation)

**Detection:** Primary region unreachable for > 5 minutes.

**Procedure:**
1. Incident commander declares regional failover.
2. Update DNS:
   - `api.latentocean.com` → DR region load balancer
3. Promote DR Postgres (warm standby with continuous WAL shipping).
4. Validate DR region backend fleet (`curl https://api.dr.latentocean.com/health`).
5. Notify customers via status page.

**Expected data loss:** up to 5 minutes (RPO) depending on WAL lag.

**Post-recovery:** rebuild original region, re-establish as DR.

## Runbook 05 — Point-in-time restore from backup

**Detection:** Data corruption / accidental DELETE / encryption ransomware.

**Procedure:**
1. Identify restore target time.
2. Provision new Postgres instance.
3. `pg_basebackup` from latest base + replay WAL to target time:
   ```
   pg_basebackup -h backup-store -D /var/lib/postgresql/data
   echo "restore_command = 'cp /wal/%f %p'" >> recovery.conf
   echo "recovery_target_time = '2026-04-19 14:00:00'" >> recovery.conf
   pg_ctl start
   ```
4. Validate row counts match pre-incident.
5. Cutover DNS.

## Runbook 06 — Celery worker pool saturation

**Detection:** Queue depth alert fires (`celery_queue_depth{queue="crystallization"} > 1000`).

**Procedure:**
1. Scale up: `kubectl scale deployment/celery-crystallization --replicas=8`
2. Identify slow task via `celery inspect active`.
3. If a poison task: `celery control revoke <task_id>` and investigate.

## Runbook 07 — Security incident (intrusion suspected)

**Procedure:**
1. Immediately rotate all secrets: JWT signing keys, DB passwords, MinIO credentials, Redis auth tokens, Neo4j credentials.
2. Revoke all active sessions (`UPDATE sessions SET revoked=true`).
3. Enable read-only mode on all backend pods (feature flag).
4. Dump audit log from `edge/security/immutable_audit.py` stream.
5. Engage IR team / contracted SOC provider.
6. Preserve logs in forensic-grade storage (WORM bucket).

## Runbook 08 — Quarterly DR drill

**Procedure (last Friday of each quarter):**
1. 09:00 — Announce drill window to internal channel.
2. 09:15 — Kill Postgres primary (controlled).
3. Measure: time to promote replica, time to restore service, data lag.
4. 09:45 — Kill one Redis primary.
5. 10:15 — Simulate region failure (redirect traffic to DR).
6. Record all metrics in `docs/ops/dr-drills/<date>.md`.
7. File any SLO-violation tickets found.

## On-call rotation

- Primary: rotated weekly, carries production pager.
- Secondary: escalation within 15 minutes.
- Incident Commander: for sev-1 only.

## Post-incident review template

- Timeline
- Root cause (5-why analysis)
- What went well
- What went poorly
- Action items (tracked in ticketing system, 30-day SLA)
- Publish within 5 business days.

## Status

This runbook is the **documented procedure**. The procedures have been **dry-run designed**, not yet **quarterly-exercised**. First drill scheduled after HA stack stands up in a staging environment.
