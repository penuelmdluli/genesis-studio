// ============================================
// GENESIS STUDIO — Lightweight Video Downloader
// ============================================
// Downloads videos from social media URLs directly in the Worker.
// No yt-dlp needed — uses platform APIs and redirect following.
//
// Supported: TikTok, Instagram Reels, Twitter/X, direct MP4 URLs
// Facebook: requires Graph API token (handled separately)

import { getR2 } from "@/lib/cf-env";
import { r2PublicUrl } from "@/lib/storage";

interface DownloadResult {
  r2Key: string;
  publicUrl: string;
  durationSec: number;
  fileSizeBytes: number;
}

/**
 * Download a video from a URL and persist to R2.
 * Handles social media URLs by extracting the direct video URL.
 */
export async function downloadVideoFromUrl(
  sourceUrl: string,
  userId: string,
  jobId: string
): Promise<DownloadResult> {
  const directUrl = await resolveVideoUrl(sourceUrl);
  if (!directUrl) {
    throw new Error(
      "Could not extract video from this URL. Try downloading the video and uploading it directly."
    );
  }

  // Download the video
  const res = await fetch(directUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "video/*,*/*",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download video: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "video/mp4";
  if (!contentType.includes("video") && !contentType.includes("octet-stream")) {
    throw new Error("URL did not return a video file");
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength < 5000) {
    throw new Error("Downloaded file too small — likely not a valid video");
  }

  // Upload to R2
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const r2Key = `mimic-references/${userId}/${jobId}.${ext}`;

  const r2 = getR2();
  await r2.put(r2Key, buffer, {
    httpMetadata: { contentType },
  });

  return {
    r2Key,
    publicUrl: r2PublicUrl(r2Key),
    durationSec: 0, // Can't determine without ffprobe
    fileSizeBytes: buffer.byteLength,
  };
}

/**
 * Resolve a social media URL to a direct video URL.
 * Follows redirects, extracts from embed pages, uses oEmbed APIs.
 */
async function resolveVideoUrl(url: string): Promise<string | null> {
  // Direct video URL — just use it
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return url;
  }

  // R2/CDN URLs — already accessible
  if (url.includes("r2.cloudflarestorage.com") || url.includes("cdn.ivideostudio.ai")) {
    return url;
  }

  // TikTok
  if (url.includes("tiktok.com")) {
    return await resolveTikTok(url);
  }

  // Instagram
  if (url.includes("instagram.com")) {
    return await resolveInstagram(url);
  }

  // Twitter/X
  if (url.includes("twitter.com") || url.includes("x.com")) {
    return await resolveTwitter(url);
  }

  // YouTube Shorts (can't download without yt-dlp, but try)
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return null; // YouTube blocks direct downloads
  }

  // Facebook — needs Graph API, handled in mimic route
  if (url.includes("facebook.com")) {
    return await resolveFacebook(url);
  }

  // Unknown URL — try following redirects to see if it ends at a video
  return await resolveGeneric(url);
}

async function resolveTikTok(url: string): Promise<string | null> {
  try {
    // Use TikTok's oEmbed API to get the video page
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: string; html?: string };

    // The oEmbed doesn't give direct video URL, but we can try the
    // TikTok API v2 approach — follow the share URL to get the real page
    const pageRes = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    const html = await pageRes.text();

    // Extract video URL from page HTML (in __UNIVERSAL_DATA_FOR_REHYDRATION__)
    const videoMatch = html.match(/"playAddr"\s*:\s*"([^"]+)"/);
    if (videoMatch) {
      return videoMatch[1].replace(/\\u002F/g, "/").replace(/\\u0026/g, "&");
    }

    // Try downloadAddr
    const dlMatch = html.match(/"downloadAddr"\s*:\s*"([^"]+)"/);
    if (dlMatch) {
      return dlMatch[1].replace(/\\u002F/g, "/").replace(/\\u0026/g, "&");
    }

    return null;
  } catch {
    return null;
  }
}

async function resolveInstagram(url: string): Promise<string | null> {
  try {
    // Instagram oEmbed (requires app token for video URL)
    // Fallback: fetch the page and look for video meta tag
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
        Accept: "text/html",
      },
    });
    const html = await res.text();

    // Look for og:video in meta tags
    const videoMatch = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i);
    if (videoMatch) return videoMatch[1];

    // Look for video_url in embedded JSON
    const jsonMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
    if (jsonMatch) return jsonMatch[1].replace(/\\u0026/g, "&");

    return null;
  } catch {
    return null;
  }
}

async function resolveTwitter(url: string): Promise<string | null> {
  try {
    // Normalize x.com to twitter.com for API compatibility
    const normalizedUrl = url.replace("x.com", "twitter.com");

    // Use the syndication API (public, no auth needed)
    const tweetIdMatch = normalizedUrl.match(/status\/(\d+)/);
    if (!tweetIdMatch) return null;
    const tweetId = tweetIdMatch[1];

    const synRes = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!synRes.ok) return null;

    const data = await synRes.json() as Record<string, unknown>;
    // Navigate the syndication response to find video URL
    const mediaDetails = (data as { mediaDetails?: Array<{ video_info?: { variants?: Array<{ url: string; content_type: string; bitrate?: number }> } }> }).mediaDetails;
    if (mediaDetails) {
      for (const media of mediaDetails) {
        if (media.video_info?.variants) {
          // Pick highest bitrate MP4
          const mp4s = media.video_info.variants
            .filter((v) => v.content_type === "video/mp4")
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          if (mp4s.length > 0) return mp4s[0].url;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function resolveFacebook(url: string): Promise<string | null> {
  try {
    // Try to get a page token from env
    const token = process.env.FB_MBS_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_TOKEN_tech_news;
    if (!token) return null;

    // Extract video ID from URL
    let videoId: string | null = null;
    const reelMatch = url.match(/\/reel\/(\d+)/);
    if (reelMatch) videoId = reelMatch[1];
    const watchMatch = url.match(/[?&]v=(\d+)/);
    if (watchMatch) videoId = watchMatch[1];
    const vidMatch = url.match(/\/videos\/(\d+)/);
    if (vidMatch) videoId = vidMatch[1];

    // Share links need redirect resolution
    if (!videoId && url.includes("/share/")) {
      const redirectRes = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const finalUrl = redirectRes.url;
      const m = finalUrl.match(/\/(?:reel|videos)\/(\d+)/) || finalUrl.match(/[?&]v=(\d+)/);
      if (m) videoId = m[1];
    }

    if (!videoId) return null;

    // Get video source via Graph API
    const graphRes = await fetch(
      `https://graph.facebook.com/v19.0/${videoId}?fields=source&access_token=${token}`
    );
    if (!graphRes.ok) return null;

    const graphData = (await graphRes.json()) as { source?: string };
    return graphData.source || null;
  } catch {
    return null;
  }
}

async function resolveGeneric(url: string): Promise<string | null> {
  try {
    // Follow redirects and check if we land on a video
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
        Accept: "video/*,text/html,*/*",
      },
    });

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("video")) {
      return res.url; // The final URL is a video
    }

    // If HTML, look for og:video meta tag
    if (contentType.includes("html")) {
      const html = await res.text();
      const videoMatch = html.match(/<meta\s+(?:property|name)="og:video(?::url)?"\s+content="([^"]+)"/i);
      if (videoMatch) return videoMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}
