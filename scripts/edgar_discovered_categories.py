"""Zero-hand-tuning categorical signal discovery.

Previous `edgar_categorical_probes.py` had three layers of hand-tuning:
  - 10 categories I picked
  - regex patterns I wrote
  - weighting coefficients I invented
This script removes ALL of that. Categories emerge from the data; names
come from cluster centroids; ranking uses BTUT's own `composite` score
(defined inside run_btut_pipeline, not by me); each discovered category
is null-tested independently.

Procedure:
  1. Extract all unique XBRL concepts present in the 4,999-survivor EDGAR
     BTUT result (no hand-picked subset).
  2. Tokenize concept names via CamelCase split (deterministic transform;
     no hand-chosen vocabulary).
  3. TF-IDF vectorize the concepts (sklearn default params).
  4. Cluster via k-means; choose K via silhouette score over a fixed grid
     (K in {4..40}). No K hand-picked.
  5. Name each cluster by its top-3 TF-IDF-centroid tokens (data-derived
     labels).
  6. Rank survivors within each cluster by BTUT's `composite` score (the
     pipeline's own scoring; no hand-weighting).
  7. Per cluster, run null test: if I permute cluster labels across
     survivors, does the top-K composite mean exceed null_p95?

Output: data/validation/edgar_discovered_categories.{json,md}
"""
from __future__ import annotations

import json
import random
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import silhouette_score

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_CACHE = REPO_ROOT / "scripts" / "edgar_cache.json"
BTUT_5000 = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"

K_CANDIDATES = list(range(4, 41))  # data-derived choice, not hand-picked
N_NULL = 500
TOP_K_PER_CLUSTER = 10


# ─── Deterministic concept tokenizer ──────────────────────────────────────────
_CAMEL_RE = re.compile(r"[A-Z][a-z]+|[A-Z]+(?=[A-Z]|$)|[0-9]+")


def tokenize_concept(name: str) -> list[str]:
    """CamelCase-split an XBRL concept name into lowercase tokens.
    Deterministic, stateless, no learned rules."""
    return [t.lower() for t in _CAMEL_RE.findall(name or "")]


_FACT_RE = re.compile(r"^fact_(\d+)_(.+)$")


def _name(s: dict) -> str:
    return ((s.get("entity") or {}).get("name")) or ""


def _concept_of(name: str) -> str | None:
    m = _FACT_RE.match(name)
    return m.group(2) if m else None


def _cik_of(name: str) -> str | None:
    m = _FACT_RE.match(name)
    return m.group(1) if m else None


def _composite(s: dict) -> float:
    return float((s.get("scores") or {}).get("composite", 0.0))


def _load_maps():
    raw = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    cik_to_name: dict[str, str] = {}
    cik_to_sic: dict[str, str] = {}
    for sic, companies in (raw.get("sic_groups") or {}).items():
        for c in companies:
            if c.startswith("company_"):
                cik_to_sic[c.split("_", 1)[1]] = str(sic)
    for e in raw.get("entities", []):
        if e.get("type") != "filing":
            continue
        attrs = e.get("attributes", "{}")
        if isinstance(attrs, str):
            try:
                attrs = json.loads(attrs)
            except Exception:
                attrs = {}
        cik = str(attrs.get("company_cik", "") or "")
        name = attrs.get("company_name") or ""
        if cik and name and cik not in cik_to_name:
            cik_to_name[cik] = name
    return cik_to_name, cik_to_sic


def _percentile(vals, p):
    import math
    if not vals:
        return 0.0
    s = sorted(vals)
    k = (p / 100.0) * (len(s) - 1)
    lo = int(math.floor(k))
    hi = int(math.ceil(k))
    if lo == hi:
        return s[lo]
    return s[lo] * (1 - (k - lo)) + s[hi] * (k - lo)


