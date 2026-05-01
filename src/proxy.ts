import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/about",
  "/terms",
  "/privacy",
  "/contact",
  "/blog(.*)",
  "/changelog",
  "/docs(.*)",
  "/tutorials(.*)",
  "/pricing",
  "/explore",
  "/explore/(.*)",
  "/refund",
  "/acceptable-use",
  // ALL API routes are public at the middleware level.
  // Each route handler calls auth() internally and returns proper
  // JSON 401 responses. Blocking here causes HTML 404s instead.
  "/api/(.*)",
]);

// Next.js 16 uses "proxy" convention (renamed from middleware)
const handler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const proxy = handler;
export default handler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
