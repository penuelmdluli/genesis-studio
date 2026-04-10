// ============================================
// GENESIS STUDIO — Cloudflare R2 Storage
// ============================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

export async function uploadVideo(
  key: string,
  body: Buffer | ReadableStream,
  contentType = "video/mp4"
): Promise<string> {
  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body as Buffer,
      ContentType: contentType,
    })
  );

  // If a public custom domain is configured, use direct URL.
  // Otherwise return the key — caller should construct the appropriate URL.
  if (PUBLIC_URL && !PUBLIC_URL.includes("r2.cloudflarestorage.com")) {
    return `${PUBLIC_URL}/${key}`;
  }
  // Return the storage key — videos are served via /api/videos/[videoId]
  return key;
}

export async function uploadThumbnail(
  key: string,
  body: Buffer,
  contentType = "image/jpeg"
): Promise<string> {
  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  if (PUBLIC_URL && !PUBLIC_URL.includes("r2.cloudflarestorage.com")) {
    return `${PUBLIC_URL}/${key}`;
  }
  return key;
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(R2, command, { expiresIn });
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(R2, command, { expiresIn });
}

export async function deleteFile(key: string): Promise<void> {
  await R2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

/**
 * Verify an uploaded file exists in R2 and meets minimum requirements.
 * Returns file size if healthy, throws if broken.
 */
export async function verifyR2Upload(
  key: string,
  minBytes = 5000
): Promise<{ size: number; contentType: string }> {
  const head = await R2.send(
    new HeadObjectCommand({ Bucket: BUCKET, Key: key })
  );

  const size = head.ContentLength ?? 0;
  const contentType = head.ContentType ?? "";

  if (size < minBytes) {
    throw new Error(
      `R2 file too small: ${size} bytes (minimum ${minBytes}). File may be corrupt.`
    );
  }

  if (!contentType.includes("video") && !contentType.includes("octet-stream")) {
    throw new Error(
      `R2 file has wrong content type: ${contentType}. Expected video/*.`
    );
  }

  return { size, contentType };
}

// Generate storage keys
export function videoStorageKey(userId: string, jobId: string): string {
  return `videos/${userId}/${jobId}.mp4`;
}

export function thumbnailStorageKey(userId: string, jobId: string): string {
  return `thumbnails/${userId}/${jobId}.jpg`;
}

export function inputImageStorageKey(userId: string, filename: string): string {
  return `inputs/${userId}/${Date.now()}-${filename}`;
}

export function audioStorageKey(userId: string, jobId: string): string {
  return `audio/${userId}/${jobId}.mp3`;
}

/**
 * Download a video from an external URL and persist it to R2.
 * Returns the permanent API URL: /api/explore/video/{key}
 * Used to prevent FAL/RunPod URL expiration.
 */
export async function persistExternalVideo(
  externalUrl: string,
  storageKey: string
): Promise<string> {
  // Retry logic: FAL/RunPod URLs can be transiently flaky. We retry on
  // network errors and 5xx responses, but fail fast on 403/404/410 which
  // indicate a truly expired URL.
  const MAX_ATTEMPTS = 3;
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000); // 90s hard timeout
      const res = await fetch(externalUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        // Fast-fail on expiry codes — retry won't help
        if (res.status === 403 || res.status === 404 || res.status === 410) {
          throw new Error(
            `External video URL expired (${res.status} ${res.statusText}): ${externalUrl.slice(0, 80)}`
          );
        }
        throw new Error(`Failed to download video: ${res.status} ${res.statusText}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 5000) {
        throw new Error(`Downloaded video too small: ${buffer.length} bytes`);
      }
      await uploadVideo(storageKey, buffer);
      if (attempt > 1) {
        console.log(
          `[STORAGE] persistExternalVideo succeeded on attempt ${attempt}: ${storageKey}`
        );
      }
      return storageKey;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      // Don't retry expiry errors
      if (lastErr.message.includes("expired")) throw lastErr;
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.min(500 * 2 ** (attempt - 1), 4000);
        console.warn(
          `[STORAGE] persistExternalVideo attempt ${attempt} failed: ${lastErr.message} — retrying in ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr || new Error("persistExternalVideo failed after retries");
}

export function exploreVideoStorageKey(exploreId: string): string {
  return `explore/${exploreId}.mp4`;
}

// Generic upload for any file type (used by server-side proxy upload)
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function uploadAudio(
  key: string,
  body: Buffer,
  contentType = "audio/mpeg"
): Promise<string> {
  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  if (PUBLIC_URL && !PUBLIC_URL.includes("r2.cloudflarestorage.com")) {
    return `${PUBLIC_URL}/${key}`;
  }
  return key;
}
