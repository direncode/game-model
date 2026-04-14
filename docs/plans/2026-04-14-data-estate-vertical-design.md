# Participatory Data Estate Vertical - Design Document

**Date:** 2026-04-14
**Status:** Approved
**Vertical Tag:** `DATA_ESTATE`

---

## 1. Core Concept

The Data Estate vertical is a foundational Latent Ocean primitive that lets any
organization treat internal documents, policies, knowledge bases, and
stakeholder inputs as a **living data estate**. Documents flow through the same
crystallization spine as every other vertical:

```
Upload / Submit --> [Optional Moderation] --> BTUT Thinning --> TCD-JEPA Crystallization
    --> Module Registry (vertical="DATA_ESTATE") --> Searchable, Routable, Updatable Modules
```

Crystallized modules are typed by homology dimension:
- **H0 (attractors):** Stable, well-established knowledge (settled policies, canonical procedures).
- **H1 (cycles):** Contested or evolving topics (ongoing debates, recurring themes).
- **H2 (boundaries):** Gaps and unaddressed areas (missing documentation, policy voids).

New documents can be added incrementally without rebuilding the entire estate,
using TCD-JEPA's existing incremental crystallization with bottleneck novelty
detection.

---

## 2. What This Is NOT

- Not a student government tool. No hardcoded departments, policies, or budget categories.
- Not a separate app. Everything lives inside Latent Ocean as a new vertical.
- Not a replacement for any existing vertical. Strictly additive.

---

## 3. File Structure (All New Files)

### Backend

```
backend/app/services/data_estate/
    __init__.py
    ingestion_pipeline.py      # Upload -> moderate -> convert to Dataset -> BTUT -> TCD-JEPA
    incremental_handler.py     # Add new documents to existing estate (delta crystallization)
    allocation_overlay.py      # Optional transparent allocation ledger linked to modules
    model_router.py            # Provider-agnostic LLM abstraction (Anthropic/xAI/OpenAI)
    scoring_engine.py          # Configurable multi-factor scoring for allocation requests
    context_builder.py         # Builds estate context snapshot for AI interactions

backend/app/models/data_estate.py          # SQLAlchemy models
backend/app/schemas/data_estate.py         # Pydantic schemas
backend/app/api/v1/data_estate_vertical.py # FastAPI router
backend/app/tasks/data_estate_crystallize.py  # Celery task
```

### Frontend

```
frontend/app/data-estate/
    page.tsx                   # Command center: estate topology overview
    layout.tsx                 # Section layout
    scroll/
        page.tsx               # Browse crystallized modules (the living knowledge base)
        submit/
            page.tsx           # Stakeholder document submission form
    ledger/
        page.tsx               # Optional allocation ledger view
    allocations/
        page.tsx               # Allocation request + AI scoring
    chat/
        page.tsx               # RAG-powered estate assistant

frontend/components/data-estate/
    EstateTopologyView.tsx     # Reuses 3D module explorer for estate modules
    SubmissionCard.tsx          # Document submission status card
    ModerationQueue.tsx        # Admin moderation queue for pending submissions
    AllocationScoreGauge.tsx   # Multi-factor score radial visualization
    LedgerTable.tsx            # Versioned allocation line-item table
    EstateSearchBar.tsx        # Search across crystallized estate modules

frontend/lib/data-estate/
    api.ts                     # API client for /data-estate/* routes
    types.ts                   # TypeScript type definitions
    store.ts                   # Zustand store for estate state
```

### Additive Modifications to Existing Files

| File | Change |
|------|--------|
| `backend/app/services/crystallization/vertical_types.py` | Add `DATA_ESTATE = "data_estate"` to `VerticalPreset` enum |
| `backend/app/services/crystallization/presets.py` | Add `DATA_ESTATE` preset config to `PRESETS` dict |
| `backend/app/api/v1/__init__.py` | Import and include `data_estate_vertical` router |
| `backend/app/celery_app.py` | Import `app.tasks.data_estate_crystallize` |
| `frontend/components/Sidebar.tsx` | Add "Data Estate" nav entry |

