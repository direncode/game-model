# Go-to-market plan

Commercial-first priorities. Not an academic roadmap.

## First 90 days — get paying customers, validate price

### Week 1–2: sales collateral live
- [ ] `SALES_ONEPAGER.md` → designed PDF, live at `latentocean.com/sales.pdf`
- [ ] `LANDING_PAGE.md` → shipped at `latentocean.com`
- [ ] `PRICING.md` → `latentocean.com/pricing`
- [ ] `WATCHLIST_TOP50.md` → updated weekly, used as top-of-funnel asset
- [ ] Stripe integrated for Pro self-serve ($499/mo)

### Week 3–4: pilot pipeline built
- [ ] Outbound list: 200 hedge funds AUM $100M–$5B, 100 corporate audit committees, 50 mid-market PCAOB registrants
- [ ] Cold email sequence: 3 touches, each opens with a named finding from their portfolio/sector
- [ ] Target: 20 pilot-report requests (10% reply rate)
- [ ] Pilot-report template: the `docs/pilots/<tenant>/pilot_summary.md` format, delivered in 48h

### Week 5–8: first 3 paying Pro customers
- [ ] Conversion target: 3 of 20 pilots → Pro subscription ($1,497 MRR)
- [ ] Weekly call with each to measure: emails opened, alerts actioned, findings acted on
- [ ] Write case study drafts (even synthetic at first)

### Week 9–12: enterprise POC #1
- [ ] One of the Pro customers elevated to enterprise POC conversation
- [ ] Scope: their full ticker universe, on-prem pilot, 2-week measurement
- [ ] Target close: $50k annual + expansion commitment

**90-day revenue target: $2k MRR + $50k annual (enterprise) signed.**

## Months 4–6 — prove it works, scale the funnel

- 10 Pro customers ($5k MRR)
- 3 enterprise contracts ($150k ARR)
- 2 case studies published (real customer, named attribution)
- Series of industry webinars: "What BTUT flagged in Q1 that the market missed"
- Conference presence: Benzinga Cayman, RIMS (corporate risk), SEC Speaks

**6-month revenue target: $5k MRR + $150k ARR = $210k ARR total.**

## Months 7–12 — scale to first $1M ARR

- 25 Pro ($12.5k MRR)
- 10 enterprise ($500k ARR)
- First channel partner: a regional audit firm resells Pro to their SEC-registrant clients
- First Bloomberg terminal pilot
- Team: +1 sales, +1 customer success

**12-month target: $1M ARR.**

## Sales motion

**Top of funnel:**
1. SEO: "how to screen SEC filings for restatement risk" ranking page
2. LinkedIn: weekly post of top-10 structural flags from latest EDGAR data (free reach)
3. Outbound: sequence 1 targeted by portfolio overlap
4. Inbound: pilot-report form on landing page

**Middle of funnel:**
5. 48h pilot report delivered (synthetic if no upload; real if 10 tickers provided)
6. Free tier activated; weekly engagement measured
7. Pro conversion email after 30 days: "You've clicked through 14 findings. Upgrade."

**Bottom of funnel:**
8. Pro upgrade via self-serve Stripe
9. Enterprise via demo → scope call → POC → contract (average 10 weeks)

## Proof points (update monthly)

Every home-page click-through to validation goes through real numbers:
- "Top-100 structural anomalies significant at p<0.001"
- "90% reproducibility across pipeline configurations"
- "Z-score up to 54σ"
- "4,999 survivors from 61,041 entities in 74 seconds"

These are defensible. They're in `data/validation/edgar_extreme_validation.json`.

## Competitive displacement playbook

**vs. Bloomberg / FactSet:**
- They: consensus estimates + headlines + press releases
- Us: structural geometry of the balance sheet itself — leading, not trailing
- Ask: "Did BBG flag this 10-K/A before it filed?" (answer: no)

**vs. Audit Analytics:**
- They: historical restatement database
- Us: forward-looking flag before the restatement files
- Ask: "How far ahead of the restatement was your flag?" (answer: none; we work from history)

**vs. LLM-analytics vendor X:**
- They: generative, non-deterministic, hallucination risk
- Us: deterministic, reproducible (seed=42), falsifiable on demand
- Ask: "Run your null test. Show me the p-value." (most vendors can't)

**vs. RavenPack / AlphaSense:**
- They: NLP sentiment on earnings calls, news
- Us: quantitative on XBRL tags; language-neutral; works across jurisdictions
- Ask: "Can you flag a Chinese ADR's disposal group accounting?" (usually no)

## Pricing-test assumptions

If any of these fails, re-price:

- $499/mo is <15% of the fully-loaded cost of the junior analyst whose work it replaces ✓
- $50k/year is <10% of the fully-loaded cost of the AVP whose work it augments ✓
- Free tier creates enough value that Pro upgrade feels easy, not coercive ✓
- Enterprise 10.3× ROI model holds in a customer pilot ← MUST VALIDATE

## Brand promise

Every page, every deck, every sales email carries the same promise:

> "Every claim we make is falsifiable on demand. Click 'Prove It' and see the null-permutation test yourself. If we lose the test, we retract the claim."

This is the moat. It's a posture no LLM-analytics vendor can copy without re-engineering their stack.

## Metrics dashboard (internal)

- MRR / ARR growth
- Pilot-report requests per week
- Pilot → Pro conversion rate
- Pro → Enterprise conversion rate
- Churn (Pro: target < 5%/month; Enterprise: target < 10%/year)
- Alert click-through rate (proxy for finding quality)
- Alerts per customer per week (proxy for engagement)
- Findings-acted-on per customer (interview-derived)
- Customer NPS (target > 50)

## One-line positioning

**For analysts who still audit their math: Latent Ocean catches the structural anomaly before the 10-K/A files. Every finding named, every claim falsifiable, every deployment yours.**
