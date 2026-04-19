# Tesla cross-era inventor patents — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Inventor-legacy analysts · patent historians · technology-transfer offices

## Hook

**Which Tesla patents anticipate later invention corpora?**

## Pitch

Every Tesla patent chunk fingerprinted against later inventor corpora. Structural anchors surface which early-era inventions prefigure modern technology families.

## ROI

Inventor-legacy research — bespoke engagement pricing.

## Trigger conditions

Cross-era bridge to modern patent strengthens

## Today's top findings (live from the engine)

Pipeline ranked **500** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | info HEVC2013  c046 | 0.757 | 0.094 | `1111111101111101…` |
| 2 | marconi US586193  c002 | 0.727 | 0.100 | `1111111111011111…` |
| 3 | stone US714756  c007 | 0.727 | 0.105 | `1111101111101111…` |
| 4 | corum US9912031  c005 | 0.722 | 0.093 | `1111111101111111…` |
| 5 | fessenden US706740  c002 | 0.717 | 0.147 | `1111100101011101…` |
| 6 | corum US10084223  c054 | 0.708 | 0.096 | `1111101111111111…` |
| 7 | marconi US586193  c006 | 0.707 | 0.100 | `1111111110111101…` |
| 8 | corum US9912031  c021 | 0.705 | 0.091 | `1111111101111111…` |
| 9 | deforest US841387  c026 | 0.705 | 0.089 | `1111111111111111…` |
| 10 | marconi US586193  c022 | 0.693 | 0.124 | `1111111110010111…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **21.45 sigma** on 200 resample permutations
- Reproducibility digest: `9310a2e33804d7aa…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "tesla_crossera")'
```

## Next steps

1. Upload 10 Tesla patents you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
