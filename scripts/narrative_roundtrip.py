"""End-to-end narrative eval.

POST each fixture bundle to /api/narrative, capture the generator's
actual output (whichever provider the Next.js app is configured for),
grade each narrative for hallucination, and report aggregate metrics.

This is the round-trip test that catches regressions the hand-crafted
eval can't: an LLM update, a prompt drift, a model swap, etc.

Exit codes:
    0 — all narratives grade non-hallucinated
    2 — at least one narrative flagged as hallucinated
    3 — unable to reach the endpoint (server not running)
    4 — protocol / parse error from server
    5 — fixture invalid

Usage:
    # With Next.js dev server running:
    python scripts/narrative_roundtrip.py

    # Against a different URL:
    python scripts/narrative_roundtrip.py --url http://localhost:3030/api/narrative

    # Different fixture:
    python scripts/narrative_roundtrip.py \
        --fixture lo_nlp/data/eval_narrative_fixture_large.json

The Next.js server must set LO_NARRATIVE_MODE appropriately:
    off       — returns deterministic template (safe floor; use as CI gate)
    ollama    — requires Ollama running with LO_OLLAMA_MODEL available
    anthropic — requires ANTHROPIC_API_KEY
    openai    — requires OPENAI_API_KEY
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from lo_nlp.eval_narrative import (  # noqa: E402
    check_entity_grounded,
    check_length_ok,
    check_marketing_free,
    check_no_external_causation,
    check_numeric_fidelity,
    auto_label,
)

DEFAULT_FIXTURE = REPO / "lo_nlp" / "data" / "eval_narrative_fixture.json"
DEFAULT_URL = "http://localhost:3000/api/narrative"


def post_bundle(url: str, bundle: dict, timeout: float = 30.0, auth: str = "") -> dict:
    body = json.dumps(bundle).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = auth
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read().decode("utf-8", errors="replace")
    return json.loads(data)


def grade(narrative: str, bundle: dict) -> dict:
    numeric_ok, uncited = check_numeric_fidelity(narrative, bundle)
    length_ok, n_sents = check_length_ok(narrative)
    marketing_free, mkt_hits = check_marketing_free(narrative)
    entity_grounded = check_entity_grounded(narrative, bundle)
    no_causation, cause_hits = check_no_external_causation(narrative)
    label = auto_label(numeric_ok, length_ok, marketing_free, entity_grounded, no_causation)
    return {
        "auto_label": label,
        "numeric_fidelity": numeric_ok,
        "uncited_numbers": uncited,
        "length_ok": length_ok,
        "n_sentences": n_sents,
        "marketing_free": marketing_free,
        "marketing_hits": mkt_hits,
        "entity_grounded": entity_grounded,
        "no_external_causation": no_causation,
        "causation_hits": cause_hits,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="End-to-end narrative eval via live endpoint")
    ap.add_argument("--fixture", default=str(DEFAULT_FIXTURE))
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--out", default="narrative_roundtrip_out.json")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--fail-fast", action="store_true",
                    help="Stop at first hallucinated narrative")
    ap.add_argument("--timeout", type=float, default=30.0)
    ap.add_argument("--auth", default="",
                    help="Authorization header value (e.g. 'Bearer <token>') if the endpoint is gated")
    args = ap.parse_args()

    try:
        fixture = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[rt] failed to load fixture: {e}")
        return 5

    # Quick reachability check.
    # Distinguish:
    #   - connection refused / DNS / timeout → "server not running" (exit 3)
    #   - HTTP 4xx/5xx → "reachable but rejected" (exit 3 with diag)
    probe_bundle = {
        "entity_raw": "fact_320193_Revenue",
        "entity_resolved": "Apple Inc. \u00b7 Revenue",
        "composite": 0.5, "anomaly": 0.5,
        "reconstruction": 0.5, "diversity": 0.5,
    }
    try:
        probe = post_bundle(args.url, probe_bundle, timeout=args.timeout, auth=args.auth)
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")[:200]
        except Exception:
            pass
        print(f"[rt] endpoint reachable at {args.url} but returned HTTP {e.code}")
        if body:
            print(f"[rt] response body: {body}")
        if e.code in (401, 403):
            print("[rt] likely behind auth — pass --auth 'Bearer <token>' "
                  "or point at the unauthenticated Next.js dev server directly")
        return 3
    except urllib.error.URLError as e:
        print(f"[rt] cannot reach {args.url} — is the Next.js dev server running?")
        print(f"[rt] underlying: {e}")
        return 3
    except Exception as e:
        print(f"[rt] probe failed: {e}")
        return 3

    print(f"[rt] endpoint reachable; provider={probe.get('provider')} "
          f"fallback_used={probe.get('fallback_used')}")

    per_item: list[dict] = []
    t0 = time.time()
    for i, item in enumerate(fixture):
        bundle = item["bundle"]
        try:
            resp = post_bundle(args.url, bundle, timeout=args.timeout)
        except Exception as e:
            print(f"[rt] bundle {i} ({item.get('id', '?')}) failed: {e}")
            return 4

        narrative = resp.get("narrative") or ""
        provider = resp.get("provider")
        fallback = bool(resp.get("fallback_used"))
        # If server's own validator rejected, LO returned the template;
        # useful signal to keep in the per-item record.
        server_citations_ok = resp.get("citations_ok", True)

        g = grade(narrative, bundle)
        row = {
            "id": item.get("id"),
            "provider": provider,
            "fallback_used": fallback,
            "server_citations_ok": server_citations_ok,
            "narrative": narrative,
            "gold_label": item.get("gold_label"),
            **g,
        }
        per_item.append(row)
        if args.verbose:
            flag = "HALLUCINATED" if g["auto_label"] == "hallucinated" else "ok"
            print(f"  [{i:>3}] {flag:<14} id={item.get('id'):<32} provider={provider} "
                  f"fallback={fallback} sents={g['n_sentences']}")
        if args.fail_fast and g["auto_label"] == "hallucinated":
            print(f"[rt] --fail-fast: first hallucination at bundle {i}")
            break

    dt = time.time() - t0
    n = len(per_item)
    halluc = sum(1 for r in per_item if r["auto_label"] == "hallucinated")
    providers = Counter(r["provider"] for r in per_item)
    fallbacks = sum(1 for r in per_item if r["fallback_used"])

    print()
    print(f"[rt] n={n}  hallucinated={halluc}/{n}  fallbacks={fallbacks}/{n}  "
          f"elapsed={dt:.1f}s")
    print(f"[rt] providers: {dict(providers)}")
    if halluc:
        print(f"[rt] hallucination rate: {halluc/n:.1%}")
        print(f"[rt] auto-flagged ids:")
        for r in per_item:
            if r["auto_label"] == "hallucinated":
                issues = []
                if not r["numeric_fidelity"]:
                    issues.append(f"nums_uncited={r['uncited_numbers']}")
                if not r["marketing_free"]:
                    issues.append(f"mkt={r['marketing_hits']}")
                if not r["entity_grounded"]:
                    issues.append("entity_ungrounded")
                if not r["no_external_causation"]:
                    issues.append(f"causation={r['causation_hits']}")
                print(f"    {r['id']}: {', '.join(issues) if issues else 'unknown'}")

    summary = {
        "n": n,
        "hallucinated": halluc,
        "fallbacks": fallbacks,
        "elapsed_sec": round(dt, 1),
        "providers": dict(providers),
        "per_item": per_item,
    }
    Path(args.out).write_text(json.dumps(summary, indent=2), encoding="utf-8")

    return 0 if halluc == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
