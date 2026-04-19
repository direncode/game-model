# Heterogeneous historical corpus — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Digital humanities · archive curators · multi-era research teams

## Hook

**Which entities bridge eras?**

## Pitch

Cross-era anchors across mixed historical sources. The same engine that finds restatement risk in SEC filings finds paradigm-bridging entities in 500 years of text.

## ROI

Archive discovery — priced per curator-hour, typically $100/hr × months-long projects.

## Trigger conditions

Cross-era bridge strengthens · new document enters at top-of-cluster rank

## Today's top findings (live from the engine)

Pipeline ranked **595** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | Radiative · Radio · Audion Patented | 0.926 | 1.000 | `1111111111110110…` |
| 2 | Crypto · Symmetric · S Box | 0.894 | 1.000 | `1011110110100011…` |
| 3 | info dictionary based  person  jacob ziv | 0.888 | 1.000 | `1111111111101111…` |
| 4 | crypto number theoretic  writing  diffie hellman new directions in cryptography 1976 | 0.864 | 0.956 | `1111111111011101…` |
| 5 | info transform based  writing  hevc 2013 specification | 0.862 | 0.825 | `1111111111011100…` |
| 6 | modern surface wave  writing  ieee 2016 surface waves crucial experiment | 0.859 | 0.918 | `1111111111110110…` |
| 7 | Radiative · Radio · Hertzian Wave | 0.853 | 0.777 | `1010111111111101…` |
| 8 | tesla surface wave  writing  inventor tesla s plant nearing completion | 0.848 | 0.663 | `1111111111111111…` |
| 9 | tesla surface wave  concept  quarter wave resonator | 0.844 | 0.821 | `1111111111011110…` |
| 10 | inductive non radiative  concept  coupled mode theory | 0.843 | 0.759 | `1111101111011111…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **23.60 sigma** on 200 resample permutations
- Reproducibility digest: `1c0ce49ab89053e4…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "heterogeneous")'
```

## Next steps

1. Upload 10 historical entities you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
