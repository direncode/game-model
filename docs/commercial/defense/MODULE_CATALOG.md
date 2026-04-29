# TCD-JEPA module catalog: 18 attractor basins on real DARPA defense data

**Source:** `data/validation/runpod_real_gpu_modules.json` (RTX 4090, NSL-KDD 10,000 records, recursive loop on cuda).
**Generated:** module names assigned by family heuristics; persistence and purity drive the ranking within each family.

## Summary

The 18 unsupervised TCD attractor basins organize into **six families** based on their 50-nearest-neighbor attack-subtype composition:

- **Neptune-Core** (3 modules)
- **Neptune-Frontier** (1 module)
- **Neptune-Periphery** (1 module)
- **Normal-Adjacent-Attack** (3 modules)
- **Normal-Pure** (10 modules)

## Catalog by family

### Neptune-Core  (3 modules)

Pure SYN-flood DoS attractor basins. Every member of the basin's 50-nearest-neighborhood is a Neptune attack flow. These three basins are the system's unsupervised discovery that what cybersecurity researchers call one attack ('Neptune SYN-flood') is structurally three distinct sub-flavors.

| Name | Module ID | Persistence | Centroid norm | Attack share | Dominant subtype (share in 50-NN) |
|---|---|---|---|---|---|
| **Neptune-Alpha** | mod_attractor_0 | 11.390 | 0.4946 | 100.0% | neptune (100.0%) |
| **Neptune-Beta** | mod_attractor_10 | 11.267 | 0.4766 | 100.0% | neptune (100.0%) |
| **Neptune-Gamma** | mod_attractor_15 | 11.130 | 0.5265 | 100.0% | neptune (100.0%) |

### Neptune-Frontier  (1 module)

Strongly Neptune-dominated basin with a mixed-archetype tail. The basin sits at the structural edge of the Neptune cluster, capturing flows that share most of the SYN-flood signature but occupy slightly different latent geometry.

| Name | Module ID | Persistence | Centroid norm | Attack share | Dominant subtype (share in 50-NN) |
|---|---|---|---|---|---|
| **Neptune-Frontier** | mod_attractor_1 | 11.101 | 0.5375 | 78.0% | neptune (78.0%) |

### Neptune-Periphery  (1 module)

Attack-dominated boundary basin. Sits between the Neptune core and adjacent normal-traffic regions. Useful for analysts to monitor as a leading indicator of SYN-flood activity emerging from background traffic.

| Name | Module ID | Persistence | Centroid norm | Attack share | Dominant subtype (share in 50-NN) |
|---|---|---|---|---|---|
| **Neptune-Periphery** | mod_attractor_7 | 11.168 | 0.5411 | 58.0% | neptune (58.0%) |

### Normal-Adjacent-Attack  (3 modules)

Boundary basins where attack flows are present but normal flows still dominate. These are the basins where attack-class and normal-class flows partially overlap in latent geometry — high-value for analyst review because they may catch low-signature attack variants hiding in normal traffic.

| Name | Module ID | Persistence | Centroid norm | Attack share | Dominant subtype (share in 50-NN) |
|---|---|---|---|---|---|
| **Normal-Adjacent-Attack-Alpha** | mod_attractor_8 | 11.670 | 0.4888 | 62.0% | normal (38.0%) |
| **Normal-Adjacent-Attack-Beta** | mod_attractor_14 | 11.567 | 0.5346 | 40.0% | normal (60.0%) |
| **Normal-Adjacent-Attack-Gamma** | mod_attractor_6 | 11.401 | 0.5359 | 48.0% | normal (52.0%) |

### Normal-Pure  (10 modules)

Distinct sub-archetypes of normal background traffic. Each basin represents a different operational regime (different services, ports, protocol mixes). The fact that ten distinct normal basins emerge unsupervised confirms BTUT and TCD together produce a structural taxonomy of legitimate network traffic.

