# Language across time (subset) — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Computational linguists · corpus linguists · historical linguistics researchers

## Hook

**Which language fragments bridge historical periods?**

## Pitch

Every chunk of historical text fingerprinted. Outliers surface semantic drift, loanword adoption, morphological shifts — candidates for linguistic-change publications.

## ROI

Grant-funded linguistics research — the engine compresses manual corpus-comparison workflows.

## Trigger conditions

Cross-period token structure shifts · bridge fingerprint strengthens

## Today's top findings (live from the engine)

Pipeline ranked **1,498** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | latk polymath  newton optics  concept  newton s rings | 0.887 | 1.000 | `1110100111111011…` |
| 2 | latk polymath  newton alchemy  event  keynes auctions newton alchemical manuscripts | 0.883 | 0.844 | `1110110111111111…` |
| 3 | latk linguistics  modern distributional semantics  person  susan dumais | 0.881 | 1.000 | `1100101111100111…` |
| 4 | latk heterogeneous  inductive non radiative  writing  mit 2007 wireless power demonstration | 0.876 | 0.856 | `1111111111101111…` |
| 5 | latk polymath  newton alchemy  concept  net | 0.873 | 0.897 | `1110110111101111…` |
| 6 | latk heterogeneous  crypto number theoretic  event  diffie hellman paper published | 0.864 | 0.862 | `1011110111111101…` |
| 7 | latk linguistics  historical humboldt language  location  prussian academy | 0.864 | 0.922 | `1111111111101111…` |
| 8 | latk polymath  newton theology control  event  observations upon daniel published posthumously | 0.862 | 0.850 | `1111110111101111…` |
| 9 | latk polymath  newton alchemy  event  newton leaves cambridge for the mint | 0.861 | 0.794 | `1111110111111111…` |
| 10 | latk heterogeneous  tesla surface wave  person  fritz lowenstein | 0.859 | 0.760 | `1111111111111011…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **29.72 sigma** on 200 resample permutations
- Reproducibility digest: `950ba868ffeb79b6…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "latk_mini")'
```

## Next steps

1. Upload 10 historical text fragments you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
