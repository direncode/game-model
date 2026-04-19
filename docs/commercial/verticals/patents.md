# USPTO patent abstracts — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

IP counsel · M&A diligence teams · licensing strategy · VC technical due diligence

## Hook

**Which assignees or technology classes are structural outliers in the filer set?**

## Pitch

Every patent abstract fingerprinted against its CPC class. Outlier assignees reveal emerging strategy shifts; outlier patents flag candidates for licensing, acquisition, or invalidation review.

## ROI

Manual patent-landscape review runs $200/hr × 20 hrs per deal. One Pro seat runs the landscape in 3 seconds.

## Trigger conditions

New assignee crosses p95 in CPC class · filing velocity spike · structural outlier claim language

## Today's top findings (live from the engine)

Pipeline ranked **937** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | Siemens AG | 0.806 | 0.912 | `1111111111011111…` |
| 2 | inventor michael wang 133 | 0.803 | 0.662 | `1111111111111111…` |
| 3 | Amazon Technologies | 0.802 | 0.784 | `1111111111111111…` |
| 4 | inventor john wang 330 | 0.770 | 0.842 | `0111111111111111…` |
| 5 | inventor michael smith 2415 | 0.766 | 0.854 | `1111111111111111…` |
| 6 | inventor michael smith 2338 | 0.765 | 0.841 | `1111110111111111…` |
| 7 | inventor min wang 24 | 0.759 | 0.642 | `1111111111111111…` |
| 8 | inventor yuki wang 46 | 0.751 | 0.526 | `1111110111111111…` |
| 9 | inventor david zhang 80 | 0.750 | 0.778 | `1111111111111111…` |
| 10 | inventor yuki wang 265 | 0.750 | 0.785 | `1011111111111111…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **20.99 sigma** on 200 resample permutations
- Reproducibility digest: `0812ebd3a1ed6093…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "patents")'
```

## Next steps

1. Upload 10 CPC classes or assignees you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
