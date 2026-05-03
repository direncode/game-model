# Universal pipeline — corpus → modules → novel insight

*Authoritative reference for running the BTUT + TCD-JEPA stack on any corpus.
Optimized for universality across data types (text, numeric, graph) and for
maximum novel-insight yield at scale. Written from observed behaviour on
two corpora (NSL-KDD numeric flows, TNA HW catalogue text) and one
GPU-via-RunPod run.*

---

## 1. The five-stage contract

Every corpus goes through the same five stages. The *interfaces* between
stages are universal; the *implementations* swap per data type.

```
                   Stage 0          Stage 1            Stage 2          Stage 3        Stage 4
   raw corpus ─►  embed   ─►  BTUT pre-reduce  ─►  TCD recursive  ─►  align    ─►  narrate
   N records      N×D vec     S survivors           M modules           per-module     per-module
                                                                        evidence       prose
```

Each arrow is an explicit, deterministic-at-seed function. If a stage cannot
produce its output, **it must fail loudly, not silently fall through.**
(See §6 anti-patterns — every pipeline failure we've debugged was a silent
fallback that looked like success.)

### Stage 0 — embed

| Input  | corpus records (any shape)                                        |
| ------ | ----------------------------------------------------------------- |
| Output | `Z ∈ ℝ^{N×D}`, L2-normalized                                      |
| Seed   | required (default 42)                                             |

The embedder must be **deterministic**, **structure-preserving**, and **scale
in O(N)** (no all-pairs operations).

| Data type     | Embedder                                              | Validated D |
| ------------- | ----------------------------------------------------- | ----------- |
| Numeric flows | one-hot categoricals → standardize → JL projection    | 64–128      |
| Text          | TF-IDF (uni+bigrams, sublinear) → JL projection       | 128         |
| Graph         | structural fingerprint + adjacency-aware → train_graph| 96–256      |
| Mixed         | concat per-type embedders, re-normalize               | sum of comps|

**Scale knob:** D ≈ √(distinct features). Higher D wastes compute past the
point of useful resolution; lower D collides distinct records.

### Stage 1 — BTUT pre-reduce (optional)

| Input  | `Z ∈ ℝ^{N×D}` + entity attrs                                     |
| Output | `S` survivors with `S ≪ N`, structurally distinctive             |
| Knob   | `target_survivors`, `budget_dollars`                             |

BTUT keeps the records whose attribute fingerprints are structurally
distinctive (rare patterns, edge-of-distribution flows). Useful when the
substrate has a heavy normal/background mass that would dominate
downstream clustering.

**Skip BTUT when:**
- Corpus is already small (`N < 1000`).
- Records are uniformly informative (most text corpora — every catalogue
  description is dense, no "background traffic" to filter).
- Embedder is dense and non-sparse (TF-IDF projections have no structural
  fingerprint to threshold against).

**Use BTUT when:**
- Corpus has heavy class imbalance and the rare class is the target (NSL-KDD
  intrusion: 47% normal / 53% attack, but the *interesting* attacks are <1%).
- N > 5000 and you want to bound TCD wallclock.
- Records are numeric/categorical with a structural-distinctiveness notion.

### Stage 2 — TCD recursive loop

| Input  | `Z'` (post-BTUT or post-embed)                                   |
| Output | `M` modules with topology + centroid                             |
| Loop   | System-2 Langevin explore + System-3 persistent-homology cryst.  |

The recursive loop is dataset-agnostic. The only corpus-specific input is
the **energy function**, which determines what the explorer treats as the
"basin to leave."

**Energy function library:**

```python
# Mode-seeking (no labels). Best for honest discovery.
energy = ||z - corpus_mean||²

# Anomaly-from-normal (uses labels). Best when normal is well-defined.
energy = ||z - normal_centroid||²    # NSL-KDD pattern

# Density-based (no labels, scale-aware). Best at very large N.
energy = -log p̂(z)    # KDE or normalizing flow estimate

# Custom (corpus-specific). Use only if you have a domain-grounded reason.
```

The first two are validated. The third scales but adds a hyperparameter
(bandwidth) that affects findings. The fourth is dangerous because it lets
domain expectations leak into the discovery objective — use sparingly.

**Iteration knob:** 16–24 iterations covers the typical converge plateau.
Beyond 24, modules accumulate without producing new structure.

### Stage 3 — align

For each module, find the K=50 nearest records by distance to module
centroid. Compute:

```
dominant_label_share = max_label_count / K
bleed_share          = 1 - dominant_label_share
top3_distribution    = Counter(labels of K nearest).most_common(3)
```

