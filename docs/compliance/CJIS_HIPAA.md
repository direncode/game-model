# CJIS + HIPAA Compliance Matrix

Combined because Latent Ocean's edge layer supports both. Not a single
certification — each customer deployment inherits or declares its own.

## CJIS (Criminal Justice Information Services) v5.9

FBI CJIS Security Policy is required for any deployment handling CJI
(Criminal Justice Information). Latent Ocean provides the controls; the
customer agency owns the CSO/ISO relationship.

### Area 5.1 — Information Exchange Agreements

| Control | Implementation |
|---|---|
| 5.1.1 Agreement in place between agencies | Customer responsibility; Latent Ocean supplies CJIS Security Addendum template |

### Area 5.2 — Security Awareness Training

| Control | Implementation |
|---|---|
| 5.2.1 All personnel with CJI access trained | Customer responsibility + annual Latent Ocean security training for staff |
| 5.2.1.2 Specialized role training | RBAC enforces role assignments; `edge/security/clearance.py` gates access to role-specific data |

### Area 5.3 — Incident Response

| Control | Implementation |
|---|---|
| 5.3.1 IR capability | `docs/ops/DR_RUNBOOK.md#runbook-07` Security incident procedure |
| 5.3.2 IR reporting to CJIS Systems Agency | Customer-facing hook in audit log export |

### Area 5.4 — Auditing & Accountability

| Control | Implementation |
|---|---|
| 5.4.1 Audit of CJIS accesses | `edge/security/immutable_audit.py` — every access logged |
| 5.4.1.1 Audit events include success + failure | Yes, all status codes logged |
| 5.4.3 Protection of audit info | Immutable log, Ed25519 chaining |

### Area 5.5 — Access Control

| Control | Implementation |
|---|---|
| 5.5.1 Account Management | JWT + tenant scoping |
| 5.5.2 Access Enforcement | RBAC via FastAPI dependency graph |
| 5.5.3 Unsuccessful Login Attempts | Rate limit + lockout after 5 failed attempts |
| 5.5.5 System Use Notification | Login banner (customer-configurable) |
| 5.5.6 Session Lock / Timeout | 15-minute idle timeout default |

### Area 5.6 — Identification & Authentication

| Control | Implementation |
|---|---|
| 5.6.2 Advanced Authentication | MFA via TOTP + optional hardware token |
| 5.6.2.2 MFA for CJI access | Enforced per tenant policy; CAC/PIV integration available |

### Area 5.7 — Configuration Management

| Control | Implementation |
|---|---|
| 5.7.1 Baseline config | `docker-compose.*.yml`, SBOM via Syft |
| 5.7.1.2 Least functionality | Minimal Alpine images, distroless for edge |

### Area 5.8 — Media Protection

| Control | Implementation |
|---|---|
| 5.8.2 Media sanitization | Crypto-shred via encrypted-at-rest + key revocation |

### Area 5.9 — Physical Protection

| Control | Implementation |
|---|---|
| 5.9.1 Physically secure locations | Customer-owned in edge deployments; cloud provider SOC 2 for hosted |

### Area 5.10 — System & Communications Protection

| Control | Implementation |
|---|---|
| 5.10.1.2 Boundary protection | WAF + nginx LB + network ACLs |
| 5.10.1.2.2 Encryption — in transit | TLS 1.3 + HSTS |
| 5.10.1.2.2 Encryption — at rest | AES-256-GCM (FIPS validated) |
| 5.10.1.4 Integrity of system components | Cosign image signatures + SBOM attestation |

### Area 5.11 — Formal Audits

| Control | Implementation |
|---|---|
| 5.11.1 Triennial audit | Customer-CSA audit; Latent Ocean provides evidence packet |

## HIPAA — Security Rule (45 CFR §164.308-312)

For PHI handling. HIPAA isn't a certification — covered entities and
business associates self-attest.

### § 164.308 — Administrative Safeguards

| Standard | Control |
|---|---|
| (a)(1)(i) Security management process | SOC 2 control environment + Latent Ocean risk assessment |
| (a)(1)(ii)(A) Risk analysis | `docs/ops/FAILURE_MODES.md`, threat model per feature |
| (a)(1)(ii)(B) Risk management | SLO violation = risk indicator; triaged via incident process |
| (a)(3) Workforce security | RBAC + termination procedures (DR Runbook 07) |
| (a)(4) Information access management | Tenant scoping + PHI classification via `edge/security/classification.py` |
| (a)(5) Security awareness + training | Annual training required |
| (a)(6) Security incident procedures | DR Runbook 07 |
| (a)(7) Contingency plan | DR Runbook 01-06 |
| (a)(8) Evaluation | Quarterly DR drills (Runbook 08) |
| (b)(1) BAA with business associates | Customer signs BAA template |

### § 164.310 — Physical Safeguards

| Standard | Control |
|---|---|
| (a)(1) Facility access | Cloud provider for SaaS; customer-owned for edge |
| (a)(2)(i) Contingency operations | DR procedures include physical-disaster scenario (regional failover) |
| (d) Device and media controls | Crypto-shred on disposal; MDM for edge devices |

### § 164.312 — Technical Safeguards

| Standard | Control |
|---|---|
| (a)(1) Access control | JWT + RBAC + tenant scoping |
| (a)(2)(i) Unique user identification | UUID per user; no shared accounts |
| (a)(2)(ii) Emergency access procedure | Break-glass accounts logged + alerted |
| (a)(2)(iii) Automatic logoff | 15-min idle timeout |
| (a)(2)(iv) Encryption + decryption | AES-256-GCM at rest; TLS 1.3 in transit |
| (b) Audit controls | Immutable audit log |
| (c)(1) Integrity | Signed commits + SBOM + cosign image signatures |
| (c)(2) Mechanism to authenticate PHI | Ed25519 signatures on all PHI-tagged records |
| (d) Person or entity authentication | JWT + MFA |
| (e)(1) Transmission security | TLS 1.3; zero-trust routing between services |

## PHI-specific data handling

| Feature | Implementation |
|---|---|
| PHI tagging | `edge/security/classification.py` supports HIPAA label |
| PHI minimization | Field-level access via role policy; no full-record dumps to logs |
| PHI de-identification | `scripts/ops/deidentify.py` (Safe Harbor method) |
| PHI retention | 6-year minimum per HHS; configurable in `governance/retention_manager.py` |
| Breach notification | 60-day SLA; template in `docs/legal/BREACH_HIPAA_TEMPLATE.md` |

## Status

- CJIS: engineering posture supports CJI deployments. No deployment in a CJIS-accredited environment yet.
- HIPAA: self-attestable by customer; BAA template ready; no active HIPAA-covered customer.
- Audits and attestations are customer-driven; Latent Ocean supplies the control evidence.
