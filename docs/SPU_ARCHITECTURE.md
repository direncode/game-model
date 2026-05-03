# SPU — Substrate Processing Unit
*Architecture specification, version 0.1.0*

A purpose-built coprocessor for substrate-clustering workloads (BTUT
fingerprinting, content/structural hashing, TCD recursive loops, persistent
homology, sparse nearest-neighbor alignment). Not a GPU. Not an inference
chip. A coprocessor for the operator classes GPUs do badly.

## Naming

The class of operations this chip accelerates is *structural pattern
extraction on substrates* — fingerprinting, content-addressable retrieval,
sparse topology, irregular control flow. Existing AI accelerator names
all imply different workloads:

| Acronym | Meaning | What it does |
|---------|---------|--------------|
| GPU | Graphics Processing Unit | Dense linear algebra |
| TPU | Tensor Processing Unit | Dense matmul + accumulation |
| NPU | Neural Processing Unit | Inference math (matmul + nonlinearity) |
| DPU | Data Processing Unit | Network + storage offload |
| IPU | Intelligence Processing Unit | Graph-based ML (Graphcore) |
| LPU | Language Processing Unit | Low-latency inference (Groq, trademarked) |

**SPU — Substrate Processing Unit** — fits the pattern, is unclaimed,
and accurately describes the workload. Alternative working names: *Pattern
Processing Unit (PPU)*, *Structural Acceleration Engine (SAE)*, *Latent
Coprocessor (LCP)*. Going with SPU for this spec.

---

## 1. Design targets

| Metric | Target |
|---|---|
| Process node | TSMC N5 (5 nm) |
| Die size | 80 mm² chiplet |
| Power | 20 W TDP |
| Form factor | Half-height single-slot PCIe card OR UCIe chiplet |
| Host interface | PCIe Gen5 x16 (64 GB/s bidi) + CXL.cache 2.0 |
| Management | BMC subsystem, USB-C console, dedicated I²C |
| Cost model | $200K–$2M tape-out via TSMC MPW shuttle (chiplet only) |

The 80 mm² target is deliberate. Below 100 mm² you fit on a multi-project
shuttle and tape-out costs collapse. Above ~150 mm² you're in dedicated-mask
territory ($30M+).

---

## 2. Top-level block diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                              SPU die                                  │
│                                                                       │
│  ┌────────────────────┐  ┌──────────────────────────────────────────┐│
│  │ Management plane    │  │ Host interfaces                          ││
│  │  ┌─────────────┐   │  │  ┌──────────────┐  ┌──────────────────┐ ││
│  │  │ ARM Cortex- │   │  │  │ PCIe Gen5 x16│  │ CXL.cache 2.0    │ ││
│  │  │ M55 BMC     │   │  │  │ root complex │  │ (coherent w/ GPU)│ ││
│  │  └─────────────┘   │  │  └──────────────┘  └──────────────────┘ ││
│  │  USB-C / UART      │  │                                          ││
│  │  console + I²C     │  └──────────────────────────────────────────┘│
│  └────────────────────┘                                               │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                       Compute fabric                            │ │
│  │                                                                  │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐  │ │
│  │  │ HE — Hash Engines│  │ SBMU — Sparse-   │  │ CAM — 16K   │  │ │
│  │  │ 64× SHA-256/     │  │ Bit-Manipulation │  │ entries ×   │  │ │
│  │  │ MurmurHash3      │  │ 256× 256-bit ALU │  │ 64-bit, 16  │  │ │
│  │  │ @ 2 GHz          │  │ @ 2 GHz          │  │ ports       │  │ │
│  │  └──────────────────┘  └──────────────────┘  └─────────────┘  │ │
│  │                                                                  │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐  │ │
│  │  │ SGE — Scatter-   │  │ MMU — Modest     │  │ RLI —       │  │ │
│  │  │ Gather Engines   │  │ Matmul Unit      │  │ Recursive-  │  │ │
│  │  │ 32× channels     │  │ 4K MACs int8/    │  │ Loop        │  │ │
│  │  │ @ 256 GB/s peak  │  │ fp16 @ 2 GHz     │  │ Interconnect│  │ │
│  │  │                  │  │ = 8 TOPS / 4 TF  │  │ 2D mesh, 64 │  │ │
│  │  │                  │  │                  │  │ lanes       │  │ │
│  │  └──────────────────┘  └──────────────────┘  └─────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                       Memory hierarchy                          │ │
│  │                                                                  │ │
│  │  ┌────────────────────┐    ┌─────────────────────────────────┐ │ │
│  │  │ L0 SRAM            │    │ L1 SRAM                         │ │ │
│  │  │ 1 MB per cluster × │    │ 64 MB shared, ECC, 8-port banked│ │ │
│  │  │ 8 clusters = 8 MB  │    │ @ 4 TB/s aggregate              │ │ │
│  │  └────────────────────┘    └─────────────────────────────────┘ │ │
│  │                                                                  │ │
│  │  ┌─────────────────────────────────────────────────────────────┐│ │
│  │  │ HBM3 stack via CXL — 4 GB, 256 GB/s peak, off-chiplet      ││ │
│  │  └─────────────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Compute units in detail

