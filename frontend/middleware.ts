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

export default function middleware(request: NextRequest) {
  // Auth is handled client-side via the AuthProvider in Providers.tsx.
  // This middleware just passes through — route protection is in the React tree.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
