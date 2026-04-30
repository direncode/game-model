/**
 * Encryption-at-rest for formed-model artifacts.
 *
 * AES-256-GCM with appliance-local key. Key is derived from
 * RANGE_ENCRYPTION_KEY env (base64 32 bytes) or from a stable file
 * secret at /data/formed_models/_keys/master.key.
 *
 * On-disk format for encrypted artifacts:
 *   <12 bytes IV> <16 bytes auth tag> <ciphertext>
 *   stored in <id>.range.enc
 *
 * Plain JSON files (.range.json) remain valid for backwards compat.
 * The store reads .range.enc preferentially; falls back to .range.json.
 */

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { modelsRoot } from "./paths";

const ALGO = "aes-256-gcm";
const KEY_ENV = "RANGE_ENCRYPTION_KEY";

let cachedKey: Buffer | null = null;

async function masterKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;
  const fromEnv = process.env[KEY_ENV];
  if (fromEnv) {
    const buf = Buffer.from(fromEnv, "base64");
    if (buf.length === 32) {
      cachedKey = buf;
      return buf;
    }
    // Hash whatever-length value to 32 bytes
    cachedKey = crypto.createHash("sha256").update(fromEnv).digest();
    return cachedKey;
  }
  // Fall back to a per-appliance master.key file
  const keyDir = path.join(modelsRoot(), "_keys");
  const keyFile = path.join(keyDir, "master.key");
  try {
    const buf = await fs.readFile(keyFile);
    if (buf.length === 32) {
      cachedKey = buf;
      return buf;
    }
  } catch { /* generate */ }
  await fs.mkdir(keyDir, { recursive: true });
  const fresh = crypto.randomBytes(32);
  await fs.writeFile(keyFile, fresh, { mode: 0o600 });
  cachedKey = fresh;
  return fresh;
}

export async function isEncryptionEnabled(): Promise<boolean> {
  // Always enabled — we generate a key on first use.
  await masterKey();
  return true;
}

export async function encrypt(plaintext: string): Promise<Buffer> {
  const key = await masterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export async function decrypt(blob: Buffer): Promise<string> {
  const key = await masterKey();
  if (blob.length < 28) throw new Error("encrypted blob too short");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf-8");
}

// Quick fingerprint of the key (NOT the key itself) for telemetry
export async function keyFingerprint(): Promise<string> {
  const k = await masterKey();
  return crypto.createHash("sha256").update(k).digest("hex").slice(0, 16);
}