### 3.1 Hash Engines (HE)

**Job:** SHA-256, MurmurHash3, FNV-1a. The throughput backbone for
BTUT fingerprinting, content_fp48, and any structural hashing operator.

| Spec | Value |
|---|---|
| Count | 64 cores |
| Clock | 2 GHz |
| Pipeline depth (SHA-256) | 32 stages |
| Throughput per core (steady state) | 1 hash / 32 cycles |
| Aggregate throughput | 64 × 2 GHz / 32 = **4 G hash/s** |
| Power per core | 80 mW |
| Total HE power | 5.1 W |

**At 5 hashes per BTUT record fingerprint, this is 800 M records/sec
throughput on the hash stage alone — ~16,000× a single CPU core.**

### 3.2 Sparse Bit-Manipulation Units (SBMU)

**Job:** Bloom filter set/test, popcount, XOR/OR/AND/NOT, gather-bit,
shift-permute. Drives the content fingerprint (`embed.content_fp48`)
and any operator that touches bit-level fingerprints.

| Spec | Value |
|---|---|
| Count | 256 ALUs |
| Width | 256 bits |
| Clock | 2 GHz |
| Aggregate width | 256 × 256 = 65,536 bits per cycle |
| Aggregate throughput | 65,536 × 2e9 / 8 = **16.4 TB/s** of bit-ops |
| Power | 4.5 W |

For a 48-bit Bloom set: ~1 ns per record (one cycle on one ALU).
For a Hamming distance over 48 bits: ~1 ns per pair (XOR + popcount).
Real workloads dominate by memory bandwidth, not compute, so this
unit is *generously sized* for headroom.

### 3.3 Content-Addressable Memory (CAM)

**Job:** Fingerprint → record-id lookup at lookup-table speed. Used in
alignment (find nearest fingerprint) and dispersion (where does this
record's fingerprint match a module's signature).

| Spec | Value |
|---|---|
| Capacity | 16 K entries × 64-bit values |
| Lookup latency | 1 ns (1 cycle @ 2 GHz, ternary CAM) |
| Ports | 16 simultaneous lookup ports |
| Aggregate throughput | 16 G lookups/sec |
| Power | 2 W (CAMs are power-hungry per bit, justified by use) |

A 64-bit fingerprint lookup that takes 80 ns on CPU and 200 ns on
GPU happens in 1 ns here.

### 3.4 Scatter-Gather Engines (SGE)

**Job:** Irregular memory access — fetch a list of records' fingerprints
from L1/HBM by indices that are not contiguous. The pattern that kills
GPU throughput.

| Spec | Value |
|---|---|
| Channels | 32 independent |
| Per-channel BW | 8 GB/s |
| Aggregate BW | 256 GB/s (matches HBM peak) |
| Outstanding requests per channel | 64 |
| Power | 3 W |

GPUs do scatter-gather but pay a heavy coalescing penalty. SGE doesn't
coalesce — it parallelizes irregular access by design.

### 3.5 Modest Matmul Unit (MMU)

**Job:** JL projection (records × dense random matrix to 128-D), small
softmax/normalize, occasional embedding lookup. ~1/100th of a GPU's
matmul, intentionally — this isn't where the chip's value lives.

| Spec | Value |
|---|---|
| MACs | 4 K |
| Precision | int8, fp16 |
| Clock | 2 GHz |
| Throughput | 8 TOPS (int8) / 4 TFLOPS (fp16) |
| Power | 2 W |

