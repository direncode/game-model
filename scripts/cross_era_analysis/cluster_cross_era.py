"""Cluster the cross-era corpus using feature vectors.

Pure-numpy k-means clustering with full pairwise distance analysis.
Reports which documents cluster with Tesla's US1119732 regardless of date.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


OUTPUT_DIR = Path(__file__).parent / "output"


def load_features() -> tuple[list[dict], np.ndarray, list[str]]:
    with open(OUTPUT_DIR / "features.json", "r", encoding="utf-8") as f:
        docs = json.load(f)

    feature_names = sorted(docs[0]["features"].keys())
    X = np.array(
        [[d["features"][k] for k in feature_names] for d in docs],
        dtype=np.float64,
    )
    return docs, X, feature_names


def normalize(X: np.ndarray) -> np.ndarray:
    """Z-score normalize features so scales don't dominate distance."""
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0] = 1.0
    return (X - mean) / std


def pairwise_distances(X: np.ndarray) -> np.ndarray:
    """Euclidean distance matrix."""
    n = X.shape[0]
    D = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            d = np.linalg.norm(X[i] - X[j])
            D[i, j] = d
            D[j, i] = d
    return D


def kmeans(X: np.ndarray, k: int, seed: int = 42) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = X.shape[0]
    idx = rng.choice(n, size=k, replace=False)
    centroids = X[idx].copy()
    assignments = np.zeros(n, dtype=np.int64)
    for _ in range(100):
        d2 = ((X[:, None, :] - centroids[None, :, :]) ** 2).sum(axis=2)
        new_assignments = d2.argmin(axis=1)
        if np.array_equal(new_assignments, assignments):
            break
        assignments = new_assignments
        for c in range(k):
            mask = assignments == c
            if mask.any():
                centroids[c] = X[mask].mean(axis=0)
    return assignments


def main() -> None:
    docs, X, feature_names = load_features()
    print(f"Loaded {len(docs)} documents, {len(feature_names)} features")
    print(f"Features: {feature_names}\n")

    X_norm = normalize(X)

    # === 1. Pairwise distance analysis ===
    D = pairwise_distances(X_norm)

    # Find US1119732 in the corpus
    target_idx = None
    for i, d in enumerate(docs):
        if "1119732" in d["id"] or "Wardenclyffe" in d.get("title", ""):
            target_idx = i
            break
    if target_idx is None:
        print("WARNING: US1119732 not found in corpus — using index 0 as anchor")
        target_idx = 0

    target = docs[target_idx]
    print(f"=== NEAREST NEIGHBORS OF {target['id']} ({target.get('title', '')}) ===")
    distances = [(i, D[target_idx, i]) for i in range(len(docs)) if i != target_idx]
    distances.sort(key=lambda x: x[1])
    for rank, (i, d) in enumerate(distances[:15], 1):
        doc = docs[i]
        year = doc.get("year", "?")
        era_gap = ""
        if isinstance(year, int) and isinstance(target.get("year"), int):
            gap = abs(year - target["year"])
            era_gap = f" (d{gap}y)"
        print(
            f"  {rank:2d}. dist={d:.3f}  [{year}{era_gap}] {doc['id']:40s} "
            f"{doc.get('title', '')[:50]}"
        )

    # === 2. K-means clustering ===
    print("\n=== K-MEANS CLUSTERING (k=4) ===")
    assignments = kmeans(X_norm, k=min(4, len(docs)))
    clusters: dict[int, list[int]] = {}
    for i, c in enumerate(assignments):
        clusters.setdefault(int(c), []).append(i)

    for cid in sorted(clusters):
        members = clusters[cid]
        years = [docs[i].get("year") for i in members if isinstance(docs[i].get("year"), int)]
        year_range = f"{min(years)}-{max(years)}" if years else "?"
        print(f"\nCluster {cid}: {len(members)} docs, year range {year_range}")
        for i in members:
            doc = docs[i]
            marker = " <-- TARGET" if i == target_idx else ""
            print(f"  [{doc.get('year', '?')}] {doc['id']:40s} {doc.get('title', '')[:45]}{marker}")

    # === 3. Temporal gap analysis ===
    print("\n=== CROSS-ERA CLUSTER DETECTION ===")
    target_cluster = assignments[target_idx]
    same_cluster = [i for i in range(len(docs)) if assignments[i] == target_cluster and i != target_idx]
    target_year = target.get("year")
    if isinstance(target_year, int):
        cross_era = [i for i in same_cluster
                     if isinstance(docs[i].get("year"), int)
                     and abs(docs[i]["year"] - target_year) > 50]
        print(f"Documents in same cluster as {target['id']}:")
        for i in same_cluster:
            doc = docs[i]
            year = doc.get("year", "?")
            gap = abs(year - target_year) if isinstance(year, int) else "?"
            is_cross_era = isinstance(year, int) and gap > 50
            marker = " [CROSS-ERA]" if is_cross_era else ""
            print(f"  [{year}] d{gap}y: {doc['id']}{marker}")
        if cross_era:
            print(f"\n*** CROSS-ERA CLUSTERING DETECTED: {len(cross_era)} docs from >50y away")
            print("*** This is the predicted signature of content-independent structural similarity")
        else:
            print("\nNo cross-era clustering detected in this corpus")

    # === 4. Save full report ===
    report = {
        "target": target,
        "feature_names": feature_names,
        "pairwise_distances_to_target": [
            {"id": docs[i]["id"], "year": docs[i].get("year"), "dist": D[target_idx, i]}
            for i in range(len(docs))
        ],
        "clusters": {
            str(cid): [docs[i]["id"] for i in members]
            for cid, members in clusters.items()
        },
    }
    with open(OUTPUT_DIR / "clustering_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to {OUTPUT_DIR / 'clustering_report.json'}")


if __name__ == "__main__":
    main()
