#!/usr/bin/env python3
"""
Receipt run orchestrator.

Reads:
  - scripts/receipt_prompt.txt
  - scripts/receipt_schema.json
  - <filings_index_path>.json (from scripts/receipt_harvest.py)

For each filing in deterministic order (sorted by filing_id):
  1. Read filing text, verify corpus_sha256 matches the index
  2. Call Anthropic API with prompt + schema + filing_text
  3. Capture output JSON, compute output_sha256
  4. Mint receipt: receipt_hash = sha256(prev_receipt_hash || prompt_hash ||
     schema_hash || corpus_sha256 || model_id || timestamp || output_sha256)
  5. Append to receipts.ndjson

After all filings:
  6. chain_head = last receipt_hash
  7. Anchor chain_head with OpenTimeStamps -> showcases/receipt.chainhead.ots
  8. Compose /data/formed_models/_public/sec_edgar.json (full artifact)
  9. Compose /data/formed_models/_public/sec_edgar_chain.json (chain only)

For unit tests of the chain logic (mint_chain / chain_head / verify_chain),
the API call is not exercised; those primitives are pure functions over
pre-computed output_sha256 values.

Usage:
  ANTHROPIC_API_KEY=sk-ant-... python scripts/receipt_run.py \\
      --filings-index /opt/latentocean/data/formed_models/_inputs/sec_edgar_filings_index.json \\
      --filings-dir /tmp/sec_edgar_filings/ \\
      --output /opt/latentocean/data/formed_models/_public/sec_edgar.json \\
      --chain-output /opt/latentocean/data/formed_models/_public/sec_edgar_chain.json \\
      --receipts-log /opt/latentocean/data/formed_models/_audit/receipts.ndjson \\
      --ots-output showcases/receipt.chainhead.ots \\
      --model claude-sonnet-4-6-20250929
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import subprocess
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS))
from receipt_hash import derive_hash  # noqa: E402

PROMPT_PATH = _SCRIPTS / "receipt_prompt.txt"
SCHEMA_PATH = _SCRIPTS / "receipt_schema.json"


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def canonical_json(obj) -> bytes:
    """Canonical JSON: sorted keys, no whitespace, UTF-8."""
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def mint_chain(
    inputs: list[dict],
    *,
    prompt_hash: str,
    schema_hash: str,
    model_id: str,
) -> list[dict]:
    """Pure function. Given a list of pre-computed call records (each with
    filing_id, corpus_sha256, output_sha256, timestamp), produce the
    matching list of receipts with prev_receipt_hash linked correctly.
    """
    out: list[dict] = []
    prev: str | None = None
    for inp in inputs:
        rh = derive_hash(
            prev_receipt_hash=prev,
            prompt_hash=prompt_hash,
            schema_hash=schema_hash,
            corpus_sha256=inp["corpus_sha256"],
            model_id=model_id,
            timestamp=inp["timestamp"],
            output_sha256=inp["output_sha256"],
        )
        out.append({
            "filing_id":         inp["filing_id"],
            "prev_receipt_hash": prev,
            "prompt_hash":       prompt_hash,
            "schema_hash":       schema_hash,
            "corpus_sha256":     inp["corpus_sha256"],
            "model_id":          model_id,
            "timestamp":         inp["timestamp"],
            "output_sha256":     inp["output_sha256"],
            "receipt_hash":      rh,
        })
        prev = rh
    return out


def chain_head(receipts: list[dict]) -> str:
    """Chain head = last receipt's receipt_hash. Empty string if no receipts."""
    return receipts[-1]["receipt_hash"] if receipts else ""


def verify_chain(
    receipts: list[dict],
    *,
    prompt_hash: str,
    schema_hash: str,
    model_id: str,
) -> tuple[bool, str | None]:
    """Re-derive each receipt_hash and check the chain links.
    Returns (True, None) on success, (False, error_message) on first failure."""
    prev: str | None = None
    for i, r in enumerate(receipts):
        if r.get("prev_receipt_hash") != prev:
            return (False, f"receipt {i} prev_receipt_hash mismatch: expected {prev}, got {r.get('prev_receipt_hash')}")
        derived = derive_hash(
            prev_receipt_hash=prev,
            prompt_hash=prompt_hash,
            schema_hash=schema_hash,
            corpus_sha256=r["corpus_sha256"],
            model_id=model_id,
            timestamp=r["timestamp"],
            output_sha256=r["output_sha256"],
        )
        if derived != r.get("receipt_hash"):
            return (False, f"receipt {i} receipt_hash mismatch: derived {derived[:16]}..., stored {r.get('receipt_hash', '')[:16]}...")
        prev = r["receipt_hash"]
    return (True, None)


def call_anthropic(prompt_text: str, schema_text: str, filing_text: str, model_id: str) -> tuple[dict, str, dict]:
    """Call the Anthropic API. Returns (output_json, output_text, tokens).

    Schema-noncompliant outputs are stored as {"_raw": text, "_schema_compliant": False}
    so the receipt is over the bytes that came back, even when malformed.
    """
    try:
        import anthropic  # type: ignore
    except ImportError:
        raise RuntimeError("anthropic SDK not installed; run: pip install anthropic")
    client = anthropic.Anthropic()
    user_content = (
        prompt_text
        + "\n\nSCHEMA:\n" + schema_text
        + "\n\nFILING TEXT:\n" + filing_text
    )
    response = client.messages.create(
        model=model_id,
        max_tokens=2048,
        messages=[{"role": "user", "content": user_content}],
    )
    output_text = response.content[0].text
    try:
        output_json = json.loads(output_text)
    except json.JSONDecodeError:
        output_json = {"_raw": output_text, "_schema_compliant": False}
    tokens = {"input": response.usage.input_tokens, "output": response.usage.output_tokens}
    return output_json, output_text, tokens


