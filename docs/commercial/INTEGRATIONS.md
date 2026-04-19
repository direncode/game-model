# Integration specs

Where Latent Ocean shows up in the tools your team already uses.

## Excel add-in (Pro)

Drop-in for analyst screen workbooks.

```
=LO.SCORE("AAPL")
  → returns today's composite score for Apple Inc.

=LO.SCORE("AAPL", "anomaly")
  → returns the anomaly dimension only

=LO.TOP_ANOMALY("AAPL")
  → returns the single most structurally-divergent XBRL line for AAPL

=LO.FLAG_DATE("AAPL", "AssetRetirementObligation")
  → returns the date AAPL's ARO last crossed p99 composite threshold

=LO.PEER_RANK("AAPL", "Assets")
  → returns AAPL's rank within its SIC peer set on the "Assets" line

=LO.VALIDATE("AAPL")
  → returns a compact validation string: "p<0.001 z=12.4 N=500"

=LO.ALERT_STATUS("AAPL")
  → returns: "quiet" | "watching" | "triggered:2026-04-18"
```

**Install:** `File → Add-ins → Store → Latent Ocean` (Office 365, Excel 2019+, Excel for Mac).

**Auth:** your Pro API key, entered once. Stored in Excel's built-in credential vault.

**Rate limits:** 100 cells per minute per workbook. Cached for 60 seconds.

## Bloomberg terminal (Enterprise)

Latent Ocean as BBG native field. The terminal is your analyst's cockpit; LO shows up there.

| Field | Description | Example |
|---|---|---|
| `LO_COMPOSITE` | Today's composite score | `0.827` |
| `LO_ANOMALY` | Anomaly-dimension score | `1.000` |
| `LO_RANK_UNIVERSE` | Rank across the full EDGAR filer universe | `12 of 4999` |
| `LO_TOP_LINE` | Single most-divergent XBRL concept | `AssetRetirementObligation` |
| `LO_PEER_DIST` | Distance from 2-digit SIC peer centroid | `2.3σ` |
| `LO_FLAG_DATE` | Date LO first flagged this entity ≥ p95 | `2026-04-11` |
| `LO_ALERT_ACTIVE` | Boolean alert status | `TRUE` |
| `LO_PROVE_IT` | One-click URL to null-test validation | `https://...` |

Query in BQL:
```
=BDP("AAPL US Equity", "LO_COMPOSITE")
=BDS("AEP US Equity", "LO_TOP_LINE")
```

**Setup:** BBG admin whitelists `LO_*` fields via their Bloomberg support ticket. We provide the XML. 1-day turnaround.

## Slack app

Real-time alerts where your team already works.

**Commands:**
```
/lo score AAPL
  → bot replies with AAPL's top 3 structural flags

/lo watch AAPL TSLA NVDA
  → adds to channel's watchlist

/lo today
  → digest of this channel's watchlist overnight movers

/lo prove <finding_id>
  → shows the null-test badge inline

/lo dr-run
  → (Enterprise) kick a DR drill
```

**Events:** every alert posts a rich block to the channel. See `ALERT_PLAYBOOK.md` for the payload.

**Install:** Latent Ocean for Slack marketplace listing. OAuth flow picks channel, connects tenant API key.

## Microsoft Teams app (Enterprise)

Same capabilities as Slack. Adaptive Card format for alerts. `@Latent Ocean` command with identical verbs (`score`, `watch`, `today`, `prove`).

## Webhook / REST API (Pro + Enterprise)

Already shipped at `/api/v1/lo/*`. Detailed in `lo_core/README.md`. Key endpoints:

```
POST /api/v1/lo/analyze        — run analyzers on a BTUT output
POST /api/v1/lo/validate       — null permutation + hold-out report
POST /api/v1/lo/narrate        — deterministic narrative from findings
GET  /api/v1/lo/health         — tenant health check
```

Customer-SDK surface will add:
```
GET  /api/v1/lo/tickers/{ticker}/score
GET  /api/v1/lo/tickers/{ticker}/flags
GET  /api/v1/lo/tickers/{ticker}/history
POST /api/v1/lo/watchlist      — create / update
GET  /api/v1/lo/alerts/unread
GET  /api/v1/lo/alerts/undelivered  — DLQ
POST /api/v1/lo/probes/custom  — customer-authored probes
```

## Python SDK

```python
from latentocean import Client

client = Client(api_key="lo_...")

# Score a single ticker
result = client.score("AAPL")
# result.composite, result.anomaly, result.top_line, result.peer_rank

# Watchlist management
wl = client.watchlist.create("short-candidates", tickers=["AAPL", "TSLA", "NVDA"])
wl.add("AEP")
wl.remove("TSLA")

# Real-time alert stream
for alert in client.alerts.stream():
    if alert.event == "restatement_detected":
        print(alert.ticker, alert.pre_filing_signal.lead_time_days)

# Run the null test inline
report = client.validate(tickers=["AAPL", "AEP"], iterations=100)
report.p_value  # < 0.001

# Custom probe (Enterprise only)
probe = client.probes.create(
    name="my_accrued_liabilities_probe",
    concept_patterns=[r"AccruedLiabilities.*"],
    weights={"anomaly": 0.6, "composite": 0.4},
)
results = probe.run(universe="watchlist:short-candidates")
```

Install: `pip install latentocean`.

## Zapier / n8n / Make.com

Prebuilt triggers:
- "New Latent Ocean alert on watchlist"
- "Daily digest ready"
- "Probe threshold crossed"

Prebuilt actions:
- "Add ticker to watchlist"
- "Query LO score"
- "Run null validation"

No custom integration work needed for the long tail of CRM / ticketing / Notion / Airtable / etc.

## On-premise / air-gap (Enterprise)

Air-gapped deployments ship with the **entire engine offline**. Same `lo` CLI, same Python SDK, same REST API, same Slack/Teams bot — just hosted inside your perimeter.

See `docs/compliance/ZERO_TRUST.md` for the topology and `docs/compliance/FEDRAMP_IL6.md` for the control matrix.

## Custom integrations (Enterprise only)

Pricing: customer-defined. Typical engagements:
- Market-data vendor integration (Refinitiv, S&P CapIQ) — $15k–40k one-time
- Risk-management platform (Palantir Foundry, DataBricks delta) — $25k–80k
- Regulatory reporting (AxiomSL, OneSumX) — $40k+

All integrations preserve the "Prove It" semantics: every Latent Ocean score carried into the target system ships with its null-test metadata.
