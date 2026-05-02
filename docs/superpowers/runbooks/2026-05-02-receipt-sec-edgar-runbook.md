# Receipt — SEC EDGAR 10-K Audit Trail — Operator Runbook

**Date:** 2026-05-02
**Spec:** `docs/superpowers/specs/2026-05-02-receipt-sec-edgar-design.md`
**Plan:** `docs/superpowers/plans/2026-05-02-receipt-sec-edgar-plan.md`

This runbook is the 12-step sequence the operator runs on EC2 to take Receipt from "scripts shipped" to "live citable artifact at /receipt/sec-edgar". The engineer phases are done; what follows is operator time + budget.

## Pre-flight

Confirm before starting:

- [ ] **EC2 disk**: `df -h` shows >= 5 GB free. 1,000 filings × ~50 KB truncated text = ~50 MB; receipts.ndjson + JSON artifact ~10-20 MB.
- [ ] **`ANTHROPIC_API_KEY` set in env**: `echo $ANTHROPIC_API_KEY | head -c 10`. Without this, `receipt_run.py` cannot call the model.
- [ ] **`opentimestamps-client` installed**: `pip install opentimestamps-client` — confirm `ots --help` works.
- [ ] **Anthropic API budget acknowledged**: 1,000 filings × ~50k input tokens × $3/MTok input + ~1k output × $15/MTok ~= **$165 + $15 = $180 worst case** (~$60-80 with prompt caching). One-shot run, no recurring spend.
- [ ] **Most recent commit on main** is a green build.

## Step 1 — Pin SEC EDGAR snapshot date

```bash
SNAPSHOT_DATE="2026-04-30"
echo "$SNAPSHOT_DATE" | tee /tmp/receipt_snapshot.txt
```

## Step 2 — Fetch 1,000 stratified 10-K filings

The harvester reads pre-fetched `.txt` files. Use the existing EDGAR infrastructure (`scripts/edgar_*.py`) or write a small ad-hoc fetcher. Each filing is truncated to Items 1, 1A, 7, 8 (~50k tokens).

Recommended: start with the SEC's `submissions/CIK<10-digit>.json` per-company filings index. For each of ~125 companies × 8 years (= 1,000), fetch the 10-K's primary document, extract the four items, save as `<accession>.txt` to `/tmp/sec_edgar_filings/`.

Example minimal fetcher (one filing) — adapt for the 1,000-stratification loop:

```python
# /tmp/fetch_one_filing.py
import urllib.request, re, sys
USER_AGENT = "Diren Kumaratilleke direnavk@outlook.com"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", errors="replace")

# Fetch a 10-K text-only document, truncate to ~50k tokens (~200KB).
# Items 1, 1A, 7, 8 are extracted via regex against the standard 10-K
# section headers; the truncated text is saved to /tmp/sec_edgar_filings/<accession>.txt
```

(The full fetcher is operator-curated; this runbook assumes 1,000 `.txt` files exist in `/tmp/sec_edgar_filings/` named `<accession>.txt`.)

## Step 3 — Harvest manifest

```bash
cd /opt/latentocean
python scripts/receipt_harvest.py \
    --fixtures-dir /tmp/sec_edgar_filings/ \
    --output-index /opt/latentocean/data/formed_models/_inputs/sec_edgar_filings_index.json \
    --target-n 1000
```

Confirm: the printed line says "wrote ... with 1000 filings".

## Step 4 — Mint receipt_showcase tenant token

```bash
curl -sk -X POST -H 'Content-Type: application/json' \
    -d '{"color":"receipt_showcase"}' \
    https://www.latentocean.com/api/range-demo-token \
    | python -c "import sys,json;d=json.load(sys.stdin);open('/tmp/.receipttoken','w').write(d['token']);print('tenant_id:', d['tenant_id'])"
chmod 600 /tmp/.receipttoken
```

Expected `tenant_id: receipt_showcase`.

## Step 5 — Run receipts (the API-cost step)

Run inside `tmux` so a dropped SSH connection doesn't kill the run:

```bash
tmux new -s receipt-run

# In tmux:
ANTHROPIC_API_KEY=sk-ant-... python -u scripts/receipt_run.py \
    --filings-index /opt/latentocean/data/formed_models/_inputs/sec_edgar_filings_index.json \
    --filings-dir /tmp/sec_edgar_filings/ \
    --output /opt/latentocean/data/formed_models/_public/sec_edgar.json \
    --chain-output /opt/latentocean/data/formed_models/_public/sec_edgar_chain.json \
    --receipts-log /opt/latentocean/data/formed_models/_audit/receipts.ndjson \
    --ots-output /opt/latentocean/showcases/receipt.chainhead.ots \
    --model claude-sonnet-4-6-20250929 \
    | tee /tmp/receipt_run.log
```

Wall time: ~3-4 hours at 5 RPM Anthropic rate. The script prints `[i/1000] <filing_id>: ok (N in / N out)` per filing. If the run is interrupted, the receipts.ndjson up to that point is still valid; restart the script (it overwrites the same files; for true incremental resume, see runbook follow-up).

Detach with `Ctrl-B D`. Reattach with `tmux attach -t receipt-run`.

## Step 6 — Inspect chain head + OTS proof

After the run completes:

