"""Minimal BERT forward pass — pure torch, no transformers library.

Used by embed.transformer to bypass the broken
transformers/sklearn/pyarrow ABI chain on hosts where it appears.
The forward pass matches HuggingFace's BertModel weight layout for
sentence-transformers/all-MiniLM-L6-v2 exactly, so loading any
BertModel-style safetensors checkpoint works.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn.functional as F


def _model_cache_dir() -> Path:
    """Resolve a writable cache dir for the MiniLM weights."""
    if "HF_HOME" in os.environ:
        return Path(os.environ["HF_HOME"])
    if os.name == "nt":
        return Path(os.path.expandvars(r"%USERPROFILE%")) / ".cache" / "huggingface"
    return Path.home() / ".cache" / "huggingface"


def ensure_minilm(repo_id: str = "sentence-transformers/all-MiniLM-L6-v2") -> Path:
    """Make sure the MiniLM weights + tokenizer + config are on disk.

    Uses huggingface_hub if available (preferred — handles caching, retries,
    revision pinning). Falls back to direct urllib download.
    Returns the path to the snapshot directory.
    """
    files = ["config.json", "tokenizer.json", "model.safetensors"]
    try:
        from huggingface_hub import snapshot_download
        snap = Path(snapshot_download(
            repo_id=repo_id,
            allow_patterns=files,
            cache_dir=str(_model_cache_dir() / "hub"),
        ))
        return snap
    except ImportError:
        pass

    # Manual fallback: download files into a flat dir
    import urllib.request
    out = _model_cache_dir() / "manual" / repo_id.replace("/", "--")
    out.mkdir(parents=True, exist_ok=True)
    for fname in files:
        target = out / fname
        if target.exists():
            continue
        url = f"https://huggingface.co/{repo_id}/resolve/main/{fname}"
        urllib.request.urlretrieve(url, target)
    return out


class MiniBert:
    """Hand-rolled BERT inference matching HuggingFace BertModel weight layout.

    Architecture: 6-layer BERT, 384 hidden, 12 heads, 1536 intermediate, GELU,
    LayerNorm eps 1e-12. Match for sentence-transformers/all-MiniLM-L6-v2.
    """

    def __init__(self, weights: dict[str, torch.Tensor], cfg: dict[str, Any]):
        self.W = weights
        self.cfg = cfg
        self.n_layers = cfg["num_hidden_layers"]
        self.n_heads  = cfg["num_attention_heads"]
        self.d_model  = cfg["hidden_size"]
        self.d_head   = self.d_model // self.n_heads
        self.eps      = cfg["layer_norm_eps"]

    @classmethod
    def from_snapshot(cls, snapshot: Path) -> "MiniBert":
        from safetensors.torch import load_file as load_safetensors
        cfg = json.loads((snapshot / "config.json").read_text())
        weights = load_safetensors(str(snapshot / "model.safetensors"))
        return cls(weights, cfg)

    def _embed(self, input_ids: torch.Tensor, token_type_ids: torch.Tensor) -> torch.Tensor:
        W = self.W
        B, T = input_ids.shape
        position_ids = torch.arange(T).unsqueeze(0).expand(B, -1)
        e_word = W["embeddings.word_embeddings.weight"][input_ids]
        e_pos  = W["embeddings.position_embeddings.weight"][position_ids]
        e_typ  = W["embeddings.token_type_embeddings.weight"][token_type_ids]
        h = e_word + e_pos + e_typ
        return F.layer_norm(h, (self.d_model,),
                            W["embeddings.LayerNorm.weight"],
                            W["embeddings.LayerNorm.bias"], eps=self.eps)

    def _attn(self, h: torch.Tensor, mask: torch.Tensor, layer: int) -> torch.Tensor:
        W = self.W
        p = f"encoder.layer.{layer}.attention"
        B, T, _ = h.shape
        def proj(name: str) -> torch.Tensor:
            return F.linear(h, W[f"{p}.self.{name}.weight"], W[f"{p}.self.{name}.bias"])
        def split(x: torch.Tensor) -> torch.Tensor:
            return x.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        q, k, v = split(proj("query")), split(proj("key")), split(proj("value"))
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.d_head)
        add_mask = (1.0 - mask.float())[:, None, None, :] * -1e4
        scores = scores + add_mask
        attn = F.softmax(scores, dim=-1)
        ctx  = (attn @ v).transpose(1, 2).contiguous().view(B, T, self.d_model)
        out  = F.linear(ctx, W[f"{p}.output.dense.weight"], W[f"{p}.output.dense.bias"])
        return F.layer_norm(out + h, (self.d_model,),
                            W[f"{p}.output.LayerNorm.weight"],
                            W[f"{p}.output.LayerNorm.bias"], eps=self.eps)

    def _ffn(self, h: torch.Tensor, layer: int) -> torch.Tensor:
        W = self.W
        p = f"encoder.layer.{layer}"
        x = F.linear(h, W[f"{p}.intermediate.dense.weight"], W[f"{p}.intermediate.dense.bias"])
        x = F.gelu(x)
        x = F.linear(x, W[f"{p}.output.dense.weight"], W[f"{p}.output.dense.bias"])
        return F.layer_norm(x + h, (self.d_model,),
                            W[f"{p}.output.LayerNorm.weight"],
                            W[f"{p}.output.LayerNorm.bias"], eps=self.eps)

    def encode(self, input_ids: torch.Tensor, attention_mask: torch.Tensor,
               token_type_ids: torch.Tensor) -> torch.Tensor:
        h = self._embed(input_ids, token_type_ids)
        for i in range(self.n_layers):
            h = self._attn(h, attention_mask, i)
            h = self._ffn(h, i)
        return h

    def embed_texts(self, texts: list[str], snapshot: Path,
                    max_length: int = 128, batch_size: int = 16) -> np.ndarray:
        """Tokenize, encode, mean-pool with attention mask, L2-normalize."""
        from tokenizers import Tokenizer
        tok = Tokenizer.from_file(str(snapshot / "tokenizer.json"))
        tok.enable_truncation(max_length=max_length)
        tok.enable_padding(length=max_length, pad_id=self.cfg["pad_token_id"], pad_token="[PAD]")

        out_chunks: list[np.ndarray] = []
        with torch.no_grad():
            for i in range(0, len(texts), batch_size):
                chunk = texts[i:i + batch_size]
                enc = tok.encode_batch(chunk)
                ids  = torch.tensor([e.ids            for e in enc], dtype=torch.long)
                mask = torch.tensor([e.attention_mask for e in enc], dtype=torch.long)
                tids = torch.tensor([e.type_ids       for e in enc], dtype=torch.long)
                h = self.encode(ids, mask, tids)
                m = mask.unsqueeze(-1).float()
                pooled = (h * m).sum(1) / m.sum(1).clamp(min=1)
                out_chunks.append(pooled.numpy().astype(np.float32))
        Z = np.concatenate(out_chunks, axis=0)
        Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-8)
        return Z
