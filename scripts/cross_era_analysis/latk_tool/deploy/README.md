# LATK Query Server — EC2 Deployment

The LATK query server is a thin FastAPI router inside the existing
backend service (`backend/app/api/v1/latk.py`). It exposes three
endpoints backed by the `scripts/cross_era_analysis/latk_tool` package
and the on-disk lattice JSON files in `scripts/cross_era_analysis/output/`.

Because it lives inside the existing backend, **there is no separate
service to deploy** — the LATK routes are already active on the main
backend once the `latk_router` include line in
`backend/app/api/v1/__init__.py` is merged to the production branch.

Endpoints
---------
```
GET  /api/v1/latk/health
GET  /api/v1/latk/lattices
POST /api/v1/latk/novelty            {query, lattice_id, top_k?, method?}
POST /api/v1/latk/route-to-ancestors {query, lattice_id, top_k?}
```

Lattice files the server expects
--------------------------------
The server reads lattice files directly from the repo:

```
scripts/cross_era_analysis/output/latk_mini_btut_result_v2.json
scripts/cross_era_analysis/output/linguistics_btut_result_v2.json
scripts/cross_era_analysis/output/latk_physics_btut_result_v2.json   (phase 1)
```

Files use `_v2` suffix to mark the Phase 1 format with `embed_context` +
`embeddings_8d`. Legacy Phase 0 files (without `_v2`) are also exposed
via the API with `_legacy` suffixes for backwards comparison.

These files are not committed to the repo (they're build artifacts).
They must be present on the EC2 instance at the paths shown above.

Deployment steps (user runs these manually via SSH)
---------------------------------------------------
Your memory contains the SSH access details for the production EC2
instance. These commands assume that alias; adjust if your host is
named differently.

```bash
# 1. Push the code changes
git push origin main

# 2. SSH to prod
ssh prod

# 3. Pull on prod
cd /opt/latentocean
git pull origin main

# 4. Copy the LATK lattice files onto the box (from your laptop)
#    — these are build artifacts, not version-controlled
scp scripts/cross_era_analysis/output/latk_mini_btut_result_v2.json \
    prod:/opt/latentocean/scripts/cross_era_analysis/output/
scp scripts/cross_era_analysis/output/linguistics_btut_result_v2.json \
    prod:/opt/latentocean/scripts/cross_era_analysis/output/
# (once Phase 1 ingest finishes)
scp scripts/cross_era_analysis/output/latk_physics_btut_result_v2.json \
    prod:/opt/latentocean/scripts/cross_era_analysis/output/

# 5. Restart the backend so latk_router is picked up
ssh prod "cd /opt/latentocean && docker compose restart backend"

# 6. Verify
curl https://<your-prod-host>/api/v1/latk/health
curl https://<your-prod-host>/api/v1/latk/lattices
```

Smoke test via curl
-------------------
```bash
curl -X POST https://<your-prod-host>/api/v1/latk/novelty \
  -H "Content-Type: application/json" \
  -d '{
    "query": "In language there are only differences and no positive terms.",
    "lattice_id": "linguistics",
    "top_k": 10,
    "method": "combined"
  }'
```

Expected: status 200, a NoveltyResponse body with `ranking_method:
"combined"`, top entities dominated by Saussure / Humboldt / Chomsky /
distributional semantics, and a `notes` array explaining the RRF weights.

Why not a separate process
--------------------------
1. The existing backend already has FastAPI, uvicorn, and all BTUT imports.
2. The LATK lattice files are small (~1-50 MB) and fit in RAM, so the
   cache is a plain dict inside the router module.
3. No new authentication layer needed — reuse whatever the backend has.
4. Restarting a single service is simpler than provisioning a new one.

If you later want to split this out (e.g. for independent scaling), the
router is self-contained: move `latk.py` + the `latk_tool` package into
a new FastAPI app and swap the path prefix.
