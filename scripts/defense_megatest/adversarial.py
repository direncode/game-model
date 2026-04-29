"""Adversarial perturbation patterns for the megatest.

Tests robustness of BTUT to controlled adversarial inputs. Each function
takes a corpus and returns a perturbed copy plus the perturbation metadata.
The downstream test then re-runs BTUT on the perturbed corpus and measures
whether the original ground-truth anomalies are still recovered.
"""
from __future__ import annotations

import copy
from typing import Any

import numpy as np


def add_gaussian_noise(
    entities: list[dict],
    sigma: float = 0.10,
    seed: int = 42,
) -> tuple[list[dict], dict[str, Any]]:
    """Add zero-mean Gaussian noise to all numeric attributes.

    sigma is fractional of attribute magnitude (relative noise scale).
    """
    rng = np.random.default_rng(seed)
    out = copy.deepcopy(entities)
    n_perturbed = 0
    for e in out:
        attrs = e.get("attributes") or {}
        for k, v in attrs.items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                noise = rng.normal(0.0, sigma * (abs(v) + 1e-6))
                attrs[k] = float(v + noise)
                n_perturbed += 1
    return out, {"perturbation": "gaussian_noise", "sigma": sigma, "n_perturbed_attrs": n_perturbed}


def mimicry_attack(
    entities: list[dict],
    anomaly_names: set[str],
    cover_fraction: float = 0.30,
    seed: int = 42,
) -> tuple[list[dict], dict[str, Any]]:
    """Make a fraction of anomalies look more like normal entities.

    Picks `cover_fraction` of anomalies, computes the mean numeric attribute
    profile of normal entities, and shifts the picked anomalies a step
    toward that mean. Tests whether BTUT can still detect partially
    camouflaged anomalies.
    """
    rng = np.random.default_rng(seed)
    out = copy.deepcopy(entities)

    normal = [e for e in out if e["name"] not in anomaly_names]
    if not normal:
        return out, {"perturbation": "mimicry_attack", "n_covered": 0}

    # Compute normal mean profile per numeric attribute key
    keys: dict[str, list[float]] = {}
    for e in normal:
        for k, v in (e.get("attributes") or {}).items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                keys.setdefault(k, []).append(float(v))
    means = {k: float(np.mean(vs)) for k, vs in keys.items() if vs}

    anomaly_list = [e for e in out if e["name"] in anomaly_names]
    n_to_cover = max(1, int(cover_fraction * len(anomaly_list)))
    picks = rng.choice(len(anomaly_list), size=min(n_to_cover, len(anomaly_list)), replace=False)

    n_covered = 0
    for i in picks:
        anom = anomaly_list[i]
        attrs = anom.get("attributes") or {}
        for k, mean_v in means.items():
            v = attrs.get(k)
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                # Move halfway toward the normal mean
                attrs[k] = float(0.5 * v + 0.5 * mean_v)
        n_covered += 1
    return out, {"perturbation": "mimicry_attack", "n_covered": n_covered, "cover_fraction": cover_fraction}


def categorical_swap(
    entities: list[dict],
    swap_fraction: float = 0.10,
    seed: int = 42,
) -> tuple[list[dict], dict[str, Any]]:
    """Randomly swap categorical attribute values across entities.

    Tests whether BTUT's lattice is robust to categorical noise / typos /
    label confusion in the input pipeline.
    """
    rng = np.random.default_rng(seed)
    out = copy.deepcopy(entities)

    # Discover categorical (string) attribute keys
    cat_keys: dict[str, list[str]] = {}
    for e in out:
        for k, v in (e.get("attributes") or {}).items():
            if isinstance(v, str):
                cat_keys.setdefault(k, []).append(v)

    n_swapped = 0
    n_to_swap = int(swap_fraction * len(out))
    for _ in range(n_to_swap):
        idx = int(rng.integers(0, len(out)))
        if not cat_keys:
            break
        attrs = out[idx].get("attributes") or {}
        # Pick a random categorical key actually present on this entity
        present_cat = [k for k in attrs.keys() if k in cat_keys]
        if not present_cat:
            continue
        k = present_cat[int(rng.integers(0, len(present_cat)))]
        new_v = cat_keys[k][int(rng.integers(0, len(cat_keys[k])))]
        attrs[k] = new_v
        n_swapped += 1
    return out, {"perturbation": "categorical_swap", "n_swapped": n_swapped, "swap_fraction": swap_fraction}
