# Provisional Patent Application

**Title:** Systems and Methods for Self-Organizing Predictor Module Discovery in Joint Embedding Predictive Architectures via Persistent-Homology Crystallization of Latent-Space Exploration Trajectories

**Filing type:** Provisional Application for Patent (35 U.S.C. § 111(b))

**Inventor(s):** [to be supplied by applicant]

**Assignee:** [to be supplied by applicant]

**Priority date:** [date of this provisional filing]

---

## I. Cross-References to Related Applications

This application is related in subject matter to commonly-owned
provisional application titled "Systems and Methods for Deterministic
Structural Fingerprinting of Arbitrary Data Records with Integrated
Falsifiability Testing and Modality-Agnostic Outlier Detection"
(provisional_01_btut_primitive). The two inventions may be practiced
independently or in composition; their composition is the subject of
a separately-filed provisional.

## II. Field of the Invention

The present invention relates to machine learning systems, and more
particularly to systems and methods for joint-embedding predictive
architectures (JEPA), and most particularly to apparatus, methods,
and computer-program products that automatically discover, instantiate,
and manage internal predictor modules of a JEPA-class network as a
function of the network's own latent-space exploration dynamics.

## III. Background

### A. Joint embedding predictive architectures

Joint Embedding Predictive Architectures, as introduced in the
machine-learning literature in approximately 2022, learn
representations by predicting target embeddings from context
embeddings in a shared latent space. The predictor function in a
JEPA is conventionally a fixed neural-network architecture — for
example a small multi-layer perceptron or transformer — that is
trained jointly with the encoder networks via energy minimization
of the form

```
E(z_context, z_target) = || p_θ(z_context) − sg(z_target) ||²
```

where `sg(·)` denotes the stop-gradient operation and `p_θ` is a
parameterized predictor.

The predictor architecture is *designed by the practitioner* and is
*static* across training. Its expressive capacity is bounded by the
hand-chosen layer count, hidden width, and connectivity. Capabilities
that the static predictor cannot represent — for example, periodic
dependencies in the latent flow, multi-attractor dynamics, or
boundary-detection between latent sub-manifolds — are inaccessible to
the model regardless of training compute.

### B. Persistent homology and topological data analysis

Persistent homology, as developed in the topological data analysis
literature beginning approximately in the 2000s, computes a
multi-scale topological summary of a finite point cloud in a metric
space. The Vietoris–Rips filtration constructs a sequence of nested
simplicial complexes parameterized by a distance threshold `ε`, and
the persistent-homology computation tracks the birth and death of
topological features (connected components, loops, voids) across
that filtration.

The output of a persistent-homology computation is conventionally a
*persistence diagram* or *barcode*, which is interpreted offline by
a human or used as input to a downstream classifier. To date,
persistent-homology computations have not been used to automatically
*spawn* learnable neural-network sub-modules whose architectures are
parameterized by the topological features themselves.

### C. Langevin dynamics in latent spaces

Langevin dynamics — discrete-time stochastic differential equations
of the form

```
z_{t+1} = z_t − η · ∇ E(z_t) + √(2η/β) · ξ_t,    ξ_t ~ N(0, I)
```

— are widely used in physics, statistical sampling, and deep
generative modeling to draw samples from energy-defined probability
distributions. In the context of JEPA, no prior approach has applied
Langevin dynamics specifically as an *exploration probe* of the
predictor's energy landscape with the explicit purpose of producing
trajectories from which new predictor modules can be spawned.

### D. The problem addressed

There exists a need for a JEPA-class machine-learning system in
which predictor modules are *discovered* rather than *designed*; in
which the discovery process is itself driven by a measurable property
of the latent-space dynamics; and in which the discovered modules
form a recursive feedback loop — each new module enriching the
representation, enabling further discovery — without intervention by
a human architect.

## IV. Summary of the Invention

The present invention provides systems, methods, and computer-program
products implementing a self-organizing extension to JEPA-class
networks. In broad outline, the invention comprises three
interoperating sub-systems:

