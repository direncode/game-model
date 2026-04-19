# Einstein biographical events — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

History of physics researchers

## Hook

**Too small for null bounds — a robustness control for very-small corpora.**

## Pitch

Engine runs deterministically; null test auto-skipped when n < 10. Demonstrates graceful degradation.

## ROI

Operational robustness — not a standalone commercial offering.

## Trigger conditions

—

## Today's top findings (live from the engine)

Pipeline ranked **9** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | einstein unified field  event  last manuscripts princeton 1955 | 0.998 | 1.000 | `11110011…` |
| 2 | einstein unified field  event  bianchi identity obsession | 0.819 | 0.412 | `11110111…` |
| 3 | einstein quantum statistical  concept  light quanta | 0.742 | 0.555 | `11111011…` |
| 4 | Einstein · Relativity · Bern Patent Office | 0.644 | 1.000 | `11111111…` |
| 5 | einstein quantum statistical  event  nobel prize 1921 photoelectric | 0.544 | 0.625 | `11111111…` |
| 6 | Modern · Cosmology · Ligo Hanford | 0.510 | 0.656 | `11111111…` |
| 7 | einstein unified field  location  princeton institute late office | 0.489 | 0.657 | `11111111…` |
| 8 | Einstein · Relativity · Gravitational Time Dilation | 0.407 | 1.000 | `11111111…` |
| 9 | einstein unified field  concept  unified field theory | 0.405 | 0.918 | `11111111…` |

**Null-test falsifiability for this corpus:**

- `0/0` metrics survive p<0.05
- `0/0` at p<0.001
- Max z-score: **0.00 sigma** on 200 resample permutations
- Reproducibility digest: `1bcd7ec23c5a57e2…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "einstein")'
```

## Next steps

1. Upload 10 events you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
