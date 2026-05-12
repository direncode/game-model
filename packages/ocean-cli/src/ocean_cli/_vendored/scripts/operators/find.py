"""Free-tier `find` operators.

`find.dispersion_per_label` is the free-tier dispersion finder. It
consumes the aligned-modules output and computes a single normalized
score per label per module, packaged as a Dispersion value.

Premium aligners that produce a finer "dispersion" finding live only
on the hosted runtime and are NOT shipped here.
"""
from __future__ import annotations

from collections import Counter
from typing import Any


class DispersionPerLabel:
    """Compute dispersion of each label across the aligned modules.

    Dispersion is the normalized concentration of a label across the
    modules: 1.0 means perfectly concentrated in one module, 0.0 means
    spread evenly across every module.
    """

    kind = "find.dispersion_per_label"
    stage = "find"
    tier = "free"

    def run(self, inputs: dict[str, Any], *, seed: int = 42, config: dict | None = None) -> dict[str, Any]:
        aligned = inputs["aligned_modules"]
        label_field = inputs.get("label_field", "archive")

        # Collect dominant labels per module and their shares.
        per_label_modules: dict[str, list[tuple[int, float]]] = {}
        for i, mod in enumerate(aligned):
            alignment = mod.get("alignment") if isinstance(mod, dict) else None
            if not alignment:
                continue
            for top in alignment.get("top3_labels", []):
                label = str(top.get("label", "?"))
                share = float(top.get("share", 0.0))
                per_label_modules.setdefault(label, []).append((i, share))

        # Dispersion per label: max-share across modules.
        by_label: dict[str, dict[str, float]] = {label_field: {}}
        for label, mods in per_label_modules.items():
            if not mods:
                by_label[label_field][label] = 0.0
                continue
            max_share = max(share for _, share in mods)
            by_label[label_field][label] = round(max_share, 3)

        return {"dispersion": {"by_label": by_label}}


_REGISTRY: dict[str, Any] = {
    "find.dispersion_per_label": DispersionPerLabel(),
}


def get(name: str):
    return _REGISTRY.get(name)
