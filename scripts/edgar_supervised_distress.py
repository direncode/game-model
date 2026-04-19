"""Supervised distress classifier trained on SEC-native ground-truth labels.

POSITIVE CLASS: companies that filed any of {10-K/A, 10-Q/A, NT 10-K, NT 10-Q}
— SEC form types indicating restatement or late filing. These are
the cleanest public ground-truth distress signals inside SEC filings.

NEGATIVE CLASS: companies with a 10-K but no distress form.

Features per company: aggregate statistics of BTUT scores across its facts
(mean, max, p90 of composite/anomaly/reconstruction/diversity; count of
facts appearing in global top-K; etc.). Zero hand-tuning — features are
standard aggregates.

Classifier: sklearn LogisticRegression with L2. Stratified 5-fold CV.
Evaluation: ROC AUC, precision @ top-K, recall @ top-K.
"""
from __future__ import annotations

import json
import random
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, average_precision_score, precision_recall_curve

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_CACHE = REPO_ROOT / "scripts" / "edgar_cache.json"
BTUT_5000 = REPO_ROOT / "scripts" / "edgar_btut_result_5000.json"

DISTRESS_FORMS = {"10-K/A", "10-Q/A", "NT 10-K", "NT 10-Q"}
NEGATIVE_ANCHOR_FORMS = {"10-K"}  # must have filed a 10-K to be a negative candidate

_FACT_RE = re.compile(r"^fact_(\d+)_(.+)$")


def _name(s): return ((s.get("entity") or {}).get("name")) or ""
def _cik_from_fact(n):
    m = _FACT_RE.match(n)
    return m.group(1) if m else None


