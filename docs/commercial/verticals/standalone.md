# Empty smoke fixture — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

—

## Hook

**Skipped — empty corpus.**

## Pitch

Present to confirm the runner gracefully skips empty inputs.

## ROI

—

## Trigger conditions

—

## Today's top findings (live from the engine)

Pipeline ranked **0** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| — | (no findings in cache) | — | — | — |

**Null-test falsifiability for this corpus:**

- `0/0` metrics survive p<0.05
- `0/0` at p<0.001
- Max z-score: **0.00 sigma** on 200 resample permutations
- Reproducibility digest: `e3b0c44298fc1c14…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "standalone")'
```

## Next steps

1. Upload 10 items you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
