/**
 * Genesis Studio Audit — Model Inventory
 * Lists every provider integration found in the codebase.
 *
 * Usage: npx tsx audit/scripts/inventory-models.ts
 */

// This script reads from constants and outputs the model registry
import { AI_MODELS } from "../../src/lib/constants";

console.log("=== GENESIS STUDIO MODEL INVENTORY ===\n");
console.log("| Model ID | Name | Tier | Provider | Types | Has Audio | Max Res | Credit Cost (720p) |");
console.log("|----------|------|------|----------|-------|-----------|---------|-------------------|");

for (const [id, model] of Object.entries(AI_MODELS)) {
  const cost720 = model.creditCost["720p"] || model.creditCost["480p"] || "N/A";
  console.log(
    `| ${id} | ${model.name} | ${model.tier} | ${model.provider || "runpod"} | ${model.types.join(",")} | ${model.hasAudio ? "Yes" : "No"} | ${model.maxResolution} | ${cost720} |`
  );
}

console.log(`\nTotal models: ${Object.keys(AI_MODELS).length}`);

// Check env vars for endpoint configuration
console.log("\n=== ENDPOINT CONFIGURATION ===\n");
const endpoints = [
  "RUNPOD_ENDPOINT_WAN22",
  "RUNPOD_ENDPOINT_WAN22_I2V",
  "RUNPOD_ENDPOINT_HUNYUAN",
  "RUNPOD_ENDPOINT_LTX",
  "RUNPOD_ENDPOINT_WAN21_TURBO",
  "RUNPOD_ENDPOINT_MOCHI",
  "RUNPOD_ENDPOINT_COGVIDEO",
  "RUNPOD_ENDPOINT_MIMIC_MOTION",
  "RUNPOD_COMFYUI_ENDPOINT_ID",
  "FAL_KEY",
];

for (const key of endpoints) {
  const val = process.env[key];
  console.log(`${key}: ${val ? "CONFIGURED" : "NOT SET"}`);
}
