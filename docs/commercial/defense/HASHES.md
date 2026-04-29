# Latent Ocean: Defense and Intelligence Tear Sheet — Source Hashes

**Computed:** 2026-04-28
**Algorithm:** SHA-256
**Tool:** Node v22.14.0 `crypto.createHash('sha256')`

## Canonical hashes — v1.0 (initial tear sheet, pre-megatest)

| File | SHA-256 |
|---|---|
| `docs/commercial/defense/master-tear-sheet.md` | `ab9c948c4b331abd6cebdfacaf4b04fa5cbaefccea7175af956b7f9e6e9d39de` |
| `docs/superpowers/specs/2026-04-28-defense-tear-sheet-design.md` | `990ad57108198d8e81b3e60e4be3f9783c0f8140473413f567efcd6fde3cb9ab` |

## Canonical hashes — v2.0 (synthetic-megatest-grounded tear sheet)

| File | SHA-256 |
|---|---|
| `docs/commercial/defense/master-tear-sheet-v2.md` | `ec358c6f99158033a106cc7119259609b9fe8aa2064e3f7cca8f9d508f13de14` |
| `docs/commercial/defense/MEGATEST_REPORT.md` | `1d3c014c93be13549bdb9eabe780123058de0ed87fb736239b4ec67c9f4e3ca2` |
| `data/validation/defense_megatest.json` | `7c1709b4c5788315d7d63e6bc713d11a32680d7dc54f91fb127dc70026607cea` |
| `docs/superpowers/specs/2026-04-28-defense-megatest-design.md` | `c3c614c59e1c751b75d17ddc1522c517a367bf79f1aa949161026543f1c969f9` |

## Canonical hashes — v3.0 (real-defense-data-grounded tear sheet)

The v3.0 tear sheet leads with KDDCUP99 (DARPA / MIT Lincoln Laboratory) and the EDGAR distress reconciliation. Synthetic megatest is demoted to architectural-fit secondary evidence. Amended to include the TCD-JEPA capability test cross-reference.

| File | SHA-256 | Note |
|---|---|---|
| `docs/commercial/defense/master-tear-sheet-v3.md` (initial) | `19b16177c5a4035247819c947586844caf4a21ab2599434a968b7941fe46d51c` | superseded by amended below; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended, includes TCD section) | `84546de22f62706015168f44cf55a5fd6115ac182afbad166652e366902a03a5` | current canonical v3 |
| `data/validation/defense_megatest_real_data.json` | `73cecb68d4cc5d655c0f3b50d31c41c38cb6ef42cccc162de908b87b67035f3e` | |
| `scripts/defense_megatest/real_data.py` | `5effa09d3b448bd70895f5cfbaf8525218883a8cb75dd62165adf77762bf7468` | |

## Canonical hashes — TCD-JEPA capability test on NSL-KDD intrusion data (internal capability evidence, not for sale)

| File | SHA-256 |
|---|---|
| `docs/commercial/defense/TCD_CAPABILITY_TEST.md` | `89c614d7bcce15c34ffef879c35c9cd00e0eccfa4d16b86952e6ed545110e150` |
| `data/validation/tcd_intrusion_modules.json` | `5edab5a709f5b1abea713a07f3ddd1d5282ad8e27d2875ee7747ca328f3ac136` |
| `scripts/defense_megatest/tcd_intrusion.py` | `cda24a27a1b56e395d0deec8c75387b08f02f8389c375ef12e453675e1cf2ac9` |
| `scripts/defense_megatest/runpod_deploy.py` | `3999d66cb993241799f14f149f631b20f5f2be021ea2fbded3d47aadb382f63b` |

## Megatest harness source — v1.0.0 (reproducibility manifest)

The v2.0 tear sheet's claims are reproducible from this exact source. Any modification to a file below changes the harness output and invalidates the recorded numbers in the v2.0 tear sheet.

| File | SHA-256 |
|---|---|
| `scripts/defense_megatest/__init__.py` | `1f94a147eeca1d858e2937d7a2f1cd249207dd666c191138982760539b30eebb` |
| `scripts/defense_megatest/metrics.py` | `ee0f13e58b3244652995850bf166edea903721bb79b6e1b3d91b15cc6be7c282` |
| `scripts/defense_megatest/runner.py` | `b2f33f44466373d73d15e5ff4c01687d9cff9f8762f29454e2c93f1fd37cedb7` |
| `scripts/defense_megatest/adversarial.py` | `74419d9ab21317456a2c0bcc0f4ccfef926631b72cf7a36553e96cd70cac4ad7` |
| `scripts/defense_megatest/compliance.py` | `02ee68413a7ccbb451f70df36abd8e5ea3057874030f4d144f159b9ff9b3ccc5` |
| `scripts/defense_megatest/synth.py` | `319bfe2fcd833b959a8505711560de18b87b1413229c9a628cff33bf561b29db` |
| `scripts/defense_megatest/report.py` | `5ab2b9f5c320d4c724867b1b64122d47d0de430006a99b36a1a21fb0f4cb488f` |
| `scripts/defense_megatest/run.py` | `386861d789fbca47903475b526fe2eeaf8fee6b434c163611c5937899266dc44` |

