"""
Transformer-embedded substrate clustering on TNA HW catalogue.

Demonstrates: an OCEAN-shape pipeline where the embedder is a real
transformer (sentence-transformers/all-MiniLM-L6-v2, 6-layer BERT,
384 hidden, 22M params) instead of TF-IDF.

The downstream pipeline shape is identical:
    load -> embed -> cluster -> align -> measure dispersion -> save

What we are testing: does a transformer-based embedder change the
HW1 (directorate_to_pm) dispersion finding? The TF-IDF baseline
showed self_basin_share = 0.000 for HW1 across all four seeds.

Implementation note: the local environment has a numpy/pyarrow/sklearn
ABI conflict that breaks `transformers.AutoModel`. So this script loads
the MiniLM weights directly via `safetensors` and runs a hand-rolled
BERT forward pass in pure torch. The architecture is identical to
HuggingFace's BertModel; only the import chain is bypassed.

Run with:
    python scripts/experiments/transformer_embed_dispersion.py
"""
from __future__ import annotations

import json
import os
import sys
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from safetensors.torch import load_file as load_safetensors
from tokenizers import Tokenizer


# ---------- config --------------------------------------------------------
CORPUS_PATH = Path("tmp/bombe_tna.ndjson")
HF_HOME    = Path(os.path.expandvars(r"%USERPROFILE%")) / ".cache" / "huggingface" / "hub"
MODEL_DIR  = HF_HOME / "models--sentence-transformers--all-MiniLM-L6-v2" / "snapshots" / "c9745ed1d9f207416be6d2e6f8de32d1f16199bf"

N_PER_ARCHIVE = 40
TOP_N_ARCHIVES = 6
K_CLUSTERS = 12
KMEANS_ITERS = 32
SEED = 42
# --------------------------------------------------------------------------


# =========================================================================
# 1. Minimal BERT forward pass (bypasses transformers.AutoModel because
#    sklearn / pyarrow ABI is broken in this env).
# =========================================================================
class MiniBert:
    """Hand-rolled BERT inference matching HuggingFace BertModel weight layout."""

    def __init__(self, weights: dict[str, torch.Tensor], cfg: dict):
        self.W = weights
        self.cfg = cfg
        self.n_layers = cfg["num_hidden_layers"]
        self.n_heads  = cfg["num_attention_heads"]
        self.d_model  = cfg["hidden_size"]
        self.d_head   = self.d_model // self.n_heads
        self.eps      = cfg["layer_norm_eps"]

    def embed(self, input_ids: torch.Tensor, token_type_ids: torch.Tensor) -> torch.Tensor:
        W = self.W
        B, T = input_ids.shape
        position_ids = torch.arange(T).unsqueeze(0).expand(B, -1)
        e_word = W["embeddings.word_embeddings.weight"][input_ids]
        e_pos  = W["embeddings.position_embeddings.weight"][position_ids]
        e_typ  = W["embeddings.token_type_embeddings.weight"][token_type_ids]
        h = e_word + e_pos + e_typ
        h = F.layer_norm(h, (self.d_model,),
                         W["embeddings.LayerNorm.weight"],
                         W["embeddings.LayerNorm.bias"], eps=self.eps)
        return h

    def attn(self, h: torch.Tensor, mask: torch.Tensor, layer: int) -> torch.Tensor:
        W = self.W
        p = f"encoder.layer.{layer}.attention"
        B, T, _ = h.shape

        def proj(name):
            return F.linear(h, W[f"{p}.self.{name}.weight"], W[f"{p}.self.{name}.bias"])

        def split(x):
            return x.view(B, T, self.n_heads, self.d_head).transpose(1, 2)  # (B, H, T, d)

        q, k, v = split(proj("query")), split(proj("key")), split(proj("value"))
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.d_head)
        # mask: (B, T) — additive, where 0=valid, -inf=pad
        add_mask = (1.0 - mask.float())[:, None, None, :] * -1e4
        scores = scores + add_mask
        attn = F.softmax(scores, dim=-1)
        ctx  = (attn @ v).transpose(1, 2).contiguous().view(B, T, self.d_model)
        out  = F.linear(ctx, W[f"{p}.output.dense.weight"], W[f"{p}.output.dense.bias"])
        out  = F.layer_norm(out + h, (self.d_model,),
                            W[f"{p}.output.LayerNorm.weight"],
                            W[f"{p}.output.LayerNorm.bias"], eps=self.eps)
        return out

    def ffn(self, h: torch.Tensor, layer: int) -> torch.Tensor:
        W = self.W
        p = f"encoder.layer.{layer}"
        x = F.linear(h, W[f"{p}.intermediate.dense.weight"], W[f"{p}.intermediate.dense.bias"])
        x = F.gelu(x)
        x = F.linear(x, W[f"{p}.output.dense.weight"], W[f"{p}.output.dense.bias"])
        x = F.layer_norm(x + h, (self.d_model,),
                         W[f"{p}.output.LayerNorm.weight"],
                         W[f"{p}.output.LayerNorm.bias"], eps=self.eps)
        return x

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor,
                token_type_ids: torch.Tensor) -> torch.Tensor:
        h = self.embed(input_ids, token_type_ids)
        for i in range(self.n_layers):
            h = self.attn(h, attention_mask, i)
            h = self.ffn(h, i)
        return h


