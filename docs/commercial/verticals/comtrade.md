# UN Comtrade international trade flows — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Customs offices · supply-chain risk teams · tariff / sanctions desks · commodity traders

## Hook

**Which trade-flow pairs are structurally unusual this quarter?**

## Pitch

Every reporter-partner-commodity flow fingerprinted and ranked. Divergent flows surface smuggling, transshipment, sanction evasion, or emerging trade corridors before they appear in consensus analysis.

## ROI

A single customs analyst typically screens 500 HS codes per week. The engine ranks all 6,000+ HS codes × 200 countries in minutes.

## Trigger conditions

HS-level flow deviates > 3σ from rolling average · new reporter-partner pair at p99 · commodity category shifts structural signature

## Today's top findings (live from the engine)

Pipeline ranked **998** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | Meat and edible meat offal (HS-02) | 0.940 | 0.925 | `1111101011110111…` |
| 2 | Plastics (HS-39) | 0.925 | 1.000 | `0011100011010110…` |
| 3 | country BGD | 0.917 | 0.922 | `1101100111101111…` |
| 4 | country BRA | 0.890 | 0.862 | `1101011111101111…` |
| 5 | country KOR | 0.878 | 0.882 | `1111101111101011…` |
| 6 | country DNK | 0.861 | 0.842 | `1101101111101111…` |
| 7 | country ARE | 0.860 | 0.723 | `1111111111111111…` |
| 8 | Pharmaceutical products (HS-30) | 0.858 | 0.698 | `1111111111101111…` |
| 9 | Machinery (HS-84) | 0.852 | 0.824 | `1101101111111111…` |
| 10 | country AUS | 0.850 | 0.690 | `1111111111101110…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **25.95 sigma** on 200 resample permutations
- Reproducibility digest: `7e92a1f26224d5fa…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "comtrade")'
```

## Next steps

1. Upload 10 HS codes or trade corridors you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
