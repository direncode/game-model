#!/usr/bin/env python3
"""
DocSouth post-formation verification.

Usage:  python3 docsouth_verify.py
Reads:  /tmp/doctoken
Writes: /tmp/docsouth_summary.json

Exercises:
  1. List models for docsouth_showcase tenant
  2. Pull the DocSouth model's full meta
  3. Run all 7 query intents
  4. Re-issue each query, confirm byte-identical response_digest
  5. Mint a demo probe token, confirm cross-tenant GET returns 404
  6. Pull audit log in JSON, CEF, OCSF formats
"""
from __future__ import annotations
import json
import sys
import time
import urllib.parse
import urllib.request
import ssl

BASE = "https://www.latentocean.com"
TOKEN_PATH = "/tmp/doctoken"
SUMMARY_PATH = "/tmp/docsouth_summary.json"
META_PATH    = "/tmp/docsouth_meta.json"

INTENTS = [
    ("what_is_rare",     "what are the most rare records in this corpus?"),
    ("novel_classes",    "show me novel classes outside the three most populous"),
    ("show_taxonomy",    "show the taxonomy and class sizes"),
    ("describe_corpus",  "tell me about the corpus, fields, and entropy"),
    ("compare_to_llm",   "how does this compare to an llm baseline?"),
    ("summarize",        "summarize this formed model in one paragraph"),
    ("lineage_trace",    "lineage trace"),
]

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"

