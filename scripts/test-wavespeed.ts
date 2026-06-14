/**
 * WaveSpeed Full Integration Test
 * Tests all video generation endpoints: submit → poll → result
 * Reports costs and latency for each model.
 *
 * Usage: npx tsx scripts/test-wavespeed.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const API_BASE = "https://api.wavespeed.ai/api/v3";
const API_KEY = process.env.WAVESPEED_API_KEY;

if (!API_KEY) {
  console.error("❌ WAVESPEED_API_KEY not set in .env.local");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

// Test image for I2V (public domain)
const TEST_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png";

interface TestCase {
  name: string;
  endpoint: string;
  body: Record<string, unknown>;
  expectedCostRange: [number, number]; // [min, max] USD
}

const tests: TestCase[] = [
  {
    name: "Seedance 1.5 Pro T2V (cheapest)",
    endpoint: "bytedance/seedance-v1.5-pro/text-to-video",
    body: {
      prompt: "A golden retriever running through a sunlit meadow, cinematic, warm light",
      duration: 4,
      resolution: "720p",
      aspect_ratio: "16:9",
      generate_audio: false,
      seed: 42,
    },
    expectedCostRange: [0.10, 0.40],
  },
  {
    name: "Kling 2.6 Pro T2V",
    endpoint: "kwaivgi/kling-v2.6-pro/text-to-video",
    body: {
      prompt: "A cat sitting on a windowsill watching rain, cozy atmosphere, soft lighting",
      duration: 5,
      aspect_ratio: "16:9",
      cfg_scale: 0.5,
      sound: false,
    },
    expectedCostRange: [0.25, 0.50],
  },
  {
    name: "Kling 3.0 Pro T2V",
    endpoint: "kwaivgi/kling-v3.0-pro/text-to-video",
    body: {
      prompt: "A drone flying over a futuristic city at sunset, neon lights reflecting on buildings",
      duration: 5,
      aspect_ratio: "16:9",
      cfg_scale: 0.5,
      sound: false,
    },
    expectedCostRange: [0.40, 0.80],
  },
  {
    name: "Veo 3.1 T2V",
    endpoint: "google/veo3.1/text-to-video",
    body: {
      prompt: "A street performer playing guitar in a busy European square, ambient sounds, cinematic",
      duration: 4,
      aspect_ratio: "16:9",
      resolution: "720p",
      generate_audio: true,
    },
    expectedCostRange: [0.80, 4.00],
  },
  {
    name: "Kling 2.6 Pro Motion Control",
    endpoint: "kwaivgi/kling-v2.6-pro/motion-control",
    body: {
      image: TEST_IMAGE,
      video: "https://assets.mixkit.co/videos/34588/34588-720.mp4",
      character_orientation: "video",
      prompt: "A person dancing hip hop",
      keep_original_sound: false,
    },
    expectedCostRange: [0.20, 0.60],
  },
];

async function submitJob(test: TestCase): Promise<string | null> {
  console.log(`\n📤 Submitting: ${test.name}`);
  console.log(`   Endpoint: ${test.endpoint}`);

  try {
    const res = await fetch(`${API_BASE}/${test.endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(test.body),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`   ❌ Submit failed (${res.status}): ${text.slice(0, 200)}`);
      return null;
    }

    const json = JSON.parse(text);
    const data = json.data || json; // Unwrap { code, message, data } wrapper
    console.log(`   ✅ Submitted! ID: ${data.id}`);
    console.log(`   Status: ${data.status}`);
    return data.id;
  } catch (err) {
    console.error(`   ❌ Error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function pollResult(predictionId: string, name: string, timeoutMs = 5 * 60 * 1000): Promise<{
  status: string;
  videoUrl?: string;
  durationMs: number;
}> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5s

  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(`${API_BASE}/predictions/${predictionId}/result`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });

      if (res.status === 404) {
        // Still processing
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`\r   ⏳ ${name}: processing... (${elapsed}s)`);
        await new Promise((r) => setTimeout(r, pollInterval));
        continue;
      }

      if (!res.ok) {
        return { status: "error", durationMs: Date.now() - startTime };
      }

      const json = await res.json();
      const data = json.data || json; // Unwrap wrapper

      if (data.status === "completed") {
        const videoUrl = data.outputs?.[0];
        console.log(`\n   ✅ COMPLETED in ${Math.round((Date.now() - startTime) / 1000)}s`);
        if (videoUrl) console.log(`   🎬 Video: ${videoUrl.slice(0, 80)}...`);
        return { status: "completed", videoUrl, durationMs: Date.now() - startTime };
      }

      if (data.status === "failed") {
        console.log(`\n   ❌ FAILED: ${data.error || "Unknown error"}`);
        return { status: "failed", durationMs: Date.now() - startTime };
      }

      // Still processing
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(`\r   ⏳ ${name}: ${data.status}... (${elapsed}s)`);
      await new Promise((r) => setTimeout(r, pollInterval));
    } catch (err) {
      console.error(`\n   ⚠️ Poll error: ${err instanceof Error ? err.message : err}`);
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }

  console.log(`\n   ⏰ TIMEOUT after ${Math.round(timeoutMs / 1000)}s`);
  return { status: "timeout", durationMs: timeoutMs };
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  WAVESPEED AI — Full Integration Test");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  API Key: ${API_KEY!.slice(0, 12)}...${API_KEY!.slice(-4)}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log("");

  // Step 1: Submit all jobs in parallel
  console.log("━━━ PHASE 1: Submit all jobs ━━━");
  const submissions = await Promise.all(
    tests.map(async (test) => ({
      test,
      predictionId: await submitJob(test),
    }))
  );

  const activeJobs = submissions.filter((s) => s.predictionId);
  console.log(`\n\n━━━ PHASE 2: Poll results (${activeJobs.length}/${tests.length} submitted) ━━━`);

  if (activeJobs.length === 0) {
    console.error("\n❌ No jobs were submitted successfully. Check your API key and account balance.");
    process.exit(1);
  }

  // Step 2: Poll all jobs
  const results = await Promise.all(
    activeJobs.map(async ({ test, predictionId }) =>
      ({
        name: test.name,
        expectedCost: test.expectedCostRange,
        result: await pollResult(predictionId!, test.name),
      })
    )
  );

  // Step 3: Summary
  console.log("\n\n═══════════════════════════════════════════════════");
  console.log("  RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("  Model                          | Status    | Time    | Expected Cost");
  console.log("  -------------------------------|-----------|---------|---------------");

  let totalSucceeded = 0;
  let totalFailed = 0;

  for (const r of results) {
    const time = `${Math.round(r.result.durationMs / 1000)}s`;
    const cost = `$${r.expectedCost[0].toFixed(2)}-$${r.expectedCost[1].toFixed(2)}`;
    const status = r.result.status === "completed" ? "✅ OK" : r.result.status === "failed" ? "❌ FAIL" : "⏰ TIMEOUT";

    if (r.result.status === "completed") totalSucceeded++;
    else totalFailed++;

    const nameCol = r.name.padEnd(33);
    const statusCol = status.padEnd(10);
    const timeCol = time.padEnd(8);
    console.log(`  ${nameCol}| ${statusCol}| ${timeCol}| ${cost}`);
  }

  const failedSubmissions = submissions.filter((s) => !s.predictionId);
  for (const f of failedSubmissions) {
    const nameCol = f.test.name.padEnd(33);
    console.log(`  ${nameCol}| ❌ NO SUB | N/A     | N/A`);
    totalFailed++;
  }

  console.log("");
  console.log(`  Total: ${totalSucceeded} succeeded, ${totalFailed} failed`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch(console.error);
