# Latent Ocean — Sample Data Fixtures

Committed, on-disk sample data for every vertical except D-U-N-C. Every file here
is produced by `scripts/populate_samples.py` — regenerate with:

    python scripts/populate_samples.py

## Layout

- `MANIFEST.json` — root index. `verticals[].interact_with[]` lists ready-to-run
  tool invocations against each fixture (copy-paste into Read/Grep).
- `<vertical>/` — per-vertical fixtures. Shape is documented in the spec:
  `docs/plans/2026-04-18-sample-data-population-design.md`.

## Status codes

- `success` — all outputs written.
- `partial` — some outputs written (soft-dep missing, step timeout).
- `skipped` — vertical intentionally not run (service not yet implemented).
- `failed` — populator crashed; `error` + `traceback` captured in the manifest entry.