1. **Stream Encoder (System 1).** An instrumented JEPA encoder
   stack that, in addition to producing context and target
   embeddings as in a conventional JEPA, monitors per-layer
   information flow rates, representation diversity, and exposes
   the energy surface E(z) for downstream use. The Stream Encoder
   functions as a normal JEPA encoder when its instrumentation is
   not consumed; the instrumentation is non-intrusive.

2. **Energy Explorer (System 2).** A subsystem that consumes the
   energy surface E(z) and (a) detects regions of high uncertainty
   ("blank spaces") via Hessian-eigenvalue analysis combined with
   perturbation-variance heuristics; (b) executes Langevin dynamics
   biased toward those regions through temperature modulation; and
   (c) emits exploration trajectories `{z_0, z_1, ..., z_T}` for
   downstream consumption.

3. **Module Crystallizer (System 3).** A subsystem that consumes
   exploration trajectories from System 2, applies persistent-homology
   computation to the resulting point clouds, and *crystallizes* —
   that is, instantiates as new learnable predictor sub-modules —
   the topological features observed to be stable across the
   filtration. Specifically, in a preferred embodiment:
     - Connected components (homology dimension H₀) crystallize as
       AttractorModules, each comprising a local predictor centered
       on the centroid of a persistent connected component of the
       trajectory cloud;
     - Loops (homology dimension H₁) crystallize as CycleModules,
       each comprising a periodic predictor with learnable
       frequency parameters initialized from the loop's
       characteristic length scale;
     - Voids (homology dimension H₂) crystallize as
       BoundaryModules, each comprising an interface predictor
       with learnable boundary-detection parameters initialized
       from the void's location and radius.

   Each crystallized module is registered in a module registry,
   participates in subsequent prediction at inference time, and is
   subject to a lifecycle management policy that tracks per-module
   contribution and prunes underperforming modules.

The three subsystems operate in a recursive feedback loop: modules
crystallized by System 3 are made available as additional predictor
heads in System 1, which enriches the encoder's representation,
which in turn yields a richer energy landscape for System 2 to
explore, which yields trajectories with novel topological features
for System 3 to crystallize. A convergence monitor `C(t)` —
defined in detail in the detailed description — measures the rate
of new module creation and signals stable termination of the
recursive loop.

The novelty of the invention resides in (a) the use of
persistent-homology features computed on Langevin-exploration
trajectories as a substrate for *automatic* predictor-module
spawning in a JEPA-class system; (b) the specific mapping from
homology dimensions H₀, H₁, H₂ to AttractorModule, CycleModule,
BoundaryModule respectively, each with parameters initialized from
the corresponding topological feature; and (c) the recursive
architecture binding the three subsystems into a self-organizing
discovery loop with measurable convergence.

## V. Brief Description of the Drawings

**Figure 1.** System diagram of the recursive loop, with System 1
(Stream Encoder), System 2 (Energy Explorer), and System 3 (Module
Crystallizer) connected in cyclic dataflow.

**Figure 2.** Stream Encoder internals showing a Vision-Transformer
backbone with per-layer instrumentation hooks recording diversity
and information-flow metrics.

**Figure 3.** Energy Explorer internals showing the blank-space
detector (Hessian eigenvalue + perturbation variance) and the
temperature-biased Langevin sampler.

**Figure 4.** Module Crystallizer internals showing the
Vietoris–Rips persistence pipeline, persistence-diagram analysis,
and the H₀/H₁/H₂ → AttractorModule/CycleModule/BoundaryModule
spawning paths.

**Figure 5.** A timeline showing convergence of the recursive
loop, with `C(t)` plotted as a function of training epoch.

**Figure 6.** A schematic comparison: vanilla JEPA prediction
trajectory versus the present invention's prediction trajectory
with three crystallized modules in service.

## VI. Detailed Description

### A. Stream Encoder (System 1; Figure 2)

