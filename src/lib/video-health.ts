// ============================================
// GENESIS STUDIO — Video Health Check Utility
// ============================================

import {
  S3Client,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { createSupabaseAdmin } from "./supabase";

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET_NAME || "genesis-videos";

export interface VideoHealthResult {
  videoId: string;
  jobId: string;
  status: "healthy" | "broken" | "missing_file" | "empty_file";
  fileSize: number | null;
  contentType: string | null;
  error?: string;
}

export interface AuditResult {
  total: number;
  healthy: number;
  broken: number;
  results: VideoHealthResult[];
}

/**
 * Check the health of a single video by verifying its R2 file exists
 * and has valid content.
 */
export async function checkVideoHealth(
  videoId: string
): Promise<VideoHealthResult> {
  const supabase = createSupabaseAdmin();

  const { data: video, error: dbError } = await supabase
    .from("videos")
    .select("id, job_id, user_id")
    .eq("id", videoId)
    .single();

  if (dbError || !video) {
    return {
      videoId,
      jobId: "",
      status: "broken",
      fileSize: null,
      contentType: null,
      error: "Video record not found in database",
    };
  }

  const key = `videos/${video.user_id}/${video.job_id}.mp4`;

  try {
    const head = await R2.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );

    const size = head.ContentLength ?? 0;
    const contentType = head.ContentType ?? null;

    if (size === 0) {
      return {
        videoId: video.id,
        jobId: video.job_id,
        status: "empty_file",
        fileSize: 0,
        contentType,
        error: "File exists but is empty (0 bytes)",
      };
    }

    return {
      videoId: video.id,
      jobId: video.job_id,
      status: "healthy",
      fileSize: size,
      contentType,
    };
  } catch (err) {
    // R2 returns NoSuchKey for missing files
    const isNotFound =
      err instanceof Error &&
      (err.name === "NoSuchKey" || err.name === "NotFound");

    return {
      videoId: video.id,
      jobId: video.job_id,
      status: isNotFound ? "missing_file" : "broken",
      fileSize: null,
      contentType: null,
      error: isNotFound
        ? "File not found in R2 storage"
        : `Storage error: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/**
 * Audit all completed videos for a specific user.
 * Returns health status for each video and marks broken ones.
 */
export async function auditAllVideos(
  userId?: string
): Promise<AuditResult> {
  const supabase = createSupabaseAdmin();

  let query = supabase
    .from("videos")
    .select("id, job_id, user_id")
    .order("created_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: videos, error } = await query;

  if (error || !videos) {
    return { total: 0, healthy: 0, broken: 0, results: [] };
  }

  const results: VideoHealthResult[] = [];
  let healthy = 0;
  let broken = 0;

  // Process in batches of 10 to avoid overwhelming R2
  const batchSize = 10;
  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((v) => checkVideoHealth(v.id))
    );

    for (const result of batchResults) {
      results.push(result);
      if (result.status === "healthy") {
        healthy++;
      } else {
        broken++;
      }
    }
  }

  return {
    total: videos.length,
    healthy,
    broken,
    results,
  };
}
