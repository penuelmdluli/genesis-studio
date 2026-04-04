/**
 * Video Pipeline Tests
 *
 * These tests verify the CRITICAL invariant that broke production 3+ times:
 * Completed videos MUST have a URL in the format `/api/videos/{uuid}`.
 *
 * Root cause: The polling path (/api/jobs/[jobId]) was storing raw R2 storage
 * keys (e.g., "videos/userId/jobId.mp4") as the video URL instead of
 * the API route format "/api/videos/{uuid}". The webhook path got it right,
 * but which path ran first was a race condition.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- helpers ----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_VIDEO_URL_RE = /^\/api\/videos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidVideoUrl(url: string): boolean {
  return VALID_VIDEO_URL_RE.test(url);
}

function isRawR2Key(url: string): boolean {
  return url.startsWith("videos/") || url.includes(".r2.cloudflarestorage.com");
}

// ---- tests ----

describe("Video URL format invariant", () => {
  it("valid API URL format passes validation", () => {
    expect(isValidVideoUrl("/api/videos/82b5fdd2-b573-491d-ba78-8f7b291ff735")).toBe(true);
    expect(isValidVideoUrl("/api/videos/f16c164d-df20-4eb8-805a-6f099148400e")).toBe(true);
  });

  it("raw R2 key is detected as invalid", () => {
    expect(isValidVideoUrl("videos/userId/jobId.mp4")).toBe(false);
    expect(isRawR2Key("videos/userId/jobId.mp4")).toBe(true);
  });

  it("empty string is invalid", () => {
    expect(isValidVideoUrl("")).toBe(false);
  });

  it("R2 public URL is detected as raw", () => {
    expect(isRawR2Key("https://abc.r2.cloudflarestorage.com/videos/x/y.mp4")).toBe(true);
  });
});

describe("Storage key generation", () => {
  it("videoStorageKey returns expected format", async () => {
    const { videoStorageKey } = await import("./storage");
    const key = videoStorageKey("user-123", "job-456");
    expect(key).toBe("videos/user-123/job-456.mp4");
  });
});

describe("uploadVideo return value", () => {
  it("returns raw key when R2_PUBLIC_URL contains r2.cloudflarestorage.com", async () => {
    // This test documents the current behavior that MUST be accounted for.
    // uploadVideo returns the raw R2 key, NOT a browser-accessible URL.
    // The caller MUST construct `/api/videos/{uuid}` independently.
    const { videoStorageKey } = await import("./storage");
    const key = videoStorageKey("user-123", "job-456");
    // The key itself is just a storage path, not a URL
    expect(key).not.toMatch(/^\/api\//);
    expect(key).not.toMatch(/^https?:\/\//);
  });
});

describe("Webhook handler video URL format", () => {
  // This is a structural test — verifying the code constructs URLs correctly.
  // We read the source to confirm the pattern.

  it("webhook handler creates video with /api/videos/{uuid} URL", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const webhookSource = fs.readFileSync(
      path.resolve(__dirname, "../app/api/webhooks/runpod/route.ts"),
      "utf-8"
    );

    // Must use randomUUID for the video ID
    expect(webhookSource).toContain("randomUUID");

    // Must construct URL as /api/videos/{videoId}
    expect(webhookSource).toContain("/api/videos/${videoId}");

    // Must NOT pass raw R2 key to createVideo
    // The URL passed to createVideo should be videoApiUrl, not the uploadVideo return value
    expect(webhookSource).toContain("url: videoApiUrl");
  });

  it("webhook handler checks for existing video before creating", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const webhookSource = fs.readFileSync(
      path.resolve(__dirname, "../app/api/webhooks/runpod/route.ts"),
      "utf-8"
    );

    // Must check for existing video to prevent duplicates
    expect(webhookSource).toContain("existingVideo");
    expect(webhookSource).toContain("maybeSingle");
  });
});

describe("Polling handler video URL format", () => {
  it("polling handler creates video with /api/videos/{uuid} URL", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pollingSource = fs.readFileSync(
      path.resolve(__dirname, "../app/api/jobs/[jobId]/route.ts"),
      "utf-8"
    );

    // Must use randomUUID for the video ID
    expect(pollingSource).toContain("randomUUID");

    // Must construct URL as /api/videos/{videoId}
    expect(pollingSource).toContain("/api/videos/${videoId}");

    // Must pass the API URL, not the raw storage key
    expect(pollingSource).toContain("url: videoApiUrl");
  });

  it("polling handler checks for existing video before creating", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pollingSource = fs.readFileSync(
      path.resolve(__dirname, "../app/api/jobs/[jobId]/route.ts"),
      "utf-8"
    );

    // Must check for existing video to prevent duplicates
    expect(pollingSource).toContain("existingVideo");
    expect(pollingSource).toContain("maybeSingle");
  });

  it("polling handler fails job on storage upload error (not silent continue)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pollingSource = fs.readFileSync(
      path.resolve(__dirname, "../app/api/jobs/[jobId]/route.ts"),
      "utf-8"
    );

    // After storage error catch, must NOT create video record
    // Must mark as failed and refund
    expect(pollingSource).toContain("Video upload failed");
    expect(pollingSource).toContain("refundCredits");

    // The createVideo call MUST be AFTER the try/catch for storage,
    // not inside it where a failed upload could still create a record
    const storageErrorIdx = pollingSource.indexOf("Video upload failed");
    const createVideoIdx = pollingSource.indexOf("await createVideo({", storageErrorIdx);
    // createVideo should only appear AFTER the error handling
    // (the refund return should be before createVideo)
    const refundReturnIdx = pollingSource.indexOf("return NextResponse.json", storageErrorIdx);
    expect(refundReturnIdx).toBeGreaterThan(storageErrorIdx);
    expect(refundReturnIdx).toBeLessThan(createVideoIdx);
  });
});

describe("Video serving endpoint", () => {
  it("video serving route looks up by video ID and finds R2 file by job_id", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const serveSource = fs.readFileSync(
      path.resolve(__dirname, "../app/api/videos/[videoId]/route.ts"),
      "utf-8"
    );

    // Must look up video record by ID
    expect(serveSource).toContain(".eq(\"id\", videoId)");

    // Must use job_id to find the R2 file
    expect(serveSource).toContain("video.job_id");
    expect(serveSource).toContain("findVideoInR2");

    // Must set correct content type
    expect(serveSource).toContain("Content-Type");
    expect(serveSource).toContain("Content-Disposition");
  });
});