## Verification (re-compute)

    node -e "const c=require('crypto'),f=require('fs'); console.log(c.createHash('sha256').update(f.readFileSync('docs/commercial/defense/master-tear-sheet.md')).digest('hex'));"

Any divergence from the published value above means the file was modified after this hash was recorded.

## OpenTimeStamps anchoring

The markdown source is the canonical artifact. Anchoring is performed on the `.md` and `.json` files directly (rendered derivatives such as PDF, HTML, or PPTX are downstream and may carry their own hashes independently). Once anchored, proof files sit alongside their source:

- `docs/commercial/defense/master-tear-sheet.md.ots`
- `docs/commercial/defense/master-tear-sheet-v2.md.ots`
- `docs/commercial/defense/MEGATEST_REPORT.md.ots`
- `data/validation/defense_megatest.json.ots`
- `docs/superpowers/specs/2026-04-28-defense-tear-sheet-design.md.ots`
- `docs/superpowers/specs/2026-04-28-defense-megatest-design.md.ots`

To anchor (from a terminal where `ots` runs cleanly):

    ots stamp docs/commercial/defense/master-tear-sheet.md
    ots stamp docs/commercial/defense/master-tear-sheet-v2.md
    ots stamp docs/commercial/defense/MEGATEST_REPORT.md
    ots stamp data/validation/defense_megatest.json
    ots stamp docs/superpowers/specs/2026-04-28-defense-tear-sheet-design.md
    ots stamp docs/superpowers/specs/2026-04-28-defense-megatest-design.md

Calendar servers (alice, bob, finney by default) accept the SHA-256 digest and return a calendar attestation. Bitcoin-block confirmation typically arrives within a few hours; `ots upgrade` then updates the proof files once the calendar attestations are committed to the chain.

## Reproducing the v2.0 synthetic megatest numbers

The v2.0 tear sheet is grounded in the megatest artifact at `data/validation/defense_megatest.json`. To reproduce that artifact:

    python -m scripts.defense_megatest.run --quick

Expected wall-clock: 6 to 8 seconds on commodity 2023 laptop hardware. Expected output: 91 / 123 (74.0%) PASS verdict, with the per-vertical recall-in-survivors values printed in the v2.0 tear sheet's megatest table. Determinism is bit-identical at seed=42; deviations more than 1% indicate environment drift (numpy/scipy version, BLAS library) and warrant investigation.

## Reproducing the v3.0 real-defense-data numbers

The v3.0 tear sheet is grounded in the real-data artifact at `data/validation/defense_megatest_real_data.json`. To reproduce:

    python -m scripts.defense_megatest.real_data

Expected wall-clock: ~10 seconds on commodity 2023 laptop hardware. The script fetches KDDCUP99 from the sklearn cache (or downloads it on first run; ~5 minutes one-time download), then runs BTUT, Isolation Forest, and Local Outlier Factor on the same 6,000-entity sample with 600 attacks (10% attack rate). Expected headline: BTUT recall_in_survivors=41.5%, AUC=0.613; Isolation Forest recall=54.3%, AUC=0.845; Local Outlier Factor recall=14.0%, AUC=0.401. KDDCUP99 attack labels are provided by sklearn upstream; reconciliation with EDGAR distress prediction is included in the artifact for the predictive-task honest framing.

## Local-machine note (2026-04-28)

The Python OpenTimeStamps client (`opentimestamps-client` 0.7.2) on the authoring machine currently fails to load due to an OpenSSL DLL resolution error inside `python-bitcoinlib`'s `bitcoin.core.key` import. The anchoring step should be run from a working terminal, either by repairing the Python install or by installing the JavaScript client (`npm install -g javascript-opentimestamps`).

This file records the canonical hashes so that anchoring can be performed asynchronously without losing the chain of custody between authorship time (2026-04-28) and Bitcoin attestation time. The hash above does not change when the OTS proof is later attached.

## IP posture

Trade secret with OpenTimeStamps cryptographic anchoring on public capability declarations. No patents filed. No patent-pending claims. The hash above is the public-time-anchor handle for this artifact's content; the underlying algorithmic and implementation work remains protected as trade secret in the source repository.
