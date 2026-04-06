import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/generate(.*)",
  "/gallery(.*)",
  "/api-keys(.*)",
  "/settings(.*)",
  "/brain(.*)",
  "/admin(.*)",
  "/motion-control(.*)",
  "/pricing(.*)",
  "/voiceover(.*)",
  "/talking-avatar(.*)",
  "/thumbnails(.*)",
  "/upscale(.*)",
  "/captions(.*)",
]);

const handler = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

// Next.js 16 uses "proxy" convention (renamed from middleware)
export const proxy = handler;
export default handler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
