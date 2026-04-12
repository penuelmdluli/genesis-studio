/**
 * REAL PRODUCTION TEST: African Voice & Narration — South Africa (en-ZA)
 *
 * Creates a REAL Brain Studio production that:
 *   1. Plans via Claude (with African narration rules injected)
 *   2. Creates a production record in Supabase
 *   3. Submits scenes to RunPod for video generation
 *   4. Generates voiceover via FAL Kokoro (af_sky, 1.05x speed)
 *   5. Generates background music via FAL stable-audio
 *   6. All visible in the production dashboard
 *
 * Run: npx tsx scripts/test-africa-production.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  console.warn("Could not load .env.local");
}

// Now import modules (after env is loaded)
const { planProduction, calculateBrainCredits } = require("../src/lib/genesis-brain/planner");
const { consistencyEngine } = require("../src/lib/genesis-brain/consistency");
const { createProduction, executeProduction, updateProduction, getProduction, getProductionScenes } = require("../src/lib/genesis-brain/orchestrator");
const { createSupabaseAdmin } = require("../src/lib/supabase");

// Owner user ID (from dev/produce route)
const DEV_USER_ID = "c1fccbb2-86e9-4d34-ae43-4a7cf4fd4a26";
const DEV_CLERK_ID = (process.env.OWNER_CLERK_IDS || "").split(",")[0]?.trim() || "";

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  REAL PRODUCTION: South Africa en-ZA + Zulu Voice       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Verify keys
  if (!process.env.FAL_KEY) { console.error("FATAL: FAL_KEY not set"); process.exit(1); }
  if (!process.env.GENESIS_CLAUDE_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error("FATAL: No Claude API key"); process.exit(1);
  }

  // Verify owner user exists
  const supabase = createSupabaseAdmin();
  const { data: ownerUser } = await supabase
    .from("users")
    .select("id, name, plan, credit_balance")
    .eq("id", DEV_USER_ID)
    .single();

  if (!ownerUser) {
    console.error("FATAL: Owner user not found in DB. Check DEV_USER_ID.");
    process.exit(1);
  }
  console.log(`User: ${ownerUser.name} (${ownerUser.plan}, ${ownerUser.credit_balance} credits)\n`);

  // ── STEP 1: Plan ──
  console.log("[STEP 1] Planning production via Claude (en-ZA African narration rules)...");
  const brainInput = {
    concept: "South Africa's Eskom announces end of loadshedding as new solar farms come online. Millions of South Africans celebrate as power returns to communities across Gauteng, KwaZulu-Natal and the Western Cape.",
    targetDuration: 20,
    style: "cinematic",
    aspectRatio: "portrait",
    voiceover: true,
    voiceoverVoice: "en-US-GuyNeural",
    voiceoverLanguage: "en-ZA",      // <── AFRICAN LANGUAGE
    music: true,
    captions: true,
    soundEffects: false,             // Skip SFX to keep test fast
    engagementCTA: true,
  };

  const planStart = Date.now();
  let plan = await planProduction(brainInput);
  plan = consistencyEngine.applyAll(plan);

  // Store voice settings
  (plan as any).voiceoverVoice = brainInput.voiceoverVoice;
  (plan as any).voiceoverLanguage = brainInput.voiceoverLanguage;

  const planMs = Date.now() - planStart;
  console.log(`  Plan complete in ${(planMs / 1000).toFixed(1)}s — ${plan.scenes.length} scenes\n`);

  // Print voiceover lines
  console.log("  VOICEOVER LINES (should sound South African):");
  for (const scene of plan.scenes) {
    console.log(`    Scene ${scene.sceneNumber}: "${(scene.voiceoverLine || "(none)").substring(0, 100)}"`);
  }

  const fullScript = plan.scenes.map((s: any) => s.voiceoverLine).filter(Boolean).join(" ");
  console.log(`\n  Full script (${fullScript.split(/\s+/).length} words): "${fullScript.substring(0, 200)}..."\n`);

  // ── STEP 2: Calculate credits ──
  const totalCredits = calculateBrainCredits(plan, brainInput);
  console.log(`[STEP 2] Credits required: ${totalCredits}\n`);

  // ── STEP 3: Create production in DB ──
  console.log("[STEP 3] Creating production record in Supabase...");
  const production = await createProduction(DEV_USER_ID, brainInput, plan, totalCredits);
  await updateProduction(production.id, {
    status: "planned",
    plan: JSON.stringify(plan),
    total_credits: totalCredits,
  });
  console.log(`  Production ID: ${production.id}`);
  console.log(`  Status: planned`);
  console.log(`  Dashboard URL: https://genesis-studio-hazel.vercel.app/brain\n`);

  // ── STEP 4: Execute (scenes + audio) ──
  console.log("[STEP 4] Executing production (submitting scenes + generating audio)...");
  console.log("  This submits video scenes to RunPod and generates voiceover via Kokoro TTS...\n");

  const execStart = Date.now();
  try {
    await executeProduction(production.id, DEV_USER_ID, DEV_CLERK_ID, plan, brainInput);
    const execMs = Date.now() - execStart;
    console.log(`\n  Execution completed in ${(execMs / 1000).toFixed(1)}s`);
  } catch (err: any) {
    console.error(`\n  Execution error: ${err.message}`);
    console.log("  (Scenes may still be processing on RunPod — check dashboard)");
  }

  // ── STEP 5: Check status ──
  console.log("\n[STEP 5] Checking production status...");
  const refreshed = await getProduction(production.id);
  const scenes = await getProductionScenes(production.id);

  console.log(`  Status: ${refreshed?.status}`);
  console.log(`  Progress: ${refreshed?.progress}%`);
  console.log(`  Voiceover URL: ${refreshed?.voiceoverUrl || "(pending)"}`);
  console.log(`  Music URL: ${refreshed?.musicUrl || "(pending)"}`);

  console.log(`\n  Scenes:`);
  for (const scene of scenes) {
    console.log(`    Scene ${scene.sceneNumber}: ${scene.status} — ${scene.modelId} ${scene.duration}s`);
    if (scene.runpodJobId) console.log(`      Job: ${scene.runpodJobId}`);
    if (scene.outputVideoUrl) console.log(`      Video: ${scene.outputVideoUrl.substring(0, 60)}...`);
    if (scene.errorMessage) console.log(`      Error: ${scene.errorMessage}`);
  }

  // ── SUMMARY ──
  const completed = scenes.filter((s: any) => s.status === "completed").length;
  const processing = scenes.filter((s: any) => s.status === "processing").length;
  const failed = scenes.filter((s: any) => s.status === "failed").length;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  PRODUCTION SUMMARY`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Production ID:  ${production.id}`);
  console.log(`  Language:        en-ZA (South African English)`);
  console.log(`  Voice:           af_sky @ 1.05x (Kokoro optimized)`);
  console.log(`  Status:          ${refreshed?.status}`);
  console.log(`  Scenes:          ${completed} done, ${processing} processing, ${failed} failed / ${scenes.length} total`);
  console.log(`  Voiceover:       ${refreshed?.voiceoverUrl ? "GENERATED" : "pending (check dashboard)"}`);
  console.log(`  Music:           ${refreshed?.musicUrl ? "GENERATED" : "pending (check dashboard)"}`);
  console.log(`  Credits:         ${totalCredits}`);
  console.log(`\n  View on dashboard: https://genesis-studio-hazel.vercel.app/brain`);
  console.log(`  Poll status:       /api/brain/status?id=${production.id}`);
  console.log(`${"═".repeat(60)}\n`);

  if (processing > 0) {
    console.log("  NOTE: Scenes are processing on RunPod (takes 2-5 min per scene).");
    console.log("  Check the Brain dashboard to watch progress and see the final video.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
