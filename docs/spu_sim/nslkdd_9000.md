# SPU simulation report — workload: NSL-KDD intrusion, 9000 flows

## Per-operator breakdown

| Operator | N | Op count | Kind | CPU wall | GPU wall | SPU wall | CPU/SPU | GPU/SPU |
|---|---|---|---|---|---|---|---|---|
| `source.csv` | 9,000 | 9,000 | sge | 500.00 ms | 199.00 µs | 79.12 µs | 6,319× | 3× |
| `reduce.btut` | 9,000 | 72,000 | hash | 7.90 s | 51.43 µs | 25.41 µs | 310,852× | 2× |
| `cluster.tcd_recursive_loop` | 299 | 1,430,416 | sge | 84.60 s | 99.50 µs | 40.06 µs | 2,111,700× | 2× |
| `align.module` | 299 | 4,485 | cam | 10.00 ms | 448.50 µs | 1.28 µs | 7,811× | 350× |

## Pipeline totals

| Metric | CPU (32-core Xeon) | GPU (H100, 700 W) | SPU (20 W) |
|---|---|---|---|
| Wall time | 93.01 s | 798.44 µs | 145.88 µs |
| Energy per run | 9,301.00 J | 558.91 mJ | 2.92 mJ |
| Speedup vs SPU | 1× | 0.00× | — |
| Speedup of SPU vs each | **637,571×** | **5×** | 1× |
| Energy efficiency vs SPU | 1× | 0.00× | — |
| **Energy efficiency of SPU** | **3,187,853× better** | **192× better** | 1× |

## Cloud-cost model (USD per pipeline run)

| Platform | Wall time | $/hour | $ per run |
|---|---|---|---|
| AWS c7i.8xlarge (CPU) | 93.01 s | $1.71 | $0.0442 |
| AWS p5 (1× H100)      | 798.44 µs | $98.00     | $0.0000 |
| SPU (hosted, target)  | 145.88 µs | $0.50     | $0.000000 |

## Throughput at scale

- A single SPU runs **6,855 pipelines/sec** on this workload.
- At 20 W each, a 1 kW power budget = 50 SPUs = **342,743 pipelines/sec**.
- That same 1 kW on H100 = ~1.4 H100s = **1,753 pipelines/sec**.
- Throughput-per-watt advantage of SPU: **192×** over GPU.

## Caveats

- CPU wall times are MEASURED from real runs in `data/validation/`.
- GPU wall times are MODELED using H100 published throughputs + a memory-bound penalty for irregular ops (3% of peak HBM bandwidth on scatter-gather).
- SPU wall times are MODELED from per-unit throughputs in §3 of `docs/SPU_ARCHITECTURE.md`. Treat as upper bounds modulo memory contention and thermal effects.
- The SPU wins because the workload is dominated by scatter-gather + hashing + CAM lookups, all of which it has dedicated silicon for.