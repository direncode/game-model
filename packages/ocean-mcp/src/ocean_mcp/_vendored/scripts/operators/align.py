"""Align operators — modules ↔ gold labels.

The alignment operator computes per-module dominant-label / bleed-share /
top-3 distribution. The dispersion operator computes per-LABEL routing:
where do each label's records land?
"""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from . import Operator, register


@register
class ModuleAlignment(Operator):
    """For each module, K nearest records by centroid; tally label distribution."""
    kind = "align.module"
    stage = "align"

    def run(self, inputs, *, seed, config):
        import numpy as np

        modules = inputs["modules"]
        records = inputs["records"]
        Z = inputs["Z"]
        label_field = inputs.get("label_field", "archive")
        fine_field = config.get("fine_label_field", "primary_category")
        k = config.get("k_nearest", 50)

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
            dom_share = dom_n / k_eff
            bleed = sum(c for label, c in sc.items() if label != dom_label) / k_eff
            mod_aligned = dict(m)
            mod_aligned["alignment"] = {
                "k_nearest":        k_eff,
                "dominant_label":   dom_label,
                "dominant_share":   round(dom_share, 3),
                "bleed_share":      round(bleed, 3),
                "top3_labels":      [{"label": l, "count": c, "share": round(c / k_eff, 3)}
                                     for l, c in top3],
                "fine_label_dist":  dict(Counter(nn_fines.tolist())),
                "sample_records":   [{"paper_id": str(p), "label": str(l), "title": str(t)}
                                     for p, l, t in zip(nn_ids[:5], nn_labels[:5], nn_titles[:5])],
            }
            out.append(mod_aligned)
        return {"aligned_modules": out, "label_field": label_field}


@register
class DispersionAnalysis(Operator):
    """For every record, find its nearest module by centroid distance.
    Tally per-label distribution of 'where this label's records land'.

    This is the operator that surfaces the directorate_to_pm dispersion finding.
    """
    kind = "align.dispersion"
    stage = "align"

    def run(self, inputs, *, seed, config):
        import numpy as np

        modules = inputs["aligned_modules"]
        records = inputs["records"]
        Z = inputs["Z"]
        label_field = inputs.get("label_field", "archive")

        # Only operate on modules with centroids and alignment
        usable = [m for m in modules if "centroid_vec" in m and "alignment" in m]
        if not usable:
            return {"dispersion_per_label": [], "per_record_assignments": []}

        centroid_matrix = np.array([m["centroid_vec"] for m in usable], dtype=np.float32)
        module_dom = [m["alignment"]["dominant_label"] for m in usable]
        module_ids = [m["module_id"] for m in usable]

        # Pairwise distances — record × module
        diffs = Z[:, None, :] - centroid_matrix[None, :, :]
        dists = np.linalg.norm(diffs, axis=-1)
        nearest_idx = np.argmin(dists, axis=1)

        labels = [r.get(label_field, "?") for r in records]
        ids = [r.get("paper_id", str(i)) for i, r in enumerate(records)]
        nearest_module_ids = [module_ids[i] for i in nearest_idx]
        nearest_module_doms = [module_dom[i] for i in nearest_idx]

        per_label = defaultdict(lambda: defaultdict(int))
        for src, dest in zip(labels, nearest_module_doms):
            per_label[src][dest] += 1

        rows = []
        for src in sorted(per_label.keys()):
            dist = dict(per_label[src])
            n = sum(dist.values())
            top = sorted(dist.items(), key=lambda x: -x[1])[:5]
            self_share = dist.get(src, 0) / n if n else 0
            rows.append({
                "label":            src,
                "n_records":        n,
                "self_basin_share": round(self_share, 3),
                "lands_in":         [{"dominant_label": k, "count": v, "share": round(v / n, 3)}
                                     for k, v in top],
            })

        per_record = [
            {"paper_id": str(p), "label": l, "nearest_module": m, "nearest_module_dom_label": d}
            for p, l, m, d in zip(ids, labels, nearest_module_ids, nearest_module_doms)
        ]
        return {"dispersion_per_label": rows, "per_record_assignments": per_record}
