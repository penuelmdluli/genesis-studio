// ============================================
// Pages a visitor may browse without an account
// ============================================
// Visitors (including everyone arriving from an ad) can open the creative
// tools and see what they do. The account is asked for at the moment it is
// needed: when they press Generate / Create. Every API that spends credits or
// reads personal data still requires a session on its own, so opening these
// pages exposes nothing.
//
// Personal pages (gallery, settings, dashboard, admin, a specific series) stay
// behind sign-in.

export const GUEST_BROWSABLE_PATHS = new Set([
  "/dashboard",
  "/series",
  "/generate",
  "/tools",
  "/motion-control",
  "/talking-avatar",
  "/music-video",
  "/product-ads",
  "/voiceover",
  "/ai-singer",
  "/images",
  "/upscale",
  "/captions",
  "/thumbnails",
  "/brain",
  "/mimic",
  "/studio",
  "/react-studio",
  "/edit",
  "/pricing",
  "/grow",
  "/brain/templates",
]);

export function isGuestBrowsable(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return GUEST_BROWSABLE_PATHS.has(clean);
}