No existing logic is modified. All changes are additive imports/registrations.

---

## 4. Data Models

All models use `org_id` (FK to `Organization`) for multi-tenancy.
No hardcoded categories, departments, or domain-specific fields.

### `estate_submission` (Stakeholder Document Submissions)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | |
| `org_id` | UUID FK | Multi-tenancy |
| `title` | String | Document title |
| `raw_text` | Text | Full document content |
| `file_hash` | String(64) | SHA-256 for dedup |
| `status` | Enum(pending, approved, rejected) | Moderation state |
| `submitted_by` | UUID FK -> User | |
| `reviewed_by` | UUID FK -> User (nullable) | |
| `review_note` | Text (nullable) | Reviewer's reason |
| `dataset_id` | UUID FK -> Dataset (nullable) | Links to LO Dataset on approval |
| `estate_tag` | String(64) | User-defined grouping tag |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

### `estate_ledger_entry` (Optional Allocation Tracking)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | |
| `org_id` | UUID FK | |
| `amount` | Float | Allocation amount |
| `label` | String | Line item description |
| `category_tag` | String(64) | User-defined category |
| `version` | Integer | Versioning (append-only) |
| `effective_date` | Date | When allocation takes effect |
| `created_by` | UUID FK -> User | |
| `metadata_` | JSONB (nullable) | Extensible metadata |
| `created_at` | DateTime | |

### `estate_allocation_request` (Resource Allocation Requests)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | |
| `org_id` | UUID FK | |
| `amount` | Float | Requested amount |
| `justification` | Text | Why this allocation |
| `category_tag` | String(64) | User-defined category |
| `score_result` | JSONB (nullable) | AI scoring output (factors, total, recommendation) |
| `status` | Enum(pending, approved, denied, flagged) | |
| `requested_by` | UUID FK -> User | |
| `decided_by` | UUID FK -> User (nullable) | |
| `decision_note` | Text (nullable) | |
| `created_at` | DateTime | |

### `estate_scoring_template` (Configurable Scoring Factors)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID PK | |
| `org_id` | UUID FK | |
| `name` | String | Factor name (e.g. "urgency", "alignment") |
| `weight` | Float | Factor weight in composite score |
| `evaluator_type` | Enum(keyword, range, duplicate, model) | How to evaluate |
| `evaluator_config` | JSONB | Type-specific config (keywords, bounds, etc.) |
| `is_active` | Boolean | |

---

## 5. Preset Configuration

Added to `PRESETS` dict in `presets.py`:

```python
VerticalPreset.DATA_ESTATE: PresetConfig(
    langevin_temperature=1.2,        # warm exploration — documents are diverse
    langevin_steps=300,              # moderate trajectory for knowledge mapping
    langevin_noise_scale=0.12,
    homology_max_dim=2,              # full H0/H1/H2 — gaps matter for estates
    prune_threshold=0.15,            # keep more modules for coverage
    max_modules=96,                  # large estates need more capacity
),
```

Rationale: Document estates are inherently diverse (different topics, authors,
time periods). Temperature is warm to explore this diversity. H2 is enabled
because detecting gaps (missing documentation, unaddressed topics) is a core
value proposition. Module capacity is high because knowledge bases tend to have
many distinct topic clusters.

---

## 6. API Routes

All under `/api/v1/data-estate/` prefix.

### Submission & Moderation (The Scroll)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/submit` | analyst+ | Submit document for review |
| GET | `/submissions` | operator+ | List pending/all submissions |
| POST | `/submissions/{id}/approve` | operator+ | Approve -> triggers pipeline |
| POST | `/submissions/{id}/reject` | operator+ | Reject with note |

