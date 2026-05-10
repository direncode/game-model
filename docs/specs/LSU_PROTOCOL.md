# Latent Stretcher Unit (LSU) Protocol — v0.1

Spec for how on-prem hardware pairs with the Latent Ocean control plane,
heartbeats, claims jobs, and reports results. Layer 12 of the substrate
accelerator architecture.

## Status

**Draft / v0.1.** The protocol implementation lives at:

- `backend/app/services/lsu/` — registry data model + Redis-backed store
- `backend/app/api/v1/lsu.py` — control-plane endpoints (register, heartbeat, list, deregister)
- `backend/app/services/lsc/backends.py::LSULocalAdapter` — router-side adapter that targets registered LSUs

Subsequent versions will extend with job-claim semantics, mutual TLS pairing, attested fingerprint validation, and the on-prem dispatch loop.

## Identity model

Each LSU is identified by:

- **`fingerprint`** — stable hardware identity. SHA-256 over a tuple of:
  CPU serial, GPU UUID, system board UUID, mTLS cert pubkey. Hashed
  client-side, never reversible from the LSC control plane.
- **`org_id`** — the tenant that owns this LSU. Bound at registration
  time, never changes.
- **`id`** — random UUID assigned by the control plane on first
  registration. Stable across heartbeats; rotated only on
  deregister + re-register.

Idempotency: registering the same `(org_id, fingerprint)` twice updates
the existing record (endpoint, capabilities, tags) and returns the
existing `id`. Hardware cannot be double-registered.

## Lifecycle

```
   register  ──► online ◄── heartbeat
                  │
                  ├── draining (operator-set) ──► offline (deregister)
                  │
                  └── (no heartbeat for HEARTBEAT_TIMEOUT_S) ──► offline
```

- **`online`**: accepting jobs from the cost-aware router.
- **`draining`**: rejecting new jobs, finishing in-flight; transitions
  to `offline` once the unit operator deregisters.
- **`offline`**: not currently reachable. Stays in the registry so
  re-registration retains the same `id` and history.

`HEARTBEAT_TIMEOUT_S` defaults to 120 seconds. LSUs should heartbeat
every 30 seconds.

## Endpoints

All endpoints live under `https://www.latentocean.com/api/v1/lsu`.
Auth: API key with the appropriate scope.

### `POST /api/v1/lsu/register`

Register or refresh an LSU. **Scope: `write`.**

Request:

```json
{
  "name": "lab-rack-3-unit-a",
  "endpoint_url": "https://lsu-3a.customer.internal/substrate",
  "fingerprint": "8a3c...redacted",
  "capabilities": {
    "gpus": 1,
    "gpu_model": "H100-80GB",
    "memory_gb": 256,
    "btut_max_entities": 1000000,
    "tcd_max_modules": 24
  },
  "workload_tags": ["air-gapped", "sovereign", "classified"]
}
```

Response: the full `LSUOut` record with `id`, `registered_at`, `status`.

### `POST /api/v1/lsu/{lsu_id}/heartbeat`

Keep the LSU marked online. **Scope: `write`.**

Request:
```json
{ "status": "online" }
```

Response: `{ "ok": true, "lsu_id": "...", "status": "online" }`.

### `GET /api/v1/lsu/`

List registered LSUs. **Scope: `query`.**

- Non-admin keys see their own org's LSUs only.
- Admin keys may pass `?org_id=<id>` to filter to a specific tenant.

### `DELETE /api/v1/lsu/{lsu_id}`

Deregister an LSU. **Scope: `write`.**

## Router integration

The cost-aware router (`backend/app/services/lsc/backends.py`) treats a
registered LSU as the lowest-cost backend for jobs belonging to the
same `org_id`. Cost-per-second is reported as `0.0` because the
customer already owns the hardware.

The current `LSULocalAdapter` reads a single `LSU_ENDPOINT_URL` from the
environment for the initial single-tenant rollout. The multi-tenant
extension reads the registered LSUs out of the registry and matches by
the authenticated request's `org_id`.

## Data residency and air-gap modes

LSUs may register with `workload_tags` such as `air-gapped`,
`sovereign`, `classified`, `data-residency-eu`, etc. These tags are
consulted by the router when matching jobs to backends. A workload
tagged `data-residency-eu` will never be routed to a cloud backend
without the matching tag.

## Pairing and trust (v0.2)

The current v0.1 spec uses API-key auth for the LSU's outbound calls to
the control plane. The v0.2 extension adds:

- mTLS pairing between LSU and control plane
- Attested fingerprint verification (Intel SGX / AMD SEV-SNP / TPM
  PCR over the LSU's runtime measurement)
- Signed-and-encrypted job claim envelopes so even the control plane
  cannot read the customer's payloads in transit

## Observability

Each LSU's `last_heartbeat_at` and `status` are surfaced via:

- `GET /api/v1/lsu/` — programmatic listing
- The Layer 9 dashboards (`/dashboard` for the org owner, `/fde` for
  the FDE workspace)
- The customer's own LSC metrics rollups (`/api/v1/lsc/metrics`)
