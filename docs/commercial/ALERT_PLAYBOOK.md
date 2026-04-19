# Alert Playbook

Delivery specs, email templates, webhook payloads, Slack blocks. What a Pro subscriber receives.

## Alert trigger types

| Trigger | SLA | Channel |
|---|---|---|
| New 10-K/A filed by a watched ticker | 15 min from SEC feed | email + slack + webhook |
| NT 10-K / NT 10-Q filed by watched ticker | 15 min | email + slack + webhook |
| 8-K Item 4.02 (non-reliance on previous financials) | 15 min | email + slack + webhook + SMS |
| Watched ticker's structural anomaly score crosses p99 threshold on daily refresh | Next morning, 7am ET | email + slack |
| Watched ticker's composite score drops >15% vs 30-day rolling | Next morning | email |
| New BTUT finding involves a cross-legend bridge match with your ticker | Next morning | email |

## Daily digest email (Pro, 7am ET)

Subject: `Latent Ocean — 7 of your watchlist moved overnight`

```
Latent Ocean · Daily Structural Digest · 2026-04-19

Your watchlist, ranked by structural movement overnight:

 #1  ▲ AMERICAN ELECTRIC POWER (AEP)
      AssetRetirementObligation     anomaly 1.00 (+0.12 from 30d avg)
      Cluster rank: #1 of 6
      Thesis: coal-plant decommissioning estimate at peak; audit-sensitive

 #2  ▲ Circle Internet Group (CRCL)
      AccruedIncomeTaxesCurrent     composite 0.82 (+0.08)
      Thesis: crypto-native tax posture, novel vs filer universe

 #3  ● NVR Inc. (NVR)
      BusinessCombinationRecognizedIdentifiableAssets  composite 0.76 (stable)
      Thesis: active land-acquisition pipeline; post-deal accounting distortion

[... 4 more movers ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEW FILINGS OVERNIGHT (of your 500-ticker watchlist):

   🚨 ERIE INDEMNITY — filed 10-K/A at 2026-04-18 18:47 ET
      Read the original: https://sec.gov/...
      Our pre-filing flag from 2026-04-11: composite 0.82 [view]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDATION (the Prove It math on today's top flag):
   top_bridge_weighted: 7.21 vs null p95 5.77 (SIGNIFICANT at α=0.001)
   z-score on score magnitude: 54σ
   Run yourself: lo validate <your-watchlist-dir> --focus your-ticker

[ view full digest ] [ manage watchlist ] [ unsubscribe ]
```

## Real-time 10-K/A alert (email)

Subject: `🚨 URGENT: ERIE INDEMNITY filed 10-K/A — 14 min ago`

```
ERIE INDEMNITY (ERIE) filed a 10-K/A at 18:47 ET.

What Latent Ocean flagged BEFORE this filing:
  2026-04-11: composite score 0.82 for AccretionAmortizationOfDiscounts
  Anomaly rank: #1 of 22 in its cluster (p<0.001 rank-1 significance)

You were alerted to structural divergence 7 days before the restatement
filed.

Original 10-K (pre-restatement): https://sec.gov/ix?doc=...
10-K/A (today's restatement):    https://sec.gov/ix?doc=...

Compare the diff:
  https://app.latentocean.com/diff/erie/10k-vs-10ka-2026

To export this for your compliance log:
  https://app.latentocean.com/export/alert/2026-04-18-erie-10ka
```

## Slack block (Pro + Enterprise)

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {"type": "plain_text", "text": "🚨 10-K/A — ERIE INDEMNITY"}
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*ERIE INDEMNITY* filed a 10-K/A 14 min ago.\n*Pre-filing flag:* `composite 0.82` on `AccretionAmortizationOfDiscounts` — rank 1/22 in cluster, p<0.001.\n*Lead time:* 7 days."
      }
    },
    {
      "type": "actions",
      "elements": [
        {"type": "button", "text": {"type": "plain_text", "text": "View diff"}, "url": "https://app.latentocean.com/diff/erie/10k-vs-10ka-2026"},
        {"type": "button", "text": {"type": "plain_text", "text": "Original 10-K"}, "url": "https://sec.gov/ix?doc=..."},
        {"type": "button", "text": {"type": "plain_text", "text": "Prove It (null test)"}, "url": "https://app.latentocean.com/validate/erie"}
      ]
    }
  ]
}
```

## Webhook payload (JSON, fire-and-forget)

```json
POST https://customer.example.com/lo-hook
Content-Type: application/json
X-LatentOcean-Signature: ed25519=...
X-LatentOcean-Event: restatement_detected

{
  "event": "restatement_detected",
  "fired_at": "2026-04-18T22:47:31Z",
  "ticker": "ERIE",
  "cik": "1035002",
  "company": "ERIE INDEMNITY CO",
  "sec_filing": {
    "form": "10-K/A",
    "accession": "0001035002-26-000012",
    "url": "https://sec.gov/ix?doc=...",
    "filed_at": "2026-04-18T18:47:00Z"
  },
  "pre_filing_signal": {
    "flagged_at": "2026-04-11T07:00:00Z",
    "concept": "AccretionAmortizationOfDiscounts",
    "composite_score": 0.82,
    "anomaly_score": 0.67,
    "cluster_rank": 1,
    "cluster_size": 22,
    "lead_time_days": 7
  },
  "validation": {
    "p_value_approx": "< 0.001",
    "null_test_endpoint": "https://api.latentocean.com/v1/validate/erie"
  },
  "links": {
    "ui": "https://app.latentocean.com/finding/erie-accretion-20260411",
    "audit_record": "https://app.latentocean.com/export/alert/2026-04-18-erie-10ka"
  }
}
```

## Webhook signature verification (customer side)

All webhooks signed with Ed25519. Public key available at `https://api.latentocean.com/keys`. Signature header:

```
X-LatentOcean-Signature: ed25519=<hex-encoded 64-byte signature>
```

Verify with any Ed25519 library. Payload is the raw POST body.

## Delivery guarantees

- At-least-once for webhooks (customer must idempotency-check via `event` + `fired_at`)
- 15-minute SLA measured from SEC EDGAR full-text-search availability
- Retry: 4 attempts with exponential backoff (1m, 5m, 15m, 1h), then dead-letter
- Dead-letter queue accessible via API: `GET /api/v1/lo/alerts/undelivered`

## Opt-out / granularity

Subscribers can silence:
- Specific tickers
- Specific trigger types
- Windows of day (e.g., weekends muted)
- Below a composite threshold

All done through `PATCH /api/v1/lo/watchlist/{id}`. Version-controlled.

## Audit log

Every fired alert produces an immutable record in the tenant's audit log (`edge/security/immutable_audit.py` primitives). Downloadable for compliance / regulatory review.
