# TCD-JEPA Vertical — Follow-up Items

Accumulated from spec and code-quality reviews during the 18-task
implementation pass on branch `feat/tcd-vertical` (2026-04-10 /
2026-04-11). None of these are blocking for merge. Each entry names the
file, the concern, the recommended fix, and the review that raised it.

---

## 1. `btut_bridge.py` — input validation hardening

**File:** `backend/app/services/crystallization/btut_bridge.py`
**Raised in:** Task 3 code-quality review.

- **I1.** `from_pipeline_dict` accepts a 1-D latent (`d=1`) without
  complaint — only the divisibility check fires. Add `if d < 2: raise
  ValueError(...)` so pathological shapes fail at the adapter boundary
  instead of the first downstream consumer.
- **I3.** No test covers the dangling-edge branch in
  `from_tuner_result` (edges referencing a survivor name that isn't in
  the list are silently dropped). Add a unit test exercising that path
  so the silent-data-loss contract is locked in.
- **M2.** `result: Any` on `from_tuner_result` is too loose. Define a
  local `Protocol` (not exported) declaring the expected attributes
  (`survivors`, `survivor_edges`, `survivor_embeddings`,
  `quality_scores`, `provenance_job_id`) so the contract is
  self-documenting and IDE-navigable without coupling to BTUT's
  concrete result dataclass.
- **M3.** Decide whether to hardcode `d=8` (matches existing
  `data_layer/core.py` convention and is BTUT's real contract) or to
  keep the dynamic inference and assert a plausible range. Document the
  choice.
- **M4.** The pipeline-dict path drops the per-survivor `scores.composite`
  that the test fixture shows is present. Either forward it to metadata
  or document the asymmetry with the tuner-result path.

## 2. `ModuleRegistryService` — semantics hardening

**File:** `backend/app/services/crystallization/module_registry.py`
**Raised in:** Task 6 code-quality review.

- **I1 (semantic).** `register_many` currently *skips* on dedup hit.
  For a system-of-record table this means re-running crystallization
  with improved quality scoring silently discards the better module.
  Change `register_many` to *update* the existing row's
  `quality_score`, `purity`, and `metadata_` instead of skipping. The
  dedup test should still pass (same content → same hash → we still
  "dedupe" in the sense that there's one row, but its mutable fields
  now reflect the latest run).
- **I2.** Intra-batch dedup currently relies on SQLAlchemy autoflush.
  Make it explicit by tracking `seen: set[str]` inside `register_many`
  and checking membership before the SELECT round-trip. Five lines, no
  semantic change, independent of session configuration.
- **I3 (race).** Two concurrent `register_many` calls can both pass
  the SELECT and both `add`, losing one at `flush()` with an
  `IntegrityError` that poisons the whole batch. Use Postgres-native
  `insert(...).on_conflict_do_nothing(...)` (or `DO UPDATE` when I1
  lands) for the Postgres path. The SQLite test can keep the
  select-then-add fallback.

## 3. `vertical_types.py` — optional defensive invariants

**File:** `backend/app/services/crystallization/vertical_types.py`
**Raised in:** Task 2 code-quality review.

- `BTUTSurvivorBundle.__post_init__` currently validates only
  `len(ids) == embeddings.shape[0]`. Consider adding:
  - `embeddings.ndim == 2` check (prevents 1-D arrays from silently
    passing the `.shape[0]` check).
  - Edge endpoint bounds check (`0 <= src, dst < N`).
  - Dtype coercion/assertion (every downstream caller assumes float32).
- These are low-priority because `btut_bridge.py` is the designated
  normalization boundary, but centralizing the invariants here would
  make the type contract self-enforcing.

## 4. `module_registry.py` model — composite index

**File:** `backend/app/models/module_registry.py`
**Raised in:** Task 4 code-quality review.

- The most common query path is
  `WHERE vertical = ? AND quality_score >= ?`. A composite
  `Index("ix_module_registry_vertical_quality", "vertical", "quality_score")`
  would turn this into a single range scan. The current
  `ix_module_registry_vertical` + `ix_module_registry_quality` pair
  works via filter-in-memory; fine at registry sizes of ≤10k rows, but
  worth revisiting as the monetization vertical ramps.

## 5. Test layer — real-auth endpoint happy path

**File:** `backend/tests/api/test_tcd_vertical_endpoints.py`
**Raised in:** Task 17 implementation.

- `test_route_with_empty_registry_returns_sentinel` is currently
  skipped because FastAPI `dependency_overrides` does not trivially
  intercept `require_permission` (it returns a fresh `_check` closure
  per call, so overriding by identity requires either monkeypatching
  `permissions._check` or installing a project-wide test
  `conftest.py` that stubs `get_current_active_user` at the JWT layer).
  Add a proper auth stub so the full create→route happy path is
  covered end-to-end.

## 6. `presets.py` — pull shared tunables out of `online.py`

**File:** `backend/app/services/crystallization/online.py`
**Raised in:** Task 10 self-review.

- `_MIN_LIFETIME` and `_MATCH_EPSILON` in `online.py` are module-level
  constants. A future enhancement is to move them into `PresetConfig`
  so the trading vertical can prune more aggressively than the
  sovereign vertical without code changes.

## 7. Module registry: pgvector upgrade path

**File:** `backend/app/models/module_registry.py`
**Raised in:** Task 4 code-quality review.

- `centroid` is stored as JSONB. This is the right call at v1 because
  the plan requires extension-free additive migrations and the registry
  is expected to hold hundreds-to-low-thousands of rows. When the
  registry exceeds ~100k modules OR routing moves into SQL (as opposed
  to the current in-Python `route_signal`), migrate to `vector(D)` via
  `pgvector`. Additive migration; the service layer's `.tolist()` ↔
  `np.asarray` boundary absorbs the type change.

## 8. Plan template correction

**File:** `docs/plans/2026-04-10-tcd-jepa-vertical.md`
**Raised in:** Task 5 code-quality review; Task 6 implementation.

- The plan's Task 5 template used `server_default=sa.text("gen_random_uuid()")`
  for the registry PK, which depends on `pgcrypto` and is inconsistent
  with `001_initial.py` / `002_auth_upgrade.py` (neither of which use it).
  Already fixed in commit `fde7729` (migration) but the plan text should
  be updated if it's ever reused for another table.
- The plan's Task 6 template used `Base.metadata.create_all` in the
  test fixture. This doesn't work because every other model in the
  repo uses `postgresql.JSONB` directly. The fix (single-table
  `ModuleRegistryEntry.__table__.create` + dialect-scoped
  `@compiles` shim in `conftest.py`) should be the default pattern in
  any future plan that touches the test DB.

---

**Total items:** 8 (none blocking).
**Branch:** `feat/tcd-vertical` at `11ab670`.
**Status:** Accumulated during implementation pass; defer to a follow-up
sprint or tackle opportunistically when revisiting the relevant files.
