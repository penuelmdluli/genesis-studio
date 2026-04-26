/**
 * Genesis Studio Audit — Captions E2E Test
 * Tests caption generation pipeline.
 *
 * Usage: npx tsx audit/scripts/e2e-test-captions.ts
 * Requires: FAL_KEY in .env.local (for Whisper transcription)
 * Cost: ~$0.01
 *
 * NOTE: Requires a video URL to transcribe. Use output from e2e-test-providers.ts.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

console.log("=== CAPTIONS E2E TEST ===\n");
console.log("This test requires a video URL from the provider test.");
console.log("Run e2e-test-providers.ts first, then pass the output URL:\n");
console.log("  npx tsx audit/scripts/e2e-test-captions.ts <video-url>\n");

const videoUrl = process.argv[2];

if (!videoUrl) {
  console.log("No video URL provided. Skipping.");
  process.exit(0);
}

if (!process.env.FAL_KEY) {
  console.log("FAL_KEY not set. Skipping.");
  process.exit(0);
}

async function testCaptions() {
  const { fal } = await import("@fal-ai/client");
  fal.config({ credentials: process.env.FAL_KEY! });

  console.log(`Video URL: ${videoUrl.slice(0, 80)}...`);
  console.log("Submitting to Whisper...");

  const start = Date.now();

  try {
    const result = await fal.subscribe("fal-ai/whisper", {
      input: {
        audio_url: videoUrl,
        task: "transcribe",
        language: "en",
      },
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const data = result.data as { text?: string; chunks?: Array<{ text: string; timestamp: number[] }> };

    console.log(`\nStatus: PASS`);
    console.log(`Time: ${elapsed}s`);
    console.log(`Transcription: "${data?.text?.slice(0, 200) || "(empty)"}"`);
    console.log(`Chunks: ${data?.chunks?.length || 0}`);
    console.log(`Cost: ~$0.01`);
  } catch (err) {
    console.log(`\nStatus: FAIL`);
    console.log(`Error: ${err}`);
  }
}

testCaptions().catch(console.error);