# =========================================================================
# 2. Tokenization + embedding + clustering + dispersion (OCEAN-shape).
# =========================================================================
def load_balanced(path: Path, top_n_archives: int, n_per_archive: int) -> list[dict]:
    records = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    counts  = Counter(r["archive"] for r in records)
    top     = [a for a, _ in counts.most_common(top_n_archives)]
    rng     = np.random.default_rng(SEED)
    out: list[dict] = []
    for a in top:
        pool = [r for r in records if r["archive"] == a]
        idx  = rng.permutation(len(pool))[:n_per_archive]
        out.extend([pool[i] for i in idx])
    rng.shuffle(out)
    return out


def transformer_embed_local(texts: list[str]) -> np.ndarray:
    cfg     = json.loads((MODEL_DIR / "config.json").read_text())
    tok     = Tokenizer.from_file(str(MODEL_DIR / "tokenizer.json"))
    weights = load_safetensors(str(MODEL_DIR / "model.safetensors"))
    bert    = MiniBert(weights, cfg)

    out_chunks = []
    BATCH = 16
    MAX_LEN = 128

    print(f"      {sum(p.numel() for p in weights.values()) / 1e6:.1f}M params, {bert.n_layers} layers, {bert.d_model}-dim", flush=True)

    with torch.no_grad():
        for i in range(0, len(texts), BATCH):
            chunk = texts[i:i + BATCH]
            tok.enable_truncation(max_length=MAX_LEN)
            tok.enable_padding(length=MAX_LEN, pad_id=cfg["pad_token_id"], pad_token="[PAD]")
            enc = tok.encode_batch(chunk)
            ids  = torch.tensor([e.ids           for e in enc], dtype=torch.long)
            mask = torch.tensor([e.attention_mask for e in enc], dtype=torch.long)
            tids = torch.tensor([e.type_ids      for e in enc], dtype=torch.long)
            h    = bert.forward(ids, mask, tids)            # (B, T, D)
            m    = mask.unsqueeze(-1).float()
            pooled = (h * m).sum(1) / m.sum(1).clamp(min=1)
            out_chunks.append(pooled.numpy().astype(np.float32))
            if (i // BATCH) % 4 == 0:
                print(f"      ... {min(i + BATCH, len(texts))}/{len(texts)}", flush=True)

    Z = np.concatenate(out_chunks, axis=0)
    Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)
    return Z


def kmeans_cosine(Z: np.ndarray, k: int, iters: int, seed: int):
    rng    = np.random.default_rng(seed)
    n, _   = Z.shape
    init   = rng.permutation(n)[:k]
    C      = Z[init].copy()
    assign = np.zeros(n, dtype=np.int32)
    for _ in range(iters):
        sims  = Z @ C.T
        new   = sims.argmax(axis=1)
        if (new == assign).all():
            break
        assign = new
        for j in range(k):
            members = Z[assign == j]
            if len(members) > 0:
                c = members.mean(axis=0)
                C[j] = c / (np.linalg.norm(c) + 1e-8)
    return assign, C