The Stream Encoder comprises a Vision-Transformer (ViT) or
analogous transformer-style encoder with the following
modifications relative to a conventional JEPA encoder:

1. **EMA target network.** A target encoder is maintained as an
   exponential moving average of the online encoder's parameters,
   updated according to `θ_target ← τ · θ_target + (1−τ) · θ_online`
   with `τ ∈ [0.95, 0.999]`.

2. **Per-layer instrumentation.** Each transformer block exposes
   an instrumentation hook that records, for each forward pass:
   (i) the rank of the activation matrix as an estimate of
   representation diversity; (ii) the mutual information between
   the layer input and output, estimated by the InfoNCE bound;
   and (iii) the per-token activation variance.

3. **Energy surface exposure.** For each input pair `(x, y)`,
   the Stream Encoder computes and exposes the energy

   ```
   E(z) = || p_θ(s_θ(x)) − sg(s_ξ(y)) ||²
   ```

   as a scalar tensor that downstream subsystems may consume,
   including for gradient computation.

The instrumentation is *non-intrusive*: when no downstream
subsystem is connected, the Stream Encoder behaves bit-identically
to a vanilla JEPA encoder.

### B. Energy Explorer (System 2; Figure 3)

The Energy Explorer comprises:

1. **Blank-space detection.** For a candidate latent point `z`,
   the explorer estimates the local Hessian `H(z) = ∂²E/∂z²` via
   finite-difference perturbation. The smallest eigenvalue of
   `H(z)` quantifies the curvature of the energy basin at `z`;
   small or negative eigenvalues indicate a flat or saddle-like
   region, characteristic of unexplored or unstable territory.
   In addition, the explorer perturbs `z` by Gaussian noise of
   variance `σ²` and measures the resulting variance of `E(z+δ)`,
   producing a local sensitivity estimate. Points flagged as
   simultaneously low-curvature and high-sensitivity are added
   to a blank-space candidate queue.

2. **Temperature-biased Langevin dynamics.** Starting from a
   point `z_0` (drawn either from the encoder's natural sample
   distribution or from the blank-space queue), the explorer
   executes the discrete-time update

   ```
   z_{t+1} = z_t − η · ∇ E(z_t) + √(2η/β(z_t)) · ξ_t
   ```

   where `β(z)` is a position-dependent inverse temperature.
   Specifically, `β` is *reduced* in regions flagged as blank,
   admitting greater stochastic exploration there; and increased
   elsewhere, anchoring the trajectory near established energy
   minima. The trajectory `{z_0, z_1, ..., z_T}` for `T` of order
   100 to 10,000 is recorded for consumption by System 3.

3. **Fisher metric correction (optional embodiment).** In an
   alternative embodiment, the gradient term is preconditioned
   by the inverse Fisher information matrix `F(z)⁻¹` to respect
   the Riemannian geometry of the latent space, yielding

   ```
   z_{t+1} = z_t − η · F(z_t)⁻¹ · ∇ E(z_t) + √(2η/β(z_t)) · F(z_t)^(−1/2) · ξ_t.
   ```

### C. Module Crystallizer (System 3; Figure 4)

The Module Crystallizer accepts a trajectory `{z_t}` from System 2
and emits zero or more newly-instantiated learnable predictor
modules. Its operation comprises:

1. **Vietoris–Rips filtration.** A sequence of simplicial complexes
   is constructed on the trajectory point cloud across a range of
   distance thresholds `ε ∈ [ε_min, ε_max]`. Persistent-homology
   computation in dimensions 0, 1, and 2 yields a persistence
   diagram for each dimension.

2. **Persistence thresholding.** Topological features whose
   persistence (death-minus-birth) exceeds a configurable threshold
   `p_min` are admitted; transient features are discarded as noise.
   The threshold may be set absolutely or as a fraction of the
   maximum persistence in the diagram.

