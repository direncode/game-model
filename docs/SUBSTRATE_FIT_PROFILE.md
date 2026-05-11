# Substrate Fit Profile — what shape of data the OCEAN engine thrives on

Companion document to [`docs/commercial/SUBSTRATE_PHASE_DIAGRAM.md`](commercial/SUBSTRATE_PHASE_DIAGRAM.md). The phase diagram is the empirical boundary map ("given a corpus, where does substrate hit perfect purity"). This document is the *prescriptive* counterpart — read **before** scaffolding a new substrate-application to determine whether the corpus is structurally suited to the substrate at all.

Existence triggered by the 2026-05-11 `/mine-sweep` pilot run: real bathymetry + real OSM wreck labels, full pipeline executed cleanly, substrate captured zero of five positive tiles. The pilot validated plumbing and confirmed the test was the wrong test. This document specifies the right tests.

## 1. What the substrate actually does

The TCD-JEPA recursive clustering loop in [`scripts/operators/cluster.py`](../scripts/operators/cluster.py) takes a feature matrix Z ∈ ℝ^{N×D} and emits a list of *emergent modules*, each a structurally coherent subset of records together with a centroid and homology metadata. The loop alternates System-2 Langevin exploration with System-3 persistent-homology crystallization; modules survive that resist perturbation across iterations.

The substrate is therefore:

- **A structural decomposition engine.** It partitions Z into modules where each module is "a kind of thing that recurs in the corpus."
- **Reproducible, deterministic, auditable.** Given fixed Z + seed + config, the modules are byte-identical across runs.
- **Multi-modal.** It does not assume a single Gaussian or single class structure. Multiple distinct modules can emerge, each capturing a different structural mode.

The substrate is **not**:

- **A binary classifier.** It does not learn a decision boundary between two classes from labeled training data.
- **A spike detector.** It does not specialize in flagging single-feature outliers — z-score, isolation forest, and one-class SVM are textbook approaches that beat it at that task.
- **A magnitude-based ranker.** Ranking records by `||z||` does not require any of the substrate's machinery and is what `embed.numeric_direct + energy=corpus_mean` reduces to without the recursive loop.

This distinction is the most common source of substrate-misapplication, including the 2026-05-11 `/mine-sweep` pilot.

## 2. Six conditions a corpus must satisfy for substrate-uplift over textbook baselines

A corpus is *substrate-fit* if it satisfies all six. Missing any one is a strong signal that simpler methods will match or beat substrate; missing two or more is a strong signal not to build the showcase.

| # | Condition | Evidence from validated showcases | Failure example |
|---|---|---|---|
| 1 | **N is large** (≥10K, preferably ≥100K, ideally 1M+) | `/atlas` 500K papers, `/pulse` 500K inventor-records, TNA up to 100K @ class_count≤16 perfect (per phase diagram Phase 1) | `/mine-sweep` pilot N=14K but 14 emergent modules out of 256 budget — substrate over-budgeted |
| 2 | **Feature space is rich (D≥8) and relational** — each record carries its own context, not summary statistics | `/atlas` 128-d tf-idf, `/pulse` 4 distinct signal types (name, co-inventors, assignee, geography), NSL-KDD ~40-d intrusion flow features | `/mine-sweep` pilot D=4 scalar summary statistics per tile — substrate has nothing structural to cluster on |
| 3 | **Ground truth has multiple emergent modes** (3+ classes, ideally 8-16) | `/atlas` 8 arXiv disciplines, `/pulse` thousands of inventor identities, NSL-KDD 5 attack categories | `/mine-sweep` pilot has 2 classes (positive/negative) and only 5 positives — substrate has no multi-class structure to discover |
| 4 | **Positives form a learnable structural manifold** — positives resemble *other positives* in feature space | DocSouth: testimonial-voice chunks (957 of them) recur structurally across four collections | `/mine-sweep` pilot: 5 OSM points have no inter-positive structure; each wreck is structurally distinct from the others |
| 5 | **Cluster recovery is a meaningful goal** (vs binary anomaly detection) | `/atlas` claim is "engine recovers arXiv's own categorization"; `/pulse` claim is "engine matches PatentsView clusters" | `/mine-sweep` pilot asked "did substrate sort the 5 positives to the top" — that is binary anomaly detection, not cluster recovery |
| 6 | **Textbook baselines fail informatively** — z-score, isolation forest, k-means each capture a fragment of the structure but miss the relational signal | TNA: textbook methods fragment `directorate_to_pm` finding; substrate captures it cleanly | `/mine-sweep` pilot synthetic: z-score 96×, isolation forest 100× — they don't fail, they crush the problem, leaving no substrate headroom |

A corpus that satisfies 1-6 is where the substrate's value is genuinely orthogonal to off-the-shelf machine learning. A corpus that fails 3 or more is a corpus where the substrate is the wrong instrument regardless of how well it is engineered.

## 3. Five failure modes — explicit anti-patterns

Each is a regime where the substrate cannot win even in principle, and shipping a showcase that exercises one of these is substrate-status-damaging because reviewers will produce the textbook baseline that beats it.

1. **Sparse-positive raster anomaly detection.** Tiny number of positives, dense regular grid of negatives, each record is a few summary statistics. Z-score and isolation forest dominate. The 2026-05-11 `/mine-sweep` pilot at GMRT-45m resolution is the canonical example.

2. **Univariate magnitude ranking.** One feature carries 90%+ of the signal. Sort by that feature; substrate has no headroom. Most classical signal-processing problems collapse to this once features are derived correctly.

