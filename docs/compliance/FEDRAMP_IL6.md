# FedRAMP IL6 Readiness Matrix

IL6 is the highest DoD Impact Level for unclassified-but-controlled
data. Required for deployments into DoD / IC customer environments.

**Status:** *pre-authorization*. Requires sponsoring agency engagement.
This matrix captures the engineering posture that makes IL6 tractable
when a sponsor steps forward — it does NOT claim current ATO.

## Baseline

FedRAMP IL6 inherits from NIST 800-53 Rev 5 (High baseline) + DoD
Cloud Computing SRG v1r4 additions.

## Control family coverage

### AC — Access Control

| Control | Status | Artifact |
|---|---|---|
| AC-2 Account Management | ✓ JWT + session revocation, tenant-scoped | `backend/app/core/auth.py` |
| AC-3 Access Enforcement | ✓ Dependency injection per route | FastAPI `Depends()` chain |
| AC-4 Information Flow Enforcement | ✓ Air-gap validator | `edge/network/air_gap_validator.py` |
| AC-6 Least Privilege | ✓ RBAC with deny-by-default | `backend/app/models/user.py` |
| AC-7 Unsuccessful Logon Attempts | ✓ Rate limit + account lock | `backend/app/core/auth.py` |
| AC-17 Remote Access | ✓ TLS 1.3 + client cert on edge | nginx config |
| AC-20 External Systems | ⚠ Requires vendor assessments (per-deployment) | `docs/vendors/` |

### AU — Audit & Accountability

| Control | Status | Artifact |
|---|---|---|
| AU-2 Event Logging | ✓ Every API call logged with request_id | `RequestIDMiddleware` |
| AU-3 Content of Logs | ✓ Who/what/when/where/outcome | `edge/security/immutable_audit.py` |
| AU-4 Storage Capacity | ✓ WORM archival + segment rotation | Runbook 07 |
| AU-6 Review, Analysis, Reporting | ✓ SIEM-ready export | `audit/siem_export.py` |
| AU-9 Protection of Audit Info | ✓ Immutable log + cryptographic chaining | `immutable_audit.py` |
| AU-10 Non-repudiation | ✓ Ed25519 signatures on audit entries | FIPS primitives |
| AU-11 Audit Record Retention | ✓ 7-year default; configurable per tenant | `governance/retention_manager.py` |

### CM — Configuration Management

| Control | Status | Artifact |
|---|---|---|
| CM-2 Baseline Configuration | ✓ Everything in git; versioned IaC | `docker-compose.*.yml`, Terraform |
| CM-3 Configuration Change Control | ✓ PR + review + signed commits | GitHub branch protection |
| CM-6 Configuration Settings | ✓ Hardened Dockerfiles; no default passwords | `edge/build/Dockerfile.edge` |
| CM-7 Least Functionality | ✓ Minimal base images (Alpine); no shell in prod image | build pipeline |
| CM-8 System Component Inventory | ✓ SBOM generated per build | `.github/workflows/security.yml` (Syft CycloneDX) |

### CP — Contingency Planning

| Control | Status | Artifact |
|---|---|---|
| CP-2 Contingency Plan | ✓ DR runbook with RTO/RPO | `docs/ops/DR_RUNBOOK.md` |
| CP-4 Contingency Plan Testing | ⚠ Quarterly drills specified, not yet executed | Runbook 08 |
| CP-9 System Backup | ✓ Postgres WAL + base snapshots; MinIO versioning | Runbook 05 |
| CP-10 Recovery | ✓ Point-in-time restore procedure | Runbook 05 |

### IA — Identification & Authentication

| Control | Status | Artifact |
|---|---|---|
| IA-2 Identification + Authentication | ✓ JWT + MFA optional per tenant | `backend/app/api/v1/auth.py` |
| IA-5 Authenticator Management | ✓ Rotation + complexity + history | Rotation runbook |
| IA-7 Cryptographic Module Authentication | ✓ FIPS 140-2 validated primitives | `edge/security/fips_crypto.py` |

### SC — System & Communications Protection

| Control | Status | Artifact |
|---|---|---|
| SC-7 Boundary Protection | ✓ WAF + nginx + network ACLs + zero-trust topology | `docs/compliance/ZERO_TRUST.md` |
| SC-8 Transmission Confidentiality | ✓ TLS 1.3 + HSTS; AES-256-GCM | `edge/security/fips_crypto.py` |
| SC-12 Cryptographic Key Establishment | ✓ Ed25519 + HSM for signing (when deployed) | FIPS module |
| SC-13 Cryptographic Protection | ✓ FIPS 140-2 primitives only | `edge/security/fips_crypto.py` |
| SC-28 Protection of Information at Rest | ✓ AES-256-GCM; MinIO SSE | cold storage tier |
| SC-39 Process Isolation | ✓ Fork-template per tenant | `lo_platform/fork_template/` |

### SI — System & Information Integrity

| Control | Status | Artifact |
|---|---|---|
| SI-2 Flaw Remediation | ✓ Daily Trivy scan + dependabot | `.github/workflows/security.yml` |
| SI-3 Malicious Code Protection | ✓ Base image scanning + runtime anomaly detection | Same workflow |
| SI-4 System Monitoring | ✓ Prometheus + alert rules | `/metrics`, `docs/ops/SLO.md` |
| SI-7 Software & Information Integrity | ✓ Cosign image signing + SBOM attestation | `.github/workflows/security.yml` |
| SI-10 Information Input Validation | ✓ Pydantic on every endpoint | FastAPI schemas |
| SI-11 Error Handling | ✓ Structured error responses; no stack traces in prod | `core/exceptions.py` |

## IL6-specific additions beyond High baseline

| Requirement | Status | Artifact |
|---|---|---|
| Dedicated DoD-accredited infrastructure | ⚠ Requires AWS GovCloud / Azure Gov / IL6-approved provider | Deployment-specific |
| Air-gapped deployment mode | ✓ `edge/` layer with FIPS crypto, no outbound traffic | `edge/network/air_gap_validator.py` |
| DoD PKI integration | ⚠ SAML/CAC integration specified; not implemented | Per-customer engagement |
| Personnel clearances | ✓ Clearance-aware access control | `edge/security/clearance.py` |
| Data classification enforcement | ✓ SECRET/CONFIDENTIAL/UNCLASSIFIED hierarchy | `edge/security/classification.py` |
| Offline signed updates | ✓ | `edge/updates/signature_verifier.py`, `offline_updater.py` |

## ATO path

1. Sponsor identified (customer agency)
2. eMASS package drafted from this matrix
3. Independent Assessor (3PAO) engaged
4. Security Assessment Report (SAR) produced
5. Agency AO issues ATO
6. Continuous monitoring (ConMon) established

Typical timeline: 12-18 months after sponsor commitment.

## Honest gaps

- No current sponsor. This is a capability posture doc; an ATO requires a government customer to own the sponsorship.
- Personnel clearance verification is architecturally supported (`clearance.py`) but requires integration with customer clearance database.
- eMASS package preparation has not started.
- No 3PAO engaged.
