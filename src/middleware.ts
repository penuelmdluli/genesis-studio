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
  "/robots",
  "/sitemap",
  "/opengraph-image",
  "/twitter-image",
];

// ── Edge caching configuration ──────────────────────────────────
// Static marketing pages: 5 min edge cache, 10 min stale-while-revalidate
const STATIC_MARKETING_PATHS = new Set([
  "/",
  "/pricing",
  "/terms",
  "/privacy",
  "/docs",
  "/tutorials",
  "/blog",
  "/changelog",
  "/about",
  "/contact",
]);

const STATIC_MARKETING_PREFIXES = ["/blog/"];

const MARKETING_CACHE =
  "public, s-maxage=300, stale-while-revalidate=600";

// Explore page: 1 min edge cache (content changes more often)
const EXPLORE_CACHE =
  "public, s-maxage=60, stale-while-revalidate=300";

function getCacheControl(pathname: string): string | null {
  // Explore page (exact match only — /explore/* sub-paths are public but
  // may be user-specific, so only cache the index)
  if (pathname === "/explore") return EXPLORE_CACHE;

  // Static marketing pages
  if (STATIC_MARKETING_PATHS.has(pathname)) return MARKETING_CACHE;
  if (STATIC_MARKETING_PREFIXES.some((p) => pathname.startsWith(p)))
    return MARKETING_CACHE;

  // Everything else: no edge caching added
  return null;
}

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function handler(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Auth gate ──────────────────────────────────────────────────
  if (!isPublicRoute(pathname)) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", pathname);
      return NextResponse.redirect(signInUrl);
    }
    // Authenticated page — never edge-cache
    return NextResponse.next();
  }

  // ── Public route — apply edge caching headers ──────────────────
  const response = NextResponse.next();
  const cacheControl = getCacheControl(pathname);
  if (cacheControl) {
    response.headers.set("Cache-Control", cacheControl);
    // Cloudflare CDN-Cache-Control for explicit CDN-layer control
    response.headers.set("CDN-Cache-Control", cacheControl);
  }

  return response;
}

export const middleware = handler;
export default handler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
