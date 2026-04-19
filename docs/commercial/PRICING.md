# Pricing

Three tiers. Pay for outcomes, not API calls.

## Free

**$0 / month · forever**

- 10 ticker watchlist
- Daily structural anomaly digest (email, 7am ET)
- Top-100 EDGAR flagged filings (delayed 48h)
- `/api/v1/lo/*` access: 100 requests/day
- Community Slack

**Who it's for:** Individual researchers, students, evaluation.

## Pro

**$499 / month · no contract**

- 500 ticker watchlist
- **Real-time alerts**: email + Slack + webhook when any watched ticker files a 10-K/A, NT 10-K, or triggers a structural anomaly ≥ p99 threshold
- Full 4,999-survivor EDGAR feed, daily refresh
- Categorical probes (10 lenses) exposed via API
- Custom XBRL-concept watch expressions
- Unlimited `/api/v1/lo/*` requests
- Cross-corpus bridge access (polymath, tesla, heterogeneous, patents, pubmed — 11 legend corpora)
- Excel add-in: `=LO.SCORE("AAPL", "composite")`, `=LO.TOP_ANOMALY(cik)`
- SLA: 99.9% availability, p95 < 400ms

**Who it's for:** Solo analysts, boutique shorts, corporate audit teams, buy-side research desks.

**ROI target:** replace ~40 hours of analyst screening per month @ $150/hr = **$6,000/month savings**. Latent Ocean Pro at $499/month = **12× payback**.

## Enterprise

**$50,000 / year · annual, volume pricing above 10 seats**

- Unlimited tickers, unlimited watchlists
- Custom categorical probes trained against your historical portfolio events
- Ground-truth fine-tuning plane: upload your flagged cases, train a bespoke `Generator` for your domain
- On-prem deployment (`docker-compose.ha.yml` reference topology + install support)
- Air-gap / classified deployment option (FIPS 140-2 primitives, offline signed updates — see `docs/compliance/FEDRAMP_IL6.md`)
- Bloomberg terminal integration: `LO_SCORE`, `LO_TOP_FLAGS` as native fields
- Dedicated Slack channel with on-call SLA
- SOC 2 Type 2 attestation included (sponsor-gated FedRAMP IL6 timeline available)
- SLA: 99.95% availability, p95 < 200ms
- Full audit log export (immutable, Ed25519-signed)

**Who it's for:** Hedge funds with >$500M AUM, BDCs, insurance carriers, audit firms (Big 4 + mid-market), bank supervisors, government oversight (SEC examiners, DOJ forensic).

**ROI target:** one prevented blowup or one alpha capture per year > $50K. Typical deployments at hedge fund prospects model **15-40× payback**.

---

## ROI Calculator

Latent Ocean replaces or augments existing analyst workflows. Conservative calculation:

| Input | Default | Your value |
|---|---|---|
| Analyst hours spent on structural screening per month | 40 hrs | ___ |
| Fully-loaded analyst cost per hour | $150 | ___ |
| Analyst time replaced by Latent Ocean (conservative) | 80% | ___ |
| Additional alpha or loss-avoidance attributable to BTUT flags | $25,000 / year | ___ |

**Monthly savings formula:**
`(hours × rate × replacement_pct) + (annual_alpha / 12) = monthly_value`

**Default Pro calculation:** `40 × 150 × 0.80 + 25000/12 = $4,800 + $2,083 = $6,883/month`

**Pro subscription: $499/month → 13.8× monthly ROI**

### Enterprise deployment calculation:

| Input | Default |
|---|---|
| Analyst team size (screening use) | 5 analysts |
| Hours per analyst per week on this workflow | 10 hrs |
| Fully-loaded cost | $200k each = ~$110/hr |
| One prevented blowup over 3 years (avoided loss) | $500k |
| Alpha capture attributable annually | $150k |

**Annual enterprise value:**
`5 × 10 × 52 × 110 × 0.70 + 150000 + (500000/3) = $200,200 + $150,000 + $166,667 = $516,867`

**Enterprise subscription: $50k/year → 10.3× annual ROI**

---

## Payment + terms

- Free: no card required
- Pro: month-to-month, cancel any time. Stripe.
- Enterprise: annual invoice, net-30, volume discount above 10 seats

## Upgrade path

Free → Pro: one-click
Pro → Enterprise: sales contact, 2-week POC on customer's data, annual contract

## Pricing principles

1. **Free tier is never a demo-ware trap.** Free users get real value indefinitely.
2. **Pro replaces a junior analyst.** Price set 10–15× below that cost.
3. **Enterprise replaces a mid-level AVP of research.** Price set 8–12× below that cost.
4. **No usage-based surprise bills.** Tiers are predictable; overage conversations are human-to-human.
