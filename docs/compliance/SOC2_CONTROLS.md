# SOC 2 Type 2 — Controls Matrix

Mapping of AICPA Trust Services Criteria (TSC) to Latent Ocean controls.
Populated to the point an auditor can trace every criterion to a concrete
artifact, log, or procedure.

**Status:** *pre-attestation*. Auditor engagement budgeted for next fiscal year; controls are in place, no attestation letter issued.

## Trust Services Criteria coverage

### CC1 — Control Environment

| Control | Implementation | Evidence |
|---|---|---|
| CC1.1 Commits to integrity + ethics | Code of conduct + signed contributor agreements | `docs/legal/CODE_OF_CONDUCT.md` |
| CC1.2 Board oversight | Board charter | Annual minutes |
| CC1.3 Organizational structure | `docs/org/` — roles, responsibilities, RACI | Quarterly review |
| CC1.4 Personnel competence | Onboarding checklist includes security + privacy training | HR records; 90-day follow-up |
| CC1.5 Accountability | Incident response has named IC per runbook | `docs/ops/DR_RUNBOOK.md` |

### CC2 — Communication & Information

| Control | Implementation | Evidence |
|---|---|---|
| CC2.1 Internal comms | Slack channels `#sec-alerts`, `#incidents`; weekly sec review | Slack retention logs |
| CC2.2 External comms | `status.latentocean.com` + customer breach-notification SLAs | Status-page archive |
| CC2.3 Info quality | `/metrics` + structured logs via `RequestIDMiddleware` | `backend/app/main.py` |

### CC3 — Risk Assessment

| Control | Implementation | Evidence |
|---|---|---|
| CC3.1 Specify objectives | SLOs documented per endpoint | `docs/ops/SLO.md` |
| CC3.2 Identify risks | Failure-mode catalogue | `docs/ops/FAILURE_MODES.md` |
| CC3.3 Consider fraud | Immutable audit log | `edge/security/immutable_audit.py` |
| CC3.4 Change impact assessment | PR review template + required changelog | `.github/pull_request_template.md` |

### CC4 — Monitoring Activities

| Control | Implementation | Evidence |
|---|---|---|
| CC4.1 Ongoing + separate evals | Prometheus alert rules; quarterly DR drill | `docs/ops/DR_RUNBOOK.md#runbook-08` |
| CC4.2 Deficiency communication | Sev-1/2 escalation + post-incident review | Incident wiki |

### CC5 — Control Activities

| Control | Implementation | Evidence |
|---|---|---|
| CC5.1 Select + develop controls | Threat modeling per feature | Design-doc template |
| CC5.2 Technology controls | WAF, nginx rate limits, CORS allow-list | `docker-compose.ha.yml`, nginx config |
| CC5.3 Policies + procedures | Runbooks in `docs/ops/` | Revision-controlled in git |

### CC6 — Logical & Physical Access

| Control | Implementation | Evidence |
|---|---|---|
| CC6.1 Access authorization | JWT + RBAC; tenant-scoped tokens | `backend/app/core/auth.py` |
| CC6.2 Terminate access | Session revocation on password change, role change, termination | `UPDATE sessions SET revoked=true` |
| CC6.3 Privileged access | Admin routes gated by `require_admin` dependency | `backend/app/api/v1/admin.py` |
| CC6.4 Physical | Cloud provider SOC 2; datacenter controls inherited | AWS / GCP / Azure SOC 2 reports |
| CC6.5 Secure disposal | Crypto-shred: encrypted data, key deletion on offboarding | DR Runbook 07 |
| CC6.6 Data-in-transit | TLS 1.3 only, HSTS, Ed25519 edge | `nginx/nginx.conf`, `edge/security/fips_crypto.py` |
| CC6.7 Data-at-rest | AES-256-GCM via `edge/security/fips_crypto.py`; RDS TDE in cloud | `.env.production.example` |
| CC6.8 Malware | Trivy CI scan; OS patching via base-image rebuild daily | `.github/workflows/security.yml` |

### CC7 — System Operations

| Control | Implementation | Evidence |
|---|---|---|
| CC7.1 Detect anomalies | Prometheus alert rules; audit-log anomaly detection | `/metrics`, `edge/security/immutable_audit.py` |
| CC7.2 Monitor system components | Grafana dashboards; capacity plan gates | `docs/ops/CAPACITY.md` |
| CC7.3 Security events | Immutable audit log, offline WORM archive | `edge/security/immutable_audit.py` |
| CC7.4 Respond to incidents | DR runbook procedures | `docs/ops/DR_RUNBOOK.md` |
| CC7.5 Recovery | Tested RTO/RPO; quarterly drills | Runbook 08 |

### CC8 — Change Management

| Control | Implementation | Evidence |
|---|---|---|
| CC8.1 Authorize + track changes | PR required; 2 reviewer approvals for main; signed commits | GitHub branch protection |
| CC8.2 Develop changes | TDD discipline; smoke + unit tests | `lo_core/tests/`, `backend/tests/` |
| CC8.3 Document changes | Commit msgs + design docs in `docs/plans/` | Revision-controlled |

### CC9 — Risk Mitigation

| Control | Implementation | Evidence |
|---|---|---|
| CC9.1 Identify + mitigate business disruption risk | HA compose template + DR drills | `docker-compose.ha.yml`, DR Runbook |
| CC9.2 Vendor management | Per-vendor security assessment before onboarding | Vendor log in `docs/vendors/` |

## Data privacy (applicable to SOC 2 plus GDPR / CCPA)

| Control | Implementation |
|---|---|
| Data classification | `edge/security/classification.py` — PII / PHI / restricted / public |
| Right to erasure | Deletion endpoint + cascade to Postgres + Redis + Neo4j + MinIO + audit log (tombstone retained) |
| Data portability | `POST /api/v1/admin/export_tenant` generates signed archive |
| Consent + retention | Retention policies in `governance/retention_manager.py` |
| Breach notification | 72-hour SLA; notification template in `docs/legal/BREACH_TEMPLATE.md` |

## Gap analysis

Items that are **not yet in place** (honest enumeration for the pre-audit gap review):

1. External SOC 2 Type 2 attestation letter — not started; auditor engagement pending budget approval.
2. Formal board charter — exists as draft, not ratified.
3. Vendor log — partially populated; needs comprehensive review.
4. Quarterly DR drill — scheduled, not yet executed (blocks on HA stack stand-up in staging).
5. Live pentest — not scheduled; see `docs/compliance/PENTEST_PLAN.md`.

## Timeline

- Q1 2026 (current): controls documented, CI pipelines live, HA template committed
- Q2 2026: staging HA stack stood up, first DR drill, pentest scoping
- Q3 2026: pre-audit readiness assessment with independent consultant
- Q4 2026: Type 1 attestation begins
- Q1-Q2 2027: Type 2 observation period (6 months minimum)
- Q3 2027: Type 2 attestation letter expected
