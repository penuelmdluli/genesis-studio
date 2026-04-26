// ============================================
// MBS Content Scraper — Railway Service Client
// Calls the genesis-scraper Railway service for
// yt-dlp operations (TikTok scraping requires
// a real server, not Vercel serverless).
// ============================================

import { envString } from "@/lib/env";

export interface CreatorPost {
  id: string;
  url: string;
  title: string;
  duration: number;
  viewCount: number;
  uploadDate: string;
  thumbnailUrl: string;
}

function getScraperConfig() {
  const url = envString("SCRAPER_SERVICE_URL");
  const secret = envString("SCRAPER_SERVICE_SECRET");
  if (!url || !secret) throw new Error("SCRAPER_SERVICE_URL or SCRAPER_SERVICE_SECRET not configured");
  return { url, secret };
}

async function scraperFetch(endpoint: string, body: Record<string, unknown>) {
  const { url, secret } = getScraperConfig();
  const res = await fetch(`${url}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-scraper-secret": secret,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Scraper ${endpoint} failed (${res.status}): ${err.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * List recent posts from a creator's profile via Railway scraper.
 */
export async function listCreatorPosts(
  profileUrl: string,
  maxItems = 10
): Promise<CreatorPost[]> {
  const data = await scraperFetch("/list-creator-posts", { profileUrl, maxItems });
  return (data.posts ?? []) as CreatorPost[];
}

/**
 * Download a video and upload to R2 via Railway scraper.
 */
export async function downloadAndPersist(
  sourceUrl: string
): Promise<{ r2Key: string; durationSec: number }> {
  const data = await scraperFetch("/download", { url: sourceUrl });
  return {
    r2Key: data.r2Key,
    durationSec: data.durationSec ?? 0,
  };
}

/**
 * Fetch video metadata without downloading.
 */
export async function fetchVideoMetadata(url: string): Promise<{
  id: string;
  title: string;
  duration: number;
  viewCount: number;
  thumbnailUrl: string;
}> {
  const data = await scraperFetch("/metadata", { url });
  return {
    id: data.id ?? "",
    title: data.title ?? "",
    duration: data.duration ?? 0,
    viewCount: data.viewCount ?? 0,
    thumbnailUrl: data.thumbnailUrl ?? "",
  };
}