**Two label schemes** must be tracked:
1. **Coarse (domain)**: e.g. NSL-KDD attack vs. normal, TNA HW series.
2. **Fine (sub-archetype)**: e.g. NSL-KDD attack subtype, TNA primary_category.

The fine label is what separates "label recovery" (low novelty) from
"sub-structure discovery" (high novelty).

### Stage 4 — narrate

A single paragraph per module that the reader can verify against the data:

- Dominant label + share (the cluster's headline).
- Bleed: which other labels show up, with counts (the unexpected part).
- Topology: H₀ persistence (cluster compactness) + centroid norm
  (location in latent space).
- 5 representative records by paper_id/title (so a domain expert can
  inspect the actual basin).

**The narrative is the only place where domain language enters.** Every
preceding stage is corpus-agnostic.

---

## 2. Novel-insight criteria

Not every formed module is a finding. Use these gates to triage:

| Module property                    | Reading                                            |
| ---------------------------------- | -------------------------------------------------- |
| Dominant share ≥ 95%, low bleed    | **Label recovery**, not novelty. The engine recovered an existing label. |
| Dominant share 30–60%, high bleed  | **Sub-structure** the existing labels don't capture. Investigate. |
| Dominant share < 30%, bleed > 70%  | Either real cross-label structure OR noise. Disambiguate via persistence. |
| Persistence H₀ > 8, share < 50%    | **Strong novelty candidate.** Topologically distinct basin that is NOT label-aligned. |
| Persistence H₀ < 3, any share      | Noise; ignore.                                     |
| All modules dominated by one label | Either real (one-label corpus) or BTUT collapsed; check survivor diversity. |

**The novelty score we use:**
```
novelty = persistence × bleed_share × (1 / dominant_share)
```
- High persistence ⇒ topologically real basin
- High bleed ⇒ doesn't match existing labels
- Low dominant share ⇒ no single label explains it

A module with persistence 11.5, bleed 0.7, dominant 0.30 scores ≈ 26.8.
A pure-label module (persistence 8, bleed 0, dominant 1.0) scores 0. The
ranking surfaces the actual *findings* above the *recoveries*.

---

## 3. Universal-corpus checklist

Before declaring a corpus "wired in":

- [ ] NDJSON shape: `paper_id, archive (coarse label), primary_category (fine label), text, year`
- [ ] Embedder produces `Z ∈ ℝ^{N×D}` with `‖z_i‖₂ = 1`, deterministic at seed
- [ ] Embedder does *not* leak labels into the projection (no per-class re-normalization)
- [ ] Reproducibility: SHA-256 of sorted `Z[:, 0]` matches between two independent runs
- [ ] Stratified sample available (so under-represented labels survive sampling)
- [ ] Energy function is dataset-agnostic (default: distance to corpus mean)

---

## 4. Scale guidance

| N             | BTUT? | TCD substrate | Wallclock         | Hardware        |
| ------------- | ----- | ------------- | ----------------- | --------------- |
| < 500         | skip  | full N        | 1–2 min           | CPU             |
| 500–5,000     | optional | survivors  | 2–10 min          | CPU             |
| 5,000–50,000  | yes   | survivors    | 5–20 min          | CPU OK, GPU 5×  |
| 50,000–500K   | yes   | survivors    | 30–120 min        | GPU recommended |
| > 500K        | yes   | survivors    | hours             | GPU mandatory   |

**Crossover point:** ~5,000 records. Below this, GPU provisioning overhead
(2 min cold start on RunPod, plus pod boot) eats the speedup. Above this,
the recursive loop's nearest-neighbor steps dominate and GPU pays off.

**Cost benchmark (RunPod, RTX 4090 community pricing):**
- 8,000 NSL-KDD flows, 80 epochs ≈ 3.5 min pod runtime + 30s provisioning
  ≈ \$0.40 per run.
- Validated end-to-end via `runpod_pod_real_modules.py` (bypasses
  serverless handler's silent-fallback path; see §6).

---

## 5. Validated reference runs

These are the runs the system has *actually completed* with real (not
simulated) modules. Use them to calibrate any new corpus.

### NSL-KDD intrusion (numeric, CPU)

```
python -m scripts.defense_megatest.run_btut_then_tcd
```

| Stage           | Shape                                       | Wall   |
| --------------- | ------------------------------------------- | ------ |
| Stage 1 BTUT    | 9000 → 299 survivors (30× reduction)        | 7.9s   |
| Stage 2 TCD     | 299 → 15 modules, 16 iters                  | 84.6s  |
| Stage 3 align   | K=50, dominant share + attack subtype       | <1s    |

**Module composition:**
- 14 of 15 modules are 100% normal (sub-archetypes of background traffic)
- 1 of 15 modules is mixed: 54% normal / 30% Neptune SYN-flood / 16% SATAN scanner
- All persistence H₀ in [7.7, 9.5], centroid norms [0.36, 0.62]

**Reading:** the engine over-resolved the normal manifold and under-resolved
the attack manifold. This is a methodology observation, not a finding.
Tune `crystallize_every` upward and weight the energy function by
attack-distance to rebalance.

### TNA HW catalogue (text, CPU)

```
python -m scripts.defense_megatest.run_tna_btut_then_tcd \
    --corpus tmp/bombe_tna.ndjson --target 500 --skip-btut
```

| Stage           | Shape                                       | Wall   |
| --------------- | ------------------------------------------- | ------ |
| Stage 0 embed   | TF-IDF → 128-D (10k features → 128)         | 0.27s  |
| Stage 2 TCD     | 400 → 14 modules, 16 iters                  | 121.6s |
| Stage 3 align   | K=50, dominant HW series + bleed            | <1s    |

**Module composition (this is the actual finding pattern):**

| Module       | Dominant series        | Share | Bleed | H₀  |
| ------------ | ---------------------- | ----- | ----- | --- |
| mod_attractor_2  | german_machine_decrypts | 46%   | 54%   | 11.2 |
| mod_attractor_4  | british_sigint_history  | 42%   | 57%   | 11.4 |
| mod_attractor_10 | german_machine_decrypts | 42%   | 57%   | 11.3 |
| mod_attractor_11 | german_machine_decrypts | 40%   | 60%   | 11.3 |
| mod_attractor_7  | diplomatic_decrypts     | 38%   | 62%   | 11.5 |
| mod_attractor_5  | comintern_decrypts      | 36%   | 64%   | 11.1 |
| ...          | ...                    | ...   | ...   | ... |

**Reading:** *zero* modules are pure (highest dominant share is 46%). Every
module pulls from multiple HW series. Persistence is uniformly high
(11.1–11.9).

The headline finding from this corpus, **validated across four seeds and
across a 4× scale jump (500 → 2,169 records)**:

> **HW 1 (`directorate_to_pm`) is structurally a *channel*, not a *content
> type*. The engine surfaces this without being told the labels.**

Evidence trail:

| Check                          | Result                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| PM-dominant modules @ seed 42 (500) | 0 / 14                                                                |
| PM-dominant modules @ seed 42 (2,169) | 0 / 12 (everything collapses onto German basins; PM still has none) |
| PM-dominant modules @ seed 43 (500) | 0 / 14                                                                |
| PM-dominant modules @ seed 44 (500) | 1 / 14 (40% plurality, content-mixed)                                 |
| PM-dominant modules @ seed 45 (500) | 0 / 14                                                                |
| **Total** PM-dominant modules across 5 runs | **1 / 70** (vs ~7 expected at PM's 10% corpus share — a 7× shortfall) |
| Per-record content routing @ seed 43 | 12 PM → comintern (Russian Front), 12 → diplomatic (Naval), 10 → german (Wehrmacht), 5 → british_sigint_history (admin) |
| Top distinctive PM tokens (full corpus, n=417) | ambassador, benghazi, headlines, BONIFACE, derna, tripoli, kesselring, leningrad — **operational subjects, not correspondence vocabulary** |
| Title prefixes in PM records   | "North Africa" (80), "Naval Headlines" (35), "BONIFACE reports" (26), "Mediterranean" (14), "Russian Front" (14) — content-organized |
| Comparison: comparable-size archives' self-basin share | diplomatic 82%, comintern 61%, german 73% (seed 43); PM 0% in 3 of 4 seeds, 38% in 1 |

Other comparably-sized archives form pure-ish basins; PM never does. The
PM records' nearest-module assignments cluster by *operational topic*: a
PM record about Kharkov lands near comintern (the Soviet-message basin),
a PM record about Tirpitz lands near diplomatic (Naval Headlines), a PM
record about Mediterranean convoys lands near german (Wehrmacht ops).
Admin records about the PM channel itself ("Letter to C requesting daily
service") land near british_sigint_history (the self-referential basin).

**Mechanism:** HW 1 is the only HW series in this set that's organized by
*destination* (PM's desk) rather than by *content type*. Each HW 1
record's text is dominated by the operational subject of the message it
carried, not by anything PM-specific (the prose check found 0% explicit
PM-correspondence vocabulary). The TF-IDF embedder picks up content
vocabulary, so PM records get routed to whichever content basin matches
their topic.

This is the kind of finding the engine is for: a structural property of
the corpus that the archivist's classification scheme implicitly encodes
but doesn't explicitly call out. A domain historian could investigate
and probably confirm — TNA's HW classification is mixed, with HW 1 being
the destination-organized outlier.

### RunPod GPU run (numeric, NSL-KDD, A100/4090)

**Honest current state (2026-05-03):** both RunPod paths are blocked.

| Path                                          | Status                | Blocker              |
| --------------------------------------------- | --------------------- | -------------------- |
| `runpod_submit.py` → serverless handler       | Silent simulation     | Container fix committed (`be5df10`) but RunPod endpoint is still serving the old image; needs RunPod web-console action: set build context = repo root, trigger rebuild |
| `runpod_pod_real_modules.py` → on-demand pod  | Provisioning works, log-fetch dead | RunPod's GraphQL API removed the `podLogs` field; orchestrator's polling loop returns HTTP 400 forever. Needs rewrite to either use SSH into the pod (port 22 is exposed) or migrate to whatever replaced `podLogs`. |

**The serverless re-submission after the Dockerfile push** (commit `be5df10`)
returned `training_time_seconds = 0.0009`, `executionTime = 1.7s`, three
`tcp/udp/icmp Cluster` modules — i.e. simulation-fallback signature on
every count from §6.1. Either the auto-build webhook didn't fire on push,
or the build context is still set to `runpod/` (so the new `COPY backend`
and `COPY tcd-jepa` lines fail at build time and the endpoint silently
keeps the previous image). UI verification required.

**Reference April 2026 artifact** (`data/validation/runpod_real_gpu_modules.json`):
207.6s wall, 18 AttractorModules, 5 neptune-dominant + 13 normal-dominant.
Generated by an earlier version of `runpod_pod_real_modules.py` before
the `podLogs` field was removed. The artifact is real; the path that
produced it is currently broken.

The serverless handler's failure mode is documented in §6.

---

## 6. Anti-patterns (failure modes to detect)

### 6.1 The simulation-fallback signature

The serverless handler at `runpod/handler.py` catches `ImportError` and
swallows the exception, returning `_simulate_training()` output that is
shaped identically to a real run. Detect via:

| Signal                          | Real run               | Simulation              |
| ------------------------------- | ---------------------- | ----------------------- |
| `executionTime` (RunPod field)  | minutes                | < 5 sec                 |
| `training_time_seconds`         | tens to hundreds       | < 0.01 sec              |
| `btut_metrics` field            | populated dict         | absent                  |
| Module names                    | `mod_attractor_X`      | `tcp Cluster N`, etc.   |
| `purity_score`                  | bounded [0, 1]         | up to 1.15 (sim adds random.uniform(0,0.15)) |
| Loss curve shape                | dataset-specific       | exact `2.5·exp(-3.5t)+0.15` exponential decay |

**If three or more of these flags fire, the run was simulation. Discard it.**

### 6.2 Label recovery vs structure discovery

A module with dominant share ≥ 95% has *recovered an existing label*. That's
a sanity check on the embedder, not a finding. A pipeline that produces only
high-share modules has degenerated into label classification.

A pipeline that produces only low-share, low-persistence modules is finding
noise. Both extremes are anti-patterns.

The healthy regime is **mixed**: some near-pure modules (showing the
embedder works), some highly-mixed-but-high-persistence modules (the
discovery candidates).

### 6.3 BTUT collapse

If BTUT survivors are all from one label, BTUT has collapsed (its budget
ran out before the rare class was preserved). Detect by checking
`survivor_attack_share` (or equivalent) ≈ corpus-attack-share ± 10%. If
not, increase `budget_dollars` or decrease `target_survivors`.

### 6.4 Embedder leak

If the embedder includes the gold label in its features (e.g. you fit
TF-IDF on a corpus that includes the label as a token), the alignment
purity inflates artificially. Detect by running a randomized-label control:
shuffle the labels, re-run alignment. If purity stays high, the embedder
is leaking.

### 6.5 Container build context drift

The RunPod Dockerfile (as of this writing) requires build context = repo
root. Symptoms of wrong context: `COPY backend` and `COPY tcd-jepa` both
fail at build time, OR the cloned `direncode/tcd-jepa` lacks `train_graph.py`
because it's a public mirror that lags. Always verify the image's `/app/`
contents match expectations after a deploy:

```
docker exec <container> ls /app/{backend,tcd-jepa,handler.py}
```

---

## 7. Determinism and reproducibility

Every stage takes a `seed` parameter. The default is 42 across the codebase.
For a corpus to be considered "wired in":

```
sha256(sorted(Z[:, 0]))                stable across runs
sha256(sorted(survivor_paper_ids))     stable across runs
sha256(sorted(module_centroid_norms))  stable across runs at same seed
```

If any of these change between runs at the same seed, the pipeline has a
non-determinism leak. Common causes: dict iteration order before Python
3.7, set iteration in BTUT scoring, parallel workers without seeded RNG.

---

## 8. The minimum viable wiring for a new corpus

```python
# 1. Implement a harvester that produces NDJSON with:
#       paper_id, archive (coarse), primary_category (fine), text, year
#    See scripts/bombe_natarchives_harvest.py for the canonical example.

# 2. Add an entry to scripts/<corpus>_run_btut_then_tcd.py that:
#       loads the NDJSON
#       calls embed_corpus() with TF-IDF (text) or one-hot (numeric)
#       calls run_btut_pipeline() if N > 1000
#       calls RecursiveLoop.step() in a 16-iter loop
#       computes per-module alignment vs primary_category
#       writes the artifact to data/validation/<corpus>_btut_then_tcd.json

# 3. Run once on CPU, inspect the per-module alignment table.

# 4. If the alignment table has a healthy mix (some pure, some bleeding)
#    AND H₀ persistence is non-degenerate (>3), the corpus is wired in.

# 5. For scale runs (>5k records), submit to RunPod via
#    scripts/defense_megatest/runpod_pod_real_modules.py adapted to read
#    the new corpus's NDJSON instead of NSL-KDD.
```

---

## 9. Open questions (intentionally unresolved)

These are corpus-agnostic gaps the pipeline still has. Calling them out
here so they don't accidentally get hidden as bugs.

1. **Energy-function selection at scale.** Mode-seeking works on labelled
   data; at scales where we have no gold labels, we currently default to
   distance-to-mean. Is there a corpus-agnostic objective that finds
   *interesting* modes rather than dense ones?

2. **Bleed-share interpretation.** A module with 70% bleed is either real
   cross-label structure or noise. We disambiguate via persistence, but
   the threshold (H₀ > 8) was eyeballed from NSL-KDD + TNA. What's the
   principled cutoff per corpus?

3. **Module-count tuning.** Both NSL-KDD and TNA produced 14–15 modules at
   `crystallize_every=2`, `max_modules=24`. Is that a coincidence or a
   structural property of the recursive loop's saturation behaviour?

4. **Cross-corpus comparability.** Can we compare a TNA module's
   `novelty_score` to an NSL-KDD module's? The corpora have radically
   different label schemes and bleed regimes. Probably not directly —
   normalize within corpus.

---

## 10. Pointers

| File                                                 | Role                                |
| ---------------------------------------------------- | ----------------------------------- |
| `scripts/defense_megatest/run_btut_then_tcd.py`      | NSL-KDD reference run               |
| `scripts/defense_megatest/run_tna_btut_then_tcd.py`  | TNA reference run                   |
| `scripts/defense_megatest/runpod_pod_real_modules.py`| RunPod GPU bypass (works)           |
| `scripts/defense_megatest/runpod_submit.py`          | RunPod serverless (broken until container fix lands) |
| `runpod/Dockerfile`                                  | GPU container; build context = repo root |
| `runpod/handler.py`                                  | Serverless handler (silent-fallback risk; §6.1) |
| `backend/app/services/btut/`                         | BTUT engine, numpy-only, CPU-clean  |
| `tcd-jepa/tcd_jepa/core/recursive_loop.py`           | TCD recursive loop                  |
| `data/validation/btut_then_tcd_nslkdd.json`          | Reference NSL-KDD artifact          |
| `data/validation/tna_btut_then_tcd.json`             | Reference TNA artifact              |
| `data/validation/runpod_real_gpu_modules.json`       | Reference RunPod-pod artifact       |

---

*Last validated: 2026-05-03 against NSL-KDD (15 modules, 100% real) and TNA
(14 modules, 100% real, 17-archive substrate) on CPU. RunPod paths blocked
as of this writing (see §5 RunPod GPU run + §6.5).*