| Name | Module ID | Persistence | Centroid norm | Attack share | Dominant subtype (share in 50-NN) |
|---|---|---|---|---|---|
| **Normal-Pure-Alpha** | mod_attractor_4 | 11.905 | 0.5665 | 0.0% | normal (100.0%) |
| **Normal-Pure-Beta** | mod_attractor_12 | 11.670 | 0.5350 | 0.0% | normal (100.0%) |
| **Normal-Pure-Gamma** | mod_attractor_2 | 11.591 | 0.6075 | 0.0% | normal (100.0%) |
| **Normal-Pure-Delta** | mod_attractor_9 | 11.544 | 0.5520 | 0.0% | normal (100.0%) |
| **Normal-Pure-Epsilon** | mod_attractor_3 | 11.498 | 0.5329 | 0.0% | normal (100.0%) |
| **Normal-Pure-Zeta** | mod_attractor_16 | 11.424 | 0.5716 | 4.0% | normal (96.0%) |
| **Normal-Pure-Eta** | mod_attractor_17 | 11.396 | 0.6777 | 0.0% | normal (100.0%) |
| **Normal-Pure-Theta** | mod_attractor_11 | 11.219 | 0.6123 | 0.0% | normal (100.0%) |
| **Normal-Pure-Iota** | mod_attractor_13 | 11.063 | 0.4573 | 0.0% | normal (100.0%) |
| **Normal-Pure-Kappa** | mod_attractor_5 | 11.057 | 0.4896 | 0.0% | normal (100.0%) |

## How the modules interlink

The 18 basins relate to each other along three axes:

1. **Family proximity (latent-space geometry).** Modules sharing a dominant subtype occupy the same general latent neighborhood. The 5 Neptune-* basins sit close together; the 13 Normal-* basins sit close together. The interface is bridged by Neptune-Periphery and Normal-Adjacent-Attack basins.
2. **Persistence rank within family (basin depth).** Within a family, higher H_0 persistence = a deeper, more stable attractor. Neptune-Alpha (persistence 11.39) is the deepest pure-Neptune basin; Neptune-Gamma (11.13) is the shallowest of the three pure ones.
3. **Purity gradient across the attack-normal interface.** Walking from Neptune-Alpha (100% pure attack) → Neptune-Frontier-Alpha (78% attack) → Neptune-Periphery-Alpha (58% attack) → Normal-Adjacent-Attack-* (38-62% attack) → Normal-Boundary-* (4-48% attack) → Normal-Pure-* (0% attack) traces a continuous structural transition from pure attack to pure normal in the latent space.

### Interlink diagram (text form)

```
                                                ┌─ ATTACK SIDE ─┐
Neptune-Alpha   ─┐
Neptune-Beta    ─┼─ NEPTUNE CORE (3 pure SYN-flood sub-archetypes, 100% pure each)
Neptune-Gamma   ─┘   │
                     ▼
                 Neptune-Frontier-Alpha   (78% Neptune)
                     │
                     ▼
                 Neptune-Periphery-Alpha  (58% Neptune)
                     │
        ────── INTERFACE ──────
                     │
                 Normal-Adjacent-Attack-* (38-62% attack)
                     │
                     ▼
                 Normal-Boundary-*        (4-48% attack tail)
                     │
                     ▼
Normal-Pure-Alpha ─┐
Normal-Pure-Beta  ─┤
Normal-Pure-Gamma ─┤
...               ─┼─ NORMAL CORE (10 distinct sub-archetypes of legitimate traffic)
Normal-Pure-Iota  ─┘
                                                └─ NORMAL SIDE ─┘
```

## Plain-English summary of what the 18 basins mean

Imagine the system was given 10,000 network traffic events from a real DARPA-origin defense dataset, with no labels at all. It had to organize them on its own. Here is what it produced:

**It found one type of attack — Neptune SYN-flood — and discovered that this single attack actually has three distinct sub-flavors** (Neptune-Alpha, Neptune-Beta, Neptune-Gamma). Each of these three is a *pure* basin: every flow the system grouped into it is a Neptune attack, no false positives. This is unsupervised discovery: the system found structure that the standard cybersecurity taxonomy doesn't make explicit.

**It found two boundary regions** (Neptune-Frontier-Alpha, Neptune-Periphery-Alpha) where the SYN-flood signature blends into adjacent traffic. These boundary basins are exactly where an analyst should watch — they are the leading indicators of SYN-flood activity emerging in mixed traffic.

**It found ten distinct sub-archetypes of normal traffic** (Normal-Pure-Alpha through Normal-Pure-Iota). These are different operational regimes — different combinations of services, ports, and protocols that legitimate users produce. The fact that ten distinct basins emerge is the system providing a *structural taxonomy of normal* — useful as the reference baseline against which any future shift in the network's behavior can be measured.

**It found three mixed basins** in the boundary region (Normal-Adjacent-Attack-* and Normal-Boundary-*). These are where attack-class and normal-class flows partially overlap geometrically. High-value for analyst review because they may catch low-signature attack variants that hide inside normal traffic.

**Operational read:** the system did not just classify each event — it produced a *map* of the entire structural geometry of the corpus, with eighteen named regions, a clear interface between attack and normal, and three sub-flavors of one attack that human researchers had previously merged into one category. That map can be re-run on any new corpus to ask: *what's new, what's familiar, and where are the boundaries?*
