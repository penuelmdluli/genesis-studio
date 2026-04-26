// ============================================
// MBS Content Scraper — yt-dlp metadata + download
// Runs inside Vercel serverless. Downloads short
// clips to R2 for the vetting pipeline.
// ============================================

import { uploadVideo } from "@/lib/storage";
import { randomUUID } from "crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YtdlpFn = (url: string, opts?: Record<string, any>) => any;

interface VideoMetadata {
  id: string;
  title: string;
  duration: number;
  viewCount: number;
  uploadDate: string;
  thumbnailUrl: string;
  url: string;
  uploaderHandle: string;
  uploaderName: string;
}

export interface CreatorPost {
  id: string;
  url: string;
  title: string;
  duration: number;
  viewCount: number;
  uploadDate: string;
  thumbnailUrl: string;
}

async function getYtdlp(): Promise<YtdlpFn> {
  const mod = await import("yt-dlp-exec");
  return mod.default as unknown as YtdlpFn;
}

export async function fetchVideoMetadata(url: string): Promise<VideoMetadata> {
  const ytdlp = await getYtdlp();
  const result = await ytdlp(url, {
    "dump-json": true,
    "skip-download": true,
    "no-warnings": true,
    "no-call-home": true,
  });

  const data = typeof result === "string" ? JSON.parse(result) : result;

  return {
    id: data.id ?? "",
    title: data.title ?? "",
    duration: data.duration ?? 0,
    viewCount: data.view_count ?? 0,
    uploadDate: data.upload_date ?? "",
    thumbnailUrl: data.thumbnail ?? "",
    url: data.webpage_url ?? url,
    uploaderHandle: data.uploader_id ?? data.channel_id ?? "",
    uploaderName: data.uploader ?? data.channel ?? "",
  };
}

export async function listCreatorPosts(
  profileUrl: string,
  maxItems = 10
): Promise<CreatorPost[]> {
  const ytdlp = await getYtdlp();

  try {
    const result = await ytdlp(profileUrl, {
      "dump-json": true,
      "skip-download": true,
      "no-warnings": true,
      "no-call-home": true,
      "flat-playlist": true,
      "playlist-end": maxItems,
    });

    const lines = typeof result === "string"
      ? result.trim().split("\n").filter(Boolean)
      : [result];

    return lines.map((line: unknown) => {
      const data = typeof line === "string" ? JSON.parse(line) : line as Record<string, unknown>;
      return {
        id: (data.id ?? "") as string,
        url: (data.url ?? data.webpage_url ?? "") as string,
        title: (data.title ?? "") as string,
        duration: (data.duration ?? 0) as number,
        viewCount: (data.view_count ?? 0) as number,
        uploadDate: (data.upload_date ?? "") as string,
        thumbnailUrl: (data.thumbnail ?? "") as string,
      };
    });
  } catch (err) {
    console.error("[MBS Scraper] listCreatorPosts failed:", err);
    return [];
  }
}

export async function downloadAndPersist(
  sourceUrl: string,
  maxDurationSec = 30
): Promise<{ r2Key: string; durationSec: number }> {
  const meta = await fetchVideoMetadata(sourceUrl);
  if (meta.duration > maxDurationSec) {
    throw new Error(`Video too long: ${meta.duration}s > ${maxDurationSec}s limit`);
  }

  // Download via fetch (simpler than yt-dlp stdout for serverless)
  // For TikTok/IG, the source URL from metadata usually has a direct video URL
  const ytdlp = await getYtdlp();
  const infoResult = await ytdlp(sourceUrl, {
    "dump-json": true,
    "skip-download": true,
  });
  const info = typeof infoResult === "string" ? JSON.parse(infoResult) : infoResult;
  const directUrl = info.url ?? info.webpage_url;

  if (!directUrl) {
    throw new Error("Could not resolve direct video URL");
  }

  const res = await fetch(directUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1000) {
    throw new Error(`Downloaded video too small: ${buffer.length} bytes`);
  }

  const id = randomUUID().slice(0, 8);
  const r2Key = `mbs-references/${id}.mp4`;
  await uploadVideo(r2Key, buffer, "video/mp4");

  console.log(`[MBS Scraper] ${sourceUrl} → R2 ${r2Key} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  return { r2Key, durationSec: meta.duration };
}