For comparison: a single H100 SM has ~512 fp32-equivalent MACs and an
H100 has 132 SMs. So this is ~1/16 of one H100 SM. Tiny on purpose —
the workload's matmul demand is small.

### 3.6 Recursive-Loop Interconnect (RLI)

**Job:** TCD recursive loop iteration — modules need to communicate
with each other and with the residual record set every iter.
Low-latency intra-die mesh optimized for short messages between
small core groups.

| Spec | Value |
|---|---|
| Topology | 8×8 2D mesh (64 nodes) |
| Bisection BW | 1 TB/s |
| Per-hop latency | 0.5 ns |
| Diameter | 14 hops |
| Worst-case latency | 7 ns end-to-end |

This is what makes recursive-loop iteration cheap. On CPU, each iter is
limited by L3 cache contention; on GPU, by global-memory round-trips
between CTAs. RLI gives each iteration a sub-10 ns coordination cost.

---

## 4. Memory hierarchy

| Level | Capacity | BW | Latency | Job |
|---|---|---|---|---|
| L0 SRAM (per cluster) | 1 MB × 8 = 8 MB | 4 TB/s aggregate | <1 ns | Working set per operator |
| L1 SRAM (shared) | 64 MB | 4 TB/s | 5 ns | Fingerprint corpus, module state |
| HBM3 via CXL | 4 GB | 256 GB/s | 80 ns | Full corpus + intermediate artifacts |
| Host DRAM via PCIe | 1 TB | 64 GB/s | 500 ns | Spillover; only for very large corpora |

The 64 MB L1 SRAM is sized to hold a full 1 M-record fingerprint corpus
(48-bit fingerprints = 6 bytes × 1 M = 6 MB; plus metadata = ~50 MB).
This is the killer architecture decision: *the entire substrate fits
on-die*. No HBM round-trips for the hot path.

---

## 5. Instruction set / operator dispatch

The SPU does not execute generic code. It executes **OCEAN-derived
operator graphs**. The host compiles an OCEAN program → DAG; the
runtime scheduler issues each op to the appropriate compute unit.

| OCEAN operator | Primary SPU unit |
|---|---|
| `embed.tfidf_jl` | HE (hashing) + MMU (projection) |
| `embed.content_fp48` | HE + SBMU |
| `cluster.tcd_recursive_loop` | SGE + RLI + L1 SRAM |
| `align.module` | CAM + SGE + SBMU |
| `align.dispersion` | CAM + SGE |
| `reduce.btut` | HE + SBMU + L1 SRAM |
| `cluster.kmeans` | MMU (only) |

The op-dispatch encoding is a 64-bit instruction word: 8-bit op-code
(256 ops max), 8-bit destination unit, 16-bit input-tensor descriptor
ID, 16-bit output descriptor, 16-bit immediate / config flags.

---

## 6. Power budget

| Block | Power | % |
|---|---|---|
| Hash Engines (HE) | 5.1 W | 25% |
| Sparse-Bit-Manipulation (SBMU) | 4.5 W | 22% |
| Scatter-Gather Engines (SGE) | 3.0 W | 15% |
| CAM | 2.0 W | 10% |
| Modest Matmul Unit (MMU) | 2.0 W | 10% |
| Recursive-Loop Interconnect (RLI) | 1.0 W | 5% |
| L1 SRAM (64 MB) | 1.5 W | 8% |
| Host interfaces (PCIe + CXL) | 0.6 W | 3% |
| Management plane (BMC + console) | 0.3 W | 2% |
| Total | **20 W** | 100% |

For comparison: NVIDIA H100 is 700 W, A100 is 400 W, RTX 4090 is 450 W.
This chip ships at 1/35 the power of an H100 because it has no dense
matmul fabric to feed.

---

## 7. Area budget (80 mm² die)

| Block | Area | % |
|---|---|---|
| Hash Engines (64 cores @ ~0.18 mm² each) | 11.5 mm² | 14% |
| Sparse-Bit-Manipulation (256 ALUs) | 9 mm² | 11% |
| L1 SRAM (64 MB) | 25 mm² | 31% |
| L0 SRAM (8 MB) | 4 mm² | 5% |
| CAM (16 K × 64-bit ternary) | 6 mm² | 8% |
| Scatter-Gather Engines | 4 mm² | 5% |
| Modest Matmul Unit | 4 mm² | 5% |
| Recursive-Loop Interconnect | 5 mm² | 6% |
| PCIe Gen5 + CXL.cache PHY | 6 mm² | 8% |
| Management plane | 1 mm² | 1% |
| Routing / overhead | 4.5 mm² | 6% |
| Total | **80 mm²** | 100% |

