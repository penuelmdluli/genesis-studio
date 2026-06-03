// ============================================
// GENESIS STUDIO — Cloudflare R2 Storage
// ============================================
// Uses native R2 binding when running on Cloudflare Workers.
// Falls back to S3-compatible API for local development.

import { getR2 } from "@/lib/cf-env";

function getPublicUrl(): string {
  return process.env.R2_PUBLIC_URL || "";
}

/**
 * Build a public URL for an R2 object.
 */
export function r2PublicUrl(key: string): string {
  const publicUrl = getPublicUrl();
  if (publicUrl && !publicUrl.includes("r2.cloudflarestorage.com")) {
    return `${publicUrl.replace(/\/$/, "")}/${encodeURI(key)}`;
  }
  return `/api/r2-proxy/${encodeURI(key)}`;
}

async function putObject(
  key: string,
  body: ArrayBuffer | Uint8Array | ReadableStream | string,
  contentType: string
): Promise<void> {
  try {
    const r2 = getR2();
    await r2.put(key, body as any, {
      httpMetadata: { contentType },
    });
  } catch {
    // Fallback to S3 API for local dev
    await putObjectS3(key, body, contentType);
  }
}

export async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const r2 = getR2();
    const head = await r2.head(key);
    if (!head) return null;
    return {
      size: head.size,
      contentType: head.httpMetadata?.contentType || "",
    };
  } catch {
    return headObjectS3(key);
  }
}

async function deleteObject(key: string): Promise<void> {
  try {
    const r2 = getR2();
    await r2.delete(key);
  } catch {
    await deleteObjectS3(key);
  }
}

// --- S3 fallback for local development ---

async function getS3Client() {
  const { S3Client: S3 } = await import("@aws-sdk/client-s3");
  return new S3({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
}

function getBucket(): string {
  return process.env.R2_BUCKET_NAME || "genesis-videos";
}

async function putObjectS3(
  key: string,
  body: ArrayBuffer | Uint8Array | ReadableStream | string,
  contentType: string
): Promise<void> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getS3Client();
  const buf = body instanceof ArrayBuffer ? Buffer.from(body) : body;
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buf as Buffer,
      ContentType: contentType,
    })
  );
}

async function headObjectS3(key: string): Promise<{ size: number; contentType: string } | null> {
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getS3Client();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return {
      size: head.ContentLength ?? 0,
      contentType: head.ContentType ?? "",
    };
  } catch {
    return null;
  }
}

async function deleteObjectS3(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

// --- Public API ---

export async function uploadVideo(
  key: string,
  body: Buffer | ReadableStream | ArrayBuffer,
  contentType = "video/mp4"
): Promise<string> {
  const buf = body instanceof Buffer ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : body;
  await putObject(key, buf as ArrayBuffer, contentType);

  const publicUrl = getPublicUrl();
  if (publicUrl && !publicUrl.includes("r2.cloudflarestorage.com")) {
    return `${publicUrl}/${key}`;
  }
  return key;
}

export async function uploadThumbnail(
  key: string,
  body: Buffer,
  contentType = "image/jpeg"
): Promise<string> {
  await putObject(key, body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as any, contentType);
  const publicUrl = getPublicUrl();
  if (publicUrl && !publicUrl.includes("r2.cloudflarestorage.com")) {
    return `${publicUrl}/${key}`;
  }
  return key;
}

export async function uploadAudio(
  key: string,
  body: Buffer,
  contentType = "audio/mpeg"
): Promise<string> {
  await putObject(key, body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as any, contentType);
  const publicUrl = getPublicUrl();
  if (publicUrl && !publicUrl.includes("r2.cloudflarestorage.com")) {
    return `${publicUrl}/${key}`;
  }
  return key;
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await putObject(key, body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as any, contentType);
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  // Signed URLs require the S3 API — not available via native R2 binding
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await getS3Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType }),
    { expiresIn }
  );
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await getS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn }
  );
}

export async function deleteFile(key: string): Promise<void> {
  await deleteObject(key);
}

export async function fileExists(key: string): Promise<boolean> {
  const head = await headObject(key);
  return head !== null && head.size > 0;
}

export async function verifyR2Upload(
  key: string,
  minBytes = 5000
): Promise<{ size: number; contentType: string }> {
  const head = await headObject(key);
  if (!head) {
    throw new Error(`R2 file not found: ${key}`);
  }

  if (head.size < minBytes) {
    throw new Error(
      `R2 file too small: ${head.size} bytes (minimum ${minBytes}). File may be corrupt.`
    );
  }

  if (!head.contentType.includes("video") && !head.contentType.includes("octet-stream")) {
    throw new Error(
      `R2 file has wrong content type: ${head.contentType}. Expected video/*.`
    );
  }

  return head;
}

// --- Storage key generators ---

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

export function exploreVideoStorageKey(exploreId: string): string {
  return `explore/${exploreId}.mp4`;
}

export async function persistExternalVideo(
  externalUrl: string,
  storageKey: string
): Promise<string> {
  const MAX_ATTEMPTS = 3;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);
      const res = await fetch(externalUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 410) {
          throw new Error(
            `External video URL expired (${res.status} ${res.statusText}): ${externalUrl.slice(0, 80)}`
          );
        }
        throw new Error(`Failed to download video: ${res.status} ${res.statusText}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength < 5000) {
        throw new Error(`Downloaded video too small: ${arrayBuffer.byteLength} bytes`);
      }

      await putObject(storageKey, arrayBuffer, "video/mp4");

      if (attempt > 1) {
        console.log(
          `[STORAGE] persistExternalVideo succeeded on attempt ${attempt}: ${storageKey}`
        );
      }
      return storageKey;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
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
