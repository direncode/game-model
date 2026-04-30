/**
 * Internal auth for Range — no third-party SDK, no external service.
 *
 * Token format (issued tokens):
 *   rng.<base64url(payload)>.<base64url(hmac_sha256(payload, secret))>
 *
 *   payload = JSON {
 *     "v": 1,
 *     "user_id": string,
 *     "tenant_id": string,
 *     "role":     "viewer" | "operator" | "admin",
 *     "iat":      epoch_ms,
 *     "exp":      epoch_ms,
 *     "kid":      key fingerprint (first 12 hex of HMAC secret sha256)
 *   }
 *
 * Secret resolution (in order):
 *   1. RANGE_AUTH_SECRET env (base64 or arbitrary string -> sha256 to 32 bytes)
 *   2. /data/formed_models/_keys/auth.secret  (auto-generated on first use)
 *
 * An optional master admin token can be set via RANGE_ADMIN_TOKEN env;
 * callers may pass it via Authorization: Bearer to act as a built-in
 * admin tenant ("tenant_admin"). This is a backstop for break-glass
 * access and for the operator UI's first run.
 *
 * Anonymous mode: if RANGE_REQUIRE_AUTH != "1" and no token is sent, the
 * caller is treated as the "anon" tenant. Useful for demos. Set
 * RANGE_REQUIRE_AUTH=1 in production to deny anonymous.
 */

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { modelsRoot } from "./paths";

export type Role = "viewer" | "operator" | "admin";

export type RangeIdentity = {
  user_id: string;
  tenant_id: string;
  role: Role;
  is_anonymous: boolean;
  ip?: string;
  user_agent?: string;
  reason?: string;
  token_kid?: string;          // truncated key fingerprint for telemetry
};

const REQUIRE = process.env.RANGE_REQUIRE_AUTH === "1";

// ---------- Secret management ----------

let cachedSecret: Buffer | null = null;
async function authSecret(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret;
  const env = process.env.RANGE_AUTH_SECRET;
  if (env) {
    cachedSecret = crypto.createHash("sha256").update(env).digest();
    return cachedSecret;
  }
  const dir = path.join(modelsRoot(), "_keys");
  const file = path.join(dir, "auth.secret");
  try {
    const buf = await fs.readFile(file);
    if (buf.length >= 16) {
      cachedSecret = crypto.createHash("sha256").update(buf).digest();
      return cachedSecret;
    }
  } catch { /* generate */ }
  await fs.mkdir(dir, { recursive: true });
  const fresh = crypto.randomBytes(48);
  await fs.writeFile(file, fresh, { mode: 0o600 });
  cachedSecret = crypto.createHash("sha256").update(fresh).digest();
  return cachedSecret;
}

export async function secretKid(): Promise<string> {
  const s = await authSecret();
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
}

// ---------- Token issue / verify ----------

function b64url(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export type IssueOpts = {
  user_id: string;
  tenant_id: string;
  role?: Role;
  ttl_hours?: number;
};

export async function issueToken(opts: IssueOpts): Promise<{ token: string; kid: string; exp: number }> {
  const secret = await authSecret();
  const now = Date.now();
  const ttl = (opts.ttl_hours ?? 24 * 30) * 3600 * 1000; // default 30 days
  const exp = now + ttl;
  const kid = await secretKid();
  const payload = {
    v: 1, user_id: opts.user_id, tenant_id: opts.tenant_id,
    role: opts.role ?? "operator",
    iat: now, exp, kid,
  };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = b64url(Buffer.from(payloadStr, "utf-8"));
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = b64url(sig);
  return { token: `rng.${payloadB64}.${sigB64}`, kid, exp };
}

type VerifiedPayload = {
  v: number; user_id: string; tenant_id: string;
  role: Role; iat: number; exp: number; kid: string;
};

async function verifyToken(token: string): Promise<VerifiedPayload | null> {
  if (!token.startsWith("rng.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, payloadB64, sigB64] = parts;
  const secret = await authSecret();
  const expect = b64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  if (!timingSafeEq(expect, sigB64)) return null;
  let payload: VerifiedPayload;
  try { payload = JSON.parse(fromB64url(payloadB64).toString("utf-8")) as VerifiedPayload; }
  catch { return null; }
  if (payload.v !== 1) return null;
  if (typeof payload.exp === "number" && payload.exp < Date.now()) return null;
  return payload;
}

function timingSafeEq(a: string, b: string): boolean {
  const aB = Buffer.from(a); const bB = Buffer.from(b);
  if (aB.length !== bB.length) return false;
  return crypto.timingSafeEqual(aB, bB);
}

// ---------- Resolve identity from a request ----------

export async function resolveIdentity(req: Request): Promise<RangeIdentity> {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || undefined;
  const ua = req.headers.get("user-agent") || undefined;

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;

  // Master admin token backstop
  const adminToken = process.env.RANGE_ADMIN_TOKEN;
  if (bearer && adminToken && timingSafeEq(bearer, adminToken)) {
    return {
      user_id: "admin", tenant_id: "tenant_admin", role: "admin",
      is_anonymous: false, ip, user_agent: ua,
      reason: "master-admin-token",
    };
  }

  // HMAC-issued token
  if (bearer) {
    const v = await verifyToken(bearer);
    if (v) {
      return {
        user_id: v.user_id, tenant_id: v.tenant_id, role: v.role,
        is_anonymous: false, ip, user_agent: ua,
        reason: "issued-token", token_kid: v.kid,
      };
    }
    // Bearer present but invalid -> deny intent
    return {
      user_id: "anonymous", tenant_id: "anon", role: "viewer",
      is_anonymous: true, ip, user_agent: ua,
      reason: "invalid-or-expired-token",
    };
  }

  // No token: anonymous (gated by RANGE_REQUIRE_AUTH downstream)
  return {
    user_id: "anonymous", tenant_id: "anon", role: "viewer",
    is_anonymous: true, ip, user_agent: ua,
    reason: "no-token",
  };
}

export function denyResponse(reason: string): Response {
  return new Response(JSON.stringify({ error: "auth required", reason }), {
    status: 401,
    headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer realm=\"Range\"" },
  });
}

export function shouldDeny(id: RangeIdentity): boolean {
  // If auth is required, deny anonymous and deny invalid-token attempts
  return REQUIRE && id.is_anonymous;
}

export function requireRole(id: RangeIdentity, role: Role): boolean {
  const order: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };
  return order[id.role] >= order[role];
}
