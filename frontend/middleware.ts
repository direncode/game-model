import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes that don't require authentication
//
// /dunc(.*) is intentionally public so thebigdunc.com can iframe the
// embed view at /dunc/embed/[id] without a Clerk session. The D-U-N-C
// vertical runs a separate, in-app role switch (manager vs technical_staff);
// real RBAC will gate it when the Clerk roles integration lands.
const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/register(.*)",
  "/forgot-password(.*)",
  "/reset-password(.*)",
  "/verify-email(.*)",
  "/sso-callback(.*)",
  "/api(.*)",
  "/dunc(.*)",
]);

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
