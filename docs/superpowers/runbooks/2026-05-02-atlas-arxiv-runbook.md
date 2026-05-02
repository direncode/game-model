# Atlas — arXiv Showcase — Operator Runbook

**Date:** 2026-05-02
**Spec:** `docs/superpowers/specs/2026-05-02-atlas-arxiv-design.md`
**Plan:** `docs/superpowers/plans/2026-05-02-atlas-arxiv-plan.md`
**Recon:** `docs/superpowers/specs/2026-05-02-atlas-arxiv-recon.md`

This runbook is what the operator runs end-to-end on the production EC2 to take Atlas from "scripts shipped" to "live citable artifact at /atlas/arxiv". The engineer phases (Phase 0–6 of the implementation plan) are done; what follows is operator time.

## Pre-flight

Confirm before starting:

- [ ] **EC2 disk**: `df -h` shows ≥ 5 GB free on the volume holding `/opt/latentocean/data/formed_models/`. The Kaggle download is ~1.5 GB plus the harvested NDJSON (~500 MB) plus working space.
- [ ] **Kaggle API credentials** are installed on EC2 at `~/.kaggle/kaggle.json` with mode 600. Without these, fall back to manual download + `scp`.
- [ ] **RunPod credit** is available. Atlas formation uses one RunPod finalize call.
- [ ] **Most recent commit on main** is a green build (the deploy at the end depends on a clean build).
- [ ] **MAX_CHUNKS=100 ceiling acknowledged**. Atlas runs 500k records ≤ 100 chunks × 5000. Anything beyond that will silently drop records (see recon doc).

## Step 1 — Pin a Kaggle snapshot date

Choose the most recent monthly Kaggle dump. Record the date in YYYY-MM-DD form.

```bash
# Example: pin to 2026-04 monthly snapshot
SNAPSHOT_DATE="2026-04-30"
echo "$SNAPSHOT_DATE" | tee /tmp/atlas_snapshot_date.txt
```

## Step 2 — Download the snapshot to EC2

```bash
ssh ec2-prod
mkdir -p /tmp/arxiv_work
cd /tmp/arxiv_work

# Via Kaggle API (preferred):
kaggle datasets download Cornell-University/arxiv -p . --force
unzip -o arxiv.zip
mv arxiv-metadata-oai-snapshot.json arxiv-metadata-oai-snapshot-${SNAPSHOT_DATE}.json
ls -lh
```

If Kaggle API isn't installed, download locally and `scp` the file.

## Step 3 — sha256 the input → corpus_input_sha256

```bash
INPUT="/tmp/arxiv_work/arxiv-metadata-oai-snapshot-${SNAPSHOT_DATE}.json"
INPUT_SHA=$(sha256sum "$INPUT" | awk '{print $1}')
echo "corpus_input_sha256: $INPUT_SHA" | tee /tmp/atlas_input_sha.txt
```

This anchor is the upstream pin. Record it.

## Step 4 — Harvest

```bash
cd /opt/latentocean
mkdir -p data/formed_models/_inputs

python scripts/arxiv_harvest.py \
    --input "$INPUT" \
    --output /opt/latentocean/data/formed_models/_inputs/arxiv.ndjson \
    --snapshot-date "$SNAPSHOT_DATE" \
    --target-per-year 14500 | tee /tmp/atlas_harvest.log
```

Expect ~500k records kept. Output is byte-identical given the same input + same args, so re-runs reproduce.

## Step 5 — sha256 the NDJSON → corpus_sha256

```bash
NDJSON="/opt/latentocean/data/formed_models/_inputs/arxiv.ndjson"
CORPUS_SHA=$(sha256sum "$NDJSON" | awk '{print $1}')
echo "corpus_sha256: $CORPUS_SHA" | tee /tmp/atlas_corpus_sha.txt
ls -lh "$NDJSON"
wc -l "$NDJSON"
```

## Step 6 — Mint atlas_showcase tenant token

```bash
curl -sk -X POST -H 'Content-Type: application/json' \
    -d '{"color":"atlas_showcase"}' \
    https://www.latentocean.com/api/range-demo-token \
    | python -c "import sys,json;d=json.load(sys.stdin);open('/tmp/.atlastoken','w').write(d['token']);print('tenant_id:', d['tenant_id'])"

chmod 600 /tmp/.atlastoken
```

The `tenant_id` should be `atlas_showcase`. Token is stored at `/tmp/.atlastoken` for the analyze + verify scripts.

## Step 7 — Form the model

The frontend `/api/range-form` POST orchestrates chunked formation server-side. Pass the corpus path on EC2's container-mounted FS:

```bash
curl -sk -X POST \
    -H "Authorization: Bearer $(cat /tmp/.atlastoken)" \
    -H "Content-Type: application/json" \
    -d '{
      "corpus_path": "/data/formed_models/_inputs/arxiv.ndjson",
      "name": "Atlas · arXiv · 500k stratified",
      "use_runpod": true,
      "compute_persistence": true
    }' \
    https://www.latentocean.com/api/range-form \
    | tee /tmp/atlas_form_response.json

MODEL_ID=$(python -c "import json;print(json.load(open('/tmp/atlas_form_response.json'))['id'])")
echo "model_id: $MODEL_ID"
```