def main() -> int:
    raw = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    btut = json.loads(BTUT_5000.read_text(encoding="utf-8"))
    survivors = btut.get("survivors") or []

    # 1. Build labels from filings.
    cik_forms: dict[str, set[str]] = defaultdict(set)
    cik_to_name: dict[str, str] = {}
    for e in raw.get("entities", []):
        if e.get("type") != "filing":
            continue
        attrs = e.get("attributes", "{}")
        if isinstance(attrs, str):
            try:
                attrs = json.loads(attrs)
            except Exception:
                continue
        cik = str(attrs.get("company_cik", "") or "")
        form = (attrs.get("form") or "").strip()
        name = attrs.get("company_name") or ""
        if cik and form:
            cik_forms[cik].add(form)
        if cik and name:
            cik_to_name.setdefault(cik, name)

    positive_ciks = {cik for cik, forms in cik_forms.items()
                     if forms & DISTRESS_FORMS}
    negative_ciks = {cik for cik, forms in cik_forms.items()
                     if (forms & NEGATIVE_ANCHOR_FORMS) and not (forms & DISTRESS_FORMS)}

    print(f"Positive label CIKs (filed a distress form): {len(positive_ciks)}")
    print(f"Negative label CIKs (filed 10-K, no distress form): {len(negative_ciks)}")

    # 2. For each labeled CIK, extract BTUT fact scores.
    cik_facts: dict[str, list[dict]] = defaultdict(list)
    for s in survivors:
        name = _name(s)
        cik = _cik_from_fact(name)
        if cik:
            cik_facts[cik].append(s)

    # Compute global top-K sets (top 100 composite across all fact survivors)
    fact_survs = [s for s in survivors if _cik_from_fact(_name(s))]
    top100_names = set()
    fact_survs_sorted = sorted(fact_survs,
                                key=lambda s: (s.get("scores") or {}).get("composite", 0.0),
                                reverse=True)
    for s in fact_survs_sorted[:100]:
        top100_names.add(_name(s))

    def _feat_vec(cik: str) -> list[float]:
        facts = cik_facts.get(cik, [])
        if not facts:
            return [0.0] * 13
        dims = ["composite", "anomaly", "reconstruction", "diversity"]
        feats: list[float] = []
        for d in dims:
            vals = [float((s.get("scores") or {}).get(d, 0.0)) for s in facts]
            feats.extend([
                statistics.mean(vals),
                max(vals),
                (sorted(vals)[int(0.9 * (len(vals) - 1))] if len(vals) > 1 else vals[0]),
            ])
        # Count, top-100 count, top-100 fraction
        top_count = sum(1 for s in facts if _name(s) in top100_names)
        feats.append(len(facts))
        feats.append(top_count)
        feats.append(top_count / max(1, len(facts)))
        return feats

    # 3. Build X, y
    labeled = [(cik, 1) for cik in positive_ciks if cik in cik_facts] + \
              [(cik, 0) for cik in negative_ciks if cik in cik_facts]

    print(f"CIKs with both label and BTUT facts: {len(labeled)} "
          f"({sum(y for _, y in labeled)} positive, "
          f"{sum(1 for _, y in labeled if y == 0)} negative)")

    X = np.array([_feat_vec(c) for c, _ in labeled])
    y = np.array([lbl for _, lbl in labeled])

    # 4. Cross-validated AUC
    print("\nStratified 5-fold CV...")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    aucs = []
    aps = []
    prec_at_10 = []
    rec_at_10 = []
    all_probs = np.zeros_like(y, dtype=float)
    for fold, (tr, te) in enumerate(skf.split(X, y)):
        clf = LogisticRegression(
            class_weight="balanced", max_iter=500, solver="lbfgs",
            random_state=42,
        )
        clf.fit(X[tr], y[tr])
        probs = clf.predict_proba(X[te])[:, 1]
        all_probs[te] = probs
        auc = roc_auc_score(y[te], probs)
        ap = average_precision_score(y[te], probs)
        aucs.append(auc)
        aps.append(ap)
        # precision/recall @ top-10 in the fold
        order = np.argsort(-probs)
        k = min(10, len(order))
        top_k_labels = y[te][order[:k]]
        prec_at_10.append(top_k_labels.sum() / k)
        rec_at_10.append(top_k_labels.sum() / max(1, y[te].sum()))
        print(f"  fold {fold+1}: AUC={auc:.3f}  AP={ap:.3f}  prec@10={prec_at_10[-1]:.2f}  "
              f"rec@10={rec_at_10[-1]:.2f}")

    mean_auc = float(np.mean(aucs))
    mean_ap = float(np.mean(aps))
    print(f"\n  CV mean:   AUC={mean_auc:.3f} (+- {np.std(aucs):.3f})  "
          f"AP={mean_ap:.3f}  prec@10={np.mean(prec_at_10):.2f}  "
          f"rec@10={np.mean(rec_at_10):.2f}")

    # 5. Null baseline: shuffle y, run same CV.
    print("\nNull baseline (100 label-shuffle runs)...")
    rng = random.Random(42)
    null_aucs = []
    for _ in range(100):
        y_shuf = y.copy()
        idx = list(range(len(y_shuf)))
        rng.shuffle(idx)
        y_shuf = y_shuf[idx]
        fold_aucs = []
        for tr, te in skf.split(X, y_shuf):
            clf = LogisticRegression(class_weight="balanced", max_iter=200, solver="lbfgs")
            clf.fit(X[tr], y_shuf[tr])
            probs = clf.predict_proba(X[te])[:, 1]
            fold_aucs.append(roc_auc_score(y_shuf[te], probs))
        null_aucs.append(float(np.mean(fold_aucs)))

    null_mean = float(np.mean(null_aucs))
    null_p95 = float(np.percentile(null_aucs, 95))
    null_p99 = float(np.percentile(null_aucs, 99))
    print(f"  null AUC: mean={null_mean:.3f}  p95={null_p95:.3f}  p99={null_p99:.3f}")
    print(f"  True AUC {mean_auc:.3f} vs null p95 {null_p95:.3f}  "
          f"{'SIGNIFICANT p<0.05' if mean_auc > null_p95 else 'not significant'}  |  "
          f"vs null p99 {null_p99:.3f}  "
          f"{'p<0.01' if mean_auc > null_p99 else ''}")

    # 6. Top-20 highest-predicted companies + whether they actually filed distress forms
    print("\nTop-20 most-at-risk companies by the classifier:")
    order = np.argsort(-all_probs)
    top_entries = []
    for i in order[:20]:
        cik = labeled[i][0]
        entry = {
            "company": cik_to_name.get(cik, f"CIK {cik}"),
            "cik": cik,
            "probability": round(float(all_probs[i]), 4),
            "actual_label": int(y[i]),
            "distress_forms": sorted(cik_forms[cik] & DISTRESS_FORMS),
        }
        top_entries.append(entry)
        check = "[DISTRESS]" if entry["actual_label"] == 1 else ""
        print(f"  p={entry['probability']:.3f}  {entry['company'][:42]:<42s}  {check}")

    # 7. Save report
    out = {
        "ground_truth_source": "SEC form filings (10-K/A, 10-Q/A, NT 10-K, NT 10-Q)",
        "positive_class_count": len(positive_ciks),
        "positive_in_btut": int(sum(y)),
        "negative_in_btut": int(sum(1 for lbl in y if lbl == 0)),
        "total_labeled": len(labeled),
        "cv_mean_auc": round(mean_auc, 4),
        "cv_std_auc": round(float(np.std(aucs)), 4),
        "cv_mean_ap": round(mean_ap, 4),
        "cv_prec_at_10": round(float(np.mean(prec_at_10)), 4),
        "cv_rec_at_10": round(float(np.mean(rec_at_10)), 4),
        "null_auc_mean": round(null_mean, 4),
        "null_auc_p95": round(null_p95, 4),
        "null_auc_p99": round(null_p99, 4),
        "significant_at_0_05": mean_auc > null_p95,
        "significant_at_0_01": mean_auc > null_p99,
        "top_20_predictions": top_entries,
    }
    out_path = REPO_ROOT / "data" / "validation" / "edgar_supervised_distress.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, sort_keys=True, default=str), encoding="utf-8")
    print(f"\n  Report: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
