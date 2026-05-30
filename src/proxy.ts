// ============================================
// GENESIS STUDIO — Edge Middleware
// ============================================
// Lightweight auth check: only verifies session cookie exists.
// Full session validation happens in API routes via getAuthUserId().
// Runs on Edge runtime for Cloudflare Pages compatibility.

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "gs_session";

const PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/terms",
  "/privacy",
  "/contact",
  "/changelog",
  "/pricing",
  "/explore",
  "/refund",
  "/acceptable-use",
]);

const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/blog",
  "/docs",
  "/tutorials",
  "/explore/",
  "/api/",
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function handler(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check session cookie exists (full validation in API routes)
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const proxy = handler;
export default handler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
