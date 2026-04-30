import { NextResponse } from "next/server";
import { resolveIdentity } from "@/lib/range/auth";
import { keyFingerprint } from "@/lib/range/encryption";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/range-identity
// Returns the current caller identity + tenant + crypto posture.
// Used by the operator UI's tenant info panel.
export async function GET(req: Request) {
  const ident = await resolveIdentity(req);
  const enc_kfp = await keyFingerprint().catch(() => null);
  return NextResponse.json({
    user_id: ident.user_id,
    tenant_id: ident.tenant_id,
    is_anonymous: ident.is_anonymous,
    auth_reason: ident.reason,
    auth_required: process.env.RANGE_REQUIRE_AUTH === "1",
    encryption: {
      at_rest: true,                 // always on once a key is provisioned
      algo: "aes-256-gcm",
      key_fingerprint: enc_kfp,      // sha256 prefix of the master key (NOT the key)
    },
    btut_bridge_url: process.env.BTUT_BRIDGE_URL || null,
    runpod_available: !!(process.env.RUNPOD_API_KEY && process.env.RUNPOD_ENDPOINT_ID),
  }, { headers: { "Cache-Control": "no-store" } });
}