def ots_stamp(chain_head_hex: str, ots_output: Path) -> bool:
    """Anchor the chain head with OpenTimeStamps. Returns True on success.
    Requires the `ots` CLI on PATH (`pip install opentimestamps-client`).
    Writes the proof to ots_output.
    """
    ots_output.parent.mkdir(parents=True, exist_ok=True)
    tmp = ots_output.parent / ".chainhead.txt"
    tmp.write_text(chain_head_hex + "\n")
    try:
        subprocess.run(
            ["ots", "stamp", str(tmp)],
            capture_output=True, timeout=60,
        )
        produced = Path(str(tmp) + ".ots")
        if produced.exists():
            produced.rename(ots_output)
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return False


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Receipt run orchestrator.")
    p.add_argument("--filings-index", required=True, type=Path)
    p.add_argument("--filings-dir", required=True, type=Path,
                   help="Directory containing the per-filing .txt files referenced by the index.")
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--chain-output", required=True, type=Path)
    p.add_argument("--receipts-log", required=True, type=Path)
    p.add_argument("--ots-output", default="showcases/receipt.chainhead.ots", type=Path)
    p.add_argument("--model", default="claude-sonnet-4-6-20250929")
    p.add_argument("--dry-run", action="store_true",
                   help="Skip Anthropic calls; emit synthetic outputs for testing the chain logic end-to-end.")
    args = p.parse_args(argv)

    prompt_text = PROMPT_PATH.read_text()
    schema_text = SCHEMA_PATH.read_text()
    prompt_hash = file_sha256(PROMPT_PATH)
    schema_hash = file_sha256(SCHEMA_PATH)

    index = json.loads(args.filings_index.read_text())
    filings = index["filings"]

    print(f"Receipt run starting: {len(filings)} filings, model={args.model}")
    print(f"  prompt_hash: {prompt_hash}")
    print(f"  schema_hash: {schema_hash}")

    inputs: list[dict] = []
    summaries: dict[str, dict] = {}
    args.receipts_log.parent.mkdir(parents=True, exist_ok=True)

    for i, filing in enumerate(filings, start=1):
        filing_id = filing["filing_id"]
        filing_path = args.filings_dir / filing["filing_text_path"]
        filing_text = filing_path.read_text()
        corpus_sha = file_sha256(filing_path)
        if corpus_sha != filing["corpus_sha256"]:
            print(f"  [{i}/{len(filings)}] {filing_id}: corpus_sha256 mismatch; skipping")
            continue
        timestamp = datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
        if args.dry_run:
            output_json = {"_dry_run": True, "filing_id": filing_id}
            tokens = {"input": 0, "output": 0}
        else:
            output_json, _output_text, tokens = call_anthropic(
                prompt_text, schema_text, filing_text, args.model,
            )
        output_sha = hashlib.sha256(canonical_json(output_json)).hexdigest()
        inputs.append({
            "filing_id":     filing_id,
            "corpus_sha256": corpus_sha,
            "output_sha256": output_sha,
            "timestamp":     timestamp,
        })
        summaries[filing_id] = {"summary": output_json, "tokens": tokens}
        print(f"  [{i}/{len(filings)}] {filing_id}: ok ({tokens['input']} in / {tokens['output']} out)")

    receipts = mint_chain(inputs, prompt_hash=prompt_hash, schema_hash=schema_hash, model_id=args.model)
    head = chain_head(receipts)

    with args.receipts_log.open("w", encoding="utf-8", newline="\n") as f:
        for r in receipts:
            f.write(json.dumps(r, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
            f.write("\n")

    ots_ok = ots_stamp(head, args.ots_output) if head else False

    receipts_by_id = {r["filing_id"]: r for r in receipts}
    filings_with_summary = []
    for f in filings:
        fid = f["filing_id"]
        rec = receipts_by_id.get(fid, {})
        summ = summaries.get(fid, {})
        filings_with_summary.append({**f, **summ, **rec})

    artifact = {
        "showcase":     "receipt",
        "ran_at":       datetime.datetime.utcnow().isoformat(timespec="milliseconds") + "Z",
        "model_id":     args.model,
        "prompt_hash":  prompt_hash,
        "schema_hash":  schema_hash,
        "n_filings":    len(filings),
        "n_receipts":   len(receipts),
        "chain_head":   head,
        "ots_anchored": ots_ok,
        "ots_file":     "showcases/receipt.chainhead.ots" if ots_ok else None,
        "filings":      filings_with_summary,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, indent=2))

    chain_only = {
        "showcase":    "receipt-chain",
        "chain_head":  head,
        "n_receipts":  len(receipts),
        "model_id":    args.model,
        "prompt_hash": prompt_hash,
        "schema_hash": schema_hash,
        "receipts":    receipts,
    }
    args.chain_output.parent.mkdir(parents=True, exist_ok=True)
    args.chain_output.write_text(json.dumps(chain_only, indent=2))

    print(f"\nchain_head: {head}")
    print(f"OTS anchor: {'ok' if ots_ok else 'skipped (ots CLI unavailable or empty chain)'}")
    print(f"wrote {args.output}")
    print(f"wrote {args.chain_output}")
    print(f"wrote {args.receipts_log}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