### Crystallization & Modules

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/crystallize` | operator+ | Trigger BTUT -> TCD-JEPA on approved docs |
| POST | `/incremental` | operator+ | Add new documents to existing estate |
| GET | `/modules` | viewer+ | List estate modules (filtered from registry) |
| POST | `/search` | viewer+ | Search across estate modules (embedding + text) |
| POST | `/route` | viewer+ | Route a query signal to relevant modules |

### Allocation Overlay (Optional)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/ledger` | viewer+ | List ledger entries (paginated) |
| POST | `/ledger` | operator+ | Create ledger entry |
| GET | `/ledger/summary` | viewer+ | Category totals, utilization |
| GET | `/ledger/export` | analyst+ | CSV export |
| POST | `/allocations/request` | analyst+ | Submit allocation request |
| GET | `/allocations` | viewer+ | List requests |
| POST | `/allocations/{id}/decide` | operator+ | Admin decision |
| GET | `/allocations/suggestions` | operator+ | AI reallocation analysis |

### AI Assistant

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/chat` | viewer+ | RAG chat over estate (model router + context) |
| GET | `/dashboard` | viewer+ | Command center aggregated metrics |

---

## 7. Pipeline Integration

### Document Ingestion Pipeline (`ingestion_pipeline.py`)

On document approval:

1. **Create Dataset**: Convert raw text into a Latent Ocean `Dataset` with
   entities (paragraphs/sections as nodes) and edges (semantic similarity,
   cross-references).

2. **BTUT Thinning**: Run `run_btut_pipeline()` on the dataset entities.
   The topology-aware thinning preserves structurally important content
   while removing redundancy.

3. **TCD-JEPA Crystallization**: Package BTUT survivors as a
   `BTUTSurvivorBundle`, feed to `TCDJEPAVertical(preset=DATA_ESTATE)`.
   The vertical runs crystallize -> interpret -> register.

4. **Module Registration**: Modules registered to `ModuleRegistryEntry`
   with `vertical="data_estate"`. Module types (attractor/cycle/boundary)
   map to H0/H1/H2 governance semantics.

### Incremental Updates (`incremental_handler.py`)

When new documents are added to an existing estate:

1. Convert new document to entities/edges (same as step 1 above).
2. Use TCD-JEPA's existing incremental crystallization endpoint
   (`POST /tcd/verticals/{id}/incremental`) to push a delta bundle.
3. Bottleneck novelty detection identifies genuinely new topology
   (new topics, shifted debates, newly-emerged gaps).
4. Registry is updated with new/modified modules.

This avoids full recrystallization — the estate grows incrementally.

---

## 8. Model Router (`model_router.py`)

Provider-agnostic abstraction over LLM APIs. Used by scoring engine,
RAG chat, and context builder.

```python
class ModelRouter:
    """Configurable LLM provider for the Data Estate vertical."""

    def __init__(self, provider: str = None, model: str = None):
        # Reads from config: DATA_ESTATE_MODEL_PROVIDER, DATA_ESTATE_MODEL_NAME
        # Supports: anthropic, xai, openai

    async def complete(self, prompt: str, system: str = None) -> str:
        """Generate completion using configured provider."""

    async def embed(self, text: str) -> list[float]:
        """Generate embedding using configured provider."""
```

Config env vars:
- `DATA_ESTATE_MODEL_PROVIDER` = `anthropic` (default) | `xai` | `openai`
- `DATA_ESTATE_MODEL_NAME` = `claude-sonnet-4-6` (default) | `grok-3` | `gpt-4o`
- `DATA_ESTATE_EMBED_MODEL` = model-specific embed model name

---

## 9. Scoring Engine (`scoring_engine.py`)

Template-driven scoring for allocation requests. Organizations define their own
scoring factors via `estate_scoring_template`.

```python
class ScoringEngine:
    async def score(
        self, request: AllocationRequest, template: list[ScoringFactor]
    ) -> ScoreResult:
        """Run request through each factor, return weighted composite."""

    async def suggest_reallocations(
        self, ledger_entries: list[LedgerEntry]
    ) -> list[ReallocationSuggestion]:
        """Identify underutilized allocations and high-demand areas."""
