// ============================================
// GENESIS STUDIO — Cloudflare R2 Storage
// ============================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
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
