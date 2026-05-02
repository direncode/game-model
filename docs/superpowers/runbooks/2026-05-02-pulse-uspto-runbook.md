# Pulse — USPTO Inventor Disambiguation — Operator Runbook

**Date:** 2026-05-02
**Spec:** `docs/superpowers/specs/2026-05-02-pulse-uspto-design.md`
**Plan:** `docs/superpowers/plans/2026-05-02-pulse-uspto-plan.md`

This runbook is what the operator runs end-to-end on the production EC2 to take Pulse from "scripts shipped" to "live citable artifact at /pulse/uspto-inventors". Engineer phases (Phase 0–6 of the implementation plan) are done; what follows is operator time.

## Pre-flight

Confirm before starting:

- [ ] **EC2 disk**: `df -h` shows ≥ 10 GB free. PatentsView's full bulk TSV bundle is several GB compressed, decompresses to multi-GB.
- [ ] **PatentsView download**: pick the most recent quarterly snapshot from `https://patentsview.org/download/data-download-tables`. Note the snapshot date.
- [ ] **RunPod credit** confirmed.
- [ ] **Most recent commit on main** is a green build.
- [ ] **MAX_CHUNKS=100 ceiling acknowledged**. Pulse runs 500k records. Anything beyond drops silently.

## Step 1 — Pin a PatentsView snapshot date

```bash
SNAPSHOT_DATE="2026-04-30"
echo "$SNAPSHOT_DATE" | tee /tmp/pulse_snapshot_date.txt
```

## Step 2 — Download PatentsView TSVs to EC2

```bash
ssh ec2-prod
mkdir -p /tmp/patentsview_work
cd /tmp/patentsview_work

# PatentsView's bulk distribution provides one ZIP per file. Download the
# five tables Pulse needs:
curl -O https://s3.amazonaws.com/data.patentsview.org/download/g_inventor_disambiguated.tsv.zip
curl -O https://s3.amazonaws.com/data.patentsview.org/download/g_inventor_not_disambiguated.tsv.zip
curl -O https://s3.amazonaws.com/data.patentsview.org/download/g_assignee_disambiguated.tsv.zip
curl -O https://s3.amazonaws.com/data.patentsview.org/download/g_location_disambiguated.tsv.zip
curl -O https://s3.amazonaws.com/data.patentsview.org/download/g_patent.tsv.zip

for z in *.tsv.zip; do unzip -o "$z"; done
ls -lh *.tsv
```

(Exact URLs may rotate. Check `https://patentsview.org/download/data-download-tables` for the current bulk-download index.)

## Step 3 — sha256 the inputs → corpus_input_sha256

```bash
# Fixed-order concatenation hash so re-runs match
INPUT_SHA=$(cat \
  /tmp/patentsview_work/g_inventor_disambiguated.tsv \
  /tmp/patentsview_work/g_inventor_not_disambiguated.tsv \
  /tmp/patentsview_work/g_assignee_disambiguated.tsv \
  /tmp/patentsview_work/g_location_disambiguated.tsv \
  /tmp/patentsview_work/g_patent.tsv \
  | sha256sum | awk '{print $1}')
echo "corpus_input_sha256: $INPUT_SHA" | tee /tmp/pulse_input_sha.txt
```

## Step 4 — Harvest

```bash
cd /opt/latentocean
mkdir -p data/formed_models/_inputs

python scripts/pulse_harvest.py \
    --fixtures-dir /tmp/patentsview_work \
    --output /opt/latentocean/data/formed_models/_inputs/pulse.ndjson \
    --snapshot-date "$SNAPSHOT_DATE" \
    --target-per-year 10000 \
    --per-name-cap 100 | tee /tmp/pulse_harvest.log
```

Expect ~500k records kept after two-stage sampling. Output is byte-identical given the same input + same args.

## Step 5 — sha256 the NDJSON → corpus_sha256

```bash
NDJSON="/opt/latentocean/data/formed_models/_inputs/pulse.ndjson"
CORPUS_SHA=$(sha256sum "$NDJSON" | awk '{print $1}')
echo "corpus_sha256: $CORPUS_SHA" | tee /tmp/pulse_corpus_sha.txt
ls -lh "$NDJSON"
wc -l "$NDJSON"
```

## Step 6 — Mint pulse_showcase tenant token

```bash
curl -sk -X POST -H 'Content-Type: application/json' \
    -d '{"color":"pulse_showcase"}' \
    https://www.latentocean.com/api/range-demo-token \
    | python -c "import sys,json;d=json.load(sys.stdin);open('/tmp/.pulsetoken','w').write(d['token']);print('tenant_id:', d['tenant_id'])"

chmod 600 /tmp/.pulsetoken
```

The `tenant_id` should be `pulse_showcase`.

## Step 7 — Form the model

