# PubMed biomedical literature — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Pharma R&D · insurers · pharmacovigilance teams · federal health regulators

## Hook

**Which biomedical claims are structurally divergent from literature norms?**

## Pitch

Every PubMed paper fingerprinted and scored against the full biomedical corpus. Outliers surface claims, methodologies, or concept co-occurrences that diverge from consensus — candidates for replication audit or regulatory flag.

## ROI

One Pharma Pro seat surfaces replication-risk papers at an order of magnitude lower cost than manual literature review by a medical reviewer at $250/hr.

## Trigger conditions

New paper crosses p99 composite · MeSH term's structural signature shifts vs historical · novel concept co-occurrence detected

## Today's top findings (live from the engine)

Pipeline ranked **989** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | SARS-CoV-2 Infection (MeSH D000081082) | 0.926 | 1.000 | `1101101111111111…` |
| 2 | paper 31558838 | 0.879 | 1.000 | `1011101111111101…` |
| 3 | paper 24352276 | 0.850 | 0.928 | `1011011100101101…` |
| 4 | MeSH D006291 | 0.844 | 0.887 | `0111111111011110…` |
| 5 | MeSH D000972 | 0.842 | 0.877 | `1111101111011110…` |
| 6 | MeSH D048688 | 0.839 | 0.875 | `1111111111110111…` |
| 7 | paper 30326842 | 0.836 | 0.915 | `0001011100111010…` |
| 8 | paper 33079956 | 0.835 | 0.879 | `1111011110011110…` |
| 9 | MeSH D018350 | 0.833 | 0.836 | `1101111111111110…` |
| 10 | MeSH D052196 | 0.832 | 0.858 | `1111111111100111…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `15/16` at p<0.001
- Max z-score: **21.30 sigma** on 200 resample permutations
- Reproducibility digest: `718f8da992e2a8d5…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "pubmed")'
```

## Next steps

1. Upload 10 MeSH terms or papers you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
