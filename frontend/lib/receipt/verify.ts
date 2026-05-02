/**
 * Receipt-hash derivation primitive (TypeScript twin of scripts/receipt_hash.py).
 *
 * MUST produce byte-identical output to the Python implementation. The
 * Python tests in tests/scripts/test_receipt_hash.py are authoritative;
 * if you change the concatenation order or sentinel here, change it there
 * too and verify both produce identical hashes on the same input.
 *
 * Hash algorithm: SHA-256 via crypto.subtle.digest.
 * Field separator: pipe character "|".
 * Genesis sentinel: literal string "GENESIS" when prev_receipt_hash is null.
 * Field order: prev_receipt_hash | prompt_hash | schema_hash | corpus_sha256 | model_id | timestamp | output_sha256
 */

const GENESIS = "GENESIS";

export type ReceiptInput = {
  prev_receipt_hash: string | null;
  prompt_hash: string;
  schema_hash: string;
  corpus_sha256: string;
  model_id: string;
  timestamp: string;
  output_sha256: string;
};

export function deriveConcat(input: ReceiptInput): string {
  return [
    input.prev_receipt_hash ?? GENESIS,
    input.prompt_hash,
    input.schema_hash,
    input.corpus_sha256,
    input.model_id,
    input.timestamp,
    input.output_sha256,
  ].join("|");
}

export async function deriveHash(input: ReceiptInput): Promise<string> {
  const concat = deriveConcat(input);
  const buf = new TextEncoder().encode(concat);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type Receipt = ReceiptInput & {
  receipt_hash: string;
  filing_id?: string;
};

/**
 * Verify a single receipt: re-derive its hash and compare to the published value.
 */
export async function verifyReceipt(receipt: Receipt): Promise<{ ok: boolean; derived: string; expected: string }> {
  const derived = await deriveHash({
    prev_receipt_hash: receipt.prev_receipt_hash,
    prompt_hash: receipt.prompt_hash,
    schema_hash: receipt.schema_hash,
    corpus_sha256: receipt.corpus_sha256,
    model_id: receipt.model_id,
    timestamp: receipt.timestamp,
    output_sha256: receipt.output_sha256,
  });
  return { ok: derived === receipt.receipt_hash, derived, expected: receipt.receipt_hash };
}

/**
 * Verify an entire chain of receipts. Returns the index of the first failure
 * (or null on success), plus a human-readable error message.
 */
export async function verifyChain(receipts: Receipt[]): Promise<{ ok: boolean; failedAt: number | null; error: string | null }> {
  let prev: string | null = null;
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (r.prev_receipt_hash !== prev) {
      return {
        ok: false, failedAt: i,
        error: `receipt ${i} prev_receipt_hash mismatch: expected ${prev ?? "GENESIS"}, got ${r.prev_receipt_hash ?? "GENESIS"}`,
      };
    }
    const v = await verifyReceipt(r);
    if (!v.ok) {
      return {
        ok: false, failedAt: i,
        error: `receipt ${i} hash mismatch: derived ${v.derived.slice(0, 16)}..., stored ${v.expected.slice(0, 16)}...`,
      };
    }
    prev = r.receipt_hash;
  }
  return { ok: true, failedAt: null, error: null };
}
