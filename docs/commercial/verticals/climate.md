# NOAA climate station series — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Reinsurers · ESG funds · agricultural insurers · infrastructure risk teams

## Hook

**Which stations' climate signatures have structurally diverged from peer stations?**

## Pitch

Every NOAA station's temperature / precipitation / humidity time-series fingerprinted against its regional peer group. Structural anomalies mark stations undergoing accelerated change — candidates for micro-climate insurance-pricing adjustments or infrastructure hardening.

## ROI

Reinsurance pricing models currently sample a few hundred stations per region; the engine ranks the full US network in one run.

## Trigger conditions

Station composite crosses p99 against regional cluster · seasonal pattern breaks peer envelope

## Today's top findings (live from the engine)

Pipeline ranked **999** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | Arizona stations | 0.963 | 0.887 | `1101011111111101…` |
| 2 | NE stations | 0.950 | 0.974 | `1101111101111111…` |
| 3 | OR stations | 0.916 | 0.818 | `1110110111111111…` |
| 4 | GA stations | 0.866 | 0.641 | `1111111011111111…` |
| 5 | RI stations | 0.865 | 0.790 | `1111111111111111…` |
| 6 | MA stations | 0.856 | 0.675 | `1110011011111111…` |
| 7 | NC stations | 0.853 | 0.744 | `1101110001111111…` |
| 8 | MS stations | 0.852 | 0.661 | `1110111111111111…` |
| 9 | WV stations | 0.852 | 0.616 | `1111111111111111…` |
| 10 | station BBES | 0.724 | 0.114 | `1111111111111111…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **27.77 sigma** on 200 resample permutations
- Reproducibility digest: `5af1cad33caafd7f…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "climate")'
```

## Next steps

1. Upload 10 NOAA stations or regions you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
