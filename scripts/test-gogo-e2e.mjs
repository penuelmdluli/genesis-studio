/**
 * Live E2E Test: Gogo Amapiano
 * Stage 1: Generate character image via WaveSpeed
 * Stage 2: Animate via FAL motion control (prompt-only i2v)
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load env
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const WS_KEY = process.env.WAVESPEED_API_KEY;
const FAL_KEY = process.env.FAL_KEY;

if (!WS_KEY) throw new Error("Missing WAVESPEED_API_KEY");
if (!FAL_KEY) throw new Error("Missing FAL_KEY");

const WS_BASE = "https://api.wavespeed.ai/api/v3";

// ── STAGE 1: Generate Gogo image ──

const imagePrompt = [
  "Photorealistic full body photo of",
  "a lively 70-year-old South African Zulu grandmother (gogo) with a warm wrinkled face and bright kind eyes,",
  "wearing a traditional colorful Shweshwe dress with a matching doek headwrap, sturdy comfortable shoes,",
  "in a confident amapiano dance freeze-frame pose, one hip cocked to the side, arms flowing mid-swing, weight on one foot, looking joyful,",
  "in a cozy South African township living room, colorful crochet blankets on couches, family photos on walls, warm lighting from table lamp, comfortable home atmosphere,",
  "entire body from head to feet visible, sharp focus on main subject,",
  "blurred people in the background, bokeh background,",
  "main character centered and in perfect focus,",
  "full length shot, 8K hyperrealistic, masterpiece quality",
].join(" ");

console.log("=== STAGE 1: Generating Gogo character image ===");
console.log(`Prompt: ${imagePrompt.slice(0, 120)}...`);
console.log("");

// Submit image gen
const submitRes = await fetch(`${WS_BASE}/wavespeed-ai/flux-dev`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${WS_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: imagePrompt,
    size: "576x1024",
    num_images: 1,
  }),
});

if (!submitRes.ok) {
  const err = await submitRes.text();
  throw new Error(`WaveSpeed submit failed (${submitRes.status}): ${err}`);
}

const submitData = await submitRes.json();
const predId = submitData.data?.id || submitData.id;
console.log(`Image job submitted: ${predId}`);

// Poll until complete
let imageUrl = null;
const maxWait = 60_000;
const start = Date.now();

while (Date.now() - start < maxWait) {
  await new Promise((r) => setTimeout(r, 3000));

  const pollRes = await fetch(`${WS_BASE}/predictions/${predId}/result`, {
    headers: { Authorization: `Bearer ${WS_KEY}` },
  });

  if (!pollRes.ok) {
    console.log(`  Polling... (${pollRes.status})`);
    continue;
  }

  const pollData = await pollRes.json();
  const pred = pollData.data || pollData;

  if (pred.status === "completed" && pred.outputs?.length > 0) {
    imageUrl = pred.outputs[0];
    break;
  } else if (pred.status === "failed") {
    throw new Error(`Image generation failed: ${pred.error}`);
  } else {
    console.log(`  Polling... status=${pred.status}`);
  }
}

if (!imageUrl) throw new Error("Image generation timed out");

console.log("");
console.log("STAGE 1 RESULT:");
console.log(`  Character Image URL: ${imageUrl}`);
console.log("  PASS ✅ — Gogo character image generated");

// ── STAGE 2: Animate with FAL (prompt-only i2v) ──

console.log("");
console.log("=== STAGE 2: Animating Gogo with amapiano dance ===");

const animationPrompt = [
  "person performing amapiano log driver dance move,",
  "smooth hip sway and arm swing,",
  "feet doing the subtle step,",
  "body loose and joyful,",
  "pure South African amapiano energy, rhythmic movement",
].join(" ");

console.log(`Animation prompt: ${animationPrompt.slice(0, 100)}...`);
console.log(`Image URL: ${imageUrl.slice(0, 80)}...`);

// Submit to FAL Kling v3 standard i2v (same as motion-control prompt-only mode)
const falEndpoint = "fal-ai/kling-video/v3/standard/image-to-video";

const falSubmitRes = await fetch(`https://queue.fal.run/${falEndpoint}`, {
  method: "POST",
  headers: {
    Authorization: `Key ${FAL_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    input: {
      image_url: imageUrl,
      prompt: animationPrompt,
      duration: "5",
      aspect_ratio: "9:16",
    },
  }),
});

if (!falSubmitRes.ok) {
  const err = await falSubmitRes.text();
  throw new Error(`FAL submit failed (${falSubmitRes.status}): ${err}`);
}

const falSubmitData = await falSubmitRes.json();
const falRequestId = falSubmitData.request_id;
console.log(`Animation job submitted: ${falRequestId}`);

// Poll FAL status
let videoUrl = null;
const falStart = Date.now();
const falMaxWait = 300_000; // 5 minutes

while (Date.now() - falStart < falMaxWait) {
  await new Promise((r) => setTimeout(r, 10000));

  const statusRes = await fetch(
    `https://queue.fal.run/${falEndpoint}/requests/${falRequestId}/status`,
    { headers: { Authorization: `Key ${FAL_KEY}` } }
  );

  if (!statusRes.ok) {
    console.log(`  Polling FAL... (${statusRes.status})`);
    continue;
  }

  const statusData = await statusRes.json();

  if (statusData.status === "COMPLETED") {
    // Get the result
    const resultRes = await fetch(
      `https://queue.fal.run/${falEndpoint}/requests/${falRequestId}`,
      { headers: { Authorization: `Key ${FAL_KEY}` } }
    );
    const resultData = await resultRes.json();
    videoUrl = resultData.video?.url || resultData.data?.video?.url;
    break;
  } else if (statusData.status === "FAILED") {
    throw new Error(`Animation failed: ${JSON.stringify(statusData)}`);
  } else {
    const elapsed = Math.round((Date.now() - falStart) / 1000);
    console.log(`  Polling FAL... status=${statusData.status} (${elapsed}s elapsed)`);
  }
}

if (!videoUrl) throw new Error("Animation timed out after 5 minutes");

console.log("");
console.log("STAGE 2 RESULT:");
console.log(`  Video URL: ${videoUrl}`);
console.log("  PASS ✅ — Gogo is dancing amapiano!");

// ── SUMMARY ──

console.log("");
console.log("═══════════════════════════════════════════════");
console.log("  GOGO AMAPIANO E2E TEST — ALL STAGES PASSED ✅");
console.log("═══════════════════════════════════════════════");
console.log(`  Character Image: ${imageUrl}`);
console.log(`  Dance Video:     ${videoUrl}`);
console.log("═══════════════════════════════════════════════");
