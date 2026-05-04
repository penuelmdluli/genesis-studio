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
  "/mimic": true,
  "/motion-control": true,
  "/talking-avatar": true,
  "/upscale": true,
  "/thumbnails": true,
  "/images": true,
  "/brain/templates": true,
  "/collections": true,
  "/api-keys": true,
  "/product-ads": true,
  "/music-video": true,
  // Hidden — not ready yet
  "/edit": false,
};

export function isRouteVisibleAtLaunch(href: string): boolean {
  return LAUNCH_VISIBLE_ROUTES[href] ?? true;
}

/**
 * Filter model list to only launch-available models.
 * Used by model selectors in generate and brain pages.
 */
export function filterLaunchModels<T extends { launchAvailable?: boolean }>(
  models: Record<string, T>
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(models).filter(([, m]) => m.launchAvailable)
  );
}