def http(method: str, url: str, *, headers: dict | None = None, body: bytes | None = None,
         timeout: float = 60.0) -> tuple[int, bytes]:
    h = {"User-Agent": UA, "Accept": "application/json"}
    if headers: h.update(headers)
    req = urllib.request.Request(url, method=method, data=body, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def get_json(url: str, token: str, *, timeout: float = 60.0) -> tuple[int, dict]:
    code, raw = http("GET", url, headers={"Authorization": f"Bearer {token}"}, timeout=timeout)
    try: return code, json.loads(raw)
    except Exception: return code, {"_raw": raw[:200].decode("utf-8", "replace")}

def get_status(url: str, token: str) -> int:
    code, _ = http("GET", url, headers={"Authorization": f"Bearer {token}"})
    return code

def main() -> int:
    token = open(TOKEN_PATH).read().strip()
    summary: dict = {"started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    # 1. List models
    print("=== 1. List models for docsouth_showcase tenant ===")
    code, lst = get_json(f"{BASE}/api/range-form", token)
    if code != 200: print(f"  ERROR list status={code} body={lst}"); return 1
    models = lst.get("models", [])
    docsouth = [m for m in models if "DocSouth" in (m.get("name") or "")]
    if not docsouth:
        print(f"  ERROR no DocSouth model in {len(models)} returned"); return 1
    m = max(docsouth, key=lambda x: x.get("formed_at", ""))
    model_id = m["id"]
    print(f"  selected: {model_id}  .  {m['name']}")
    print(f"           records={m['corpus_records']:,}  fingerprinter={m.get('fingerprinter_mode')}  formation_ms={m.get('formation_ms','?'):,}")
    summary["model_id"] = model_id
    summary["model_name"] = m["name"]

    # 2. Full meta
    print("\n=== 2. Full model meta ===")
    code, meta = get_json(f"{BASE}/api/range-form/{model_id}", token)
    if code != 200: print(f"  ERROR meta status={code}"); return 1
    json.dump(meta, open(META_PATH, "w"), indent=2)
    print(f"  id:                    {meta.get('id')}")
    print(f"  corpus_records:        {meta.get('corpus_records'):,}")
    print(f"  corpus_bytes:          {meta.get('corpus_bytes'):,}")
    print(f"  corpus_format:         {meta.get('corpus_format')}")
    print(f"  fingerprinter_mode:    {meta.get('fingerprinter_mode')}")
    print(f"  effective_strategy:    {meta.get('effective_strategy','n/a')}")
    print(f"  coverage_pct:          {meta.get('coverage_pct','n/a')}")
    print(f"  formation_ms:          {meta.get('formation_ms','?'):,}")
    print(f"  response_digest:       {meta.get('response_digest','n/a')}")
    print(f"  encrypted:             {meta.get('encrypted','n/a')}")
    tx = meta.get("taxonomy", {})
    print(f"  taxonomy.classes:      {len(tx.get('classes', []))}")
    print(f"  taxonomy.silhouette:   {tx.get('silhouette','n/a')}")
    print(f"  taxonomy.null_test_z:  {tx.get('null_test_z','n/a')} sigma")
    print(f"  taxonomy.novel_count:  {tx.get('novel_class_count','n/a')}")
    chunked = meta.get("chunked", {})
    print(f"  chunked.total_chunks:  {chunked.get('total_chunks','n/a')}")
    print(f"  chunked.merged:        {chunked.get('merged','n/a')}")
    print(f"  adapter_chain:")
    for a in (meta.get("adapter_chain") or []):
        flag = "✓" if a.get("succeeded") else ("." if not a.get("tried") else "✗")
        print(f"    {flag} {a.get('strategy'):<14} tried={a.get('tried')!s:<5} covered={a.get('records_covered',0):>6}  ms={a.get('ms',0):>6}  reason={a.get('reason','')}")
    summary["meta"] = {
        "fingerprinter_mode":  meta.get("fingerprinter_mode"),
        "effective_strategy":  meta.get("effective_strategy"),
        "coverage_pct":        meta.get("coverage_pct"),
        "formation_ms":        meta.get("formation_ms"),
        "response_digest":     meta.get("response_digest"),
        "corpus_records":      meta.get("corpus_records"),
        "corpus_bytes":        meta.get("corpus_bytes"),
        "encrypted":           meta.get("encrypted"),
        "chunked":             meta.get("chunked"),
        "adapter_chain":       meta.get("adapter_chain"),
        "taxonomy_classes":    len(tx.get("classes", [])),
        "silhouette":          tx.get("silhouette"),
        "null_test_z":         tx.get("null_test_z"),
        "novel_class_count":   tx.get("novel_class_count"),
    }

    # 3. Run all 7 query intents
    print("\n=== 3. Run all 7 query intents ===")
    first_runs: dict = {}
    for intent, q in INTENTS:
        url = f"{BASE}/api/range-query?model_id={urllib.parse.quote(model_id)}&q={urllib.parse.quote(q)}"
        code, ans = get_json(url, token, timeout=120)
        if code != 200:
            print(f"  [{intent:<16}] HTTP {code}: {str(ans)[:120]}")
            first_runs[intent] = {"error": code}
            continue
        digest = ans.get("response_digest", "")
        wall = ans.get("wall_ms", "?")
        cits = len(ans.get("citations", []))
        first_runs[intent] = {
            "digest": digest,
            "wall_ms": wall,
            "answer": ans.get("answer", ""),
            "metrics": ans.get("metrics", {}),
            "citations": ans.get("citations", []),
        }
        print(f"  [{intent:<16}] digest={digest[:32]}...  wall={wall}ms  citations={cits}")

    # 4. Re-issue determinism check
    print("\n=== 4. Determinism — re-issue each query, verify byte-identical digest ===")
    pass_n = fail_n = 0
    determinism: dict = {}
    for intent, q in INTENTS:
        url = f"{BASE}/api/range-query?model_id={urllib.parse.quote(model_id)}&q={urllib.parse.quote(q)}"
        code, ans = get_json(url, token, timeout=120)
        if code != 200:
            print(f"  [{intent:<16}] HTTP {code} on re-issue")
            determinism[intent] = "error"; fail_n += 1
            continue
        d2 = ans.get("response_digest", "")
        d1 = first_runs.get(intent, {}).get("digest", "")
        match = d1 and d1 == d2
        determinism[intent] = "match" if match else "diverged"
        if match: pass_n += 1
        else:     fail_n += 1
        print(f"  [{intent:<16}] {'match  OK' if match else 'DIVERGED ✗'}  ({d2[:32]}...)")
    print(f"  -> {pass_n}/{len(INTENTS)} byte-identical . {fail_n} diverged")
    summary["determinism"] = {"pass": pass_n, "fail": fail_n, "intents": determinism}

    # 5. Cross-tenant probe
    print("\n=== 5. Multi-tenant isolation ===")
    code, probe = http("POST", f"{BASE}/api/range-demo-token",
                       headers={"Content-Type": "application/json"},
                       body=json.dumps({"color": "docsouthprobe"}).encode())
    if code != 200: print(f"  ERROR probe-token status={code}"); return 1
    probe = json.loads(probe)
    probe_token = probe["token"]; probe_tenant = probe["tenant_id"]
    print(f"  probe tenant: {probe_tenant}")
    foreign_status = get_status(f"{BASE}/api/range-form/{model_id}", probe_token)
    self_status    = get_status(f"{BASE}/api/range-form/{model_id}", token)
    print(f"  GET docsouth model with probe token: {foreign_status}  (expect 404)")
    print(f"  GET docsouth model with own token:   {self_status}  (expect 200)")
    summary["isolation"] = {"foreign_status": foreign_status, "self_status": self_status,
                            "isolation_holds": foreign_status == 404 and self_status == 200,
                            "probe_tenant": probe_tenant}

    # 6. Audit log in 3 formats
    print("\n=== 6. Audit log (3 formats) ===")
    code, j = http("GET", f"{BASE}/api/range-audit?limit=50",
                   headers={"Authorization": f"Bearer {token}"})
    j = json.loads(j) if code == 200 else {"events": []}
    json_count = len(j.get("events", []))
    code, cef_raw = http("GET", f"{BASE}/api/range-audit?format=cef&limit=50",
                         headers={"Authorization": f"Bearer {token}"})
    cef_lines = len([l for l in cef_raw.decode("utf-8", "replace").split("\n") if l])
    code, ocsf_raw = http("GET", f"{BASE}/api/range-audit?format=ocsf&limit=50",
                          headers={"Authorization": f"Bearer {token}"})
    ocsf_count = len(json.loads(ocsf_raw).get("events", [])) if code == 200 else 0
    print(f"  JSON: {json_count} events")
    print(f"  CEF:  {cef_lines} lines (Common Event Format, ArcSight/QRadar/Splunk)")
    print(f"  OCSF: {ocsf_count} events (Open Cybersecurity Schema Framework)")
    summary["audit"] = {"json": json_count, "cef": cef_lines, "ocsf": ocsf_count}
    # capture last 3 events
    summary["audit_sample"] = [
        {"ts": e.get("ts"), "action": e.get("action"), "result": e.get("result"),
         "tenant": e.get("actor", {}).get("tenant_id"),
         "digest": e.get("digest")}
        for e in (j.get("events", []) or [])[:3]
    ]
    summary["audit_cef_sample"] = cef_raw.decode("utf-8", "replace").split("\n", 1)[0][:300]

    # 7. Capture rare records and taxonomy for the news entry
    print("\n=== 7. Highlights for /news ===")
    rare_ans  = first_runs.get("what_is_rare",  {}).get("answer", "")
    novel_ans = first_runs.get("novel_classes", {}).get("answer", "")
    tax_ans   = first_runs.get("show_taxonomy", {}).get("answer", "")
    summary["highlights"] = {
        "rare":     rare_ans[:600],
        "novel":    novel_ans[:600],
        "taxonomy": tax_ans[:600],
        "first_digests": {k: v.get("digest") for k, v in first_runs.items()},
    }
    print("  rare answer head:    ", rare_ans[:120].replace("\n", " "), "...")
    print("  novel answer head:   ", novel_ans[:120].replace("\n", " "), "...")
    print("  taxonomy answer head:", tax_ans[:120].replace("\n", " "), "...")

    summary["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    json.dump(summary, open(SUMMARY_PATH, "w"), indent=2)
    print(f"\nWrote {SUMMARY_PATH}")
    print(f"Wrote {META_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