```bash
python -c "import json;d=json.load(open('/opt/latentocean/data/formed_models/_public/sec_edgar.json'));print('chain_head:', d['chain_head']);print('ots_anchored:', d['ots_anchored']);print('n_receipts:', d['n_receipts'])"
```

Expected:
- `chain_head` is a 64-char hex string
- `ots_anchored: True`
- `n_receipts: 1000`

If `ots_anchored: False` — the `ots` CLI was not on PATH. Install it (`pip install opentimestamps-client`) and run:

```bash
python -c "import json;print(json.load(open('/opt/latentocean/data/formed_models/_public/sec_edgar.json'))['chain_head'])" > /tmp/chainhead.txt
ots stamp /tmp/chainhead.txt
mv /tmp/chainhead.txt.ots /opt/latentocean/showcases/receipt.chainhead.ots
```

## Step 7 — Verify

```bash
bash scripts/receipt_verify.sh
```

Confirm:
- Step 1 PASSes (1000/1000 receipts internally consistent)
- Step 2 PASSes (chain head matches between artifact and chain JSON)
- Step 3 either PASSes or shows "verification may be pending" (Bitcoin not yet confirmed, retry with `ots upgrade` later)
- Step 4 audit log retrievable in JSON, CEF, OCSF
- Step 5 public read endpoint returns 200

If Step 1 fails, **stop**. The chain has a tampering or determinism bug.

## Step 8 — Copy artifacts to repo

```bash
# On the dev box:
scp ec2-prod:/opt/latentocean/data/formed_models/_public/sec_edgar.json showcases/receipt.json
scp ec2-prod:/opt/latentocean/data/formed_models/_public/sec_edgar_chain.json showcases/receipt_chain.json
scp ec2-prod:/opt/latentocean/showcases/receipt.chainhead.ots showcases/receipt.chainhead.ots
```

## Step 9 — Optional prose updates

The `/receipt/sec-edgar` and `/receipt/verify` pages are data-driven. Most numbers come from the artifact JSON. Two places where prose may want updating:

- Hero h1 ("1,000 filings. One model. Every receipt verifiable.") — confirm actual count matches.
- Anthropic model name in prose if the run used a different model_id.

Both edits are in `frontend/app/receipt/sec-edgar/page.tsx`.

## Step 10 — Commit and deploy

```bash
git add showcases/receipt.json showcases/receipt_chain.json showcases/receipt.chainhead.ots
# plus any prose edits in frontend/app/receipt/sec-edgar/page.tsx
git commit -m "data(receipt): formation YYYY-MM-DD - 1000 receipts, chain_head <head>"
git push origin main

bash scripts/deploy.sh
```

## Step 11 — Post-deploy smoke

- [ ] `curl -s https://www.latentocean.com/api/range-public/showcase/receipt | jq '.chain_head, .n_receipts, .ots_anchored'`
- [ ] Visit `https://www.latentocean.com/receipt/sec-edgar` — confirm hero, run summary stats, chain head + OTS panel, 1,000 collapsible cards, click one to expand, click "verify this receipt" → ✓.
- [ ] Visit `https://www.latentocean.com/receipt/verify` — confirm textarea, paste a known receipt, verify ✓; click "verify entire chain" — replay 1,000 receipts in browser, ✓.
- [ ] Run `bash scripts/receipt_verify.sh` once more from the dev box; confirm.

## Step 12 — OpenTimeStamps upgrade (later)

The initial OTS proof is "pending" until the next Bitcoin block. Run `ots upgrade showcases/receipt.chainhead.ots` after a few hours / a day. The proof file is updated with the Bitcoin attestation. Re-commit the upgraded `.ots` file.

```bash
ots upgrade showcases/receipt.chainhead.ots
git add showcases/receipt.chainhead.ots
git commit -m "data(receipt): OTS proof upgraded to Bitcoin block <N>"
git push
```

## What gets etched into the citable record

- `prompt_hash` and `schema_hash`: sha256 of the committed prompt + schema files. Anyone with the repo can re-derive these.
- 1,000 receipts, each over `(prev_receipt_hash || prompt_hash || schema_hash || corpus_sha256 || model_id || timestamp || output_sha256)`.
- `chain_head`: sha256 of the final receipt.
- `receipt.chainhead.ots`: OpenTimeStamps proof anchoring the chain_head to the Bitcoin timechain. Verifiable by any third party with the `ots` CLI.

## Failure recovery

| Failure | Recovery |
|---|---|
| Anthropic API rate limit (429) | Operator-script backs off + retries automatically. If sustained, run with smaller `--target-n` and concatenate receipts.ndjson manually (incremental resume is a v2 enhancement). |
| Anthropic API outage | Wait it out. Receipts written to receipts.ndjson are not lost. |
| `ots` CLI not on PATH | Install with `pip install opentimestamps-client`. Re-stamp manually per Step 6 fallback. |
| OpenTimeStamps Bitcoin confirmation pending | Initial proof is committed; `ots upgrade` later fetches the confirmation. |
| Schema-noncompliant model output for some filings | Stored as `{"_raw": text, "_schema_compliant": false}`. Receipts still valid (over the bytes). Honest disclosure in the artifact. |
| Chain integrity verify (Step 7.1) fails | Tampering somewhere in the run. Inspect receipts.ndjson around the failed index. **Don't ship.** |
| Cost overrun | Truncate filings further (Items 1A + 7 only) or reduce `--target-n`. |