Wall time: ~125 minutes for 500k records / 100 chunks. Don't break the SSH session — run inside `nohup` or `tmux` if needed.

## Step 8 — Analyze

```bash
python scripts/arxiv_analyze.py \
    --model-id "$MODEL_ID" \
    --snapshot-date "$SNAPSHOT_DATE" \
    --corpus-input-sha256 "$INPUT_SHA" \
    --corpus-sha256 "$CORPUS_SHA" \
    --target-per-year 14500 \
    --output /opt/latentocean/data/formed_models/_public/arxiv.json \
    | tee /tmp/atlas_analyze.log
```

Inspect the printed numbers: coarse purity, fine purity, emergence-candidate count, baseline panel.

## Step 9 — Constellations

```bash
python scripts/arxiv_constellations.py \
    --input /opt/latentocean/data/formed_models/_public/arxiv.json \
    --output /opt/latentocean/data/formed_models/_public/atlas_findings.json
```

Confirm ~50–100 findings across 6 categories.

## Step 10 — Verify

```bash
bash scripts/atlas_verify.sh
```

Confirm:

- 7/7 query intents byte-identical on re-issue
- Cross-tenant probe → 404
- Self-tenant → 200
- Public read → 200
- Audit log retrievable in JSON, CEF, OCSF

If any of these fail, **stop**. Don't ship a half-verified artifact.

## Step 11 — Copy to repo

Pull the public JSON and the findings JSON into the repo as the local committed snapshot:

```bash
# On the dev box:
scp ec2-prod:/opt/latentocean/data/formed_models/_public/arxiv.json showcases/atlas.json
scp ec2-prod:/opt/latentocean/data/formed_models/_public/atlas_findings.json showcases/atlas_findings.json
```

## Step 12 — Optional prose updates

The page at `/atlas/arxiv` is data-driven via `AtlasData` and reads from `/api/range-public/showcase/atlas` at page-load. Most numbers in the page render dynamically and need no prose update.

Two places where prose may want updating against the actual run:

- The hero h1 ("500,000 papers / Eight disciplines / Thirty years.") — confirm the actual record count matches "500,000 papers." If the run produced e.g. 487k, edit the hero number to the actual.
- The corpus section's "MAX_CHUNKS = 100 ceiling" disclosure — if the substrate has been lifted between writing this runbook and now, update the disclosure.

Both edits live in `frontend/app/atlas/arxiv/page.tsx`.

## Step 13 — Commit and deploy

```bash
git add showcases/atlas.json showcases/atlas_findings.json
# plus any prose edits in frontend/app/atlas/arxiv/page.tsx
git commit -m "data(atlas): formation YYYY-MM-DD - <coarse>% purity / <n> survivors"
git push origin main

# Deploy via the existing deploy script
bash scripts/deploy.sh
```

## Step 14 — Post-deploy smoke

- [ ] `curl -s https://www.latentocean.com/api/range-public/showcase/atlas | jq '.purity.coarse_8_archive, .n_survivors, .response_digest'`
- [ ] Visit `https://www.latentocean.com/atlas/arxiv` in a browser; confirm hero, corpus, live artifact (with real numbers), limits, ack render.
- [ ] Visit `https://www.latentocean.com/atlas/arxiv/constellations`; confirm category pills + findings cards.
- [ ] Run `bash scripts/atlas_verify.sh` once more from the dev box; confirm 7/7 still passes against production.

## What gets etched into the citable record

- `corpus_input_sha256` — the upstream Kaggle file's hash. Anyone with the same monthly snapshot can re-derive it.
- `corpus_sha256` — the harvested NDJSON's hash. Re-running `scripts/arxiv_harvest.py` against the same input + same args produces a byte-identical file.
- `model_id` — issued by the engine, one-shot per formation.
- `response_digest` — over the model artifact. Stable on re-issue under the seed=42 + fixed-corpus contract.
- Seven query `response_digest` values from the verify run, written to the audit log in JSON/CEF/OCSF.

The artifact ships when all of the above are committed inside `showcases/atlas.json` and the page at /atlas/arxiv quotes only numbers that derive from this file.

## Failure recovery

| Failure | Recovery |
|---|---|
| Step 7 formation hangs past 200 min | SSH check `ps`, the formation worker. If the process died mid-chunk, the partial model isn't usable. Re-run from Step 7 with the same inputs; output should be byte-identical to whatever a successful run would have produced. |
| Step 7 returns < 500k records covered | Confirm MAX_CHUNKS hasn't been lowered below 100 in form.ts. If the harvested NDJSON is correct (Step 5 hash matches), the loss is in form.ts; check logs. |
| Step 8 analyze fails because survivors don't join | Either the corpus NDJSON has been overwritten between Step 5 and Step 8, or the model's `recordIdx` values are out of bounds. Confirm `corpus_sha256` is unchanged via `sha256sum`. |
| Step 10 verify fails on determinism (digests differ) | The substrate has a non-determinism bug. **Don't ship.** Open a ticket. The determinism contract is the only thing Atlas is selling. |
| Step 12 deploy fails | Inspect deploy logs. The page is purely additive (new routes); a deploy failure is more likely environmental than Atlas-specific. |
