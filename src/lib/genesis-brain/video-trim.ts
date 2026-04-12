// ============================================
// SERVER-SIDE VIDEO TRIMMER
// Downloads video, trims with ffmpeg, uploads back to R2.
// Used to remove the face fade-in from wan-2.2 scene clips.
// ============================================

import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { uploadVideo, videoStorageKey, getSignedDownloadUrl } from "@/lib/storage";

const FFMPEG_PATH = ffmpegInstaller.path;

/**
 * Trim the first N seconds from a video using server-side ffmpeg.
 * Downloads the video, runs ffmpeg, uploads trimmed version to R2.
 * Returns the R2 storage key of the trimmed video, or null on failure.
 *
 * @param sourceUrl - URL of the source video (signed R2 URL or external)
 * @param trimStartSec - Seconds to trim from the start (default 3)
 * @param userId - User ID for R2 storage path
 * @returns Signed URL of trimmed video in R2, or null if failed
 */
export async function trimVideoStart(
  sourceUrl: string,
  trimStartSec: number,
  userId: string,
): Promise<string | null> {
  const tmpDir = join(tmpdir(), "genesis-trim");
  const jobId = randomUUID();
  const inputPath = join(tmpDir, `${jobId}-in.mp4`);
  const outputPath = join(tmpDir, `${jobId}-out.mp4`);

  try {
    if (!existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }

    // Download source video
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.warn(`[VIDEO-TRIM] Download failed: ${res.status}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(inputPath, buf);

    // Run ffmpeg: -ss AFTER -i for accurate seek (vs before = keyframe-based, inaccurate)
    // Re-encode video (fast preset), copy audio. ~2x realtime on modest CPU.
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(FFMPEG_PATH, [
        "-y", // overwrite output
        "-i", inputPath,
        "-ss", trimStartSec.toString(), // accurate seek
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "copy",
        outputPath,
      ]);

      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
      });
      proc.on("error", reject);
    });

    // Read trimmed output
    const trimmedBuf = await readFile(outputPath);
    if (trimmedBuf.length < 1000) {
      console.warn(`[VIDEO-TRIM] Output too small: ${trimmedBuf.length} bytes`);
      return null;
    }

    // Upload to R2 with new key
    const newVideoId = randomUUID();
    const r2Key = videoStorageKey(userId, `trimmed-${newVideoId}`);
    await uploadVideo(r2Key, trimmedBuf);

    // Return signed URL
    const signedUrl = await getSignedDownloadUrl(r2Key, 86400);
    console.log(`[VIDEO-TRIM] Trimmed ${trimStartSec}s from start: ${(trimmedBuf.length / 1024 / 1024).toFixed(1)}MB → ${r2Key}`);
    return signedUrl;
  } catch (err) {
    console.error(`[VIDEO-TRIM] Trim failed:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    // Cleanup
    try { await unlink(inputPath); } catch {}
    try { await unlink(outputPath); } catch {}
  }
}
