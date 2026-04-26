/**
 * Genesis Studio Audit — TTS E2E Test
 * Tests Edge TTS (free, local) voiceover generation.
 *
 * Usage: npx tsx audit/scripts/e2e-test-tts.ts
 * Cost: $0.00 (Edge TTS is free)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const TEST_TEXT = "Genesis Studio audit test, this is a synthesized voice.";

async function testEdgeTTS() {
  console.log("=== EDGE TTS TEST ===\n");
  console.log(`Text: "${TEST_TEXT}"`);

  try {
    const { MsEdgeTTS } = await import("msedge-tts");
    const tts = new MsEdgeTTS();
    await tts.setMetadata("en-US-GuyNeural", "audio-24khz-96kbitrate-mono-mp3");

    const start = Date.now();
    const readable = tts.toStream(TEST_TEXT);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      readable.on("data", (chunk: Buffer) => chunks.push(chunk));
      readable.on("end", resolve);
      readable.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\nStatus: PASS`);
    console.log(`Time: ${elapsed}s`);
    console.log(`Audio size: ${buffer.length} bytes`);
    console.log(`Cost: $0.00 (free)`);

    if (buffer.length < 1000) {
      console.log("WARNING: Audio buffer suspiciously small — may be empty/corrupt");
    }
  } catch (err) {
    console.log(`\nStatus: FAIL`);
    console.log(`Error: ${err}`);
  }
}

testEdgeTTS().catch(console.error);
