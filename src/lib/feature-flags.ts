// ============================================
// GENESIS STUDIO — Launch Feature Visibility
// Controls which features appear in navigation.
// Code remains — only UI visibility is toggled.
// ============================================

export const LAUNCH_VISIBLE_ROUTES: Record<string, boolean> = {
  "/dashboard": true,
  "/generate": true,
  "/brain": true,
  "/gallery": true,
  "/explore": true,
  "/voiceover": true,
  "/captions": true,
  "/pricing": true,
  "/settings": true,
  // Hidden for launch — code remains, UI hidden
  "/motion-control": false,
  "/talking-avatar": false,
  "/upscale": false,
  "/thumbnails": false,
  "/images": false,
  "/edit": false,
  "/collections": false,
  "/api-keys": false,
};

export function isRouteVisibleAtLaunch(href: string): boolean {
  return LAUNCH_VISIBLE_ROUTES[href] ?? true;
}
