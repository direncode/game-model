"""
TEST 1 — Embedder amplification curve on the OCEAN substrate.

Hypothesis: when the OCEAN pipeline shape (load -> embed -> cluster ->
align -> measure dispersion) is held constant and only the embedder
varies, downstream signal (mean self_basin_share) scales with embedder
quality (proxied by MTEB score). This is a substrate-composition
property no public AI benchmark has measured.

Embedders swept (BERT-architecture, hand-rolled forward to bypass the
local numpy 2.4.4 / transformers ABI conflict):

    TF-IDF                           — no pretraining, baseline
    sentence-transformers/MiniLM-L6  — MTEB 56.26, 22M params, 6 layers
    BAAI/bge-small-en-v1.5           — MTEB 62.17, 33M params, 12 layers
    BAAI/bge-base-en-v1.5            — MTEB 63.55, 109M params, 12 layers

Corpus: TNA / Bombe (tmp/bombe_tna.ndjson). 6 archives, 40 records each
(plus whatever's available for smaller archives), 4 seeds {42,43,44,45}.

Output: data/validation/embedder_amplification_local_<date>.json
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from huggingface_hub import snapshot_download
from safetensors.torch import load_file as load_safetensors
from tokenizers import Tokenizer


# ---------- config --------------------------------------------------------
CORPUS_PATH = Path("tmp/bombe_tna.ndjson")
HF_HOME = Path(os.path.expandvars(r"%USERPROFILE%")) / ".cache" / "huggingface" / "hub"

EMBEDDERS = {
    "tfidf": {
        "kind": "tfidf",
        "mteb_avg": 0.0,
        "label": "TF-IDF (no pretraining)",
        "params_M": 0.0,
    },
    "minilm_l6": {
        "kind": "bert_handrolled",
        "hf_id": "sentence-transformers/all-MiniLM-L6-v2",
        "snapshot": "c9745ed1d9f207416be6d2e6f8de32d1f16199bf",
        "mteb_avg": 56.26,
        "label": "MiniLM-L6-v2 (22M, 6L)",
        "params_M": 22.0,
        "pool": "mean",
    },
    "bge_small": {
        "kind": "bert_handrolled",
        "hf_id": "BAAI/bge-small-en-v1.5",
        "mteb_avg": 62.17,
        "label": "BGE-small-en-v1.5 (33M, 12L)",
        "params_M": 33.0,
        "pool": "cls",
    },
    "bge_base": {
        "kind": "bert_handrolled",
        "hf_id": "BAAI/bge-base-en-v1.5",
        "mteb_avg": 63.55,
        "label": "BGE-base-en-v1.5 (109M, 12L)",
        "params_M": 109.0,
        "pool": "cls",
    },
}

SEEDS = [42, 43, 44, 45]
N_PER_ARCHIVE = 40
TOP_N_ARCHIVES = 6
K_CLUSTERS = 12
KMEANS_ITERS = 32
BATCH = 8
MAX_LEN = 128
# --------------------------------------------------------------------------


# =========================================================================
# Hand-rolled BERT (works for any HF BertModel-compatible weights)
# =========================================================================
class MiniBert:
    def __init__(self, weights, cfg, pool="mean"):
        self.W = weights
        self.cfg = cfg
        self.n_layers = cfg["num_hidden_layers"]
        self.n_heads = cfg["num_attention_heads"]
        self.d_model = cfg["hidden_size"]
        self.d_head = self.d_model // self.n_heads
        self.eps = cfg.get("layer_norm_eps", 1e-12)
        self.pool = pool

    def embed(self, input_ids, token_type_ids):
        W = self.W
        B, T = input_ids.shape
        position_ids = torch.arange(T).unsqueeze(0).expand(B, -1)
        e_word = W["embeddings.word_embeddings.weight"][input_ids]
        e_pos = W["embeddings.position_embeddings.weight"][position_ids]
        e_typ = W["embeddings.token_type_embeddings.weight"][token_type_ids]
        h = e_word + e_pos + e_typ
        h = F.layer_norm(
            h, (self.d_model,),
            W["embeddings.LayerNorm.weight"],
            W["embeddings.LayerNorm.bias"], eps=self.eps,
        )
        return h

    def attn(self, h, mask, layer):
        W = self.W
        p = f"encoder.layer.{layer}.attention"
        B, T, _ = h.shape

        def proj(name):
            return F.linear(h, W[f"{p}.self.{name}.weight"], W[f"{p}.self.{name}.bias"])

        def split(x):
            return x.view(B, T, self.n_heads, self.d_head).transpose(1, 2)

        q, k, v = split(proj("query")), split(proj("key")), split(proj("value"))
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.d_head)
        add_mask = (1.0 - mask.float())[:, None, None, :] * -1e4
        scores = scores + add_mask
        attn = F.softmax(scores, dim=-1)
        ctx = (attn @ v).transpose(1, 2).contiguous().view(B, T, self.d_model)
        out = F.linear(ctx, W[f"{p}.output.dense.weight"], W[f"{p}.output.dense.bias"])
        out = F.layer_norm(
            out + h, (self.d_model,),
            W[f"{p}.output.LayerNorm.weight"],
            W[f"{p}.output.LayerNorm.bias"], eps=self.eps,
        )
        return out

    def ffn(self, h, layer):
        W = self.W
        p = f"encoder.layer.{layer}"
        x = F.linear(h, W[f"{p}.intermediate.dense.weight"], W[f"{p}.intermediate.dense.bias"])
        x = F.gelu(x)
        x = F.linear(x, W[f"{p}.output.dense.weight"], W[f"{p}.output.dense.bias"])
        x = F.layer_norm(
            x + h, (self.d_model,),
            W[f"{p}.output.LayerNorm.weight"],
            W[f"{p}.output.LayerNorm.bias"], eps=self.eps,
        )
        return x

    def forward(self, input_ids, attention_mask, token_type_ids):
        h = self.embed(input_ids, token_type_ids)
        for i in range(self.n_layers):
            h = self.attn(h, attention_mask, i)
            h = self.ffn(h, i)
        return h


# =========================================================================
# Embedder loaders + runners
# =========================================================================
def ensure_local_weights(spec):
    """Resolve a HF model directory, downloading via huggingface_hub if absent."""
    snap = spec.get("snapshot")
    if snap:
        cand = (HF_HOME / f"models--{spec['hf_id'].replace('/', '--')}"
                       / "snapshots" / snap)
        if cand.exists():
            return cand
    # fall back to snapshot_download (resolves automatically)
    print(f"      [download] {spec['hf_id']}", flush=True)
    path = snapshot_download(
        repo_id=spec["hf_id"],
        allow_patterns=[
            "config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "model.safetensors",
            "vocab.txt",
            "special_tokens_map.json",
        ],
    )
    return Path(path)


def embed_tfidf(texts, seed):
    """Hand-rolled TF-IDF (no sklearn — sklearn breaks under numpy 2.4.4)."""
    import re
    tok_re = re.compile(r"[A-Za-z][A-Za-z0-9_'-]*")
    docs = [[w.lower() for w in tok_re.findall(t)] for t in texts]
    df = Counter()
    for d in docs:
        df.update(set(d))
    n_docs = len(docs)
    # cap vocabulary
    vocab = [w for w, _ in df.most_common(20000)]
    vocab_idx = {w: i for i, w in enumerate(vocab)}
    idf = np.array([math.log((n_docs + 1) / (df[w] + 1)) + 1.0 for w in vocab], dtype=np.float32)
    Z = np.zeros((n_docs, len(vocab)), dtype=np.float32)
    for i, d in enumerate(docs):
        tf = Counter(d)
        for w, c in tf.items():
            j = vocab_idx.get(w)
            if j is not None:
                Z[i, j] = c
        if Z[i].sum() > 0:
            Z[i] /= Z[i].sum()
    Z = Z * idf[None, :]
    norms = np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8
    Z = Z / norms
    return Z


def embed_bert_handrolled(texts, model_dir, pool="mean"):
    cfg = json.loads((model_dir / "config.json").read_text(encoding="utf-8"))
    tok = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
    weights = load_safetensors(str(model_dir / "model.safetensors"))
    bert = MiniBert(weights, cfg, pool=pool)

    pad_id = cfg.get("pad_token_id", 0)
    out_chunks = []
    print(f"      {sum(p.numel() for p in weights.values()) / 1e6:.1f}M params, "
          f"{bert.n_layers} layers, {bert.d_model}-dim, pool={pool}", flush=True)

    with torch.no_grad():
        for i in range(0, len(texts), BATCH):
            chunk = texts[i:i + BATCH]
            tok.enable_truncation(max_length=MAX_LEN)
            tok.enable_padding(length=MAX_LEN, pad_id=pad_id, pad_token="[PAD]")
            enc = tok.encode_batch(chunk)
            ids = torch.tensor([e.ids for e in enc], dtype=torch.long)
            mask = torch.tensor([e.attention_mask for e in enc], dtype=torch.long)
            tids = torch.tensor([e.type_ids for e in enc], dtype=torch.long)
            h = bert.forward(ids, mask, tids)
            if pool == "cls":
                pooled = h[:, 0, :]
            else:
                m = mask.unsqueeze(-1).float()
                pooled = (h * m).sum(1) / m.sum(1).clamp(min=1)
            out_chunks.append(pooled.numpy().astype(np.float32))
            if (i // BATCH) % 4 == 0:
                print(f"      ... {min(i + BATCH, len(texts))}/{len(texts)}", flush=True)

    Z = np.concatenate(out_chunks, axis=0)
    Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)
    return Z


# =========================================================================
# OCEAN-shape pipeline pieces (lifted from transformer_embed_dispersion.py)
# =========================================================================
def load_balanced(path, top_n_archives, n_per_archive, seed):
    records = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    counts = Counter(r["archive"] for r in records)
    top = [a for a, _ in counts.most_common(top_n_archives)]
    rng = np.random.default_rng(seed)
    out = []
    for a in top:
        pool = [r for r in records if r["archive"] == a]
        idx = rng.permutation(len(pool))[:n_per_archive]
        out.extend([pool[i] for i in idx])
    rng.shuffle(out)
    return out


def kmeans_cosine(Z, k, iters, seed):
    rng = np.random.default_rng(seed)
    n, _ = Z.shape
    init = rng.permutation(n)[:k]
    C = Z[init].copy()
    assign = np.zeros(n, dtype=np.int32)
    for _ in range(iters):
        sims = Z @ C.T
        new = sims.argmax(axis=1)
        if (new == assign).all():
            break
        assign = new
        for j in range(k):
            members = Z[assign == j]
            if len(members) > 0:
                c = members.mean(axis=0)
                C[j] = c / (np.linalg.norm(c) + 1e-8)
    return assign, C


def measure_dispersion(records, assignments):
    archives = [r["archive"] for r in records]
    cluster_archive_counts = defaultdict(Counter)
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
            "self_basin_share": round(share, 4),
            "top_landings": [
                {"dominant_archive": d, "count": k, "share": round(k / n, 4)}
                for d, k in top_two
            ],
        })
    return {
        "k_clusters_used": int(len(cluster_dominant)),
        "cluster_dominant_archive": {f"c{c}": d for c, d in sorted(cluster_dominant.items())},
        "dispersion_per_archive": rows,
    }


# =========================================================================
# Single run + campaign loop
# =========================================================================
def run_single(embedder_name, embedder_spec, recs, seed, model_dir=None):
    texts = [(r.get("title", "") + ". " + r.get("text", "")).strip() for r in recs]

    t0 = time.time()
    if embedder_spec["kind"] == "tfidf":
        Z = embed_tfidf(texts, seed)
    elif embedder_spec["kind"] == "bert_handrolled":
        Z = embed_bert_handrolled(texts, model_dir, pool=embedder_spec.get("pool", "mean"))
    else:
        raise ValueError(f"unknown embedder kind: {embedder_spec['kind']}")
    embed_seconds = time.time() - t0

    t1 = time.time()
    assign, _ = kmeans_cosine(Z, K_CLUSTERS, KMEANS_ITERS, seed)
    cluster_seconds = time.time() - t1

    disp = measure_dispersion(recs, assign)

    rows = disp["dispersion_per_archive"]
    mean_self_basin = float(np.mean([r["self_basin_share"] for r in rows]))
    min_self_basin = float(min(r["self_basin_share"] for r in rows))

    return {
        "embedder": embedder_name,
        "embedder_spec": {k: v for k, v in embedder_spec.items() if k != "snapshot"},
        "seed": seed,
        "n_records": len(recs),
        "embed_dim": int(Z.shape[1]),
        "embed_seconds": round(embed_seconds, 2),
        "cluster_seconds": round(cluster_seconds, 2),
        "mean_self_basin_share": round(mean_self_basin, 4),
        "min_self_basin_share": round(min_self_basin, 4),
        **disp,
    }


def run_campaign(embedders_to_run):
    print(f"== Embedder amplification campaign ==")
    print(f"   corpus: {CORPUS_PATH}")
    print(f"   seeds:  {SEEDS}")
    print(f"   embedders: {list(embedders_to_run.keys())}")
    print()

    # pre-resolve weights so we fail fast
    model_dirs = {}
    for name, spec in embedders_to_run.items():
        if spec["kind"] == "bert_handrolled":
            print(f"[weights] {name}: resolving {spec['hf_id']}")
            model_dirs[name] = ensure_local_weights(spec)
            print(f"          -> {model_dirs[name]}")
    print()

    runs = []
    for name, spec in embedders_to_run.items():
        for seed in SEEDS:
            print(f"[run] embedder={name}  seed={seed}")
            recs = load_balanced(CORPUS_PATH, TOP_N_ARCHIVES, N_PER_ARCHIVE, seed)
            result = run_single(name, spec, recs, seed, model_dir=model_dirs.get(name))
            runs.append(result)
            print(f"      -> mean_self_basin={result['mean_self_basin_share']:.4f}  "
                  f"min={result['min_self_basin_share']:.4f}  "
                  f"embed={result['embed_seconds']:.1f}s  cluster={result['cluster_seconds']:.1f}s")
            print()

    # aggregate
    by_embedder = defaultdict(list)
    for r in runs:
        by_embedder[r["embedder"]].append(r)

    summary = []
    for name, group in by_embedder.items():
        means = [g["mean_self_basin_share"] for g in group]
        mins = [g["min_self_basin_share"] for g in group]
        summary.append({
            "embedder": name,
            "label": embedders_to_run[name]["label"],
            "mteb_avg": embedders_to_run[name]["mteb_avg"],
            "params_M": embedders_to_run[name]["params_M"],
            "n_seeds": len(group),
            "mean_self_basin_mean": round(float(np.mean(means)), 4),
            "mean_self_basin_std": round(float(np.std(means)), 4),
            "min_self_basin_mean": round(float(np.mean(mins)), 4),
            "min_self_basin_std": round(float(np.std(mins)), 4),
        })

    summary.sort(key=lambda r: r["mteb_avg"])
    print("=" * 80)
    print("AMPLIFICATION CURVE — embedder MTEB vs OCEAN downstream signal")
    print("=" * 80)
    print(f"{'embedder':<28} {'MTEB':>8} {'mean':>8}±{'std':<6} {'min':>8}±{'std':<6}")
    for s in summary:
        print(f"{s['embedder']:<28} {s['mteb_avg']:>8.2f} "
              f"{s['mean_self_basin_mean']:>8.4f}±{s['mean_self_basin_std']:<6.4f} "
              f"{s['min_self_basin_mean']:>8.4f}±{s['min_self_basin_std']:<6.4f}")
    print("=" * 80)

    out = {
        "campaign": "embedder_amplification_local",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "config": {
            "corpus_path": str(CORPUS_PATH),
            "n_per_archive": N_PER_ARCHIVE,
            "top_n_archives": TOP_N_ARCHIVES,
            "k_clusters": K_CLUSTERS,
            "kmeans_iters": KMEANS_ITERS,
            "seeds": SEEDS,
            "embedders": list(embedders_to_run.keys()),
        },
        "runs": runs,
        "summary_by_embedder": summary,
    }
    out_path = Path(f"data/validation/embedder_amplification_local_{datetime.utcnow():%Y%m%d}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"saved: {out_path}")


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--embedders", default="all",
                   help="comma-separated names or 'all'")
    args = p.parse_args()

    if args.embedders == "all":
        sel = EMBEDDERS
    else:
        names = args.embedders.split(",")
        sel = {n: EMBEDDERS[n] for n in names}

    run_campaign(sel)
    return 0


if __name__ == "__main__":
    sys.exit(main())