```

Factor evaluator types:
- **keyword**: Pattern matching in justification text (configurable keywords + scores)
- **range**: Numeric bounds checking (min/max/typical for amount)
- **duplicate**: Similarity detection against recent requests (within N days)
- **model**: AI validation via model router (real-world reasonableness check)

The engine is generic — scoring factors are data, not code.

---

## 10. Context Builder (`context_builder.py`)

Builds a comprehensive estate context snapshot for AI interactions.
Injected into the model router's system prompt for RAG chat.

Context sections:
1. **Estate topology**: Module counts by type (H0/H1/H2), total entities, reduction ratio.
2. **Recent submissions**: Last N submissions with status.
3. **Allocation summary**: Category totals, utilization percentages (if ledger enabled).
4. **Active modules**: Top modules by quality score with descriptions.
5. **Gaps detected**: H2 boundary modules (areas needing attention).

---

## 11. Frontend Architecture

All pages are new Next.js App Router pages. Components reuse existing
Latent Ocean primitives where possible.

### Reused Components
- `StatCard` for dashboard metrics
- `charts/*` for allocation breakdowns
- 3D module explorer for estate topology visualization
- Existing table/form/card primitives from `components/ui/`
- Chat patterns from engine/BTUT for the RAG assistant

### New Components
- `EstateTopologyView`: Wraps 3D module explorer with H0/H1/H2 color coding
- `SubmissionCard`: Document status with moderation actions
- `ModerationQueue`: Admin queue for pending submissions
- `AllocationScoreGauge`: Radial gauge showing multi-factor score breakdown
- `LedgerTable`: Versioned allocation table with category filters
- `EstateSearchBar`: Search across crystallized modules with result previews

### State Management
- `useDataEstateStore` (Zustand): Tracks active estate, submissions, modules, search results
- API client in `lib/data-estate/api.ts` using existing fetch patterns

---

## 12. RBAC Integration

Uses existing Latent Ocean RBAC system. No new roles — existing roles map cleanly:

| Role | Data Estate Permissions |
|------|------------------------|
| viewer | Browse modules, search, read ledger, use chat |
| analyst | Submit documents, request allocations, export |
| operator | Approve/reject submissions, manage ledger, decide allocations, trigger crystallization |
| admin | All of the above + configure scoring templates |

Implemented via existing `require_permission()` / `require_role()` dependencies.

---

## 13. Celery Integration

New task `data_estate_crystallize` in the `crystallization` queue.

Triggered on document approval:
1. Convert document to entities/edges
2. Run BTUT pipeline
3. Run TCD-JEPA crystallization
4. Register modules

Uses existing Redis pub/sub for WebSocket progress updates
(same pattern as `tcd_crystallize` task).

---

## 14. Config Variables (New)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATA_ESTATE_ENABLED` | `false` | Feature flag |
| `DATA_ESTATE_MODEL_PROVIDER` | `anthropic` | LLM provider |
| `DATA_ESTATE_MODEL_NAME` | `claude-sonnet-4-6` | LLM model |
| `DATA_ESTATE_EMBED_MODEL` | (provider default) | Embedding model |
| `DATA_ESTATE_MAX_SUBMISSION_SIZE` | `10485760` (10MB) | Max upload size |
| `DATA_ESTATE_AUTO_APPROVE` | `false` | Skip moderation queue |

---

## 15. Data Flow Summary

```
Stakeholder
  |
  v
POST /data-estate/submit (raw document)
  |
  v
Moderation Queue (operator reviews)
  |
  v (on approve)
Create Dataset from document text
  |
  v
BTUT Thinning (topology-aware reduction)
  |
  v
TCD-JEPA Crystallization (DATA_ESTATE preset)
  |
  v
Module Registry (vertical="data_estate", typed H0/H1/H2)
  |
  v
Searchable / Routable / Exportable Modules
  |
  +---> Command Center (topology overview)
  +---> RAG Chat (context-aware AI assistant)
  +---> Signal Routing (query -> relevant modules)
  +---> Incremental Updates (new docs -> delta crystallization)
```

```
Allocation Request (optional overlay)
  |
  v
Scoring Engine (template-driven, multi-factor)
  |
  v
Model Router (AI validation, configurable provider)
  |
  v
Score Result + Recommendation
  |
  v
Admin Decision -> Ledger Entry (versioned, audited)
```
