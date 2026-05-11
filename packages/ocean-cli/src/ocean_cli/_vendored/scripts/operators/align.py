"""Free-tier align operators.

Premium aligners (e.g. align.dispersion) live only on the hosted runtime
and are NOT shipped here. ocean_cli registers a stub under that name at
import time.
"""
from __future__ import annotations

from collections import Counter
from typing import Any


class ModuleAlignment:
    """For each module, K nearest records by centroid; tally label distribution.

    config:
        k_nearest:        int - records per module to align (default 50)
        fine_label_field: str - record key for the fine-grained label
                                (default 'primary_category')
    """

    kind = "align.module"
    stage = "align"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        import numpy as np

        config = config or {}
        modules = inputs["modules"]
        records = inputs["records"]
        Z = inputs["Z"]
        label_field = inputs.get("label_field", "archive")
        fine_field = config.get("fine_label_field", "primary_category")
        k = int(config.get("k_nearest", 50))

        labels = np.array([r.get(label_field, "?") for r in records])
        fines = np.array([r.get(fine_field, "?") for r in records])
        titles = np.array([(r.get("title", "") or "")[:80] for r in records])
        ids = np.array([r.get("paper_id", str(i)) for i, r in enumerate(records)])
        k_eff = min(k, len(records))

        out = []
        for m in modules:
            if "centroid_vec" not in m:
                out.append(m)
                continue
            centroid = np.asarray(m["centroid_vec"], dtype=np.float32)
            dists = np.linalg.norm(Z - centroid, axis=1)
            nn_idx = np.argsort(dists)[:k_eff]
            nn_labels = labels[nn_idx]
            nn_fines = fines[nn_idx]
            nn_titles = titles[nn_idx]
            nn_ids = ids[nn_idx]
            sc = Counter(nn_labels.tolist())
            top3 = sc.most_common(3)
            dom_label, dom_n = top3[0] if top3 else ("?", 0)
            dom_share = dom_n / k_eff if k_eff else 0.0
            bleed = sum(c for label, c in sc.items() if label != dom_label) / k_eff if k_eff else 0.0
            mod_aligned = dict(m)
            mod_aligned["alignment"] = {
                "k_nearest":       k_eff,
                "dominant_label":  dom_label,
                "dominant_share":  round(dom_share, 3),
                "bleed_share":     round(bleed, 3),
                "top3_labels":     [
                    {"label": l, "count": c, "share": round(c / k_eff, 3)}
                    for l, c in top3
                ],
                "fine_label_dist": dict(Counter(nn_fines.tolist())),
                "sample_records":  [
                    {"paper_id": str(p), "label": str(l), "title": str(t)}
                    for p, l, t in zip(nn_ids[:5], nn_labels[:5], nn_titles[:5])
                ],
            }
            out.append(mod_aligned)
        return {"aligned_modules": out, "label_field": label_field}


# ── Per-module registry ──────────────────────────────────────────────────

_REGISTRY: dict[str, Any] = {
    "align.module": ModuleAlignment(),
}


def get(name: str):
    return _REGISTRY.get(name)
