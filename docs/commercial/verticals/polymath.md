# Polymath biography corpus (Newton / Leonardo / etc.) — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Academic historians · science-of-science researchers · intellectual-history analytics

## Hook

**Which of a polymath's works structurally diverges from the rest of their output?**

## Pitch

Every biographical event, concept, and location fingerprinted. Outliers surface lesser-known work that may anticipate later paradigms — Newton's alchemy, Leonardo's hydraulics, Turing's biological morphogenesis.

## ROI

Academic research grant budgets typically allocate $50k/year per researcher for archive work. Our engine compresses decades of archival catalogue into minutes.

## Trigger conditions

New archival finding anchors to a high-composite cluster · cross-corpus bridge strengthens

## Today's top findings (live from the engine)

Pipeline ranked **1,195** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | Newton · Alchemy · Keynes Auctions Newton Alchemical Manuscripts | 0.948 | 1.000 | `1111111111111111…` |
| 2 | Leonardo · Flight · Ornithopter | 0.939 | 1.000 | `1000000000111100…` |
| 3 | Newton · Alchemy · Newton Leaves Cambridge For The Mint | 0.933 | 0.926 | `1001111110111101…` |
| 4 | newton alchemy  writing  clavis | 0.927 | 0.975 | `1111111010111111…` |
| 5 | newton alchemy  person  william newman | 0.909 | 1.000 | `1111111101111110…` |
| 6 | Newton · Mechanics · Principia Published | 0.906 | 0.889 | `1111111111111101…` |
| 7 | Newton · Alchemy · Portsmouth Papers | 0.905 | 0.862 | `1111111110111111…` |
| 8 | newton alchemy  person  jan baptist van helmont | 0.889 | 0.808 | `1110111110111111…` |
| 9 | vn cellular automata  writing  theory of self reproducing automata | 0.887 | 0.865 | `1111111111111111…` |
| 10 | leonardo flight  person  adrian nicholas | 0.883 | 0.728 | `1111111110111101…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **29.94 sigma** on 200 resample permutations
- Reproducibility digest: `b8e3c981d5a97b8e…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "polymath")'
```

## Next steps

1. Upload 10 biographical entities you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
