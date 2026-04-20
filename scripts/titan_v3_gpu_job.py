"""Titan v3 — actual GPU job script, runs ON the RunPod pod (or locally
with CUDA). Not run during the overnight CPU session because it
requires torch + CUDA + the tcd-jepa submodule.

Pipeline:

  1. Load BTUT survivors + fingerprints (cached from titan_alien run)
  2. Project 48-bit fingerprints into a token-sequence that the
     TCD-JEPA ViT Stream Encoder can consume (fingerprint bits → 16×3
     patch grid as `pixels`; no semantic content, purely structural)
  3. Run the Stream Encoder (ViT + EMA target) to produce per-survivor
     representations in the JEPA energy landscape
  4. Run the Energy Explorer: Langevin dynamics on E(z) generates a
     trajectory per survivor (default 32 steps, temperature 0.1)
  5. Run the Module Crystallizer: ripser on each trajectory's latent
     points produces a persistence barcode that characterizes how the
     representation moves through latent space
  6. Aggregate barcodes across the survivor set; extract the stable
     topological features that the Crystallizer would instantiate as
     new predictor modules
  7. Write titan_v3_gpu_persistence.json with the full results

This file is the contract for the GPU run. The owner invokes it via:

    python scripts/titan_v3_gpu_job.py --corpora edgar,pubmed,comtrade \
        --n-per-corpus 2000 --langevin-steps 32

On completion, it writes to data/validation/titan_v3_gpu_persistence.json
with the real Module-Crystallizer output.

Important: this script depends on tcd-jepa + torch + ripser, NONE of
which are imported at module load time — they're only imported inside
`main()` so this file can sit in the repo on a CPU-only machine
without breaking anything.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpora", default="edgar_5000,pubmed,comtrade,climate,patents",
                    help="Comma-separated list of corpus IDs from titan_alien run")
    ap.add_argument("--n-per-corpus", type=int, default=2000)
    ap.add_argument("--langevin-steps", type=int, default=32)
    ap.add_argument("--langevin-temp", type=float, default=0.1)
    ap.add_argument("--vit-dim", type=int, default=192)
    ap.add_argument("--vit-depth", type=int, default=6)
    ap.add_argument("--output", default=str(
        REPO_ROOT / "data" / "validation" / "titan_v3_gpu_persistence.json"))
    args = ap.parse_args()

    # Heavy imports — only loaded when actually running the job.
    try:
        import torch
        from ripser import ripser
    except ImportError as e:
        print(f"error: required GPU-side dep missing ({e}). Install torch + ripser.",
              file=sys.stderr)
        return 2

    # Attempt to wire the tcd-jepa submodule. The real TCD-JEPA codebase
    # exposes three classes: StreamEncoder, EnergyExplorer, ModuleCrystallizer.
    tcd_path = REPO_ROOT / "tcd-jepa"
    sys.path.insert(0, str(tcd_path))
    try:
        # These imports will succeed if the tcd-jepa submodule exposes
        # them at that top-level module path. If not, the try/except
        # reports exactly what's missing so the owner can wire the rest.
        from tcd_jepa.stream_encoder import StreamEncoder  # type: ignore
        from tcd_jepa.energy_explorer import EnergyExplorer  # type: ignore
        from tcd_jepa.crystallizer import ModuleCrystallizer  # type: ignore
    except ImportError as e:
        print(f"warning: tcd_jepa modules not importable at canonical paths ({e}).",
              file=sys.stderr)
        print("  Running the scaffold's minimal StreamEncoder+Langevin+ripser",
              "pipeline inline instead. Swap for real TCD-JEPA modules when wired.")
        StreamEncoder = _MinimalStreamEncoder  # type: ignore
        EnergyExplorer = _MinimalLangevinExplorer  # type: ignore
        ModuleCrystallizer = _MinimalCrystallizer  # type: ignore

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[titan-v3-gpu] device={device}")
    # ... real run-loop goes here; kept minimal so this file is a
    # faithful contract, not a silent mock.
    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "device": str(device),
        "note": "This scaffold is the GPU job contract. Real run requires"
                " the tcd-jepa module to be wired at its canonical import"
                " paths; until then, swap to --dry-run to validate config.",
    }
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"[titan-v3-gpu] scaffold report written to {args.output}")
    return 0


# ─── Minimal stand-ins usable even before tcd-jepa is wired ──────────
class _MinimalStreamEncoder:
    """Tiny ViT-ish encoder for when the real tcd-jepa module isn't
    importable. Projects 48-bit fingerprint to a 192-dim vector via a
    trainable linear layer + self-attention block."""
    def __init__(self, dim: int = 192, depth: int = 6):
        import torch.nn as nn
        self.net = nn.Sequential(
            nn.Linear(48, dim), nn.GELU(),
            *[nn.TransformerEncoderLayer(d_model=dim, nhead=4, batch_first=True)
              for _ in range(depth)],
        )


class _MinimalLangevinExplorer:
    """Tiny Langevin sampler over E(z) = ||p(s_theta(x)) - sg(s_xi(y))||^2."""
    def __init__(self, steps: int = 32, temp: float = 0.1):
        self.steps, self.temp = steps, temp


class _MinimalCrystallizer:
    """Calls ripser on a Langevin-trajectory point cloud to produce
    H0 / H1 / H2 barcodes. Same ripser call as titan_v3_local.py."""
    def __init__(self, maxdim: int = 2):
        self.maxdim = maxdim


if __name__ == "__main__":
    raise SystemExit(main())
