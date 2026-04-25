import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
//
// /dunc(.*) is intentionally public so thebigdunc.com can iframe the
// embed view at /dunc/embed/[id] without an auth session. The D-U-N-C
// vertical runs a separate, in-app role switch (manager vs technical_staff);
// real RBAC will gate it when the roles integration lands.
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/sso-callback",
  "/api",
  "/dunc",
];

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const NATO_SIM_COOKIE = "nato_sim_session";

function natoSimGate(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const expected = process.env.NATO_SIM_ACCESS_CODE;
  if (!expected) {
    return new NextResponse(
      "NATO_SIM_ACCESS_CODE is not configured on the server",
      { status: 503 },
    );
  }
  const cookieVal = request.cookies.get(NATO_SIM_COOKIE)?.value;
  if (cookieVal === expected) return NextResponse.next();

  const queryCode = searchParams.get("code");
  if (queryCode === expected) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("code");
    const res = NextResponse.redirect(url);
    res.cookies.set(NATO_SIM_COOKIE, expected, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24,
      path: "/nato-sim",
    });
    return res;
  }

  return new NextResponse(
    `<!doctype html><html><body style="background:#000;color:#a3a3a3;font-family:JetBrains Mono,monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center;max-width:32rem">
<div style="color:#f85149;letter-spacing:.3em;font-size:11px;text-transform:uppercase;margin-bottom:14px">403 // Access Code Required</div>
<div style="font-size:12px;line-height:1.7">
append <code style="color:#00d4ff">?code=&lt;CODE&gt;</code> to the URL<br>
<span style="color:#555">NATO Simulation — INR Station · Latent Ocean</span>
</div>
</div></body></html>`,
    { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/nato-sim")) {
    return natoSimGate(request);
  }
  // Auth is handled client-side via the AuthProvider in Providers.tsx.
  // This middleware passes through for everything else — route protection
  // for the rest of the app lives in the React tree.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
