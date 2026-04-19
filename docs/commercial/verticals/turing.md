# Turing biographical events — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

History of computing / math researchers

## Hook

**Small corpus; primitives still run with K auto-scaled.**

## Pitch

Demonstrates that the universal primitives adapt K to corpus size without hand-tuning. Four metrics significant at p<0.05 on n=18.

## ROI

Operational robustness control.

## Trigger conditions

—

## Today's top findings (live from the engine)

Pipeline ranked **18** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | Turing · Morphogenesis · Cambridge Plant Lab | 0.956 | 0.831 | `10110111…` |
| 2 | Turing · Cryptanalysis · Hut 8 | 0.759 | 0.478 | `10111110…` |
| 3 | Turing · Morphogenesis · Manchester Chemistry Department | 0.744 | 0.987 | `11111110…` |
| 4 | Turing · Ai · Imitation Game | 0.656 | 0.310 | `11101111…` |
| 5 | Modern · Complexity · Clay Mathematics Institute | 0.617 | 0.907 | `10111111…` |
| 6 | Turing · Computability · Kings College Cambridge | 0.599 | 1.000 | `11111111…` |
| 7 | Turing · Computability · Princeton University | 0.573 | 0.715 | `10111111…` |
| 8 | Turing · Morphogenesis · Morphogenesis Paper Published | 0.566 | 0.823 | `11111111…` |
| 9 | Turing · Morphogenesis · Turing Studies Fibonacci Plants | 0.564 | 1.000 | `11111111…` |
| 10 | Turing · Computability · On Computable Numbers Published 1936 | 0.561 | 0.671 | `11111110…` |

**Null-test falsifiability for this corpus:**

- `4/4` metrics survive p<0.05
- `4/4` at p<0.001
- Max z-score: **3.58 sigma** on 200 resample permutations
- Reproducibility digest: `0c4140252a8d3fc2…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "turing")'
```

## Next steps

1. Upload 10 events you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
