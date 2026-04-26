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
  // API routes with their own auth (webhooks, crons, public endpoints)
  "/api/health",
  "/api/explore",
  "/api/explore/(.*)",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  "/api/brain/webhook",
  "/api/v1/(.*)",
  "/api/og",
  "/api/proxy-image",
  "/api/assets/(.*)",
  "/api/loadshedding",
  "/api/share/(.*)",
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