def measure_dispersion(records: list[dict], assignments: np.ndarray) -> dict:
    archives = [r["archive"] for r in records]
    cluster_archive_counts: dict[int, Counter] = defaultdict(Counter)
    for a, c in zip(archives, assignments):
        cluster_archive_counts[int(c)][a] += 1
    cluster_dominant = {c: cc.most_common(1)[0][0] for c, cc in cluster_archive_counts.items()}

    by_archive = defaultdict(list)
    for r, c in zip(records, assignments):
        by_archive[r["archive"]].append(int(c))

    rows = []
    for a, clusts in sorted(by_archive.items()):
        n = len(clusts)
        in_self_basin = sum(1 for c in clusts if cluster_dominant.get(c) == a)
        share = in_self_basin / n if n else 0.0
        landing = Counter(cluster_dominant.get(c, "?") for c in clusts)
        top_two = landing.most_common(2)
        rows.append({
            "archive": a,
            "n_records": n,
            "self_basin_share": round(share, 3),
            "top_landings": [{"dominant_archive": d, "count": k, "share": round(k/n, 3)} for d, k in top_two],
        })
    return {
        "k_clusters_used": int(len(cluster_dominant)),
        "cluster_dominant_archive": {f"c{c}": d for c, d in sorted(cluster_dominant.items())},
        "dispersion_per_archive": rows,
    }


def main():
    print("== OCEAN-shape pipeline with TRANSFORMER embedder on TNA ==")
    print(f"   corpus: {CORPUS_PATH}")
    print(f"   model:  all-MiniLM-L6-v2 (loaded from local HF cache)")
    print(f"   k:      {K_CLUSTERS}, iters: {KMEANS_ITERS}, seed: {SEED}")
    print()

    print("[1/4] loading + balancing corpus")
    recs = load_balanced(CORPUS_PATH, TOP_N_ARCHIVES, N_PER_ARCHIVE)
    by_arch = Counter(r["archive"] for r in recs)
    print(f"      {len(recs)} records across {len(by_arch)} archives")
    for a, c in by_arch.most_common():
        print(f"        {a:30s}  n={c}")
    print()

    print("[2/4] transformer-embedding (local HF cache, no internet, no sklearn)")
    texts = [(r.get("title", "") + ". " + r.get("text", "")).strip() for r in recs]
    Z = transformer_embed_local(texts)
    print(f"      Z shape: {Z.shape}, dtype: {Z.dtype}, L2-norm mean: {np.linalg.norm(Z, axis=1).mean():.4f}")
    print()

    print("[3/4] kmeans clustering (cosine)")
    assign, _ = kmeans_cosine(Z, K_CLUSTERS, KMEANS_ITERS, SEED)
    cluster_sizes = Counter(int(c) for c in assign)
    print(f"      {len(set(assign))} clusters formed, sizes: {sorted(cluster_sizes.values(), reverse=True)}")
    print()

    print("[4/4] measuring dispersion")
    result = measure_dispersion(recs, assign)
    print()
    print("RESULT — per-archive dispersion (transformer-embedded)")
    print()
    for row in sorted(result["dispersion_per_archive"], key=lambda r: -r["n_records"]):
        landing_str = "  ".join(
            f"{l['dominant_archive']}:{l['count']}/{row['n_records']}({l['share']:.0%})"
            for l in row["top_landings"]
        )
        print(f"  {row['archive']:30s}  n={row['n_records']:3d}  self_basin={row['self_basin_share']:.3f}   lands_in:  {landing_str}")
    print()

    out_path = Path("data/validation/tna_dispersion_transformer_seed42.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "experiment": "OCEAN-shape pipeline with transformer embedder",
        "model": "sentence-transformers/all-MiniLM-L6-v2",
        "config": {
            "corpus_path": str(CORPUS_PATH),
            "n_per_archive": N_PER_ARCHIVE,
            "top_n_archives": TOP_N_ARCHIVES,
            "k_clusters": K_CLUSTERS,
            "kmeans_iters": KMEANS_ITERS,
            "seed": SEED,
        },
        "n_records": len(recs),
        "archives_in_run": dict(by_arch),
        **result,
    }
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"saved: {out_path}")
    return True


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