3. **Module spawning.** For each admitted feature:

   - **H₀ feature → AttractorModule.** The connected component
     is summarized by its centroid `c` and characteristic radius
     `r`. An AttractorModule is instantiated whose forward
     computation is

     ```
     m_attr(z) = MLP_θ(z − c) + W · exp(−||z−c||² / (2r²))
     ```

     where `MLP_θ` is a small parameterized network and `W`
     is a learnable basis projection. The parameters `c` and
     `r` are initialized from the topological feature and may
     be subsequently fine-tuned.

   - **H₁ feature → CycleModule.** The persistent loop is
     parameterized by its centroid, characteristic radius, and
     two basis vectors spanning the loop's plane. A CycleModule
     is instantiated whose forward computation includes
     learnable frequency `ω` and phase `φ` parameters,
     initialized so that the module's output is periodic with
     period equal to the loop's geodesic length.

   - **H₂ feature → BoundaryModule.** The persistent void is
     parameterized by its center, radius, and (optionally) the
     orientation of its boundary. A BoundaryModule is
     instantiated whose forward computation includes a
     boundary-detection function

     ```
     m_bnd(z) = σ(α · (||z − c|| − r))
     ```

     gated to learnable transformations, where `σ` is a logistic
     and `α` controls boundary sharpness.

4. **Module registration and lifecycle.** Each instantiated
   module is added to a registry indexed by an opaque module
   identifier. At inference, the predictor head of System 1 is
   computed as a learned mixture

   ```
   p(z) = Σ_i α_i(z) · m_i(z) + p_base(z)
   ```

   where `α_i(z)` is a softmax-gated attention weight learned per
   module and `p_base` is the base JEPA predictor. Modules whose
   contribution `α_i` falls below a pruning threshold for a
   sustained number of training steps are removed from the
   registry.

### D. Recursive feedback loop and convergence monitor

The three subsystems form a closed loop:

1. System 1 produces an energy surface E(z).
2. System 2 explores E(z), producing trajectories.
3. System 3 crystallizes new predictor modules from trajectories.
4. New modules are registered in System 1's predictor head,
   yielding a richer energy surface.

The loop is iterated until a convergence monitor

```
C(t) = (number of new modules crystallized in window [t−Δ, t]) / (registry size at t)
```

falls below a threshold for a sustained interval. In a typical
embodiment Δ is one training epoch and the threshold is 0.05.

### E. Domain-agnostic embodiments

The invention is not restricted to image inputs or to ViT
encoders. Embodiments include:

- **Tabular embodiment.** The Stream Encoder is a transformer
  over tabular feature embeddings; the latent space is the
  resulting context vector; modules crystallized in this space
  predict masked or held-out columns.

- **Graph embodiment.** The Stream Encoder is a graph neural
  network; the latent space is per-node embeddings; modules
  crystallized in this space predict masked node attributes
  or edge relationships.

- **Manifold embodiment.** The Stream Encoder operates on
  points sampled from a Riemannian manifold; Fisher-metric
  preconditioning is applied; modules crystallize on the
  manifold's geodesic structure.

### F. Composition with structural-fingerprint substrate

In a particular preferred embodiment, the present invention is
composed downstream of a deterministic structural-fingerprint
data primitive, the latter being the subject of the
commonly-owned provisional application referenced above. In this
composition, fingerprinted records serve as the input pairs to
the Stream Encoder, and the fingerprint's reproducibility
guarantees flow through the present invention's training process,
yielding deterministic-on-replay module crystallization given a
fixed seed and identical input universe. The compositional
embodiment is the subject of a separately-filed provisional.

## VII. Claims

The following claims are illustrative and non-limiting. A
non-provisional application claiming priority to this provisional
will set forth the full claim set.