```bash
curl -sk -X POST \
    -H "Authorization: Bearer $(cat /tmp/.pulsetoken)" \
    -H "Content-Type: application/json" \
    -d '{
      "corpus_path": "/data/formed_models/_inputs/pulse.ndjson",
      "name": "Pulse · USPTO · 500k inventor-records",
      "use_runpod": true,
      "compute_persistence": true
    }' \
    https://www.latentocean.com/api/range-form \
    | tee /tmp/pulse_form_response.json

MODEL_ID=$(python -c "import json;print(json.load(open('/tmp/pulse_form_response.json'))['id'])")
echo "model_id: $MODEL_ID"
```

Wall time: ~25-30 minutes for 500k inventor-records (smaller per-record payload than Atlas, faster fingerprinting). Run inside `nohup` or `tmux`.

## Step 8 — Analyze

```bash
python scripts/pulse_analyze.py \
    --model-id "$MODEL_ID" \
    --snapshot-date "$SNAPSHOT_DATE" \
    --corpus-input-sha256 "$INPUT_SHA" \
    --corpus-sha256 "$CORPUS_SHA" \
    --output /opt/latentocean/data/formed_models/_public/uspto.json \
    | tee /tmp/pulse_analyze.log
```

Inspect the printed numbers: engine vs PatentsView, naive-name baseline, chance, singular-inventor candidate count.

## Step 9 — Constellations

```bash
python scripts/pulse_constellations.py \
    --input /opt/latentocean/data/formed_models/_public/uspto.json \
    --output /opt/latentocean/data/formed_models/_public/pulse_findings.json
```

## Step 10 — Verify

```bash
bash scripts/pulse_verify.sh
```

Confirm:
- 7/7 query intents byte-identical on re-issue
- Cross-tenant probe → 404
- Self-tenant → 200
- Public read at `/api/range-public/showcase/pulse` → 200
- Audit log retrievable in JSON, CEF, OCSF

If any fail, **stop**. Don't ship a half-verified artifact.

## Step 11 — Copy to repo

```bash
# On the dev box:
scp ec2-prod:/opt/latentocean/data/formed_models/_public/uspto.json showcases/pulse.json
scp ec2-prod:/opt/latentocean/data/formed_models/_public/pulse_findings.json showcases/pulse_findings.json
```

## Step 12 — Optional prose updates

The page at `/pulse/uspto-inventors` is data-driven via `PulseData` and reads from `/api/range-public/showcase/pulse` at page-load. Prose update points:

- Hero h1 ("500,000 inventor-records. Fifty years. One disambiguation."): confirm actual record count matches; edit if it differs.
- Corpus-section MAX_CHUNKS=100 disclosure: update if substrate has been lifted.

Both edits live in `frontend/app/pulse/uspto-inventors/page.tsx`.

## Step 13 — Commit and deploy

```bash
git add showcases/pulse.json showcases/pulse_findings.json
# plus any prose edits in frontend/app/pulse/uspto-inventors/page.tsx
git commit -m "data(pulse): formation YYYY-MM-DD - <engine>% engine vs <naive>% naive"
git push origin main

bash scripts/deploy.sh
```

## Step 14 — Post-deploy smoke

- [ ] `curl -s https://www.latentocean.com/api/range-public/showcase/pulse | jq '.baseline_disambiguators, .n_survivors, .response_digest'`
- [ ] Visit `https://www.latentocean.com/pulse/uspto-inventors`; confirm hero, preface, corpus, live artifact (with real numbers), limits, ack render.
- [ ] Visit `https://www.latentocean.com/pulse/uspto-inventors/constellations`; confirm category pills + finding cards.
- [ ] Run `bash scripts/pulse_verify.sh` once more from the dev box; confirm 7/7 against production.

## What gets etched into the citable record

- `corpus_input_sha256` — the upstream PatentsView TSVs concatenated hash. Anyone with the same monthly snapshot can re-derive it.
- `corpus_sha256` — the harvested NDJSON's hash. Re-running `scripts/pulse_harvest.py` against the same input + same args produces byte-identical output.
- `model_id` — engine-issued, one-shot per formation.
- `response_digest` — over the model artifact. Stable on re-issue under the seed=42 + fixed-corpus contract.
- Seven query `response_digest` values from the verify run, written to the audit log in JSON/CEF/OCSF.

## Failure recovery

| Failure | Recovery |
|---|---|
| Step 7 formation hangs > 60 min | SSH check `ps`. If process died mid-chunk the partial model isn't usable. Re-run from Step 7 with same inputs; output should be byte-identical. |
| Step 7 covers < 500k records | Confirm MAX_CHUNKS hasn't been lowered below 100. If harvested NDJSON is correct (Step 5 hash matches), the loss is in form.ts. |
| Step 8 analyze fails because survivors don't join | Either the corpus NDJSON has been overwritten between Step 5 and Step 8, or the model's `recordIdx` values are out of bounds. Confirm `corpus_sha256` is unchanged. |
| Step 10 verify fails on determinism (digests differ) | The substrate has a non-determinism bug. **Don't ship.** Open a ticket. |
| PatentsView removes a snapshot | The hash anchor still holds for any reader with a copy. The hashes themselves live in `showcases/pulse.json`, committed to the repo. |
