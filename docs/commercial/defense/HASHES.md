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

The v3.0 tear sheet leads with KDDCUP99 (DARPA / MIT Lincoln Laboratory) and the EDGAR distress reconciliation. Synthetic megatest is demoted to architectural-fit secondary evidence. Amended twice: first to add a TCD-JEPA capability test cross-reference, then to include the per-module attack-subtype alignment table that demonstrates each module's interpretable identity (including the unsupervised discovery of a Neptune SYN-flood basin at mod_attractor_9).

| File | SHA-256 | Note |
|---|---|---|
| `docs/commercial/defense/master-tear-sheet-v3.md` (initial) | `19b16177c5a4035247819c947586844caf4a21ab2599434a968b7941fe46d51c` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended A: + TCD section) | `84546de22f62706015168f44cf55a5fd6115ac182afbad166652e366902a03a5` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended B: + per-module alignment table) | `16cb791afb2ff3a2a3b7ad726d6fb5263d70c838b4662b45dc3cbb6ed343d37c` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended C: + RunPod GPU attempt outcome) | `abc32fdd17bf4f30b3fb9d28f4c777256abe2581a963c42ed1ee059ca4ecbca1` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended D: + GPU run completed, AUC 0.9111, 3 modules) | `2cbe590bff2df678ae682c0db38c5003c8722adf874fe21d39c563886863d105` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended E: + honesty pass on simulation/BTUT findings) | `c65155c330717907bb95c1ce88eb4835ddd1daf727f4af8205176ee3e22e8a8e` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended F: + REAL 18-module GPU recursive-loop run on cuda RTX 4090) | `04247d8e4864ea0684c09ca1308329ed40acc0e8d5d51d748e21aa7d1dff84eb` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended G: + CPU BTUT pre-reduction proof: 9s, 30x reduction, rare-attack lift up to 30.10x) | `f93fb09185e0aca7887726b83f61e01f34f037cab9d629cca41924d48351e472` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended H: + integrated BTUT→TCD pipeline run, 14 normal-archetype basins) | `8149dd4df5f2a7d6d1f031ecd37d8b7490ad07f51661db93837da722d7f0f6bb` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/master-tear-sheet-v3.md` (amended I: + named module catalog (Neptune-Alpha/Beta/Gamma + Normal-Pure-Alpha..Kappa) with interlink purity gradient) | `d5f154fe3e152547ede16ef37e5b0c42d21de930a3d017057b54a0c606010b0b` | **current canonical v3** |
| `data/validation/defense_megatest_real_data.json` | `73cecb68d4cc5d655c0f3b50d31c41c38cb6ef42cccc162de908b87b67035f3e` | |
| `scripts/defense_megatest/real_data.py` | `5effa09d3b448bd70895f5cfbaf8525218883a8cb75dd62165adf77762bf7468` | |

## Canonical hashes — TCD-JEPA capability test on NSL-KDD intrusion data (internal capability evidence, not for sale)

Amended to include per-module attack-subtype alignment analysis. The artifact and capability-test report now show, for every crystallized AttractorModule, which NSL-KDD attack subtype dominates the module's 50-nearest-neighbor latent neighborhood. mod_attractor_9 was identified as a Neptune (SYN-flood DoS) basin without supervision.

| File | SHA-256 | Note |
|---|---|---|
| `docs/commercial/defense/TCD_CAPABILITY_TEST.md` (initial) | `89c614d7bcce15c34ffef879c35c9cd00e0eccfa4d16b86952e6ed545110e150` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/TCD_CAPABILITY_TEST.md` (with per-module alignment table) | `7c9d1ab5d2ceec5b43d54fd5c7771e012d1589a364aeb62f24bf6aa0d9122e41` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/TCD_CAPABILITY_TEST.md` (+ RunPod GPU attempt section) | `e2af7d3db6f2ffc387f42db43320d28a855db155a8f8fce46d0f5b32f37ab3ab` | superseded; preserved for chain-of-custody |
| `docs/commercial/defense/TCD_CAPABILITY_TEST.md` (+ GPU run completed, full module table + comparison to CPU) | `134ee69cd58a420438b0819ea81923e3ff556e225eb1324fd46c0ffb0dcfb257` | **current canonical** |
| `data/validation/tcd_intrusion_modules.json` (initial) | `5edab5a709f5b1abea713a07f3ddd1d5282ad8e27d2875ee7747ca328f3ac136` | superseded |
| `data/validation/tcd_intrusion_modules.json` (with alignment data) | `d3ed1820a71d1a07acd275608a5432ac55ffdfa3111f924b8028d56f887ddc6f` | **current canonical** |
| `scripts/defense_megatest/tcd_intrusion.py` (initial) | `cda24a27a1b56e395d0deec8c75387b08f02f8389c375ef12e453675e1cf2ac9` | superseded |
| `scripts/defense_megatest/tcd_intrusion.py` (with alignment analysis) | `562c534a806735a97b4100f108b8819e527bda4c9bbd4db6c76565a5e3dce082` | **current canonical** |
| `scripts/defense_megatest/runpod_deploy.py` | `3999d66cb993241799f14f149f631b20f5f2be021ea2fbded3d47aadb382f63b` | unchanged |
| `scripts/defense_megatest/runpod_submit.py` | `8aeb357170082e89bc67078b108c8ec6eff3c4aa29e1190852c5a31332fefd9c` | live submission script used for GPU attempt |
| `data/validation/runpod_tcd_attempt_log.txt` | `5ca35196c1493ac78116cc27794baeee68f4852e14e3d6ae517abbe0f0033721` | combined log: cancelled attempt 2026-04-28 + completed run 2026-04-29 |
| `data/validation/runpod_tcd_intrusion_result.json` | `95d612d58386604b20e6e4b7fbc37ff0121a4b60fbd043f42e040976e2cb5d9a` | serverless GPU run artifact (cuda, AUC 0.9111, 3 simulation-fallback modules) |
| `scripts/defense_megatest/runpod_ssh_orch.py` | `da2bd2c9a2ac47e38811ff5e5c744bcf211c2263e41238d1ea4e1c54a7bd13f9` | non-serverless GPU pod orchestrator (provisions pod, SSHes in, runs recursive loop, pulls result) |
| `data/validation/runpod_real_gpu_modules.json` | `31fb1acf9a07408b766f83c935410d452f97bb2c02bb2e70bbb5ca45269b0289` | **REAL GPU TCD module artifact** (RTX 4090, 18 AttractorModules with H_0 persistence + centroids + attack-subtype alignment; 5 Neptune-dominated, 3 of those at 100% Neptune purity) |
| `scripts/defense_megatest/run_btut_nslkdd.py` | `7ead638de8a5be61838da312fd73f886fd5ec18371e82524970bf0519fdd47c3` | CPU BTUT runner on NSL-KDD (proves BTUT runs in 9s, 30x reduction with rare-attack lift up to 30.10x for warezmaster and land) |
| `data/validation/btut_nslkdd_survivors.json` | `75e3b90d79ed5c212476506b09df8db827bf9f41ff4bb2df96b77aff99a2f69e` | BTUT NSL-KDD survivors artifact: 299 of 9000 (30x), per-subtype lift table |
| `scripts/defense_megatest/run_btut_then_tcd.py` | `18ab57c4baa66025687a7ab2c44c95d43b6d7668510f6fbc3c944f1f3f5f4ce6` | Integrated BTUT → TCD pipeline runner with plain-English module narratives |
| `data/validation/btut_then_tcd_nslkdd.json` | `7a0ba32ac34890f289f3263911ebcf0a59b7c92d0a3dc43bfdf35a778dd509d7` | Integrated pipeline artifact: BTUT 9s + TCD 98s, 14 normal-archetype modules with plain-English narratives |
| `docs/commercial/defense/MODULE_CATALOG.md` | `06868f88701c8c1fd473f669d33eaf7442e39bb4f65bb0f1e223405beb4a4a69` | Named module catalog: 18 attractors organized into 6 families (Neptune-Core/Frontier/Periphery + Normal-Adjacent-Attack/Pure) with interlink purity gradient and plain-English narratives |
| `data/validation/named_modules_catalog.json` | `d7ae6afe5fa56739c2cf698be192f503474e549eb7376107e3b5587a299c142f` | Machine-readable named module catalog (family groupings, persistence ranks, attack shares) |
| `scripts/defense_megatest/name_and_interlink_modules.py` | `56a80d8a424356dc6f421ad81d8ee38a52527a98e01b7f3cf3d65f25e59a8a97` | Reads runpod_real_gpu_modules.json and generates the named-and-interlinked catalog |

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
