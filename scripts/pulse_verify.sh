#!/bin/bash
# Pulse post-formation verification.
#
# After /api/range-form completes for the pulse_showcase tenant, this:
#   1. lists models for pulse_showcase tenant
#   2. fires all 7 query intents against the model
#   3. re-issues each query, confirms byte-identical response_digest
#   4. mints a probe tenant token and confirms cross-tenant 404
#   5. pulls the audit log in JSON, CEF, and OCSF formats
#   6. emits a JSON summary suitable for the /news entry
#
# Direct port of scripts/docsouth_verify.sh; only structural changes are
# tenant token path, model-name regex, and output paths.
#
# Requires:  /tmp/.pulsetoken (pulse_showcase bearer)
# Output:    /tmp/pulse_summary.json

set -e
BASE="${LO_BASE_URL:-https://www.latentocean.com}"
PULSETOK=$(cat /tmp/.pulsetoken)

# 1. List models
echo "=== 1. List models for pulse_showcase tenant ==="
LIST=$(curl -sk -H "Authorization: Bearer $PULSETOK" "$BASE/api/range-form")
MODEL_ID=$(echo "$LIST" | python -c "import sys,json;d=json.load(sys.stdin);ms=d.get('models',[]);print([m for m in ms if 'Pulse' in m['name'] or 'uspto' in m['name'].lower()][0]['id'] if any('Pulse' in m['name'] or 'uspto' in m['name'].lower() for m in ms) else (ms[0]['id'] if ms else ''))" 2>/dev/null)
if [ -z "$MODEL_ID" ]; then
  echo "  ERROR: no Atlas model found"; exit 1
fi
echo "  model_id: $MODEL_ID"
echo "$LIST" | python -c "import sys,json;d=json.load(sys.stdin);ms=d.get('models',[]);[print('  ',m['id'],'·',m['name'][:60],'·',m['corpus_records'],'records ·',m['fingerprinter_mode']) for m in ms]"

