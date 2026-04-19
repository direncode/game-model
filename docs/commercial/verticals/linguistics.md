# Linguistic evolution corpus — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Dictionary / lexicography teams · NLP corpus builders · linguistic-change researchers

## Hook

**Which semantic shifts are structurally divergent from baseline vocabulary drift?**

## Pitch

Concept-and-document fingerprints reveal entities whose meaning has structurally shifted from prior eras — candidates for dictionary updates or NLP model retraining signal.

## ROI

Lexicography desk priced at $80k/year per lexicographer.

## Trigger conditions

Concept shifts cluster membership · cross-period structural divergence

## Today's top findings (live from the engine)

Pipeline ranked **289** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | historical saussure structuralism  person  ferdinand de saussure | 0.963 | 0.934 | `1111111111111111…` |
| 2 | modern chomsky hierarchy  concept  context sensitive language | 0.923 | 1.000 | `1011010110101111…` |
| 3 | modern transformer nlp  person  ashish vaswani | 0.904 | 0.707 | `1111111111111111…` |
| 4 | historical panini grammar  concept  samjna | 0.903 | 0.731 | `1111111011111110…` |
| 5 | historical panini grammar  event  panini linked to formal language theory | 0.887 | 0.853 | `1111111011011111…` |
| 6 | modern chomsky generative  concept  surface structure | 0.883 | 0.936 | `1011011111110011…` |
| 7 | historical portroyal grammar  person  claude lancelot | 0.881 | 0.902 | `1111111011110111…` |
| 8 | historical saussure structuralism  writing  course in general linguistics | 0.877 | 1.000 | `1111111111011111…` |
| 9 | historical portroyal grammar  event  port royal grammar published | 0.874 | 0.987 | `1111111110111111…` |
| 10 | historical saussure structuralism  concept  sign | 0.873 | 0.765 | `0011111111110111…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **17.56 sigma** on 200 resample permutations
- Reproducibility digest: `3b451c104d196436…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "linguistics")'
```

## Next steps

1. Upload 10 linguistic concepts you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
