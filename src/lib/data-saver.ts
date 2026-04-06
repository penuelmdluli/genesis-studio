// ============================================
// GENESIS STUDIO — Data Saver Mode
// ============================================

// Respects expensive South African mobile data by reducing media quality

export interface DataSaverConfig {
  enabled: boolean;
  videoPreviewQuality: "auto" | "low" | "none";
  thumbnailQuality: "high" | "low";
  autoplayPreviews: boolean;
  prefetchVideos: boolean;
  maxPreviewResolution: string;
}

export const DATA_SAVER_DEFAULTS: DataSaverConfig = {
  enabled: false,
  videoPreviewQuality: "auto",
  thumbnailQuality: "high",
  autoplayPreviews: true,
  prefetchVideos: true,
  maxPreviewResolution: "720p",
};

export const DATA_SAVER_ON: DataSaverConfig = {
  enabled: true,
  videoPreviewQuality: "low",
  thumbnailQuality: "low",
  autoplayPreviews: false,
  prefetchVideos: false,
  maxPreviewResolution: "480p",
};

/**
 * Get data saver preference from localStorage (client-side only).
 */
export function getDataSaverConfig(): DataSaverConfig {
  if (typeof window === "undefined") return DATA_SAVER_DEFAULTS;
  try {
    const stored = localStorage.getItem("genesis-data-saver");
    if (stored) return JSON.parse(stored);
  } catch {}
  return DATA_SAVER_DEFAULTS;
}

/**
 * Save data saver preference to localStorage.
 */
export function setDataSaverConfig(config: DataSaverConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("genesis-data-saver", JSON.stringify(config));
  } catch {}
}

/**
 * Detect if the user is likely on a metered/expensive connection.
 * Uses the Network Information API (available in Chrome/Edge/Android).
 */
export function detectExpensiveConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as unknown as Record<string, unknown>).connection as
    | { saveData?: boolean; effectiveType?: string; type?: string }
    | undefined;

  if (!connection) return false;

  // User has "Save Data" enabled at OS level
  if (connection.saveData) return true;

  // Slow effective connection type
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return true;

  // Cellular connection (likely metered)
  if (connection.type === "cellular") return true;

  return false;
}

/**
 * Get the appropriate thumbnail URL based on data saver settings.
 */
export function getThumbnailUrl(originalUrl: string, config: DataSaverConfig): string {
  if (!config.enabled || config.thumbnailQuality === "high") return originalUrl;
  // For low quality, append a resize parameter if using a CDN that supports it
  // Cloudflare R2 doesn't natively resize, so we just return the original
  // In production, use Cloudflare Image Resizing or imgproxy
  return originalUrl;
}

/**
 * Check if video autoplay should be enabled.
 */
export function shouldAutoplay(config: DataSaverConfig): boolean {
  return !config.enabled || config.autoplayPreviews;
}