# 2. Pull full meta
echo ""
echo "=== 2. Full model meta ==="
META=$(curl -sk -H "Authorization: Bearer $PULSETOK" "$BASE/api/range-form/$MODEL_ID")
echo "$META" | python -c "
import sys, json
m = json.load(sys.stdin)
print(f\"  id:                    {m.get('id')}\")
print(f\"  corpus_records:        {m.get('corpus_records'):,}\")
print(f\"  corpus_bytes:          {m.get('corpus_bytes'):,}\")
print(f\"  fingerprinter_mode:    {m.get('fingerprinter_mode')}\")
print(f\"  effective_strategy:    {m.get('effective_strategy','n/a')}\")
print(f\"  coverage_pct:          {m.get('coverage_pct','n/a')}\")
print(f\"  formation_ms:          {m.get('formation_ms','n/a'):,}\" if m.get('formation_ms') else '  formation_ms: n/a')
print(f\"  response_digest:       {m.get('response_digest','n/a')[:32]}...\")
print(f\"  encrypted:             {m.get('encrypted','n/a')}\")
tx = m.get('taxonomy', {})
print(f\"  taxonomy.classes:      {len(tx.get('classes', []))}\")
print(f\"  taxonomy.silhouette:   {tx.get('silhouette','n/a')}\")
print(f\"  taxonomy.null_test_z:  {tx.get('null_test_z','n/a')}\")
print(f\"  taxonomy.novel_count:  {tx.get('novel_class_count','n/a')}\")
ac = m.get('adapter_chain', [])
if ac:
    print(f\"  adapter_chain:\")
    for a in ac: print(f\"    {a.get('strategy')}: tried={a.get('tried')} succeeded={a.get('succeeded')} covered={a.get('records_covered')} ms={a.get('ms')}\")
"

# 3. Run all 7 query intents (one query per intent, captures response_digest)
echo ""
echo "=== 3. Run all 7 query intents ==="
declare -A INTENTS=(
  ["what_is_rare"]="what are the most rare records in this corpus?"
  ["novel_classes"]="show me novel classes outside the three most populous"
  ["show_taxonomy"]="show the taxonomy and class sizes"
  ["describe_corpus"]="tell me about the corpus, fields, and entropy"
  ["compare_to_llm"]="how does this compare to an llm baseline?"
  ["summarize"]="summarize this formed model in one paragraph"
  ["lineage_trace"]="lineage trace"
)

declare -A FIRST_DIGESTS
for intent in what_is_rare novel_classes show_taxonomy describe_corpus compare_to_llm summarize lineage_trace; do
  Q="${INTENTS[$intent]}"
  RESP=$(curl -sk -H "Authorization: Bearer $PULSETOK" "$BASE/api/range-query?model_id=$MODEL_ID&q=$(python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$Q")")
  DIGEST=$(echo "$RESP" | python -c "import sys,json;d=json.load(sys.stdin);print(d.get('response_digest','ERR')[:32])" 2>/dev/null)
  WALL=$(echo "$RESP" | python -c "import sys,json;d=json.load(sys.stdin);print(d.get('wall_ms','?'))" 2>/dev/null)
  FIRST_DIGESTS[$intent]=$DIGEST
  echo "  [$intent] digest=$DIGEST wall=${WALL}ms"
done

# 4. Re-issue each query and confirm byte-identical digest
echo ""
echo "=== 4. Determinism — re-issue each query, compare digests ==="
PASS=0
FAIL=0
for intent in what_is_rare novel_classes show_taxonomy describe_corpus compare_to_llm summarize lineage_trace; do
  Q="${INTENTS[$intent]}"
  RESP=$(curl -sk -H "Authorization: Bearer $PULSETOK" "$BASE/api/range-query?model_id=$MODEL_ID&q=$(python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$Q")")
  DIGEST=$(echo "$RESP" | python -c "import sys,json;d=json.load(sys.stdin);print(d.get('response_digest','ERR')[:32])" 2>/dev/null)
  if [ "$DIGEST" = "${FIRST_DIGESTS[$intent]}" ]; then
    echo "  [$intent] match  ✓ ($DIGEST)"; PASS=$((PASS+1))
  else
    echo "  [$intent] DIVERGED ✗ first=${FIRST_DIGESTS[$intent]} second=$DIGEST"; FAIL=$((FAIL+1))
  fi
done
echo "  $PASS/7 byte-identical · $FAIL diverged"

# 5. Cross-tenant probe
echo ""
echo "=== 5. Multi-tenant isolation ==="
PROBE_TOK_RESP=$(curl -sk -X POST -H 'Content-Type: application/json' -d '{"color":"pulseprobe"}' "$BASE/api/range-demo-token")
PROBE_TOK=$(echo "$PROBE_TOK_RESP" | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
PROBE_TENANT=$(echo "$PROBE_TOK_RESP" | python -c "import sys,json;print(json.load(sys.stdin)['tenant_id'])")
PROBE_STATUS=$(curl -sk -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $PROBE_TOK" "$BASE/api/range-form/$MODEL_ID")
echo "  probe tenant: $PROBE_TENANT"
echo "  GET pulse_showcase model with probe token: $PROBE_STATUS (expect 404)"
SELF_STATUS=$(curl -sk -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $PULSETOK" "$BASE/api/range-form/$MODEL_ID")
echo "  GET pulse_showcase model with own token:   $SELF_STATUS (expect 200)"

# 6. Pull audit
echo ""
echo "=== 6. Audit log ==="
JSON_AUDIT=$(curl -sk -H "Authorization: Bearer $PULSETOK" "$BASE/api/range-audit?limit=20")
JSON_COUNT=$(echo "$JSON_AUDIT" | python -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('events',[])))" 2>/dev/null)
echo "  JSON: $JSON_COUNT events"
CEF_LINES=$(curl -sk -H "Authorization: Bearer $PULSETOK" "$BASE/api/range-audit?format=cef&limit=20" | wc -l)
echo "  CEF: $CEF_LINES lines"
OCSF_COUNT=$(curl -sk -H "Authorization: Bearer $PULSETOK" "$BASE/api/range-audit?format=ocsf&limit=20" | python -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('events',[])))" 2>/dev/null)
echo "  OCSF: $OCSF_COUNT events"

# 7. Public read endpoint sanity
echo ""
echo "=== 7. Public read endpoint sanity ==="
PUBLIC_STATUS=$(curl -sk -o /dev/null -w '%{http_code}' "$BASE/api/range-public/showcase/pulse")
echo "  GET /api/range-public/showcase/pulse: $PUBLIC_STATUS (expect 200)"

# 8. Emit summary
echo ""
echo "=== 8. Writing summary to /tmp/pulse_summary.json ==="
echo "$META" > /tmp/pulse_meta.json
cat > /tmp/pulse_summary.json <<JSON
{
  "showcase": "pulse",
  "model_id": "$MODEL_ID",
  "isolation": {
    "probe_status": $PROBE_STATUS,
    "self_status": $SELF_STATUS,
    "public_status": $PUBLIC_STATUS
  },
  "determinism": {
    "queries_total": 7,
    "queries_pass": $PASS,
    "queries_fail": $FAIL
  },
  "audit": {
    "json": $JSON_COUNT,
    "cef": $CEF_LINES,
    "ocsf": $OCSF_COUNT
  }
}
JSON
echo "  wrote /tmp/pulse_meta.json (model meta)"
echo "  wrote /tmp/pulse_summary.json"
echo ""
echo "DONE."
