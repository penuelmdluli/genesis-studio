/**
 * Genesis Studio Audit — E2E Provider Tests
 * Tests each video provider with a minimal generation.
 *
 * Usage: npx tsx audit/scripts/e2e-test-providers.ts
 *        npx tsx audit/scripts/e2e-test-providers.ts --include-expensive
 *
 * Requires: .env.local with FAL_KEY, RUNPOD_API_KEY, RUNPOD_ENDPOINT_WAN22
 *
 * WARNING: This will incur real costs (~$0.35 for basic tests, ~$3+ with --include-expensive)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const includeExpensive = process.argv.includes("--include-expensive");

console.log("=== GENESIS STUDIO E2E PROVIDER TESTS ===\n");
console.log(`Include expensive models: ${includeExpensive}`);
console.log(`FAL_KEY: ${process.env.FAL_KEY ? "SET" : "NOT SET"}`);
console.log(`RUNPOD_API_KEY: ${process.env.RUNPOD_API_KEY ? "SET" : "NOT SET"}`);
console.log(`RUNPOD_ENDPOINT_WAN22: ${process.env.RUNPOD_ENDPOINT_WAN22 ? "SET" : "NOT SET"}`);
console.log("");

// Test prompt
const TEST_PROMPT = "a calm ocean wave at sunrise, cinematic, 9:16";

interface TestResult {
  provider: string;
  endpoint: string;
  status: "PASS" | "FAIL" | "SKIP";
  time: string;
  cost: string;
  outputUrl: string;
  notes: string;
}

const results: TestResult[] = [];

async function testRunPodWan22() {
  const endpointId = process.env.RUNPOD_ENDPOINT_WAN22;
  if (!endpointId) {
    results.push({ provider: "RunPod Wan 2.2", endpoint: "N/A", status: "SKIP", time: "-", cost: "-", outputUrl: "-", notes: "RUNPOD_ENDPOINT_WAN22 not set" });
    return;
  }

  console.log("Testing RunPod Wan 2.2...");
  const start = Date.now();

  try {
    const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: TEST_PROMPT,
          negative_prompt: "blurry, low quality",
          size: "720*1280",
          duration: 5,
          seed: 42,
          enable_safety_checker: false,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      results.push({ provider: "RunPod Wan 2.2", endpoint: endpointId, status: "FAIL", time: "-", cost: "-", outputUrl: "-", notes: `HTTP ${res.status}: ${body.slice(0, 100)}` });
      return;
    }

    const data = await res.json();
    console.log(`  Job submitted: ${data.id}`);

    // Poll for completion (max 5 min)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`https://api.runpod.ai/v2/${endpointId}/status/${data.id}`, {
        headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` },
      });
      const status = await statusRes.json();

      if (status.status === "COMPLETED") {
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        const videoUrl = status.output?.video_url || status.output?.result || "";
        results.push({ provider: "RunPod Wan 2.2", endpoint: endpointId, status: "PASS", time: `${elapsed}s`, cost: "~$0.06", outputUrl: videoUrl.slice(0, 80), notes: "" });
        return;
      }
      if (status.status === "FAILED") {
        results.push({ provider: "RunPod Wan 2.2", endpoint: endpointId, status: "FAIL", time: "-", cost: "-", outputUrl: "-", notes: status.error || "Unknown error" });
        return;
      }
      process.stdout.write(".");
    }
    results.push({ provider: "RunPod Wan 2.2", endpoint: endpointId, status: "FAIL", time: "300s+", cost: "-", outputUrl: "-", notes: "Timeout after 5 min" });
  } catch (err) {
    results.push({ provider: "RunPod Wan 2.2", endpoint: endpointId, status: "FAIL", time: "-", cost: "-", outputUrl: "-", notes: `${err}` });
  }
}

async function testFalModel(name: string, falModelId: string, estimatedCost: string) {
  if (!process.env.FAL_KEY) {
    results.push({ provider: name, endpoint: falModelId, status: "SKIP", time: "-", cost: "-", outputUrl: "-", notes: "FAL_KEY not set" });
    return;
  }

  console.log(`Testing ${name}...`);
  const start = Date.now();

  try {
    // Dynamic import of FAL client
    const { fal } = await import("@fal-ai/client");
    fal.config({ credentials: process.env.FAL_KEY! });

    const result = await fal.subscribe(falModelId, {
      input: {
        prompt: TEST_PROMPT,
        duration: "5",
        aspect_ratio: "9:16",
      },
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    const data = result.data as { video?: { url?: string } };
    const videoUrl = data?.video?.url || "";

    results.push({ provider: name, endpoint: falModelId, status: "PASS", time: `${elapsed}s`, cost: estimatedCost, outputUrl: videoUrl.slice(0, 80), notes: "" });
  } catch (err) {
    results.push({ provider: name, endpoint: falModelId, status: "FAIL", time: "-", cost: "-", outputUrl: "-", notes: `${err}`.slice(0, 100) });
  }
}

async function main() {
  await testRunPodWan22();
  await testFalModel("FAL Seedance 1.5", "fal-ai/bytedance/seedance/v1/pro/text-to-video", "~$0.10");
  await testFalModel("FAL Kling 2.6", "fal-ai/kling-video/v2.6/pro/text-to-video", "~$0.18");

  if (includeExpensive) {
    await testFalModel("FAL Kling 3.0", "fal-ai/kling-video/v3/pro/text-to-video", "~$0.25");
    await testFalModel("FAL Veo 3.1", "fal-ai/veo3", "~$0.50");
  } else {
    results.push({ provider: "FAL Kling 3.0", endpoint: "fal-ai/kling-video/v3/pro/text-to-video", status: "SKIP", time: "-", cost: "-", outputUrl: "-", notes: "Use --include-expensive" });
    results.push({ provider: "FAL Veo 3.1", endpoint: "fal-ai/veo3", status: "SKIP", time: "-", cost: "-", outputUrl: "-", notes: "Use --include-expensive" });
  }

  console.log("\n=== RESULTS ===\n");
  console.log("| Provider | Endpoint | Status | Time | Cost | Output URL | Notes |");
  console.log("|----------|----------|--------|------|------|------------|-------|");
  for (const r of results) {
    const statusIcon = r.status === "PASS" ? "PASS" : r.status === "FAIL" ? "FAIL" : "SKIP";
    console.log(`| ${r.provider} | ${r.endpoint.slice(0, 40)} | ${statusIcon} | ${r.time} | ${r.cost} | ${r.outputUrl} | ${r.notes} |`);
  }

  // Calculate total cost
  const totalCost = results
    .filter(r => r.status === "PASS")
    .reduce((sum, r) => {
      const match = r.cost.match(/\$([\d.]+)/);
      return sum + (match ? parseFloat(match[1]) : 0);
    }, 0);
  console.log(`\nTotal test cost: $${totalCost.toFixed(2)}`);
}

main().catch(console.error);