L1 SRAM is the single biggest area consumer at 31% — that's a deliberate
trade. SRAM is what makes substrate-on-die possible.

---

## 8. Host integration model

### 8.1 PCIe-card form factor (v0)

```
┌──── server chassis ────────────────────────────┐
│                                                │
│  ┌────────┐     ┌────────────┐   ┌──────────┐  │
│  │ CPU    │────│ PCIe switch│──│ NVIDIA H100│  │
│  │ (Xeon, │     │ Gen5       │   │ (matmul)  │  │
│  │  EPYC) │     │            │   └──────────┘  │
│  └────────┘     │            │                 │
│                 │            │   ┌──────────┐  │
│  ┌────────┐     │            │──│ SPU card │  │
│  │ DRAM   │     │            │   │ (ours)   │  │
│  └────────┘     └────────────┘   └──────────┘  │
└────────────────────────────────────────────────┘
```

Both cards are visible to the host. The OCEAN runtime dispatches dense
matmul to the GPU and structural ops to the SPU. CXL.cache lets the SPU
read a tensor from GPU HBM without copying.

### 8.2 Chiplet form factor (v1)

```
┌── package substrate ───────────────────────────────┐
│                                                     │
│  ┌──────────────┐   UCIe   ┌──────────┐   UCIe    │
│  │ GPU chiplet  │◄────────►│ I/O hub  │◄─────────►│ ──► more SPUs
│  │ (NVIDIA      │          │ + memory │            │
│  │  Blackwell)  │          │ chiplet  │            │
│  └──────────────┘          └──────────┘            │
│         ▲                       ▲                   │
│         │       UCIe            │                   │
│         ▼                       ▼                   │
│  ┌──────────────┐          ┌──────────┐            │
│  │ SPU chiplet  │          │ HBM3     │            │
│  │ (ours, 80mm²)│          │ stack    │            │
│  └──────────────┘          └──────────┘            │
└────────────────────────────────────────────────────┘
```

UCIe (Universal Chiplet Interconnect Express) is the open standard.
Intel, AMD, NVIDIA all support it. We ship a chiplet that integrators
drop into any UCIe-compatible package.

### 8.3 Console connection

Independent of host OS. USB-C carries:
- Serial console (115200 8-N-1)
- I²C control plane
- Out-of-band telemetry (10 ms granularity per operator)
- Firmware update path

Operations team plugs a laptop into the SPU's USB-C port and sees
operator-level timing without any kernel module loaded on the host.

---

## 9. Why not "inference chip"

Calling this an inference chip frames it as competing with GPUs for
matmul throughput. It isn't. It's a coprocessor for operator classes
GPUs are bad at. The right marketing position:

> **The SPU runs the 30% of your inference pipeline that isn't matmul —
> the structural fingerprinting, content-addressable retrieval, irregular
> nearest-neighbor, persistent homology — at 100× lower power than
> running it on the GPU's general-purpose cores.**

> **You don't replace your H100. You add an SPU.**

This is the "augment, don't replace" pitch. The relevant comparable
business stories are:
- SmartNICs (BlueField, NVIDIA ConnectX): ~$2K-$8K, augment server networking
- Storage DPUs (Fungible, Pensando): augment storage offload
- FPGA accelerators (Microsoft Catapult, Intel Arria): augment specific workloads

None replaced the CPU/GPU. All have real businesses. SPU sits in this
category, not in the "AI chip startup trying to displace NVIDIA"
category.

---

## 10. What the simulator measures

See `scripts/spu/simulator.py`. Pulls real numbers from our actual
TNA + NSL-KDD pipeline runs and projects them onto the SPU
microarchitecture using per-unit throughput models. Outputs:

- Per-operator wall time on CPU vs GPU vs SPU
- End-to-end pipeline wall time
- Joules per pipeline run
- $/pipeline run at AWS/Azure pricing
- Throughput at scale (pipelines/sec/chip)

The simulator's throughput numbers are *upper bounds modulo memory
contention* — it models compute and memory bandwidth, not yet
contention or thermal throttling. So treat the speedups as
"what's possible if we can keep the chip fed."