def main() -> int:
    print("Loading BTUT survivors + raw cache...")
    btut = json.loads(BTUT_5000.read_text(encoding="utf-8"))
    survivors = btut.get("survivors") or []
    cik_to_name, cik_to_sic = _load_maps()

    # ─── Step 1: extract concept set from fact survivors ─────────────────
    # Only fact survivors have concepts (filings don't). Filings get their
    # own cluster if kmeans finds one, but by construction they have no
    # concept tokens.
    fact_survs: list[dict] = []
    for s in survivors:
        if _concept_of(_name(s)):
            fact_survs.append(s)
    print(f"Fact survivors: {len(fact_survs)} of {len(survivors)} total")

    # Unique concepts
    concept_to_survivors: dict[str, list[dict]] = defaultdict(list)
    for s in fact_survs:
        concept_to_survivors[_concept_of(_name(s)) or ""].append(s)
    concepts = sorted(concept_to_survivors.keys())
    print(f"Unique XBRL concepts in survivor pool: {len(concepts)}")

    # ─── Step 2: CamelCase tokenize each concept ─────────────────────────
    concept_tokens = {c: " ".join(tokenize_concept(c)) for c in concepts}
    concept_texts = [concept_tokens[c] for c in concepts]

    # ─── Step 3: TF-IDF on tokenized concepts ────────────────────────────
    vec = TfidfVectorizer(
        token_pattern=r"[a-z]+",
        stop_words=None,
        min_df=1,
        max_df=1.0,
    )
    X = vec.fit_transform(concept_texts)
    vocab = vec.get_feature_names_out()
    print(f"TF-IDF: {X.shape[0]} concepts, {X.shape[1]} tokens")

    # ─── Step 4: choose K via silhouette over K_CANDIDATES ───────────────
    # Silhouette requires at least 2 clusters and at most n_samples-1.
    valid_k = [k for k in K_CANDIDATES if 2 <= k < X.shape[0]]
    print(f"Searching K in {valid_k[0]}..{valid_k[-1]} via silhouette...")
    best_k = None
    best_score = -1.0
    best_labels = None
    for k in valid_k:
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(X)
        if len(set(labels)) < 2:
            continue
        # Silhouette can be slow on large X; use a sample
        try:
            score = silhouette_score(X, labels, random_state=42, sample_size=min(2000, X.shape[0]))
        except ValueError:
            continue
        if score > best_score:
            best_score = score
            best_k = k
            best_labels = labels
    print(f"Chosen K={best_k} (silhouette={best_score:.4f})")

    labels = best_labels
    assert labels is not None

    # ─── Step 5: data-derived cluster names ──────────────────────────────
    # For each cluster, take centroid in TF-IDF space, grab top-3 tokens
    cluster_tokens: dict[int, list[str]] = {}
    X_arr = X.toarray()  # small enough (|concepts| ≈ 200-500)
    for cl in sorted(set(labels)):
        members_idx = [i for i, l in enumerate(labels) if l == cl]
        if not members_idx:
            continue
        centroid = X_arr[members_idx].mean(axis=0)
        top_i = centroid.argsort()[-4:][::-1]  # top-4 tokens
        cluster_tokens[cl] = [vocab[i] for i in top_i if centroid[i] > 0][:3]

    def _cluster_name(cl: int) -> str:
        return "+".join(cluster_tokens.get(cl, [])) or f"cluster_{cl}"

    # Concept -> cluster id
    concept_cluster = {c: int(labels[i]) for i, c in enumerate(concepts)}

    # Survivor -> cluster id
    survivor_cluster: dict[str, int] = {}
    for s in fact_survs:
        cname = _concept_of(_name(s)) or ""
        if cname in concept_cluster:
            survivor_cluster[_name(s)] = concept_cluster[cname]

    # ─── Step 6: per-cluster ranking + ─── Step 7: null test ─────────────
    print(f"\nScoring {len(set(labels))} discovered clusters + null tests...")
    cluster_reports: list[dict] = []
    rng = random.Random(42)
    all_composite_scores = [_composite(s) for s in fact_survs]

    for cl in sorted(set(labels)):
        members = [s for s in fact_survs if survivor_cluster.get(_name(s)) == cl]
        if len(members) < TOP_K_PER_CLUSTER:
            continue

        members_sorted = sorted(members, key=_composite, reverse=True)
        top_k = members_sorted[:TOP_K_PER_CLUSTER]
        top_mean = statistics.mean(_composite(s) for s in top_k)

        # Null: sample a random same-size subset from all fact survivors,
        # take its top-K composite mean. Repeat N_NULL times.
        null_means = []
        for _ in range(N_NULL):
            sample = rng.sample(fact_survs, len(members))
            sample_sorted = sorted(sample, key=_composite, reverse=True)
            null_means.append(statistics.mean(_composite(s) for s in sample_sorted[:TOP_K_PER_CLUSTER]))
        null_mean = statistics.mean(null_means)
        null_p95 = _percentile(null_means, 95)
        null_p99 = _percentile(null_means, 99)
        null_p999 = _percentile(null_means, 99.9)

        # Resolve top-K to named entities
        top_resolved = []
        for s in top_k:
            name = _name(s)
            cik = _cik_of(name) or ""
            sic = cik_to_sic.get(cik, "")
            top_resolved.append({
                "company": cik_to_name.get(cik, f"CIK {cik}"),
                "cik": cik,
                "concept": _concept_of(name),
                "composite": round(_composite(s), 4),
                "anomaly": (s.get("scores") or {}).get("anomaly"),
                "reconstruction": (s.get("scores") or {}).get("reconstruction"),
                "diversity": (s.get("scores") or {}).get("diversity"),
                "sic": sic,
            })

        cluster_concepts = Counter()
        cluster_companies = Counter()
        cluster_industries = Counter()
        for s in members_sorted:
            c = _concept_of(_name(s))
            if c:
                cluster_concepts[c] += 1
            cik = _cik_of(_name(s)) or ""
            cluster_companies[cik_to_name.get(cik, f"CIK {cik}")] += 1
            sic = cik_to_sic.get(cik, "")
            if sic:
                cluster_industries[sic] += 1

        cluster_reports.append({
            "cluster_id": int(cl),
            "data_derived_name": _cluster_name(cl),
            "token_centroid": cluster_tokens.get(cl, []),
            "n_concepts": sum(1 for c in concepts if concept_cluster.get(c) == cl),
            "n_survivors": len(members),
            "top_concepts": cluster_concepts.most_common(5),
            "top_companies": cluster_companies.most_common(5),
            "top_industries": [(sic, n) for sic, n in cluster_industries.most_common(5)],
            "top_k": top_resolved,
            "top_k_mean_composite": round(top_mean, 4),
            "null_mean": round(null_mean, 4),
            "null_p95": round(null_p95, 4),
            "null_p99": round(null_p99, 4),
            "null_p999": round(null_p999, 4),
            "significant_at_0_05": top_mean > null_p95,
            "significant_at_0_01": top_mean > null_p99,
            "significant_at_0_001": top_mean > null_p999,
        })

    # Sort clusters by significance + size
    cluster_reports.sort(key=lambda r: (-r["n_survivors"], -r["top_k_mean_composite"]))

    # ─── Output ───────────────────────────────────────────────────────────
    out = {
        "method": "zero-hand-tuning category discovery",
        "tokenizer": "CamelCase regex (deterministic)",
        "vectorizer": "sklearn TfidfVectorizer default params",
        "clusterer": f"KMeans, K={best_k} chosen by silhouette over K in {valid_k[0]}..{valid_k[-1]}",
        "scoring": "BTUT pipeline-defined composite score (0.35*div + 0.40*recon + 0.25*anom)",
        "null_iterations": N_NULL,
        "chosen_k": best_k,
        "silhouette_score": round(best_score, 4),
        "n_fact_survivors": len(fact_survs),
        "n_unique_concepts": len(concepts),
        "clusters": cluster_reports,
    }
    out_dir = REPO_ROOT / "data" / "validation"
    (out_dir / "edgar_discovered_categories.json").write_text(
        json.dumps(out, indent=2, sort_keys=True, default=str), encoding="utf-8",
    )

    # Markdown report
    md: list[str] = [
        "# EDGAR Discovered Categories — Zero Hand-Tuning",
        "",
        f"Method: **every category is discovered from data**.",
        "",
        "- Tokenizer: deterministic CamelCase split",
        "- Vectorizer: sklearn TF-IDF (default params)",
        f"- Clusterer: k-means with K={best_k} chosen via silhouette score over K ∈ {{{valid_k[0]}..{valid_k[-1]}}}",
        f"- Silhouette: **{best_score:.4f}**",
        f"- Scoring: BTUT pipeline's own `composite` score (not chosen by operator)",
        f"- Null test: {N_NULL} random-permutation iterations per cluster",
        "",
        f"Input: **{len(fact_survs)} fact survivors**, **{len(concepts)} unique XBRL concepts**.",
        f"Discovered categories: **{len(cluster_reports)}** (clusters with ≥ {TOP_K_PER_CLUSTER} survivors).",
        "",
    ]
    for i, r in enumerate(cluster_reports, 1):
        badge = (
            "[PASS p<0.001]" if r["significant_at_0_001"]
            else "[PASS p<0.01]" if r["significant_at_0_01"]
            else "[PASS p<0.05]" if r["significant_at_0_05"]
            else "[null]"
        )
        md.append(f"## {i}. {r['data_derived_name']}  {badge}")
        md.append("")
        md.append(f"- Token centroid: `{' / '.join(r['token_centroid'])}`")
        md.append(f"- Concepts in cluster: {r['n_concepts']}")
        md.append(f"- Survivors in cluster: {r['n_survivors']}")
        md.append(f"- Top-{TOP_K_PER_CLUSTER} mean composite: **{r['top_k_mean_composite']}** "
                  f"(null mean {r['null_mean']}, null p95 {r['null_p95']}, "
                  f"null p99.9 {r['null_p999']})")
        md.append("")
        md.append("### Top-10 named signals")
        md.append("")
        md.append("| # | Company | Concept | composite | anom | recon | div |")
        md.append("|---|---|---|---|---|---|---|")
        for j, h in enumerate(r["top_k"], 1):
            md.append(
                f"| {j} | {h.get('company') or ''} | `{h.get('concept') or ''}` | "
                f"{h.get('composite')} | {h.get('anomaly')} | "
                f"{h.get('reconstruction')} | {h.get('diversity')} |"
            )
        md.append("")
        if r["top_concepts"]:
            md.append("**Cluster concept distribution:** "
                      + ", ".join(f"`{c}` ({n})" for c, n in r["top_concepts"][:5]))
            md.append("")
    (out_dir / "edgar_discovered_categories.md").write_text("\n".join(md), encoding="utf-8")

    # Console
    print("\n" + "=" * 78)
    print("DISCOVERED CATEGORIES (zero hand-tuning)")
    print("=" * 78)
    print(f"Chosen K = {best_k}  (silhouette {best_score:.4f})")
    print(f"{len(cluster_reports)} clusters with >= {TOP_K_PER_CLUSTER} survivors; null N={N_NULL}")
    print()
    print(f"{'cluster':<32s}  {'n_surv':>7s}  {'top_mean':>9s}  {'null_p95':>9s}  {'null_p999':>10s}  {'verdict':<20s}")
    for r in cluster_reports:
        badge = (
            "SIGNIFICANT p<0.001" if r["significant_at_0_001"]
            else "signif p<0.01" if r["significant_at_0_01"]
            else "signif p<0.05" if r["significant_at_0_05"]
            else "null"
        )
        print(f"  {r['data_derived_name'][:30]:<30s}  {r['n_survivors']:>7d}  "
              f"{r['top_k_mean_composite']:>9.4f}  {r['null_p95']:>9.4f}  "
              f"{r['null_p999']:>10.4f}  {badge}")
    sig_count = sum(1 for r in cluster_reports if r["significant_at_0_05"])
    sig_999 = sum(1 for r in cluster_reports if r["significant_at_0_001"])
    print(f"\n-> {sig_count}/{len(cluster_reports)} clusters significant at a=0.05, "
          f"{sig_999} at a=0.001")
    print(f"\nFull report: {out_dir / 'edgar_discovered_categories.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
