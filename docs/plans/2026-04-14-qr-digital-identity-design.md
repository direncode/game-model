# QR Digital Identity System — Design Document

**Date:** 2026-04-14
**Status:** Approved
**Approach:** Lightweight QR Identity Layer (Approach A)

## Summary

A universal QR-code-based digital identity system that can be minted for any trackable entity in latentocean (modules, bundles, submissions, allocations, datasets). Scanning a QR code simultaneously reveals the entity's full lineage provenance chain and grants tiered access to interact with it. The QR layer is a thin identity/access mechanism that leverages the existing 3-layer lineage system (W3C PROV governance events, BTUT structural provenance, TCD-JEPA lineage graphs).

## Design Principles

1. **QR codes are dumb pointers** — all intelligence is in the existing lineage and registry services
2. **Polymorphic reference** — same `subject_type` + `subject_id` pattern proven in `LineageEvent`
3. **Tiered access** — inspired by bdstr-'s 3-tier QR system (public/org/admin)
4. **Auto-minting** — QR identities are created automatically at entity registration time
5. **Scan = lineage + access** — every scan reveals provenance AND unlocks tier-appropriate actions

## Core Data Model

### qr_identity

The universal identity token. Each record maps a unique scannable code to any entity in the system.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Primary key |
| code | VARCHAR(9) UNIQUE | Scannable code, format `XXXX-XXXX` |
| subject_type | VARCHAR | Entity type: `module`, `bundle`, `submission`, `allocation`, `dataset` |
| subject_id | UUID | Points to the actual entity |
| tier | ENUM(`public`, `org`, `admin`) | Access tier |
| org_id | UUID | Owning organization |
| minted_by | VARCHAR | Creator identity |
| minted_at | TIMESTAMP | Creation time |
| revoked_at | TIMESTAMP (nullable) | Soft-revoke kills access without deletion |
| metadata_ | JSONB | Flexible context (label, description, custom fields) |

**Indexes:** `code` (unique), `(subject_type, subject_id)`, `org_id`, `tier`

### qr_scan_log

Audit trail of every scan event.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Primary key |
| qr_identity_id | UUID (FK) | References qr_identity |
| scanned_by | VARCHAR | Scanner identity |
| scanned_at | TIMESTAMP | Scan time |
| access_granted | ENUM(`public`, `org`, `admin`, `denied`) | Resolved access level |
| ip_address | VARCHAR (nullable) | Optional forensics |

## API Endpoints

```
POST   /api/v1/qr/mint              — Mint a new QR identity for any entity
GET    /api/v1/qr/{code}            — Resolve QR code → entity + lineage (tier-gated)
GET    /api/v1/qr/{code}/lineage    — Full lineage graph for the linked entity
POST   /api/v1/qr/{code}/scan       — Log scan event, return access level + data
DELETE /api/v1/qr/{code}            — Soft-revoke (sets revoked_at)
GET    /api/v1/qr/entity/{type}/{id} — List all QR codes for a given entity
```

### Tier-Gated Response Behavior

**Public scan:**
- Entity summary: type, name, created_at
- Shallow lineage: direct parents only
- No export or modification actions

**Org scan:**
- Full entity details with all metadata
- Complete lineage DAG (W3C PROV chain)
- BTUT survival story (7-stage structural provenance)
- Export options (JSON, PyTorch bundle)

**Admin scan:**
- Everything from org tier
- Modification actions: re-mint, revoke, transfer ownership
- Full scan audit log for this QR code
- Ability to change tier or reassign entity

## Integration Points

### Auto-Minting

QR identities are created automatically at natural touchpoints:

- **Module Registry** → `register_many()` mints QR for each new `ModuleRegistryEntry`
- **Data Estate Submissions** → approved `EstateSubmission` gets a QR at approval time
- **Allocation Requests** → `EstateAllocationRequest` gets a QR when scored
- **BTUT Jobs** → completed thinning jobs mint a QR for the survivor bundle

### Lineage Resolution

- `GET /qr/{code}/lineage` resolves `subject_id` → calls `LineageTracker.get_lineage_graph()`
- For `subject_type=module`, enriches with BTUT structural lineage (7-stage survival story)
- For `subject_type=submission`, walks the full Data Estate pipeline chain
- TCD-JEPA lineage graph provides chunk → link → cluster → insight → module ancestry

### Export Embedding

- JSON and PyTorch export manifests include the QR `code` as a provenance anchor
- Exported modules carry their QR identity for downstream traceability
- Scanning an exported module's QR resolves back to the source system

## Frontend Components

### QRMinter
Admin component for manually minting QR codes. Supports entity search, tier selection, batch minting.

### QRCard
Holographic identity card (adapted from bdstr-'s NftCard pattern). Displays:
- Entity type icon and name
- Tier badge (color-coded: public=green, org=blue, admin=gold)
- Lineage depth indicator (how deep the provenance chain goes)
- QR code image (scannable directly from screen)

### QRScanner
Camera-based scan page. Resolves codes and renders the tier-appropriate view:
- Public: summary card with basic lineage
- Org: full lineage DAG visualization + export buttons
- Admin: full view + management actions

### LineageViewer
Interactive DAG visualization triggered by QR scan. Leverages existing TCD-JEPA lineage graph structures. Nodes are color-coded by type (chunk/link/cluster/insight/module).

### ScanLog
Admin audit view showing all scan events with timestamps, scanner identity, and access levels.

## QR Encoding

The QR payload is a URL: `https://{domain}/qr/{XXXX-XXXX}`

- Same approach as bdstr- — intelligence is server-side
- Scannable with any phone camera (no app required)
- Resolution and access logic lives entirely in the API
- Code format: 8 alphanumeric characters split by hyphen (`XXXX-XXXX`)
- Generated using cryptographically random characters to prevent guessing

## Reference

- **bdstr- repo** (`C:\Users\diren\Desktop\bdstr-`): Production QR system with tiered sessions, NftCard holographic component, scan/claim tracking
- **Existing lineage**: `backend/app/services/governance/lineage_tracker.py`, `backend/app/services/btut/lineage_tracer.py`, `tcd-jepa/tcd_jepa/manifold/lineage.py`
- **Module registry**: `backend/app/services/crystallization/module_registry.py`
- **Data estate**: `backend/app/services/data_estate/`
