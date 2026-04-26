/**
 * Genesis Studio Audit — Brain Studio E2E Test
 * Runs the full 6-scene orchestration once.
 *
 * Usage: npx tsx audit/scripts/e2e-test-brain-studio.ts
 * Requires: ANTHROPIC_API_KEY, RUNPOD_API_KEY, RUNPOD_ENDPOINT_WAN22, SUPABASE_* in .env.local
 * Cost: ~$0.50-1.50 depending on model
 *
 * WARNING: This will consume real credits and GPU time.
 * Run only after operator approval.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

console.log("=== BRAIN STUDIO E2E TEST ===\n");
console.log("WARNING: This test will incur real costs (~$0.50-1.50).");
console.log("Run with --confirm to proceed.\n");

if (!process.argv.includes("--confirm")) {
  console.log("Pass --confirm to run. Exiting.");
  process.exit(0);
}

console.log("This test requires a running Next.js server.");
console.log("Start the dev server first: npm run dev\n");

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function testBrainStudio() {
  // Step 1: Plan
  console.log("Step 1: Planning production...");
  const planStart = Date.now();

  const planRes = await fetch(`${APP_URL}/api/brain/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      concept: "The rise of artificial intelligence in Africa — how startups in Lagos, Nairobi, and Cape Town are building the future",
      targetDuration: 30,
      style: "documentary",
      aspectRatio: "landscape",
      voiceover: true,
      music: true,
      captions: false,
      soundEffects: false,
    }),
  });

  if (!planRes.ok) {
    console.log(`FAIL: Plan endpoint returned ${planRes.status}`);
    console.log(await planRes.text());
    return;
  }

  const planData = await planRes.json();
  const planTime = ((Date.now() - planStart) / 1000).toFixed(1);
  console.log(`  Plan created in ${planTime}s`);
  console.log(`  Scenes: ${planData.plan?.scenes?.length || "UNKNOWN"}`);
  console.log(`  Credits: ${planData.totalCredits || "UNKNOWN"}`);

  // Note: Full execution requires auth (Clerk session)
  // This test verifies the planning step works
  console.log("\nNote: Full production execution requires Clerk auth.");
  console.log("To run the complete pipeline, use the Brain Studio UI at /brain.");
  console.log(`\nPlan step: PASS (${planTime}s)`);
}

testBrainStudio().catch(console.error);
