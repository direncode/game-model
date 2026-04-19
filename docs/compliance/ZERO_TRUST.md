# Zero-Trust Network Topology

Reference architecture for sovereign / enterprise deployments.
Aligns with NIST SP 800-207.

## Core principles enforced

1. **Never trust, always verify** — every request authenticated + authorized, regardless of origin network.
2. **Assume breach** — services isolated; lateral movement blocked at every network hop.
3. **Verify explicitly** — identity, device posture, network location, data sensitivity all evaluated per request.
4. **Least privilege** — access scoped to minimum needed; time-boxed when possible.
5. **Microsegmentation** — services in separate networks; communication whitelisted.

## Network zones

```
┌───────────────────────────────────────────────────────────────────┐
│  INTERNET / CUSTOMER NETWORK                                       │
│  (untrusted — every packet validated at edge)                      │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼  (TLS 1.3 + client cert for mTLS)
┌───────────────────────────────────────────────────────────────────┐
│  EDGE ZONE                                                         │
│  - Web Application Firewall (Cloudflare / AWS WAF)                │
│  - DDoS protection                                                 │
│  - TLS termination                                                 │
│  - Rate limiting (per IP, per API key, per tenant)                │
│  - Input validation + request size cap                             │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼  (mutual TLS between edge and app)
┌───────────────────────────────────────────────────────────────────┐
│  APP ZONE  (stateless backend pods)                                │
│  - JWT validation + tenant scope extraction                        │
│  - RBAC enforcement per route                                      │
│  - Observability: /metrics, audit log, request-id                  │
│  - No direct data-zone access without mTLS                         │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼  (mTLS + service account + Vault token)
┌───────────────────────────────────────────────────────────────────┐
│  DATA ZONE  (Postgres, Neo4j, Redis, MinIO)                        │
│  - Network ACLs: only APP ZONE IPs allowed                         │
│  - At-rest encryption (AES-256-GCM)                                │
│  - Row-level security by tenant_id                                 │
│  - No inbound connections from EDGE or INTERNET                    │
│  - Outbound connections disabled (except to BACKUP ZONE)           │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼  (one-way replication channel)
┌───────────────────────────────────────────────────────────────────┐
│  BACKUP / DR ZONE  (cross-region replicated)                       │
│  - Write-only from DATA ZONE                                       │
│  - WORM bucket for audit archive                                   │
│  - Restore-only from operator console (break-glass)                │
└───────────────────────────────────────────────────────────────────┘

          ┌─────────────────────────────────────────┐
          │  COMPUTE ZONE (Celery, RunPod workers)  │
          │  - Isolated from INTERNET               │
          │  - Pull jobs from DATA ZONE Redis queue │
          │  - No inbound connections               │
          └─────────────────────────────────────────┘
```

## Segmentation enforcement

| Zone boundary | Mechanism |
|---|---|
| INTERNET → EDGE | Public load balancer only; no direct pod exposure |
| EDGE → APP | Private network + mTLS + allowlist |
| APP → DATA | K8s NetworkPolicy + service-account tokens |
| APP → COMPUTE | Redis queue only; no direct compute access |
| DATA → BACKUP | One-way replication; separate credentials |
| Within zones | East-west mTLS via service mesh (Istio / Linkerd) |

## Identity + device posture

Every request carries:
- **User identity**: JWT signed by IdP (Okta / Entra ID / customer SAML)
- **Device identity**: Client cert (MDM-enrolled devices only)
- **Network context**: Source IP geolocation + ASN check
- **Session age**: Re-authentication required every N minutes for privileged ops

## Policy examples

```yaml
# Example K8s NetworkPolicy — app cannot speak to data except via service account
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-to-data-strict
spec:
  podSelector:
    matchLabels: { tier: data }
  ingress:
    - from:
        - podSelector:
            matchLabels: { tier: app }
      ports:
        - protocol: TCP
          port: 5432  # postgres only
```

## Tenant-level isolation

Per-tenant controls:
1. **Namespace-per-fork** — each tenant fork in its own K8s namespace (or docker-compose network)
2. **Tenant-scoped row-level security** — Postgres RLS policies enforce `tenant_id = current_setting('app.tenant_id')::uuid`
3. **Per-tenant secrets** — Vault KV with path `secret/tenants/<tenant_id>/*`
4. **Per-tenant rate limits** — enforced at nginx + revalidated at app

## Monitoring zero-trust invariants

Grafana dashboard tracks:
- Cross-zone connection attempts blocked
- mTLS handshake failures
- JWT validation failures by source IP
- Tenant cross-talk attempts (logged as TENANT_LEAK events)
- Outbound-from-data-zone attempts (should be always zero)

## Breakpoints

A zero-trust deployment FAILS SAFE when any of:
- mTLS handshake fails → connection refused
- JWT expired or invalid signature → 401
- Tenant scope mismatch → 403 + audit event
- Row-level security miss → empty result (not an error, by design)
- Network policy denies → TCP reset

## Status

- ✅ mTLS + RBAC + JWT + RLS patterns implemented in code
- ✅ Reference NetworkPolicies in `k8s/` (generated from `lo_platform/control_plane/k8s_orchestrator.py`)
- ⚠ Production deployment across a real zero-trust mesh (Istio/Linkerd) is deployment-specific and not yet exercised end-to-end
- ⚠ Device-posture checks require MDM integration per customer
