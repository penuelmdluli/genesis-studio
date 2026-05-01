import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that require authentication — redirect to sign-in if not logged in
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/generate(.*)",
  "/gallery(.*)",
  "/brain(.*)",
  "/mimic(.*)",
  "/settings(.*)",
  "/collections(.*)",
  "/onboarding(.*)",
  "/api-keys(.*)",
  "/captions(.*)",
  "/voiceover(.*)",
  "/thumbnails(.*)",
  "/upscale(.*)",
  "/motion-control(.*)",
  "/talking-avatar(.*)",
  "/edit(.*)",
  "/images(.*)",
  "/intelligence(.*)",
  "/studio(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