1. A computer-implemented system for predictive representation
   learning, comprising:
   (a) an encoder subsystem comprising a transformer-style neural
       network configured to produce context and target embeddings
       in a shared latent space and to expose an energy surface
       defined over said latent space;
   (b) an exploration subsystem coupled to the encoder subsystem
       and configured to (i) detect regions of low local curvature
       and high local sensitivity in said energy surface, and
       (ii) generate sample trajectories in said latent space by
       Langevin dynamics whose temperature is biased toward the
       detected regions;
   (c) a crystallization subsystem coupled to the exploration
       subsystem and configured to compute persistent-homology
       features of said trajectories and to instantiate, in
       response to detection of persistent topological features,
       new learnable predictor sub-modules whose architectural
       parameters are initialized from said topological features.

2. The system of claim 1 wherein the crystallization subsystem
   instantiates an attractor-type sub-module in response to a
   persistent connected component of homology dimension zero, the
   attractor-type sub-module being parameterized by a centroid
   and a characteristic radius derived from said connected
   component.

3. The system of claim 1 wherein the crystallization subsystem
   instantiates a cycle-type sub-module in response to a
   persistent loop of homology dimension one, the cycle-type
   sub-module being parameterized by a learnable frequency
   initialized from a geodesic length of said loop.

4. The system of claim 1 wherein the crystallization subsystem
   instantiates a boundary-type sub-module in response to a
   persistent void of homology dimension two, the boundary-type
   sub-module being parameterized by a center and a radius
   derived from said void and a learnable boundary-sharpness
   parameter.

5. The system of any preceding claim wherein the encoder, the
   exploration, and the crystallization subsystems are operated
   in a recursive feedback loop in which sub-modules instantiated
   by the crystallization subsystem are made available as
   additional predictor heads of the encoder subsystem.

6. The system of claim 5 further comprising a convergence monitor
   computing a ratio of newly-instantiated modules to total
   registered modules over a configurable time window and
   signaling termination when said ratio falls below a
   configurable threshold for a sustained interval.

7. The system of any preceding claim wherein the exploration
   subsystem preconditions the gradient term of said Langevin
   dynamics by an inverse Fisher information matrix computed
   over the latent space.

8. The system of any preceding claim wherein each instantiated
   sub-module is registered in a module registry, participates
   in inference via a learned softmax-gated attention mixture,
   and is subject to a pruning policy that removes sub-modules
   whose attention weight remains below a configurable threshold
   for a sustained number of training steps.

9. A computer-implemented method comprising the operations
   recited in any of claims 1–8.

10. A non-transitory computer-readable medium storing
    instructions that, when executed by one or more processors,
    cause said processors to perform the operations recited in
    any of claims 1–8.

11. The system of any preceding claim wherein the encoder operates
    on inputs selected from the group consisting of: image
    patches, tabular feature vectors, graph-node embeddings, and
    points sampled from a Riemannian manifold.

12. The system of any preceding claim wherein the encoder consumes
    structural-fingerprint outputs of an upstream deterministic
    fingerprinting subsystem, whereby reproducibility properties
    of said fingerprinting subsystem propagate to deterministic-
    on-replay crystallization given fixed random seeds.

## VIII. Abstract

A self-organizing extension to joint-embedding predictive
architectures is disclosed in which predictor sub-modules are
discovered automatically from the dynamics of the network's own
latent-space exploration, rather than being designed by a
practitioner. An instrumented encoder exposes an energy surface;
an exploration subsystem executes temperature-biased Langevin
dynamics on that surface, preferentially probing regions of low
local curvature and high sensitivity; and a crystallization
subsystem applies persistent-homology computation to the resulting
trajectories, instantiating attractor-type, cycle-type, or
boundary-type learnable sub-modules from persistent topological
features of homology dimensions zero, one, and two respectively.
The three subsystems operate in a recursive feedback loop with a
measurable convergence criterion, yielding emergent predictor
architectures that static designed-once-and-frozen JEPA predictors
cannot represent.

---

*This document is a provisional application drafted by the
applicant for filing under 35 U.S.C. § 111(b). It has not been
reviewed by registered patent counsel. Applicant is advised to
have counsel review the application before filing, and to convert
to a non-provisional application under 35 U.S.C. § 111(a) within
twelve (12) months of the filing date in order to preserve the
priority claim.*
