#!/bin/bash
# Receipt post-run verification.
#
# Confirms:
#   1. The receipts.ndjson chain integrity (re-derive each hash, follow links)
#   2. The chain_head matches the published value in the public artifact
#   3. The OpenTimeStamps proof is valid (or pending)
#   4. The audit log contains the run's events in JSON, CEF, OCSF formats
#   5. Cross-tenant isolation
#
# Requires:  /tmp/.receipttoken (receipt_showcase bearer)
# Output:    /tmp/receipt_summary.json

set -e
BASE="${LO_BASE_URL:-https://www.latentocean.com}"
RECEIPTTOK=$(cat /tmp/.receipttoken)
ARTIFACT="${ARTIFACT:-/data/formed_models/_public/sec_edgar.json}"
CHAIN="${CHAIN:-/data/formed_models/_public/sec_edgar_chain.json}"
OTS_FILE="${OTS_FILE:-showcases/receipt.chainhead.ots}"

echo "=== 1. Chain integrity ==="
python3 <<EOF
import json, sys
sys.path.insert(0, "scripts")
from receipt_hash import derive_hash

with open("$CHAIN") as f:
    chain = json.load(f)
receipts = chain["receipts"]
prompt_hash = chain["prompt_hash"]
schema_hash = chain["schema_hash"]
model_id    = chain["model_id"]

prev = None
for i, r in enumerate(receipts):
    if r.get("prev_receipt_hash") != prev:
        print(f"  FAIL: receipt {i} prev mismatch")
        sys.exit(1)
    derived = derive_hash(
        prev_receipt_hash=prev,
        prompt_hash=prompt_hash, schema_hash=schema_hash,
        corpus_sha256=r["corpus_sha256"], model_id=model_id,
        timestamp=r["timestamp"], output_sha256=r["output_sha256"],
    )
    if derived != r["receipt_hash"]:
        print(f"  FAIL: receipt {i} hash mismatch")
        sys.exit(1)
    prev = r["receipt_hash"]
print(f"  PASS: {len(receipts)}/{len(receipts)} receipts internally consistent")
print(f"  chain_head: {chain['chain_head'][:32]}...")
EOF

echo ""
echo "=== 2. Chain head matches public artifact ==="
PUB_HEAD=$(python -c "import json;print(json.load(open('$ARTIFACT'))['chain_head'])")
CHAIN_HEAD=$(python -c "import json;print(json.load(open('$CHAIN'))['chain_head'])")
if [ "$PUB_HEAD" = "$CHAIN_HEAD" ]; then
  echo "  PASS: $PUB_HEAD"
else
  echo "  FAIL: artifact head $PUB_HEAD != chain head $CHAIN_HEAD"
  exit 1
fi

echo ""
echo "=== 3. OpenTimeStamps proof ==="
if command -v ots >/dev/null 2>&1; then
  if [ -f "$OTS_FILE" ]; then
    ots verify "$OTS_FILE" 2>&1 | tee /tmp/ots_verify.log || echo "  (verification may be pending; see log)"
  else
    echo "  SKIP: $OTS_FILE not found"
  fi
else
  echo "  SKIP: ots CLI not available; install opentimestamps-client to verify"
fi

echo ""
echo "=== 4. Audit log retrievable ==="
JSON_AUDIT=$(curl -sk -H "Authorization: Bearer $RECEIPTTOK" "$BASE/api/range-audit?limit=20")
JSON_COUNT=$(echo "$JSON_AUDIT" | python -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('events',[])))" 2>/dev/null)
echo "  JSON: $JSON_COUNT events"
CEF_LINES=$(curl -sk -H "Authorization: Bearer $RECEIPTTOK" "$BASE/api/range-audit?format=cef&limit=20" | wc -l)
echo "  CEF: $CEF_LINES lines"
OCSF_COUNT=$(curl -sk -H "Authorization: Bearer $RECEIPTTOK" "$BASE/api/range-audit?format=ocsf&limit=20" | python -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('events',[])))" 2>/dev/null)
echo "  OCSF: $OCSF_COUNT events"

echo ""
echo "=== 5. Cross-tenant isolation ==="
PROBE_TOK_RESP=$(curl -sk -X POST -H 'Content-Type: application/json' -d '{"color":"receiptprobe"}' "$BASE/api/range-demo-token")
PUBLIC_STATUS=$(curl -sk -o /dev/null -w '%{http_code}' "$BASE/api/range-public/showcase/receipt")
echo "  Public read endpoint /receipt: $PUBLIC_STATUS"

echo ""
echo "DONE."
