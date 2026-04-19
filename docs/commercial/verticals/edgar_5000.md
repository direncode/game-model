# SEC financial filings — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Hedge fund short desks · audit committees · bank risk officers · SEC examiners

## Hook

**Catch the 10-K/A before it files.**

## Pitch

Structural-anomaly score on every XBRL-tagged line item across the full EDGAR filer universe. Ranked by multi-dimensional divergence from peer norms. Every flag is auditable against the 10-K.

## ROI

One Pro subscription replaces ~40 analyst-hours / month on screening work at a typical $6,000/mo fully-loaded cost.

## Trigger conditions

New 10-K/A · NT 10-K · 8-K Item 4.02 · anomaly crosses p99 · composite drops 15%+ vs 30-day rolling

## Today's top findings (live from the engine)

Pipeline ranked **4,999** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | AMERICAN ELECTRIC POWER CO INC · Asset Retirement Obligation | 0.859 | 1.000 | `1000101111111100…` |
| 2 | Samsara Inc. · Additional Paid In Capital | 0.829 | 0.516 | `1111111011111111…` |
| 3 | Circle Internet Group, Inc. · Assets | 0.828 | 0.793 | `1111111111111011…` |
| 4 | GOLDMAN SACHS GROUP INC · Additional Paid In Capital | 0.826 | 0.706 | `1111110111111111…` |
| 5 | IES Holdings, Inc. · Accrued Liabilities For Commissions Expense And Taxes | 0.823 | 0.739 | `1100001110111111…` |
| 6 | ERIE INDEMNITY CO · Accretion Amortization Of Discounts And Premiums Investments | 0.822 | 0.707 | `1111011111110111…` |
| 7 | TransUnion · Advertising Expense | 0.820 | 0.795 | `1110001101011111…` |
| 8 | SharkNinja, Inc. · Capital Expenditures Incurred But Not Yet Paid | 0.819 | 0.815 | `1111111111110111…` |
| 9 | Otis Worldwide Corp · Accumulated Depreciation Depletion And Amortization Property Plant And Equipment | 0.819 | 0.817 | `1111111111111011…` |
| 10 | Circle Internet Group, Inc. · Accrued Income Taxes Current | 0.818 | 0.535 | `1111111010111111…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **23.04 sigma** on 200 resample permutations
- Reproducibility digest: `da0407e5ce7b8b98…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "edgar_5000")'
```

## Next steps

1. Upload 10 tickers you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
