# latentocean — Python SDK

The official Python client for Latent Ocean.

```
pip install latentocean
```

## SaaS / hosted

```python
from latentocean import Client

client = Client(api_key="lo_sk_...", base_url="https://api.latentocean.io")
result = client.reduce(limit=50_000)
```

## Air-gap / on-prem

Ships with an offline client that reads a cached BTUT survivor set — zero
outbound network traffic, identical shape to the hosted API.

```python
from latentocean import LocalClient

client = LocalClient()                 # picks up repo-relative defaults
score  = client.score("AEP")           # TickerScore
top    = client.top(k=50)              # list[Finding]
report = client.validate(iterations=30)  # ValidationSummary
```

See `docs/commercial/INTEGRATIONS.md` for the full commercial surface
(Excel add-in, Bloomberg fields, Slack commands, webhooks).