3. **Binary classification with abundant labels.** If labeled training data is plentiful, supervised methods (gradient boosting, deep networks) will beat unsupervised structural clustering by definition. The substrate's value-add lives in the unsupervised regime.

4. **Bag-of-isolated-outliers.** Positives that don't share any structural property with other positives. Isolation forest is built for this; substrate is not.

5. **Continuous-magnitude problems disguised as classification.** A regression problem (predict depth-anomaly magnitude) presented as classification (is-anomaly true/false). Often a clue: the positives have continuous-valued "severity" or "score" labels rather than discrete class identity.

## 4. Pre-build diagnostic checklist

Before any new substrate-application is scaffolded, walk these ten questions and write down the answer for each. Three or more weak answers means redesign the corpus or pick a different approach.

| # | Question | Strong answer | Weak answer |
|---|---|---|---|
| 1 | What is N? | ≥100K | <10K |
| 2 | What is D? | ≥16 of meaningful structure, not summary stats | ≤6 scalar features |
| 3 | Are records structurally rich (text, multi-event sequences, multi-modal returns)? | Yes, each record carries its own context | No, each record is a derived summary |
| 4 | How many classes / emergent modes? | 8-16 | 2 |
| 5 | Do positives share structural similarity with other positives? | Yes, demonstrable | No, each positive is its own outlier |
| 6 | Is the goal cluster recovery or anomaly ranking? | Cluster recovery | Anomaly ranking |
| 7 | What does textbook z-score get on this problem? | <50% of substrate's expected enrichment | ≥80% of substrate's expected enrichment |
| 8 | What does isolation forest get? | Same — sub-50% | Crushes the problem |
| 9 | Is the ground truth a regulatory or third-party artifact, not researcher-curated? | Yes (AWOIS, PatentsView, arXiv categories) | No (handcrafted lab labels) |
| 10 | Would a domain expert call this an instance of "categorize records by their type" or "find the rare needle in the haystack"? | Categorize | Find rare needle |

If question 7 or 8 has a "weak" answer, substrate value-add is **structurally impossible** at the proposed scale. Either redesign features, redesign labels, or move on.

## 5. The mine-sweep specific recast — where the substrate likely IS valuable

The 2026-05-11 pilot tested whether the substrate sorts bathymetric tiles by structural unusualness to surface known obstructions. That test failed informatively. The substrate is wrong for that problem because:

- 4-d summary statistics ≪ rich features (fails condition 2)
- 5 OSM positives ≪ multi-class structure (fails condition 3)
- "Find the wreck" ≠ cluster recovery (fails condition 5)
- GMRT 45m resolution averages out wreck signatures (fails condition 4)

**The right mine-sweep regime — the one that exercises substrate's actual strengths:**

- **Records:** individual sonar returns from a bluewater AUV/USV mission, not bathymetric tiles. Each return is one ping × one aspect angle × one frequency band. A single mission produces 10^6 to 10^9 returns.
- **Features:** per-return signature in 100s of dimensions — frequency response curve, time-of-arrival distribution, multi-aspect coherence, calibration residual, Doppler signature, beamformed angle-of-arrival statistics, sub-bottom penetration features. Each return is a rich object.
- **N:** 10^6 minimum, 10^9 at survey scale. Substrate is built for this — phase diagram confirms scale-invariance up to 100K and extrapolates further.
- **Multi-class structure:** the seafloor is not "normal vs. anomaly." It is dozens of distinct reverberation regimes — sand, gravel, rock, weed, biogenic clutter, infrastructure (cable, pipeline, debris), and finally targets-of-interest. Substrate learns each regime as a structural module. The phase diagram says substrate handles up to 16 classes at perfect purity; mine sweeping likely needs that headroom.
- **Linking to spec corpora:** historical mine signature libraries (classified or academic) provide labeled reference returns. Substrate's `align.module` operator handles the link from emergent unsupervised modules to labeled reference modules. This is the move that turns the substrate from "I found 16 reverberation regimes" into "regime 7 matches the Type-72 acoustic signature library."
- **Output:** sort returns by *minimum distance to all learned modules*. Mines, debris, and other anomalies are returns that *do not fit any reverberation class* — they sit far from every learned manifold. This is the inverse of the failed pilot's "small module" heuristic.

This regime satisfies all six fit conditions. The empirical question — what enrichment over isolation-forest-on-raw-returns substrate produces — is genuinely open, and that is the version of the test worth running.

**Critical input requirement:** raw multi-aspect sonar return data, not derived bathymetry. The bathymetry product (BAG files, GMRT) is a post-processed grid that has *erased the structural signal* the substrate needs. The right corpus is the upstream sensor stream, typically held by survey operators and not in NCEI's public-bathymetry pipeline at all. This is the data-access bottleneck — not interactive viewers, not URL hunting, but access to upstream raw sensor archives.

## 6. Operational rule

If a proposed substrate-application is being justified primarily by an analogy to a successful showcase rather than by a positive answer to all six fit conditions, the application is at high risk of producing a `/mine-sweep`-pilot-shaped result. The remedy is not to ship the pilot anyway; it is to walk the diagnostic checklist before any code is written.

The failed-test cost on 2026-05-11 was approximately one developer-day. The substrate-status cost of having shipped that result as a showcase would have been an order of magnitude larger. The B-gate's `SHELVE_A` decision was substrate-status-protecting. This document exists to move that protection one stage earlier — before scaffolding begins.
