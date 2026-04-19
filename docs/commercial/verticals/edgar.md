# SEC financial filings (smaller slice) — vertical playbook

*Auto-generated from `data/validation/universal_validation.json`. Deterministic.
Re-run `python scripts/generate_vertical_playbooks.py` to refresh.*

## Buyer

Same as EDGAR 5000 — shown here as a robustness control; same primitives, different universe size.

## Hook

**Pipeline stability across universe sizes.**

## Pitch

The same BTUT primitives applied to a smaller EDGAR cut, demonstrating that findings survive when the reference universe shrinks.

## ROI

Operational robustness — not a standalone commercial offering.

## Trigger conditions

Same as EDGAR 5000

## Today's top findings (live from the engine)

Pipeline ranked **499** entities in this corpus. The most
structurally divergent entities, by composite score:

| # | Entity | Composite | Anomaly | Fingerprint |
|---|---|---|---|---|
| 1 | AMERICAN ELECTRIC POWER CO INC · Asset Retirement Obligation | 0.859 | 1.000 | `1000100001010010…` |
| 2 | Circle Internet Group, Inc. · Assets | 0.826 | 0.785 | `1110011111110011…` |
| 3 | Samsara Inc. · Additional Paid In Capital | 0.820 | 0.480 | `0111101010111111…` |
| 4 | Otis Worldwide Corp · Accumulated Depreciation Depletion And Amortization Property Plant And Equipment | 0.819 | 0.819 | `1111011100111010…` |
| 5 | GOLDMAN SACHS GROUP INC · Additional Paid In Capital | 0.819 | 0.677 | `0110110010111111…` |
| 6 | TransUnion · Advertising Expense | 0.819 | 0.789 | `1100101011111001…` |
| 7 | IES Holdings, Inc. · Accrued Liabilities For Commissions Expense And Taxes | 0.819 | 0.720 | `1111110010111001…` |
| 8 | ERIE INDEMNITY CO · Accretion Amortization Of Discounts And Premiums Investments | 0.818 | 0.691 | `1111111110111111…` |
| 9 | SharkNinja, Inc. · Capital Expenditures Incurred But Not Yet Paid | 0.818 | 0.809 | `0111111010111011…` |
| 10 | Otis Worldwide Corp · Capital Expenditures Incurred But Not Yet Paid | 0.816 | 0.691 | `1101101111011011…` |

**Null-test falsifiability for this corpus:**

- `16/16` metrics survive p<0.05
- `16/16` at p<0.001
- Max z-score: **16.19 sigma** on 200 resample permutations
- Reproducibility digest: `2b61c73c930443d6…`

## Reproduce

```bash
python scripts/universal_validation.py --iterations 200
cat data/validation/universal_validation.json \
    | jq '.corpora[] | select(.corpus_id == "edgar")'
```

## Next steps

1. Upload 10 tickers you care about — we return a 48h pilot report
2. If the report surfaces one actionable finding, Pro at $499/month
3. For on-prem / air-gap deployment, see
   `docs/compliance/FEDRAMP_IL6.md` and `docs/compliance/ZERO_TRUST.md`
