/**
 * Migrate explore_videos with external URLs to R2 permanent storage.
 *
 * Run with: npx tsx scripts/migrate-explore-videos.ts
 */

import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load env manually (no dotenv dependency)
const __dirname2 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname2, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

async function main() {
  console.log("🔍 Finding explore_videos with external URLs...\n");

  // Find all videos with http URLs (not our internal /api/ URLs)
  const { data: videos, error } = await supabase
    .from("explore_videos")
    .select("id, video_url, prompt")
    .like("video_url", "http%")
    .eq("is_flagged", false)
    .limit(100);

  if (error) {
    console.error("❌ Failed to fetch:", error.message);
    process.exit(1);
  }

  if (!videos || videos.length === 0) {
    console.log("✅ No external URLs to migrate — all videos are permanent!");
    return;
  }

  console.log(`Found ${videos.length} videos with external URLs:\n`);
  videos.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.id} — ${v.prompt?.slice(0, 50)}...`);
    console.log(`     URL: ${v.video_url?.slice(0, 80)}...`);
  });
  console.log();

  let migrated = 0;
  let expired = 0;
  let failed = 0;

  for (const video of videos) {
    const key = `explore/${video.id}.mp4`;
    process.stdout.write(`  Migrating ${video.id}... `);

    try {
      // Check if already in R2
      try {
        const head = await R2.send(
          new HeadObjectCommand({ Bucket: BUCKET, Key: key })
        );
        if ((head.ContentLength ?? 0) > 5000) {
          // Already migrated — just update the URL
          await supabase
            .from("explore_videos")
            .update({ video_url: `/api/explore/video/${video.id}` })
            .eq("id", video.id);
          console.log("✅ Already in R2 — URL updated");
          migrated++;
          continue;
        }
      } catch {
        // Not in R2 yet — proceed with download
      }

      // Download from external URL
      const res = await fetch(video.video_url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());

      if (buffer.length < 5000) {
        throw new Error(`Too small: ${buffer.length} bytes`);
      }

      // Upload to R2
      await R2.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: "video/mp4",
        })
      );

      // Update DB with permanent URL
      await supabase
        .from("explore_videos")
        .update({ video_url: `/api/explore/video/${video.id}` })
        .eq("id", video.id);

      console.log(`✅ ${(buffer.length / 1024 / 1024).toFixed(1)}MB → R2`);
      migrated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.log(`❌ ${msg}`);

      // Flag as expired
      await supabase
        .from("explore_videos")
        .update({ is_flagged: true })
        .eq("id", video.id);

      if (msg.includes("HTTP 4") || msg.includes("HTTP 5") || msg.includes("Too small")) {
        expired++;
      } else {
        failed++;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Migration complete:`);
  console.log(`  ✅ Migrated: ${migrated}`);
  console.log(`  ⚠️  Expired:  ${expired}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  📊 Total:    ${videos.length}`);
  console.log(`========================================\n`);
}

main().catch(console.error);
