# Physics patent corpus (arxiv-adjacent) — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

R&D strategy · deep-tech VCs · technology-scouting teams

## Hook

**Which physics patents are structurally novel within their filing cohort?**

## Pitch

Every patent + supporting technical chunk fingerprinted. Outliers flag candidates for technology licensing, acquisition targets, or early-stage investment theses.

## ROI

Technology scouting typically priced at $150k per quarterly report. Engine replaces baseline screening pass.

## Trigger conditions

New filing at top-of-cluster composite · cross-class bridge strengthens

## Today's top findings (live from the engine)

Pipeline ranked **4,999** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | latk physics  arxiv  person  en hui wang | 0.896 | 0.710 | `1111111110111111…` |
| 2 | latk physics  arxiv physics class ph  writing  arxiv 1110 0628v1 | 0.888 | 1.000 | `1111111111111110…` |
| 3 | latk physics  arxiv  person  jacob engelberg | 0.887 | 0.988 | `1111111100111111…` |
| 4 | latk physics  arxiv  person  wenyan wang | 0.879 | 0.758 | `1111111010011101…` |
| 5 | latk physics  arxiv  person  dante j paz | 0.878 | 1.000 | `1111101001101111…` |
| 6 | latk physics  arxiv  person  benjamin lang | 0.875 | 0.978 | `1111110111111101…` |
| 7 | latk physics  arxiv  person  ken xingze wang | 0.873 | 0.696 | `1111110011111111…` |
| 8 | latk physics  arxiv astro ph co  writing  arxiv 1105 3147v1 | 0.867 | 0.831 | `1111111110111111…` |
| 9 | latk physics  arxiv  person  zu en su | 0.862 | 0.972 | `1110101111111011…` |
| 10 | latk physics  arxiv  person  e shirokoff | 0.856 | 0.960 | `1111101111011001…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **30.37 sigma** on 200 resample permutations
- Reproducibility digest: `8fbf66709e1d155d…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "latk_physics")'
```

## Next steps

1. Upload 10 physics patents you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
